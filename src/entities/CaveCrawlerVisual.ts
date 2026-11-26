import * as THREE from 'three';

export interface CaveCrawlerVisual {
  root: THREE.Group;
  body: THREE.Group;
  material: THREE.MeshBasicMaterial;
  legs: THREE.Mesh[];
}

interface CaveCrawlerAnimationState {
  age: number;
  hurt: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

const BODY_GEOMETRY = new THREE.BoxGeometry(0.58, 0.3, 0.72);
const HEAD_GEOMETRY = new THREE.BoxGeometry(0.42, 0.3, 0.38);
const LEG_GEOMETRY = new THREE.BoxGeometry(0.09, 0.1, 0.42);
const EYE_GEOMETRY = new THREE.BoxGeometry(0.08, 0.08, 0.05);
const LEG_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x281d1b });
const EYE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xff5538 });

/** Creates the procedural model while keeping visual construction out of the AI lifecycle. */
export function createCaveCrawlerVisual(): CaveCrawlerVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const material = new THREE.MeshBasicMaterial({ color: 0x50302b });
  const carapace = new THREE.Mesh(BODY_GEOMETRY, material);
  carapace.position.y = 0.26;
  body.add(carapace);

  const head = new THREE.Mesh(HEAD_GEOMETRY, material);
  head.position.set(0, 0.22, 0.42);
  body.add(head);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(EYE_GEOMETRY, EYE_MATERIAL);
    eye.position.set(side * 0.12, 0.29, 0.62);
    body.add(eye);
  }

  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    for (const zOffset of [-0.25, 0, 0.25]) {
      const leg = new THREE.Mesh(LEG_GEOMETRY, LEG_MATERIAL);
      leg.position.set(side * 0.34, 0.09, zOffset);
      leg.rotation.z = side * 0.75;
      body.add(leg);
      legs.push(leg);
    }
  }

  return { root, body, material, legs };
}

export function updateCaveCrawlerVisual(
  visual: CaveCrawlerVisual,
  state: CaveCrawlerAnimationState
): void {
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  if (speed > 0.08) {
    visual.root.rotation.y = Math.atan2(state.velocity.x, state.velocity.z);
  }

  const gait = Math.sin(state.age * (speed > 0.25 ? 12 : 2));
  visual.body.position.y = 0.25 + Math.abs(gait) * 0.035;
  for (let index = 0; index < visual.legs.length; index++) {
    visual.legs[index].rotation.x = (index % 2 === 0 ? gait : -gait) * 0.48;
  }

  visual.material.color.setHex(state.hurt ? 0xffffff : 0x50302b);
  visual.root.position.copy(state.position);
}

export function disposeCaveCrawlerVisual(visual: CaveCrawlerVisual): void {
  visual.material.dispose();
}
