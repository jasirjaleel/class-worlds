import * as THREE from "three";
import { buildAvatar } from "../engine/avatar";
import { Stage } from "../engine/stage";
import { seeded, voxelMesh, voxelSphere, type Voxel } from "../engine/voxel";
import { rocketVoxels } from "../worlds/space-fleet/scene";

/** Floating blocky island behind the main menu: a rocket on its pad and a few waving students. */
export function startMenuBackdrop(container: HTMLElement, lowGraphics: boolean) {
  const stage = new Stage(container, { lowGraphics, background: "#0b1026" });
  const island = new THREE.Group();
  stage.scene.add(island);

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
    const a = buildAvatar(c, i * 3 + 1);
    a.group.scale.setScalar(1.6);
    const angle = (i / 4) * Math.PI * 2 + 0.6;
    a.group.position.set(Math.cos(angle) * 3.6, 0.3, Math.sin(angle) * 3.6);
    a.group.rotation.y = -angle + Math.PI / 2;
    island.add(a.group);
    return a;
  });

  // a few clouds
  const clouds = [0, 1, 2].map((i) => {
    const c = voxelMesh(voxelSphere(1.8, () => "#e2e8f0"), 0.7);
    c.scale.set(1.8, 0.6, 1);
    c.position.set(-9 + i * 8, 6 + i, -6 + i * 4);
    stage.scene.add(c);
    return c;
  });

  stage.fit({ minX: -9, maxX: 9, minZ: -9, maxZ: 9 });
  stage.start((_dt, t) => {
    island.rotation.y = t * 0.12;
    island.position.y = Math.sin(t * 0.8) * 0.3;
    kids.forEach((k, i) => k.setWave((Math.sin(t * 0.9 + i * 1.7) + 1) / 2 > 0.75 ? 1 : 0, t));
    clouds.forEach((c, i) => (c.position.x = -12 + ((t * 0.6 + i * 8) % 24)));
  });

  return () => stage.dispose();
}
