import type * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { Input } from '../core/Input';
import { CrystalMiteHit, CrystalMiteManager } from '../entities/CrystalMiteManager';
import { Inventory } from '../items/Inventory';
import { ITEMS, ItemStack, createStack, getBlockDrop, getMiningStats } from '../items/Item';
import { Player } from '../player/Player';
import { VoxelHit, raycastVoxel } from '../player/Raycaster';
import { BreakParticles } from '../rendering/BreakParticles';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { HeldItemView } from '../rendering/HeldItemView';
import { BlockHighlight } from '../rendering/Highlight';
import { MiningOverlay } from '../rendering/MiningOverlay';
import { Hotbar } from '../ui/Hotbar';
import { BlockId } from '../content/BlockId';
import { BLOCKS } from '../content/BlockRegistry';
import { CHUNK_HEIGHT } from '../world/Chunk';
import { World } from '../world/World';

interface BlockInteractionDependencies {
  scene: THREE.Scene;
  world: World;
  player: Player;
  input: Input;
  inventory: Inventory;
  hotbar: Hotbar;
  particles: BreakParticles;
  drops: DroppedItemManager;
  heldItemView: HeldItemView;
  audio: AudioManager;
  mobs: CrystalMiteManager;
  onOpenWorkbench: () => void;
}

/**
 * Owns the complete player-to-world interaction flow: targeting, progressive
 * mining, block placement, support cascades, pick-block, and item tossing.
 */
export class BlockInteractionController {
  private readonly world: World;
  private readonly player: Player;
  private readonly input: Input;
  private readonly inventory: Inventory;
  private readonly hotbar: Hotbar;
  private readonly particles: BreakParticles;
  private readonly drops: DroppedItemManager;
  private readonly heldItemView: HeldItemView;
  private readonly audio: AudioManager;
  private readonly mobs: CrystalMiteManager;
  private readonly onOpenWorkbench: () => void;
  private readonly highlight: BlockHighlight;
  private readonly miningOverlay: MiningOverlay;
  private readonly miningBarEl: HTMLElement;
  private readonly miningBarFillEl: HTMLElement;
  private readonly mobTargetEl: HTMLElement;

  private hit: VoxelHit | null = null;
  private mobTarget: CrystalMiteHit | null = null;
  private miningTargetKey = '';
  private miningElapsed = 0;
  private miningCooldown = 0;

  constructor(deps: BlockInteractionDependencies) {
    this.world = deps.world;
    this.player = deps.player;
    this.input = deps.input;
    this.inventory = deps.inventory;
    this.hotbar = deps.hotbar;
    this.particles = deps.particles;
    this.drops = deps.drops;
    this.heldItemView = deps.heldItemView;
    this.audio = deps.audio;
    this.mobs = deps.mobs;
    this.onOpenWorkbench = deps.onOpenWorkbench;
    this.highlight = new BlockHighlight(deps.scene);
    this.miningOverlay = new MiningOverlay(deps.scene);
    this.miningBarEl = document.getElementById('mining-bar')!;
    this.miningBarFillEl = document.getElementById('mining-bar-fill')!;
    this.mobTargetEl = document.getElementById('mob-target-label')!;
  }

  public get currentHit(): VoxelHit | null {
    return this.hit;
  }

  public get activelyMining(): boolean {
    return this.input.isMouseDown(0) && this.hit !== null && this.mobTarget === null;
  }

  public updateTarget(): void {
    const eye = this.player.getEyePosition();
    const direction = this.player.getForwardDirection();
    this.hit = raycastVoxel(this.world, eye, direction, 6.0);
    this.mobTarget = this.mobs.raycast(eye, direction, 4.5, this.hit?.distance ?? 6.0);
    this.highlight.update(this.mobTarget ? null : this.hit);
    this.mobTargetEl.classList.toggle('hidden', !this.mobTarget);
    if (this.mobTarget) {
      this.mobTargetEl.textContent =
        `Crystal Mite  ${'♥'.repeat(this.mobTarget.health)}${'♡'.repeat(this.mobTarget.maxHealth - this.mobTarget.health)}`;
    }
  }

