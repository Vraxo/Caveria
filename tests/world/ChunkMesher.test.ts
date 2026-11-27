import { describe, expect, it } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { Chunk } from '../../src/world/Chunk';
import { buildChunkMeshData } from '../../src/world/ChunkMesher';
import { initializeChunkLighting } from '../../src/world/Lighting';

const stubAtlas = {
  getTileUVs: (): [number, number, number, number] => [0, 0, 0.125, 0.125],
  getSubTileUVs: (): [number, number, number, number] => [0, 0, 0.125, 0.125],
};

describe('ChunkMesher fast 3x3 grid path', () => {
  it('produces identical mesh buffers to the fallback world-getter path', () => {
    const center = new Chunk(0, 0);
    const east = new Chunk(1, 0);
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        center.set(x, 40, z, BlockId.Grass);
        east.set(x, 40, z, BlockId.Grass);
      }
    }
    center.set(15, 41, 8, BlockId.Stone);
    east.set(0, 41, 8, BlockId.Stone);
    center.set(8, 41, 8, BlockId.Water);

    const chunks = new Map<number, Chunk>([
      [Chunk.numKey(0, 0), center],
      [Chunk.numKey(1, 0), east],
    ]);
    const getChunk = (cx: number, cz: number) => chunks.get(Chunk.numKey(cx, cz));
    initializeChunkLighting(center, getChunk, () => {});
    initializeChunkLighting(east, getChunk, () => {});

    const getBlock = (wx: number, wy: number, wz: number): BlockId => {
      const c = getChunk(wx >> 4, wz >> 4);
      return c ? c.get(wx & 15, wy, wz & 15) : BlockId.Air;
    };
    const getLight = (wx: number, wy: number, wz: number): number => {
      const c = getChunk(wx >> 4, wz >> 4);
      return c ? c.light[(wy * 16 + (wz & 15)) * 16 + (wx & 15)] : 0xf0;
    };

    const fastMesh = buildChunkMeshData(center, getBlock, getLight, stubAtlas, getChunk);
    const fallbackMesh = buildChunkMeshData(center, getBlock, getLight, stubAtlas);

    expect(fastMesh.opaque).not.toBeNull();
    expect(fastMesh.water).not.toBeNull();
    expect(Array.from(fastMesh.opaque!.positions)).toEqual(Array.from(fallbackMesh.opaque!.positions));
    expect(Array.from(fastMesh.opaque!.colors)).toEqual(Array.from(fallbackMesh.opaque!.colors));
    expect(Array.from(fastMesh.opaque!.indices)).toEqual(Array.from(fallbackMesh.opaque!.indices));
    expect(Array.from(fastMesh.water!.positions)).toEqual(Array.from(fallbackMesh.water!.positions));
    expect(Array.from(fastMesh.water!.indices)).toEqual(Array.from(fallbackMesh.water!.indices));
  });

  it('returns null meshes for completely empty chunks', () => {
    const empty = new Chunk(2, -3);
    const mesh = buildChunkMeshData(empty, () => BlockId.Air, () => 0xf0, stubAtlas, () => undefined);
    expect(mesh.opaque).toBeNull();
    expect(mesh.water).toBeNull();
  });
});
