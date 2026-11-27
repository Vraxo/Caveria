import { TileIndex } from '../../content/TileIndex';
import { mulberry32 } from '../../world/Noise';
import { ATLAS_COLS, TILE_SIZE } from './AtlasLayout';
import { createCanvas2D, RGBA, TilePainter } from './PixelArt';
import { paintStructureTextures } from './StructureTexturePainters';
import { paintSurfaceTextures } from './SurfaceTexturePainters';
import { paintUndergroundTextures } from './UndergroundTexturePainters';

/** Coordinates the domain painter catalogs and assembles their canvases into the atlas. */
export class BlockTextureGenerator {
  public readonly tileCanvases = new Map<TileIndex, HTMLCanvasElement>();

  constructor(
    private readonly context: CanvasRenderingContext2D,
    /** Tile canvases loaded from a texture pack folder; used instead of painting. */
    private loadedTiles?: ReadonlyMap<TileIndex, HTMLCanvasElement>
  ) {}

  public generateAllTiles(): void {
    const draw = (tile: TileIndex, painter: TilePainter): void => this.drawTile(tile, painter);
    paintSurfaceTextures(draw);
    paintStructureTextures(draw);
    paintUndergroundTextures(draw);
  }

  /** Rebuilds the entire atlas with a new set of loaded tile overrides. */
  public reload(loadedTiles?: ReadonlyMap<TileIndex, HTMLCanvasElement>): void {
    this.loadedTiles = loadedTiles;
    this.tileCanvases.clear();
    this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.generateAllTiles();
    this.validateCompleteness();
  }

  public validateCompleteness(): void {
    const tileIndices = Object.values(TileIndex).filter(
      (value): value is TileIndex => typeof value === 'number'
    );
    const missing = tileIndices.filter((tile) => !this.tileCanvases.has(tile));
    if (missing.length > 0) {
      throw new Error(`Texture atlas is missing painters for TileIndex values: ${missing.join(', ')}`);
    }
  }

  private drawTile(tile: TileIndex, painter: TilePainter): void {
    if (this.tileCanvases.has(tile)) {
      throw new Error(`Texture atlas has more than one painter for TileIndex ${tile}`);
    }

    const loadedTile = this.loadedTiles?.get(tile);
    if (loadedTile) {
      this.tileCanvases.set(tile, loadedTile);
      const column = tile % ATLAS_COLS;
      const row = Math.floor(tile / ATLAS_COLS);
      this.context.drawImage(loadedTile, column * TILE_SIZE, row * TILE_SIZE);
      return;
    }

    const { canvas: tileCanvas, context } = createCanvas2D(
      TILE_SIZE,
      TILE_SIZE,
      `atlas tile ${tile}`
    );
    const image = context.createImageData(TILE_SIZE, TILE_SIZE);
    const data = image.data;
    const setPixel = (x: number, y: number, color: RGBA): void => {
      if (x < 0 || x >= TILE_SIZE || y < 0 || y >= TILE_SIZE) return;
      const index = (y * TILE_SIZE + x) * 4;
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = color[3];
    };

    painter(setPixel, mulberry32(1000 + tile * 977));
    context.putImageData(image, 0, 0);
    this.tileCanvases.set(tile, tileCanvas);

    const column = tile % ATLAS_COLS;
    const row = Math.floor(tile / ATLAS_COLS);
    this.context.drawImage(tileCanvas, column * TILE_SIZE, row * TILE_SIZE);
  }
}
