import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { goalReached } from "@/lib/points";
import { BALLOON_CLOUD_POINTS, BALLOON_MAX_POINTS, balloonHeight } from "@/lib/worldProgress";
import { addSunlight, addSurroundings, disposeWorld, studentTag, tagName, voxelBox } from "../../engine/kit";
import { flock, groundMaterial, skyDome, softCloud, terrainRing } from "../../engine/nature";
import { playSound } from "../../engine/sound";
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
  return v;
}

export const createHotAirBalloons: CreateWorld = ({ stage, students, lowGraphics, showScores }) => {
  const world = new THREE.Group();
  stage.scene.add(world);
  skyDome(world, { top: "#2a74c4", horizon: "#e7f4f4" }, [0.52, 0.2, -0.83]);
  // a long lens from low down, looking slightly up: the sky feels huge
  stage.useDepthCamera(22, new THREE.Vector3(0, -0.05, 1));
  stage.setDrift(0.012);
  stage.setDepthFog("#e7f4f4", 6, 300);
  const sparks = createSparks(world);
  const rand = seeded(19);

  const n = Math.max(students.length, 1);
  const spacing = Math.min(5, Math.max(2.8, 40 / n));
  const halfW = Math.max((n * spacing) / 2 + 2, 22);
  const baseY = (i: number) => 2.4 + (i % 2) * 2.2; // two starting heights keep name tags apart
  const depthZ = (i: number) => (i % 2 ? -5 : 0); // and two distances, so the fleet has depth
  const cloudY = 3.5 + (BALLOON_CLOUD_POINTS / BALLOON_MAX_POINTS) * SKY_HEIGHT;
  const topY = 4.6 + SKY_HEIGHT + 5;

  addSunlight(stage, world, {
    span: halfW + 20,
    top: topY + 10,
    bottom: -25,
    lowGraphics,
    from: [-halfW * 1.6, topY * 1.8, 60],
  });

  // --- Ground, hills fading into the distance, sun and the cloud line
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(3000, 2, 3000),
    groundMaterial(["#3f8a28", "#4d9a2f", "#5ea83a"], 120),
  );
  ground.position.set(0, -1, 0);
  ground.receiveShadow = true;
  world.add(ground);
  addSurroundings(world, {
    groundY: 0,
    clear: { minX: -halfW * 1.3, maxX: halfW * 1.3, minZ: -14, maxZ: 1000 },
    reach: 170,
    trees: 240,
    kind: "round",
    leaves: ["#2f7a35", "#3f8f3a", "#256b2d"],
    patches: ["#58a638", "#449029", "#5fae3e"],
    patchClear: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
    seed: 81,
    lowGraphics,
  });
  // rolling green hills behind the balloons, and far mountains all around
  world.add(terrainRing({ inner: 26, outer: 130, height: 15, colors: ["#4d9a2f", "#3f8a2c", "#5c9a4e"], seed: 83, lowGraphics, gap: 3.1, roughness: 0.035 }));
  world.add(terrainRing({ inner: 125, outer: 330, height: 46, colors: ["#5f8f62", "#6e8f96", "#d4e0e4"], seed: 82, lowGraphics }));
  const birds = lowGraphics ? null : flock(world, { count: 8, center: [0, topY - 6, -35], radius: 50, size: 0.9, color: "#334155", seed: 84 });
  if (!lowGraphics) {
    // low bushes close to the viewer: they sit below the lowest balloon on screen
    for (let i = 0; i < 12; i++) {
      const bush = voxelMesh(voxelSphere(3.4, () => (rand() > 0.5 ? "#2f7a35" : "#3f8f3a")), 0.42);
      bush.position.set(-halfW * 0.85 + (i / 11) * halfW * 1.7 + rand() * 3, 0.7, 24 + rand() * 12);
      bush.receiveShadow = false;
      bush.castShadow = false;
      world.add(bush);
    }
  }

  const clouds = Array.from({ length: lowGraphics ? 5 : 8 }, (_, i) => {
    // soft clouds at two distances, always behind the balloons
    const c = softCloud(i % 2 ? 22 : 13, i);
    c.position.set(-halfW + (i / (lowGraphics ? 5 : 8)) * halfW * 2, cloudY + (i % 3) * 1.2, i % 2 ? -34 : -12);
    world.add(c);
    return c;
  });
  const lineTag = stage.label(`Above the clouds · ${BALLOON_CLOUD_POINTS} pts`, "cw-fact");
  lineTag.position.set(-halfW + 6, cloudY + 2.6, -6);
  world.add(lineTag);

  // --- The rainbow, shown when the class reaches its goal
  const rainbow = new THREE.Group();
  RAINBOW.forEach((color, i) => {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(halfW * 1.05 - i * 1.6, 0.8, 6, 64, Math.PI),
      new THREE.MeshBasicMaterial({ color, fog: false, transparent: true, opacity: 0.62, depthWrite: false }),
    );
    rainbow.add(band);
  });
  rainbow.position.set(0, 0, -45);
  rainbow.visible = false;
  world.add(rainbow);

  // --- One balloon per student
  const balloons = students.map((s, i) => {
    const root = new THREE.Group();
    const x = (i - (n - 1) / 2) * spacing;
    root.position.set(x, baseY(i), depthZ(i));
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
      student: s, root, flame, tag: tag as CSS2DObject, x, z: depthZ(i), base: baseY(i),
      y: baseY(i), targetY: baseY(i), pop: 0,
    };
  });

  stage.fit({ minX: -halfW, maxX: halfW, minZ: -5, maxZ: 0, minY: -3, maxY: topY + 2 });

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
        b.tag.element.textContent = tagName(b.student.name, points, showScores);
      }
      // a tag drops lower when it would land on its neighbour's, whatever their heights
      balloons.forEach((b, i) => {
        const before = balloons[i - 1];
        const crowded = before && Math.abs(b.targetY - before.targetY) < 1.2 && before.tag.position.y > -1;
        b.tag.position.y = crowded ? -1.45 : -0.25;
      });
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
      sparks.burst(new THREE.Vector3(b.x, b.targetY + 3, b.z + 1), b.student.color);
      playSound("burner");
      if (goalNow) {
        goalNow = false; // stay zoomed out so the whole rainbow shows
        playSound("wind", 0.2);
        return;
      }
      stage.focusOn(new THREE.Vector3(b.x, b.targetY + 2, b.z), 2.6, 2200);
    },

    tick(dt, time) {
      sparks.tick(dt);
      birds?.tick(time);
      balloons.forEach((b, i) => {
        const rising = b.targetY - b.y > 0.03;
        b.y += (b.targetY - b.y) * Math.min(1, dt * 1.8);
        b.root.position.set(b.x + Math.sin(time * 0.6 + i) * 0.1, b.y + Math.sin(time * 1.2 + i * 2) * 0.1, b.z);
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
