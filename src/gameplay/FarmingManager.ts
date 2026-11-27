import { AudioManager } from '../audio/AudioManager';
import { BlockId } from '../content/BlockId';
import {
  type CropDefinition,
  type CropId,
  getCropDefinition,
  getCropForSeed,
} from '../content/crops/CropDefinitions';
import { ItemId, ItemStack, createStack } from '../items/Item';
import { Player } from '../player/Player';
import { WeatherSystem } from '../rendering/WeatherSystem';
import { World } from '../world/World';

export type FarmCrop = CropId;
export type FarmUseResult = 'none' | 'tilled' | 'planted' | 'harvested';

export interface FarmPlotSnapshot {
  x: number;
  y: number;
  z: number;
  crop: FarmCrop | null;
  stage: number;
  growthRemaining: number;
  drySeconds: number;
}

/** Persistent hydration, crop growth, harvesting, drying, and trampling simulation. */
export class FarmingManager {
  private readonly plots = new Map<string, FarmPlotSnapshot>();
  private tickElapsed = 0;

  constructor(
    private readonly world: World,
    private readonly player: Player,
    private readonly weather: WeatherSystem,
    private readonly audio: AudioManager,
    snapshots: FarmPlotSnapshot[] | undefined,
    private readonly dropItem: (x: number, y: number, z: number, stack: ItemStack) => void,
    private readonly random: () => number = Math.random
  ) {
    for (const saved of snapshots ?? []) {
      const definition = getCropDefinition(saved.crop);
      const plot: FarmPlotSnapshot = {
        ...saved,
        crop: definition?.id ?? null,
        stage: definition
          ? Math.max(0, Math.min(definition.stageBlocks.length - 1, Math.floor(saved.stage)))
          : 0,
      };
      this.plots.set(this.key(plot.x, plot.y, plot.z), plot);
    }
  }

  public update(dt: number): void {
    if (this.player.velocity.y < -3.5) {
      const x = Math.floor(this.player.position.x);
      const z = Math.floor(this.player.position.z);
      const y = Math.floor(this.player.position.y) - 1;
      const plot = this.plots.get(this.key(x, y, z));
      if (plot && this.isTrampled(plot)) this.removePlot(plot, true);
    }

    this.tickElapsed += dt;
    if (this.tickElapsed < 1) return;
    const elapsed = this.tickElapsed;
    this.tickElapsed = 0;

    for (const [key, plot] of this.plots) {
      if (!this.world.isPositionLoaded(plot.x, plot.z)) continue;
      const farmland = this.world.getBlock(plot.x, plot.y, plot.z);
      if (farmland !== BlockId.FarmlandDry && farmland !== BlockId.FarmlandWet) {
        this.plots.delete(key);
        continue;
      }

      if (this.isTrampled(plot)) {
        this.removePlot(plot, true);
        continue;
      }

      const hydrated = this.hasNearbyWater(plot) || this.isRainedOn(plot);
      const desired = hydrated ? BlockId.FarmlandWet : BlockId.FarmlandDry;
      if (farmland !== desired) this.world.setBlock(plot.x, plot.y, plot.z, desired);
      plot.drySeconds = hydrated ? 0 : plot.drySeconds + elapsed;
      if (plot.drySeconds >= 120) {
        this.removePlot(plot, true);
        continue;
      }

      if (!plot.crop) continue;
      if (!this.cropBlockMatches(plot)) {
        plot.crop = null;
        plot.stage = 0;
        continue;
      }
      const crop = getCropDefinition(plot.crop);
      if (!crop) {
        plot.crop = null;
        plot.stage = 0;
        continue;
      }
      if (!hydrated || !this.hasGrowthLight(plot)
        || plot.stage >= crop.stageBlocks.length - 1) continue;
      plot.growthRemaining -= elapsed;
      if (plot.growthRemaining <= 0) {
        plot.stage++;
        plot.growthRemaining = this.nextGrowthTime(crop);
        this.syncCropBlock(plot);
        if (Math.hypot(this.player.position.x - plot.x, this.player.position.z - plot.z) < 12) {
          this.audio.playFarmGrowth();
        }
      }
    }
  }

  public use(x: number, y: number, z: number, held: ItemId | null): FarmUseResult {
    const block = this.world.getBlock(x, y, z);
    if (held === ItemId.WoodenHoe && (block === BlockId.Dirt || block === BlockId.Grass)) {
      if (this.world.getBlock(x, y + 1, z) !== BlockId.Air) return 'none';
      const plot: FarmPlotSnapshot = {
        x: Math.floor(x), y: Math.floor(y), z: Math.floor(z), crop: null,
        stage: 0, growthRemaining: 0, drySeconds: 0,
      };
      this.plots.set(this.key(x, y, z), plot);
      this.world.setBlock(x, y, z, this.hasNearbyWater(plot) || this.isRainedOn(plot)
        ? BlockId.FarmlandWet : BlockId.FarmlandDry);
      return 'tilled';
    }

    const harvestedPlot = this.plots.get(this.key(x, y - 1, z));
    const harvestedCrop = getCropDefinition(harvestedPlot?.crop);
    if (harvestedPlot && harvestedCrop
      && harvestedPlot.stage >= harvestedCrop.stageBlocks.length - 1
      && block === harvestedCrop.stageBlocks.at(-1)) {
      const { minimum, maximum, item } = harvestedCrop.harvest;
      const count = minimum + Math.floor(this.random() * (maximum - minimum + 1));
      this.dropItem(x + 0.5, y + 0.35, z + 0.5, createStack(item, count));
      harvestedPlot.stage = 0;
      harvestedPlot.growthRemaining = this.nextGrowthTime(harvestedCrop);
      this.syncCropBlock(harvestedPlot);
      return 'harvested';
    }

    if (block !== BlockId.FarmlandDry && block !== BlockId.FarmlandWet) return 'none';
    if (this.world.getBlock(x, y + 1, z) !== BlockId.Air) return 'none';
    const crop = getCropForSeed(held);
    if (!crop) return 'none';
    const plot = this.ensurePlot(x, y, z);
    plot.crop = crop.id;
    plot.stage = 0;
    plot.growthRemaining = this.nextGrowthTime(crop);
    this.syncCropBlock(plot);
    return 'planted';
  }