  public update(dt: number, creativeMode: boolean): void {
    if (this.miningCooldown > 0) {
      this.miningCooldown = Math.max(0, this.miningCooldown - dt);
    }

    if (this.mobTarget) {
      this.cancelMining();
      if (this.input.consumeMousePress(0) && this.miningCooldown <= 0) {
        this.heldItemView.triggerSwing();
        if (this.mobs.damage(this.mobTarget.id, this.player.getForwardDirection())) {
          this.miningCooldown = 0.3;
        }
      }
      return;
    }

    this.updateMining(dt, creativeMode);

    if (this.input.consumeMousePress(1) && this.hit) {
      this.hotbar.pickBlock(this.hit.blockId, creativeMode);
    }

    if (this.input.consumeMousePress(2) && this.hit) {
      this.handleInteractionOrPlacement(creativeMode);
    }
  }

  public clearTarget(): void {
    this.cancelMining();
    this.hit = null;
    this.mobTarget = null;
    this.highlight.update(null);
    this.mobTargetEl.classList.add('hidden');
  }

  public cancelMining(): void {
    this.miningTargetKey = '';
    this.miningElapsed = 0;
    this.miningOverlay.update(null, 0);
    this.miningBarEl.classList.add('hidden');
  }

  public tossHeldSingleItem(): void {
    const current = this.hotbar.selectedStack;
    if (!current) return;
    const single: ItemStack = {
      id: current.id,
      count: 1,
      durability: current.durability,
    };
    this.inventory.consumeOne(this.hotbar.selectedIndex);
    this.tossStackFromPlayer(single);
    this.heldItemView.triggerSwing();
  }

  public tossStackFromPlayer(stack: ItemStack): void {
    this.audio.playToss();
    const eye = this.player.getEyePosition();
    const direction = this.player.getForwardDirection();
    const velocity = direction.clone().multiplyScalar(5.5);
    velocity.y += 1.6;
    this.drops.spawnDrop(
      eye.x + direction.x * 0.45,
      eye.y - 0.25,
      eye.z + direction.z * 0.45,
      stack,
      velocity,
      1.15
    );
  }

  private updateMining(dt: number, creativeMode: boolean): void {
    if (!this.input.isMouseDown(0)) {
      this.cancelMining();
      return;
    }

    if (this.input.consumeMousePress(0)) {
      this.heldItemView.triggerSwing();
      if (this.hit) this.audio.playMineHit(this.hit.blockId);
    }

    if (!this.hit || !BLOCKS[this.hit.blockId].breakable) {
      this.cancelMining();
      return;
    }

    if (creativeMode) {
      if (this.miningCooldown <= 0) {
        this.breakBlockAt(this.hit, false, true);
        this.miningCooldown = 0.16;
      }
      this.cancelMining();
      return;
    }

    if (this.miningCooldown > 0) return;

    const hitKey = `${this.hit.blockX},${this.hit.blockY},${this.hit.blockZ},${this.hit.blockId}`;
    if (hitKey !== this.miningTargetKey) {
      this.miningTargetKey = hitKey;
      this.miningElapsed = 0;
    }

    const { durationSeconds, canHarvest } = getMiningStats(
      this.hit.blockId,
      this.hotbar.selectedStack
    );
    this.miningElapsed += dt;
    this.audio.playMineHit(this.hit.blockId);
    const progress = Math.min(1, this.miningElapsed / durationSeconds);

    this.miningOverlay.update(this.hit, progress);
    this.miningBarEl.classList.remove('hidden');
    this.miningBarFillEl.style.width = `${Math.round(progress * 100)}%`;
    this.miningBarFillEl.classList.toggle('no-harvest', !canHarvest);

    if (progress < 1) return;

    this.breakBlockAt(this.hit, canHarvest, false);
    if (this.inventory.damageTool(this.hotbar.selectedIndex)) {
      this.audio.playToolBreak();
    }
    this.cancelMining();
    this.miningCooldown = 0.14;
  }

