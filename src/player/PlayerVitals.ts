export type DamageCause = 'mob' | 'fall' | 'drowning';

const MAX_HEALTH = 20;
const MAX_AIR = 10;

/** Player health, invulnerability, air supply, HUD rendering, and death state. */
export class PlayerVitals {
  public health = MAX_HEALTH;
  public dead = false;
  public invulnerable = false;

  private air = MAX_AIR;
  private invulnerabilityTimer = 0;
  private drowningDamageTimer = 0;
  private flashTimer = 0;
  private readonly heartsEl = document.getElementById('health-hearts')!;
  private readonly airEl = document.getElementById('air-meter')!;
  private readonly flashEl = document.getElementById('damage-flash')!;
  private readonly deathEl = document.getElementById('death-screen')!;
  private readonly deathMessageEl = document.getElementById('death-message')!;

  constructor(
    private readonly onDeath: () => void,
    private readonly onRespawn: () => void,
    private readonly onTitle: () => void
  ) {
    document.getElementById('respawn-button')!.addEventListener('click', () => this.respawn());
    document.getElementById('death-title-button')!.addEventListener('click', () => {
      this.health = MAX_HEALTH;
      this.air = MAX_AIR;
      this.dead = false;
      this.invulnerabilityTimer = 1.5;
      this.deathEl.classList.add('hidden');
      this.render();
      this.renderAir(false);
      this.onTitle();
    });
    this.render();
  }

  public get maxHealth(): number {
    return MAX_HEALTH;
  }

  public restore(health: number | undefined): void {
    this.health = Math.max(1, Math.min(MAX_HEALTH, Math.round(health ?? MAX_HEALTH)));
    this.dead = false;
    this.render();
  }

  public update(dt: number, underwater: boolean, creativeMode: boolean): void {
    this.invulnerable = creativeMode;
    this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.flashEl.classList.toggle('active', this.flashTimer > 0);
    if (this.dead) return;

    if (underwater && !creativeMode) {
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) {
        this.drowningDamageTimer -= dt;
        if (this.drowningDamageTimer <= 0) {
          this.drowningDamageTimer = 1;
          this.damage(2, 'drowning');
        }
      }
    } else {
      this.air = Math.min(MAX_AIR, this.air + dt * 4);
      this.drowningDamageTimer = 0;
    }
    this.renderAir(underwater && !creativeMode);
  }

  public damage(amount: number, cause: DamageCause): boolean {
    if (this.dead || this.invulnerable || this.invulnerabilityTimer > 0 || amount <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnerabilityTimer = 0.65;
    this.flashTimer = 0.14;
    this.render();
    if (this.health <= 0) this.die(cause);
    return true;
  }

  public applyFallDamage(impactVelocity: number): void {
    if (impactVelocity >= -11 || this.dead) return;
    const damage = Math.max(1, Math.floor((-impactVelocity - 8) / 2.8));
    this.damage(damage, 'fall');
  }

  private die(cause: DamageCause): void {
    this.dead = true;
    this.deathMessageEl.textContent =
      cause === 'drowning'
        ? 'You ran out of air in the depths.'
        : cause === 'fall'
          ? 'You discovered gravity the hard way.'
          : 'A Cave Crawler claimed another explorer.';
    this.deathEl.classList.remove('hidden');
    this.onDeath();
  }

  private respawn(): void {
    this.health = MAX_HEALTH;
    this.air = MAX_AIR;
    this.dead = false;
    this.invulnerabilityTimer = 1.5;
    this.deathEl.classList.add('hidden');
    this.render();
    this.renderAir(false);
    this.onRespawn();
  }

  private render(): void {
    this.heartsEl.replaceChildren();
    for (let heart = 0; heart < MAX_HEALTH / 2; heart++) {
      const element = document.createElement('span');
      element.className = 'heart';
      element.textContent = '♥';
      const remaining = this.health - heart * 2;
      if (remaining <= 0) element.classList.add('empty');
      else if (remaining === 1) element.classList.add('half');
      this.heartsEl.append(element);
    }
  }

  private renderAir(visible: boolean): void {
    this.airEl.classList.toggle('hidden', !visible);
    if (visible) {
      const bubbles = Math.ceil(this.air);
      this.airEl.textContent = `${'●'.repeat(bubbles)}${'○'.repeat(MAX_AIR - bubbles)}`;
    }
  }
}
