import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { Input } from '../core/Input';
import { type BiomeSize } from '../Biomes/BiomeSize';
import { WorldPersistence, WorldSummary } from '../persistence/WorldPersistence';
import {
  DEFAULT_WORLD_FEATURE_PROFILE,
  isMobPackEnabled,
  serializeWorldFeatureProfile,
  setMobPackEnabled,
  type WorldFeatureProfile,
} from '../features/WorldFeatureProfile';
import {
  BUILTIN_TEXTURE_PACKS,
  DEFAULT_TEXTURE_PACK_ID,
  resolveTexturePack,
  type TexturePackDescriptor,
} from '../rendering/textures/TexturePacks';
import {
  MAX_CHUNK_RENDER_DISTANCE,
  MIN_CHUNK_RENDER_DISTANCE,
  readSettings,
  updateSettings,
} from '../settings/GameSettings';
import { SliderControl } from './SliderControl';
import { InventoryModal } from './InventoryModal';

type RootMenu = 'title' | 'pause';
type MenuView = RootMenu | 'worlds' | 'create-world' | 'options' | 'controls';

interface GameOverlayDependencies {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  input: Input;
  audio: AudioManager;
  inventoryModal: InventoryModal;
  isGameplayModalOpen: () => boolean;
  currentWorld: WorldSummary;
  onAudioChanged: () => void;
  onRenderDistanceChanged: (distance: number) => void;
  onBeforeWorldSwitch: (saveCurrent: boolean) => void;
  onDeleteWorld: (world: WorldSummary) => void;
  onWorldStarted: () => void;
  onLoadingWorld?: (worldName: string) => void;
  texturePacks?: readonly TexturePackDescriptor[];
  activeTexturePackId?: string;
  onSelectTexturePack?: (packId: string) => Promise<string>;
  onQuit: (saveCurrent: boolean) => void;
}

const SPLASHES = [
  'Dig deeper!',
  'Mind the cree— wait, wrong cave!',
  'Now with weather!',
  'Crafted one voxel at a time!',
  'The caverns are calling!',
  'Shift happens!',
  'Bring a torch!',
];

/** Owns title/world/pause menus, pointer lock, resize, inventory, status, and options UI. */
export class GameOverlayController {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input: Input;
  private readonly audio: AudioManager;
  private readonly inventoryModal: InventoryModal;
  private readonly isGameplayModalOpen: () => boolean;
  private readonly currentWorld: WorldSummary;
  private readonly onAudioChanged: () => void;
  private readonly onRenderDistanceChanged: (distance: number) => void;
  private readonly onBeforeWorldSwitch: (saveCurrent: boolean) => void;
  private readonly onDeleteWorld: (world: WorldSummary) => void;
  private readonly onWorldStarted: () => void;
  private readonly onLoadingWorld?: (worldName: string) => void;
  private readonly texturePacks: readonly TexturePackDescriptor[];
  private readonly onSelectTexturePack?: (packId: string) => Promise<string>;
  private readonly onQuit: (saveCurrent: boolean) => void;
  private readonly overlayEl = document.getElementById('overlay')!;
  private readonly statusPillEl = document.getElementById('status-pill')!;
  private readonly audioToggleEl = document.getElementById('audio-toggle') as HTMLButtonElement;
  private readonly menuAudioEl = document.getElementById('menu-audio-button') as HTMLButtonElement;
  private readonly texturePackEl = document.getElementById('texture-pack-button') as HTMLButtonElement | null;
  private fovSlider!: SliderControl;
  private readonly fullscreenEl = document.getElementById('fullscreen-button') as HTMLButtonElement;
  private readonly worldListEl = document.getElementById('world-list')!;
  private readonly worldEmptyEl = document.getElementById('world-empty')!;
  private readonly worldPlayEl = document.getElementById('world-play-button') as HTMLButtonElement;
  private readonly worldDeleteEl = document.getElementById('world-delete-button') as HTMLButtonElement;
  private readonly worldNameEl = document.getElementById('world-name-input') as HTMLInputElement;
  private readonly worldSeedEl = document.getElementById('world-seed-input') as HTMLInputElement;
  private readonly worldDesertWildlifeEl = document.getElementById(
    'world-desert-wildlife-input'
  ) as HTMLInputElement;
  private worldBiomeSizeSlider!: SliderControl;
  private readonly menuEls: Record<MenuView, HTMLElement> = {
    title: document.getElementById('title-menu')!,
    worlds: document.getElementById('world-menu')!,
    'create-world': document.getElementById('create-world-menu')!,
    pause: document.getElementById('pause-menu')!,
    options: document.getElementById('options-menu')!,
    controls: document.getElementById('controls-menu')!,
  };

