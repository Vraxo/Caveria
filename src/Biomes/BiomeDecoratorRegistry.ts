import { BlockId } from '../content/BlockId';
import type { Chunk } from '../world/Chunk';
import type { CavernBiome, SurfaceBiome } from './BiomeTypes';

export interface CavernDecorationContext {
  chunk: Chunk;
  lx: number;
  y: number;
  lz: number;
  wx: number;
  wz: number;
  current: BlockId;
  below: BlockId;
  above: BlockId;
  random: number;
  coordinateRandom(x: number, z: number, salt: number): number;
  crystalNoiseAt(wx: number, y: number, wz: number): number;
}

export interface SurfaceDecorationContext {
  chunk: Chunk;
  lx: number;
  lz: number;
  wx: number;
  wz: number;
  surfaceY: number;
  topBlock: BlockId;
  random: number;
  coordinateRandom(x: number, z: number, salt: number): number;
}

export type CavernBiomeDecorator = (context: CavernDecorationContext) => void;
export type SurfaceBiomeDecorator = (context: SurfaceDecorationContext) => void;

/** Dispatches world-decoration policy by biome while TerrainGen owns only generation passes. */
export class BiomeDecoratorRegistry {
  private readonly cavern = new Map<CavernBiome, CavernBiomeDecorator>();
  private readonly surface = new Map<SurfaceBiome, SurfaceBiomeDecorator>();

  public registerCavern(biome: CavernBiome, decorator: CavernBiomeDecorator): this {
    if (this.cavern.has(biome)) throw new Error(`Duplicate cavern biome decorator: ${biome}`);
    this.cavern.set(biome, decorator);
    return this;
  }

  public registerSurface(biome: SurfaceBiome, decorator: SurfaceBiomeDecorator): this {
    if (this.surface.has(biome)) throw new Error(`Duplicate surface biome decorator: ${biome}`);
    this.surface.set(biome, decorator);
    return this;
  }

  public hasCavern(biome: CavernBiome): boolean {
    return this.cavern.has(biome);
  }

  public hasSurface(biome: SurfaceBiome): boolean {
    return this.surface.has(biome);
  }

  public decorateCavern(biome: CavernBiome, context: CavernDecorationContext): void {
    const decorator = this.cavern.get(biome);
    if (!decorator) throw new Error(`Missing cavern biome decorator: ${biome}`);
    decorator(context);
  }

  public decorateSurface(biome: SurfaceBiome, context: SurfaceDecorationContext): void {
    const decorator = this.surface.get(biome);
    if (!decorator) throw new Error(`Missing surface biome decorator: ${biome}`);
    decorator(context);
  }
}
