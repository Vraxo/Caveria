import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { BlockInteractionController } from '../gameplay/BlockInteractionController';
import { MovementAudioController } from '../gameplay/MovementAudioController';
import { CrystalMiteManager } from '../entities/CrystalMiteManager';
import { Inventory } from '../items/Inventory';
import { ItemId, createStack } from '../items/Item';
import { Player } from '../player/Player';
import { GamePersistenceController, GameSaveSnapshot } from '../persistence/GamePersistenceController';
import { WorldPersistence } from '../persistence/WorldPersistence';
import { AtmosphereController } from '../rendering/AtmosphereController';
import { BreakParticles } from '../rendering/BreakParticles';
import { DayNightCycle } from '../rendering/DayNightCycle';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { HeldItemView } from '../rendering/HeldItemView';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { WeatherSystem } from '../rendering/WeatherSystem';
import { DebugHud } from '../ui/DebugHud';
import { GameOverlayController } from '../ui/GameOverlayController';
import { Hotbar } from '../ui/Hotbar';
import { InventoryModal } from '../ui/InventoryModal';
import { HOTBAR_BLOCKS } from '../gameplay/CreativePalette';
import { CHUNK_SIZE } from '../world/Chunk';
import { hashString } from '../world/Noise';
import { World } from '../world/World';
import { Input } from './Input';

