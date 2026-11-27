import * as THREE from 'three';
import { Input } from '../core/Input';
import { moveGroundMob } from '../entities/MobMechanics';
import type { SurfaceAnimalEntity } from '../entities/SurfaceAnimalSpecies';
import { Player } from '../player/Player';
import { canOccupyCollider } from '../player/Physics';
import { World } from '../world/World';
import type { WildlifeVisual } from './DesertWildlifeVisuals';

const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.2;
const JUMP_SPEED = 7.2;
const MOVEMENT_RESPONSE = 8;
const RIDER_HEIGHT = 1.62;
const CAMEL_SHAPE = { radius: 0.72, height: 2.25 };

export type CamelEntity = SurfaceAnimalEntity<WildlifeVisual>;

/** Owns the transient player-to-Camel mount relationship and rider-controlled movement. */
export class CamelRidingController {
  private mounted: CamelEntity | null = null;

  public constructor(
    private readonly player: Player,
    private readonly world: World
  ) {}

  public get isRiding(): boolean {
    return this.mounted !== null;
  }

  public get mountedEntityId(): number | null {
    return this.mounted?.id ?? null;
  }

  public mount(camel: CamelEntity): boolean {
    if (this.mounted || camel.state.growthRemaining > 0) return false;
    this.mounted = camel;
    camel.state.activity = 'idle';
    camel.state.activityTimer = 0;
    camel.state.loveTimer = 0;
    camel.state.persistent = true;
    this.player.flyMode = false;
    this.syncPlayer(camel);
    return true;
  }

  public isMounted(camel: CamelEntity): boolean {
    return this.mounted?.id === camel.id;
  }

  public dismountIfMounted(camel: CamelEntity): void {
    if (this.isMounted(camel)) this.dismount();
  }

  public dismount(): boolean {
    const camel = this.mounted;
    if (!camel) return false;
    this.mounted = null;

    const directions = [
      new THREE.Vector3(Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw)),
      new THREE.Vector3(-Math.cos(this.player.yaw), 0, Math.sin(this.player.yaw)),
      new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)),
      new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw)),
    ];
    for (const direction of directions) {
      const candidate = camel.position.clone().addScaledVector(direction, 1.35);
      candidate.y += 0.05;
      if (!canOccupyCollider(this.world, candidate, this.player.collider)) continue;
      this.player.syncMountedPosition(candidate, new THREE.Vector3(), true);
      return true;
    }

    const fallback = camel.position.clone();
    fallback.y += CAMEL_SHAPE.height + 0.1;
    this.player.syncMountedPosition(fallback, new THREE.Vector3(), false);
    return true;
  }

  /** Returns true while this controller owns player movement for the frame step. */
  public update(dt: number, input: Input): boolean {
    const camel = this.mounted;
    if (!camel) return false;
    if (input.consumeKeyPress('ShiftLeft') || input.consumeKeyPress('ShiftRight')) {
      this.dismount();
      return false;
    }

    const forwardInput =
      (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp') ? 1 : 0)
      - (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown') ? 1 : 0)
      + (input.virtualMoveForward ?? 0);
    const strafeInput =
      (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight') ? 1 : 0)
      - (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft') ? 1 : 0)
      + (input.virtualMoveX ?? 0);
    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    const rightX = Math.cos(this.player.yaw);
    const rightZ = -Math.sin(this.player.yaw);
    let directionX = forwardX * forwardInput + rightX * strafeInput;
    let directionZ = forwardZ * forwardInput + rightZ * strafeInput;
    const length = Math.hypot(directionX, directionZ);
    if (length > 0.0001) {
      directionX /= length;
      directionZ /= length;
      camel.state.facingAngle = Math.atan2(directionX, directionZ);
      camel.state.activity = 'wandering';
    } else {
      camel.state.activity = 'idle';
    }

    if (camel.onGround && input.isKeyDown('Space')) {
      camel.velocity.y = JUMP_SPEED;
      camel.onGround = false;
    }
    const sprinting = input.isKeyDown('ControlLeft') || input.isKeyDown('ControlRight');
    moveGroundMob(
      camel,
      {
        directionX,
        directionZ,
        speed: sprinting ? SPRINT_SPEED : WALK_SPEED,
      },
      CAMEL_SHAPE,
      this.world,
      dt,
      { response: MOVEMENT_RESPONSE }
    );
    this.syncPlayer(camel);
    return true;
  }

  private syncPlayer(camel: CamelEntity): void {
    const riderPosition = camel.position.clone();
    riderPosition.y += RIDER_HEIGHT;
    this.player.syncMountedPosition(riderPosition, camel.velocity, camel.onGround);
  }
}
