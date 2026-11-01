import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { hashText } from "@/lib/hash";
import { goalReached } from "@/lib/points";
import { CITY_MAX_FLOORS, cityFloors } from "@/lib/worldProgress";
import { buildAvatar } from "../../engine/avatar";
import { disposeWorld, studentTag, tagName, voxelBox } from "../../engine/kit";
import { playSound } from "../../engine/sound";
import { createSparks } from "../../engine/sparks";
import { seeded, voxelMesh, type Voxel } from "../../engine/voxel";
import { worldMeta } from "../registry";
import type { CreateWorld } from "../types";
import { buildScenery } from "./scenery";

// Build the City: the class shares one skyline. Buildings stand side by side so
// none hides another, and each point adds a floor to its student's building.
// Reaching the class goal turns on the city lights.

const BLOCK = 0.34;
const SPACING = 2.95;
const FLOOR_STRETCH = 1.9; // floors are taller than blocks are wide, so the skyline fills the screen
const SKYLINE_TOP = CITY_MAX_FLOORS * BLOCK * FLOOR_STRETCH;
const TAG_GAP = 1.3; // how far apart neighbouring name tags must sit
const WALLS = ["#cbd5e1", "#94a3b8", "#e2e8f0", "#d6c7b0", "#a8b5c4"];

/** Walls and windows are separate, so windows can glow at night. */
function buildingVoxels(floors: number, style: number, wall: string, accent: string, night: boolean, seed: number) {
  const rand = seeded(seed);
  const walls: Voxel[] = [];
  const windows: Voxel[] = [];
  const widthAt = (y: number) => (style === 1 && y > floors * 0.6 ? 2 : style === 3 && y > floors * 0.75 ? 1 : 3);
  for (let y = 0; y < floors; y++) {
    const w = widthAt(y);
    const d = Math.min(w, 2);
    for (let x = -w; x <= w; x++) {
      for (const z of [-d, d]) {
        const isWindow = z === d && y % 2 === 0 && Math.abs(x) % 2 === 0 && Math.abs(x) < w;
        if (isWindow) windows.push([x, y, z, night ? (rand() > 0.2 ? "#fde68a" : "#334155") : "#bfdbfe"]);
        else walls.push([x, y, z, wall]);
      }
    }
    for (let z = -d + 1; z < d; z++) walls.push([-w, y, z, wall], [w, y, z, wall]);
  }
  if (floors > 0) {
    const w = widthAt(floors);
    const d = Math.min(w, 2);
    voxelBox(walls, -w, w, floors, floors, -d, d, accent); // the roof, in the student's colour
    if (style === 2 && floors >= 6) voxelBox(walls, 0, 0, floors + 1, floors + 5, 0, 0, "#64748b"); // a spire
  }
  const top = floors === 0 ? 0 : floors + (style === 2 && floors >= 6 ? 6 : 1);
  return { walls, windows, top };
}