const INITIAL_SKY_COLOR = 0x7ec4f8;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input: Input;
  private readonly atlas: TextureAtlas;
  private readonly world: World;
  private readonly dayNight: DayNightCycle;
  private readonly player: Player;
  private readonly particles: BreakParticles;
  private readonly drops: DroppedItemManager;
  private readonly mobs: CrystalMiteManager;
  private readonly heldItemView: HeldItemView;
  private readonly audio: AudioManager;
  private readonly interactions: BlockInteractionController;
  private readonly movementAudio: MovementAudioController;
  private readonly atmosphere: AtmosphereController;
  private readonly weather: WeatherSystem;
  private readonly persistence: GamePersistenceController;

  private readonly inventory: Inventory;
  private readonly hotbar: Hotbar;
  private readonly inventoryModal: InventoryModal;
  private readonly debugHud: DebugHud;
  private readonly overlay: GameOverlayController;
  private readonly seedLabel: string;

  private lastTime = performance.now();
  private creativeMode = false;

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
    const worldId = params.get('world') ?? `legacy:${rawSeed}`;
    const worldName = params.get('name')?.trim() || (rawSeed === 'caveria' ? 'Caveria World' : rawSeed);
    this.seedLabel = rawSeed;
    const numericSeed = hashString(rawSeed);
    this.persistence = new GamePersistenceController(
      rawSeed,
      worldId,
      worldName,
      () => this.audio.playUiClick()
    );
    const savedGame = this.persistence.load();

    this.input = new Input(canvas);
    this.atlas = new TextureAtlas();
    this.world = new World(
      this.scene,
      this.atlas,
      numericSeed,
      renderDistance,
      savedGame?.worldEdits ?? []
    );

    const generatedSpawn = this.world.findSpawnPoint();
    const spawnPos = savedGame
      ? new THREE.Vector3(savedGame.player.x, savedGame.player.y, savedGame.player.z)
      : generatedSpawn;
    this.world.generateInitialArea(spawnPos.x, spawnPos.z, 3);

    this.player = new Player(this.camera, spawnPos);
    if (savedGame) {
      this.player.restoreTransform(spawnPos, savedGame.player.yaw, savedGame.player.pitch);
      this.player.flyMode = savedGame.player.flyMode;
      this.dayNight.timeOfDay = savedGame.timeOfDay;
    }
    this.audio = new AudioManager();
    if (savedGame) this.audio.setMuted(savedGame.muted);
    this.weather = new WeatherSystem(this.scene, this.world, this.player, this.audio);
    if (savedGame) this.weather.restore(savedGame.weather);
    this.particles = new BreakParticles(this.scene);
    this.drops = new DroppedItemManager(this.scene, this.atlas, (itemId) => {
      if (itemId === ItemId.AmethystShard) this.audio.playCrystalPickup();
      else this.audio.playPickup();
    });
    this.mobs = new CrystalMiteManager(
      this.scene,
      this.world,
      this.player,
      this.drops,
      this.particles,
      this.audio
    );
    this.heldItemView = new HeldItemView(this.camera, this.atlas);

    this.inventory = new Inventory();
    if (savedGame) this.inventory.restore(savedGame.inventory);
    this.hotbar = new Hotbar(this.inventory, this.atlas);
    if (savedGame) {
      this.hotbar.selectIndex(savedGame.selectedHotbar);
      this.creativeMode = savedGame.creativeMode;
    }
    this.interactions = new BlockInteractionController({
      scene: this.scene,
      world: this.world,
      player: this.player,
      input: this.input,
      inventory: this.inventory,
      hotbar: this.hotbar,
      particles: this.particles,
      drops: this.drops,
      heldItemView: this.heldItemView,
      audio: this.audio,
      mobs: this.mobs,
      onOpenWorkbench: () => this.openInventoryScreen(3),
    });
    this.inventoryModal = new InventoryModal(
      this.inventory,
      this.atlas,
      (overflow) => this.interactions.tossStackFromPlayer(overflow),
      () => this.closeInventoryAndResume()
    );
    this.debugHud = new DebugHud();
    this.movementAudio = new MovementAudioController(this.audio, this.player, this.world);
    this.atmosphere = new AtmosphereController(
      this.renderer,
      this.scene,
      this.world,
      this.player,
      this.dayNight,
      this.weather
    );
    this.overlay = new GameOverlayController({
      renderer: this.renderer,
      camera: this.camera,
      input: this.input,
      audio: this.audio,
      inventoryModal: this.inventoryModal,
      currentWorld: {
        worldId,
        worldName: savedGame?.worldName ?? worldName,
        seed: rawSeed,
        savedAt: savedGame?.savedAt ?? 0,
        createdAt: savedGame?.createdAt ?? Date.now(),
        editCount: savedGame?.worldEdits.length ?? 0,
      },
      onAudioChanged: () => this.persistence.save(false),
      onBeforeWorldSwitch: (saveCurrent) => {
        if (!saveCurrent) this.persistence.suppressFurtherSaves();
      },
      onDeleteWorld: (world) => {
        if (world.worldId === worldId) this.persistence.suppressFurtherSaves();
        WorldPersistence.deleteWorld(world.worldId, world.seed);
        if (world.worldId === worldId) {
          const url = new URL(window.location.href);
          url.search = '';
          window.location.href = url.toString();
        }
      },
      onWorldStarted: () => this.persistence.enableSaving(),
      onQuit: (saveCurrent) => {
        if (saveCurrent) this.persistence.save(false);
        else this.persistence.suppressFurtherSaves();
        window.close();
      },
    });
    this.persistence.bind(() => this.createSaveSnapshot());
    this.overlay.updateStatus(this.creativeMode, this.player.flyMode);
    if (savedGame) this.persistence.showRestored(this.world.editCount);
  }

  public start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((now) => this.loop(now));
  }

  private openInventoryScreen(gridSize: 2 | 3): void {
    this.interactions.clearTarget();
    this.overlay.openInventory(gridSize);
  }

  private closeInventoryAndResume(): void {
    this.overlay.closeInventoryAndResume();
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
    this.persistence.update(dt);
    this.weather.update(dt);

    if (this.input.consumeKeyPress('KeyM')) {
      this.overlay.toggleAudio();
    }

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
        this.audio.playModeToggle();
        this.overlay.updateStatus(this.creativeMode, this.player.flyMode);
      }

      if (this.input.consumeKeyPress('KeyC')) {
        this.toggleCreativeMode();
      }

      // Toss 1 held item with [Q]
      if (this.input.consumeKeyPress('KeyQ')) {
        this.interactions.tossHeldSingleItem();
      }

      // Day/night and weather controls
      if (this.input.consumeKeyPress('KeyT')) {
        this.dayNight.advanceTime(0.125);
      }
      if (this.input.consumeKeyPress('KeyY')) {
        this.weather.cycleWeather();
        this.audio.playModeToggle();
      }
      if (this.input.isKeyDown('BracketLeft')) {
        this.dayNight.advanceTime(-dt * 0.22);
      }
      if (this.input.isKeyDown('BracketRight')) {
        this.dayNight.advanceTime(dt * 0.22);
      }

      this.player.updateLook(this.input);
      const previousHotbarIndex = this.hotbar.selectedIndex;
      this.hotbar.update(this.input);
      if (this.hotbar.selectedIndex !== previousHotbarIndex) {
        this.audio.playHotbarSelect();
      }

      const wasGrounded = this.player.onGround;
      const impactVelocity = this.player.velocity.y;
      const maxStep = 1 / 90;
      const weatherMovementScale = this.weather.getMovementSpeedMultiplier();
      let remaining = dt;
      while (remaining > 0) {
        const step = Math.min(remaining, maxStep);
        this.player.updatePhysics(step, this.input, this.world, weatherMovementScale);
        remaining -= step;
      }
      this.movementAudio.updateMovement(dt, wasGrounded, impactVelocity);
      this.mobs.update(dt);

      this.interactions.updateTarget();
      this.interactions.update(dt, this.creativeMode);
    } else {
      this.interactions.clearTarget();
    }

    const horizSpeed = this.player.onGround
      ? Math.hypot(this.player.velocity.x, this.player.velocity.z)
      : 0;
    const activelyMining =
      this.input.isPointerLocked &&
      !this.inventoryModal.isOpen &&
      this.interactions.activelyMining;

    this.heldItemView.setEquipped(this.hotbar.selectedStack);
    this.heldItemView.update(dt, horizSpeed, activelyMining, this.player.crouching);

    this.drops.update(dt, this.world, this.player.position, this.inventory);
    this.dayNight.update(dt, this.player.position, this.weather.cloudCover);
    this.movementAudio.updateAmbience(dt, this.dayNight, this.weather.getAmbientState());
    this.atmosphere.update();
    this.world.updateStreaming(this.player.position.x, this.player.position.z);
    this.particles.update(dt);
    this.debugHud.update(
      dt,
      this.player,
      this.world,
      this.dayNight,
      this.weather,
      this.mobs,
      this.interactions.currentHit,
      this.seedLabel,
      this.creativeMode
    );
  }

  private toggleCreativeMode(): void {
    this.creativeMode = !this.creativeMode;
    this.audio.playModeToggle();
    if (this.creativeMode) {
      // Populate empty hotbar slots with the full creative building palette if empty
      for (let i = 0; i < HOTBAR_BLOCKS.length; i++) {
        if (!this.inventory.getSlot(i)) {
          this.inventory.setSlot(i, createStack(HOTBAR_BLOCKS[i] as number, 64));
        }
      }
    }
    this.overlay.updateStatus(this.creativeMode, this.player.flyMode);
  }

  private createSaveSnapshot(): GameSaveSnapshot {
    return {
      player: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        flyMode: this.player.flyMode,
      },
      inventory: this.inventory.snapshot(),
      selectedHotbar: this.hotbar.selectedIndex,
      creativeMode: this.creativeMode,
      timeOfDay: this.dayNight.timeOfDay,
      weather: this.weather.snapshot(),
      muted: this.audio.muted,
      worldEdits: this.world.exportEdits(),
    };
  }
}
