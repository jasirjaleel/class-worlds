import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Student } from "@/lib/types";
import { addWind } from "./nature";
import type { Stage } from "./stage";
import { seeded, type Voxel } from "./voxel";

// Small building blocks shared by the worlds.

/** A student's name tag. Two-line text is allowed, split with \n. */
export function studentTag(stage: Stage, student: Student): CSS2DObject {
  const tag = stage.label(student.name);
  tag.element.style.setProperty("--c", student.color);
  tag.element.style.whiteSpace = "pre";
  tag.element.style.textAlign = "center";
  return tag;
}

/** A student's name for their tag, with points only if the teacher has chosen to show them. */
export function tagName(name: string, points: number, showScores: boolean): string {
  return showScores ? `${name} ${points}` : name;
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

/** A sky that fades from `top` to a pale `horizon`, so the haze blends into it. */
export function skyTexture(top: string, middle: string, horizon: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(0.45, middle);
  g.addColorStop(0.72, horizon);
  g.addColorStop(1, horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A low sun for long soft shadows, plus sky light. Replaces the stage's plain
 * daylight. `span` is how wide the shadows must reach, `top` how high.
 */
export function addSunlight(
  stage: Stage,
  world: THREE.Group,
  opts: {
    span: number;
    top: number;
    lowGraphics: boolean;
    from: [number, number, number];
    bottom?: number;
    /** Where the sun appears in the sky: its light glints off water towards the viewer. */
    glintFrom?: [number, number, number];
  },
): THREE.Group {
  stage.setLighting("space");
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight("#e6f2ff", "#7c8797", 1.25));
  const sun = new THREE.DirectionalLight("#fff0d4", 2.7);
  sun.position.set(...opts.from);
  sun.castShadow = !opts.lowGraphics;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const s = sun.shadow.camera;
  s.left = -opts.span;
  s.right = opts.span;
  s.top = opts.top;
  s.bottom = opts.bottom ?? -opts.span;
  s.far = 600;
  group.add(sun);
  if (opts.glintFrom) {
    const glint = new THREE.DirectionalLight("#ffe7c2", 1.1);
    glint.position.set(...opts.glintFrom);
    group.add(glint);
  }
  world.add(group);
  return group;
}

interface BoxItem {
  x: number; y: number; z: number; w: number; h: number; d: number; color: string;
}

/** Many plain boxes in one draw call. Used for far scenery, so it casts no shadows. */
function boxField(items: BoxItem[], material: THREE.Material = new THREE.MeshLambertMaterial()): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, Math.max(items.length, 1));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  items.forEach((b, i) => {
    m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(b.color));
  });
  mesh.count = items.length;
  return mesh;
}

function treeBoxes(x: number, y: number, z: number, size: number, kind: "round" | "palm", colors: string[], rand: () => number): BoxItem[] {
  const leaf = () => colors[Math.floor(rand() * colors.length)];
  if (kind === "palm") {
    const top = y + 3.4 * size;
    return [
      { x, y: y + 1.7 * size, z, w: 0.4 * size, h: 3.4 * size, d: 0.4 * size, color: "#8a6a3f" },
      { x, y: top, z, w: 3.6 * size, h: 0.25 * size, d: 0.9 * size, color: leaf() },
      { x, y: top, z, w: 0.9 * size, h: 0.25 * size, d: 3.6 * size, color: leaf() },
      { x, y: top + 0.25 * size, z, w: 1.5 * size, h: 0.3 * size, d: 1.5 * size, color: leaf() },
    ];
  }
  return [
    { x, y: y + 1.1 * size, z, w: 0.5 * size, h: 2.2 * size, d: 0.5 * size, color: "#6b4423" },
    { x, y: y + 2.7 * size, z, w: 2.6 * size, h: 1.4 * size, d: 2.6 * size, color: leaf() },
    { x, y: y + 3.8 * size, z, w: 1.9 * size, h: 1 * size, d: 1.9 * size, color: leaf() },
    { x, y: y + 4.6 * size, z, w: 1 * size, h: 0.7 * size, d: 1 * size, color: leaf() },
  ];
}

/**
 * Fills everything around the play area, on all sides, so a world never looks
 * like a square floating in nothing: scattered ground patches and trees out to
 * `reach`, skipping the `clear` area where students and the camera's view are.
 */
export function addSurroundings(
  world: THREE.Group,
  opts: {
    groundY: number;
    /** Keep this area free of trees. Also keep the patches out if patchClear is unset. */
    clear: { minX: number; maxX: number; minZ: number; maxZ: number };
    patchClear?: { minX: number; maxX: number; minZ: number; maxZ: number };
    reach: number;
    trees: number;
    kind: "round" | "palm";
    leaves: string[];
    patches?: string[];
    seed: number;
    lowGraphics: boolean;
  },
) {
  const rand = seeded(opts.seed);
  const inside = (x: number, z: number, area: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
    x > area.minX && x < area.maxX && z > area.minZ && z < area.maxZ;
  const scatter = () => {
    // denser close in, thinning out towards the horizon
    const angle = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 0.7) * opts.reach;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  };

  const trees: BoxItem[] = [];
  const treeTarget = opts.lowGraphics ? Math.round(opts.trees * 0.3) : opts.trees;
  for (let i = 0, placed = 0; i < treeTarget * 6 && placed < treeTarget; i++) {
    const [x, z] = scatter();
    if (inside(x, z, opts.clear)) continue;
    trees.push(...treeBoxes(x, opts.groundY, z, 0.9 + rand() * 1.1, opts.kind, opts.leaves, rand));
    placed++;
  }
  const treeMaterial = new THREE.MeshLambertMaterial();
  if (!opts.lowGraphics) addWind(treeMaterial);
  world.add(boxField(trees, treeMaterial));

  if (opts.patches) {
    const patches: BoxItem[] = [];
    const patchArea = opts.patchClear ?? opts.clear;
    const count = opts.lowGraphics ? 300 : 1400;
    for (let i = 0; i < count; i++) {
      const [x, z] = scatter();
      if (inside(x, z, patchArea)) continue;
      patches.push({ x: Math.round(x), y: opts.groundY + 0.01, z: Math.round(z), w: 1, h: 0.02, d: 1, color: opts.patches[i % opts.patches.length] });
    }
    world.add(boxField(patches));
  }
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
