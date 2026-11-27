import { describe, expect, it, vi } from 'vitest';
import { ITEMS } from '../../src/items/Item';
import { ItemId } from '../../src/items/ItemTypes';
import { createDefaultItemSpritePainterRegistry } from '../../src/rendering/textures/DefaultItemSpritePainters';
import { ItemSpritePainterRegistry } from '../../src/rendering/textures/ItemSpritePainterRegistry';

describe('ItemSpritePainterRegistry', () => {
  it('covers every non-block item with a non-empty procedural painter', () => {
    const registry = createDefaultItemSpritePainterRegistry();
    const nonBlockItems = Object.values(ITEMS).filter((item) => item.placeBlockId === null);

    for (const item of nonBlockItems) {
      let paintedPixels = 0;
      registry.paint(item.id, () => { paintedPixels++; });
      expect(registry.has(item.id), item.name).toBe(true);
      expect(paintedPixels, item.name).toBeGreaterThan(0);
    }
  });

  it('supports grouped registration and passes the concrete item identity to shared painters', () => {
    const painter = vi.fn();
    const registry = new ItemSpritePainterRegistry().register(
      [ItemId.Stick, ItemId.Coal],
      painter
    );
    const pixel = vi.fn();

    registry.paint(ItemId.Coal, pixel);

    expect(painter).toHaveBeenCalledWith(pixel, ItemId.Coal);
  });

  it('rejects duplicate registrations and missing painters', () => {
    const registry = new ItemSpritePainterRegistry().register(ItemId.Stick, () => {});

    expect(() => registry.register(ItemId.Stick, () => {}))
      .toThrow('Duplicate item sprite painter');
    expect(() => registry.paint(ItemId.Coal, () => {}))
      .toThrow('Missing item sprite painter');
  });
});
