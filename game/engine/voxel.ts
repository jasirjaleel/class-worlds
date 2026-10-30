import * as THREE from "three";

/** One block: grid position plus colour. */
export type Voxel = [x: number, y: number, z: number, color: string];

const cube = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshLambertMaterial();

/** Draws a whole model of blocks in one draw call. `size` is the block size in world units. */
export function voxelMesh(voxels: Voxel[], size = 1): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(cube, material, Math.max(voxels.length, 1));
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  voxels.forEach(([x, y, z, color], i) => {
    m.makeScale(size, size, size).setPosition(x * size, y * size, z * size);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(color));
  });
  mesh.count = voxels.length;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Blocks filling a sphere, coloured by a function of position (for planets, bushes, clouds). */
export function voxelSphere(radius: number, colorAt: (x: number, y: number, z: number) => string): Voxel[] {
  const out: Voxel[] = [];
  const r = Math.ceil(radius);
  for (let x = -r; x <= r; x++)
    for (let y = -r; y <= r; y++)
      for (let z = -r; z <= r; z++) {
        const d = Math.sqrt(x * x + y * y + z * z);
        // only the outer shell: the inside is never seen
        if (d <= radius && d > radius - 1.8) out.push([x, y, z, colorAt(x, y, z)]);
      }
  return out;
}

/** Deterministic pseudo-random number from a seed, so worlds look the same every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function shade(hex: string, amount: number): string {
  return "#" + new THREE.Color(hex).offsetHSL(0, 0, amount).getHexString();
}
