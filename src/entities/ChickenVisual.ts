import * as THREE from 'three';

export interface ChickenVisual {
  root: THREE.Group;
  body: THREE.Group;
  material: THREE.MeshBasicMaterial;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  legs: THREE.Mesh[];
}

interface ChickenAnimationState {
  age: number;
  hurt: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

const BODY_GEOMETRY = new THREE.BoxGeometry(0.46, 0.38, 0.5);
const HEAD_GEOMETRY = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const WING_GEOMETRY = new THREE.BoxGeometry(0.08, 0.3, 0.34);
const LEG_GEOMETRY = new THREE.BoxGeometry(0.055, 0.22, 0.055);
const BEAK_GEOMETRY = new THREE.BoxGeometry(0.2, 0.11, 0.17);
const COMB_GEOMETRY = new THREE.BoxGeometry(0.1, 0.12, 0.18);
const EYE_GEOMETRY = new THREE.BoxGeometry(0.055, 0.055, 0.025);
const BEAK_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xe8a62e });
const COMB_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xc93636 });
const LEG_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xc98b2c });
const EYE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x1e1b1a });

export function createChickenVisual(): ChickenVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const material = new THREE.MeshBasicMaterial({ color: 0xf2eee2 });
  const torso = new THREE.Mesh(BODY_GEOMETRY, material);
  torso.position.y = 0.37;
  body.add(torso);

  const head = new THREE.Mesh(HEAD_GEOMETRY, material);
  head.position.set(0, 0.58, 0.31);
  body.add(head);

  const beak = new THREE.Mesh(BEAK_GEOMETRY, BEAK_MATERIAL);
  beak.position.set(0, 0.53, 0.52);
  body.add(beak);

  const comb = new THREE.Mesh(COMB_GEOMETRY, COMB_MATERIAL);
  comb.position.set(0, 0.78, 0.29);
  body.add(comb);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(EYE_GEOMETRY, EYE_MATERIAL);
    eye.position.set(side * 0.155, 0.64, 0.43);
    body.add(eye);
  }

  const leftWing = new THREE.Mesh(WING_GEOMETRY, material);
  leftWing.position.set(-0.27, 0.39, -0.02);
  body.add(leftWing);
  const rightWing = new THREE.Mesh(WING_GEOMETRY, material);
  rightWing.position.set(0.27, 0.39, -0.02);
  body.add(rightWing);

  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(LEG_GEOMETRY, LEG_MATERIAL);
    leg.position.set(side * 0.12, 0.12, 0.02);
    body.add(leg);
    legs.push(leg);
  }

  return { root, body, material, leftWing, rightWing, legs };
}

export function updateChickenVisual(
  visual: ChickenVisual,
  state: ChickenAnimationState
): void {
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  if (speed > 0.06) visual.root.rotation.y = Math.atan2(state.velocity.x, state.velocity.z);

  const gait = Math.sin(state.age * (speed > 0.2 ? 12 : 2.5));
  visual.body.position.y = Math.abs(gait) * 0.025;
  visual.legs[0].rotation.x = gait * 0.45;
  visual.legs[1].rotation.x = -gait * 0.45;
  const wingFlap = speed > 1 ? Math.sin(state.age * 17) * 0.35 : gait * 0.05;
  visual.leftWing.rotation.z = wingFlap;
  visual.rightWing.rotation.z = -wingFlap;
  visual.material.color.setHex(state.hurt ? 0xff9b9b : 0xf2eee2);
  visual.root.position.copy(state.position);
}

export function disposeChickenVisual(visual: ChickenVisual): void {
  visual.material.dispose();
}
