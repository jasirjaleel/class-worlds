import * as THREE from "three";

const sparkGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);

/** Little cubes that burst out, fall and fade. Used for reward moments. */
export function createSparks(parent: THREE.Object3D) {
  const sparks: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  return {
    burst(at: THREE.Vector3, color: string, altColor = "#fde047", count = 18) {
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(
          sparkGeo,
          new THREE.MeshBasicMaterial({ color: i % 2 ? color : altColor, transparent: true }),
        );
        mesh.position.copy(at);
        const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.4, Math.random() - 0.5).multiplyScalar(6);
        parent.add(mesh);
        sparks.push({ mesh, vel, life: 1 });
      }
    },
    tick(dt: number) {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life -= dt * 1.1;
        sp.vel.y -= 12 * dt;
        sp.mesh.position.addScaledVector(sp.vel, dt);
        sp.mesh.rotation.x += dt * 6;
        (sp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, sp.life);
        if (sp.life <= 0) {
          parent.remove(sp.mesh);
          (sp.mesh.material as THREE.Material).dispose();
          sparks.splice(i, 1);
        }
      }
    },
  };
}
