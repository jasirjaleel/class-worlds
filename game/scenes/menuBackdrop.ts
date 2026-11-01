import * as THREE from "three";
import { buildAvatar } from "../engine/avatar";
import { addSunlight, skyTexture } from "../engine/kit";
import { Stage } from "../engine/stage";
import { seeded, voxelMesh, voxelSphere, type Voxel } from "../engine/voxel";
import { rocketVoxels } from "../worlds/space-fleet/scene";

/** Floating blocky island behind the main menu: a rocket on its pad and a few waving students. */
export function startMenuBackdrop(container: HTMLElement, lowGraphics: boolean) {
  const stage = new Stage(container, { lowGraphics, background: "#070b18" });
  stage.scene.background = skyTexture("#070b18", "#0c1430", "#16234d");
  stage.useDepthCamera(24, new THREE.Vector3(-18, 26, 48));
  const island = new THREE.Group();
  stage.scene.add(island);
  addSunlight(stage, island, { span: 14, top: 14, lowGraphics, from: [-14, 22, 18] });

  const rand = seeded(42);
  const ground: Voxel[] = [];
  const R = 9;
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const d = Math.sqrt(x * x + z * z);
      if (d > R) continue;
      ground.push([x, 0, z, rand() > 0.85 ? "#4ade80" : "#22c55e"]);
      // the island tapers into a rocky point underneath
      const depth = Math.floor((R - d) * 0.7) + 1;
      for (let y = 1; y <= depth; y++) ground.push([x, -y, z, y < 2 ? "#92400e" : rand() > 0.5 ? "#57534e" : "#78716c"]);
    }
  island.add(voxelMesh(ground, 0.6));

  // trees
  for (const [tx, tz] of [[-4, -3], [3, -5], [5, 3], [-5, 4]]) {
    const tree: Voxel[] = [];
    for (let y = 1; y <= 3; y++) tree.push([0, y, 0, "#7c2d12"]);
    for (const v of voxelSphere(1.6, () => (rand() > 0.5 ? "#15803d" : "#16a34a"))) tree.push([v[0], v[1] + 4, v[2], v[3]]);
    const m = voxelMesh(tree, 0.6);
    m.position.set(tx * 0.6, 0, tz * 0.6);
    island.add(m);
  }

  // rocket standing on its pad
  const pad = voxelMesh(
    Array.from({ length: 25 }, (_, i): Voxel => [(i % 5) - 2, 0, Math.floor(i / 5) - 2, "#4b5563"]),
    0.45,
  );
  pad.position.set(0.6, 0.55, 0);
  island.add(pad);
  const rocket = voxelMesh(rocketVoxels(5, "#ef4444"), 0.45);
  rocket.position.set(0.6, 1.0, 0);
  island.add(rocket);

  const kids = ["#3b82f6", "#f59e0b", "#a855f7", "#14b8a6"].map((c, i) => {
    const a = buildAvatar(c);
    a.group.scale.setScalar(1.6);
    // in the gaps between the trees, clear of their trunks
    const angle = (i / 4) * Math.PI * 2 + 1.5;
    a.group.position.set(Math.cos(angle) * 4.2, 0.3, Math.sin(angle) * 4.2);
    a.group.rotation.y = -angle + Math.PI / 2;
    island.add(a.group);
    return a;
  });

  // a few puffy clouds: a wide rounded layer with a smaller one on top
  const clouds = [0, 1, 2].map((i) => {
    const puff: Voxel[] = [];
    for (let x = -5; x <= 5; x++)
      for (let z = -3; z <= 3; z++) {
        const d = Math.hypot(x / 5, z / 3) + rand() * 0.2;
        if (d < 1) puff.push([x, 0, z, "#f1f5f9"]);
        if (d < 0.55) puff.push([x, 1, z, "#ffffff"]);
      }
    const c = voxelMesh(puff, 0.4);
    c.position.set(0, 4 + i * 0.8, -5 + i * 3);
    stage.scene.add(c);
    return c;
  });

  // distant stars, placed well behind the island as seen from the camera
  const away = new THREE.Vector3(-18, 34, 48).normalize().multiplyScalar(-80);
  const starPos: number[] = [];
  for (let i = 0; i < 500; i++) {
    starPos.push(away.x + (rand() - 0.5) * 120, away.y + (rand() - 0.5) * 120, away.z + (rand() - 0.5) * 120);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  stage.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#c7d2fe", size: 1.3, sizeAttenuation: false })));

  stage.fit({ minX: -6.5, maxX: 6.5, minZ: -6.5, maxZ: 6.5, minY: -4, maxY: 5 });
  stage.start((_dt, t) => {
    island.rotation.y = t * 0.12;
    island.position.y = Math.sin(t * 0.8) * 0.3;
    kids.forEach((k, i) => k.setWave((Math.sin(t * 0.9 + i * 1.7) + 1) / 2 > 0.75 ? 1 : 0, t));
    // a wide loop so clouds wrap around off-screen, even on very wide displays
    clouds.forEach((c, i) => (c.position.x = -30 + ((t * 0.6 + i * 20) % 60)));
  });

  return () => stage.dispose();
}
