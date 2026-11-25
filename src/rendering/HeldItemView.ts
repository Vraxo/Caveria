import * as THREE from 'three';
import { ITEMS, ItemId, ItemStack } from '../items/Item';
import { BLOCKS, BlockId } from '../world/Block';
import { TextureAtlas } from './TextureAtlas';

export class HeldItemView {
  private readonly pivot = new THREE.Group();
  private readonly atlas: TextureAtlas;
  private currentItemId: ItemId | null = -1 as unknown as ItemId;
  private visualObj: THREE.Object3D | null = null;

  private walkPhase = 0;
  private swingProgress = 0;
  private swinging = false;

  private readonly armMaterial = new THREE.MeshBasicMaterial({ color: 0xd9a074 });
  private readonly atlasMaterial: THREE.MeshBasicMaterial;

  constructor(camera: THREE.PerspectiveCamera, atlas: TextureAtlas) {
    this.atlas = atlas;
    this.atlasMaterial = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      alphaTest: 0.5,
    });

    camera.add(this.pivot);
    this.setEquipped(null);
  }

  public triggerSwing(): void {
    if (!this.swinging || this.swingProgress > 0.45) {
      this.swinging = true;
      this.swingProgress = 0;
    }
  }

  public setEquipped(stack: ItemStack | null): void {
    const nextId = stack ? stack.id : null;
    if (nextId === this.currentItemId) return;
    this.currentItemId = nextId;

    if (this.visualObj) {
      this.pivot.remove(this.visualObj);
      this.visualObj = null;
    }

    if (nextId === null) {
      // Classic voxel right arm
      const armGeo = new THREE.BoxGeometry(0.16, 0.48, 0.16);
      const arm = new THREE.Mesh(armGeo, this.armMaterial);
      arm.rotation.set(-0.65, -0.35, 0.25);
      arm.renderOrder = 20;
      this.visualObj = arm;
      this.pivot.add(arm);
      return;
    }

    const def = ITEMS[nextId];
    if (def.placeBlockId !== null && BLOCKS[def.placeBlockId].shape === 'cube') {
      const cube = this.buildBlockMesh(def.placeBlockId);
      cube.rotation.set(0.18, -0.72, 0.08);
      cube.renderOrder = 20;
      this.visualObj = cube;
      this.pivot.add(cube);
      return;
    }

    // Flat 2D pixel tool/item/flora held at crisp angle
    const canvas =
      def.placeBlockId !== null
        ? this.atlas.createBlockIcon(def.placeBlockId)
        : this.atlas.getOrCreateItemSprite16(nextId);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;

    const quadGeo = new THREE.PlaneGeometry(0.42, 0.42);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const sprite = new THREE.Mesh(quadGeo, mat);
    sprite.rotation.set(0.08, -0.45, -0.18);
    sprite.renderOrder = 25;
    this.visualObj = sprite;
    this.pivot.add(sprite);
  }

  public update(dt: number, horizontalSpeed: number, isMining: boolean): void {
    if (isMining && !this.swinging) {
      this.swinging = true;
      this.swingProgress = 0;
    }

    if (this.swinging) {
      this.swingProgress += dt * 4.2;
      if (this.swingProgress >= 1) {
        if (isMining) {
          this.swingProgress = 0;
        } else {
          this.swingProgress = 0;
          this.swinging = false;
        }
      }
    }

    if (horizontalSpeed > 0.2) {
      this.walkPhase += dt * Math.min(11, horizontalSpeed * 1.65);
    }

    const bobX = Math.cos(this.walkPhase) * 0.018 * Math.min(1, horizontalSpeed * 0.25);
    const bobY = Math.abs(Math.sin(this.walkPhase)) * 0.022 * Math.min(1, horizontalSpeed * 0.25);

    const s = Math.sin(this.swingProgress * Math.PI);
    const s2 = Math.sin(this.swingProgress * Math.PI * 2);

    this.pivot.position.set(0.38 + bobX - s * 0.12, -0.32 - bobY - s * 0.08, -0.52 - s * 0.12);
    this.pivot.rotation.set(-s * 0.85, s2 * 0.25, s * 0.35);
  }

  private buildBlockMesh(blockId: BlockId): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;
    const faces = BLOCKS[blockId].faces;
    for (let f = 0; f < 6; f++) {
      const [u0, v0, u1, v1] = this.atlas.getTileUVs(faces[f]);
      const base = f * 4;
      uvAttr.setXY(base + 0, u0, v1);
      uvAttr.setXY(base + 1, u1, v1);
      uvAttr.setXY(base + 2, u0, v0);
      uvAttr.setXY(base + 3, u1, v0);
    }
    uvAttr.needsUpdate = true;

    const mat = this.atlasMaterial.clone();
    mat.depthTest = false;
    return new THREE.Mesh(geo, mat);
  }
}