  private rootMenu: RootMenu = 'title';
  private activeMenu: MenuView = 'title';
  private controlsReturnMenu: MenuView = 'pause';
  private hasEnteredWorld = false;
  private deathScreenActive = false;
  private worlds: WorldSummary[] = [];
  private selectedWorldId: string | null = null;
  private resumeOnEscapeRelease = false;
  private activeTexturePackId: string;
  private switchingTexturePack = false;


  constructor(deps: GameOverlayDependencies) {
    this.renderer = deps.renderer;
    this.camera = deps.camera;
    this.input = deps.input;
    this.audio = deps.audio;
    this.inventoryModal = deps.inventoryModal;
    this.isGameplayModalOpen = deps.isGameplayModalOpen;
    this.currentWorld = deps.currentWorld;
    this.onAudioChanged = deps.onAudioChanged;
    this.onRenderDistanceChanged = deps.onRenderDistanceChanged;
    this.onBeforeWorldSwitch = deps.onBeforeWorldSwitch;
    this.onDeleteWorld = deps.onDeleteWorld;
    this.onWorldStarted = deps.onWorldStarted;
    this.onLoadingWorld = deps.onLoadingWorld;
    this.texturePacks = deps.texturePacks ?? BUILTIN_TEXTURE_PACKS;
    this.activeTexturePackId = resolveTexturePack(
      this.texturePacks,
      deps.activeTexturePackId ?? DEFAULT_TEXTURE_PACK_ID
    ).id;
    this.onSelectTexturePack = deps.onSelectTexturePack;
    this.onQuit = deps.onQuit;
    document.getElementById('menu-splash')!.textContent =
      SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    this.setupEvents();
    this.updateAudioToggle();
    this.updateTexturePackButton();
    this.updateFullscreenButton();
    this.mountSliders();
    this.showMenu('title');
  }

  /** Mounts the biome size, FOV, and volume sliders on the settings screens. */
  private mountSliders(): void {
    this.worldBiomeSizeSlider = SliderControl.mount(
      document.getElementById('world-biome-size-root')!,
      {
        min: 1,
        max: 3,
        step: 0.1,
        value: 2,
        label: 'Biome Size',
        endLabels: { min: 'Compact', max: 'Large' },
        snapTo: [1, 2, 3],
        snapTolerance: 0.3,
        onValueChange: () => {
          this.worldBiomeSizeSlider.setLabel(
            this.biomeSizeLabel(this.worldBiomeSizeSlider.value)
          );
        },
      }
    );
    this.worldBiomeSizeSlider.setLabel(this.biomeSizeLabel(2));

    this.fovSlider = SliderControl.mount(document.getElementById('fov-slider-root')!, {
      min: 50,
      max: 110,
      step: 5,
      value: 75,
      label: 'FOV: 75',
      onValueChange: (fov) => this.applyFov(fov),
    });

    let chunkRenderDistance = readSettings().chunkRenderDistance;
    SliderControl.mount(document.getElementById('chunk-render-distance-root')!, {
      min: MIN_CHUNK_RENDER_DISTANCE,
      max: MAX_CHUNK_RENDER_DISTANCE,
      step: 1,
      value: chunkRenderDistance,
      label: 'Render Distance',
      endLabels: {
        min: `${MIN_CHUNK_RENDER_DISTANCE} chunks`,
        max: `${MAX_CHUNK_RENDER_DISTANCE} chunks`,
      },
      onValueChange: (value) => {
        const nextDistance = Math.round(value);
        if (nextDistance === chunkRenderDistance) return;
        chunkRenderDistance = nextDistance;
        const settings = updateSettings({ chunkRenderDistance });
        this.onRenderDistanceChanged(settings.chunkRenderDistance);
      },
    });

    SliderControl.mount(document.getElementById('sfx-volume-root')!, {
      min: 0,
      max: 100,
      step: 5,
      value: this.audio.getSfxVolume(),
      label: `Sound Effects: ${Math.round(this.audio.getSfxVolume())}%`,
      onValueChange: (percent) => this.audio.setSfxVolume(percent),
    });
    SliderControl.mount(document.getElementById('ambient-volume-root')!, {
      min: 0,
      max: 100,
      step: 5,
      value: this.audio.getAmbienceVolume(),
      label: `Ambience: ${Math.round(this.audio.getAmbienceVolume())}%`,
      onValueChange: (percent) => this.audio.setAmbienceVolume(percent),
    });
  }

