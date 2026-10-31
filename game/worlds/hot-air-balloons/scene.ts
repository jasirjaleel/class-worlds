import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { goalReached } from "@/lib/points";
import { BALLOON_CLOUD_POINTS, BALLOON_MAX_POINTS, balloonHeight } from "@/lib/worldProgress";
import { cloudVoxels, disposeWorld, studentTag, voxelBox } from "../../engine/kit";
import { createSparks } from "../../engine/sparks";
import { seeded, voxelMesh, voxelSphere, type Voxel } from "../../engine/voxel";
import { worldMeta } from "../registry";
import type { CreateWorld } from "../types";

// Hot Air Balloons: balloons stand side by side, so none hides another, and every
// point lifts one higher. Past the cloud line they rise into the sunshine.
// Reaching the class goal paints a rainbow across the sky.

const BLOCK = 0.24;
const SKY_HEIGHT = 21;
const RAINBOW = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];

function balloonVoxels(color: string): Voxel[] {
  const v: Voxel[] = [];
  // the envelope: stripes of the student's colour and white around the balloon
  for (const [x, y, z] of voxelSphere(5.4, (a, _b, c) => {
    const slice = Math.floor(((Math.atan2(c, a) + Math.PI) / (Math.PI * 2)) * 8);
    return slice % 2 ? color : "#ffffff";
  })) {
    const shade = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 8) % 2;
    v.push([x, y + 12, z, shade ? color : "#ffffff"]);
  }
  // the basket and its ropes
  voxelBox(v, -2, 2, 0, 2, -2, 2, "#92400e");
  for (const x of [-2, 2]) voxelBox(v, x, x, 3, 6, 0, 0, "#57534e");
  v.push([0, 3, 0, "#f2c9a0"]); // the pilot's head
  return v;
}

