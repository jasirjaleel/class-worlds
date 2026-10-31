import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { hashText } from "@/lib/hash";
import { goalReached } from "@/lib/points";
import { GARDEN_STAGE_NAMES, gardenStage } from "@/lib/worldProgress";
import { buildAvatar } from "../../engine/avatar";
import { disposeWorld, gridLayout, studentTag, voxelBox } from "../../engine/kit";
import { createSparks } from "../../engine/sparks";
import { seeded, voxelMesh, type Voxel } from "../../engine/voxel";
import { worldMeta } from "../registry";
import type { CreateWorld } from "../types";

// Garden: every student grows one plant across the term, from a seed to a tree
// with fruit. Reaching the class goal brings butterflies to the whole garden.

const BLOCK = 0.26;
const FRUIT_STAGE = 7;
const FLOWER_STAGE = 6;

const TREES = [
  { name: "Apple", leaf: ["#16a34a", "#15803d"], flower: "#fbcfe8", fruit: "#dc2626", palm: false },
  { name: "Orange", leaf: ["#15803d", "#166534"], flower: "#ffffff", fruit: "#f97316", palm: false },
  { name: "Lemon", leaf: ["#22c55e", "#16a34a"], flower: "#fefce8", fruit: "#facc15", palm: false },
  { name: "Date palm", leaf: ["#3f8f3a", "#2f7a35"], flower: "#fef3c7", fruit: "#b45309", palm: true },
];
type Tree = (typeof TREES)[number];

function plantVoxels(stage: number, tree: Tree, seed: number): Voxel[] {
  const rand = seeded(seed);
  const v: Voxel[] = [];
  const [leaf, leaf2] = tree.leaf;
  const leafColor = () => (rand() > 0.5 ? leaf : leaf2);
  if (stage === 0) {
    v.push([0, 0, 0, "#78350f"]); // a seed in a little mound
    return v;
  }
  if (stage <= 3) {
    const height = stage * 2;
    voxelBox(v, 0, 0, 0, height - 1, 0, 0, leaf);
    for (let y = 1; y < height; y += 2) v.push([-1, y, 0, leaf2], [1, y, 0, leaf2]);
    v.push([0, height, 0, leaf2]);
    return v;
  }

  const trunk = stage === 4 ? 6 : 9;
  const bark = tree.palm ? "#a68a5b" : "#7c4a21";
  voxelBox(v, 0, 0, 0, trunk - 1, 0, 0, bark);

  // the top of the tree, then the flowers or fruit dotted over it
  const leaves: Voxel[] = [];
  if (tree.palm) {
    const reach = stage === 4 ? 3 : 5;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      for (let i = 1; i <= reach; i++) {
        leaves.push([dx * i, trunk + 1 - Math.floor((i * i) / 6), dz * i, leafColor()]);
      }
    }
    leaves.push([0, trunk, 0, leaf], [0, trunk + 1, 0, leaf2]);
  } else {
    const r = stage === 4 ? 2 : 3;
    for (let x = -r; x <= r; x++)
      for (let y = -r; y <= r; y++)
        for (let z = -r; z <= r; z++) {
          if (Math.hypot(x, y, z) <= r + 0.3) leaves.push([x, trunk + r - 1 + y, z, leafColor()]);
        }
  }
  for (const voxel of leaves) {
    const dot = rand();
    if (stage === FLOWER_STAGE && dot > 0.75) voxel[3] = tree.flower;
    if (stage === FRUIT_STAGE && !tree.palm && dot > 0.8) voxel[3] = tree.fruit;
    v.push(voxel);
  }
  if (tree.palm && stage === FRUIT_STAGE) {
    // bunches of dates hanging under the leaves
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) voxelBox(v, x, x, trunk - 2, trunk - 1, z, z, tree.fruit);
  }
  return v;
}

function plotVoxels(seed: number): Voxel[] {
  const rand = seeded(seed);
  const v: Voxel[] = [];
  voxelBox(v, -3, 3, 0, 0, -3, 3, () => (rand() > 0.5 ? "#6b4423" : "#7a4f2a"));
  // a low wooden edge
  for (let i = -4; i <= 4; i++) {
    v.push([i, 0, -4, "#b98a4e"], [i, 0, 4, "#b98a4e"]);
    if (Math.abs(i) < 4) v.push([-4, 0, i, "#b98a4e"], [4, 0, i, "#b98a4e"]);
  }
  return v;
}

