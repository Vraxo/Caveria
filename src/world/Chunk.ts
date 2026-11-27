import type * as THREE from 'three';
import { BlockId } from '../content/BlockId';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;
export const SEA_LEVEL = 44;

const CHUNK_KEY_OFFSET = 0x800000;
const CHUNK_KEY_STRIDE = 0x1000000;

export class Chunk {
  public readonly cx: number;
  public readonly cz: number;
  public readonly data: Uint8Array;
  /**
   * Packed light buffer per voxel:
   * - high nibble `(val >> 4) & 0xF` = skylight (0..15)
   * - low nibble  `val & 0xF`        = block light (0..15)
   */
  public readonly light: Uint8Array;

  public dirty = true;
  public lightDirty = true;
  /** Highest Y layer known to contain a non-air voxel (`-1` if unknown/empty). */
  public maxNonAirY = -1;
  public opaqueMesh: THREE.Mesh | null = null;
  public waterMesh: THREE.Mesh | null = null;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    const total = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE;
    this.data = new Uint8Array(total);
    this.light = new Uint8Array(total);
  }

  public static key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  /** Allocation-free exact integer key for Map<number, Chunk> lookups (±8.3M chunks). */
  public static numKey(cx: number, cz: number): number {
    return (cx + CHUNK_KEY_OFFSET) * CHUNK_KEY_STRIDE + (cz + CHUNK_KEY_OFFSET);
  }

  public index(lx: number, y: number, lz: number): number {
    return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
  }

  /** Scans top-down to find the highest non-air Y layer so lighting/meshing skip empty sky. */
  public recomputeMaxNonAirY(): number {
    const data = this.data;
    const layerSize = CHUNK_SIZE * CHUNK_SIZE;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const start = y * layerSize;
      const end = start + layerSize;
      for (let i = start; i < end; i++) {
        if (data[i] !== 0) {
          this.maxNonAirY = y;
          return y;
        }
      }
    }
    this.maxNonAirY = -1;
    return -1;
  }

  public get(lx: number, y: number, lz: number): BlockId {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) {
      return BlockId.Air;
    }
    return this.data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] as BlockId;
  }

  public set(lx: number, y: number, lz: number, id: BlockId): void {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) {
      return;
    }
    this.data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] = id;
    if (id !== BlockId.Air && y > this.maxNonAirY) {
      this.maxNonAirY = y;
    }
    this.dirty = true;
  }

  public getSkyLight(lx: number, y: number, lz: number): number {
    if (y >= CHUNK_HEIGHT) return 15;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0) return 0;
    return (this.light[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] >> 4) & 0xf;
  }

  public setSkyLight(lx: number, y: number, lz: number, level: number): void {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
    const idx = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
    this.light[idx] = ((level & 0xf) << 4) | (this.light[idx] & 0xf);
  }

  public getBlockLight(lx: number, y: number, lz: number): number {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return 0;
    return this.light[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] & 0xf;
  }

  public setBlockLight(lx: number, y: number, lz: number, level: number): void {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
    const idx = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
    this.light[idx] = (this.light[idx] & 0xf0) | (level & 0xf);
  }

  public disposeMeshes(scene: THREE.Scene): void {
    if (this.opaqueMesh) {
      scene.remove(this.opaqueMesh);
      this.opaqueMesh.geometry.dispose();
      this.opaqueMesh = null;
    }
    if (this.waterMesh) {
      scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
  }
}
