import * as THREE from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { seeded } from "../../engine/voxel";
import { drawSurface, type SurfaceId } from "./surfaces";

// The Sun, the 8 planets, the Moon, the Asteroid Belt and the Kuiper Belt, in a
// row like a classroom poster. Sizes follow the real radii (square-root
// compressed so they fit); spacing is evenly compressed.

export const PLANET_Y = 16;
const PLANET_Z = -12;

/** Display radius from the real radius in km. Keeps the true size order. */
const displayRadius = (km: number) => 0.55 * Math.sqrt(km / 1000);

interface BodyDef {
  id: SurfaceId;
  name: string;
  radiusKm: number;
  x: number;
  /** Real texture in public/textures/solar/ (Solar System Scope, CC BY 4.0), used when present. */
  file?: string;
  /** Axial tilt in degrees */
  tilt?: number;
  spin: number;
}

const BODIES: BodyDef[] = [
  { id: "mercury", name: "Mercury", radiusKm: 2440, x: -17, file: "2k_mercury.jpg", spin: 0.05 },
  { id: "venus", name: "Venus", radiusKm: 6052, x: -13, file: "2k_venus_atmosphere.jpg", tilt: 177, spin: 0.03 },
  { id: "earth", name: "Earth", radiusKm: 6371, x: -7.5, file: "2k_earth_daymap.jpg", tilt: 23.4, spin: 0.25 },
  { id: "mars", name: "Mars", radiusKm: 3390, x: 0.5, file: "2k_mars.jpg", tilt: 25.2, spin: 0.24 },
  { id: "jupiter", name: "Jupiter", radiusKm: 69911, x: 15.5, file: "2k_jupiter.jpg", tilt: 3.1, spin: 0.4 },
  { id: "saturn", name: "Saturn", radiusKm: 58232, x: 26, file: "2k_saturn.jpg", tilt: 26.7, spin: 0.38 },
  { id: "uranus", name: "Uranus", radiusKm: 25362, x: 35, file: "2k_uranus.jpg", tilt: 97.8, spin: 0.3 },
  { id: "neptune", name: "Neptune", radiusKm: 24622, x: 42, file: "2k_neptune.jpg", tilt: 28.3, spin: 0.3 },
];

const SUN = { radius: displayRadius(696_340), x: -34 };
const BELT_X = 7.5;
const KUIPER_X = 49;

/** Journey stops: total points needed to reach each (the first 5 build the rocket at Earth). */
export const STOPS = [
  { name: "Earth", points: 5, x: -7.5 },
  { name: "Mars", points: 9, x: 0.5 },
  { name: "Asteroid Belt", points: 13, x: BELT_X },
  { name: "Jupiter", points: 17, x: 15.5 },
  { name: "Saturn", points: 22, x: 26 },
  { name: "Uranus", points: 27, x: 35 },
  { name: "Neptune", points: 33, x: 42 },
  { name: "Kuiper Belt", points: 40, x: KUIPER_X },
];

/** Where a rocket with this many points sits; between stops it is part-way along. */
export function pointsToX(points: number): number {
  if (points <= STOPS[0].points) return STOPS[0].x;
  for (let i = 1; i < STOPS.length; i++) {
    const a = STOPS[i - 1];
    const b = STOPS[i];
    if (points <= b.points) return a.x + ((points - a.points) / (b.points - a.points)) * (b.x - a.x);
  }
  return STOPS[STOPS.length - 1].x;
}

export function stopReached(points: number): string | null {
  let reached: string | null = null;
  for (const s of STOPS) if (points >= s.points) reached = s.name;
  return reached;
}

// maxY leaves room above the planets for the screen's top bar
export const SCENE_BOUNDS = { minX: -24, maxX: 53, maxY: PLANET_Y + 11 };

type LabelFactory = (text: string, className?: string) => CSS2DObject;

function sphere(radius: number, map: THREE.Texture, lowGraphics: boolean) {
  const seg = lowGraphics ? 32 : 64;
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, seg, seg / 2),
    new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 }),
  );
}

