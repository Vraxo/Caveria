import { BlockId } from '../content/BlockId';
import { AmbientSoundscape, AmbientState } from './AmbientSoundscape';
import { BlockSoundEffects } from './BlockSoundEffects';
import { CreatureSoundEffects } from './CreatureSoundEffects';
import { MovementSoundEffects } from './MovementSoundEffects';
import { SynthPrimitives } from './SynthPrimitives';
import { UiSoundEffects } from './UiSoundEffects';
import { WebAudioEngine } from './WebAudioEngine';

/** Public procedural-audio facade used by gameplay and UI controllers. */
export class AudioManager {
  private readonly engine = new WebAudioEngine();
  private readonly synth = new SynthPrimitives(this.engine);
  private readonly blocks = new BlockSoundEffects(this.engine, this.synth);
  private readonly movement = new MovementSoundEffects(this.engine, this.synth);
  private readonly creatures = new CreatureSoundEffects(this.synth);
  private readonly ui = new UiSoundEffects(this.synth);
  private readonly ambience = new AmbientSoundscape(this.engine, this.synth);

  public get muted(): boolean { return this.engine.muted; }

  public unlock(): void {
    this.engine.unlock();
    this.ambience.start();
  }
  public setMuted(muted: boolean): void { this.engine.setMuted(muted); }
  public toggleMute(): boolean { return this.engine.toggleMute(); }
  public dispose(): void { this.ambience.dispose(); this.engine.dispose(); }

  public playMineHit(block: BlockId): void { this.blocks.playMineHit(block); }
  public playBreak(block: BlockId): void { this.blocks.playBreak(block); }
  public playPlace(block: BlockId): void { this.blocks.playPlace(block); }
  public playStep(block: BlockId, sprinting: boolean): void { this.movement.playStep(block, sprinting); }
  public playJump(): void { this.movement.playJump(); }
  public playLand(hard: boolean): void { this.movement.playLand(hard); }
  public playSplash(): void { this.movement.playSplash(); }
  public playCrystalMiteChirp(): void { this.creatures.playCrystalMiteChirp(); }
  public playCrystalMiteHit(): void { this.creatures.playCrystalMiteHit(); }
  public playCrystalMiteDeath(): void { this.creatures.playCrystalMiteDeath(); }
  public playCaveCrawlerGrowl(): void { this.creatures.playCaveCrawlerGrowl(); }
  public playCaveCrawlerHit(): void { this.creatures.playCaveCrawlerHit(); }
  public playCaveCrawlerDeath(): void { this.creatures.playCaveCrawlerDeath(); }

  public playPickup(): void { this.ui.playPickup(); }
  public playCrystalPickup(): void { this.ui.playCrystalPickup(); }
  public playUiClick(): void { this.ui.playUiClick(); }
  public playHotbarSelect(): void { this.ui.playHotbarSelect(); }
  public playInventoryOpen(): void { this.ui.playInventoryOpen(); }
  public playInventoryClose(): void { this.ui.playInventoryClose(); }
  public playCraft(): void { this.ui.playCraft(); }
  public playToss(): void { this.ui.playToss(); }
  public playEat(): void { this.ui.playEat(); }
  public playArmorEquip(): void { this.ui.playArmorEquip(); }
  public playFurnaceIgnite(): void { this.ui.playFurnaceIgnite(); }
  public playFurnaceBurn(): void { this.ui.playFurnaceBurn(); }
  public playFurnaceComplete(): void { this.ui.playFurnaceComplete(); }
  public playSleep(): void { this.ui.playSleep(); }
  public playChestOpen(): void { this.ui.playChestOpen(); }
  public playChestClose(): void { this.ui.playChestClose(); }
  public playBowDraw(): void { this.ui.playBowDraw(); }
  public playBowRelease(): void { this.ui.playBowRelease(); }
  public playArrowImpact(): void { this.ui.playArrowImpact(); }
  public playArrowHit(): void { this.ui.playArrowHit(); }
  public playToolBreak(): void { this.ui.playToolBreak(); }
  public playModeToggle(): void { this.ui.playModeToggle(); }
  public playThunder(intensity: number): void { this.ambience.playThunder(intensity); }

  public updateAmbient(dt: number, state: AmbientState): void {
    this.ambience.update(dt, state);
  }
}
