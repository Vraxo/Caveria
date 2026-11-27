import * as THREE from 'three';

export interface WildlifeVisual {
  root: THREE.Group;
  body: THREE.Group;
  material: THREE.MeshBasicMaterial;
  legs: THREE.Mesh[];
  wings: THREE.Mesh[];
}

export interface WildlifeAnimationState {
  age: number;
  hurt: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

const DARK = new THREE.MeshBasicMaterial({ color: 0x211b18 });
const BEAK = new THREE.MeshBasicMaterial({ color: 0xc98a2d });

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function visual(color: number): WildlifeVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color });
  material.userData.baseColor = color;
  root.add(body);
  return {
    root,
    body,
    material,
    legs: [],
    wings: [],
  };
}

function eyePair(target: WildlifeVisual, y: number, z: number, spacing: number): void {
  for (const side of [-1, 1]) {
    target.body.add(part(new THREE.BoxGeometry(0.045, 0.045, 0.025), DARK, side * spacing, y, z));
  }
}

export function createCamelVisual(): WildlifeVisual {
  const result = visual(0xc49a62);
  result.body.add(part(new THREE.BoxGeometry(1.15, 0.68, 1.55), result.material, 0, 1.15, 0));
  result.body.add(part(new THREE.BoxGeometry(0.72, 0.55, 0.62), result.material, 0, 1.95, 0.72));
  result.body.add(part(new THREE.BoxGeometry(0.34, 0.9, 0.36), result.material, 0, 1.55, 0.52));
  result.body.add(part(new THREE.BoxGeometry(0.62, 0.46, 0.72), result.material, 0, 1.72, -0.32));
  for (const side of [-1, 1]) {
    for (const z of [-0.48, 0.48]) {
      const leg = part(new THREE.BoxGeometry(0.19, 1.05, 0.22), result.material, side * 0.38, 0.52, z);
      result.body.add(leg);
      result.legs.push(leg);
    }
  }
  eyePair(result, 2.06, 1.04, 0.2);
  return result;
}

export function createLizardVisual(): WildlifeVisual {
  const result = visual(0x8d9b4f);
  result.body.add(part(new THREE.BoxGeometry(0.42, 0.2, 0.75), result.material, 0, 0.16, 0));
  result.body.add(part(new THREE.BoxGeometry(0.32, 0.23, 0.3), result.material, 0, 0.2, 0.48));
  const tail = part(new THREE.BoxGeometry(0.15, 0.13, 0.75), result.material, 0, 0.14, -0.68);
  tail.rotation.x = -0.08;
  result.body.add(tail);
  for (const side of [-1, 1]) {
    for (const z of [-0.2, 0.26]) {
      const leg = part(new THREE.BoxGeometry(0.32, 0.08, 0.1), result.material, side * 0.28, 0.1, z);
      leg.rotation.y = side * 0.35;
      result.body.add(leg);
      result.legs.push(leg);
    }
  }
  eyePair(result, 0.27, 0.64, 0.14);
  return result;
}

export function createScorpionVisual(): WildlifeVisual {
  const result = visual(0x6f4931);
  result.body.add(part(new THREE.BoxGeometry(0.62, 0.24, 0.8), result.material, 0, 0.2, 0));
  result.body.add(part(new THREE.BoxGeometry(0.48, 0.2, 0.38), result.material, 0, 0.2, 0.52));
  for (const side of [-1, 1]) {
    for (const z of [-0.3, -0.08, 0.16, 0.38]) {
      const leg = part(new THREE.BoxGeometry(0.45, 0.07, 0.08), result.material, side * 0.42, 0.13, z);
      leg.rotation.y = side * (0.28 + z * 0.15);
      result.body.add(leg);
      result.legs.push(leg);
    }
    const claw = part(new THREE.BoxGeometry(0.28, 0.12, 0.22), result.material, side * 0.42, 0.2, 0.75);
    result.body.add(claw);
  }
  for (let index = 0; index < 4; index++) {
    result.body.add(part(
      new THREE.BoxGeometry(0.18, 0.18, 0.24),
      result.material,
      0,
      0.28 + index * 0.17,
      -0.48 - index * 0.13
    ));
  }
  const stinger = part(new THREE.BoxGeometry(0.14, 0.22, 0.14), DARK, 0, 0.92, -0.91);
  stinger.rotation.x = 0.35;
  result.body.add(stinger);
  eyePair(result, 0.3, 0.73, 0.13);
  return result;
}

export function createSnakeVisual(): WildlifeVisual {
  const result = visual(0xc89a45);
  for (let index = 0; index < 7; index++) {
    const z = (index - 3) * 0.2;
    const segment = part(
      new THREE.BoxGeometry(0.3 - Math.abs(index - 3) * 0.025, 0.2, 0.28),
      result.material,
      Math.sin(index * 1.2) * 0.09,
      0.15,
      z
    );
    result.body.add(segment);
  }
  const head = part(new THREE.BoxGeometry(0.4, 0.24, 0.34), result.material, 0, 0.2, 0.82);
  result.body.add(head);
  eyePair(result, 0.28, 1, 0.17);
  return result;
}

export function createVultureVisual(): WildlifeVisual {
  const result = visual(0x493d35);
  result.body.add(part(new THREE.BoxGeometry(0.52, 0.48, 0.72), result.material, 0, 0.42, 0));
  result.body.add(part(new THREE.BoxGeometry(0.3, 0.3, 0.32), result.material, 0, 0.66, 0.43));
  result.body.add(part(new THREE.BoxGeometry(0.2, 0.14, 0.28), BEAK, 0, 0.62, 0.72));
  for (const side of [-1, 1]) {
    const wing = part(new THREE.BoxGeometry(0.85, 0.1, 0.56), result.material, side * 0.57, 0.45, -0.02);
    result.body.add(wing);
    result.wings.push(wing);
  }
  eyePair(result, 0.72, 0.6, 0.14);
  return result;
}

export function updateGroundWildlifeVisual(
  visual: WildlifeVisual,
  state: WildlifeAnimationState
): void {
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  if (speed > 0.04) visual.root.rotation.y = Math.atan2(state.velocity.x, state.velocity.z);
  const gait = Math.sin(state.age * (speed > 0.2 ? 9 : 2));
  visual.body.position.y = Math.abs(gait) * Math.min(0.05, speed * 0.03);
  visual.legs.forEach((leg, index) => { leg.rotation.x = gait * (index % 2 ? -0.35 : 0.35); });
  visual.material.color.setHex(state.hurt ? 0xff8e8e : visual.material.userData.baseColor ?? visual.material.color.getHex());
  if (!state.hurt && visual.material.userData.baseColor !== undefined) {
    visual.material.color.setHex(visual.material.userData.baseColor);
  }
  visual.root.position.copy(state.position);
}

export function updateVultureVisual(
  visual: WildlifeVisual,
  state: WildlifeAnimationState
): void {
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  if (speed > 0.04) visual.root.rotation.y = Math.atan2(state.velocity.x, state.velocity.z);
  const flap = Math.sin(state.age * 8) * 0.65;
  visual.wings[0].rotation.z = flap;
  visual.wings[1].rotation.z = -flap;
  visual.body.rotation.x = Math.max(-0.25, Math.min(0.25, -state.velocity.y * 0.08));
  visual.material.color.setHex(state.hurt ? 0xff8e8e : 0x493d35);
  visual.root.position.copy(state.position);
}

export function disposeWildlifeVisual(visual: WildlifeVisual): void {
  visual.material.dispose();
}
