import * as THREE from 'three';
import { Inventory } from '../items/Inventory';
import {
  ITEMS,
  ItemStack,
  createStack,
  getBlockDrop,
  getMiningStats,
} from '../items/Item';
import { Player } from '../player/Player';
import { VoxelHit, raycastVoxel } from '../player/Raycaster';
import { BreakParticles } from '../rendering/BreakParticles';
import { DayNightCycle } from '../rendering/DayNightCycle';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { HeldItemView } from '../rendering/HeldItemView';
import { BlockHighlight } from '../rendering/Highlight';
import { MiningOverlay } from '../rendering/MiningOverlay';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { DebugHud } from '../ui/DebugHud';
import { Hotbar } from '../ui/Hotbar';
import { InventoryModal } from '../ui/InventoryModal';
import { BLOCKS, BlockId, HOTBAR_BLOCKS } from '../world/Block';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../world/Chunk';
import { hashString } from '../world/Noise';
import { World } from '../world/World';
import { Input } from './Input';

const INITIAL_SKY_COLOR = 0x7ec4f8;
const UNDERWATER_FOG_COLOR = new THREE.Color(0x0b3c7c);

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input: Input;
  private readonly atlas: TextureAtlas;
  private readonly world: World;
  private readonly dayNight: DayNightCycle;
  private readonly player: Player;
  private readonly highlight: BlockHighlight;
  private readonly miningOverlay: MiningOverlay;
  private readonly particles: BreakParticles;
  private readonly drops: DroppedItemManager;
  private readonly heldItemView: HeldItemView;

  private readonly inventory: Inventory;
  private readonly hotbar: Hotbar;
  private readonly inventoryModal: InventoryModal;
  private readonly debugHud: DebugHud;

  private readonly overlayEl: HTMLElement;
  private readonly statusPillEl: HTMLElement;
  private readonly waterTintEl: HTMLElement;
  private readonly miningBarEl: HTMLElement;
  private readonly miningBarFillEl: HTMLElement;
  private readonly seedLabel: string;

  private lastTime = performance.now();
  private currentHit: VoxelHit | null = null;
  private creativeMode = false;

  // Progressive mining state
  private miningTargetKey = '';
  private miningElapsed = 0;
  private miningCooldown = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(INITIAL_SKY_COLOR);

    this.scene = new THREE.Scene();
    const renderDistance = 5;
    const fogFar = renderDistance * CHUNK_SIZE;
    this.scene.fog = new THREE.Fog(INITIAL_SKY_COLOR, fogFar * 0.58, fogFar * 0.98);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      260
    );
    // Add camera to scene so child HeldItemView renders
    this.scene.add(this.camera);

    this.dayNight = new DayNightCycle(this.scene);

    const params = new URLSearchParams(window.location.search);
    const rawSeed = params.get('seed') ?? 'caveria';
    this.seedLabel = rawSeed;
    const numericSeed = hashString(rawSeed);

    this.input = new Input(canvas);
    this.atlas = new TextureAtlas();
    this.world = new World(this.scene, this.atlas, numericSeed, renderDistance);

    const spawnPos = this.world.findSpawnPoint();
    this.world.generateInitialArea(spawnPos.x, spawnPos.z, 3);

    this.player = new Player(this.camera, spawnPos);
    this.highlight = new BlockHighlight(this.scene);
    this.miningOverlay = new MiningOverlay(this.scene);
    this.particles = new BreakParticles(this.scene);
    this.drops = new DroppedItemManager(this.scene, this.atlas);
    this.heldItemView = new HeldItemView(this.camera, this.atlas);

    this.inventory = new Inventory();
    this.hotbar = new Hotbar(this.inventory, this.atlas);
    this.inventoryModal = new InventoryModal(
      this.inventory,
      this.atlas,
      (overflow) => this.tossStackFromPlayer(overflow),
      () => this.closeInventoryAndResume()
    );
    this.debugHud = new DebugHud();

    this.overlayEl = document.getElementById('overlay')!;
    this.statusPillEl = document.getElementById('status-pill')!;
    this.waterTintEl = document.getElementById('water-tint')!;
    this.miningBarEl = document.getElementById('mining-bar')!;
    this.miningBarFillEl = document.getElementById('mining-bar-fill')!;

    this.setupOverlayAndEvents();
    this.updateStatusPill();
  }

  public start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((now) => this.loop(now));
  }

  private setupOverlayAndEvents(): void {
    const playButton = document.getElementById('play-button')!;
    const requestPlay = () => {
      if (this.inventoryModal.isOpen) {
        this.inventoryModal.close();
      }
      this.input.requestPointerLock();
    };

    playButton.addEventListener('click', (e) => {
      e.stopPropagation();
      requestPlay();
    });
    this.overlayEl.addEventListener('click', requestPlay);

    this.input.onPointerLockChange((locked) => {
      if (locked) {
        this.overlayEl.classList.add('hidden');
      } else if (!this.inventoryModal.isOpen) {
        // Show pause screen only if pointer unlocked due to Esc (not opening Inventory)
        this.overlayEl.classList.remove('hidden');
        playButton.textContent = 'Click to Resume';
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private openInventoryScreen(gridSize: 2 | 3): void {
    this.resetMiningState();
    this.inventoryModal.open(gridSize);
    this.overlayEl.classList.add('hidden');
    this.input.exitPointerLock();
  }

  private closeInventoryAndResume(): void {
    this.inventoryModal.close();
    this.input.requestPointerLock();
  }

  private loop(now: number): void {
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();

    requestAnimationFrame((next) => this.loop(next));
  }

  private update(dt: number): void {
    if (this.input.consumeKeyPress('F3')) {
      this.debugHud.toggle();
    }

    // Toggle Inventory with [E] (or close with [Escape] when modal is open)
    if (this.inventoryModal.isOpen) {
      if (this.input.consumeKeyPress('KeyE') || this.input.consumeKeyPress('Escape')) {
        this.closeInventoryAndResume();
      }
    } else if (this.input.isPointerLocked && this.input.consumeKeyPress('KeyE')) {
      this.openInventoryScreen(2);
    }

    if (this.input.isPointerLocked && !this.inventoryModal.isOpen) {
      if (this.input.consumeKeyPress('KeyF')) {
        this.player.flyMode = !this.player.flyMode;
        this.player.velocity.y = 0;
        this.updateStatusPill();
      }

      if (this.input.consumeKeyPress('KeyC')) {
        this.toggleCreativeMode();
      }

      // Toss 1 held item with [Q]
      if (this.input.consumeKeyPress('KeyQ')) {
        this.tossHeldSingleItem();
      }

      // Day/Night time controls
      if (this.input.consumeKeyPress('KeyT')) {
        this.dayNight.advanceTime(0.125);
      }
      if (this.input.isKeyDown('BracketLeft')) {
        this.dayNight.advanceTime(-dt * 0.22);
      }
      if (this.input.isKeyDown('BracketRight')) {
        this.dayNight.advanceTime(dt * 0.22);
      }

      this.player.updateLook(this.input);
      this.hotbar.update(this.input);

      const maxStep = 1 / 90;
      let remaining = dt;
      while (remaining > 0) {
        const step = Math.min(remaining, maxStep);
        this.player.updatePhysics(step, this.input, this.world);
        remaining -= step;
      }

      this.currentHit = raycastVoxel(
        this.world,
        this.player.getEyePosition(),
        this.player.getForwardDirection(),
        6.0
      );
      this.highlight.update(this.currentHit);

      this.handleMiningAndPlacement(dt);
    } else {
      this.resetMiningState();
    }

    const horizSpeed = this.player.onGround
      ? Math.hypot(this.player.velocity.x, this.player.velocity.z)
      : 0;
    const activelyMining =
      this.input.isPointerLocked &&
      !this.inventoryModal.isOpen &&
      this.input.isMouseDown(0) &&
      this.currentHit !== null;

    this.heldItemView.setEquipped(this.hotbar.selectedStack);
    this.heldItemView.update(dt, horizSpeed, activelyMining);

    this.drops.update(dt, this.world, this.player.position, this.inventory);
    this.dayNight.update(dt, this.player.position);
    this.syncShaderLightUniforms();
    this.world.updateStreaming(this.player.position.x, this.player.position.z);
    this.particles.update(dt);
    this.updateAtmosphere();
    this.debugHud.update(
      dt,
      this.player,
      this.world,
      this.dayNight,
      this.currentHit,
      this.seedLabel,
      this.creativeMode
    );
  }

  private toggleCreativeMode(): void {
    this.creativeMode = !this.creativeMode;
    if (this.creativeMode) {
      // Populate empty hotbar slots with the full creative building palette if empty
      for (let i = 0; i < HOTBAR_BLOCKS.length; i++) {
        if (!this.inventory.getSlot(i)) {
          this.inventory.setSlot(i, createStack(HOTBAR_BLOCKS[i] as number, 64));
        }
      }
    }
    this.updateStatusPill();
  }

  private handleMiningAndPlacement(dt: number): void {
    if (this.miningCooldown > 0) {
      this.miningCooldown = Math.max(0, this.miningCooldown - dt);
    }

    // 1. Progressive Mining (Hold Left Click) or Instant Break in Creative
    if (this.input.isMouseDown(0)) {
      if (this.input.consumeMousePress(0)) {
        this.heldItemView.triggerSwing();
      }

      if (this.currentHit && BLOCKS[this.currentHit.blockId].breakable) {
        if (this.creativeMode) {
          if (this.miningCooldown <= 0) {
            this.breakBlockAt(this.currentHit, false);
            this.miningCooldown = 0.16;
          }
          this.resetMiningState();
        } else if (this.miningCooldown <= 0) {
          const hitKey = `${this.currentHit.blockX},${this.currentHit.blockY},${this.currentHit.blockZ},${this.currentHit.blockId}`;
          if (hitKey !== this.miningTargetKey) {
            this.miningTargetKey = hitKey;
            this.miningElapsed = 0;
          }

          const { durationSeconds, canHarvest } = getMiningStats(
            this.currentHit.blockId,
            this.hotbar.selectedStack
          );

          this.miningElapsed += dt;
          const progress = Math.min(1, this.miningElapsed / durationSeconds);

          this.miningOverlay.update(this.currentHit, progress);
          this.miningBarEl.classList.remove('hidden');
          this.miningBarFillEl.style.width = `${Math.round(progress * 100)}%`;
          this.miningBarFillEl.classList.toggle('no-harvest', !canHarvest);

          if (progress >= 1) {
            this.breakBlockAt(this.currentHit, canHarvest);
            if (!this.creativeMode) {
              this.inventory.damageTool(this.hotbar.selectedIndex);
            }
            this.resetMiningState();
            this.miningCooldown = 0.14;
          }
        }
      } else {
        this.resetMiningState();
      }
    } else {
      this.resetMiningState();
    }

    // 2. Middle click: Pick targeted block
    if (this.input.consumeMousePress(1) && this.currentHit) {
      this.hotbar.pickBlock(this.currentHit.blockId, this.creativeMode);
    }

    // 3. Right click: Interact with Crafting Table OR Place held block
    if (this.input.consumeMousePress(2) && this.currentHit) {
      const sneaking =
        this.input.isKeyDown('ShiftLeft') || this.input.isKeyDown('ShiftRight');

      // Right-clicking a Crafting Table opens the 3x3 workbench (unless sneaking to place on it)
      if (this.currentHit.blockId === BlockId.CraftingTable && !sneaking) {
        this.openInventoryScreen(3);
        return;
      }

      const held = this.hotbar.selectedStack;
      if (!held) return;
      const itemDef = ITEMS[held.id];
      if (itemDef.placeBlockId === null) return;

      const placeBlock = itemDef.placeBlockId;
      const placeBlockDef = BLOCKS[placeBlock];

      const placeX = this.currentHit.blockX + this.currentHit.normalX;
      const placeY = this.currentHit.blockY + this.currentHit.normalY;
      const placeZ = this.currentHit.blockZ + this.currentHit.normalZ;

      if (placeY < 0 || placeY >= CHUNK_HEIGHT) return;
      const existing = this.world.getBlock(placeX, placeY, placeZ);

      if (placeBlockDef.shape === 'torch' || placeBlockDef.shape === 'cross') {
        const below = this.world.getBlock(placeX, placeY - 1, placeZ);
        const above = this.world.getBlock(placeX, placeY + 1, placeZ);
        const canSupport =
          placeBlock === BlockId.CaveVine
            ? BLOCKS[above].solid || above === BlockId.CaveVine
            : placeBlock === BlockId.DripstoneSpike
            ? BLOCKS[below].solid || BLOCKS[above].solid
            : BLOCKS[below].solid;

        if (existing === BlockId.Air && canSupport) {
          this.world.setBlock(placeX, placeY, placeZ, placeBlock);
          this.heldItemView.triggerSwing();
          if (!this.creativeMode) {
            this.inventory.consumeOne(this.hotbar.selectedIndex);
          }
          this.refreshRaycast();
        }
        return;
      }

      if (
        (existing === BlockId.Air || existing === BlockId.Water) &&
        (!placeBlockDef.solid || !this.player.intersectsBlock(placeX, placeY, placeZ))
      ) {
        this.world.setBlock(placeX, placeY, placeZ, placeBlock);
        this.heldItemView.triggerSwing();
        if (!this.creativeMode) {
          this.inventory.consumeOne(this.hotbar.selectedIndex);
        }
        this.refreshRaycast();
      }
    }
  }

  private breakBlockAt(hit: VoxelHit, spawnDropItem: boolean): void {
    const { blockX, blockY, blockZ, blockId } = hit;
    this.world.setBlock(blockX, blockY, blockZ, BlockId.Air);
    this.particles.spawnBurst(blockX, blockY, blockZ, blockId);

    if (spawnDropItem) {
      const drop = getBlockDrop(blockId);
      if (drop) {
        this.drops.spawnDrop(blockX + 0.5, blockY + 0.45, blockZ + 0.5, drop);
      }
    }

    // Pop any torch or floor flora resting directly above
    const aboveId = this.world.getBlock(blockX, blockY + 1, blockZ);
    if (aboveId === BlockId.Torch || aboveId === BlockId.CaveShroom) {
      this.world.setBlock(blockX, blockY + 1, blockZ, BlockId.Air);
      this.particles.spawnBurst(blockX, blockY + 1, blockZ, aboveId);
      if (!this.creativeMode) {
        this.drops.spawnDrop(
          blockX + 0.5,
          blockY + 1.35,
          blockZ + 0.5,
          createStack(aboveId as number, 1)
        );
      }
    }

    // Cascade break hanging glow vines directly below
    let vy = blockY - 1;
    while (vy >= 1 && this.world.getBlock(blockX, vy, blockZ) === BlockId.CaveVine) {
      this.world.setBlock(blockX, vy, blockZ, BlockId.Air);
      this.particles.spawnBurst(blockX, vy, blockZ, BlockId.CaveVine);
      if (!this.creativeMode) {
        this.drops.spawnDrop(
          blockX + 0.5,
          vy + 0.45,
          blockZ + 0.5,
          createStack(BlockId.CaveVine as number, 1)
        );
      }
      vy--;
    }

    this.refreshRaycast();
  }

  private resetMiningState(): void {
    this.miningTargetKey = '';
    this.miningElapsed = 0;
    this.miningOverlay.update(null, 0);
    this.miningBarEl.classList.add('hidden');
  }

  private tossHeldSingleItem(): void {
    const cur = this.hotbar.selectedStack;
    if (!cur) return;
    const single: ItemStack = {
      id: cur.id,
      count: 1,
      durability: cur.durability,
    };
    this.inventory.consumeOne(this.hotbar.selectedIndex);
    this.tossStackFromPlayer(single);
    this.heldItemView.triggerSwing();
  }

  private tossStackFromPlayer(stack: ItemStack): void {
    const eye = this.player.getEyePosition();
    const dir = this.player.getForwardDirection();
    const vel = dir.clone().multiplyScalar(5.5);
    vel.y += 1.6;
    this.drops.spawnDrop(
      eye.x + dir.x * 0.45,
      eye.y - 0.25,
      eye.z + dir.z * 0.45,
      stack,
      vel,
      1.15
    );
  }

  private syncShaderLightUniforms(): void {
    const u = this.world.lightUniforms;
    u.uSkyBrightness.value = this.dayNight.skyBrightness;
    u.uSkyTint.value.copy(this.dayNight.skyLightTint);
    u.uTorchFlicker.value = this.dayNight.torchFlicker;
  }

  private refreshRaycast(): void {
    this.currentHit = raycastVoxel(
      this.world,
      this.player.getEyePosition(),
      this.player.getForwardDirection(),
      6.0
    );
    this.highlight.update(this.currentHit);
  }

  private updateAtmosphere(): void {
    const underwater = this.player.isHeadUnderwater(this.world);
    this.waterTintEl.classList.toggle('active', underwater);

    const fog = this.scene.fog as THREE.Fog;
    const maxDist = this.world.renderDistance * CHUNK_SIZE;
    if (underwater) {
      const tintedWater = UNDERWATER_FOG_COLOR.clone().multiplyScalar(
        0.35 + 0.65 * this.dayNight.skyBrightness
      );
      this.renderer.setClearColor(tintedWater);
      fog.color.copy(tintedWater);
      fog.near = 2;
      fog.far = 26;
    } else {
      this.renderer.setClearColor(this.dayNight.skyColor);
      fog.color.copy(this.dayNight.skyColor);
      fog.near = maxDist * 0.58;
      fog.far = maxDist * 0.98;
    }
  }

  private updateStatusPill(): void {
    const gm = this.creativeMode ? 'Creative' : 'Survival';
    const fly = this.player.flyMode ? 'Fly' : 'Walk';
    this.statusPillEl.textContent = `${gm} (${fly}) · [E] Craft · [C] Mode · [F] Fly`;
  }
}
