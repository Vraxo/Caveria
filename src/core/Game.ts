import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { CamelRidingController } from '../DesertWildlife/CamelRidingController';
import { createDesertWildlife } from '../DesertWildlife/createDesertWildlife';
import { ArrowProjectileManager } from '../gameplay/ArrowProjectileManager';
import { BedManager } from '../gameplay/BedManager';
import { BlockInteractionController } from '../gameplay/BlockInteractionController';
import { ChestManager } from '../gameplay/ChestManager';
import { createSurvivalConsumableRegistry } from '../gameplay/ConsumableActionRegistry';
import { FarmingManager } from '../gameplay/FarmingManager';
import { FurnaceManager } from '../gameplay/FurnaceManager';
import { FishingManager } from '../gameplay/FishingManager';
import { MovementAudioController } from '../gameplay/MovementAudioController';
import { StatusEffectManager } from '../gameplay/StatusEffectManager';
import { TemperatureSystem } from '../gameplay/TemperatureSystem';
import { WaterSurvivalSystem } from '../gameplay/WaterSurvivalSystem';
import { createDefaultUseRegistry } from '../gameplay/interactions/DefaultUseHandlers';
import { createDefaultBlockBehaviorRegistries } from '../gameplay/interactions/DefaultBlockBehaviors';
import { MobManager } from '../entities/MobManager';
import { CaveCrawlerSpecies } from '../entities/CaveCrawlerSpecies';
import { createChickenSpecies } from '../entities/ChickenSpecies';
import { CrystalMiteSpecies } from '../entities/CrystalMiteSpecies';
import { createRabbitSpecies } from '../entities/RabbitSpecies';
import { createSheepSpecies } from '../entities/SheepSpecies';
import { Inventory } from '../items/Inventory';
import { ItemId, createStack } from '../items/Item';
import { Player } from '../player/Player';
import { ArmorManager } from '../player/ArmorManager';
import { PlayerVitals } from '../player/PlayerVitals';
import {
  GAME_SAVE_SNAPSHOT_KEYS,
  GamePersistenceController,
  type GameSaveSnapshot,
} from '../persistence/GamePersistenceController';
import { WorldPersistence } from '../persistence/WorldPersistence';
import { AtmosphereController } from '../rendering/AtmosphereController';
import { BreakParticles } from '../rendering/BreakParticles';
import { CampfireEffects } from '../rendering/CampfireEffects';
import { DayNightCycle } from '../rendering/DayNightCycle';
import { DroppedItemManager } from '../rendering/DroppedItems';
import { HeldItemView } from '../rendering/HeldItemView';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { WeatherSystem } from '../rendering/WeatherSystem';
import { ChestModal } from '../ui/ChestModal';
import { DebugHud } from '../ui/DebugHud';
import { FurnaceModal } from '../ui/FurnaceModal';
import { GameOverlayController } from '../ui/GameOverlayController';
import { Hotbar } from '../ui/Hotbar';
import { InventoryModal } from '../ui/InventoryModal';
import { HOTBAR_BLOCKS } from '../gameplay/CreativePalette';
import { CHUNK_SIZE } from '../world/Chunk';
import { hashString } from '../world/Noise';
import { World } from '../world/World';
import { GameFeatureRegistry } from './GameFeatureRegistry';
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
  private readonly camelRiding: CamelRidingController;
  private readonly vitals: PlayerVitals;
  private readonly armor: ArmorManager;
  private readonly temperature: TemperatureSystem;
  private readonly statusEffects: StatusEffectManager;
  private readonly waterSurvival: WaterSurvivalSystem;
  private readonly particles: BreakParticles;
  private readonly campfireEffects: CampfireEffects;
  private readonly drops: DroppedItemManager;
  private readonly mobs: MobManager;
  private readonly arrows: ArrowProjectileManager;
  private readonly fishing: FishingManager;
  private readonly beds: BedManager;
  private readonly chests: ChestManager;
  private readonly farms: FarmingManager;
  private readonly furnaces: FurnaceManager;
  private readonly heldItemView: HeldItemView;
  private readonly audio: AudioManager;
  private readonly interactions: BlockInteractionController;
  private readonly movementAudio: MovementAudioController;
  private readonly atmosphere: AtmosphereController;
  private readonly weather: WeatherSystem;
  private readonly persistence: GamePersistenceController;
  private readonly features = new GameFeatureRegistry<GameSaveSnapshot>(
    GAME_SAVE_SNAPSHOT_KEYS
  );

  private readonly inventory: Inventory;
  private readonly hotbar: Hotbar;
  private readonly inventoryModal: InventoryModal;
  private readonly furnaceModal: FurnaceModal;
  private readonly chestModal: ChestModal;
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
    this.camelRiding = new CamelRidingController(this.player, this.world);
    this.audio = new AudioManager();
    if (savedGame) this.audio.setMuted(savedGame.muted);
    this.weather = new WeatherSystem(this.scene, this.world, this.player, this.audio);
    if (savedGame) this.weather.restore(savedGame.weather);
    this.particles = new BreakParticles(this.scene);
    this.campfireEffects = new CampfireEffects(this.scene, this.world, this.player);
    this.drops = new DroppedItemManager(this.scene, this.atlas, (itemId) => {
      if (itemId === ItemId.AmethystShard) this.audio.playCrystalPickup();
      else this.audio.playPickup();
    });
    this.furnaces = new FurnaceManager(
      this.world,
      this.audio,
      this.weather,
      savedGame?.furnaces,
      (x, y, z, stack) => this.drops.spawnDrop(x, y, z, stack)
    );
    this.chests = new ChestManager(
      this.world,
      savedGame?.chests,
      (x, y, z, stack) => this.drops.spawnDrop(x, y, z, stack)
    );
    this.vitals = new PlayerVitals(
      () => {
        this.camelRiding.dismount();
        this.interactions.clearTarget();
        this.overlay.setDeathScreenActive(true);
        this.input.exitPointerLock();
      },
      () => {
        this.camelRiding.dismount();
        const respawn = this.findRespawnPoint();
        this.player.restoreTransform(respawn, 0, 0);
        this.overlay.setDeathScreenActive(false);
        this.input.requestPointerLock();
      },
      () => {
        this.camelRiding.dismount();
        const respawn = this.findRespawnPoint();
        this.player.restoreTransform(respawn, 0, 0);
        this.persistence.save(false);
        this.overlay.setDeathScreenActive(false);
        this.overlay.returnToTitle();
      }
    );
    this.vitals.restore(
      savedGame?.player.health,
      savedGame?.player.hunger,
      savedGame?.player.saturation
    );
    this.armor = new ArmorManager(
      savedGame?.armor,
      () => this.audio.playArmorEquip(),
      () => this.audio.playToolBreak()
    );
    this.vitals.attachArmor(this.armor);
    this.temperature = new TemperatureSystem(
      this.world,
      this.player,
      this.dayNight,
      this.weather,
      this.armor,
      this.vitals,
      this.audio,
      savedGame?.temperature
    );
    this.statusEffects = new StatusEffectManager(
      this.world,
      this.player,
      this.vitals,
      this.temperature,
      this.audio,
      savedGame?.statusEffects
    );
    this.waterSurvival = new WaterSurvivalSystem(
      this.world,
      this.weather,
      this.statusEffects,
      this.audio
    );
    const crystalMiteSpecies = new CrystalMiteSpecies(
      this.scene,
      this.world,
      this.player,
      this.drops,
      this.particles,
      this.audio
    );
    const caveCrawlerSpecies = new CaveCrawlerSpecies(
      this.scene,
      this.world,
      this.player,
      this.vitals,
      this.drops,
      this.particles,
      this.audio,
      () => this.statusEffects.poison(18)
    );
    const chickenSpecies = createChickenSpecies(
      this.scene,
      this.world,
      this.player,
      this.drops,
      this.particles,
      this.audio
    );
    const sheepSpecies = createSheepSpecies(
      this.scene,
      this.world,
      this.player,
      this.drops,
      this.particles,
      this.audio
    );
    const rabbitSpecies = createRabbitSpecies(
      this.scene,
      this.world,
      this.player,
      this.drops,
      this.particles,
      this.audio
    );
    const desertWildlife = createDesertWildlife({
      scene: this.scene,
      world: this.world,
      player: this.player,
      vitals: this.vitals,
      drops: this.drops,
      particles: this.particles,
      audio: this.audio,
      camelRiding: this.camelRiding,
      poisonPlayer: () => this.statusEffects.poison(18),
    });
    this.mobs = new MobManager([
      crystalMiteSpecies,
      caveCrawlerSpecies,
      chickenSpecies,
      sheepSpecies,
      rabbitSpecies,
      ...desertWildlife,
    ]);
    this.mobs.restore(savedGame?.mobs ?? []);
    this.arrows = new ArrowProjectileManager(
      this.scene,
      this.world,
      this.mobs,
      this.drops,
      this.audio
    );
    this.beds = new BedManager(
      this.world,
      this.player,
      this.dayNight,
      this.weather,
      (position, radius) => this.mobs.hasWithin(position, radius, 'blocks-sleep'),
      this.audio,
      savedGame?.beds,
      savedGame?.respawnBed,
      (x, y, z, stack) => this.drops.spawnDrop(x, y, z, stack),
      () => this.temperature.recoverAfterSleep()
    );
    this.farms = new FarmingManager(
      this.world,
      this.player,
      this.weather,
      this.audio,
      savedGame?.farms,
      (x, y, z, stack) => this.drops.spawnDrop(x, y, z, stack)
    );
    this.heldItemView = new HeldItemView(this.camera, this.atlas);

    this.inventory = new Inventory();
    if (savedGame) this.inventory.restore(savedGame.inventory);
    this.hotbar = new Hotbar(this.inventory, this.atlas);
    this.fishing = new FishingManager(this.scene, this.world, this.player, this.audio);
    if (savedGame) {
      this.hotbar.selectIndex(savedGame.selectedHotbar);
      this.creativeMode = savedGame.creativeMode;
    }
    const consumables = createSurvivalConsumableRegistry(
      this.statusEffects,
      this.vitals,
      this.audio
    );
    const blockBehaviors = createDefaultBlockBehaviorRegistries({
      onOpenWorkbench: () => this.openInventoryScreen(3),
      onOpenFurnace: (x, y, z) => this.openFurnaceScreen(x, y, z),
      onOpenChest: (x, y, z) => this.openChestScreen(x, y, z),
      onUseBed: (x, y, z) => this.beds.use(x, y, z),
      onFurnaceBroken: (x, y, z) => this.furnaces.breakAt(x, y, z),
      onChestBroken: (x, y, z) => this.breakChestAt(x, y, z),
      onBedBroken: (x, y, z, drop) => this.beds.breakAt(x, y, z, drop),
      onFarmBroken: (x, y, z, drop) => this.farms.breakAt(x, y, z, drop),
      onDisturbedShroom: () => {
        if (Math.random() < 0.24) this.statusEffects.poison(14);
      },
    });
    const useRegistry = createDefaultUseRegistry({
      player: this.player,
      vitals: this.vitals,
      audio: this.audio,
      fishing: this.fishing,
      waterSurvival: this.waterSurvival,
      consumables,
      blockUse: blockBehaviors.use,
      onUseFarm: (x, y, z, held) => this.farms.use(x, y, z, held),
    });
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
      vitals: this.vitals,
      arrows: this.arrows,
      useRegistry,
      blockBreakRegistry: blockBehaviors.break,
      blockSupportRegistry: blockBehaviors.support,
      onWaterTarget: (hit) => this.waterSurvival.updateTarget(hit),
      onPlaceBed: (x, y, z) => this.beds.place(x, y, z),
      getMiningSpeedMultiplier: () => this.statusEffects.miningMultiplier,
    });
    this.inventoryModal = new InventoryModal(
      this.inventory,
      this.atlas,
      this.armor,
      (overflow) => this.interactions.tossStackFromPlayer(overflow),
      () => this.closeInventoryAndResume()
    );
    this.furnaceModal = new FurnaceModal(
      this.inventory,
      this.atlas,
      this.furnaces,
      (overflow) => this.interactions.tossStackFromPlayer(overflow),
      () => this.closeFurnaceAndResume()
    );
    this.chestModal = new ChestModal(
      this.inventory,
      this.atlas,
      this.chests,
      (overflow) => this.interactions.tossStackFromPlayer(overflow),
      () => this.closeChestAndResume()
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
      isGameplayModalOpen: () =>
        this.inventoryModal.isOpen || this.furnaceModal.isOpen || this.chestModal.isOpen,
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
    this.registerFeatureParticipants();
    this.persistence.bind(() => this.createSaveSnapshot());
    this.overlay.updateStatus(this.creativeMode, this.player.flyMode);
    if (savedGame) this.persistence.showRestored(this.world.editCount);
  }

  public start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((now) => this.loop(now));
  }

  /** Registration order preserves the former frame order within each explicit phase. */
  private registerFeatureParticipants(): void {
    this.features
      .register({
        id: 'persistence',
        updates: { 'frame-start': (dt) => this.persistence.update(dt) },
      })
      .register({
        id: 'weather',
        updates: { 'frame-start': (dt) => this.weather.update(dt) },
        snapshot: () => ({ weather: this.weather.snapshot() }),
      })
      .register({
        id: 'campfire-effects',
        updates: { 'frame-start': (dt) => this.campfireEffects.update(dt) },
      })
      .register({
        id: 'beds',
        updates: { 'frame-start': (dt) => this.beds.update(dt) },
        snapshot: () => ({
          beds: this.beds.snapshots(),
          respawnBed: this.beds.respawnSnapshot(),
        }),
      })
      .register({
        id: 'farms',
        updates: { 'frame-start': (dt) => this.farms.update(dt) },
        snapshot: () => ({ farms: this.farms.snapshots() }),
      })
      .register({
        id: 'furnaces',
        updates: { 'frame-start': (dt) => this.furnaces.update(dt) },
        snapshot: () => ({ furnaces: this.furnaces.snapshot() }),
      })
      .register({
        id: 'furnace-ui',
        updates: { 'frame-start': (dt) => this.furnaceModal.update(dt) },
      })
      .register({
        id: 'fishing',
        updates: {
          'frame-start': (dt) => this.fishing.update(dt,
            this.input.isPointerLocked
              && !this.inventoryModal.isOpen
              && !this.furnaceModal.isOpen
              && !this.chestModal.isOpen
              && this.hotbar.selectedStack?.id === ItemId.FishingRod
              && !this.vitals.dead),
        },
      })
      .register({
        id: 'survival-status',
        updates: {
          'before-player': (dt) => {
            this.statusEffects.update(dt, this.creativeMode);
            this.camera.rotation.z = this.statusEffects.cameraSway;
            this.temperature.update(dt, this.creativeMode);
          },
        },
        snapshot: () => ({
          armor: this.armor.snapshot(),
          temperature: this.temperature.temperature,
          statusEffects: this.statusEffects.snapshots(),
        }),
      })
      .register({
        id: 'vitals',
        updates: {
          'after-player': (dt) => this.vitals.update(
            dt,
            this.player.isHeadUnderwater(this.world),
            this.creativeMode
          ),
        },
      })
      .register({
        id: 'mobs',
        updates: { 'after-player': (dt) => this.mobs.update(dt) },
        snapshot: () => ({ mobs: this.mobs.snapshots() }),
      })
      .register({
        id: 'arrows',
        updates: { 'after-player': (dt) => this.arrows.update(dt) },
      })
      .register({
        id: 'drops',
        updates: {
          'frame-end': (dt) => this.drops.update(
            dt,
            this.world,
            this.player.position,
            this.inventory
          ),
        },
      })
      .register({
        id: 'day-night',
        updates: {
          'frame-end': (dt) => this.dayNight.update(
            dt,
            this.player.position,
            this.weather.cloudCover
          ),
        },
        snapshot: () => ({ timeOfDay: this.dayNight.timeOfDay }),
      })
      .register({
        id: 'ambient-audio',
        updates: {
          'frame-end': (dt) => this.movementAudio.updateAmbience(
            dt,
            this.dayNight,
            this.weather.getAmbientState()
          ),
        },
      })
      .register({
        id: 'atmosphere',
        updates: { 'frame-end': () => this.atmosphere.update() },
      })
      .register({
        id: 'world-streaming',
        updates: {
          'frame-end': () => this.world.updateStreaming(
            this.player.position.x,
            this.player.position.z
          ),
        },
        snapshot: () => ({ worldEdits: this.world.exportEdits() }),
      })
      .register({
        id: 'particles',
        updates: { 'frame-end': (dt) => this.particles.update(dt) },
      })
      .register({
        id: 'chests',
        snapshot: () => ({ chests: this.chests.snapshots() }),
      })
      .register({
        id: 'audio-preferences',
        snapshot: () => ({ muted: this.audio.muted }),
      });
  }

  private openInventoryScreen(gridSize: 2 | 3): void {
    this.interactions.clearTarget();
    this.overlay.openInventory(gridSize);
  }

  private closeInventoryAndResume(): void {
    this.overlay.closeInventoryAndResume();
  }

  private openFurnaceScreen(x: number, y: number, z: number): void {
    this.interactions.clearTarget();
    this.audio.playInventoryOpen();
    this.furnaceModal.open(x, y, z);
    this.overlay.openGameplayModal();
  }

  private closeFurnaceAndResume(): void {
    this.audio.playInventoryClose();
    this.furnaceModal.close();
    this.overlay.resumeGameplay();
  }

  private openChestScreen(x: number, y: number, z: number): void {
    this.interactions.clearTarget();
    if (!this.chestModal.open(x, y, z)) return;
    this.audio.playChestOpen();
    this.overlay.openGameplayModal();
  }

  private closeChestAndResume(): void {
    this.audio.playChestClose();
    this.chestModal.close();
    this.overlay.resumeGameplay();
  }

  private breakChestAt(x: number, y: number, z: number): void {
    if (this.chestModal.isOpenAt(x, y, z)) this.closeChestAndResume();
    this.chests.breakAt(x, y, z);
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
    this.features.update('frame-start', dt);

    if (this.input.consumeKeyPress('KeyM')) {
      this.overlay.toggleAudio();
    }

    if (this.input.consumeKeyPress('F3')) {
      this.debugHud.toggle();
    }

    // Toggle workstation/inventory screens with [E] or close with [Escape].
    if (this.inventoryModal.isOpen || this.furnaceModal.isOpen || this.chestModal.isOpen) {
      if (this.input.consumeKeyPress('KeyE') || this.input.consumeKeyPress('Escape')) {
        if (this.furnaceModal.isOpen) this.closeFurnaceAndResume();
        else if (this.chestModal.isOpen) this.closeChestAndResume();
        else this.closeInventoryAndResume();
      }
    } else if (this.input.isPointerLocked && this.input.consumeKeyPress('KeyE')) {
      this.openInventoryScreen(2);
    }

    if (
      this.input.isPointerLocked &&
      !this.inventoryModal.isOpen &&
      !this.furnaceModal.isOpen &&
      !this.chestModal.isOpen
    ) {
      if (!this.camelRiding.isRiding && this.input.consumeKeyPress('KeyF')) {
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
      const startX = this.player.position.x;
      const startZ = this.player.position.z;
      const swimming = this.player.isInWater(this.world);
      const wantsToSprint =
        this.input.isKeyDown('ControlLeft') || this.input.isKeyDown('ControlRight');
      const sprinting =
        !this.creativeMode && this.vitals.canSprint && !this.player.crouching && wantsToSprint;
      const maxStep = 1 / 90;
      this.features.update('before-player', dt);
      const weatherMovementScale = this.weather.getMovementSpeedMultiplier(
        this.armor.hasFullGoldSet
      ) * this.temperature.movementMultiplier * this.statusEffects.movementMultiplier;
      let remaining = dt;
      while (remaining > 0) {
        const step = Math.min(remaining, maxStep);
        if (!this.camelRiding.update(step, this.input)) {
          this.player.updatePhysics(
            step,
            this.input,
            this.world,
            weatherMovementScale,
            this.creativeMode || this.vitals.canSprint
          );
        }
        remaining -= step;
      }
      this.movementAudio.updateMovement(dt, wasGrounded, impactVelocity);
      if (!this.camelRiding.isRiding && !wasGrounded && this.player.onGround) {
        this.vitals.applyFallDamage(impactVelocity);
      }
      if (!this.creativeMode && !this.camelRiding.isRiding) {
        const traveled = Math.hypot(this.player.position.x - startX, this.player.position.z - startZ);
        this.vitals.addMovementExhaustion(traveled, sprinting, swimming);
        if (wasGrounded && !this.player.onGround && this.input.isKeyDown('Space')) {
          this.vitals.addExhaustion(sprinting ? 0.2 : 0.08);
        }
      }
      this.features.update('after-player', dt);

      if (this.vitals.dead) {
        this.interactions.clearTarget();
      } else {
        this.interactions.updateTarget();
        this.interactions.update(dt, this.creativeMode);
      }
    } else {
      this.camera.rotation.z = 0;
      this.interactions.clearTarget();
    }

    const horizSpeed = this.player.onGround
      ? Math.hypot(this.player.velocity.x, this.player.velocity.z)
      : 0;
    const activelyMining =
      this.input.isPointerLocked &&
      !this.inventoryModal.isOpen &&
      !this.furnaceModal.isOpen &&
      !this.chestModal.isOpen &&
      this.interactions.activelyMining;

    this.heldItemView.setEquipped(this.hotbar.selectedStack);
    this.heldItemView.update(dt, horizSpeed, activelyMining, this.player.crouching);

    this.features.update('frame-end', dt);
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

  private findRespawnPoint(): THREE.Vector3 {
    const bedLocation = this.beds.getRespawnBedLocation();
    if (bedLocation) this.world.generateInitialArea(bedLocation.x, bedLocation.z, 2);
    const bedRespawn = this.beds.getRespawnPoint();
    if (bedRespawn) return bedRespawn;
    const worldSpawn = this.world.findSpawnPoint();
    this.world.generateInitialArea(worldSpawn.x, worldSpawn.z, 2);
    return worldSpawn;
  }

  private createSaveSnapshot(): GameSaveSnapshot {
    return this.features.capture({
      player: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        flyMode: this.player.flyMode,
        health: this.vitals.health,
        hunger: this.vitals.hunger,
        saturation: this.vitals.saturation,
      },
      inventory: this.inventory.snapshot(),
      selectedHotbar: this.hotbar.selectedIndex,
      creativeMode: this.creativeMode,
    });
  }
}
