import * as THREE from 'three';
import { Input } from '../core/Input';
import { BlockId } from '../content/BlockId';
import { World } from '../world/World';
import {
  PlayerCollider,
  canOccupyCollider,
  doesBlockIntersectPlayer,
  moveWithVoxelCollision,
} from './Physics';

const GRAVITY = 28.0;
const JUMP_SPEED = 9.0;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 6.8;
const CROUCH_SPEED = 2.15;
const STANDING_HEIGHT = 1.8;
const CROUCHING_HEIGHT = 1.5;
const STANDING_EYE_HEIGHT = 1.62;
const CROUCHING_EYE_HEIGHT = 1.27;
const FLY_SPEED = 11.5;
const FLY_SPRINT_SPEED = 20.0;
const MOUSE_SENSITIVITY = 0.0022;

export class Player {
  public readonly camera: THREE.PerspectiveCamera;
  /** Feet world position */
  public readonly position: THREE.Vector3;
  public readonly velocity = new THREE.Vector3();
  public readonly collider: PlayerCollider = {
    halfWidth: 0.3,
    height: STANDING_HEIGHT,
  };
  public eyeHeight = STANDING_EYE_HEIGHT;

  public yaw = 0;
  public pitch = 0;
  public onGround = false;
  public flyMode = false;
  public crouching = false;

  constructor(camera: THREE.PerspectiveCamera, spawnPos: THREE.Vector3) {
    this.camera = camera;
    this.position = spawnPos.clone();
    this.camera.rotation.order = 'YXZ';
    this.syncCamera();
  }

  public updateLook(input: Input): void {
    if (!input.isPointerLocked) return;

    this.yaw -= input.mouseDeltaX * MOUSE_SENSITIVITY;
    this.pitch -= input.mouseDeltaY * MOUSE_SENSITIVITY;

    const maxPitch = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    this.syncCamera();
  }

  public updatePhysics(
    dt: number,
    input: Input,
    world: World,
    movementSpeedScale = 1,
    canSprint = true
  ): void {
    const keyForward =
      (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp') ? 1 : 0) -
      (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown') ? 1 : 0);
    const keyStrafe =
      (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight') ? 1 : 0) -
      (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft') ? 1 : 0);
    const forwardInput = keyForward + (input.virtualMoveForward ?? 0);
    const strafeInput = keyStrafe + (input.virtualMoveX ?? 0);

    // Forward direction in XZ plane (Three.js camera looks down -Z at yaw=0)
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let wishX = forwardX * forwardInput + rightX * strafeInput;
    let wishZ = forwardZ * forwardInput + rightZ * strafeInput;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    if (this.flyMode) {
      const standingCollider: PlayerCollider = {
        halfWidth: this.collider.halfWidth,
        height: STANDING_HEIGHT,
      };
      this.crouching = !canOccupyCollider(world, this.position, standingCollider);
      this.collider.height = this.crouching ? CROUCHING_HEIGHT : STANDING_HEIGHT;
      const sprinting = input.isKeyDown('ControlLeft') || input.isKeyDown('ControlRight');
      const speed = sprinting ? FLY_SPRINT_SPEED : FLY_SPEED;

      this.velocity.x = wishX * speed;
      this.velocity.z = wishZ * speed;

      const vertical =
        (input.isKeyDown('Space') ? 1 : 0) -
        (input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight') ? 1 : 0);
      this.velocity.y = vertical * speed;

      moveWithVoxelCollision(world, this.position, this.velocity, dt, this.collider);
      this.onGround = false;
    } else {
      this.updateCrouch(input, world);
      const inWater = this.isInWater(world);
      const sprinting =
        canSprint &&
        !this.crouching &&
        (input.isKeyDown('ControlLeft') || input.isKeyDown('ControlRight'));

      const baseSpeed = this.crouching ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;
      const speed = baseSpeed * movementSpeedScale * (inWater ? 0.65 : 1.0);

      // Smooth responsive horizontal acceleration
      const accel = this.onGround ? 18.0 : 9.0;
      const blend = Math.min(1, accel * dt);
      this.velocity.x += (wishX * speed - this.velocity.x) * blend;
      this.velocity.z += (wishZ * speed - this.velocity.z) * blend;

      if (inWater) {
        this.velocity.y -= GRAVITY * 0.28 * dt;
        this.velocity.y *= Math.pow(0.25, dt);
        if (input.isKeyDown('Space')) {
          this.velocity.y = 4.2;
        }
      } else {
        this.velocity.y -= GRAVITY * dt;
        this.velocity.y = Math.max(this.velocity.y, -48.0);
        if (this.onGround && input.isKeyDown('Space') && !this.crouching) {
          this.velocity.y = JUMP_SPEED;
          this.onGround = false;
        }
      }

      const res = moveWithVoxelCollision(
        world,
        this.position,
        this.velocity,
        dt,
        this.collider,
        this.crouching
      );
      this.onGround = res.onGround;

      // Safety net if player somehow falls below bedrock
      if (this.position.y < -15) {
        this.position.y = 95;
        this.velocity.set(0, 0, 0);
      }
    }

    const targetEyeHeight = this.crouching ? CROUCHING_EYE_HEIGHT : STANDING_EYE_HEIGHT;
    const eyeBlend = 1 - Math.exp(-14 * dt);
    this.eyeHeight += (targetEyeHeight - this.eyeHeight) * eyeBlend;
    this.syncCamera();
  }

  public isHeadUnderwater(world: World): boolean {
    const eyeY = this.position.y + this.eyeHeight;
    return world.getBlock(this.position.x, eyeY, this.position.z) === BlockId.Water;
  }

  public isInWater(world: World): boolean {
    return (
      world.getBlock(this.position.x, this.position.y + 0.2, this.position.z) === BlockId.Water ||
      world.getBlock(this.position.x, this.position.y + 1.0, this.position.z) === BlockId.Water
    );
  }

  public intersectsBlock(bx: number, by: number, bz: number): boolean {
    return doesBlockIntersectPlayer(bx, by, bz, this.position, this.collider);
  }

  public getEyePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
  }

  public getForwardDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }

  public restoreTransform(position: THREE.Vector3, yaw: number, pitch: number): void {
    this.position.copy(position);
    this.yaw = yaw;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    this.velocity.set(0, 0, 0);
    this.syncCamera();
  }

  /** Synchronizes the player body and camera to an externally controlled mount. */
  public syncMountedPosition(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    onGround: boolean
  ): void {
    this.position.copy(position);
    this.velocity.copy(velocity);
    this.onGround = onGround;
    this.crouching = false;
    this.collider.height = STANDING_HEIGHT;
    this.eyeHeight = STANDING_EYE_HEIGHT;
    this.syncCamera();
  }

  private updateCrouch(input: Input, world: World): void {
    const shiftHeld = input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight');
    if (shiftHeld) {
      this.crouching = true;
      this.collider.height = CROUCHING_HEIGHT;
      return;
    }

    if (!this.crouching) return;

    const standingCollider: PlayerCollider = {
      halfWidth: this.collider.halfWidth,
      height: STANDING_HEIGHT,
    };
    if (canOccupyCollider(world, this.position, standingCollider)) {
      this.crouching = false;
      this.collider.height = STANDING_HEIGHT;
    }
  }

  private syncCamera(): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