  public breakAt(x: number, y: number, z: number, drop: boolean): boolean {
    const block = this.world.getBlock(x, y, z);
    const farmlandY = block === BlockId.FarmlandDry || block === BlockId.FarmlandWet ? y : y - 1;
    const key = this.key(x, farmlandY, z);
    const plot = this.plots.get(key);
    if (!plot) return false;
    const crop = getCropDefinition(plot.crop);
    if (drop && crop) {
      this.dropItem(
        x + 0.5,
        farmlandY + 1.3,
        z + 0.5,
        createStack(crop.brokenDrop.item, crop.brokenDrop.count)
      );
    }
    if ((block === BlockId.FarmlandDry || block === BlockId.FarmlandWet) && plot.crop && this.cropBlockMatches(plot)) {
      this.world.setBlock(x, farmlandY + 1, z, BlockId.Air);
    }
    this.plots.delete(key);
    return true;
  }

  public snapshots(): FarmPlotSnapshot[] {
    return [...this.plots.values()].map((plot) => ({ ...plot }));
  }

  private ensurePlot(x: number, y: number, z: number): FarmPlotSnapshot {
    const key = this.key(x, y, z);
    let plot = this.plots.get(key);
    if (!plot) {
      plot = { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z), crop: null, stage: 0, growthRemaining: 0, drySeconds: 0 };
      this.plots.set(key, plot);
    }
    return plot;
  }

  private hasNearbyWater(plot: Pick<FarmPlotSnapshot, 'x' | 'y' | 'z'>): boolean {
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      if (Math.abs(dx) + Math.abs(dz) > 4) continue;
      if (this.world.getBlock(plot.x + dx, plot.y, plot.z + dz) === BlockId.Water ||
          this.world.getBlock(plot.x + dx, plot.y + 1, plot.z + dz) === BlockId.Water) return true;
    }
    return false;
  }

  private isRainedOn(plot: Pick<FarmPlotSnapshot, 'x' | 'y' | 'z'>): boolean {
    if (this.weather.intensity < 0.12) return false;
    return ((this.world.getPackedLight(plot.x, plot.y + 1, plot.z) >> 4) & 0xf) >= 14;
  }

  private hasGrowthLight(plot: FarmPlotSnapshot): boolean {
    const packed = this.world.getPackedLight(plot.x, plot.y + 1, plot.z);
    return Math.max((packed >> 4) & 0xf, packed & 0xf) >= 7;
  }

  private isTrampled(plot: FarmPlotSnapshot): boolean {
    return Math.floor(this.player.position.x) === plot.x &&
      Math.floor(this.player.position.z) === plot.z &&
      this.player.position.y >= plot.y + 0.72 && this.player.position.y <= plot.y + 1.5 &&
      this.player.velocity.y < -3.5;
  }

  private cropBlockMatches(plot: FarmPlotSnapshot): boolean {
    return this.world.getBlock(plot.x, plot.y + 1, plot.z) === this.blockFor(plot);
  }

  private syncCropBlock(plot: FarmPlotSnapshot): void {
    this.world.setBlock(plot.x, plot.y + 1, plot.z, this.blockFor(plot));
  }

  private blockFor(plot: FarmPlotSnapshot): BlockId {
    const crop = this.requireCrop(plot.crop);
    const stage = Math.max(0, Math.min(crop.stageBlocks.length - 1, plot.stage));
    return crop.stageBlocks[stage];
  }

  private nextGrowthTime(crop: CropDefinition): number {
    return crop.growth.minimumSeconds + this.random() * crop.growth.varianceSeconds;
  }

  private requireCrop(id: CropId | null): CropDefinition {
    const crop = getCropDefinition(id);
    if (!crop) throw new Error(`Unknown farm crop: ${String(id)}`);
    return crop;
  }

  private removePlot(plot: FarmPlotSnapshot, dropCrop: boolean): void {
    const crop = getCropDefinition(plot.crop);
    if (dropCrop && crop) {
      this.dropItem(
        plot.x + 0.5,
        plot.y + 1.25,
        plot.z + 0.5,
        createStack(crop.brokenDrop.item, crop.brokenDrop.count)
      );
    }
    if (plot.crop && this.cropBlockMatches(plot)) {
      this.world.setBlock(plot.x, plot.y + 1, plot.z, BlockId.Air);
    }
    this.world.setBlock(plot.x, plot.y, plot.z, BlockId.Dirt);
    this.plots.delete(this.key(plot.x, plot.y, plot.z));
  }

  private key(x: number, y: number, z: number): string {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }
}
