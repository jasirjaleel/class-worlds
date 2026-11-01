import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { HATCH_POINTS, dinoStage, eggFor, type SpeciesId } from "@/lib/dinos";
import { goalReached, localWeekKey } from "@/lib/points";
import { buildAvatar } from "../../engine/avatar";
import { addSunlight, addSurroundings, disposeWorld, tagName } from "../../engine/kit";
import { groundMaterial, skyDome, softCloud, terrainRing } from "../../engine/nature";
import { playSound } from "../../engine/sound";
import { createSparks } from "../../engine/sparks";
import { seeded, voxelMesh, type Voxel } from "../../engine/voxel";
import { worldMeta } from "../registry";
import type { CreateWorld } from "../types";
import { dinoVoxels, eggVoxels, nestVoxels } from "./models";

// Dino Eggs: every student has a nest in a grid, so everyone stays in view.
// Each egg starts with a first crack as a head start, and points crack it further; at the hatch points a surprise dinosaur comes out and
// then grows. Reaching the class goal wakes the volcano.

const CELL_X = 5.4;
const CELL_Z = 5.8;
const EGG_BLOCK = 0.3;
const DINO_BLOCK = 0.25;
const BODY_Y = 0.4;
const DINO_SCALE: Record<number, number> = { 5: 0.6, 6: 0.8, 7: 1 };

interface Nest {
  studentId: string;
  name: string;
  color: string;
  seed: number;
  root: THREE.Group;
  body: THREE.Group;
  model: THREE.InstancedMesh | null;
  avatar: ReturnType<typeof buildAvatar>;
  label: CSS2DObject;
  stage: number;
  /** What the current model was built from, so a new week swaps it. */
  modelKey: string;
  pop: number;
  wave: number;
  hatchedNow: boolean;
}

function volcanoVoxels(): Voxel[] {
  const rand = seeded(5);
  const v: Voxel[] = [];
  const height = 11;
  for (let y = 0; y < height; y++) {
    const r = 9 - y * 0.68;
    for (let x = -9; x <= 9; x++)
      for (let z = -9; z <= 9; z++) {
        const d = Math.hypot(x, z);
        if (d > r || d < r - 2.2) continue; // only the visible shell
        v.push([x, y, z, rand() > 0.6 ? "#57534e" : rand() > 0.5 ? "#44403c" : "#78716c"]);
      }
  }
  // lava filling the crater
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.hypot(x, z) < 2.4) v.push([x, height - 1, z, "#f97316"]);
  return v;
}

function fern(seed: number): Voxel[] {
  const rand = seeded(seed);
  const v: Voxel[] = [];
  for (let y = 0; y < 4; y++) v.push([0, y, 0, "#854d0e"]);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = 1; i <= 3; i++) v.push([dx * i, 4 - (i > 2 ? 1 : 0), dz * i, rand() > 0.5 ? "#16a34a" : "#15803d"]);
  }
  v.push([0, 4, 0, "#22c55e"]);
  return v;
}

