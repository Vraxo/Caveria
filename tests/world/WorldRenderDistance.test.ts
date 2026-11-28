import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TextureAtlas } from '../../src/rendering/TextureAtlas';
import { World } from '../../src/world/World';

describe('World render distance', () => {
  it('updates the active streaming radius and ignores invalid values', () => {
    const atlas = { texture: new THREE.Texture() } as unknown as TextureAtlas;
    const world = new World(new THREE.Scene(), atlas, 123, 8);

    expect(world.renderDistance).toBe(8);

    world.setRenderDistance(12.9);
    expect(world.renderDistance).toBe(12);

    world.setRenderDistance(Number.NaN);
    expect(world.renderDistance).toBe(12);

    world.setRenderDistance(0);
    expect(world.renderDistance).toBe(1);
  });
});
