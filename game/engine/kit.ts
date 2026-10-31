import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Student } from "@/lib/types";
import type { Stage } from "./stage";
import type { Voxel } from "./voxel";

// Small building blocks shared by the worlds.

/** A student's name tag. Two-line text is allowed, split with \n. */
export function studentTag(stage: Stage, student: Student): CSS2DObject {
  const tag = stage.label(student.name);
  tag.element.style.setProperty("--c", student.color);
  tag.element.style.whiteSpace = "pre";
  tag.element.style.textAlign = "center";
  return tag;
}

/** Spots in a grid centred on the origin, a bit wider than deep so it suits a class screen. */
export function gridLayout(count: number, cellX: number, cellZ: number) {
  const n = Math.max(count, 1);
  const cols = Math.ceil(Math.sqrt(n * 1.8));
  const rows = Math.ceil(n / cols);
  const width = cols * cellX;
  const depth = rows * cellZ;
  return {
    width,
    depth,
    at: (i: number) => ({
      x: (i % cols) * cellX - width / 2 + cellX / 2,
      z: Math.floor(i / cols) * cellZ - depth / 2 + cellZ / 2,
    }),
  };
}

/** Fills a block of voxels; both ends of each range are included. */
export function voxelBox(
  out: Voxel[],
  x0: number, x1: number,
  y0: number, y1: number,
  z0: number, z1: number,
  color: string | (() => string),
) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) out.push([x, y, z, typeof color === "string" ? color : color()]);
}

/** A flat, rounded puff of cloud. */
export function cloudVoxels(rand: () => number, radiusX = 5, radiusZ = 3): Voxel[] {
  const v: Voxel[] = [];
  for (let x = -radiusX; x <= radiusX; x++)
    for (let z = -radiusZ; z <= radiusZ; z++) {
      const d = Math.hypot(x / radiusX, z / radiusZ) + rand() * 0.2;
      if (d < 1) v.push([x, 0, z, "#f1f5f9"]);
      if (d < 0.55) v.push([x, 1, z, "#ffffff"]);
    }
  return v;
}

export function disposeWorld(stage: Stage, world: THREE.Group) {
  stage.scene.remove(world);
  world.traverse((o) => {
    // voxel models share one cube geometry, so only free the instance buffers
    if (o instanceof THREE.InstancedMesh) o.dispose();
    else if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
    if ("element" in o) (o as CSS2DObject).element.remove();
  });
}
