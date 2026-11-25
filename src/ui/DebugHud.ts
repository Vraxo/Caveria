import { Player } from '../player/Player';
import { VoxelHit } from '../player/Raycaster';
import { DayNightCycle } from '../rendering/DayNightCycle';
import { BLOCKS } from '../world/Block';
import { World } from '../world/World';

export class DebugHud {
  private readonly el: HTMLElement;
  private visible = true;
  private frames = 0;
  private accumTime = 0;
  private fps = 60;

  constructor() {
    this.el = document.getElementById('debug-hud')!;
  }

  public toggle(): void {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
  }

  public update(
    dt: number,
    player: Player,
    world: World,
    dayNight: DayNightCycle,
    hit: VoxelHit | null,
    seedLabel: string
  ): void {
    this.frames++;
    this.accumTime += dt;
    if (this.accumTime >= 0.25) {
      this.fps = Math.round(this.frames / this.accumTime);
      this.frames = 0;
      this.accumTime = 0;
    }

    if (!this.visible) return;

    const px = player.position.x.toFixed(1);
    const py = player.position.y.toFixed(1);
    const pz = player.position.z.toFixed(1);

    const cx = World.worldToChunkCoord(player.position.x);
    const cz = World.worldToChunkCoord(player.position.z);

    const packedAtEye = world.getPackedLight(
      player.position.x,
      player.position.y + 1.0,
      player.position.z
    );
    const skyLight = (packedAtEye >> 4) & 0xf;
    const blockLight = packedAtEye & 0xf;

    const targetStr = hit
      ? `${BLOCKS[hit.blockId].name} (${hit.blockX}, ${hit.blockY}, ${hit.blockZ})`
      : 'None';

    this.el.textContent = [
      `Caveria 0.2.0 (${this.fps} FPS)`,
      `XYZ: ${px} / ${py} / ${pz}`,
      `Chunk: ${cx}, ${cz} (${world.loadedChunkCount} loaded)`,
      `Time: ${dayNight.getFormattedClock()} | Light: Sky ${skyLight} / Block ${blockLight}`,
      `Mode: ${player.flyMode ? 'Fly' : 'Walk'} | Grounded: ${player.onGround ? 'Yes' : 'No'}`,
      `Target: ${targetStr}`,
      `Seed: ${seedLabel}`,
    ].join('\n');
  }
}
