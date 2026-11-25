import * as THREE from 'three';
import { ItemId } from '../items/Item';
import { BlockId, TileIndex } from '../world/Block';
import {
  ATLAS_PIXEL_HEIGHT,
  ATLAS_PIXEL_WIDTH,
  getSubTileUVs,
  getTileUVs,
  UVBounds,
} from './textures/AtlasLayout';
import { BlockIconRenderer } from './textures/BlockIconRenderer';
import { BlockTextureGenerator } from './textures/BlockTextureGenerator';
import { ItemSpriteGenerator } from './textures/ItemSpriteGenerator';
import { createCanvas2D } from './textures/PixelArt';

export {
  TILE_SIZE,
  ATLAS_COLS,
  ATLAS_ROWS,
  ATLAS_PIXEL_WIDTH,
  ATLAS_PIXEL_HEIGHT,
} from './textures/AtlasLayout';

/**
 * Public texture facade used by world rendering, held items, dropped items, and UI.
 * Procedural painting, icon composition, pixel utilities, and atlas layout live in
 * focused collaborators under `rendering/textures`.
 */
export class TextureAtlas {
  public readonly canvas: HTMLCanvasElement;
  public readonly texture: THREE.CanvasTexture;

  private readonly itemSprites = new ItemSpriteGenerator();
  private readonly icons: BlockIconRenderer;

  constructor() {
    const atlas = createCanvas2D(
      ATLAS_PIXEL_WIDTH,
      ATLAS_PIXEL_HEIGHT,
      'texture atlas'
    );
    this.canvas = atlas.canvas;

    const blockTextures = new BlockTextureGenerator(atlas.context);
    blockTextures.generateAllTiles();
    blockTextures.validateCompleteness();

    this.icons = new BlockIconRenderer(
      (tile) => blockTextures.tileCanvases.get(tile),
      this.itemSprites
    );

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  public getTileUVs(tile: TileIndex): UVBounds {
    return getTileUVs(tile);
  }

  public getSubTileUVs(
    tile: TileIndex,
    px0: number,
    py0: number,
    px1: number,
    py1: number
  ): UVBounds {
    return getSubTileUVs(tile, px0, py0, px1, py1);
  }

  public createBlockIcon(blockId: BlockId): HTMLCanvasElement {
    return this.icons.createBlockIcon(blockId);
  }

  public getItemIconDataUrl(itemId: ItemId): string {
    return this.icons.getItemIconDataUrl(itemId);
  }

  public getOrCreateItemSprite16(itemId: ItemId): HTMLCanvasElement {
    return this.itemSprites.getOrCreateItemSprite16(itemId);
  }
}
