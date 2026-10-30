import * as THREE from "three";
import { shade, voxelMesh, type Voxel } from "./voxel";

const SKIN_TONES = ["#f2c9a0", "#d9a77a", "#b98257", "#8d5a3b", "#6b4329"];

/**
 * A small blocky student character (about 1.4 units tall) in the student's colour.
 * Arms are separate so worlds can make them wave.
 */
export function buildAvatar(color: string, seed: number) {
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const hair = seed % 3 === 0 ? "#3b2a1e" : seed % 3 === 1 ? "#1f1a17" : "#6b4a2b";
  const pants = shade(color, -0.25);

  const body: Voxel[] = [];
  // legs
  for (let y = 0; y < 3; y++) {
    body.push([-1, y, 0, pants], [1, y, 0, pants]);
  }
  // shirt
  for (let y = 3; y < 6; y++) for (let x = -1; x <= 1; x++) body.push([x, y, 0, color]);
  // head + hair + eyes
  for (let y = 6; y < 9; y++)
    for (let x = -1; x <= 1; x++) body.push([x, y, 0, y === 8 ? hair : skin]);
  body.push([-1, 7, 1, "#1f2937"], [1, 7, 1, "#1f2937"]);

  const size = 0.16;
  const group = new THREE.Group();
  group.add(voxelMesh(body, size));

  const arm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 2 * size, 5.5 * size, 0);
    const mesh = voxelMesh([[0, -1, 0, color], [0, -2, 0, skin]], size);
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  };
  const leftArm = arm(-1);
  const rightArm = arm(1);

  return {
    group,
    /** 0 = arms down, 1 = full wave */
    setWave(amount: number, time: number) {
      rightArm.rotation.z = amount * (2.4 + Math.sin(time * 14) * 0.4);
      leftArm.rotation.z = -amount * 0.4;
    },
  };
}
