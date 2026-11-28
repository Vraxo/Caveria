import * as THREE from 'three';

export interface PolarBearVisual {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  furMaterial: THREE.MeshBasicMaterial;
  rumpMaterial: THREE.MeshBasicMaterial;
  snoutMaterial: THREE.MeshBasicMaterial;
  frontLegs: THREE.Mesh[];
  backLegs: THREE.Mesh[];
}

export interface PolarBearAnimationState {
  age: number;
  hurt: boolean;
  baby: boolean;
  rearAmount: number;
  facingAngle: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

const BASE_FUR_COLOR = 0xf2efe7;
const BASE_RUMP_COLOR = 0xe7e3d9;
const BASE_SNOUT_COLOR = 0xe2ddd2;
const HURT_COLOR = 0xff9b9b;

const TORSO_GEOMETRY = new THREE.BoxGeometry(0.96, 0.7, 1.04);
const RUMP_GEOMETRY = new THREE.BoxGeometry(1.04, 0.76, 0.68);
const HEAD_GEOMETRY = new THREE.BoxGeometry(0.56, 0.5, 0.54);
const SNOUT_GEOMETRY = new THREE.BoxGeometry(0.32, 0.24, 0.28);
const NOSE_GEOMETRY = new THREE.BoxGeometry(0.14, 0.09, 0.06);
const EAR_GEOMETRY = new THREE.BoxGeometry(0.13, 0.13, 0.08);
const EYE_GEOMETRY = new THREE.BoxGeometry(0.06, 0.06, 0.03);
const TAIL_GEOMETRY = new THREE.BoxGeometry(0.18, 0.16, 0.16);
const LEG_GEOMETRY = new THREE.BoxGeometry(0.28, 0.6, 0.3);
const PAW_GEOMETRY = new THREE.BoxGeometry(0.3, 0.1, 0.33);

const DARK_DETAIL_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x1a1c20 });
const PAW_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x8f949c });

function addLeg(
  parent: THREE.Group,
  material: THREE.Material,
  x: number,
  z: number
): THREE.Mesh {
  const leg = new THREE.Mesh(LEG_GEOMETRY, material);
  leg.position.set(x, 0.32, z);
  const paw = new THREE.Mesh(PAW_GEOMETRY, PAW_MATERIAL);
  paw.position.set(0, -0.26, 0.02);
  leg.add(paw);
  parent.add(leg);
  return leg;
}

export function createPolarBearVisual(): PolarBearVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const furMaterial = new THREE.MeshBasicMaterial({ color: BASE_FUR_COLOR });
  const rumpMaterial = new THREE.MeshBasicMaterial({ color: BASE_RUMP_COLOR });
  const snoutMaterial = new THREE.MeshBasicMaterial({ color: BASE_SNOUT_COLOR });

  // Broad shoulders & chest
  const torso = new THREE.Mesh(TORSO_GEOMETRY, furMaterial);
  torso.position.set(0, 0.86, 0.18);
  body.add(torso);

  // Heavy hindquarters
  const rump = new THREE.Mesh(RUMP_GEOMETRY, rumpMaterial);
  rump.position.set(0, 0.89, -0.52);
  body.add(rump);

  // Stubby arctic tail
  const tail = new THREE.Mesh(TAIL_GEOMETRY, rumpMaterial);
  tail.position.set(0, 0.92, -0.9);
  body.add(tail);

  // Head + snout + ears + dark nose/eyes
  const head = new THREE.Group();
  head.position.set(0, 0.9, 0.88);
  body.add(head);

  const cranium = new THREE.Mesh(HEAD_GEOMETRY, furMaterial);
  head.add(cranium);

  const snout = new THREE.Mesh(SNOUT_GEOMETRY, snoutMaterial);
  snout.position.set(0, -0.09, 0.36);
  head.add(snout);

  const nose = new THREE.Mesh(NOSE_GEOMETRY, DARK_DETAIL_MATERIAL);
  nose.position.set(0, -0.02, 0.51);
  head.add(nose);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(EAR_GEOMETRY, rumpMaterial);
    ear.position.set(side * 0.22, 0.27, -0.06);
    head.add(ear);

    const eye = new THREE.Mesh(EYE_GEOMETRY, DARK_DETAIL_MATERIAL);
    eye.position.set(side * 0.17, 0.06, 0.27);
    head.add(eye);
  }

  const frontLegs: THREE.Mesh[] = [];
  const backLegs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    frontLegs.push(addLeg(body, furMaterial, side * 0.32, 0.44));
    backLegs.push(addLeg(body, rumpMaterial, side * 0.35, -0.52));
  }

  return {
    root,
    body,
    head,
    furMaterial,
    rumpMaterial,
    snoutMaterial,
    frontLegs,
    backLegs,
  };
}

export function updatePolarBearVisual(
  visual: PolarBearVisual,
  state: PolarBearAnimationState
): void {
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  visual.root.rotation.y = speed > 0.08
    ? Math.atan2(state.velocity.x, state.velocity.z)
    : state.facingAngle;

  const rear = Math.max(0, Math.min(1, state.rearAmount));
  const gait = Math.sin(state.age * (speed > 0.25 ? 7.5 : 1.8));
  const stride = speed > 0.2 ? 0.42 : 0.04;

  // Rearing onto hind legs tilts body backward and raises the chest & front paws.
  visual.body.rotation.x = -rear * 0.58;
  visual.body.position.y = Math.abs(gait) * (speed > 0.2 ? 0.03 : 0.01) + rear * 0.34;
  visual.head.rotation.x = rear * 0.36;

  for (let index = 0; index < visual.frontLegs.length; index++) {
    const walkSwing = (index % 2 === 0 ? gait : -gait) * stride;
    const swipe = rear > 0.05 ? -0.85 * rear + Math.sin(state.age * 14 + index * 2.1) * 0.24 * rear : 0;
    visual.frontLegs[index].rotation.x = walkSwing * (1 - rear * 0.7) + swipe;
  }
  for (let index = 0; index < visual.backLegs.length; index++) {
    const walkSwing = (index % 2 === 0 ? -gait : gait) * stride;
    visual.backLegs[index].rotation.x = walkSwing * (1 - rear * 0.8) + rear * 0.45;
  }

  visual.furMaterial.color.setHex(state.hurt ? HURT_COLOR : BASE_FUR_COLOR);
  visual.rumpMaterial.color.setHex(state.hurt ? HURT_COLOR : BASE_RUMP_COLOR);
  visual.snoutMaterial.color.setHex(state.hurt ? HURT_COLOR : BASE_SNOUT_COLOR);

  const scale = state.baby ? 0.54 : 1;
  visual.root.scale.setScalar(scale);
  visual.head.scale.setScalar(state.baby ? 1.2 : 1);
  visual.root.position.copy(state.position);
}

export function disposePolarBearVisual(visual: PolarBearVisual): void {
  visual.furMaterial.dispose();
  visual.rumpMaterial.dispose();
  visual.snoutMaterial.dispose();
}
