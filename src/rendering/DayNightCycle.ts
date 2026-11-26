import * as THREE from 'three';

const DEFAULT_DAY_LENGTH_SECONDS = 300; // 5 minutes per full 24h cycle

const COLOR_DAY_SKY = new THREE.Color(0x7ec4f8);
const COLOR_SUNSET_SKY = new THREE.Color(0xe67e52);
const COLOR_NIGHT_SKY = new THREE.Color(0x070d1d);

const TINT_NOON = new THREE.Color(1.0, 0.99, 0.97);
const TINT_SUNSET = new THREE.Color(1.05, 0.78, 0.62);
const TINT_MOONLIGHT = new THREE.Color(0.56, 0.68, 0.98);

export class DayNightCycle {
  /** Normalized time of day in [0, 1): 0.0 = sunrise (06:00), 0.25 = noon (12:00), 0.5 = sunset (18:00), 0.75 = midnight (00:00) */
  public timeOfDay = 0.18; // Start in crisp late morning
  public paused = false;

  public readonly skyColor = new THREE.Color();
  public readonly skyLightTint = new THREE.Color();
  public skyBrightness = 1.0;
  public torchFlicker = 1.0;

  private readonly group = new THREE.Group();
  private readonly sunMesh: THREE.Mesh;
  private readonly sunMat: THREE.MeshBasicMaterial;
  private readonly moonMesh: THREE.Mesh;
  private readonly moonMat: THREE.MeshBasicMaterial;
  private readonly starsPoints: THREE.Points;
  private readonly starsMat: THREE.PointsMaterial;
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    // Sun disc
    const sunGeo = new THREE.PlaneGeometry(26, 26);
    this.sunMat = new THREE.MeshBasicMaterial({
      color: 0xfff5b8,
      fog: false,
      depthWrite: false,
      transparent: true,
    });
    this.sunMesh = new THREE.Mesh(sunGeo, this.sunMat);
    this.group.add(this.sunMesh);

    // Moon disc with crisp procedural pixel crater texture
    const moonGeo = new THREE.PlaneGeometry(22, 22);
    this.moonMat = new THREE.MeshBasicMaterial({
      map: this.createMoonTexture(),
      fog: false,
      depthWrite: false,
      transparent: true,
    });
    this.moonMesh = new THREE.Mesh(moonGeo, this.moonMat);
    this.group.add(this.moonMesh);

    // Starfield dome
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // Uniform points on sphere of radius 190
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const radius = 185;
      starPositions[i * 3] = radius * r * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(radius * u) + 12; // Upper hemisphere
      starPositions[i * 3 + 2] = radius * r * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 2.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.starsPoints = new THREE.Points(starGeo, this.starsMat);
    this.group.add(this.starsPoints);

    this.group.renderOrder = -10;
    scene.add(this.group);
  }

  public advanceTime(deltaFraction: number): void {
    this.timeOfDay = ((this.timeOfDay + deltaFraction) % 1 + 1) % 1;
  }

  public get isNight(): boolean {
    return this.timeOfDay >= 0.52;
  }

  public skipToMorning(): void {
    this.timeOfDay = 0.025;
  }

  public getFormattedClock(): string {
    // timeOfDay = 0 -> 06:00, 0.25 -> 12:00, 0.5 -> 18:00, 0.75 -> 00:00
    const totalMinutes = Math.floor(((this.timeOfDay + 0.25) % 1) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const phase =
      this.timeOfDay < 0.06 || (this.timeOfDay >= 0.44 && this.timeOfDay < 0.56)
        ? 'Dusk/Dawn'
        : this.timeOfDay < 0.5
        ? 'Day'
        : 'Night';
    return `${hh}:${mm} (${phase})`;
  }

  public update(dt: number, playerPos: THREE.Vector3, cloudCover = 0): void {
    this.elapsed += dt;
    if (!this.paused) {
      this.timeOfDay = (this.timeOfDay + dt / DEFAULT_DAY_LENGTH_SECONDS) % 1;
    }

    // Subtle organic torch flame flicker
    this.torchFlicker =
      0.97 +
      Math.sin(this.elapsed * 7.3) * 0.018 +
      Math.sin(this.elapsed * 17.1) * 0.012;

    // Anchor celestial dome to player so sun/moon/stars stay infinitely far
    this.group.position.copy(playerPos);

    const angle = this.timeOfDay * Math.PI * 2;
    const orbitRadius = 175;
    // Sun rises in +X, peaks at +Y (time=0.25), sets in -X (time=0.5)
    const sunX = Math.cos(angle) * orbitRadius;
    const sunY = Math.sin(angle) * orbitRadius;
    const sunZ = -45;

    this.sunMesh.position.set(sunX, sunY, sunZ);
    this.sunMesh.lookAt(playerPos);
    this.sunMesh.visible = sunY > -28;

    this.moonMesh.position.set(-sunX, -sunY, -sunZ);
    this.moonMesh.lookAt(playerPos);
    this.moonMesh.visible = -sunY > -28;

    // Elevation in [-1, 1]
    const sunElev = Math.sin(angle);

    // Compute sky color, sky brightness, and light tint smoothly across dawn/day/dusk/night
    if (sunElev >= 0.22) {
      // Full Day
      const t = Math.min(1, (sunElev - 0.22) / 0.5);
      this.skyColor.copy(COLOR_SUNSET_SKY).lerp(COLOR_DAY_SKY, 0.65 + 0.35 * t);
      this.skyLightTint.copy(TINT_SUNSET).lerp(TINT_NOON, 0.7 + 0.3 * t);
      this.skyBrightness = 0.88 + 0.12 * t;
      this.starsMat.opacity = 0;
    } else if (sunElev >= -0.18) {
      // Sunrise / Sunset golden hour transition (-0.18 .. +0.22)
      const u = (sunElev + 0.18) / 0.4; // 0 at twilight, 1 at low day
      if (u > 0.5) {
        const k = (u - 0.5) * 2;
        this.skyColor.copy(COLOR_SUNSET_SKY).lerp(COLOR_DAY_SKY, k * 0.65);
        this.skyLightTint.copy(TINT_SUNSET).lerp(TINT_NOON, k * 0.7);
      } else {
        const k = u * 2;
        this.skyColor.copy(COLOR_NIGHT_SKY).lerp(COLOR_SUNSET_SKY, k);
        this.skyLightTint.copy(TINT_MOONLIGHT).lerp(TINT_SUNSET, k);
      }
      this.skyBrightness = 0.16 + u * 0.72;
      this.starsMat.opacity = Math.max(0, (1 - u * 1.5) * 0.85);
    } else {
      // Night (moonlit surface, dark caves)
      const nightDepth = Math.min(1, (-sunElev - 0.18) / 0.5);
      this.skyColor.copy(COLOR_NIGHT_SKY);
      this.skyLightTint.copy(TINT_MOONLIGHT);
      this.skyBrightness = 0.16 - nightDepth * 0.02; // ~0.14 moonlit surface
      this.starsMat.opacity = 0.85;
    }

    const celestialVisibility = Math.max(0.04, 1 - cloudCover * 1.08);
    this.sunMat.opacity = celestialVisibility;
    this.moonMat.opacity = celestialVisibility;
    this.starsMat.opacity *= celestialVisibility;
  }

  private createMoonTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(4, 3, 2, 3);
    ctx.fillRect(2, 5, 1, 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(5, 1, 2, 1);

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