/** Soft additive glow drawn on a canvas, used around the Sun. */
function glowSprite(color: string, size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
  g.addColorStop(0, color);
  g.addColorStop(0.35, "rgba(255,150,40,0.35)");
  g.addColorStop(1, "rgba(255,120,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

/** Ring geometry whose u texture coordinate runs from the inner to the outer edge. */
function ringGeometry(inner: number, outer: number) {
  const geo = new THREE.RingGeometry(inner, outer, 128, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  return geo;
}

/** Irregular rocks scattered in a vertical band (the poster view of a belt). */
function rockField(opts: {
  count: number; x: number; width: number; height: number; seed: number; colors: string[]; size: [number, number];
}) {
  const rand = seeded(opts.seed);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  // squash some vertices so rocks are not perfect gems
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.7 + rand() * 0.5), p.getY(i) * (0.6 + rand() * 0.5), p.getZ(i));
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), opts.count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  const drift: { y: number; speed: number }[] = [];
  for (let i = 0; i < opts.count; i++) {
    const s = opts.size[0] + rand() * rand() * (opts.size[1] - opts.size[0]);
    // denser in the middle of the band, like the real belt seen edge-on
    const x = opts.x + (rand() + rand() - 1) * opts.width * 0.5;
    const y = PLANET_Y + (rand() - 0.5) * opts.height;
    const z = PLANET_Z + (rand() - 0.5) * 8;
    q.setFromEuler(e.set(rand() * 6, rand() * 6, rand() * 6));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(opts.colors[Math.floor(rand() * opts.colors.length)]));
    drift.push({ y, speed: 0.2 + rand() * 0.4 });
  }
  return { mesh, drift };
}

