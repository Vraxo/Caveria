import * as THREE from 'three';
import { Player } from '../player/Player';
import { VoxelHit, raycastVoxel } from '../player/Raycaster';
import { BreakParticles } from '../rendering/BreakParticles';
import { BlockHighlight } from '../rendering/Highlight';
import { TextureAtlas } from '../rendering/TextureAtlas';
import { DebugHud } from '../ui/DebugHud';
import { Hotbar } from '../ui/Hotbar';
import { BLOCKS, BlockId } from '../world/Block';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../world/Chunk';
import { hashString } from '../world/Noise';
import { World } from '../world/World';
import { Input } from './Input';

const SKY_COLOR = 0x87ceeb;
const UNDERWATER_FOG_COLOR = 0x104e9e;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input: Input;
  private readonly atlas: TextureAtlas;
  private readonly world: World;
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
    this.renderer.setClearColor(SKY_COLOR);

    this.scene = new THREE.Scene();
    const renderDistance = 5;
    const fogFar = renderDistance * CHUNK_SIZE;
    this.scene.fog = new THREE.Fog(SKY_COLOR, fogFar * 0.58, fogFar * 0.98);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      fogFar * 1.4
    );

    // Subtle sun billboard in sky
    this.addSkySun();

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

  private addSkySun(): void {
    const sunGeo = new THREE.PlaneGeometry(34, 34);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfff7cc,
      fog: false,
      depthWrite: false,
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(120, 210, -160);
    sun.lookAt(0, 0, 0);
    this.scene.add(sun);
  }

  private loop(now: number): void {
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Clamp delta to avoid physics tunneling after tab switches
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

      this.player.updateLook(this.input);
      this.hotbar.update(this.input);

      // Fixed sub-steps if dt is large so AABB collision stays rock-solid
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

    this.world.updateStreaming(this.player.position.x, this.player.position.z);
    this.particles.update(dt);
    this.updateAtmosphere();
    this.debugHud.update(dt, this.player, this.world, this.currentHit, this.seedLabel);
  }

  private handleBlockActions(): void {
    // Left click: Break block
    if (this.input.consumeMousePress(0) && this.currentHit) {
      const { blockX, blockY, blockZ, blockId } = this.currentHit;
      if (BLOCKS[blockId].breakable) {
        this.world.setBlock(blockX, blockY, blockZ, BlockId.Air);
        this.particles.spawnBurst(blockX, blockY, blockZ, blockId);
        this.currentHit = raycastVoxel(
          this.world,
          this.player.getEyePosition(),
          this.player.getForwardDirection(),
          6.0
        );
        this.highlight.update(this.currentHit);
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
        const existing = this.world.getBlock(placeX, placeY, placeZ);
        if (
          (existing === BlockId.Air || existing === BlockId.Water) &&
          !this.player.intersectsBlock(placeX, placeY, placeZ)
        ) {
          this.world.setBlock(placeX, placeY, placeZ, this.hotbar.selectedBlock);
          this.currentHit = raycastVoxel(
            this.world,
            this.player.getEyePosition(),
            this.player.getForwardDirection(),
            6.0
          );
          this.highlight.update(this.currentHit);
        }
      }
    }
  }

  private updateAtmosphere(): void {
    const underwater = this.player.isHeadUnderwater(this.world);
    this.waterTintEl.classList.toggle('active', underwater);

    const fog = this.scene.fog as THREE.Fog;
    const maxDist = this.world.renderDistance * CHUNK_SIZE;
    if (underwater) {
      this.renderer.setClearColor(UNDERWATER_FOG_COLOR);
      fog.color.setHex(UNDERWATER_FOG_COLOR);
      fog.near = 2;
      fog.far = 26;
    } else {
      this.renderer.setClearColor(SKY_COLOR);
      fog.color.setHex(SKY_COLOR);
      fog.near = maxDist * 0.58;
      fog.far = maxDist * 0.98;
    }
  }

  private updateStatusPill(): void {
    const mode = this.player.flyMode ? 'Fly Mode' : 'Walk Mode';
    this.statusPillEl.textContent = `${mode} · [F] Fly · [F3] Debug`;
  }
}
