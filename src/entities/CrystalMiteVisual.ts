import * as THREE from 'three';

export interface CrystalMiteVisual {
  root: THREE.Group;
  body: THREE.Group;
  shell: THREE.Mesh;
  shellMaterial: THREE.MeshBasicMaterial;
  legs: THREE.Mesh[];
}

interface CrystalMiteAnimationState {
  id: number;
  age: number;
  hurt: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

const BODY_GEOMETRY = new THREE.BoxGeometry(0.4, 0.22, 0.48);
const SHELL_GEOMETRY = new THREE.OctahedronGeometry(0.25, 0);
const EYE_GEOMETRY = new THREE.BoxGeometry(0.075, 0.075, 0.045);
const LEG_GEOMETRY = new THREE.BoxGeometry(0.07, 0.08, 0.28);
const BODY_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x30263b });
const EYE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xcffafe });
const LEG_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x4b3757 });

/** Creates the procedural model while keeping visual construction out of the behavior lifecycle. */
export function createCrystalMiteVisual(): CrystalMiteVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const abdomen = new THREE.Mesh(BODY_GEOMETRY, BODY_MATERIAL);
  abdomen.position.y = 0.14;
  body.add(abdomen);

  const shellMaterial = new THREE.MeshBasicMaterial({ color: 0xb45de8 });
  const shell = new THREE.Mesh(SHELL_GEOMETRY, shellMaterial);
  shell.scale.set(0.78, 0.92, 0.95);
  shell.position.set(0, 0.31, -0.02);
  shell.rotation.y = Math.PI / 4;
  body.add(shell);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(EYE_GEOMETRY, EYE_MATERIAL);
    eye.position.set(side * 0.115, 0.24, 0.245);
    body.add(eye);
  }

  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    for (const zOffset of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(LEG_GEOMETRY, LEG_MATERIAL);
      leg.position.set(side * 0.22, 0.08, zOffset);
      leg.rotation.z = side * 0.72;
      body.add(leg);
      legs.push(leg);
    }
  }

  return { root, body, shell, shellMaterial, legs };
}

export function updateCrystalMiteVisual(
  visual: CrystalMiteVisual,
  state: CrystalMiteAnimationState
): void {
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  if (speed > 0.08) {
    visual.root.rotation.y = Math.atan2(state.velocity.x, state.velocity.z);
  }

  const gait = Math.sin(state.age * (speed > 0.2 ? 11 : 2.4));
  visual.body.position.y = 0.2 + Math.abs(gait) * 0.025;
  visual.body.rotation.z = gait * Math.min(0.08, speed * 0.035);
  for (let index = 0; index < visual.legs.length; index++) {
    visual.legs[index].rotation.x = (index % 2 === 0 ? gait : -gait) * 0.42;
  }

  const shellPulse = 0.92 + Math.sin(state.age * 3.1 + state.id) * 0.08;
  visual.shell.scale.setScalar(shellPulse);
  visual.shellMaterial.color.setHex(state.hurt ? 0xffffff : 0xb45de8);
  visual.root.position.copy(state.position);
}

export function disposeCrystalMiteVisual(visual: CrystalMiteVisual): void {
  visual.shellMaterial.dispose();
}
