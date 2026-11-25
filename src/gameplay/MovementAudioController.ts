import { AudioManager } from '../audio/AudioManager';
import { Player } from '../player/Player';
import { DayNightCycle } from '../rendering/DayNightCycle';
import { World } from '../world/World';

/** Routes player locomotion and environment transitions into procedural audio. */
export class MovementAudioController {
  private footstepDistance = 0;
  private wasInWater = false;

  constructor(
    private readonly audio: AudioManager,
    private readonly player: Player,
    private readonly world: World
  ) {}

  public updateMovement(dt: number, wasGrounded: boolean, impactVelocity: number): void {
    const inWater = this.player.isInWater(this.world);
    if (inWater && !this.wasInWater) this.audio.playSplash();
    this.wasInWater = inWater;

    if (wasGrounded && !this.player.onGround && this.player.velocity.y > 2) {
      this.audio.playJump();
      this.footstepDistance = 0;
    } else if (!wasGrounded && this.player.onGround) {
      this.audio.playLand(impactVelocity < -12);
      this.footstepDistance = 0;
    }

    const speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    if (this.player.onGround && !inWater && speed > 0.7) {
      this.footstepDistance += speed * dt;
      const sprinting = speed > 5.4;
      const stride = sprinting ? 1.75 : 1.45;
      if (this.footstepDistance >= stride) {
        this.footstepDistance %= stride;
        const below = this.world.getBlock(
          this.player.position.x,
          this.player.position.y - 0.08,
          this.player.position.z
        );
        this.audio.playStep(below, sprinting);
      }
    } else if (speed < 0.3) {
      this.footstepDistance = 0;
    }
  }

  public updateAmbience(
    dt: number,
    dayNight: DayNightCycle,
    weather: { precipitation: number; storm: boolean; exposedToSky: boolean }
  ): void {
    const surfaceY = this.world.terrainGen.getSurfaceHeight(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z)
    );
    this.audio.updateAmbient(dt, {
      underground: this.player.position.y < surfaceY - 5,
      underwater: this.player.isHeadUnderwater(this.world),
      skyBrightness: dayNight.skyBrightness,
      precipitation: weather.precipitation,
      storm: weather.storm,
      exposedToSky: weather.exposedToSky,
    });
  }
}