  private get biomeSize(): BiomeSize {
    const value = this.worldBiomeSizeSlider.value;
    return value < 1.5 ? 'compact' : value < 2.5 ? 'standard' : 'large';
  }

  private biomeSizeLabel(value: number): string {
    return value < 1.5 ? 'Compact' : value < 2.5 ? 'Standard' : 'Large';
  }

  private applyFov(fov: number): void {
    const rounded = Math.round(fov);
    this.camera.fov = rounded;
    this.camera.updateProjectionMatrix();
    this.fovSlider.setLabel(`FOV: ${rounded}`);
  }

  public openInventory(gridSize: 2 | 3): void {
    this.audio.playInventoryOpen();
    this.inventoryModal.open(gridSize);
    this.openGameplayModal();
  }

  public closeInventoryAndResume(): void {
    this.audio.playInventoryClose();
    this.inventoryModal.close();
    this.resumeGameplay();
  }

  public openGameplayModal(): void {
    this.hideMenus();
    this.input.exitPointerLock();
  }

  public resumeGameplay(): void {
    this.requestPlay();
  }

  public setDeathScreenActive(active: boolean): void {
    this.deathScreenActive = active;
    if (active) this.hideMenus();
  }

  public get isInWorld(): boolean {
    return this.hasEnteredWorld;
  }

  public returnToTitle(): void {
    this.hasEnteredWorld = false;
    this.audio.setWorldAudioActive(false);
    this.showMenu('title');
  }

  public updateStatus(creativeMode: boolean, flyMode: boolean): void {
    const gameMode = creativeMode ? 'Creative' : 'Survival';
    const movementMode = flyMode ? 'Fly' : 'Walk';
    this.statusPillEl.textContent =
      `${gameMode} (${movementMode}) · [E] Craft · [C] Mode · [F] Fly`;
  }

  public toggleAudio(): void {
    this.audio.unlock();
    this.audio.toggleMute();
    this.updateAudioToggle();
    this.onAudioChanged();
  }

