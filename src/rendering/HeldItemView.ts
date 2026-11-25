import * as THREE from 'three';
import { ITEMS, ItemId, ItemStack } from '../items/Item';
import { BLOCKS, BlockId } from '../world/Block';
import { TextureAtlas } from './TextureAtlas';

/** A layered, camera-space first-person rig with voxel hands and held items. */
export class HeldItemView {
  private readonly root = new THREE.Group();
  private readonly itemPivot = new THREE.Group();
  private readonly rightHand = new THREE.Group();
  private readonly leftHand = new THREE.Group();
  private readonly atlas: TextureAtlas;

  private currentItemId: ItemId | null = -1 as unknown as ItemId;
  private visualObj: THREE.Object3D | null = null;
  private elapsed = 0;
  private walkPhase = 0;
  private swingProgress = 0;
  private swinging = false;
  private equipProgress = 1;
  private placeProgress = 0;
  private placing = false;

  constructor(camera: THREE.PerspectiveCamera, atlas: TextureAtlas) {
    this.atlas = atlas;
    this.root.renderOrder = 20;
    this.root.add(this.itemPivot, this.rightHand, this.leftHand);
    camera.add(this.root);

    this.buildHands();
    this.setEquipped(null);
  }

  /** Starts the broad mining/punch arc. */
  public triggerSwing(): void {
    if (!this.swinging || this.swingProgress > 0.45) {
      this.swinging = true;
      this.swingProgress = 0;
    }
  }

  /** Starts the shorter forward placement motion. */
  public triggerPlace(): void {
    this.placing = true;
    this.placeProgress = 0;
  }

