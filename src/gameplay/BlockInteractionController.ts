import type * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { ArrowProjectileManager } from './ArrowProjectileManager';
import {
  UseInteractionRegistry,
  UseInteractionResult,
} from './interactions/UseInteractionRegistry';
import {
  BlockBreakBehaviorRegistry,
  BlockSupportRegistry,
} from './interactions/BlockBehaviorRegistry';
import { Input } from '../core/Input';
import { MobHit, MobManager } from '../entities/MobManager';
import { Inventory } from '../items/Inventory';
import { ITEMS, ItemId, ItemStack, createStack, getAttackDamage, getBlockDrops, getMiningStats } from '../items/Item';
import { Player } from '../player/Player';
import { PlayerVitals } from '../player/PlayerVitals';
import { VoxelHit, raycastVoxel, raycastWater } from '../player/Raycaster';
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
  useRegistry: UseInteractionRegistry;
  blockBreakRegistry: BlockBreakBehaviorRegistry;
  blockSupportRegistry: BlockSupportRegistry;
  onWaterTarget: (hit: VoxelHit | null) => void;
  onPlaceBed: (x: number, y: number, z: number) => boolean;
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
  private readonly useRegistry: UseInteractionRegistry;
  private readonly blockBreakRegistry: BlockBreakBehaviorRegistry;
  private readonly blockSupportRegistry: BlockSupportRegistry;
  private readonly onWaterTarget: (hit: VoxelHit | null) => void;
  private readonly onPlaceBed: (x: number, y: number, z: number) => boolean;
  private readonly getMiningSpeedMultiplier: () => number;
  private readonly highlight: BlockHighlight;
  private readonly miningOverlay: MiningOverlay;
  private readonly miningBarEl: HTMLElement;
  private readonly miningBarFillEl: HTMLElement;
  private readonly mobTargetEl: HTMLElement;

  private hit: VoxelHit | null = null;
  private waterHit: VoxelHit | null = null;
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
    this.useRegistry = deps.useRegistry;
    this.blockBreakRegistry = deps.blockBreakRegistry;
    this.blockSupportRegistry = deps.blockSupportRegistry;
    this.onWaterTarget = deps.onWaterTarget;
    this.onPlaceBed = deps.onPlaceBed;
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
    this.waterHit = raycastWater(this.world, eye, direction, 6.0);
    this.onWaterTarget(this.waterHit);
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
      if (this.mobTarget) this.handleMobUse(creativeMode);
      else this.handleUse(creativeMode, true);
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
    this.waterHit = null;
    this.onWaterTarget(null);
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

  private handleMobUse(creativeMode: boolean): void {
    if (!this.mobTarget) return;
    const result = this.mobs.interact(
      this.mobTarget,
      this.hotbar.selectedStack,
      creativeMode,
      this.input.isKeyDown('ShiftLeft') || this.input.isKeyDown('ShiftRight')
    );
    if (!result) return;
    if (result.consumeHeld) this.inventory.consumeOne(this.hotbar.selectedIndex);
    if (result.damageHeld && this.inventory.damageTool(this.hotbar.selectedIndex)) {
      this.audio.playToolBreak();
    }
    if (result.swing) this.heldItemView.triggerSwing();
    this.updateTarget();
  }

  private handleUse(creativeMode: boolean, allowWorldUse: boolean): void {
    const sneaking =
      this.input.isKeyDown('ShiftLeft') || this.input.isKeyDown('ShiftRight');
    const held = this.hotbar.selectedStack;
    const resolved = this.useRegistry.resolve({
      creativeMode,
      allowWorldUse,
      sneaking,
      held,
      hit: this.hit,
      waterHit: this.waterHit,
      foodCooldown: this.foodCooldown,
    });
    if (resolved) {
      this.applyUseResult(resolved);
      return;
    }
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
    const canReplace = placeDefinition.supportBehavior
      ? existing === BlockId.Air
      : BLOCKS[existing].replaceable === true;
    if (!canReplace) return;
    if (!this.blockSupportRegistry.isSupported(
      placeDefinition.supportBehavior,
      this.world,
      placeX,
      placeY,
      placeZ
    )) return;
    if (placeDefinition.solid && this.player.intersectsBlock(placeX, placeY, placeZ)) return;
    this.placeBlock(placeX, placeY, placeZ, placeBlock, creativeMode);
  }

  private applyUseResult(result: UseInteractionResult): void {
    if (result.consumeHeld) this.inventory.consumeOne(this.hotbar.selectedIndex);
    if (result.damageHeld && this.inventory.damageTool(this.hotbar.selectedIndex)) {
      this.audio.playToolBreak();
    }
    if (result.exhaustion) this.vitals.addExhaustion(result.exhaustion);
    if (result.cooldown !== undefined) this.foodCooldown = result.cooldown;
    if (result.returnedItem !== undefined) this.addInventoryOrDrop(createStack(result.returnedItem));
    if (result.inventoryItem) this.addInventoryOrDrop(result.inventoryItem);
    if (result.worldDrop) {
      this.drops.spawnDrop(
        result.worldDrop.position.x,
        result.worldDrop.position.y,
        result.worldDrop.position.z,
        result.worldDrop.stack,
        result.worldDrop.velocity,
        result.worldDrop.pickupDelay
      );
    }
    if (result.animation === 'place') this.heldItemView.triggerPlace();
    else if (result.animation === 'swing') this.heldItemView.triggerSwing();
    if (result.refreshTarget) this.updateTarget();
  }

  private addInventoryOrDrop(stack: ItemStack): void {
    this.inventory.addItem(stack);
    if (stack.count > 0) this.tossStackFromPlayer(stack);
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
    this.blockBreakRegistry.execute(BLOCKS[blockId].breakBehaviors, {
      hit,
      creativeMode,
      cause: 'mined',
    });
    this.world.setBlock(blockX, blockY, blockZ, BlockId.Air);
    this.particles.spawnBurst(blockX, blockY, blockZ, blockId);
    this.audio.playBreak(blockId);
    if (!creativeMode) this.vitals.addExhaustion(0.025);

    if (spawnDropItem) {
      for (const drop of getBlockDrops(blockId, 'mined')) {
        this.drops.spawnDrop(blockX + 0.5, blockY + 0.45, blockZ + 0.5, drop);
      }
    }

    this.removeUnsupportedAt(blockX, blockY + 1, blockZ, creativeMode);
    this.removeUnsupportedAt(blockX, blockY - 1, blockZ, creativeMode);
    this.updateTarget();
  }

  private removeUnsupportedAt(x: number, y: number, z: number, creativeMode: boolean): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const blockId = this.world.getBlock(x, y, z);
    if (blockId === BlockId.Air) return;
    const definition = BLOCKS[blockId];
    if (!definition.supportBehavior) return;
    if (this.blockSupportRegistry.isSupported(definition.supportBehavior, this.world, x, y, z)) return;

    const hit: VoxelHit = {
      blockX: x, blockY: y, blockZ: z,
      normalX: 0, normalY: 0, normalZ: 0,
      blockId,
      distance: 0,
    };
    this.blockBreakRegistry.execute(definition.breakBehaviors, {
      hit,
      creativeMode,
      cause: 'support-loss',
    });
    this.world.setBlock(x, y, z, BlockId.Air);
    this.particles.spawnBurst(x, y, z, blockId);
    if (!creativeMode) {
      for (const drop of getBlockDrops(blockId, 'support-loss')) {
        this.drops.spawnDrop(x + 0.5, y + 0.35, z + 0.5, drop);
      }
    }
    this.removeUnsupportedAt(x, y + 1, z, creativeMode);
    this.removeUnsupportedAt(x, y - 1, z, creativeMode);
  }
}
