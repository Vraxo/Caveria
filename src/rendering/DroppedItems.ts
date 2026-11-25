import * as THREE from 'three';
import { Inventory } from '../items/Inventory';
import { ITEMS, ItemId, ItemStack } from '../items/Item';
import { BLOCKS, BlockId, isBlockSolid } from '../world/Block';
import { World } from '../world/World';
import { TextureAtlas } from './TextureAtlas';

interface DroppedEntity {
  group: THREE.Group;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  stack: ItemStack;
  age: number;
  pickupDelay: number;
  bobOffset: number;
}

const DROP_GRAVITY = 20.0;
const MAGNET_RADIUS = 1.95;
const COLLECT_RADIUS = 0.72;
const DESPAWN_SECONDS = 300;

export class DroppedItemManager {
  private readonly scene: THREE.Scene;
  private readonly atlas: TextureAtlas;
  private readonly entities: DroppedEntity[] = [];

  private readonly blockGeoCache = new Map<BlockId, THREE.BufferGeometry>();
  private readonly spriteMatCache = new Map<ItemId, THREE.MeshBasicMaterial>();
  private readonly atlasBlockMaterial: THREE.MeshBasicMaterial;
  private readonly flatQuadGeo = new THREE.PlaneGeometry(0.38, 0.38);
  private readonly onPickup?: (itemId: ItemId) => void;

  constructor(scene: THREE.Scene, atlas: TextureAtlas, onPickup?: (itemId: ItemId) => void) {
    this.scene = scene;
    this.atlas = atlas;
    this.onPickup = onPickup;
    this.atlasBlockMaterial = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      alphaTest: 0.5,
    });
  }

  public spawnDrop(
    wx: number,
    wy: number,
    wz: number,
    stack: ItemStack,
    customVel?: THREE.Vector3,
    pickupDelay = 0.35
  ): void {
    const group = new THREE.Group();
    const mesh = this.createVisualMesh(stack.id);
    group.add(mesh);

    const pos = new THREE.Vector3(wx, wy, wz);
    const vel =
      customVel ??
      new THREE.Vector3(
        (Math.random() - 0.5) * 2.6,
        3.2 + Math.random() * 1.4,
        (Math.random() - 0.5) * 2.6
      );

    group.position.copy(pos);
    this.scene.add(group);

    this.entities.push({
      group,
      mesh,
      pos,
      vel,
      stack: { ...stack },
      age: 0,
      pickupDelay,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }

  public update(
    dt: number,
    world: World,
    playerFeetPos: THREE.Vector3,
    inventory: Inventory
  ): void {
    const targetCenter = new THREE.Vector3(
      playerFeetPos.x,
      playerFeetPos.y + 0.9,
      playerFeetPos.z
    );

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.age += dt;

      if (e.age > DESPAWN_SECONDS) {
        this.removeEntity(i);
        continue;
      }

      // Physics & voxel floor collision
      e.vel.y -= DROP_GRAVITY * dt;
      e.vel.x *= Math.pow(0.18, dt);
      e.vel.z *= Math.pow(0.18, dt);

      // Vertical step
      const nextY = e.pos.y + e.vel.y * dt;
      const footBlock = world.getBlock(e.pos.x, nextY - 0.16, e.pos.z);
      if (e.vel.y < 0 && isBlockSolid(footBlock)) {
        e.pos.y = Math.floor(nextY - 0.16) + 1 + 0.16;
        e.vel.y = 0;
      } else {
        e.pos.y = nextY;
      }

      // Horizontal step
      const nextX = e.pos.x + e.vel.x * dt;
      if (!isBlockSolid(world.getBlock(nextX, e.pos.y, e.pos.z))) {
        e.pos.x = nextX;
      } else {
        e.vel.x = 0;
      }

      const nextZ = e.pos.z + e.vel.z * dt;
      if (!isBlockSolid(world.getBlock(e.pos.x, e.pos.y, nextZ))) {
        e.pos.z = nextZ;
      } else {
        e.vel.z = 0;
      }

      // Pop up if stuck inside a newly placed solid block
      if (isBlockSolid(world.getBlock(e.pos.x, e.pos.y, e.pos.z))) {
        e.pos.y += 4.0 * dt;
      }

      // Magnetic pickup toward player
      if (e.age >= e.pickupDelay) {
        const dx = targetCenter.x - e.pos.x;
        const dy = targetCenter.y - e.pos.y;
        const dz = targetCenter.z - e.pos.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < COLLECT_RADIUS) {
          const pickedUp = inventory.addItem(e.stack);
          if (pickedUp) this.onPickup?.(e.stack.id);
          if (pickedUp && e.stack.count <= 0) {
            this.removeEntity(i);
            continue;
          }
        } else if (dist < MAGNET_RADIUS) {
          const pull = (1 - dist / MAGNET_RADIUS) * 14.0;
          e.pos.x += (dx / dist) * pull * dt;
          e.pos.y += (dy / dist) * pull * dt;
          e.pos.z += (dz / dist) * pull * dt;
        }
      }

      // Spin + hover bobbing + local voxel brightness tint
      const bob = Math.sin(e.age * 3.2 + e.bobOffset) * 0.07 + 0.07;
      e.group.position.set(e.pos.x, e.pos.y + bob, e.pos.z);
      e.mesh.rotation.y = e.age * 1.9 + e.bobOffset;
    }
  }

  public createVisualMesh(itemId: ItemId): THREE.Mesh {
    const def = ITEMS[itemId];
    if (def.placeBlockId !== null && BLOCKS[def.placeBlockId].shape === 'cube') {
      const geo = this.getOrCreateMiniBlockGeometry(def.placeBlockId);
      return new THREE.Mesh(geo, this.atlasBlockMaterial);
    }

    // Flat 2D pixel sprite for tools, torches, cross flora, sticks, coal, crystal shards
    let mat = this.spriteMatCache.get(itemId);
    if (!mat) {
      let canvas: HTMLCanvasElement;
      if (def.placeBlockId !== null) {
        canvas = this.atlas.createBlockIcon(def.placeBlockId);
      } else {
        canvas = this.atlas.getOrCreateItemSprite16(itemId);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;

      mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
      });
      this.spriteMatCache.set(itemId, mat);
    }

    return new THREE.Mesh(this.flatQuadGeo, mat);
  }

  private getOrCreateMiniBlockGeometry(blockId: BlockId): THREE.BufferGeometry {
    const cached = this.blockGeoCache.get(blockId);
    if (cached) return cached;

    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;
    const faces = BLOCKS[blockId].faces;

    // Three.js BoxGeometry face order matches our BlockDefinition.faces: [+x, -x, +y, -y, +z, -z]
    for (let f = 0; f < 6; f++) {
      const [u0, v0, u1, v1] = this.atlas.getTileUVs(faces[f]);
      const base = f * 4;
      uvAttr.setXY(base + 0, u0, v1);
      uvAttr.setXY(base + 1, u1, v1);
      uvAttr.setXY(base + 2, u0, v0);
      uvAttr.setXY(base + 3, u1, v0);
    }
    uvAttr.needsUpdate = true;

    this.blockGeoCache.set(blockId, geo);
    return geo;
  }

  private removeEntity(index: number): void {
    const e = this.entities[index];
    this.scene.remove(e.group);
    this.entities.splice(index, 1);
  }
}
