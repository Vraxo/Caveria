import { describe, expect, it } from 'vitest';
import { BlockId } from '../../src/content/BlockId';
import { BLOCKS } from '../../src/content/BlockRegistry';
import { Chunk } from '../../src/world/Chunk';
import { initializeChunkLighting, updateLightingAtEdit } from '../../src/world/Lighting';

function litChunk(): { chunk: Chunk; lookup: (cx: number, cz: number) => Chunk | undefined } {
  const chunk = new Chunk(0, 0);
  const lookup = (cx: number, cz: number) => cx === 0 && cz === 0 ? chunk : undefined;
  initializeChunkLighting(chunk, lookup, () => {});
  return { chunk, lookup };
}

describe('lighting edits', () => {
  it('uses the incremental path when breaking an opaque block', () => {
    const { chunk, lookup } = litChunk();
    chunk.set(8, 10, 8, BlockId.Stone);
    initializeChunkLighting(chunk, lookup, () => {});
    expect(chunk.getSkyLight(8, 9, 8)).toBeLessThan(15);

    chunk.set(8, 10, 8, BlockId.Air);
    const dirty = updateLightingAtEdit(
      8, 10, 8, BlockId.Stone, BlockId.Air, lookup
    );

    expect(chunk.getSkyLight(8, 9, 8)).toBe(15);
    expect([...dirty]).toEqual(['0,0']);
  });

  it('adds and removes local block light correctly', () => {
    const { chunk, lookup } = litChunk();
    chunk.set(8, 10, 8, BlockId.Torch);
    updateLightingAtEdit(8, 10, 8, BlockId.Air, BlockId.Torch, lookup);
    expect(chunk.getBlockLight(9, 10, 8)).toBe(BLOCKS[BlockId.Torch].lightEmission - 1);

    chunk.set(8, 10, 8, BlockId.Air);
    updateLightingAtEdit(8, 10, 8, BlockId.Torch, BlockId.Air, lookup);
    expect(chunk.getBlockLight(9, 10, 8)).toBe(0);
  });

  it('bleeds skylight and block light cleanly across adjacent chunk borders', () => {
    const left = new Chunk(-1, 0);
    const right = new Chunk(0, 0);
    // Roof over the entire right chunk at y=20 so right has 0 direct skylight underneath.
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        right.set(x, 20, z, BlockId.Stone);
      }
    }
    // Torch on the border of left chunk at (15, 10, 8).
    left.set(15, 10, 8, BlockId.Torch);

    const map = new Map<number, Chunk>([
      [Chunk.numKey(-1, 0), left],
      [Chunk.numKey(0, 0), right],
    ]);
    const lookup = (cx: number, cz: number) => map.get(Chunk.numKey(cx, cz));

    initializeChunkLighting(left, lookup, () => {});
    initializeChunkLighting(right, lookup, () => {});

    // Skylight from open sky at left(15, 15, 8) should bleed into right(0, 15, 8) as 14.
    expect(right.getSkyLight(0, 15, 8)).toBe(14);
    expect(right.getSkyLight(1, 15, 8)).toBe(13);
    // Block light from torch at left(15, 10, 8) should bleed into right(0, 10, 8).
    expect(right.getBlockLight(0, 10, 8)).toBe(BLOCKS[BlockId.Torch].lightEmission - 1);
  });
});
