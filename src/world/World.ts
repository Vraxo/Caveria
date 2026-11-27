import * as THREE from 'three';
import type { BiomeSize } from '../Biomes/BiomeSize';
import type { SerializedVoxelEdit } from '../persistence/WorldPersistence';
import { TextureAtlas } from '../rendering/TextureAtlas';
import {
  VoxelLightUniforms,
  applyVoxelLightingShader,
  createVoxelLightUniforms,
} from '../rendering/VoxelMaterial';
import { BlockId } from '../content/BlockId';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './Chunk';
import { buildChunkGeometries } from './ChunkMesher';
import { ChunkPipeline, type GeneratedChunkData } from './ChunkPipeline';
import { initializeChunkLighting, updateLightingAtEdit } from './Lighting';
import { TerrainGen } from './TerrainGen';

interface ChunkEditBucket {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Map<number, BlockId>;
}

interface SpiralOffset {
  readonly dx: number;
  readonly dz: number;
  readonly distSq: number;
}

/** Max milliseconds spent per frame on chunk lighting + meshing during gameplay streaming. */
const STREAM_FRAME_BUDGET_MS = 3.5;
/** Max concurrent terrain generation jobs queued on the worker pool. */
const MAX_IN_FLIGHT_CHUNKS = 8;

function yieldToBrowserFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export class World {
  public readonly scene: THREE.Scene;
  public readonly atlas: TextureAtlas;
  public readonly terrainGen: TerrainGen;
  public readonly renderDistance: number;
  public readonly lightUniforms: VoxelLightUniforms;

  private readonly chunks = new Map<number, Chunk>();
  private readonly chunkPipeline: ChunkPipeline;
  private readonly pendingChunks = new Set<number>();
  private readonly completedGenQueue: GeneratedChunkData[] = [];
  private readonly spiralOffsets: readonly SpiralOffset[];
  /** Sparse player edits grouped by numeric chunk key. */
  private readonly editsByChunk = new Map<number, ChunkEditBucket>();
  private readonly opaqueMaterial: THREE.MeshBasicMaterial;
  private readonly waterMaterial: THREE.MeshBasicMaterial;
  private lastUnloadCx = Number.NaN;
  private lastUnloadCz = Number.NaN;

  constructor(
    scene: THREE.Scene,
    atlas: TextureAtlas,
    seed: number,
    renderDistance = 5,
    savedEdits: SerializedVoxelEdit[] = [],
    biomeSize: BiomeSize = 'standard'
  ) {
    this.scene = scene;
    this.atlas = atlas;
    this.terrainGen = new TerrainGen(seed, undefined, undefined, biomeSize);
    this.chunkPipeline = new ChunkPipeline(seed, biomeSize);
    this.renderDistance = renderDistance;
    this.lightUniforms = createVoxelLightUniforms();
    this.spiralOffsets = this.buildSpiralOffsets(renderDistance);
    this.importEdits(savedEdits);

    this.opaqueMaterial = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      vertexColors: true,
      alphaTest: 0.5,
      side: THREE.FrontSide,
    });
    applyVoxelLightingShader(this.opaqueMaterial, this.lightUniforms, 'caveria-voxel-opaque-v1');

    this.waterMaterial = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    applyVoxelLightingShader(this.waterMaterial, this.lightUniforms, 'caveria-voxel-water-v1');
  }

  public get loadedChunkCount(): number {
    return this.chunks.size;
  }

  public get pendingChunkCount(): number {
    return this.pendingChunks.size + this.completedGenQueue.length;
  }

  public get workerPipelineActive(): boolean {
    return this.chunkPipeline.active;
  }

  public get editCount(): number {
    let count = 0;
    for (const bucket of this.editsByChunk.values()) count += bucket.blocks.size;
    return count;
  }

  public exportEdits(): SerializedVoxelEdit[] {
    const result: SerializedVoxelEdit[] = [];
    for (const bucket of this.editsByChunk.values()) {
      const baseX = bucket.cx * CHUNK_SIZE;
      const baseZ = bucket.cz * CHUNK_SIZE;
      for (const [index, block] of bucket.blocks) {
        const y = index >> 8;
        const rem = index & 255;
        const lz = rem >> 4;
        const lx = rem & 15;
        result.push([baseX + lx, y, baseZ + lz, block]);
      }
    }
    return result;
  }

  public static worldToChunkCoord(n: number): number {
    return Math.floor(n / CHUNK_SIZE);
  }

  public static worldToLocalCoord(n: number): number {
    return ((Math.floor(n) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  }

  public getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(Chunk.numKey(cx, cz));
  }

  public isPositionLoaded(wx: number, wz: number): boolean {
    return this.chunks.has(
      Chunk.numKey(World.worldToChunkCoord(wx), World.worldToChunkCoord(wz))
    );
  }

  public getBlock(wx: number, wy: number, wz: number): BlockId {
    const y = Math.floor(wy);
    if (y < 0 || y >= CHUNK_HEIGHT) return BlockId.Air;
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const chunk = this.chunks.get(Chunk.numKey(ix >> 4, iz >> 4));
    if (!chunk) return BlockId.Air;
    return chunk.data[(y * CHUNK_SIZE + (iz & 15)) * CHUNK_SIZE + (ix & 15)] as BlockId;
  }

  /** Returns packed byte `(sky << 4) | block` at world coords */
  public getPackedLight(wx: number, wy: number, wz: number): number {
    const y = Math.floor(wy);
    if (y >= CHUNK_HEIGHT) return 0xf0;
    if (y < 0) return 0x00;
    const ix = Math.floor(wx);
    const iz = Math.floor(wz);
    const chunk = this.chunks.get(Chunk.numKey(ix >> 4, iz >> 4));
    if (!chunk) return 0xf0;
    return chunk.light[(y * CHUNK_SIZE + (iz & 15)) * CHUNK_SIZE + (ix & 15)];
  }

  public setBlock(wx: number, wy: number, wz: number, id: BlockId): boolean {
    const x = Math.floor(wx);
    const y = Math.floor(wy);
    const z = Math.floor(wz);
    if (y < 0 || y >= CHUNK_HEIGHT) return false;

    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.chunks.get(Chunk.numKey(cx, cz));
    if (!chunk) return false;

    const lx = x & 15;
    const lz = z & 15;
    const previousBlock = chunk.get(lx, y, lz);
    if (previousBlock === id) return true;
    chunk.set(lx, y, lz, id);
    this.recordEdit(cx, cz, lx, y, lz, id);

    // Recompute local skylight & block light around the edited voxel
    const affectedKeys = updateLightingAtEdit(
      x,
      y,
      z,
      previousBlock,
      id,
      (qcx, qcz) => this.getChunk(qcx, qcz)
    );
    affectedKeys.add(Chunk.key(cx, cz));

    // Queue remeshing for the frame-end streaming budget.
    for (const key of affectedKeys) {
      const comma = key.indexOf(',');
      const acx = Number(key.slice(0, comma));
      const acz = Number(key.slice(comma + 1));
      const affected = this.getChunk(acx, acz);
      if (affected) affected.dirty = true;
    }

    return true;
  }

  /** Pre-generates initial area synchronously around spawn so player never falls into void */
  public generateInitialArea(spawnX: number, spawnZ: number, radius = 3): void {
    const centerCx = World.worldToChunkCoord(spawnX);
    const centerCz = World.worldToChunkCoord(spawnZ);

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.ensureChunkData(centerCx + dx, centerCz + dz, false);
      }
    }

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = this.getChunk(centerCx + dx, centerCz + dz);
        if (c) {
          initializeChunkLighting(
            c,
            (qcx, qcz) => this.getChunk(qcx, qcz),
            (mcx, mcz) => this.markChunkDirty(mcx, mcz)
          );
        }
      }
    }

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = this.getChunk(centerCx + dx, centerCz + dz);
        if (c && c.dirty) {
          this.rebuildChunkMesh(c);
        }
      }
    }
  }

  /**
   * Time-sliced async version of initial spawn area generation so the loading screen
   * animates smoothly and reports real progress without freezing the browser tab.
   */
  public async generateInitialAreaAsync(
    spawnX: number,
    spawnZ: number,
    radius = 3,
    onProgress?: (fraction: number, statusText: string) => void
  ): Promise<void> {
    const centerCx = World.worldToChunkCoord(spawnX);
    const centerCz = World.worldToChunkCoord(spawnZ);
    const coords: Array<{ cx: number; cz: number }> = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        coords.push({ cx: centerCx + dx, cz: centerCz + dz });
      }
    }
    coords.sort((a, b) => {
      const da = (a.cx - centerCx) ** 2 + (a.cz - centerCz) ** 2;
      const db = (b.cx - centerCx) ** 2 + (b.cz - centerCz) ** 2;
      return da - db;
    });

    const total = coords.length;
    let sliceStart = performance.now();
    const SLICE_MS = 14;

    // Stage 1: Generate terrain data (0% .. 50%)
    if (this.chunkPipeline.active) {
      let generated = 0;
      onProgress?.(0, `Generating terrain (0/${total})...`);
      await Promise.all(
        coords.map(async ({ cx, cz }) => {
          const key = Chunk.numKey(cx, cz);
          if (!this.chunks.has(key)) {
            try {
              const result = await this.chunkPipeline.generate(cx, cz);
              if (!this.chunks.has(key)) {
                const chunk = new Chunk(result.cx, result.cz);
                chunk.data.set(result.data);
                this.applySavedEdits(chunk);
                this.chunks.set(key, chunk);
              }
            } catch {
              this.ensureChunkData(cx, cz, false);
            }
          }
          generated++;
          onProgress?.((generated / total) * 0.5, `Generating terrain (${generated}/${total})...`);
        })
      );
      await yieldToBrowserFrame();
    } else {
      for (let i = 0; i < total; i++) {
        const { cx, cz } = coords[i];
        this.ensureChunkData(cx, cz, false);
        if (performance.now() - sliceStart >= SLICE_MS || i === total - 1) {
          onProgress?.(((i + 1) / total) * 0.5, `Generating terrain (${i + 1}/${total})...`);
          await yieldToBrowserFrame();
          sliceStart = performance.now();
        }
      }
    }

    // Stage 2: Compute skylight & block light (50% .. 72%)
    sliceStart = performance.now();
    for (let i = 0; i < total; i++) {
      const c = this.getChunk(coords[i].cx, coords[i].cz);
      if (c) {
        initializeChunkLighting(
          c,
          (qcx, qcz) => this.getChunk(qcx, qcz),
          (mcx, mcz) => this.markChunkDirty(mcx, mcz)
        );
      }
      if (performance.now() - sliceStart >= SLICE_MS || i === total - 1) {
        onProgress?.(0.5 + ((i + 1) / total) * 0.22, `Computing lighting (${i + 1}/${total})...`);
        await yieldToBrowserFrame();
        sliceStart = performance.now();
      }
    }

    // Stage 3: Build initial chunk meshes (72% .. 100%)
    sliceStart = performance.now();
    for (let i = 0; i < total; i++) {
      const c = this.getChunk(coords[i].cx, coords[i].cz);
      if (c && c.dirty) {
        this.rebuildChunkMesh(c);
      }
      if (performance.now() - sliceStart >= SLICE_MS || i === total - 1) {
        onProgress?.(0.72 + ((i + 1) / total) * 0.28, `Building world meshes (${i + 1}/${total})...`);
        await yieldToBrowserFrame();
        sliceStart = performance.now();
      }
    }
  }

  /** Streams chunks in/out around player within a strict per-frame time budget for smooth 120+ FPS. */
  public updateStreaming(playerX: number, playerZ: number): void {
    const frameStart = performance.now();
    const pCx = World.worldToChunkCoord(playerX);
    const pCz = World.worldToChunkCoord(playerZ);
    const r = this.renderDistance;
    const unloadDistSq = (r + 2) * (r + 2);
    const maxDesiredDistSq = r * r + 1;

    // 1. Only scan for far-chunk unloads when the player enters a new chunk.
    if (pCx !== this.lastUnloadCx || pCz !== this.lastUnloadCz) {
      this.lastUnloadCx = pCx;
      this.lastUnloadCz = pCz;
      for (const [key, chunk] of this.chunks) {
        const dx = chunk.cx - pCx;
        const dz = chunk.cz - pCz;
        if (dx * dx + dz * dz > unloadDistSq) {
          chunk.disposeMeshes(this.scene);
          this.chunks.delete(key);
        }
      }
    }

    // 2. Dispatch off-thread terrain generation up to MAX_IN_FLIGHT_CHUNKS.
    let genSlots = Math.min(3, MAX_IN_FLIGHT_CHUNKS - this.pendingChunks.size);
    if (genSlots > 0) {
      for (let i = 0; i < this.spiralOffsets.length && genSlots > 0; i++) {
        const off = this.spiralOffsets[i];
        const cx = pCx + off.dx;
        const cz = pCz + off.dz;
        const key = Chunk.numKey(cx, cz);
        if (!this.chunks.has(key) && !this.pendingChunks.has(key)) {
          this.requestChunkData(cx, cz);
          genSlots--;
        }
      }
    }

    // 3. Time-budgeted ingestion of completed worker terrain chunks (lighting + neighbor dirtying).
    let ingested = 0;
    while (this.completedGenQueue.length > 0) {
      if (ingested > 0 && performance.now() - frameStart >= STREAM_FRAME_BUDGET_MS) break;
      const generated = this.shiftNearestCompleted(pCx, pCz);
      const dx = generated.cx - pCx;
      const dz = generated.cz - pCz;
      if (dx * dx + dz * dz > unloadDistSq) continue;

      const key = Chunk.numKey(generated.cx, generated.cz);
      if (this.chunks.has(key)) continue;

      const chunk = new Chunk(generated.cx, generated.cz);
      chunk.data.set(generated.data);
      this.applySavedEdits(chunk);
      this.chunks.set(key, chunk);
      this.markMeshedNeighborsDirty(generated.cx, generated.cz);
      initializeChunkLighting(
        chunk,
        (qcx, qcz) => this.getChunk(qcx, qcz),
        (mcx, mcz) => this.markMeshedChunkDirty(mcx, mcz)
      );
      ingested++;
    }

    // 4. Time-budgeted chunk meshing (nearest first; defer outer chunks until cardinal neighbors exist).
    let meshed = 0;
    for (let i = 0; i < this.spiralOffsets.length; i++) {
      if (meshed > 0 && performance.now() - frameStart >= STREAM_FRAME_BUDGET_MS) break;
      if (meshed === 0 && ingested > 0 && performance.now() - frameStart >= STREAM_FRAME_BUDGET_MS) break;

      const off = this.spiralOffsets[i];
      const cx = pCx + off.dx;
      const cz = pCz + off.dz;
      const chunk = this.chunks.get(Chunk.numKey(cx, cz));
      if (!chunk || !chunk.dirty) continue;

      // Avoid rebuilding newly streamed outer chunks 4-5x as neighbors arrive one by one.
      const hasExistingMesh = chunk.opaqueMesh !== null || chunk.waterMesh !== null;
      if (!hasExistingMesh && off.distSq > 4 && !this.hasInRangeCardinalNeighbors(cx, cz, pCx, pCz, maxDesiredDistSq)) {
        continue;
      }

      this.rebuildChunkMesh(chunk);
      meshed++;
    }
  }

  public findSpawnPoint(): THREE.Vector3 {
    for (let radius = 0; radius <= 64; radius += 4) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const wx = Math.round(8 + Math.cos(angle) * radius);
        const wz = Math.round(8 + Math.sin(angle) * radius);
        const surfaceY = this.terrainGen.getSurfaceHeight(wx, wz);
        if (surfaceY >= 46) {
          return new THREE.Vector3(wx + 0.5, surfaceY + 2.5, wz + 0.5);
        }
      }
    }
    const fallbackY = this.terrainGen.getSurfaceHeight(8, 8);
    return new THREE.Vector3(8.5, Math.max(fallbackY, 46) + 2.5, 8.5);
  }

  private buildSpiralOffsets(r: number): SpiralOffset[] {
    const offsets: SpiralOffset[] = [];
    const maxDistSq = r * r + 1;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const distSq = dx * dx + dz * dz;
        if (distSq <= maxDistSq) {
          offsets.push({ dx, dz, distSq });
        }
      }
    }
    offsets.sort((a, b) => a.distSq - b.distSq);
    return offsets;
  }

  private hasInRangeCardinalNeighbors(
    cx: number,
    cz: number,
    pCx: number,
    pCz: number,
    maxDistSq: number
  ): boolean {
    const check = (nx: number, nz: number): boolean => {
      const dx = nx - pCx;
      const dz = nz - pCz;
      if (dx * dx + dz * dz > maxDistSq) return true;
      return this.chunks.has(Chunk.numKey(nx, nz));
    };
    return (
      check(cx - 1, cz) &&
      check(cx + 1, cz) &&
      check(cx, cz - 1) &&
      check(cx, cz + 1)
    );
  }

  private shiftNearestCompleted(pCx: number, pCz: number): GeneratedChunkData {
    let bestIdx = 0;
    let bestDistSq = Infinity;
    for (let i = 0; i < this.completedGenQueue.length; i++) {
      const item = this.completedGenQueue[i];
      const dx = item.cx - pCx;
      const dz = item.cz - pCz;
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIdx = i;
      }
    }
    const [picked] = this.completedGenQueue.splice(bestIdx, 1);
    return picked;
  }

  private ensureChunkData(cx: number, cz: number, computeLightImmediately: boolean): Chunk {
    const key = Chunk.numKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.terrainGen.populateChunk(chunk);
      this.applySavedEdits(chunk);
      this.chunks.set(key, chunk);

      this.markMeshedNeighborsDirty(cx, cz);

      if (computeLightImmediately) {
        initializeChunkLighting(
          chunk,
          (qcx, qcz) => this.getChunk(qcx, qcz),
          (mcx, mcz) => this.markMeshedChunkDirty(mcx, mcz)
        );
      }
    }
    return chunk;
  }

  private requestChunkData(cx: number, cz: number): void {
    const key = Chunk.numKey(cx, cz);
    this.pendingChunks.add(key);

    if (!this.chunkPipeline.active) {
      this.pendingChunks.delete(key);
      this.ensureChunkData(cx, cz, true);
      return;
    }

    void this.chunkPipeline
      .generate(cx, cz)
      .then((generated) => {
        this.pendingChunks.delete(key);
        if (!this.chunks.has(key)) {
          this.completedGenQueue.push(generated);
        }
      })
      .catch(() => {
        this.pendingChunks.delete(key);
        if (!this.chunks.has(key)) this.ensureChunkData(cx, cz, true);
      });
  }

  private importEdits(edits: SerializedVoxelEdit[]): void {
    for (const [x, y, z, block] of edits) {
      const cx = World.worldToChunkCoord(x);
      const cz = World.worldToChunkCoord(z);
      const lx = World.worldToLocalCoord(x);
      const lz = World.worldToLocalCoord(z);
      this.recordEdit(cx, cz, lx, y, lz, block);
    }
  }

  private recordEdit(cx: number, cz: number, lx: number, y: number, lz: number, id: BlockId): void {
    const key = Chunk.numKey(cx, cz);
    let bucket = this.editsByChunk.get(key);
    if (!bucket) {
      bucket = { cx, cz, blocks: new Map<number, BlockId>() };
      this.editsByChunk.set(key, bucket);
    }
    bucket.blocks.set((y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx, id);
  }

  private applySavedEdits(chunk: Chunk): void {
    const bucket = this.editsByChunk.get(Chunk.numKey(chunk.cx, chunk.cz));
    if (!bucket) return;
    for (const [index, block] of bucket.blocks) chunk.data[index] = block;
    chunk.dirty = true;
  }

  private markMeshedNeighborsDirty(cx: number, cz: number): void {
    this.markMeshedChunkDirty(cx - 1, cz);
    this.markMeshedChunkDirty(cx + 1, cz);
    this.markMeshedChunkDirty(cx, cz - 1);
    this.markMeshedChunkDirty(cx, cz + 1);
  }

  private markMeshedChunkDirty(cx: number, cz: number): void {
    const neighbor = this.chunks.get(Chunk.numKey(cx, cz));
    if (neighbor && (neighbor.opaqueMesh !== null || neighbor.waterMesh !== null)) {
      neighbor.dirty = true;
    }
  }

  private markChunkDirty(cx: number, cz: number): void {
    const neighbor = this.chunks.get(Chunk.numKey(cx, cz));
    if (neighbor) {
      neighbor.dirty = true;
    }
  }

  private rebuildChunkMesh(chunk: Chunk): void {
    chunk.disposeMeshes(this.scene);

    const { opaque, water } = buildChunkGeometries(
      chunk,
      (wx, wy, wz) => this.getBlock(wx, wy, wz),
      (wx, wy, wz) => this.getPackedLight(wx, wy, wz),
      this.atlas,
      (qcx, qcz) => this.getChunk(qcx, qcz)
    );

    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;

    if (opaque) {
      const mesh = new THREE.Mesh(opaque, this.opaqueMaterial);
      mesh.position.set(worldX, 0, worldZ);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      chunk.opaqueMesh = mesh;
    }

    if (water) {
      const mesh = new THREE.Mesh(water, this.waterMaterial);
      mesh.position.set(worldX, 0, worldZ);
      mesh.renderOrder = 1;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      chunk.waterMesh = mesh;
    }

    chunk.dirty = false;
  }
}
