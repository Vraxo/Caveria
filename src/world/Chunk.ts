import * as THREE from 'three';
import { BlockId } from './Block';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;
export const SEA_LEVEL = 44;

export class Chunk {
  public readonly cx: number;
  public readonly cz: number;
  public readonly data: Uint8Array;

  public dirty = true;
  public opaqueMesh: THREE.Mesh | null = null;
  public waterMesh: THREE.Mesh | null = null;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  public static key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public index(lx: number, y: number, lz: number): number {
    return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
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
    this.dirty = true;
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
