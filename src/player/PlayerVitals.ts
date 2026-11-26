import { ArmorManager } from './ArmorManager';

export type DamageCause = 'mob' | 'fall' | 'drowning' | 'starvation' | 'temperature' | 'poison' | 'environment';

const MAX_HEALTH = 20;
const MAX_HUNGER = 20;
const MAX_AIR = 10;
const EXHAUSTION_PER_POINT = 4;

/** Player health, hunger, air supply, damage rules, HUD rendering, and death state. */
export class PlayerVitals {
  public health = MAX_HEALTH;
  public hunger = MAX_HUNGER;
  public saturation = 5;
  public dead = false;
  public invulnerable = false;

  private air = MAX_AIR;
  private exhaustion = 0;
  private invulnerabilityTimer = 0;
  private drowningDamageTimer = 0;
  private starvationTimer = 4;
  private regenerationTimer = 4;
  private flashTimer = 0;
  private armor: ArmorManager | null = null;
  private readonly heartsEl = document.getElementById('health-hearts')!;
  private readonly hungerEl = document.getElementById('hunger-pips')!;
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
      this.resetForRespawn();
      this.deathEl.classList.add('hidden');
      this.onTitle();
    });
    this.render();
    this.renderHunger();
  }

  public get maxHealth(): number { return MAX_HEALTH; }
  public get maxHunger(): number { return MAX_HUNGER; }
  public get canSprint(): boolean { return this.hunger > 0; }
  public get knockbackMultiplier(): number { return this.armor?.knockbackMultiplier ?? 1; }

  public attachArmor(armor: ArmorManager): void {
    this.armor = armor;
  }

  public restore(health: number | undefined, hunger?: number, saturation?: number): void {
    this.health = Math.max(1, Math.min(MAX_HEALTH, Math.round(health ?? MAX_HEALTH)));
    this.hunger = Math.max(0, Math.min(MAX_HUNGER, Math.round(hunger ?? MAX_HUNGER)));
    this.saturation = Math.max(0, Math.min(this.hunger, saturation ?? Math.min(5, this.hunger)));
    this.dead = false;
    this.render();
    this.renderHunger();
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

    if (creativeMode) {
      this.regenerationTimer = 4;
      this.starvationTimer = 4;
      return;
    }

    // Even sheltering indefinitely has a very small metabolic cost.
    this.addExhaustion(dt * 0.005);
    if (this.hunger >= 18 && this.health < MAX_HEALTH) {
      this.regenerationTimer -= dt;
      if (this.regenerationTimer <= 0) {
        this.health++;
        this.addExhaustion(3);
        this.regenerationTimer = 4;
        this.render();
      }
    } else {
      this.regenerationTimer = 4;
    }

    if (this.hunger <= 0) {
      this.starvationTimer -= dt;
      if (this.starvationTimer <= 0) {
        this.starvationTimer = 4;
        // Normal survival starvation creates danger but does not kill by itself.
        if (this.health > 1) this.damage(1, 'starvation');
      }
    } else {
      this.starvationTimer = 4;
    }
  }

  public addExhaustion(amount: number): void {
    if (this.dead || this.invulnerable || amount <= 0) return;
    this.exhaustion += amount;
    let changed = false;
    while (this.exhaustion >= EXHAUSTION_PER_POINT) {
      this.exhaustion -= EXHAUSTION_PER_POINT;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else if (this.hunger > 0) this.hunger--;
      changed = true;
    }
    if (changed) this.renderHunger();
  }

  public addMovementExhaustion(distance: number, sprinting: boolean, swimming: boolean): void {
    const rate = swimming ? 0.025 : sprinting ? 0.08 : 0.008;
    this.addExhaustion(Math.max(0, distance) * rate);
  }

  public eat(nutrition: number, saturation: number): boolean {
    if (this.dead || nutrition <= 0 || this.hunger >= MAX_HUNGER) return false;
    this.hunger = Math.min(MAX_HUNGER, this.hunger + nutrition);
    this.saturation = Math.min(this.hunger, this.saturation + Math.max(0, saturation));
    this.starvationTimer = 4;
    this.renderHunger();
    return true;
  }

  public heal(amount: number): boolean {
    if (this.dead || amount <= 0 || this.health >= MAX_HEALTH) return false;
    this.health = Math.min(MAX_HEALTH, this.health + Math.floor(amount));
    this.render();
    return true;
  }

  public damageNonLethal(amount: number, _cause: DamageCause): boolean {
    if (this.dead || this.invulnerable || this.invulnerabilityTimer > 0 || amount <= 0 || this.health <= 1) return false;
    this.health = Math.max(1, this.health - amount);
    this.invulnerabilityTimer = 0.45;
    this.regenerationTimer = 4;
    this.flashTimer = 0.12;
    this.render();
    return true;
  }

  public damage(amount: number, cause: DamageCause): boolean {
    if (this.dead || this.invulnerable || this.invulnerabilityTimer > 0 || amount <= 0) return false;
    const appliedDamage = this.armor?.mitigate(amount, cause) ?? amount;
    this.health = Math.max(0, this.health - appliedDamage);
    this.invulnerabilityTimer = 0.65;
    this.regenerationTimer = 4;
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
          : cause === 'starvation'
            ? 'The caves offered no meal.'
            : cause === 'temperature'
              ? 'The elements overwhelmed you.'
              : cause === 'poison'
                ? 'Poison overcame you.'
                : cause === 'environment'
                  ? 'The wilderness proved unforgiving.'
                  : 'A Cave Crawler claimed another explorer.';
    this.deathEl.classList.remove('hidden');
    this.onDeath();
  }

  private respawn(): void {
    this.resetForRespawn();
    this.deathEl.classList.add('hidden');
    this.onRespawn();
  }

  private resetForRespawn(): void {
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.saturation = 5;
    this.air = MAX_AIR;
    this.exhaustion = 0;
    this.dead = false;
    this.invulnerabilityTimer = 1.5;
    this.render();
    this.renderHunger();
    this.renderAir(false);
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

  private renderHunger(): void {
    this.hungerEl.replaceChildren();
    for (let pip = 0; pip < MAX_HUNGER / 2; pip++) {
      const element = document.createElement('span');
      element.className = 'hunger-pip';
      element.textContent = '◆';
      const remaining = this.hunger - pip * 2;
      if (remaining <= 0) element.classList.add('empty');
      else if (remaining === 1) element.classList.add('half');
      this.hungerEl.append(element);
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