export const createBuildTheCity: CreateWorld = ({ stage, students, lowGraphics, showScores }) => {
  const world = new THREE.Group();
  stage.scene.add(world);
  // a long lens from just above street height, so the towers rise up in front of you
  stage.useDepthCamera(20, new THREE.Vector3(0, 0.06, 1));
  stage.setDrift(0.012);
  const sparks = createSparks(world);
  const rand = seeded(31);

  const n = Math.max(students.length, 1);
  const halfW = Math.max((n * SPACING) / 2 + 2.5, 22);
  const litWindows = new THREE.MeshBasicMaterial();
  const dayGlass = new THREE.MeshPhongMaterial({ specular: "#ffffff", shininess: 60 });

  // --- Ground: the pavement and a road with cars
  const pavement = new THREE.Mesh(
    new THREE.BoxGeometry(3000, 2, 16),
    new THREE.MeshLambertMaterial({ color: "#9ca3af" }),
  );
  pavement.position.set(0, -1, -1);
  pavement.receiveShadow = true;
  world.add(pavement);
  const scenery = buildScenery(stage, world, { halfW, skylineTop: SKYLINE_TOP, lowGraphics });
  const road = new THREE.Mesh(new THREE.BoxGeometry(3000, 0.1, 3), new THREE.MeshLambertMaterial({ color: "#374151" }));
  road.receiveShadow = true;
  road.position.set(0, 0.03, 4);
  world.add(road);
  const cars = Array.from({ length: lowGraphics ? 3 : 7 }, (_, i) => {
    const paint = ["#ef4444", "#3b82f6", "#facc15", "#f8fafc"][i % 4];
    const car = voxelMesh([[-1, 0, 0, paint], [0, 0, 0, paint], [1, 0, 0, paint], [0, 1, 0, "#bfdbfe"]], 0.42);
    car.position.set(0, 0.3, 3.2 + (i % 2) * 1.5);
    world.add(car);
    return { car, dir: i % 2 ? -1 : 1, offset: rand() * halfW * 4, speed: 2.5 + rand() * 2 };
  });

  // --- A building and a student for each child
  const lots = students.map((s, i) => {
    const hash = hashText(`${s.id}:building`);
    const root = new THREE.Group();
    const x = (i - (n - 1) / 2) * SPACING;
    root.position.set(x, 0, 0);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 2.2), new THREE.MeshLambertMaterial({ color: "#6b7280" }));
    slab.position.y = 0.07;
    root.add(slab);
    const body = new THREE.Group();
    body.position.y = BLOCK / 2 + 0.14;
    root.add(body);

    const avatar = buildAvatar(s.color);
    avatar.group.position.set(0, 0.03, 1.8);
    avatar.group.scale.setScalar(1.2);
    root.add(avatar.group);

    const tag = studentTag(stage, s);
    root.add(tag);
    world.add(root);
    return {
      student: s, index: i, x, root, body, avatar, tag: tag as CSS2DObject, key: "", tagBase: 0,
      style: hash % 4, wall: WALLS[hash % WALLS.length], pop: 0, wave: 0,
      meshes: [] as THREE.InstancedMesh[],
    };
  });

  stage.fit({ minX: -halfW, maxX: halfW, minZ: 0, maxZ: 6, minY: -3, maxY: SKYLINE_TOP + 5 });

  let placed = false;
  let night = false;
  let goalNow = false;
  const goalPerStudent = worldMeta("build-the-city").goalPerStudent;

  return {
    setTotals(totals) {
      const reached = goalReached(totals, students.length, goalPerStudent);
      goalNow = placed && reached && !night;
      night = reached;
      scenery.setNight(night);

      for (const lot of lots) {
        const points = totals[lot.student.id] ?? 0;
        const floors = cityFloors(points);
        const key = `${floors}:${night}`;
        if (key !== lot.key) {
          for (const m of lot.meshes) {
            lot.body.remove(m);
            m.dispose();
          }
          const b = buildingVoxels(floors, lot.style, lot.wall, lot.student.color, night, lot.index + 1);
          const walls = voxelMesh(b.walls, BLOCK);
          const windows = voxelMesh(b.windows, BLOCK);
          windows.material = night ? litWindows : dayGlass;
          walls.scale.y = FLOOR_STRETCH;
          windows.scale.y = FLOOR_STRETCH;
          lot.meshes = [walls, windows];
          lot.body.add(walls, windows);
          lot.key = key;
          lot.tagBase = 0.5 + b.top * BLOCK * FLOOR_STRETCH;
        }
        lot.tag.element.textContent = tagName(lot.student.name, points, showScores);
      }
      // lift a tag when it would land on its neighbour's, whatever their heights
      let previousY = -Infinity;
      for (const lot of lots) {
        const y = Math.abs(lot.tagBase - previousY) < TAG_GAP ? previousY + TAG_GAP : lot.tagBase;
        lot.tag.position.set(0, y, 0);
        previousY = y;
      }
      placed = true;
    },

    reward(studentId) {
      const lot = lots.find((x) => x.student.id === studentId);
      if (!lot) return;
      lot.pop = 1;
      lot.wave = 1;
      const floors = lot.meshes.length ? lot.tag.position.y : 1;
      sparks.burst(new THREE.Vector3(lot.x, floors, 1.5), lot.student.color);
      playSound("hammer");
      if (goalNow) {
        goalNow = false; // stay zoomed out so the whole city lights up at once
        playSound("hum", 0.15);
        return;
      }
      stage.focusOn(new THREE.Vector3(lot.x, Math.max(2, floors - 1), 0), 2.6, 2200);
    },

    tick(dt, time) {
      sparks.tick(dt);
      scenery.tick(time);
      for (const lot of lots) {
        lot.pop = Math.max(0, lot.pop - dt * 1.4);
        const s = Math.sin(lot.pop * Math.PI);
        lot.body.scale.set(1 + s * 0.12, 1 + s * 0.06, 1 + s * 0.12);
        lot.wave = Math.max(0, lot.wave - dt * 0.5);
        lot.avatar.setWave(Math.min(1, lot.wave * 2), time);
      }
      const span = halfW * 2.6;
      for (const c of cars) {
        const travelled = (time * c.speed + c.offset) % span;
        c.car.position.x = c.dir * (travelled - span / 2);
      }
    },

    dispose() {
      litWindows.dispose();
      disposeWorld(stage, world);
    },
  };
};
