import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { classGoal, classTotal } from "@/lib/points";
import { VOYAGE_PORTS, voyageProgress } from "@/lib/worldProgress";
import { buildAvatar } from "../../engine/avatar";
import { disposeWorld, gridLayout, studentTag, voxelBox } from "../../engine/kit";
import { createSparks } from "../../engine/sparks";
import { seeded, voxelMesh, type Voxel } from "../../engine/voxel";
import { worldMeta } from "../registry";
import type { CreateWorld } from "../types";

// Ship Voyage: the class is one crew on one dhow. The whole class's points fill
// the sail and carry the dhow from port to port on the sea behind. Every student
// stands on the deck in front, so everyone stays in view.

const ROUTE_HALF = 24;
const ROUTE_Z = -15; // the dhow sails in front of the ports, so they never overlap
const PORT_Z = ROUTE_Z - 8;
const BLOCK = 0.46;
const RIPPLE_SIZE = 0.7;

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

export const createShipVoyage: CreateWorld = ({ stage, students, lowGraphics }) => {
  const world = new THREE.Group();
  stage.scene.add(world);
  stage.scene.background = new THREE.Color("#9edcf2");
  stage.setCameraOffset(new THREE.Vector3(0, 34, 46));
  const sparks = createSparks(world);
  const rand = seeded(41);

  const grid = gridLayout(students.length, 4.6, 3.9);
  const deckBack = -4;
  const deckFront = deckBack + grid.depth + 2;
  const halfW = Math.max(ROUTE_HALF + 7, grid.width / 2 + 3);

  // --- The sea, with lighter ripples
  const sea = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 + 2, 1, deckFront - PORT_Z + 22),
    new THREE.MeshLambertMaterial({ color: "#1d7fb8" }),
  );
  sea.position.set(0, -1, (deckFront + PORT_Z - 8) / 2);
  world.add(sea);
  const ripples: Voxel[] = [];
  for (let i = 0; i < (lowGraphics ? 120 : 320); i++) {
    const z = PORT_Z - 6 + rand() * (deckFront - PORT_Z + 8);
    ripples.push([((rand() - 0.5) * halfW * 2) / RIPPLE_SIZE, 0, z / RIPPLE_SIZE, rand() > 0.5 ? "#3a9bd0" : "#5db4de"]);
  }
  const rippleMesh = voxelMesh(ripples, RIPPLE_SIZE);
  rippleMesh.scale.y = 0.15;
  rippleMesh.position.y = -0.45;
  world.add(rippleMesh);

  // --- Ports along the route, joined by a dotted line
  const portTags = VOYAGE_PORTS.map((port, i) => {
    const x = portX(i);
    const island = voxelMesh(islandVoxels(i + 3, i % 2 === 0), 0.55);
    island.position.set(x, -0.4, PORT_Z);
    world.add(island);
    const tag = stage.label(port.name, "cw-planet");
    tag.position.set(x, 5.4, PORT_Z);
    world.add(tag);
    return tag;
  });
  const dots: Voxel[] = [];
  for (let x = -ROUTE_HALF; x <= ROUTE_HALF; x += 2) dots.push([x, 0, ROUTE_Z, "#f8fafc"]);
  const dotMesh = voxelMesh(dots, 0.3);
  dotMesh.position.y = -0.4;
  world.add(dotMesh);

  const factTag = stage.label("", "cw-fact");
  factTag.position.set(0, 9, PORT_Z - 3);
  world.add(factTag);

  // --- The class's dhow
  const dhow = new THREE.Group();
  dhow.add(voxelMesh(hullVoxels(), BLOCK));
  const sail = new THREE.Group();
  sail.position.set(0, 5 * BLOCK, 0);
  sail.add(voxelMesh(sailVoxels(), BLOCK));
  dhow.add(sail);
  dhow.position.set(portX(0), -0.45, ROUTE_Z);
  world.add(dhow);

  // --- The deck, with the crew standing in rows
  const planks: Voxel[] = [];
  const halfDeck = Math.ceil(grid.width / 2) + 1;
  for (let x = -halfDeck; x <= halfDeck; x++)
    for (let z = deckBack; z <= deckFront; z++) planks.push([x, -0.5, z, z % 2 ? "#b98a4e" : "#a97a42"]);
  world.add(voxelMesh(planks, 1));
  const rail: Voxel[] = [];
  for (let x = -halfDeck; x <= halfDeck; x++) {
    rail.push([x, 0.5, deckBack, "#6b3f1d"]);
    if (x % 3 === 0) rail.push([x, 0.5 - 1, deckBack, "#6b3f1d"]);
  }
  world.add(voxelMesh(rail, 1));

  const crew = students.map((s, i) => {
    const { x, z } = grid.at(i);
    const root = new THREE.Group();
    root.position.set(x, 0, z + deckBack + 1 + grid.depth / 2);
    const avatar = buildAvatar(s.color, i * 7 + s.name.length);
    avatar.group.scale.setScalar(1.7);
    root.add(avatar.group);
    const tag = studentTag(stage, s);
    tag.position.set(0, 2.9, 0);
    root.add(tag);
    world.add(root);
    return { student: s, root, avatar, tag: tag as CSS2DObject, pop: 0, wave: 0 };
  });

  stage.fit({ minX: -halfW, maxX: halfW, minZ: PORT_Z - 4, maxZ: deckFront + 2.5, minY: 0, maxY: 7 });

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
      for (const c of crew) c.tag.element.textContent = `${c.student.name} ${totals[c.student.id] ?? 0}`;
      placed = true;
    },

    reward(studentId) {
      const c = crew.find((x) => x.student.id === studentId);
      if (!c) return;
      c.pop = 1;
      c.wave = 1;
      sailPop = 1;
      const at = c.root.position.clone().setY(1.6);
      sparks.burst(at, c.student.color);
      if (arrivedNow) {
        // the point that reached a port: show everyone where they landed
        arrivedNow = false;
        const port = new THREE.Vector3(portX(lastPort), 2, (ROUTE_Z + PORT_Z) / 2);
        sparks.burst(port, "#fde047", "#ffffff", 40);
        stage.focusOn(port, 2.6, 3500);
        return;
      }
      stage.focusOn(at, 2.4, 1800);
    },

    tick(dt, time) {
      sparks.tick(dt);
      position += (targetPosition - position) * Math.min(1, dt * 1.2);
      dhow.position.x = portX(position);
      dhow.position.y = -0.45 + Math.sin(time * 1.3) * 0.08;
      dhow.rotation.z = Math.sin(time * 0.9) * 0.025;

      sailPop = Math.max(0, sailPop - dt * 1.2);
      const fill = 0.55 + sailFill * 0.45 + Math.sin(sailPop * Math.PI) * 0.15;
      sail.scale.set(fill, fill, 1);

      for (const c of crew) {
        c.pop = Math.max(0, c.pop - dt * 1.4);
        c.root.position.y = Math.abs(Math.sin(c.pop * Math.PI)) * 0.5;
        c.wave = Math.max(0, c.wave - dt * 0.5);
        c.avatar.setWave(Math.min(1, c.wave * 2), time);
      }
    },

    dispose: () => disposeWorld(stage, world),
  };
};
