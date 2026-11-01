import * as THREE from "three";
import { addSunlight } from "../../engine/kit";
import { cloudRing, flock, groundMaterial, skyDome, terrainRing, waterPlane } from "../../engine/nature";
import type { Stage } from "../../engine/stage";
import { seeded, voxelMesh, type Voxel } from "../../engine/voxel";

// Everything that gives the city depth: its own sun and shadows, a sky that
// fades into haze, a distant city and hills behind, and open water with boats
// in front. Nothing here belongs to a student, so it never hides one.

function boatVoxels(sail: string): Voxel[] {
  const v: Voxel[] = [];
  for (let x = -4; x <= 4; x++) {
    const w = Math.abs(x) > 2 ? 0 : 1;
    for (let z = -w; z <= w; z++) v.push([x, 0, z, "#7c4a21"], [x, 1, z, "#92400e"]);
  }
  for (let y = 2; y <= 8; y++) {
    v.push([0, y, 0, "#57534e"]);
    for (let x = 1; x <= 9 - y; x++) v.push([x - 4, y, 0, sail]);
  }
  return v;
}

export function buildScenery(
  stage: Stage,
  world: THREE.Group,
  opts: { halfW: number; skylineTop: number; lowGraphics: boolean },
) {
  const { halfW, skylineTop, lowGraphics } = opts;
  const rand = seeded(53);
  const sunDirection: [number, number, number] = [-0.5, 0.085, -0.86];
  const sky = skyDome(world, { top: "#2f78c8", horizon: "#e4f1f7" }, sunDirection);

  // --- Day light: a low sun from the left, for long soft shadows between towers
  const day = addSunlight(stage, world, {
    span: halfW + 15,
    top: skylineTop + 15,
    bottom: -25,
    lowGraphics,
    from: [-halfW * 1.5, skylineTop * 1.6, 70],
    glintFrom: [sunDirection[0] * 100, sunDirection[1] * 100, sunDirection[2] * 100],
  });

  // --- Night light: dim blue moonlight, so the lit windows stand out
  const night = new THREE.Group();
  night.add(new THREE.AmbientLight("#8ea4d6", 0.85));
  const moonlight = new THREE.DirectionalLight("#b9c9f2", 0.7);
  moonlight.position.set(halfW, skylineTop * 2, 50);
  night.add(moonlight);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5, 32, 20),
    new THREE.MeshBasicMaterial({ color: "#f8fafc", fog: false }),
  );
  moon.position.set(halfW * 0.72, skylineTop * 1.05, -120);
  night.add(moon);
  const starPos: number[] = [];
  for (let i = 0; i < 600; i++) starPos.push((rand() - 0.5) * halfW * 8, rand() * 130, -280);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  night.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#e2e8f0", size: 1.6, sizeAttenuation: false, fog: false })));
  night.visible = false;
  world.add(night);

  // --- Land behind the city and moving water in front of it
  const land = new THREE.Mesh(
    new THREE.BoxGeometry(3000, 2, 1500),
    groundMaterial(["#6f8c5e", "#7f9a6b", "#8ea678"], 80),
  );
  land.position.set(0, -1.05, -759);
  land.receiveShadow = true;
  world.add(land);
  const water = waterPlane({ width: 3000, depth: 1500, color: "#1f6f97", lowGraphics });
  water.mesh.position.set(0, -0.6, 7 + 750);
  world.add(water.mesh);

  // --- A low, hazy city behind the students' towers, so even short buildings stand out
  const count = lowGraphics ? 60 : 170;
  const towers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    count,
  );
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const z = -30 - rand() * rand() * 75;
    const closeness = 1 + z / 130; // further back means shorter
    const h = (2 + rand() * rand() * skylineTop * 0.28) * closeness;
    const w = 2.4 + rand() * 3;
    m.compose(
      new THREE.Vector3((rand() - 0.5) * halfW * 3.4, h / 2, z),
      q,
      new THREE.Vector3(w, h, w * 0.8),
    );
    towers.setMatrixAt(i, m);
    towers.setColorAt(i, c.set(["#8fa3b8", "#a7b5c4", "#7b8ea3", "#b5b0a4"][i % 4]));
  }
  towers.castShadow = false;
  towers.receiveShadow = false;
  world.add(towers);

  // --- More of the city along the waterfront, past both ends of the students' row
  const shore = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), lowGraphics ? 24 : 70);
  for (let i = 0; i < shore.count; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (halfW + 1 + rand() * halfW * 2.4);
    const h = 3 + rand() * rand() * skylineTop * 0.5;
    const w = 2.2 + rand() * 1.4;
    m.compose(new THREE.Vector3(x, h / 2, -6 - rand() * 14), q, new THREE.Vector3(w, h, 2.4));
    shore.setMatrixAt(i, m);
    shore.setColorAt(i, c.set(["#9fb0c2", "#b7c2cd", "#8c9eb2", "#c2bbae"][i % 4]));
  }
  shore.castShadow = false;
  world.add(shore);

  // --- Green hills behind the city, and far mountains all the way around
  const hills = terrainRing({ inner: 70, outer: 165, height: 20, colors: ["#6f8f5e", "#5f8259", "#6e8d6a"], seed: 54, lowGraphics, gap: 3.5, baseY: -0.1, roughness: 0.03 });
  world.add(hills);
  const mountains = terrainRing({ inner: 170, outer: 340, height: 28, colors: ["#6b8a78", "#6f8a93", "#a9bcc6"], seed: 55, lowGraphics, baseY: -0.1 });
  world.add(mountains);

  // --- Clouds and a few birds, by day
  const clouds = cloudRing(world, { count: lowGraphics ? 6 : 12, radius: 260, height: 58, width: 62, seed: 56 });
  const birds = lowGraphics ? null : flock(world, { count: 9, center: [0, skylineTop + 3, -40], radius: 55, size: 1.1, color: "#334155", seed: 57 });

  // --- Small boats on the water, the closest things to the viewer
  const boats = (lowGraphics ? [0] : [0, 1, 2]).map((i) => {
    const boat = voxelMesh(boatVoxels(["#f8fafc", "#fde68a", "#fecaca"][i]), 0.34 + i * 0.05);
    boat.position.y = -0.4;
    boat.castShadow = false;
    world.add(boat);
    return { boat, z: 16 + i * 17, speed: 0.5 - i * 0.12, offset: i * 40 };
  });

  let isNight: boolean | null = null;

  return {
    setNight(next: boolean) {
      if (next === isNight) return;
      isNight = next;
      sky.setColors(next ? "#040816" : "#2f78c8", next ? "#27375e" : "#e4f1f7", next ? 0 : 1);
      stage.setDepthFog(next ? "#27375e" : "#e4f1f7", 2, 200);
      for (const c of clouds.clouds) c.cloud.material.opacity = next ? 0.12 : 0.95;
      day.visible = !next;
      night.visible = next;
    },
    tick(time: number) {
      water.tick(time);
      clouds.tick(time);
      if (!isNight) birds?.tick(time);
      const span = halfW * 3;
      for (const b of boats) {
        b.boat.position.set(((time * b.speed + b.offset) % span) - span / 2, -0.4 + Math.sin(time * 1.1 + b.z) * 0.05, b.z);
      }
    },
  };
}
