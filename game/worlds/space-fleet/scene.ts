import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { createSparks } from "../../engine/sparks";
import { shade, voxelMesh, type Voxel } from "../../engine/voxel";
import { goalReached } from "@/lib/points";
import { worldMeta } from "../registry";
import type { CreateWorld } from "../types";
import { PLANET_Y, SCENE_BOUNDS, STOPS, buildSolarSystem, pointsToX } from "./solarSystem";

// Space Fleet: a realistic Solar System laid out like a poster, Sun on the left.
// Every student has a blocky rocket in an invisible row of the fleet. The first
// 5 points build it at Earth; every point after that flies it outward, stop by
// stop, to Mars, the Asteroid Belt, Jupiter ... and the Kuiper Belt. Reaching
// the class goal reveals Pluto out in the Kuiper Belt.

const PARTS = 5;
const ROW_TOP = PLANET_Y - 6.8;
const ROW_GAP = 1.15;
const FLEET_Z = 4;
const ROCKET_BLOCK = 0.24;

/**
 * Rocket blocks for a build stage (1..5), standing up. Fins stick out left and
 * right and the window faces the viewer, so it reads well upright or lying down.
 */
export function rocketVoxels(stage: number, color: string): Voxel[] {
  const v: Voxel[] = [];
  const cross = (y: number, c: string) => {
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) v.push([x, y, z, c]);
  };
  if (stage >= 1) cross(0, "#6b7280"); // engine
  if (stage >= 2) for (let y = 1; y <= 4; y++) cross(y, y === 2 ? color : "#e5e7eb"); // body
  if (stage >= 3) v.push([0, 3, 2, "#7dd3fc"]); // window
  if (stage >= 4) {
    for (const x of [-2, 2]) v.push([x, 0, 0, color], [x, 1, 0, color], [x, -1, 0, shade(color, -0.15)]);
  }
  if (stage >= 5) {
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x === 0 || z === 0) v.push([x, 5, z, color]);
    v.push([0, 6, 0, shade(color, 0.15)]);
  }
  return v;
}

interface Rocket {
  studentId: string;
  name: string;
  root: THREE.Group;
  pivot: THREE.Group;
  model: THREE.InstancedMesh | null;
  flame: THREE.Mesh;
  label: CSS2DObject;
  stage: number;
  x: number;
  targetX: number;
  pop: number;
  color: string;
}

export const createSpaceFleet: CreateWorld = ({ stage, students, lowGraphics }) => {
  const world = new THREE.Group();
  stage.scene.add(world);
  stage.scene.background = new THREE.Color("#03040b");
  stage.setLighting("space");
  // nearly face-on, slightly from above: planets read as round spheres in a row
  stage.setCameraOffset(new THREE.Vector3(0, 9, 80));

  const solar = buildSolarSystem((text, className) => stage.label(text, className), lowGraphics);
  world.add(solar.group);
  fetch("/api/textures")
    .then((r) => r.json())
    .then(({ files }: { files: string[] }) => solar.useTextureFiles(files))
    .catch(() => {}); // no photos: the drawn surfaces stay

  // --- The fleet: one invisible row per student
  const rowY = (i: number) => ROW_TOP - i * ROW_GAP;
  const flameMat = new THREE.MeshBasicMaterial({ color: "#fb923c" });

  const rockets: Rocket[] = students.map((s, i) => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.rotation.z = -Math.PI / 2; // lie the rocket down, nose pointing outward
    root.add(pivot);

    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.36), flameMat);
    flame.position.set(-0.4, 0, 0);
    flame.visible = false;
    root.add(flame);

    const label = stage.label(s.name);
    label.element.style.setProperty("--c", s.color);
    label.center.set(1, 0.5); // tag sits behind the rocket's tail
    label.position.set(-0.45, 0, 0);
    root.add(label);

    const x = pointsToX(0);
    root.position.set(x, rowY(i), FLEET_Z);
    world.add(root);

    return {
      studentId: s.id, name: s.name, root, pivot, model: null, flame, label,
      stage: 0, x, targetX: x, pop: 0, color: s.color,
    };
  });

  stage.fit({
    minX: SCENE_BOUNDS.minX,
    maxX: SCENE_BOUNDS.maxX,
    minZ: -12,
    maxZ: FLEET_Z,
    minY: rowY(Math.max(students.length, 1) - 1) - 3.5, // room for the class goal bar
    maxY: SCENE_BOUNDS.maxY,
  });

  const sparks = createSparks(world);

  const setStage = (r: Rocket, next: number) => {
    if (next === r.stage) return;
    if (r.model) {
      r.pivot.remove(r.model);
      r.model.dispose();
    }
    r.model = next > 0 ? voxelMesh(rocketVoxels(next, r.color), ROCKET_BLOCK) : null;
    if (r.model) r.pivot.add(r.model);
    r.stage = next;
  };

  let placed = false; // on first load rockets appear in place; after that they fly
  let plutoFound = false;
  let plutoFoundNow = false;
  const goalPerStudent = worldMeta("space-fleet").goalPerStudent;

  return {
    setTotals(totals) {
      for (const r of rockets) {
        const points = totals[r.studentId] ?? 0;
        setStage(r, Math.min(points, PARTS));
        r.targetX = pointsToX(points);
        if (!placed) r.x = r.root.position.x = r.targetX;
        const reached = [...STOPS].reverse().find((s) => points >= s.points && s.name !== "Earth");
        r.label.element.textContent = reached ? `${r.name} ${points} · ${reached.name}` : `${r.name} ${points}`;
      }
      const found = goalReached(totals, students.length, goalPerStudent);
      plutoFoundNow = placed && found && !plutoFound;
      plutoFound = found;
      solar.setPlutoFound(found);
      placed = true;
    },

    reward(studentId) {
      const r = rockets.find((x) => x.studentId === studentId);
      if (!r) return;
      r.pop = 1;
      const at = new THREE.Vector3(r.targetX + 0.7, r.root.position.y, FLEET_Z);
      sparks.burst(at, r.color);
      if (plutoFoundNow) {
        // this point reached the class goal: show everyone what they found
        plutoFoundNow = false;
        sparks.burst(solar.plutoPosition, "#efe2cf", "#fde047", 40);
        stage.focusOn(solar.plutoPosition, 4, 3500);
        return;
      }
      stage.focusOn(new THREE.Vector3(r.targetX - 1, r.root.position.y + 2, 0), 2.4, 2200);
    },

    tick(dt, time) {
      solar.tick(dt, time);
      rockets.forEach((r, i) => {
        const moving = Math.abs(r.targetX - r.x) > 0.03;
        r.x += (r.targetX - r.x) * Math.min(1, dt * 2.2);
        r.root.position.x = r.x;
        // gentle hover once the rocket is finished
        r.root.position.y = rowY(i) + (r.stage === PARTS ? Math.sin(time * 2 + i) * 0.06 : 0);

        r.flame.visible = moving || r.pop > 0.2;
        if (r.flame.visible) r.flame.scale.set(0.7 + Math.random() * 0.8, 1, 1);

        r.pop = Math.max(0, r.pop - dt * 1.4);
        r.pivot.scale.setScalar(1 + Math.sin(r.pop * Math.PI) * 0.45);
      });

      sparks.tick(dt);
    },

    dispose() {
      stage.scene.remove(world);
      world.traverse((o) => {
        // voxel models share one cube geometry, so only free the instance buffers
        if (o instanceof THREE.InstancedMesh) o.dispose();
        else if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
        if ("element" in o) (o as CSS2DObject).element.remove();
      });
    },
  };
};
