import * as THREE from 'three';
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
import { ChunkPipeline } from './ChunkPipeline';
import { initializeChunkLighting, updateLightingAtEdit } from './Lighting';
import { TerrainGen } from './TerrainGen';

export class World {
  public readonly scene: THREE.Scene;
  public readonly atlas: TextureAtlas;
  public readonly terrainGen: TerrainGen;
  public readonly renderDistance: number;
  public readonly lightUniforms: VoxelLightUniforms;

  private readonly chunks = new Map<string, Chunk>();
  private readonly chunkPipeline: ChunkPipeline;
  private readonly pendingChunks = new Set<string>();
  /** Sparse player edits grouped by chunk, indexed using the chunk's linear voxel index. */
  private readonly editsByChunk = new Map<string, Map<number, BlockId>>();
  private readonly opaqueMaterial: THREE.MeshBasicMaterial;
  private readonly waterMaterial: THREE.MeshBasicMaterial;

  constructor(
    scene: THREE.Scene,
    atlas: TextureAtlas,
    seed: number,
    renderDistance = 5,
    savedEdits: SerializedVoxelEdit[] = []
  ) {
    this.scene = scene;
    this.atlas = atlas;
    this.terrainGen = new TerrainGen(seed);
    this.chunkPipeline = new ChunkPipeline(seed);
    this.renderDistance = renderDistance;
    this.lightUniforms = createVoxelLightUniforms();
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
    return this.pendingChunks.size;
  }

  public get workerPipelineActive(): boolean {
    return this.chunkPipeline.active;
  }

  public get editCount(): number {
    let count = 0;
    for (const edits of this.editsByChunk.values()) count += edits.size;
    return count;
  }

  public exportEdits(): SerializedVoxelEdit[] {
    const result: SerializedVoxelEdit[] = [];
    for (const [key, edits] of this.editsByChunk) {
      const [cx, cz] = key.split(',').map(Number);
      for (const [index, block] of edits) {
        const y = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
        const rem = index - y * CHUNK_SIZE * CHUNK_SIZE;
        const lz = Math.floor(rem / CHUNK_SIZE);
        const lx = rem % CHUNK_SIZE;
        result.push([cx * CHUNK_SIZE + lx, y, cz * CHUNK_SIZE + lz, block]);
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
    return this.chunks.get(Chunk.key(cx, cz));
  }

  public isPositionLoaded(wx: number, wz: number): boolean {
    return this.chunks.has(Chunk.key(World.worldToChunkCoord(wx), World.worldToChunkCoord(wz)));
  }

  public getBlock(wx: number, wy: number, wz: number): BlockId {
    const y = Math.floor(wy);
    if (y < 0 || y >= CHUNK_HEIGHT) return BlockId.Air;
    const cx = World.worldToChunkCoord(wx);
    const cz = World.worldToChunkCoord(wz);
    const chunk = this.chunks.get(Chunk.key(cx, cz));
    if (!chunk) return BlockId.Air;

    const lx = World.worldToLocalCoord(wx);
    const lz = World.worldToLocalCoord(wz);
    return chunk.get(lx, y, lz);
  }

  /** Returns packed byte `(sky << 4) | block` at world coords */
  public getPackedLight(wx: number, wy: number, wz: number): number {
    const y = Math.floor(wy);
    if (y >= CHUNK_HEIGHT) return 0xf0;
    if (y < 0) return 0x00;
    const cx = World.worldToChunkCoord(wx);
    const cz = World.worldToChunkCoord(wz);
    const chunk = this.chunks.get(Chunk.key(cx, cz));
    if (!chunk) return 0xf0;

    const lx = World.worldToLocalCoord(wx);
    const lz = World.worldToLocalCoord(wz);
    return chunk.light[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  public setBlock(wx: number, wy: number, wz: number, id: BlockId): boolean {
    const x = Math.floor(wx);
    const y = Math.floor(wy);
    const z = Math.floor(wz);
    if (y < 0 || y >= CHUNK_HEIGHT) return false;

    const cx = World.worldToChunkCoord(x);
    const cz = World.worldToChunkCoord(z);
    const chunk = this.chunks.get(Chunk.key(cx, cz));
    if (!chunk) return false;

    const lx = World.worldToLocalCoord(x);
    const lz = World.worldToLocalCoord(z);
    if (chunk.get(lx, y, lz) === id) return true;
    chunk.set(lx, y, lz, id);
    this.recordEdit(cx, cz, lx, y, lz, id);

    // Recompute local skylight & block light around the edited voxel
    const affectedKeys = updateLightingAtEdit(x, y, z, (qcx, qcz) => this.getChunk(qcx, qcz));
    affectedKeys.add(Chunk.key(cx, cz));

    // Immediately rebuild the primary edited chunk + direct neighbors so block placement feels instant,
    // and mark any farther light-affected chunks dirty for next-frame streaming.
    for (const key of affectedKeys) {
      const c = this.chunks.get(key);
      if (!c) continue;
      const dist = Math.abs(c.cx - cx) + Math.abs(c.cz - cz);
      if (dist <= 1) {
        this.rebuildChunkMesh(c);
      } else {
        c.dirty = true;
      }
    }

    return true;
  }

  /** Pre-generates initial area synchronously around spawn so player never falls into void */
  public generateInitialArea(spawnX: number, spawnZ: number, radius = 3): void {
    const centerCx = World.worldToChunkCoord(spawnX);
    const centerCz = World.worldToChunkCoord(spawnZ);

    // 1. Populate voxel data
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.ensureChunkData(centerCx + dx, centerCz + dz, false);
      }
    }

    // 2. Initialize lighting across the loaded grid
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

    // 3. Build initial meshes
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = this.getChunk(centerCx + dx, centerCz + dz);
        if (c && c.dirty) {
          this.rebuildChunkMesh(c);
        }
      }
    }
  }