  private handleInteractionOrPlacement(creativeMode: boolean): void {
    if (!this.hit) return;
    const sneaking =
      this.input.isKeyDown('ShiftLeft') || this.input.isKeyDown('ShiftRight');

    if (this.hit.blockId === BlockId.CraftingTable && !sneaking) {
      this.onOpenWorkbench();
      return;
    }

    const held = this.hotbar.selectedStack;
    if (!held) return;
    const itemDefinition = ITEMS[held.id];
    if (itemDefinition.placeBlockId === null) return;

    const placeBlock = itemDefinition.placeBlockId;
    const placeDefinition = BLOCKS[placeBlock];
    const placeX = this.hit.blockX + this.hit.normalX;
    const placeY = this.hit.blockY + this.hit.normalY;
    const placeZ = this.hit.blockZ + this.hit.normalZ;
    if (placeY < 0 || placeY >= CHUNK_HEIGHT) return;

    const existing = this.world.getBlock(placeX, placeY, placeZ);
    if (placeDefinition.shape === 'torch' || placeDefinition.shape === 'cross') {
      const below = this.world.getBlock(placeX, placeY - 1, placeZ);
      const above = this.world.getBlock(placeX, placeY + 1, placeZ);
      const hasSupport =
        placeBlock === BlockId.CaveVine
          ? BLOCKS[above].solid || above === BlockId.CaveVine
          : placeBlock === BlockId.DripstoneSpike
            ? BLOCKS[below].solid || BLOCKS[above].solid
            : BLOCKS[below].solid;

      if (existing === BlockId.Air && hasSupport) {
        this.placeBlock(placeX, placeY, placeZ, placeBlock, creativeMode);
      }
      return;
    }

    if (
      (existing === BlockId.Air || existing === BlockId.Water) &&
      (!placeDefinition.solid || !this.player.intersectsBlock(placeX, placeY, placeZ))
    ) {
      this.placeBlock(placeX, placeY, placeZ, placeBlock, creativeMode);
    }
  }

  private placeBlock(
    x: number,
    y: number,
    z: number,
    block: BlockId,
    creativeMode: boolean
  ): void {
    this.world.setBlock(x, y, z, block);
    this.heldItemView.triggerPlace();
    this.audio.playPlace(block);
    if (!creativeMode) this.inventory.consumeOne(this.hotbar.selectedIndex);
    this.updateTarget();
  }

  private breakBlockAt(hit: VoxelHit, spawnDropItem: boolean, creativeMode: boolean): void {
    const { blockX, blockY, blockZ, blockId } = hit;
    this.world.setBlock(blockX, blockY, blockZ, BlockId.Air);
    this.particles.spawnBurst(blockX, blockY, blockZ, blockId);
    this.audio.playBreak(blockId);

    if (spawnDropItem) {
      const drop = getBlockDrop(blockId);
      if (drop) this.drops.spawnDrop(blockX + 0.5, blockY + 0.45, blockZ + 0.5, drop);
    }

    const aboveId = this.world.getBlock(blockX, blockY + 1, blockZ);
    if (aboveId === BlockId.Torch || aboveId === BlockId.CaveShroom) {
      this.world.setBlock(blockX, blockY + 1, blockZ, BlockId.Air);
      this.particles.spawnBurst(blockX, blockY + 1, blockZ, aboveId);
      if (!creativeMode) {
        this.drops.spawnDrop(
          blockX + 0.5,
          blockY + 1.35,
          blockZ + 0.5,
          createStack(aboveId as number, 1)
        );
      }
    }

    let vineY = blockY - 1;
    while (vineY >= 1 && this.world.getBlock(blockX, vineY, blockZ) === BlockId.CaveVine) {
      this.world.setBlock(blockX, vineY, blockZ, BlockId.Air);
      this.particles.spawnBurst(blockX, vineY, blockZ, BlockId.CaveVine);
      if (!creativeMode) {
        this.drops.spawnDrop(
          blockX + 0.5,
          vineY + 0.45,
          blockZ + 0.5,
          createStack(BlockId.CaveVine as number, 1)
        );
      }
      vineY--;
    }

    this.updateTarget();
  }
}
