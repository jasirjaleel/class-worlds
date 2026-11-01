import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { classGoal, classTotal } from "@/lib/points";
import { VOYAGE_PORTS, voyageProgress } from "@/lib/worldProgress";
import { buildAvatar } from "../../engine/avatar";
import { addSunlight, disposeWorld, gridLayout, studentTag, tagName, voxelBox } from "../../engine/kit";
import { cloudRing, flock, skyDome, terrainRing, waterPlane } from "../../engine/nature";
import { playSound } from "../../engine/sound";
import { createSparks } from "../../engine/sparks";
import { seeded, voxelMesh, type Voxel } from "../../engine/voxel";
import { worldMeta } from "../registry";
import type { CreateWorld } from "../types";

// Ship Voyage: the class is one crew on one dhow. The whole class's points fill
// the sail and carry the dhow from port to port across the open sea. Every
// student stands on tiered decks facing the viewer, so everyone stays in view.

const ROUTE_HALF = 42;
const ROUTE_Z = -80;
const PORT_Z = -108;
const DHOW_BLOCK = 1.05;
const ISLAND_BLOCK = 1.5;
const CELL_Z = 3.6;
const TIER_HEIGHT = 2; // each row of crew stands this much higher than the row in front

const portX = (position: number) => -ROUTE_HALF + (position / (VOYAGE_PORTS.length - 1)) * ROUTE_HALF * 2;

function hullVoxels(): Voxel[] {
  const v: Voxel[] = [];
  const dark = "#6b3f1d";
  const wood = "#8b5a2b";
  for (let x = -9; x <= 10; x++) {
    // the deck rises towards the bow and the stern, like a real dhow
    const rise = x > 5 ? x - 5 : x < -6 ? -6 - x : 0;
    const width = x > 7 ? 0 : x > 3 || x < -7 ? 1 : 2;
    const bottom = Math.max(0, Math.abs(x) - 6);
    for (let y = bottom; y <= 3 + rise; y++) {
      for (let z = -width; z <= width; z++) v.push([x, y, z, y === 3 + rise ? "#c9a06a" : y % 2 ? wood : dark]);
    }
  }
  voxelBox(v, 0, 0, 4, 17, 0, 0, "#5b3a1e"); // the mast
  return v;
}

/** A triangular lateen sail, built around the foot of the mast so it can grow as it fills. */
function sailVoxels(): Voxel[] {
  const v: Voxel[] = [];
  for (let y = 0; y <= 12; y++) {
    const reach = Math.round(((12 - y) / 12) * 9);
    for (let x = -reach + 1; x <= 2; x++) v.push([x, y, 1, y % 4 === 3 ? "#e7dcc3" : "#fbf5e6"]);
  }
  return v;
}

function islandVoxels(seed: number, tall: boolean): Voxel[] {
  const rand = seeded(seed);
  const v: Voxel[] = [];
  for (let x = -5; x <= 5; x++)
    for (let z = -3; z <= 3; z++) {
      const d = Math.hypot(x / 5, z / 3);
      if (d > 1) continue;
      v.push([x, 0, z, rand() > 0.5 ? "#e8d29a" : "#dcc283"]);
      if (d < 0.6) v.push([x, 1, z, rand() > 0.5 ? "#6cc04a" : "#5cb33d"]);
    }
  // a harbour tower
  voxelBox(v, -3, -2, 2, tall ? 6 : 4, -1, 0, "#e5e7eb");
  voxelBox(v, -3, -2, tall ? 7 : 5, tall ? 7 : 5, -1, 0, "#b45309");
  // a palm
  voxelBox(v, 2, 2, 2, 5, 0, 0, "#a68a5b");
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    v.push([2 + dx, 6, dz, "#2f7a35"], [2 + dx * 2, 5, dz * 2, "#3f8f3a"]);
  }
  v.push([2, 6, 0, "#2f7a35"]);
  return v;
}