  public setEquipped(stack: ItemStack | null): void {
    const nextId = stack ? stack.id : null;
    if (nextId === this.currentItemId) return;
    this.currentItemId = nextId;
    this.equipProgress = 0;

    if (this.visualObj) {
      this.itemPivot.remove(this.visualObj);
      this.disposeVisual(this.visualObj);
      this.visualObj = null;
    }

    // Empty hand uses only the modeled right forearm.
    if (nextId === null) return;

    const def = ITEMS[nextId];
    if (def.placeBlockId !== null && BLOCKS[def.placeBlockId].shape === 'cube') {
      const cube = this.buildBlockMesh(def.placeBlockId);
      cube.rotation.set(0.18, -0.72, 0.08);
      cube.renderOrder = 25;
      this.visualObj = cube;
      this.itemPivot.add(cube);
      return;
    }

    // Flat pixel-art tool/item/flora, presented like a classic voxel-game item card.
    const canvas =
      def.placeBlockId !== null
        ? this.atlas.createBlockIcon(def.placeBlockId)
        : this.atlas.getOrCreateItemSprite16(nextId);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48), mat);
    sprite.rotation.set(0.08, -0.45, -0.18);
    sprite.renderOrder = 25;
    this.visualObj = sprite;
    this.itemPivot.add(sprite);
  }

  public update(dt: number, horizontalSpeed: number, isMining: boolean): void {
    this.elapsed += dt;
    this.equipProgress = Math.min(1, this.equipProgress + dt * 5.8);

    if (isMining && !this.swinging) {
      this.swinging = true;
      this.swingProgress = 0;
    }
    if (this.swinging) {
      this.swingProgress += dt * 4.35;
      if (this.swingProgress >= 1) {
        if (isMining) {
          this.swingProgress = 0;
        } else {
          this.swingProgress = 0;
          this.swinging = false;
        }
      }
    }
    if (this.placing) {
      this.placeProgress += dt * 6.8;
      if (this.placeProgress >= 1) {
        this.placeProgress = 0;
        this.placing = false;
      }
    }

    const movement = Math.min(1, horizontalSpeed * 0.25);
    if (horizontalSpeed > 0.2) {
      this.walkPhase += dt * Math.min(12, horizontalSpeed * 1.72);
    }

    // Figure-eight walk bob plus a subtle idle breathing/sway cycle.
    const bobX = Math.cos(this.walkPhase) * 0.021 * movement;
    const bobY = Math.abs(Math.sin(this.walkPhase)) * 0.026 * movement;
    const breathe = Math.sin(this.elapsed * 1.65);
    const idleX = Math.sin(this.elapsed * 0.72) * 0.0045;
    const idleY = breathe * 0.004;

    // Ease the equipped item upward from below the screen.
    const equipEase = 1 - Math.pow(1 - this.equipProgress, 3);
    const equipDrop = (1 - equipEase) * 0.42;
    const equipTilt = (1 - equipEase) * 0.75;

    // Mining arc and short forward placement jab are layered independently.
    const swing = Math.sin(this.swingProgress * Math.PI);
    const swingTwist = Math.sin(this.swingProgress * Math.PI * 2);
    const place = Math.sin(this.placeProgress * Math.PI);

    this.root.position.set(
      0.38 + bobX + idleX - swing * 0.13,
      -0.32 - bobY + idleY - swing * 0.075 - equipDrop + place * 0.025,
      -0.52 - swing * 0.13 - place * 0.16
    );
    this.root.rotation.set(
      -swing * 0.88 + place * 0.18 + breathe * 0.008,
      swingTwist * 0.26 - place * 0.12 + idleX * 0.8,
      swing * 0.38 + equipTilt + bobX * 1.5
    );

    // The off-hand remains low and reacts opposite the dominant arm for depth.
    this.leftHand.position.set(-0.63 - bobX * 0.45, -0.23 + bobY * 0.35, 0.07 + swing * 0.03);
    this.leftHand.rotation.z = -0.18 - bobX * 1.8;
    this.leftHand.rotation.x = -0.52 + bobY * 1.8;

    // Hide right fist behind large items, but retain the wrist for sprites/tools.
    this.rightHand.visible = this.currentItemId === null || this.visualObj !== null;
    this.rightHand.position.set(0.03, -0.12, 0.085);
    this.itemPivot.position.set(0, 0, 0);
  }

  private buildHands(): void {
    const skinTop = this.skinMaterial(0xe7b486);
    const skinSide = this.skinMaterial(0xc9875c);
    const skinShadow = this.skinMaterial(0xa96343);
    const sleeve = this.skinMaterial(0x34745a);
    const sleeveShadow = this.skinMaterial(0x24543f);

    // Right wrist/hand grips held sprites and remains the empty-hand fist.
    const forearm = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.42, 0.18),
      [skinSide, skinShadow, skinTop, skinShadow, skinSide, skinShadow]
    );
    forearm.position.set(0.035, -0.15, 0.095);
    forearm.rotation.set(-0.64, -0.3, 0.2);
    forearm.renderOrder = 21;
    this.rightHand.add(forearm);

    const cuff = new THREE.Mesh(
      new THREE.BoxGeometry(0.185, 0.16, 0.195),
      [sleeve, sleeveShadow, sleeve, sleeveShadow, sleeve, sleeveShadow]
    );
    cuff.position.set(0.015, -0.34, 0.11);
    cuff.rotation.copy(forearm.rotation);
    cuff.renderOrder = 20;
    this.rightHand.add(cuff);

    // A restrained off-hand silhouette grounds the two-handed first-person rig.
    const leftArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.43, 0.19),
      [skinSide, skinShadow, skinTop, skinShadow, skinSide, skinShadow]
    );
    leftArm.rotation.set(-0.52, 0.28, -0.18);
    leftArm.renderOrder = 19;
    this.leftHand.add(leftArm);

    const leftCuff = new THREE.Mesh(
      new THREE.BoxGeometry(0.195, 0.17, 0.205),
      [sleeve, sleeveShadow, sleeve, sleeveShadow, sleeve, sleeveShadow]
    );
    leftCuff.position.set(0, -0.26, 0.01);
    leftCuff.rotation.copy(leftArm.rotation);
    leftCuff.renderOrder = 18;
    this.leftHand.add(leftCuff);
  }

  private skinMaterial(color: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
  }

  private buildBlockMesh(blockId: BlockId): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;
    const faces = BLOCKS[blockId].faces;
    for (let f = 0; f < 6; f++) {
      const [u0, v0, u1, v1] = this.atlas.getTileUVs(faces[f]);
      const base = f * 4;
      uvAttr.setXY(base, u0, v1);
      uvAttr.setXY(base + 1, u1, v1);
      uvAttr.setXY(base + 2, u0, v0);
      uvAttr.setXY(base + 3, u1, v0);
    }
    uvAttr.needsUpdate = true;

    // Directional face tint gives the held cube readable voxel shading even though
    // the world uses custom chunk shaders and has no conventional scene lights.
    const shades = [0xd9e7da, 0x96aa99, 0xffffff, 0x758679, 0xc4d2c5, 0x87998a];
    const materials = shades.map(
      (shade) =>
        new THREE.MeshBasicMaterial({
          map: this.atlas.texture,
          color: shade,
          alphaTest: 0.5,
          depthTest: false,
          depthWrite: false,
          fog: false,
        })
    );
    return new THREE.Mesh(geo, materials);
  }

  private disposeVisual(obj: THREE.Object3D): void {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      // Atlas texture is shared; CanvasTextures belong to this visual.
      const basic = material as THREE.MeshBasicMaterial;
      if (basic.map && basic.map !== this.atlas.texture) {
        basic.map.dispose();
      }
      material.dispose();
    }
  }
}
