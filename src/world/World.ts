import * as THREE from 'three';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { BlockId } from './Block';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './Chunk';
import { buildChunkGeometries } from './ChunkMesher';
import { TerrainGen } from './TerrainGen';

export class World {
  public readonly scene: THREE.Scene;
  public readonly atlas: TextureAtlas;
  public readonly terrainGen: TerrainGen;
  public readonly renderDistance: number;

  private readonly chunks = new Map<string, Chunk>();
  private readonly opaqueMaterial: THREE.MeshBasicMaterial;
  private readonly waterMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, atlas: TextureAtlas, seed: number, renderDistance = 5) {
    this.scene = scene;
    this.atlas = atlas;
    this.terrainGen = new TerrainGen(seed);
    this.renderDistance = renderDistance;

    // Baked directional shading + vertex AO gives authentic classic Minecraft lighting
    // with zero shadow-map artifacts and high performance.
    this.opaqueMaterial = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      vertexColors: true,
      alphaTest: 0.5,
      side: THREE.FrontSide,
    });

    this.waterMaterial = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  public get loadedChunkCount(): number {
    return this.chunks.size;
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
    chunk.set(lx, y, lz, id);

    // Mark adjacent chunks dirty if editing on a chunk boundary
    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);

    // Immediately rebuild edited chunk(s) so player edits have zero frame lag
    this.rebuildChunkMesh(chunk);
    if (lx === 0) this.rebuildNeighborIfDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.rebuildNeighborIfDirty(cx + 1, cz);
    if (lz === 0) this.rebuildNeighborIfDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.rebuildNeighborIfDirty(cx, cz + 1);

    return true;
  }

  /** Pre-generates initial area synchronously around spawn so player never falls into void */
  public generateInitialArea(spawnX: number, spawnZ: number, radius = 3): void {
    const centerCx = World.worldToChunkCoord(spawnX);
    const centerCz = World.worldToChunkCoord(spawnZ);

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.ensureChunkData(centerCx + dx, centerCz + dz);
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

  /** Streams chunks in/out around player with per-frame budgets for smooth 60 FPS */
  public updateStreaming(playerX: number, playerZ: number): void {
    const pCx = World.worldToChunkCoord(playerX);
    const pCz = World.worldToChunkCoord(playerZ);
    const r = this.renderDistance;
    const unloadDistSq = (r + 2) * (r + 2);

    // Unload distant chunks
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - pCx;
      const dz = chunk.cz - pCz;
      if (dx * dx + dz * dz > unloadDistSq) {
        chunk.disposeMeshes(this.scene);
        this.chunks.delete(key);
      }
    }

    // Gather desired chunk coords sorted nearest-first
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

    // Generate up to 2 new chunk data arrays per frame
    let genBudget = 2;
    for (const item of desired) {
      if (genBudget <= 0) break;
      if (!this.chunks.has(Chunk.key(item.cx, item.cz))) {
        this.ensureChunkData(item.cx, item.cz);
        genBudget--;
      }
    }

    // Mesh up to 2 dirty chunks per frame
    let meshBudget = 2;
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
    // Search near (8, 8) outward for dry land above sea level
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

  private ensureChunkData(cx: number, cz: number): Chunk {
    const key = Chunk.key(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.terrainGen.populateChunk(chunk);
      this.chunks.set(key, chunk);

      // Neighboring chunks now have accurate border culling data
      this.markChunkDirty(cx - 1, cz);
      this.markChunkDirty(cx + 1, cz);
      this.markChunkDirty(cx, cz - 1);
      this.markChunkDirty(cx, cz + 1);
    }
    return chunk;
  }

  private markChunkDirty(cx: number, cz: number): void {
    const neighbor = this.chunks.get(Chunk.key(cx, cz));
    if (neighbor) {
      neighbor.dirty = true;
    }
  }

  private rebuildNeighborIfDirty(cx: number, cz: number): void {
    const neighbor = this.chunks.get(Chunk.key(cx, cz));
    if (neighbor && neighbor.dirty) {
      this.rebuildChunkMesh(neighbor);
    }
  }

  private rebuildChunkMesh(chunk: Chunk): void {
    chunk.disposeMeshes(this.scene);

    const { opaque, water } = buildChunkGeometries(
      chunk,
      (wx, wy, wz) => this.getBlock(wx, wy, wz),
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
