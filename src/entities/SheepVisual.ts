import * as THREE from 'three';

export interface SheepVisual {
  root: THREE.Group;
  body: THREE.Group;
  woolMaterial: THREE.MeshBasicMaterial;
  legs: THREE.Mesh[];
}

interface SheepAnimationState {
  age: number;
  hurt: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

const WOOL_GEOMETRY = new THREE.BoxGeometry(0.85, 0.65, 1.05);
const HEAD_GEOMETRY = new THREE.BoxGeometry(0.45, 0.48, 0.43);
const MUZZLE_GEOMETRY = new THREE.BoxGeometry(0.34, 0.25, 0.2);
const LEG_GEOMETRY = new THREE.BoxGeometry(0.13, 0.52, 0.13);
const EAR_GEOMETRY = new THREE.BoxGeometry(0.2, 0.1, 0.12);
const EYE_GEOMETRY = new THREE.BoxGeometry(0.06, 0.06, 0.025);
const SKIN_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x65564e });
const MUZZLE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x88746a });
const LEG_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x554840 });
const EYE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x171514 });

export function createSheepVisual(): SheepVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const woolMaterial = new THREE.MeshBasicMaterial({ color: 0xe4e1d3 });
  const wool = new THREE.Mesh(WOOL_GEOMETRY, woolMaterial);
  wool.position.y = 0.7;
  body.add(wool);

  const head = new THREE.Mesh(HEAD_GEOMETRY, SKIN_MATERIAL);
  head.position.set(0, 0.72, 0.67);
  body.add(head);

  const muzzle = new THREE.Mesh(MUZZLE_GEOMETRY, MUZZLE_MATERIAL);
  muzzle.position.set(0, 0.62, 0.92);
  body.add(muzzle);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(EAR_GEOMETRY, SKIN_MATERIAL);
    ear.position.set(side * 0.31, 0.9, 0.65);
    ear.rotation.z = side * 0.25;
    body.add(ear);

    const eye = new THREE.Mesh(EYE_GEOMETRY, EYE_MATERIAL);
    eye.position.set(side * 0.23, 0.8, 0.9);
    body.add(eye);
  }

  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    for (const zOffset of [-0.32, 0.32]) {
      const leg = new THREE.Mesh(LEG_GEOMETRY, LEG_MATERIAL);
      leg.position.set(side * 0.29, 0.27, zOffset);
      body.add(leg);
      legs.push(leg);
    }
  }

  return { root, body, woolMaterial, legs };
}

export function updateSheepVisual(
  visual: SheepVisual,
  state: SheepAnimationState
): void {
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  if (speed > 0.06) visual.root.rotation.y = Math.atan2(state.velocity.x, state.velocity.z);

  const gait = Math.sin(state.age * (speed > 0.2 ? 9 : 2));
  visual.body.position.y = Math.abs(gait) * 0.025;
  for (let index = 0; index < visual.legs.length; index++) {
    visual.legs[index].rotation.x = (index % 2 === 0 ? gait : -gait) * 0.38;
  }
  visual.woolMaterial.color.setHex(state.hurt ? 0xff9b9b : 0xe4e1d3);
  visual.root.position.copy(state.position);
}

export function disposeSheepVisual(visual: SheepVisual): void {
  visual.woolMaterial.dispose();
}
