import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { Input } from '../core/Input';
import { InventoryModal } from './InventoryModal';

interface GameOverlayDependencies {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  input: Input;
  audio: AudioManager;
  inventoryModal: InventoryModal;
  onAudioChanged: () => void;
}

/** Owns pause, pointer-lock, resize, inventory-modal, status, and audio UI behavior. */
export class GameOverlayController {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input: Input;
  private readonly audio: AudioManager;
  private readonly inventoryModal: InventoryModal;
  private readonly onAudioChanged: () => void;
  private readonly overlayEl = document.getElementById('overlay')!;
  private readonly statusPillEl = document.getElementById('status-pill')!;
  private readonly audioToggleEl = document.getElementById('audio-toggle') as HTMLButtonElement;

  constructor(deps: GameOverlayDependencies) {
    this.renderer = deps.renderer;
    this.camera = deps.camera;
    this.input = deps.input;
    this.audio = deps.audio;
    this.inventoryModal = deps.inventoryModal;
    this.onAudioChanged = deps.onAudioChanged;
    this.setupEvents();
    this.updateAudioToggle();
  }

  public openInventory(gridSize: 2 | 3): void {
    this.audio.playInventoryOpen();
    this.inventoryModal.open(gridSize);
    this.overlayEl.classList.add('hidden');
    this.input.exitPointerLock();
  }

  public closeInventoryAndResume(): void {
    this.audio.playInventoryClose();
    this.inventoryModal.close();
    this.input.requestPointerLock();
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
    const playButton = document.getElementById('play-button')!;
    const requestPlay = (): void => {
      this.audio.unlock();
      this.audio.playUiClick();
      if (this.inventoryModal.isOpen) this.inventoryModal.close();
      this.input.requestPointerLock();
    };

    playButton.addEventListener('click', (event) => {
      event.stopPropagation();
      requestPlay();
    });
    this.overlayEl.addEventListener('click', requestPlay);

    this.audioToggleEl.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleAudio();
    });

    document.getElementById('inventory-modal')!.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('#craft-output-slot')) this.audio.playCraft();
      else if (target.closest('button, .inv-slot')) this.audio.playUiClick();
    });

    this.input.onPointerLockChange((locked) => {
      if (locked) {
        this.overlayEl.classList.add('hidden');
      } else if (!this.inventoryModal.isOpen) {
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

  private updateAudioToggle(): void {
    this.audioToggleEl.textContent = this.audio.muted ? '🔇 Sound Off [M]' : '🔊 Sound On [M]';
    this.audioToggleEl.classList.toggle('muted', this.audio.muted);
  }
}