  /** Streams chunks in/out around player with per-frame budgets for smooth 60 FPS */
  public updateStreaming(playerX: number, playerZ: number): void {
    const pCx = World.worldToChunkCoord(playerX);
    const pCz = World.worldToChunkCoord(playerZ);
    const r = this.renderDistance;
    const unloadDistSq = (r + 2) * (r + 2);

    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - pCx;
      const dz = chunk.cz - pCz;
      if (dx * dx + dz * dz > unloadDistSq) {
        chunk.disposeMeshes(this.scene);
        this.chunks.delete(key);
      }
    }

    const desired: Array<{ cx: number; cz: number; distSq: number }> = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const distSq = dx * dx + dz * dz;
        if (distSq <= r * r + 1) {
          desired.push({ cx: pCx + dx, cz: pCz + dz, distSq });
        }
      }
    }
    desired.sort((a, b) => a.distSq - b.distSq);

    // Queue up to 2 terrain jobs per frame. Generation happens in a Web Worker;
    // lighting and Three.js mesh attachment remain deterministic on the main thread.
    let genBudget = 2;
    for (const item of desired) {
      if (genBudget <= 0) break;
      const key = Chunk.key(item.cx, item.cz);
      if (!this.chunks.has(key) && !this.pendingChunks.has(key)) {
        this.requestChunkData(item.cx, item.cz);
        genBudget--;
      }
    }

    // Mesh up to 3 dirty chunks per frame
    let meshBudget = 3;
    for (const item of desired) {
      if (meshBudget <= 0) break;
      const chunk = this.chunks.get(Chunk.key(item.cx, item.cz));
      if (chunk && chunk.dirty) {
        this.rebuildChunkMesh(chunk);
        meshBudget--;
      }
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

  private ensureChunkData(cx: number, cz: number, computeLightImmediately: boolean): Chunk {
    const key = Chunk.key(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.terrainGen.populateChunk(chunk);
      this.applySavedEdits(chunk);
      this.chunks.set(key, chunk);

      this.markAdjacentChunksDirty(cx, cz);

      if (computeLightImmediately) {
        initializeChunkLighting(
          chunk,
          (qcx, qcz) => this.getChunk(qcx, qcz),
          (mcx, mcz) => this.markChunkDirty(mcx, mcz)
        );
      }
    }
    return chunk;
  }

  private requestChunkData(cx: number, cz: number): void {
    const key = Chunk.key(cx, cz);
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
        if (this.chunks.has(key)) return;

        const chunk = new Chunk(generated.cx, generated.cz);
        chunk.data.set(generated.data);
        this.applySavedEdits(chunk);
        this.chunks.set(key, chunk);
        this.markAdjacentChunksDirty(cx, cz);
        initializeChunkLighting(
          chunk,
          (qcx, qcz) => this.getChunk(qcx, qcz),
          (mcx, mcz) => this.markChunkDirty(mcx, mcz)
        );
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
    const key = Chunk.key(cx, cz);
    let edits = this.editsByChunk.get(key);
    if (!edits) {
      edits = new Map<number, BlockId>();
      this.editsByChunk.set(key, edits);
    }
    edits.set((y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx, id);
  }

  private applySavedEdits(chunk: Chunk): void {
    const edits = this.editsByChunk.get(Chunk.key(chunk.cx, chunk.cz));
    if (!edits) return;
    for (const [index, block] of edits) chunk.data[index] = block;
    chunk.dirty = true;
  }

  private markAdjacentChunksDirty(cx: number, cz: number): void {
    this.markChunkDirty(cx - 1, cz);
    this.markChunkDirty(cx + 1, cz);
    this.markChunkDirty(cx, cz - 1);
    this.markChunkDirty(cx, cz + 1);
  }

  private markChunkDirty(cx: number, cz: number): void {
    const neighbor = this.chunks.get(Chunk.key(cx, cz));
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
      this.atlas
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
