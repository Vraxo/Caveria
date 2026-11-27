import * as THREE from 'three';

export interface RabbitVisual {
  root: THREE.Group;
  body: THREE.Group;
  material: THREE.MeshBasicMaterial;
  hindLegs: THREE.Mesh[];
  ears: THREE.Mesh[];
}

interface RabbitAnimationState {
  age: number;
  hurt: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

const BODY_GEOMETRY = new THREE.BoxGeometry(0.48, 0.36, 0.62);
const HEAD_GEOMETRY = new THREE.BoxGeometry(0.34, 0.34, 0.34);
const LEG_GEOMETRY = new THREE.BoxGeometry(0.18, 0.18, 0.3);
const EAR_GEOMETRY = new THREE.BoxGeometry(0.11, 0.42, 0.1);
const TAIL_GEOMETRY = new THREE.BoxGeometry(0.18, 0.18, 0.18);
const EYE_GEOMETRY = new THREE.BoxGeometry(0.055, 0.055, 0.025);
const NOSE_GEOMETRY = new THREE.BoxGeometry(0.08, 0.065, 0.05);
const EYE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x201a18 });
const NOSE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xb86f73 });
const TAIL_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xe8d7bb });

export function createRabbitVisual(): RabbitVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const material = new THREE.MeshBasicMaterial({ color: 0xb99268 });
  const torso = new THREE.Mesh(BODY_GEOMETRY, material);
  torso.position.y = 0.31;
  body.add(torso);

  const head = new THREE.Mesh(HEAD_GEOMETRY, material);
  head.position.set(0, 0.48, 0.38);
  body.add(head);

  const ears: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(EAR_GEOMETRY, material);
    ear.position.set(side * 0.1, 0.82, 0.34);
    ear.rotation.z = side * 0.08;
    body.add(ear);
    ears.push(ear);

    const eye = new THREE.Mesh(EYE_GEOMETRY, EYE_MATERIAL);
    eye.position.set(side * 0.175, 0.53, 0.49);
    body.add(eye);
  }

  const nose = new THREE.Mesh(NOSE_GEOMETRY, NOSE_MATERIAL);
  nose.position.set(0, 0.43, 0.58);
  body.add(nose);

  const tail = new THREE.Mesh(TAIL_GEOMETRY, TAIL_MATERIAL);
  tail.position.set(0, 0.38, -0.4);
  body.add(tail);

  const hindLegs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(LEG_GEOMETRY, material);
    leg.position.set(side * 0.2, 0.14, -0.16);
    body.add(leg);
    hindLegs.push(leg);
  }

  return { root, body, material, hindLegs, ears };
}

export function updateRabbitVisual(visual: RabbitVisual, state: RabbitAnimationState): void {
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  if (speed > 0.06) visual.root.rotation.y = Math.atan2(state.velocity.x, state.velocity.z);

  const hop = speed > 0.15 ? Math.max(0, Math.sin(state.age * 10)) : 0;
  visual.body.position.y = hop * 0.12;
  visual.body.rotation.x = -hop * 0.08;
  for (const leg of visual.hindLegs) leg.rotation.x = hop * 0.65;
  visual.ears[0].rotation.x = Math.sin(state.age * 2.4) * 0.04;
  visual.ears[1].rotation.x = Math.sin(state.age * 2.4 + 0.4) * 0.04;
  visual.material.color.setHex(state.hurt ? 0xff9292 : 0xb99268);
  visual.root.position.copy(state.position);
}

export function disposeRabbitVisual(visual: RabbitVisual): void {
  visual.material.dispose();
}