export const createGarden: CreateWorld = ({ stage, students, lowGraphics }) => {
  const world = new THREE.Group();
  stage.scene.add(world);
  stage.scene.background = new THREE.Color("#a7e3f5");
  stage.setCameraOffset(new THREE.Vector3(0, 40, 42));
  const sparks = createSparks(world);
  const rand = seeded(23);

  const grid = gridLayout(students.length, 5.4, 5.8);
  const halfX = Math.ceil(grid.width / 2) + 2;
  const halfZ = Math.ceil(grid.depth / 2) + 2;

  // --- Lawn with scattered wildflowers
  const lawn: Voxel[] = [];
  for (let x = -halfX; x <= halfX; x++)
    for (let z = -halfZ; z <= halfZ; z++) {
      const r = rand();
      lawn.push([x, -1, z, r > 0.99 ? "#f9a8d4" : r > 0.98 ? "#fde047" : r > 0.5 ? "#6cc04a" : "#5cb33d"]);
    }
  world.add(voxelMesh(lawn, 1));
  const earth = new THREE.Mesh(
    new THREE.BoxGeometry(halfX * 2 + 1, 3, halfZ * 2 + 1),
    new THREE.MeshLambertMaterial({ color: "#7c4a21" }),
  );
  earth.position.y = -3;
  world.add(earth);

  // --- A plot, a plant and a student for each child
  const plots = students.map((s, i) => {
    const { x, z } = grid.at(i);
    const tree = TREES[hashText(`${s.id}:tree`) % TREES.length];
    const root = new THREE.Group();
    root.position.set(x, -0.5, z);
    root.add(voxelMesh(plotVoxels(i + 1), 0.42));

    const plant = new THREE.Group();
    plant.position.y = 0.3;
    root.add(plant);

    const avatar = buildAvatar(s.color, i * 7 + s.name.length);
    avatar.group.position.set(-2.1, 0, 1);
    avatar.group.rotation.y = 0.5;
    root.add(avatar.group);

    const tag = studentTag(stage, s);
    root.add(tag);
    world.add(root);
    return {
      student: s, seed: i + 1, tree, root, plant, avatar, tag: tag as CSS2DObject,
      model: null as THREE.InstancedMesh | null, stage: -1, pop: 0, wave: 0,
    };
  });

  // --- Butterflies, shown when the class reaches its goal
  const palette = ["#f472b6", "#fbbf24", "#60a5fa", "#ffffff", "#c084fc"];
  const butterflies = Array.from({ length: lowGraphics ? 10 : 26 }, (_, i) => {
    const b = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: palette[i % palette.length] });
    const wing = new THREE.BoxGeometry(0.24, 0.04, 0.3);
    const left = new THREE.Mesh(wing, material);
    const right = new THREE.Mesh(wing, material);
    b.add(left, right);
    b.visible = false;
    world.add(b);
    return { b, left, right, cx: (rand() - 0.5) * grid.width, cz: (rand() - 0.5) * grid.depth, phase: rand() * 6 };
  });

  stage.fit({ minX: -halfX, maxX: halfX, minZ: -halfZ, maxZ: halfZ + 3, minY: -1, maxY: 5 });

  let placed = false;
  let goalDone = false;
  const goalPerStudent = worldMeta("garden").goalPerStudent;

  return {
    setTotals(totals) {
      for (const p of plots) {
        const points = totals[p.student.id] ?? 0;
        const next = gardenStage(points);
        if (next !== p.stage) {
          if (p.model) {
            p.plant.remove(p.model);
            p.model.dispose();
          }
          const voxels = plantVoxels(next, p.tree, p.seed);
          p.model = voxelMesh(voxels, BLOCK);
          p.plant.add(p.model);
          p.stage = next;
          const top = Math.max(...voxels.map((v) => v[1]));
          p.tag.position.set(0, 0.3 + (top + 1) * BLOCK + 0.65, 0);
        }
        const growth = next === FRUIT_STAGE ? `${p.tree.name} fruit`.replace("Date palm fruit", "Dates") : GARDEN_STAGE_NAMES[next];
        p.tag.element.textContent = `${p.student.name} ${points}\n${growth}`;
      }
      goalDone = goalReached(totals, students.length, goalPerStudent);
      for (const f of butterflies) f.b.visible = goalDone;
      placed = true;
    },

    reward(studentId) {
      const p = plots.find((x) => x.student.id === studentId);
      if (!p || !placed) return;
      p.pop = 1;
      p.wave = 1;
      const at = p.root.position.clone().setY(1.4);
      sparks.burst(at, "#86efac", p.student.color);
      stage.focusOn(at, 2.8, 2200);
    },

    tick(dt, time) {
      sparks.tick(dt);
      for (const p of plots) {
        p.pop = Math.max(0, p.pop - dt * 1.4);
        p.plant.scale.setScalar(1 + Math.sin(p.pop * Math.PI) * 0.3);
        p.wave = Math.max(0, p.wave - dt * 0.5);
        p.avatar.setWave(Math.min(1, p.wave * 2), time);
      }
      if (goalDone) {
        for (const f of butterflies) {
          const t = time * 0.5 + f.phase;
          f.b.position.set(f.cx + Math.sin(t) * 4, 2.2 + Math.sin(t * 2.3) * 0.8, f.cz + Math.cos(t * 0.8) * 3);
          const flap = Math.sin(time * 18 + f.phase) * 0.9;
          f.left.position.x = -0.12;
          f.right.position.x = 0.12;
          f.left.rotation.z = flap;
          f.right.rotation.z = -flap;
        }
      }
    },

    dispose: () => disposeWorld(stage, world),
  };
};