export function buildSolarSystem(label: LabelFactory, lowGraphics: boolean) {
  const group = new THREE.Group();
  const spinners: { mesh: THREE.Object3D; speed: number }[] = [];
  const materials = new Map<string, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial>();

  // --- Light from the Sun: every planet gets a day side and a night side
  const sunLight = new THREE.PointLight("#fff1dc", 3.2, 0, 0);
  sunLight.position.set(SUN.x, PLANET_Y, PLANET_Z);
  const fill = new THREE.DirectionalLight("#9fb4ff", 0.45); // faint fill from the viewer so rockets stay readable
  fill.position.set(0, 10, 80);
  group.add(sunLight, fill, new THREE.AmbientLight("#334066", 0.35));

  // --- The Sun
  const sunMat = new THREE.MeshBasicMaterial({ map: drawSurface("sun", lowGraphics) });
  materials.set("2k_sun.jpg", sunMat);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN.radius, 64, 32), sunMat);
  sun.position.set(SUN.x, PLANET_Y, PLANET_Z);
  group.add(sun);
  spinners.push({ mesh: sun, speed: 0.02 });
  if (!lowGraphics) {
    const glow = glowSprite("rgba(255,220,120,0.9)", SUN.radius * 3.2);
    glow.position.copy(sun.position);
    group.add(glow);
  }
  const sunTag = label("The Sun", "cw-planet");
  sunTag.position.set(-22, PLANET_Y - 8, PLANET_Z + 14);
  group.add(sunTag);

  // --- Planets
  for (const b of BODIES) {
    const r = displayRadius(b.radiusKm);
    const holder = new THREE.Group(); // carries the axial tilt
    holder.position.set(b.x, PLANET_Y, PLANET_Z);
    holder.rotation.z = THREE.MathUtils.degToRad(-(b.tilt ?? 0));
    const mesh = sphere(r, drawSurface(b.id, lowGraphics), lowGraphics);
    if (b.file) materials.set(b.file, mesh.material as THREE.MeshStandardMaterial);
    holder.add(mesh);
    spinners.push({ mesh, speed: b.spin });
    group.add(holder);

    if (b.id === "earth" && !lowGraphics) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.02, 64, 32),
        new THREE.MeshStandardMaterial({ map: drawSurface("earthClouds", lowGraphics), transparent: true, depthWrite: false }),
      );
      materials.set("2k_earth_clouds.jpg", clouds.material as THREE.MeshStandardMaterial);
      holder.add(clouds);
      spinners.push({ mesh: clouds, speed: 0.32 });
    }
    if (b.id === "earth") {
      const moon = sphere(displayRadius(1737), drawSurface("moon", lowGraphics), lowGraphics);
      materials.set("2k_moon.jpg", moon.material as THREE.MeshStandardMaterial);
      moon.position.set(b.x + r + 1.1, PLANET_Y + r * 0.9, PLANET_Z + 1.5);
      group.add(moon);
      const moonTag = label("Moon", "cw-planet cw-planet-small");
      moonTag.position.set(moon.position.x + 0.3, moon.position.y - 1.1, moon.position.z);
      group.add(moonTag);
    }
    if (b.id === "saturn") {
      const ringMat = new THREE.MeshStandardMaterial({
        map: drawSurface("saturnRing", lowGraphics),
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 1,
      });
      materials.set("2k_saturn_ring_alpha.png", ringMat);
      const ring = new THREE.Mesh(ringGeometry(r * 1.24, r * 2.27), ringMat);
      ring.rotation.x = -Math.PI / 2 + 0.42; // tipped towards the viewer so the ring reads as an ellipse
      holder.add(ring);
    }

    const stop = STOPS.find((s) => s.name === b.name);
    const text = b.id === "earth" ? "Earth · start" : stop ? `${b.name} · ${stop.points} pts` : b.name;
    const tag = label(text, "cw-planet");
    // scenery names (Mercury, Venus) go underneath so they don't crowd Earth's label
    tag.position.set(b.x, stop ? PLANET_Y + r + 1.1 : PLANET_Y - r - 1, PLANET_Z);
    group.add(tag);
  }

  // --- Asteroid Belt (between Mars and Jupiter) with the dwarf planet Ceres
  const belt = rockField({
    count: lowGraphics ? 220 : 480, x: BELT_X, width: 5, height: 12, seed: 21,
    colors: ["#6b6158", "#8a7f73", "#5a5048", "#9c9184"], size: [0.04, 0.22],
  });
  group.add(belt.mesh);
  const ceres = sphere(displayRadius(473) * 1.4, drawSurface("ceres", lowGraphics), lowGraphics);
  ceres.position.set(BELT_X + 0.6, PLANET_Y - 2.2, PLANET_Z + 2);
  group.add(ceres);
  spinners.push({ mesh: ceres, speed: 0.3 });
  const ceresTag = label("Ceres (dwarf planet)", "cw-planet cw-planet-small");
  ceresTag.position.set(ceres.position.x, ceres.position.y - 0.9, ceres.position.z);
  group.add(ceresTag);
  const beltTag = label("Asteroid Belt · 13 pts", "cw-planet");
  beltTag.position.set(BELT_X, PLANET_Y + 6.8, PLANET_Z);
  group.add(beltTag);

  // --- Kuiper Belt (beyond Neptune) with the dwarf planet Pluto
  const kuiper = rockField({
    count: lowGraphics ? 90 : 200, x: KUIPER_X, width: 7, height: 14, seed: 33,
    colors: ["#a9c4d8", "#d6e4ee", "#8aa1b3"], size: [0.04, 0.16],
  });
  group.add(kuiper.mesh);
  const pluto = sphere(displayRadius(1188), drawSurface("pluto", lowGraphics), lowGraphics);
  pluto.position.set(KUIPER_X - 0.8, PLANET_Y + 1.5, PLANET_Z + 2);
  group.add(pluto);
  spinners.push({ mesh: pluto, speed: 0.1 });
  const plutoTag = label("Pluto (dwarf planet)", "cw-planet cw-planet-small");
  plutoTag.position.set(pluto.position.x, pluto.position.y + 1.1, pluto.position.z);
  group.add(plutoTag);
  const kuiperTag = label("Kuiper Belt · 40 pts", "cw-planet");
  kuiperTag.position.set(KUIPER_X, PLANET_Y + 7.6, PLANET_Z);
  group.add(kuiperTag);

  // --- Distant stars
  const rand = seeded(7);
  const starPos: number[] = [];
  for (let i = 0; i < 1400; i++) starPos.push(-120 + rand() * 260, -60 + rand() * 120, -80 - rand() * 40);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#dbe4ff", size: 1.6, sizeAttenuation: false })));

  const beltMatrix = new THREE.Matrix4();
  const beltPos = new THREE.Vector3();
  const beltQ = new THREE.Quaternion();
  const beltS = new THREE.Vector3();

  return {
    group,

    /** Swap in real texture photos for any files present in public/textures/solar/. */
    useTextureFiles(files: string[]) {
      const loader = new THREE.TextureLoader();
      for (const [file, mat] of materials) {
        if (!files.includes(file)) continue;
        loader.load(`/textures/solar/${file}`, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          if (file === "2k_earth_clouds.jpg") {
            mat.map = null;
            mat.alphaMap = tex; // the clouds photo is white on black
            mat.color.set("#ffffff");
          } else {
            mat.map = tex;
          }
          mat.needsUpdate = true;
        });
      }
    },

    tick(dt: number, time: number) {
      for (const s of spinners) s.mesh.rotation.y += s.speed * dt;
      // asteroids drift slowly up and down the band
      belt.drift.forEach((d, i) => {
        belt.mesh.getMatrixAt(i, beltMatrix);
        beltMatrix.decompose(beltPos, beltQ, beltS);
        beltPos.y = d.y + Math.sin(time * d.speed + i) * 0.25;
        beltMatrix.compose(beltPos, beltQ, beltS);
        belt.mesh.setMatrixAt(i, beltMatrix);
      });
      belt.mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