export const createDinoEggs: CreateWorld = ({ stage, students, lowGraphics, timeZone, showScores }) => {
  const world = new THREE.Group();
  stage.scene.add(world);
  skyDome(world, { top: "#2f78c8", horizon: "#d8eee9" }, [0.5, 0.3, -0.8]);
  const sparks = createSparks(world);

  const n = Math.max(students.length, 1);
  const cols = Math.ceil(Math.sqrt(n * 1.8));
  const rows = Math.ceil(n / cols);
  const gridW = cols * CELL_X;
  const gridD = rows * CELL_Z;
  const cellPos = (i: number) => ({
    x: (i % cols) * CELL_X - gridW / 2 + CELL_X / 2,
    z: Math.floor(i / cols) * CELL_Z - gridD / 2 + CELL_Z / 2,
  });

  // --- Ground: a grassy block island, a little wider than the grid
  const halfX = Math.ceil(gridW / 2) + 3;
  const backZ = -Math.ceil(gridD / 2) - 14; // extra room behind for the volcano
  const frontZ = Math.ceil(gridD / 2) + 2;
  const rand = seeded(11);
  const ground: Voxel[] = [];
  for (let x = -halfX; x <= halfX; x++)
    for (let z = backZ; z <= frontZ; z++) {
      const r = rand();
      ground.push([x, -1, z, r > 0.9 ? "#65a30d" : r > 0.8 ? "#a3a84b" : "#4d9a2f"]);
    }
  world.add(voxelMesh(ground, 1));
  // jungle in every direction, fading into far mountains
  const land = new THREE.Mesh(new THREE.BoxGeometry(3000, 1, 3000), groundMaterial(["#46912b", "#4d9a2f", "#57a233"], 120));
  land.position.y = -1.01;
  land.receiveShadow = true;
  world.add(land);
  addSurroundings(world, {
    groundY: -0.5,
    clear: { minX: -halfX - 1, maxX: halfX + 1, minZ: backZ - 1, maxZ: 1000 },
    patchClear: { minX: -halfX, maxX: halfX, minZ: backZ, maxZ: frontZ },
    reach: 165,
    trees: 300,
    kind: "palm",
    leaves: ["#16a34a", "#15803d", "#22863a"],
    patches: ["#65a30d", "#a3a84b", "#65a30d", "#5aa632"],
    seed: 61,
    lowGraphics,
  });
  world.add(terrainRing({ inner: 165, outer: 350, height: 62, colors: ["#3f7d3a", "#5f6e62", "#8f8c84"], seed: 62, lowGraphics, baseY: -0.5 }));
  addSunlight(stage, world, {
    span: Math.max(halfX, -backZ) + 15,
    top: Math.max(halfX, -backZ) + 15,
    lowGraphics,
    from: [-halfX * 1.6, 42, 34],
  });

  // --- Scenery behind and around the nests
  const volcano = voxelMesh(volcanoVoxels(), 0.85);
  const crater = new THREE.Vector3(0, 9, backZ + 7);
  volcano.position.set(0, -0.5, backZ + 7);
  world.add(volcano);
  // a thin thread of smoke always rises from the crater
  const smoke = Array.from({ length: lowGraphics ? 3 : 6 }, (_, i) => {
    const puff = softCloud(5, i, 0.4);
    puff.material.color.set("#9ca3af");
    world.add(puff);
    return { puff, offset: i / (lowGraphics ? 3 : 6) };
  });
  const fernSpots = lowGraphics ? 6 : 18;
  for (let i = 0; i < fernSpots; i++) {
    const side = i % 2 ? 1 : -1;
    const f = voxelMesh(fern(i + 1), 0.55 + (i % 3) * 0.15);
    f.position.set(side * (halfX - 1 - rand() * 2), -0.5, backZ + 2 + rand() * (frontZ - backZ - 3));
    world.add(f);
  }

  // --- A nest, an egg and a student for each child
  const nests: Nest[] = students.map((s, i) => {
    const { x, z } = cellPos(i);
    const root = new THREE.Group();
    root.position.set(x, -0.5, z);
    const nest = voxelMesh(nestVoxels(i + 1), 0.42);
    root.add(nest);

    const body = new THREE.Group();
    body.position.y = BODY_Y;
    root.add(body);

    const avatar = buildAvatar(s.color);
    avatar.group.position.set(-2.1, 0, 0.8);
    avatar.group.scale.setScalar(1.4);
    avatar.group.rotation.y = 0.5;
    root.add(avatar.group);

    const label = stage.label(s.name);
    label.element.style.setProperty("--c", s.color);
    label.element.style.whiteSpace = "pre";
    label.element.style.textAlign = "center";
    root.add(label);

    world.add(root);
    return {
      studentId: s.id, name: s.name, color: s.color, seed: i + 1, root, body, model: null, avatar, label,
      stage: -1, modelKey: "", pop: 0, wave: 0, hatchedNow: false,
    };
  });

  // a long lens facing the grid straight on, so back rows shrink only a little
  stage.useDepthCamera(16, new THREE.Vector3(0, 0.74, 1));
  stage.setDrift(0.006);
  stage.setDepthFog("#d8eee9", 30, 300);
  stage.fit({ minX: -halfX, maxX: halfX, minZ: backZ - 2, maxZ: frontZ + 3, minY: -1, maxY: 6 });

  const setModel = (nest: Nest, voxels: Voxel[], block: number, scale: number, key: string) => {
    if (nest.model) {
      nest.body.remove(nest.model);
      nest.model.dispose();
    }
    nest.model = voxelMesh(voxels, block);
    nest.model.scale.setScalar(scale);
    nest.body.add(nest.model);
    nest.modelKey = key;
    const top = Math.max(...voxels.map((v) => v[1]));
    nest.label.position.set(0, BODY_Y + (top + 1) * block * scale + 0.6, 0);
  };

  let placed = false;
  let erupting = false;
  let eruptedNow = false;
  let nextEruption = 0;
  const goalPerStudent = worldMeta("dino-eggs").goalPerStudent;

  return {
    setTotals(totals) {
      const weekKey = localWeekKey(Date.now(), timeZone);
      for (const nest of nests) {
        const points = totals[nest.studentId] ?? 0;
        const egg = eggFor(nest.studentId, weekKey);
        const next = dinoStage(points);
        const hatched = points >= HATCH_POINTS;
        const key = `${weekKey}:${next}`;
        if (key !== nest.modelKey) {
          nest.hatchedNow = placed && hatched && nest.stage >= 0 && nest.stage < HATCH_POINTS;
          if (hatched) {
            const species: SpeciesId = egg.species.id;
            setModel(nest, dinoVoxels(species, egg.gold), DINO_BLOCK, DINO_SCALE[next], key);
          } else {
            setModel(nest, eggVoxels(next + 1, nest.color, egg.gold, nest.seed), EGG_BLOCK, 1, key);
          }
          nest.stage = next;
        }
        // the name only appears once it hatches, so the surprise holds
        const line = hatched ? `\n${egg.gold ? "Gold " : ""}${egg.species.name}` : "";
        nest.label.element.textContent = `${tagName(nest.name, points, showScores)}${line}`;
      }
      const reached = goalReached(totals, students.length, goalPerStudent);
      eruptedNow = placed && reached && !erupting;
      erupting = reached;
      placed = true;
    },

    reward(studentId) {
      const nest = nests.find((x) => x.studentId === studentId);
      if (!nest) return;
      nest.pop = 1;
      nest.wave = 1;
      const at = nest.root.position.clone().setY(1.2);
      if (eruptedNow) {
        eruptedNow = false;
        playSound("rumble", 0.1);
      }
      if (nest.hatchedNow) {
        // shell pieces fly out with the new dinosaur
        playSound("shellBreak");
        playSound("squeak", 0.3);
        sparks.burst(at, "#f5ecd7", nest.color, 40);
        nest.hatchedNow = false;
        stage.focusOn(at, 3.4, 3000);
      } else {
        playSound(nest.stage < HATCH_POINTS ? "crack" : "squeak");
        sparks.burst(at, nest.color);
        stage.focusOn(at, 2.6, 2200);
      }
    },

    tick(dt, time) {
      sparks.tick(dt);
      for (const s of smoke) {
        const age = (time * 0.09 + s.offset) % 1;
        s.puff.position.set(crater.x + Math.sin(age * 5) * 0.8 + age * 3, crater.y + 0.6 + age * 12, crater.z);
        s.puff.scale.set(3 + age * 9, 1.5 + age * 4.5, 1);
        s.puff.material.opacity = (erupting ? 0.7 : 0.38) * (1 - age);
      }
      nests.forEach((nest, i) => {
        // an egg about to hatch wobbles; a dinosaur bobs on the spot
        const aboutToHatch = nest.stage === HATCH_POINTS - 1;
        nest.body.rotation.z = aboutToHatch ? Math.sin(time * 9 + i) * 0.1 : 0;
        const bob = nest.stage >= HATCH_POINTS ? Math.abs(Math.sin(time * 2 + i)) * 0.08 : 0;
        nest.body.position.y = BODY_Y + bob;
        nest.body.rotation.y = nest.stage >= HATCH_POINTS ? 0.35 : 0;

        nest.pop = Math.max(0, nest.pop - dt * 1.4);
        nest.body.scale.setScalar(1 + Math.sin(nest.pop * Math.PI) * 0.35);

        nest.wave = Math.max(0, nest.wave - dt * 0.5);
        nest.avatar.setWave(Math.min(1, nest.wave * 2), time);
      });

      if (erupting && time > nextEruption) {
        sparks.burst(crater, "#f97316", "#ef4444", lowGraphics ? 6 : 12);
        nextEruption = time + 1.2;
      }
    },

    dispose: () => disposeWorld(stage, world),
  };
};
