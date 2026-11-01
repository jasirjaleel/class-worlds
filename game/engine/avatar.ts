import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const LIMB = 0.075;
const ARM_REST = 0.35;

/** A stick from one point to another. */
function stick(from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
  const line = to.clone().sub(from);
  const geometry = new THREE.CylinderGeometry(LIMB, LIMB, line.length(), 8);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), line.clone().normalize()));
  const middle = from.clone().add(to).multiplyScalar(0.5);
  geometry.translate(middle.x, middle.y, middle.z);
  return geometry;
}

const SHOULDER_Y = 0.98;

// One shape shared by every student: head, body and legs, with arms apart so they can wave
let bodyShape: THREE.BufferGeometry | null = null;
let armShape: THREE.BufferGeometry | null = null;

function bodyGeometry() {
  if (bodyShape) return bodyShape;
  const hip = new THREE.Vector3(0, 0.6, 0);
  const head = new THREE.SphereGeometry(0.2, 16, 12);
  head.translate(0, 1.27, 0);
  bodyShape = mergeGeometries([
    head,
    stick(hip, new THREE.Vector3(0, 1.1, 0)),
    stick(hip, new THREE.Vector3(-0.22, 0, 0)),
    stick(hip, new THREE.Vector3(0.22, 0, 0)),
  ]);
  return bodyShape;
}

function armGeometry() {
  armShape ??= stick(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.44, 0));
  return armShape;
}

/**
 * A simple stick figure (about 1.45 units tall) in the student's colour, with no
 * face. Arms are separate so worlds can make them wave.
 */
export function buildAvatar(color: string) {
  const material = new THREE.MeshLambertMaterial({ color });
  const group = new THREE.Group();

  const body = new THREE.Mesh(bodyGeometry(), material);
  body.castShadow = true;
  group.add(body);

  const arm = () => {
    const pivot = new THREE.Group();
    pivot.position.set(0, SHOULDER_Y, 0);
    const mesh = new THREE.Mesh(armGeometry(), material);
    mesh.castShadow = true;
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  };
  const leftArm = arm();
  const rightArm = arm();
  leftArm.rotation.z = -ARM_REST;
  rightArm.rotation.z = ARM_REST;

  return {
    group,
    /** 0 = arms down, 1 = full wave */
    setWave(amount: number, time: number) {
      rightArm.rotation.z = ARM_REST + amount * (2.1 + Math.sin(time * 14) * 0.4);
      leftArm.rotation.z = -ARM_REST - amount * 0.4;
    },
  };
}
