import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { Input } from '../core/Input';
import { InventoryModal } from './InventoryModal';

type RootMenu = 'title' | 'pause';
type MenuView = RootMenu | 'options' | 'controls';

interface GameOverlayDependencies {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  input: Input;
  audio: AudioManager;
  inventoryModal: InventoryModal;
  hasSavedWorld: boolean;
  onAudioChanged: () => void;
  onQuit: () => void;
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

/** Owns title/pause menus, pointer lock, resize, inventory, status, and options UI. */
export class GameOverlayController {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input: Input;
  private readonly audio: AudioManager;
  private readonly inventoryModal: InventoryModal;
  private readonly onAudioChanged: () => void;
  private readonly onQuit: () => void;
  private readonly overlayEl = document.getElementById('overlay')!;
  private readonly statusPillEl = document.getElementById('status-pill')!;
  private readonly audioToggleEl = document.getElementById('audio-toggle') as HTMLButtonElement;
  private readonly menuAudioEl = document.getElementById('menu-audio-button') as HTMLButtonElement;
  private readonly fovEl = document.getElementById('fov-button') as HTMLButtonElement;
  private readonly fullscreenEl = document.getElementById('fullscreen-button') as HTMLButtonElement;
  private readonly playEl = document.getElementById('play-button') as HTMLButtonElement;
  private readonly menuEls: Record<MenuView, HTMLElement> = {
    title: document.getElementById('title-menu')!,
    pause: document.getElementById('pause-menu')!,
    options: document.getElementById('options-menu')!,
    controls: document.getElementById('controls-menu')!,
  };

  private rootMenu: RootMenu = 'title';
  private activeMenu: MenuView = 'title';
  private controlsReturnMenu: MenuView = 'pause';
  private hasEnteredWorld = false;
  private readonly fovValues = [60, 75, 90];
  private fovIndex = 1;

  constructor(deps: GameOverlayDependencies) {
    this.renderer = deps.renderer;
    this.camera = deps.camera;
    this.input = deps.input;
    this.audio = deps.audio;
    this.inventoryModal = deps.inventoryModal;
    this.onAudioChanged = deps.onAudioChanged;
    this.onQuit = deps.onQuit;
    this.playEl.textContent = deps.hasSavedWorld ? 'Continue World' : 'Play World';
    document.getElementById('menu-splash')!.textContent =
      SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    this.setupEvents();
    this.updateAudioToggle();
    this.updateFullscreenButton();
    this.showMenu('title');
  }

  public openInventory(gridSize: 2 | 3): void {
    this.audio.playInventoryOpen();
    this.inventoryModal.open(gridSize);
    this.hideMenus();
    this.input.exitPointerLock();
  }

  public closeInventoryAndResume(): void {
    this.audio.playInventoryClose();
    this.inventoryModal.close();
    this.requestPlay();
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
    this.playEl.addEventListener('click', () => this.requestPlay());
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
    document.getElementById('options-done-button')!.addEventListener('click', () => {
      this.showMenu(this.rootMenu);
    });
    document.getElementById('controls-done-button')!.addEventListener('click', () => {
      this.showMenu(this.controlsReturnMenu);
    });

    document.getElementById('save-now')!.addEventListener('click', () => {
      this.hasEnteredWorld = false;
      this.playEl.textContent = 'Continue World';
      this.showMenu('title');
    });
    document.getElementById('quit-game-button')!.addEventListener('click', () => this.onQuit());

    this.audioToggleEl.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleAudio();
    });
    this.menuAudioEl.addEventListener('click', () => this.toggleAudio());
    this.fovEl.addEventListener('click', () => this.cycleFov());
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

    this.input.onPointerLockChange((locked) => {
      if (locked) {
        this.hideMenus();
      } else if (!this.inventoryModal.isOpen) {
        this.showMenu(this.hasEnteredWorld ? 'pause' : 'title');
      }
    });

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Escape' || this.overlayEl.classList.contains('hidden')) return;
      if (this.activeMenu === 'options') {
        event.preventDefault();
        this.showMenu(this.rootMenu);
      } else if (this.activeMenu === 'controls') {
        event.preventDefault();
        this.showMenu(this.controlsReturnMenu);
      } else if (this.activeMenu === 'pause') {
        event.preventDefault();
        this.requestPlay();
      }
    });

    document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private requestPlay(): void {
    this.audio.unlock();
    this.hasEnteredWorld = true;
    if (this.inventoryModal.isOpen) this.inventoryModal.close();
    this.input.requestPointerLock();
  }

  private showMenu(menu: MenuView): void {
    this.activeMenu = menu;
    for (const [name, element] of Object.entries(this.menuEls)) {
      element.classList.toggle('hidden', name !== menu);
    }
    this.overlayEl.classList.remove('hidden', 'mode-title', 'mode-pause');
    const titleMode = menu === 'title' || ((menu === 'options' || menu === 'controls') && this.rootMenu === 'title');
    this.overlayEl.classList.add(titleMode ? 'mode-title' : 'mode-pause');
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

  private cycleFov(): void {
    this.fovIndex = (this.fovIndex + 1) % this.fovValues.length;
    this.camera.fov = this.fovValues[this.fovIndex];
    this.camera.updateProjectionMatrix();
    this.fovEl.textContent = `FOV: ${this.camera.fov}`;
  }

  private async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }

  private updateFullscreenButton(): void {
    this.fullscreenEl.textContent = `Fullscreen: ${document.fullscreenElement ? 'On' : 'Off'}`;
  }
}
