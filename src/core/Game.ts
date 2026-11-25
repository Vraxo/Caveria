import * as THREE from 'three';
import { Player } from '../player/Player';
import { VoxelHit, raycastVoxel } from '../player/Raycaster';
import { BreakParticles } from '../rendering/BreakParticles';
import { DayNightCycle } from '../rendering/DayNightCycle';
import { BlockHighlight } from '../rendering/Highlight';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { DebugHud } from '../ui/DebugHud';
import { Hotbar } from '../ui/Hotbar';
import { BLOCKS, BlockId } from '../world/Block';
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
  private readonly particles: BreakParticles;
  private readonly hotbar: Hotbar;
  private readonly debugHud: DebugHud;

  private readonly overlayEl: HTMLElement;
  private readonly statusPillEl: HTMLElement;
  private readonly waterTintEl: HTMLElement;
  private readonly seedLabel: string;

  private lastTime = performance.now();
  private currentHit: VoxelHit | null = null;

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

    this.dayNight = new DayNightCycle(this.scene);

    // Parse optional ?seed=... query parameter
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
    this.particles = new BreakParticles(this.scene);
    this.hotbar = new Hotbar(this.atlas);
    this.debugHud = new DebugHud();

    this.overlayEl = document.getElementById('overlay')!;
    this.statusPillEl = document.getElementById('status-pill')!;
    this.waterTintEl = document.getElementById('water-tint')!;

    this.setupOverlayAndEvents();
    this.updateStatusPill();
  }

  public start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((now) => this.loop(now));
  }

  private setupOverlayAndEvents(): void {
    const playButton = document.getElementById('play-button')!;
    const requestPlay = () => this.input.requestPointerLock();

    playButton.addEventListener('click', (e) => {
      e.stopPropagation();
      requestPlay();
    });
    this.overlayEl.addEventListener('click', requestPlay);

    this.input.onPointerLockChange((locked) => {
      this.overlayEl.classList.toggle('hidden', locked);
      if (!locked) {
        playButton.textContent = 'Click to Resume';
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
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

    if (this.input.isPointerLocked) {
      if (this.input.consumeKeyPress('KeyF')) {
        this.player.flyMode = !this.player.flyMode;
        this.player.velocity.y = 0;
        this.updateStatusPill();
      }

      // Day/Night time controls:
      // [T] jumps ahead 3 in-game hours (great for previewing sunset/night/dawn)
      // Hold [ or ] to scrub time backward/forward smoothly
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
      this.handleBlockActions();
    }

    this.dayNight.update(dt, this.player.position);
    this.syncShaderLightUniforms();
    this.world.updateStreaming(this.player.position.x, this.player.position.z);
    this.particles.update(dt);
    this.updateAtmosphere();
    this.debugHud.update(dt, this.player, this.world, this.dayNight, this.currentHit, this.seedLabel);
  }

  private syncShaderLightUniforms(): void {
    const u = this.world.lightUniforms;
    u.uSkyBrightness.value = this.dayNight.skyBrightness;
    u.uSkyTint.value.copy(this.dayNight.skyLightTint);
    u.uTorchFlicker.value = this.dayNight.torchFlicker;
  }

  private handleBlockActions(): void {
    // Left click: Break block
    if (this.input.consumeMousePress(0) && this.currentHit) {
      const { blockX, blockY, blockZ, blockId } = this.currentHit;
      if (BLOCKS[blockId].breakable) {
        this.world.setBlock(blockX, blockY, blockZ, BlockId.Air);
        this.particles.spawnBurst(blockX, blockY, blockZ, blockId);

        // If a torch was standing on top of the broken block, pop it off too
        if (this.world.getBlock(blockX, blockY + 1, blockZ) === BlockId.Torch) {
          this.world.setBlock(blockX, blockY + 1, blockZ, BlockId.Air);
          this.particles.spawnBurst(blockX, blockY + 1, blockZ, BlockId.Torch);
        }

        this.refreshRaycast();
      }
    }

    // Middle click: Pick targeted block into hotbar
    if (this.input.consumeMousePress(1) && this.currentHit) {
      this.hotbar.pickBlock(this.currentHit.blockId);
    }

    // Right click: Place selected block
    if (this.input.consumeMousePress(2) && this.currentHit) {
      const placeX = this.currentHit.blockX + this.currentHit.normalX;
      const placeY = this.currentHit.blockY + this.currentHit.normalY;
      const placeZ = this.currentHit.blockZ + this.currentHit.normalZ;

      if (placeY >= 0 && placeY < CHUNK_HEIGHT) {
        const selected = this.hotbar.selectedBlock;
        const selectedDef = BLOCKS[selected];
        const existing = this.world.getBlock(placeX, placeY, placeZ);

        // Torches cannot be placed underwater or floating in mid-air without a solid block beneath
        if (selected === BlockId.Torch) {
          const below = this.world.getBlock(placeX, placeY - 1, placeZ);
          if (existing === BlockId.Air && BLOCKS[below].solid) {
            this.world.setBlock(placeX, placeY, placeZ, selected);
            this.refreshRaycast();
          }
          return;
        }

        if (
          (existing === BlockId.Air || existing === BlockId.Water) &&
          (!selectedDef.solid || !this.player.intersectsBlock(placeX, placeY, placeZ))
        ) {
          this.world.setBlock(placeX, placeY, placeZ, selected);
          this.refreshRaycast();
        }
      }
    }
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
    const mode = this.player.flyMode ? 'Fly Mode' : 'Walk Mode';
    this.statusPillEl.textContent = `${mode} · [F] Fly · [T] Time · [F3] Debug`;
  }
}
