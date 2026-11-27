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
});