export const createHotAirBalloons: CreateWorld = ({ stage, students, lowGraphics }) => {
  const world = new THREE.Group();
  stage.scene.add(world);
  stage.scene.background = new THREE.Color("#7cc7ee");
  stage.setCameraOffset(new THREE.Vector3(0, 7, 80));
  const sparks = createSparks(world);
  const rand = seeded(19);

  const n = Math.max(students.length, 1);
  const spacing = Math.min(5, Math.max(2.8, 40 / n));
  const halfW = Math.max((n * spacing) / 2 + 2, 22);
  const baseY = (i: number) => 2.4 + (i % 2) * 2.2; // two starting heights keep name tags apart
  const cloudY = 3.5 + (BALLOON_CLOUD_POINTS / BALLOON_MAX_POINTS) * SKY_HEIGHT;
  const topY = 4.6 + SKY_HEIGHT + 5;

  // --- Ground, hills, sun and the cloud line
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 4, 8, 24),
    new THREE.MeshLambertMaterial({ color: "#4d9a2f" }),
  );
  ground.position.set(0, -4, -2);
  world.add(ground);
  const hills: Voxel[] = [];
  for (let x = -Math.ceil(halfW * 1.5); x <= halfW * 1.5; x += 1) {
    const h = Math.round(2 + Math.sin(x * 0.25) * 1.2 + Math.sin(x * 0.09 + 1) * 1.4);
    for (let y = 0; y <= h; y++) hills.push([x, y, 0, y === h ? "#65a30d" : "#3f7d24"]);
  }
  const hillMesh = voxelMesh(hills, 1);
  hillMesh.position.set(0, 0, -11);
  world.add(hillMesh);

  const sun = voxelMesh(voxelSphere(4, () => "#fde047"), 0.8);
  sun.material = new THREE.MeshBasicMaterial();
  sun.position.set(halfW - 6, topY - 6, -22);
  world.add(sun);

  const clouds = Array.from({ length: lowGraphics ? 6 : 12 }, (_, i) => {
    const c = voxelMesh(cloudVoxels(rand, 7, 3), 0.55);
    c.rotation.x = Math.PI / 2; // stand the flat puff up so it faces the viewer
    c.position.set(-halfW + (i / (lowGraphics ? 6 : 12)) * halfW * 2, cloudY + (i % 3) * 0.7, -8);
    world.add(c);
    return c;
  });
  const lineTag = stage.label(`Above the clouds · ${BALLOON_CLOUD_POINTS} pts`, "cw-planet");
  lineTag.position.set(-halfW + 6, cloudY + 2.6, -6);
  world.add(lineTag);

  // --- The rainbow, shown when the class reaches its goal
  const rainbow = new THREE.Group();
  RAINBOW.forEach((color, i) => {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(halfW * 0.72 - i * 1.1, 0.55, 6, 64, Math.PI),
      new THREE.MeshBasicMaterial({ color }),
    );
    rainbow.add(band);
  });
  rainbow.position.set(0, 2, -16);
  rainbow.visible = false;
  world.add(rainbow);

  // --- One balloon per student
  const balloons = students.map((s, i) => {
    const root = new THREE.Group();
    const x = (i - (n - 1) / 2) * spacing;
    root.position.set(x, baseY(i), 0);
    root.add(voxelMesh(balloonVoxels(s.color), BLOCK));

    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), new THREE.MeshBasicMaterial({ color: "#fb923c" }));
    flame.position.set(0, 1.55, 0);
    flame.visible = false;
    root.add(flame);

    const tag = studentTag(stage, s);
    tag.center.set(0.5, 0); // the tag hangs under the basket
    tag.position.set(0, -0.25, 0);
    root.add(tag);
    world.add(root);
    return {
      student: s, root, flame, tag: tag as CSS2DObject, x, base: baseY(i),
      y: baseY(i), targetY: baseY(i), pop: 0,
    };
  });

  stage.fit({ minX: -halfW, maxX: halfW, minZ: 0, maxZ: 0, minY: -3.5, maxY: topY + 2 });

  let placed = false;
  let goalDone = false;
  let goalNow = false;
  const goalPerStudent = worldMeta("hot-air-balloons").goalPerStudent;

  return {
    setTotals(totals) {
      for (const b of balloons) {
        const points = totals[b.student.id] ?? 0;
        b.targetY = b.base + balloonHeight(points) * SKY_HEIGHT;
        if (!placed) b.y = b.targetY;
        b.tag.element.textContent = `${b.student.name} ${points}`;
      }
      const reached = goalReached(totals, students.length, goalPerStudent);
      goalNow = placed && reached && !goalDone;
      goalDone = reached;
      rainbow.visible = reached;
      placed = true;
    },

    reward(studentId) {
      const b = balloons.find((x) => x.student.id === studentId);
      if (!b) return;
      b.pop = 1;
      sparks.burst(new THREE.Vector3(b.x, b.targetY + 3, 1), b.student.color);
      if (goalNow) {
        goalNow = false; // stay zoomed out so the whole rainbow shows
        return;
      }
      stage.focusOn(new THREE.Vector3(b.x, b.targetY + 2, 0), 2.6, 2200);
    },

    tick(dt, time) {
      sparks.tick(dt);
      balloons.forEach((b, i) => {
        const rising = b.targetY - b.y > 0.03;
        b.y += (b.targetY - b.y) * Math.min(1, dt * 1.8);
        b.root.position.set(b.x + Math.sin(time * 0.6 + i) * 0.1, b.y + Math.sin(time * 1.2 + i * 2) * 0.1, 0);
        b.flame.visible = rising || b.pop > 0.2;
        if (b.flame.visible) b.flame.scale.y = 0.7 + Math.random() * 0.8;
        b.pop = Math.max(0, b.pop - dt * 1.4);
        const s = 1 + Math.sin(b.pop * Math.PI) * 0.2;
        b.root.scale.setScalar(s);
      });
      clouds.forEach((c, i) => {
        c.position.x = -halfW * 1.4 + ((time * 0.5 + i * ((halfW * 2.8) / clouds.length)) % (halfW * 2.8));
      });
    },

    dispose: () => disposeWorld(stage, world),
  };
};
