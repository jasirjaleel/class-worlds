import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { hashText } from "@/lib/hash";
import { goalReached } from "@/lib/points";
import { CITY_MAX_FLOORS, cityFloors } from "@/lib/worldProgress";
import { buildAvatar } from "../../engine/avatar";
import { disposeWorld, studentTag, voxelBox } from "../../engine/kit";
import { createSparks } from "../../engine/sparks";
import { seeded, voxelMesh, type Voxel } from "../../engine/voxel";
import { worldMeta } from "../registry";
import type { CreateWorld } from "../types";

// Build the City: the class shares one skyline. Buildings stand side by side so
// none hides another, and each point adds a floor to its student's building.
// Reaching the class goal turns on the city lights.

const BLOCK = 0.34;
const SPACING = 2.95;
const FLOOR_STRETCH = 1.9; // floors are taller than blocks are wide, so the skyline fills the screen
const SKYLINE_TOP = CITY_MAX_FLOORS * BLOCK * FLOOR_STRETCH;
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

export const createBuildTheCity: CreateWorld = ({ stage, students, lowGraphics }) => {
  const world = new THREE.Group();
  stage.scene.add(world);
  const dayColor = new THREE.Color("#8ecae6");
  const nightColor = new THREE.Color("#0f172a");
  stage.scene.background = dayColor;
  stage.setCameraOffset(new THREE.Vector3(0, 11, 80));
  const sparks = createSparks(world);
  const rand = seeded(31);

  const n = Math.max(students.length, 1);
  const halfW = Math.max((n * SPACING) / 2 + 2.5, 22);
  const litWindows = new THREE.MeshBasicMaterial();

  // --- Ground: the pavement and a road with cars
  const pavement = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 4, 2, 14),
    new THREE.MeshLambertMaterial({ color: "#9ca3af" }),
  );
  pavement.position.set(0, -1, -2);
  world.add(pavement);
  // the waterfront, filling the screen below the road
  const water = new THREE.Mesh(new THREE.BoxGeometry(halfW * 4, 60, 2), new THREE.MeshLambertMaterial({ color: "#1d6f9f" }));
  water.position.set(0, -32, 5);
  world.add(water);
  const road = new THREE.Mesh(new THREE.BoxGeometry(halfW * 4, 0.1, 3), new THREE.MeshLambertMaterial({ color: "#374151" }));
  road.position.set(0, 0.03, 4);
  world.add(road);
  const cars = Array.from({ length: lowGraphics ? 3 : 7 }, (_, i) => {
    const paint = ["#ef4444", "#3b82f6", "#facc15", "#f8fafc"][i % 4];
    const car = voxelMesh([[-1, 0, 0, paint], [0, 0, 0, paint], [1, 0, 0, paint], [0, 1, 0, "#bfdbfe"]], 0.42);
    car.position.set(0, 0.3, 3.2 + (i % 2) * 1.5);
    world.add(car);
    return { car, dir: i % 2 ? -1 : 1, offset: rand() * halfW * 4, speed: 2.5 + rand() * 2 };
  });

  // --- Night things, shown when the class reaches its goal
  const nightLight = new THREE.Group();
  nightLight.add(new THREE.AmbientLight("#8ea4d6", 1.1));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 16), new THREE.MeshBasicMaterial({ color: "#f8fafc" }));
  moon.position.set(halfW - 6, SKYLINE_TOP + 4, -20);
  nightLight.add(moon);
  const starPos: number[] = [];
  for (let i = 0; i < 400; i++) starPos.push((rand() - 0.5) * halfW * 3, rand() * 40, -30);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  nightLight.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#e2e8f0", size: 1.6, sizeAttenuation: false })));
  nightLight.visible = false;
  world.add(nightLight);

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

    const avatar = buildAvatar(s.color, i * 7 + s.name.length);
    avatar.group.position.set(0, 0.03, 1.8);
    avatar.group.scale.setScalar(0.9);
    root.add(avatar.group);

    const tag = studentTag(stage, s);
    root.add(tag);
    world.add(root);
    return {
      student: s, index: i, x, root, body, avatar, tag: tag as CSS2DObject, key: "",
      style: hash % 4, wall: WALLS[hash % WALLS.length], pop: 0, wave: 0,
      meshes: [] as THREE.InstancedMesh[],
    };
  });

  stage.fit({ minX: -halfW, maxX: halfW, minZ: 0, maxZ: 6, minY: -7, maxY: SKYLINE_TOP + 5 });

  let placed = false;
  let night = false;
  let goalNow = false;
  const goalPerStudent = worldMeta("build-the-city").goalPerStudent;

  return {
    setTotals(totals) {
      const reached = goalReached(totals, students.length, goalPerStudent);
      goalNow = placed && reached && !night;
      night = reached;
      stage.scene.background = night ? nightColor : dayColor;
      stage.setLighting(night ? "space" : "day");
      nightLight.visible = night;

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
          if (night) windows.material = litWindows;
          walls.scale.y = FLOOR_STRETCH;
          windows.scale.y = FLOOR_STRETCH;
          lot.meshes = [walls, windows];
          lot.body.add(walls, windows);
          lot.key = key;
          // alternate heights so neighbouring name tags don't overlap
          lot.tag.position.set(0, 0.5 + b.top * BLOCK * FLOOR_STRETCH + (lot.index % 2) * 0.8, 0);
        }
        lot.tag.element.textContent = `${lot.student.name} ${points}`;
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
      if (goalNow) {
        goalNow = false; // stay zoomed out so the whole city lights up at once
        return;
      }
      stage.focusOn(new THREE.Vector3(lot.x, Math.max(2, floors - 1), 0), 2.6, 2200);
    },

    tick(dt, time) {
      sparks.tick(dt);
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