  private setupEvents(): void {
    document.getElementById('singleplayer-button')!.addEventListener('click', () => {
      this.refreshWorldList();
      this.showMenu('worlds');
    });
    document.getElementById('world-cancel-button')!.addEventListener('click', () => this.showMenu('title'));
    document.getElementById('world-create-button')!.addEventListener('click', () => {
      this.worldNameEl.value = this.nextWorldName();
      this.worldSeedEl.value = '';
      this.worldBiomeSizeSlider.setValue(2);
      this.worldDesertWildlifeEl.checked = true;
      this.showMenu('create-world');
      this.worldNameEl.focus();
      this.worldNameEl.select();
    });
    document.getElementById('create-world-cancel')!.addEventListener('click', () => this.showMenu('worlds'));
    document.getElementById('create-world-confirm')!.addEventListener('click', () => this.createWorld());
    this.worldPlayEl.addEventListener('click', () => this.playSelectedWorld());
    this.worldDeleteEl.addEventListener('click', () => this.deleteSelectedWorld());

    document.getElementById('resume-button')!.addEventListener('click', () => this.requestPlay());
    document.getElementById('title-options-button')!.addEventListener('click', () => {
      this.rootMenu = 'title';
      this.showMenu('options');
    });
    document.getElementById('pause-options-button')!.addEventListener('click', () => {
      this.rootMenu = 'pause';
      this.showMenu('options');
    });
    document.getElementById('controls-button')!.addEventListener('click', () => {
      this.rootMenu = 'pause';
      this.controlsReturnMenu = 'pause';
      this.showMenu('controls');
    });
    document.getElementById('options-controls-button')!.addEventListener('click', () => {
      this.controlsReturnMenu = 'options';
      this.showMenu('controls');
    });
    document.getElementById('options-done-button')!.addEventListener('click', () => this.showMenu(this.rootMenu));
    document.getElementById('controls-done-button')!.addEventListener('click', () => {
      this.showMenu(this.controlsReturnMenu);
    });

    document.getElementById('save-now')!.addEventListener('click', () => {
      this.returnToTitle();
    });
    document.getElementById('quit-game-button')!.addEventListener('click', () => {
      this.onQuit(this.hasEnteredWorld || this.currentWorld.savedAt > 0);
    });

    this.audioToggleEl.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleAudio();
    });
    this.menuAudioEl.addEventListener('click', () => this.toggleAudio());
    this.texturePackEl?.addEventListener('click', () => void this.cycleTexturePack());
    this.fullscreenEl.addEventListener('click', () => void this.toggleFullscreen());

    this.overlayEl.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('button')) {
        this.audio.unlock();
        this.audio.playUiClick();
      }
    });

    document.getElementById('inventory-modal')!.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('#craft-output-slot')) this.audio.playCraft();
      else if (target.closest('button, .inv-slot')) this.audio.playUiClick();
    });
    document.getElementById('furnace-modal')!.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('button, .inv-slot')) this.audio.playUiClick();
    });

    this.input.onPointerLockChange((locked) => {
      if (locked) this.hideMenus();
      else if (!this.isGameplayModalOpen() && !this.deathScreenActive) {
        this.showMenu(this.hasEnteredWorld ? 'pause' : 'title');
      }
    });

    window.addEventListener('keydown', (event) => this.handleMenuKey(event));
    window.addEventListener('keyup', (event) => {
      if (event.code !== 'Escape' || !this.resumeOnEscapeRelease) return;
      this.resumeOnEscapeRelease = false;
      this.requestPlay();
    });
    document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
    const syncViewportSize = (): void => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / Math.max(1, height);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };
    window.addEventListener('resize', syncViewportSize);
    window.addEventListener('orientationchange', () => setTimeout(syncViewportSize, 80));
    window.visualViewport?.addEventListener('resize', syncViewportSize);
  }

  private handleMenuKey(event: KeyboardEvent): void {
    if (this.overlayEl.classList.contains('hidden')) return;
    if (event.code === 'Enter' && this.activeMenu === 'create-world') {
      event.preventDefault();
      this.createWorld();
      return;
    }
    if (event.code !== 'Escape') return;
    event.preventDefault();
    if (this.activeMenu === 'worlds') this.showMenu('title');
    else if (this.activeMenu === 'create-world') this.showMenu('worlds');
    else if (this.activeMenu === 'options') this.showMenu(this.rootMenu);
    else if (this.activeMenu === 'controls') this.showMenu(this.controlsReturnMenu);
    else if (this.activeMenu === 'pause' && !event.repeat) {
      // Reacquiring pointer lock while Escape is still held immediately releases it again
      // in some browsers. Resume only after the key that opened/closed the menu is released.
      this.resumeOnEscapeRelease = true;
    }
  }

  private refreshWorldList(): void {
    this.worlds = WorldPersistence.listWorlds();
    const currentExists = this.worlds.some((world) => world.worldId === this.currentWorld.worldId);
    if (!currentExists) this.worlds.unshift(this.currentWorld);
    if (!this.worlds.some((world) => world.worldId === this.selectedWorldId)) {
      this.selectedWorldId =
        this.worlds.find((world) => world.worldId === this.currentWorld.worldId)?.worldId ??
        this.worlds[0]?.worldId ??
        null;
    }

    this.worldListEl.replaceChildren();
    for (const world of this.worlds) {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'world-entry';
      entry.classList.toggle('selected', world.worldId === this.selectedWorldId);
      entry.dataset.worldId = world.worldId;
      entry.setAttribute('role', 'option');
      entry.setAttribute('aria-selected', String(world.worldId === this.selectedWorldId));

      const icon = document.createElement('span');
      icon.className = 'world-icon';
      icon.textContent = '◆';
      const details = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'world-name';
      name.textContent = world.worldName;
      const meta = document.createElement('span');
      meta.className = 'world-meta';
      const date = world.savedAt > 0 ? new Date(world.savedAt).toLocaleString() : 'Not saved yet';
      const biomeSize = world.biomeSize[0].toUpperCase() + world.biomeSize.slice(1);
      const wildlife = isMobPackEnabled(world.featureProfile, 'desert-wildlife')
        ? 'Desert wildlife on'
        : 'Desert wildlife off';
      meta.textContent = `${date} · Seed: ${world.seed} · ${biomeSize} biomes · ${wildlife} · ${world.editCount} edits`;
      details.append(name, document.createElement('br'), meta);
      entry.append(icon, details);
      entry.addEventListener('click', () => {
        this.selectedWorldId = world.worldId;
        this.updateWorldSelection();
      });
      entry.addEventListener('dblclick', () => this.playSelectedWorld());
      this.worldListEl.append(entry);
    }

    const empty = this.worlds.length === 0;
    this.worldEmptyEl.classList.toggle('hidden', !empty);
    this.worldListEl.classList.toggle('hidden', empty);
    this.worldPlayEl.disabled = empty;
    this.worldDeleteEl.disabled = empty;
    this.updateWorldSelection();
  }

  private updateWorldSelection(): void {
    for (const entry of this.worldListEl.querySelectorAll<HTMLElement>('.world-entry')) {
      const selected = entry.dataset.worldId === this.selectedWorldId;
      entry.classList.toggle('selected', selected);
      entry.setAttribute('aria-selected', String(selected));
    }
  }

  private playSelectedWorld(): void {
    const selected = this.worlds.find((world) => world.worldId === this.selectedWorldId);
    if (!selected) return;
    if (selected.worldId === this.currentWorld.worldId) {
      this.requestPlay();
      return;
    }
    this.openWorld(selected.worldId, selected.worldName, selected.seed, selected.biomeSize);
  }

  private createWorld(): void {
    const worldName = this.worldNameEl.value.trim().slice(0, 48) || 'New World';
    const seed = this.worldSeedEl.value.trim().slice(0, 64) || this.randomSeed();
    const worldId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const biomeSize = this.biomeSize;
    const featureProfile = setMobPackEnabled(
      DEFAULT_WORLD_FEATURE_PROFILE,
      'desert-wildlife',
      this.worldDesertWildlifeEl.checked
    );
    this.openWorld(worldId, worldName, seed, biomeSize, featureProfile);
  }

  private deleteSelectedWorld(): void {
    const selected = this.worlds.find((world) => world.worldId === this.selectedWorldId);
    if (!selected) return;
    if (!window.confirm(`Delete “${selected.worldName}” forever? This cannot be undone.`)) return;
    this.onDeleteWorld(selected);
    if (selected.worldId !== this.currentWorld.worldId) {
      this.selectedWorldId = null;
      this.refreshWorldList();
    }
  }

  private openWorld(
    worldId: string,
    worldName: string,
    seed: string,
    biomeSize: BiomeSize,
    featureProfile?: WorldFeatureProfile
  ): void {
    this.audio.setWorldAudioActive(false);
    this.onLoadingWorld?.(worldName);
    this.onBeforeWorldSwitch(this.hasEnteredWorld || this.currentWorld.savedAt > 0);
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('world', worldId);
    url.searchParams.set('name', worldName);
    url.searchParams.set('seed', seed);
    url.searchParams.set('biomeSize', biomeSize);
    if (featureProfile) {
      url.searchParams.set('mobPacks', serializeWorldFeatureProfile(featureProfile));
    }
    window.location.href = url.toString();
  }

  private nextWorldName(): string {
    const names = new Set(WorldPersistence.listWorlds().map((world) => world.worldName));
    let index = 1;
    let candidate = 'New World';
    while (names.has(candidate)) candidate = `New World (${++index})`;
    return candidate;
  }

  private randomSeed(): string {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${values[0].toString(36)}${values[1].toString(36)}`;
  }

  private requestPlay(): void {
    this.resumeOnEscapeRelease = false;
    this.audio.unlock();
    this.audio.setWorldAudioActive(true);
    this.hasEnteredWorld = true;
    this.onWorldStarted();
    if (this.inventoryModal.isOpen) this.inventoryModal.close();
    this.input.requestPointerLock();
  }

  private showMenu(menu: MenuView): void {
    this.activeMenu = menu;
    for (const [name, element] of Object.entries(this.menuEls)) {
      element.classList.toggle('hidden', name !== menu);
    }
    this.overlayEl.classList.remove('hidden', 'mode-title', 'mode-pause', 'mode-create-world');
    const titleMode =
      menu === 'title' ||
      menu === 'worlds' ||
      menu === 'create-world' ||
      ((menu === 'options' || menu === 'controls') && this.rootMenu === 'title');
    this.overlayEl.classList.add(titleMode ? 'mode-title' : 'mode-pause');
    if (menu === 'create-world') this.overlayEl.classList.add('mode-create-world');
    document.body.classList.add('menu-open');
    document.body.classList.toggle('title-menu', titleMode);
  }

  private hideMenus(): void {
    this.overlayEl.classList.add('hidden');
    document.body.classList.remove('menu-open', 'title-menu');
  }

  private updateAudioToggle(): void {
    const enabled = !this.audio.muted;
    this.audioToggleEl.textContent = enabled ? '🔊 Sound On [M]' : '🔇 Sound Off [M]';
    this.audioToggleEl.classList.toggle('muted', !enabled);
    this.menuAudioEl.textContent = `Sound: ${enabled ? 'On' : 'Off'}`;
  }

  private async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }

  private updateFullscreenButton(): void {
    this.fullscreenEl.textContent = `Fullscreen: ${document.fullscreenElement ? 'On' : 'Off'}`;
  }

  private async cycleTexturePack(): Promise<void> {
    if (this.switchingTexturePack || this.texturePacks.length <= 1 || !this.onSelectTexturePack) {
      return;
    }
    const currentIndex = this.texturePacks.findIndex((pack) => pack.id === this.activeTexturePackId);
    const nextPack = this.texturePacks[(currentIndex + 1) % this.texturePacks.length];
    this.switchingTexturePack = true;
    this.updateTexturePackButton(nextPack.name);
    try {
      this.activeTexturePackId = await this.onSelectTexturePack(nextPack.id);
    } finally {
      this.switchingTexturePack = false;
      this.updateTexturePackButton();
    }
  }

  private updateTexturePackButton(loadingName?: string): void {
    if (!this.texturePackEl) return;
    if (loadingName) {
      this.texturePackEl.textContent = `Texture Pack: ${loadingName}...`;
      this.texturePackEl.disabled = true;
      return;
    }
    const active = resolveTexturePack(this.texturePacks, this.activeTexturePackId);
    this.texturePackEl.textContent = `Texture Pack: ${active.name}`;
    this.texturePackEl.title = active.description ?? '';
    this.texturePackEl.disabled = this.texturePacks.length <= 1;
  }
}