export const createShipVoyage: CreateWorld = ({ stage, students, lowGraphics, showScores }) => {
  const world = new THREE.Group();
  stage.scene.add(world);
  const sunDirection: [number, number, number] = [-0.5, 0.08, -0.86];
  skyDome(world, { top: "#2a74c4", horizon: "#e4f1f4" }, sunDirection);
  // a long lens from just above the deck, looking out to a real horizon
  stage.useDepthCamera(22, new THREE.Vector3(0, 0.1, 1));
  stage.setDrift(0.01);
  stage.setDepthFog("#e4f1f4", 40, 340);
  const sparks = createSparks(world);

  const grid = gridLayout(students.length, 4.6, CELL_Z);
  const rows = Math.max(1, Math.round(grid.depth / CELL_Z));
  const deckBack = -2;
  const deckFront = deckBack + grid.depth + 2;
  const halfW = Math.max(30, grid.width / 2 + 3);
  const halfDeck = Math.ceil(grid.width / 2) + 1;
  /** Back rows stand on higher decks, so each row sees over the one in front. */
  const tierAt = (row: number) => (rows - 1 - row) * TIER_HEIGHT;

  addSunlight(stage, world, {
    span: halfDeck + 25,
    top: 40,
    bottom: -30,
    lowGraphics,
    from: [-halfDeck * 1.4, 34, deckFront + 40],
    glintFrom: [sunDirection[0] * 100, sunDirection[1] * 100, sunDirection[2] * 100],
  });

  // --- The open sea, moving and catching the light
  const sea = waterPlane({ width: 4000, depth: 4000, color: "#17689b", lowGraphics });
  sea.mesh.position.y = -0.5;
  world.add(sea.mesh);

  // --- Clouds, gulls and a far coastline, all the way around the horizon
  const clouds = cloudRing(world, { count: lowGraphics ? 7 : 14, radius: 320, height: 48, width: 80, seed: 43 });
  const gulls = lowGraphics ? null : flock(world, { count: 8, center: [0, 18, -55], radius: 45, size: 1.3, color: "#f8fafc", seed: 44 });
  world.add(terrainRing({ inner: 230, outer: 480, height: 15, colors: ["#5f8fa0", "#6f9caf", "#9dbccb"], seed: 42, lowGraphics, baseY: -0.5 }));

  // --- Ports along the route, joined by a dotted line
  const portTags = VOYAGE_PORTS.map((port, i) => {
    const x = portX(i);
    const island = voxelMesh(islandVoxels(i + 3, i % 2 === 0), ISLAND_BLOCK);
    island.position.set(x, -0.4, PORT_Z);
    island.castShadow = false;
    world.add(island);
    const tag = stage.label(port.name, "cw-fact");
    tag.position.set(x, 15, PORT_Z);
    world.add(tag);
    return tag;
  });
  const dots: Voxel[] = [];
  for (let x = -ROUTE_HALF; x <= ROUTE_HALF; x += 3) dots.push([x, 0, ROUTE_Z, "#f8fafc"]);
  const dotMesh = voxelMesh(dots, 0.5);
  dotMesh.position.y = -0.3;
  dotMesh.castShadow = false;
  world.add(dotMesh);

  const factTag = stage.label("", "cw-fact");
  factTag.position.set(0, 31, PORT_Z);
  world.add(factTag);

  // --- The class's dhow
  const dhow = new THREE.Group();
  const hull = voxelMesh(hullVoxels(), DHOW_BLOCK);
  hull.castShadow = false;
  dhow.add(hull);
  const sail = new THREE.Group();
  sail.position.set(0, 5 * DHOW_BLOCK, 0);
  const sailMesh = voxelMesh(sailVoxels(), DHOW_BLOCK);
  sailMesh.castShadow = false;
  sail.add(sailMesh);
  dhow.add(sail);
  dhow.position.set(portX(0), -0.45, ROUTE_Z);
  world.add(dhow);

  // --- Tiered decks, with the crew standing in rows
  const planks: Voxel[] = [];
  for (let x = -halfDeck; x <= halfDeck; x++)
    for (let z = deckBack; z <= deckFront; z++) {
      const row = Math.max(0, Math.min(rows - 1, Math.floor((z - deckBack - 1) / CELL_Z)));
      const top = tierAt(row);
      for (let y = 0; y <= top; y += 1) {
        planks.push([x, y - 0.5, z, y < top ? "#7d5228" : z % 2 ? "#b98a4e" : "#a97a42"]);
      }
    }
  // the ship's bow and hull around the decks, so the crew stand on a ship, not a platform
  const bow: Voxel[] = [];
  for (let z = deckBack - 3; z <= deckFront + 1 + halfDeck; z++) {
    const beyond = z - deckFront;
    const half = beyond > 0 ? Math.round(halfDeck * (1 - Math.pow(beyond / (halfDeck + 1), 1.6))) + 1 : halfDeck + 1;
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) === half || z === deckBack - 3 || z === deckFront + 1 + halfDeck;
      planks.push([x, -1.5, z, edge ? "#5f3c1c" : "#7d5228"]);
      if (beyond > 0) bow.push([x, -0.5, z, edge ? "#6b3f1d" : (z % 2 ? "#b98a4e" : "#a97a42")]);
    }
  }
  planks.push(...bow);
  world.add(voxelMesh(planks, 1));

  const crew = students.map((s, i) => {
    const { x, z } = grid.at(i);
    const row = Math.round((z + grid.depth / 2 - CELL_Z / 2) / CELL_Z);
    const root = new THREE.Group();
    const floor = tierAt(row) + 0.05;
    root.position.set(x, floor, z + deckBack + 1 + grid.depth / 2);
    const avatar = buildAvatar(s.color);
    avatar.group.scale.setScalar(1.7);
    root.add(avatar.group);
    const tag = studentTag(stage, s);
    tag.position.set(0, 3.25, 0);
    root.add(tag);
    world.add(root);
    return { student: s, root, floor, avatar, tag: tag as CSS2DObject, pop: 0, wave: 0 };
  });

  stage.fit({
    minX: -halfW,
    maxX: halfW,
    minZ: PORT_Z,
    maxZ: deckFront + 1,
    minY: -5, // room for the class goal bar
    maxY: 20,
  });

  let placed = false;
  let position = 0;
  let targetPosition = 0;
  let lastPort = 0;
  let arrivedNow = false;
  let sailFill = 0;
  let sailPop = 0;
  const goalPerStudent = worldMeta("ship-voyage").goalPerStudent;

  return {
    setTotals(totals) {
      const goal = classGoal(students.length, goalPerStudent);
      const progress = voyageProgress(classTotal(totals), goal);
      arrivedNow = placed && progress.lastPort > lastPort;
      lastPort = progress.lastPort;
      targetPosition = progress.position;
      if (!placed) position = targetPosition;
      // the sail fills up over each leg, and is full on arrival at the last port
      sailFill = progress.lastPort === VOYAGE_PORTS.length - 1 ? 1 : progress.position - progress.lastPort;

      portTags.forEach((tag, i) => {
        tag.element.textContent = i <= lastPort ? `✓ ${VOYAGE_PORTS[i].name}` : VOYAGE_PORTS[i].name;
      });
      factTag.element.textContent = VOYAGE_PORTS[lastPort].fact;
      for (const c of crew) c.tag.element.textContent = tagName(c.student.name, totals[c.student.id] ?? 0, showScores);
      placed = true;
    },

    reward(studentId) {
      const c = crew.find((x) => x.student.id === studentId);
      if (!c) return;
      c.pop = 1;
      c.wave = 1;
      sailPop = 1;
      playSound("sail");
      const at = c.root.position.clone().setY(c.floor + 1.6);
      sparks.burst(at, c.student.color);
      if (arrivedNow) {
        // the point that reached a port: show everyone where they landed
        arrivedNow = false;
        playSound("waves", 0.1);
        playSound("gulls", 0.9);
        const port = new THREE.Vector3(portX(lastPort), 6, (ROUTE_Z + PORT_Z) / 2);
        sparks.burst(port, "#fde047", "#ffffff", 40);
        stage.focusOn(port, 2.8, 3500);
        return;
      }
      stage.focusOn(at, 2.4, 1800);
    },

    tick(dt, time) {
      sparks.tick(dt);
      sea.tick(time);
      clouds.tick(time);
      gulls?.tick(time);
      position += (targetPosition - position) * Math.min(1, dt * 1.2);
      dhow.position.x = portX(position);
      dhow.position.y = -0.45 + Math.sin(time * 1.3) * 0.12;
      dhow.rotation.z = Math.sin(time * 0.9) * 0.025;

      sailPop = Math.max(0, sailPop - dt * 1.2);
      const fill = 0.55 + sailFill * 0.45 + Math.sin(sailPop * Math.PI) * 0.15;
      sail.scale.set(fill, fill, 1);

      for (const c of crew) {
        c.pop = Math.max(0, c.pop - dt * 1.4);
        c.root.position.y = c.floor + Math.abs(Math.sin(c.pop * Math.PI)) * 0.5;
        c.wave = Math.max(0, c.wave - dt * 0.5);
        c.avatar.setWave(Math.min(1, c.wave * 2), time);
      }
    },

    dispose: () => disposeWorld(stage, world),
  };
};
