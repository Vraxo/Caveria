import type * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { ArrowProjectileManager } from './ArrowProjectileManager';
import { FarmUseResult } from './FarmingManager';
import { Input } from '../core/Input';
import { MobHit, MobManager } from '../entities/MobManager';
import { Inventory } from '../items/Inventory';
import { ITEMS, ItemId, ItemStack, createStack, getAttackDamage, getBlockDrop, getFoodStats, getMiningStats } from '../items/Item';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
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
  mobs: MobManager;
  vitals: PlayerVitals;
  arrows: ArrowProjectileManager;
  onOpenWorkbench: () => void;
  onOpenFurnace: (x: number, y: number, z: number) => void;
  onFurnaceBroken: (x: number, y: number, z: number) => void;
  onOpenChest: (x: number, y: number, z: number) => void;
  onChestBroken: (x: number, y: number, z: number) => void;
  onUseBed: (x: number, y: number, z: number) => void;
  onPlaceBed: (x: number, y: number, z: number) => boolean;
  onBedBroken: (x: number, y: number, z: number, drop: boolean) => void;
  onUseFarm: (x: number, y: number, z: number, held: ItemId | null) => FarmUseResult;
  onFarmBroken: (x: number, y: number, z: number, drop: boolean) => boolean;
  onConsumeSpecial: (itemId: ItemId) => boolean;
  onFoodConsumed: (itemId: ItemId) => void;
  onHazardBlockBroken: (blockId: BlockId) => void;
  getMiningSpeedMultiplier: () => number;
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
  private readonly mobs: MobManager;
  private readonly vitals: PlayerVitals;
  private readonly arrows: ArrowProjectileManager;
  private readonly onOpenWorkbench: () => void;
  private readonly onOpenFurnace: (x: number, y: number, z: number) => void;
  private readonly onFurnaceBroken: (x: number, y: number, z: number) => void;
  private readonly onOpenChest: (x: number, y: number, z: number) => void;
  private readonly onChestBroken: (x: number, y: number, z: number) => void;
  private readonly onUseBed: (x: number, y: number, z: number) => void;
  private readonly onPlaceBed: (x: number, y: number, z: number) => boolean;
  private readonly onBedBroken: (x: number, y: number, z: number, drop: boolean) => void;
  private readonly onUseFarm: (x: number, y: number, z: number, held: ItemId | null) => FarmUseResult;
  private readonly onFarmBroken: (x: number, y: number, z: number, drop: boolean) => boolean;
  private readonly onConsumeSpecial: (itemId: ItemId) => boolean;
  private readonly onFoodConsumed: (itemId: ItemId) => void;
  private readonly onHazardBlockBroken: (blockId: BlockId) => void;
  private readonly getMiningSpeedMultiplier: () => number;
  private readonly highlight: BlockHighlight;
  private readonly miningOverlay: MiningOverlay;
  private readonly miningBarEl: HTMLElement;
  private readonly miningBarFillEl: HTMLElement;
  private readonly mobTargetEl: HTMLElement;

  private hit: VoxelHit | null = null;
  private mobTarget: MobHit | null = null;
  private miningTargetKey = '';
  private miningElapsed = 0;
  private miningCooldown = 0;
  private foodCooldown = 0;
  private bowDrawing = false;
  private bowDrawTime = 0;

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
    this.vitals = deps.vitals;
    this.arrows = deps.arrows;
    this.onOpenWorkbench = deps.onOpenWorkbench;
    this.onOpenFurnace = deps.onOpenFurnace;
    this.onFurnaceBroken = deps.onFurnaceBroken;
    this.onOpenChest = deps.onOpenChest;
    this.onChestBroken = deps.onChestBroken;
    this.onUseBed = deps.onUseBed;
    this.onPlaceBed = deps.onPlaceBed;
    this.onBedBroken = deps.onBedBroken;
    this.onUseFarm = deps.onUseFarm;
    this.onFarmBroken = deps.onFarmBroken;
    this.onConsumeSpecial = deps.onConsumeSpecial;
    this.onFoodConsumed = deps.onFoodConsumed;
    this.onHazardBlockBroken = deps.onHazardBlockBroken;
    this.getMiningSpeedMultiplier = deps.getMiningSpeedMultiplier;
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
        `${this.mobTarget.name}  ${'♥'.repeat(this.mobTarget.health)}${'♡'.repeat(this.mobTarget.maxHealth - this.mobTarget.health)}`;
    }
  }

  public update(dt: number, creativeMode: boolean): void {
    if (this.miningCooldown > 0) {
      this.miningCooldown = Math.max(0, this.miningCooldown - dt);
    }
    this.foodCooldown = Math.max(0, this.foodCooldown - dt);

    const bowHandled = this.updateBow(dt, creativeMode);
    if (!bowHandled && this.input.consumeMousePress(2)) {
      this.handleUse(creativeMode, this.mobTarget === null);
    }

    if (this.mobTarget) {
      this.cancelMining();
      if (this.input.consumeMousePress(0) && this.miningCooldown <= 0) {
        this.heldItemView.triggerSwing();
        const held = this.hotbar.selectedStack;
        if (this.mobs.damage(this.mobTarget, getAttackDamage(held), this.player.getForwardDirection())) {
          this.miningCooldown = 0.42;
          if (!creativeMode) this.vitals.addExhaustion(0.12);
          if (held && ITEMS[held.id].maxDurability !== undefined) {
            if (this.inventory.damageTool(this.hotbar.selectedIndex)) this.audio.playToolBreak();
          }
        }
      }
      return;
    }

    this.updateMining(dt, creativeMode);

    if (this.input.consumeMousePress(1) && this.hit) {
      this.hotbar.pickBlock(this.hit.blockId, creativeMode);
    }

  }

  public clearTarget(): void {
    this.cancelMining();
    this.cancelBowDraw();
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
    this.miningElapsed += dt * this.getMiningSpeedMultiplier();
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

  private updateBow(dt: number, creativeMode: boolean): boolean {
    const held = this.hotbar.selectedStack;
    if (held?.id !== ItemId.Bow) {
      if (this.bowDrawing) this.cancelBowDraw();
      return false;
    }

    if (this.input.consumeMousePress(2)) {
      if (creativeMode || this.inventory.countItem(ItemId.Arrow) > 0) {
        this.bowDrawing = true;
        this.bowDrawTime = 0;
        this.audio.playBowDraw();
      }
    }
    if (!this.bowDrawing) return true;

    if (this.input.isMouseDown(2)) {
      this.bowDrawTime = Math.min(1.25, this.bowDrawTime + dt);
      this.heldItemView.setBowDraw(Math.min(1, this.bowDrawTime / 1.0));
    }
    if (this.input.consumeMouseRelease(2) || !this.input.isMouseDown(2)) {
      if (this.bowDrawTime >= 0.12 && (creativeMode || this.inventory.consumeItem(ItemId.Arrow))) {
        const power = Math.min(1, this.bowDrawTime / 1.0);
        this.arrows.fire(this.player.getEyePosition(), this.player.getForwardDirection(), power);
        if (!creativeMode && this.inventory.damageTool(this.hotbar.selectedIndex)) {
          this.audio.playToolBreak();
        }
        if (!creativeMode) this.vitals.addExhaustion(0.03);
      }
      this.cancelBowDraw();
    }
    return true;
  }

  private cancelBowDraw(): void {
    this.bowDrawing = false;
    this.bowDrawTime = 0;
    this.heldItemView.setBowDraw(0);
  }

  private handleUse(creativeMode: boolean, allowWorldUse: boolean): void {
    const sneaking =
      this.input.isKeyDown('ShiftLeft') || this.input.isKeyDown('ShiftRight');
    const held = this.hotbar.selectedStack;
    if (allowWorldUse && this.hit && !sneaking) {
      const farmResult = this.onUseFarm(
        this.hit.blockX,
        this.hit.blockY,
        this.hit.blockZ,
        held?.id ?? null
      );
      if (farmResult !== 'none') {
        if (!creativeMode && farmResult === 'planted') this.inventory.consumeOne(this.hotbar.selectedIndex);
        if (!creativeMode && farmResult === 'tilled' && this.inventory.damageTool(this.hotbar.selectedIndex)) {
          this.audio.playToolBreak();
        }
        this.audio.playFarmAction(farmResult);
        this.heldItemView.triggerPlace();
        this.updateTarget();
        return;
      }
      if (this.hit.blockId === BlockId.CraftingTable) {
        this.onOpenWorkbench();
        return;
      }
      if (
        this.hit.blockId === BlockId.Furnace || this.hit.blockId === BlockId.LitFurnace ||
        this.hit.blockId === BlockId.Campfire || this.hit.blockId === BlockId.LitCampfire
      ) {
        this.onOpenFurnace(this.hit.blockX, this.hit.blockY, this.hit.blockZ);
        return;
      }
      if (this.hit.blockId === BlockId.BedFoot || this.hit.blockId === BlockId.BedHead) {
        this.onUseBed(this.hit.blockX, this.hit.blockY, this.hit.blockZ);
        return;
      }
      if (this.hit.blockId === BlockId.Chest) {
        this.onOpenChest(this.hit.blockX, this.hit.blockY, this.hit.blockZ);
        return;
      }
    }

    if (held && this.onConsumeSpecial(held.id)) {
      if (!creativeMode) this.inventory.consumeOne(this.hotbar.selectedIndex);
      this.foodCooldown = 0.55;
      this.heldItemView.triggerPlace();
      return;
    }

    const food = getFoodStats(held);
    if (
      held &&
      food &&
      this.foodCooldown <= 0 &&
      this.vitals.eat(food.nutrition, food.saturation)
    ) {
      if (!creativeMode) this.inventory.consumeOne(this.hotbar.selectedIndex);
      this.foodCooldown = 0.55;
      this.heldItemView.triggerPlace();
      this.audio.playEat();
      this.onFoodConsumed(held.id);
      return;
    }
    if (food && this.foodCooldown > 0) return;
    if (!allowWorldUse || !this.hit || !held) return;
    const placeX = this.hit.blockX + this.hit.normalX;
    const placeY = this.hit.blockY + this.hit.normalY;
    const placeZ = this.hit.blockZ + this.hit.normalZ;
    if (placeY < 0 || placeY >= CHUNK_HEIGHT) return;
    if (held.id === ItemId.Bed) {
      if (this.onPlaceBed(placeX, placeY, placeZ)) {
        this.heldItemView.triggerPlace();
        this.audio.playPlace(BlockId.BedFoot);
        if (!creativeMode) {
          this.inventory.consumeOne(this.hotbar.selectedIndex);
          this.vitals.addExhaustion(0.01);
        }
        this.updateTarget();
      }
      return;
    }

    const itemDefinition = ITEMS[held.id];
    if (itemDefinition.placeBlockId === null) return;

    const placeBlock = itemDefinition.placeBlockId;
    const placeDefinition = BLOCKS[placeBlock];

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
    if (!creativeMode) {
      this.inventory.consumeOne(this.hotbar.selectedIndex);
      this.vitals.addExhaustion(0.01);
    }
    this.updateTarget();
  }

  private breakBlockAt(hit: VoxelHit, spawnDropItem: boolean, creativeMode: boolean): void {
    const { blockX, blockY, blockZ, blockId } = hit;
    if (
      blockId === BlockId.Furnace || blockId === BlockId.LitFurnace ||
      blockId === BlockId.Campfire || blockId === BlockId.LitCampfire
    ) {
      this.onFurnaceBroken(blockX, blockY, blockZ);
    }
    if (blockId === BlockId.BedFoot || blockId === BlockId.BedHead) {
      this.onBedBroken(blockX, blockY, blockZ, !creativeMode);
    }
    if (blockId === BlockId.Chest) {
      this.onChestBroken(blockX, blockY, blockZ);
    }
    this.onFarmBroken(blockX, blockY, blockZ, !creativeMode);
    if (!creativeMode) this.onHazardBlockBroken(blockId);
    this.world.setBlock(blockX, blockY, blockZ, BlockId.Air);
    this.particles.spawnBurst(blockX, blockY, blockZ, blockId);
    this.audio.playBreak(blockId);
    if (!creativeMode) this.vitals.addExhaustion(0.025);

    if (spawnDropItem) {
      const drop = getBlockDrop(blockId);
      if (drop) this.drops.spawnDrop(blockX + 0.5, blockY + 0.45, blockZ + 0.5, drop);
    }

    const aboveId = this.world.getBlock(blockX, blockY + 1, blockZ);
    if (aboveId === BlockId.BedFoot || aboveId === BlockId.BedHead) {
      this.onBedBroken(blockX, blockY + 1, blockZ, !creativeMode);
      this.particles.spawnBurst(blockX, blockY + 1, blockZ, aboveId);
    } else if (aboveId === BlockId.Torch || aboveId === BlockId.CaveShroom) {
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
