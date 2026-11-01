import * as THREE from "three";
import { seeded } from "./voxel";

// The natural world around the blocky students: real sky, smooth mountains,
// moving water, soft clouds, wind in the trees and birds. All made in code.

/** Shared clock for wind. The stage updates it every frame. */
export const windTime = { value: 0 };

// --- Noise

function noiseField(seed: number, wrap = 0) {
  const hash = (x: number, y: number) => {
    const xx = wrap ? ((x % wrap) + wrap) % wrap : x;
    const yy = wrap ? ((y % wrap) + wrap) % wrap : y;
    const s = Math.sin(xx * 127.1 + yy * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const value = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  return (x: number, y: number, octaves = 4) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * value(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

// --- Sky

/** A real sky around the whole world, so the horizon stays put in Free Roam. */
export function skyDome(world: THREE.Group, colors: { top: string; horizon: string }, sunDirection: [number, number, number]) {
  const uniforms = {
    uTop: { value: new THREE.Color(colors.top) },
    uHorizon: { value: new THREE.Color(colors.horizon) },
    uSun: { value: new THREE.Vector3(...sunDirection).normalize() },
    uSunStrength: { value: 1 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2500, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSun;
        uniform float uSunStrength;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          // the blue arrives quickly above the horizon, as it does in a real sky
          vec3 color = mix(uHorizon, uTop, pow(clamp(dir.y * 7.0, 0.0, 1.0), 0.75));
          float toSun = max(dot(dir, uSun), 0.0);
          color += uSunStrength * vec3(1.0, 0.93, 0.78) * (pow(toSun, 1400.0) * 3.0 + pow(toSun, 40.0) * 0.35 + pow(toSun, 6.0) * 0.12);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  world.add(dome);
  return {
    setColors(top: string, horizon: string, sunStrength = 1) {
      uniforms.uTop.value.set(top);
      uniforms.uHorizon.value.set(horizon);
      uniforms.uSunStrength.value = sunStrength;
    },
  };
}

// --- Mountains and hills

/**
 * A continuous range of smooth mountains around the world. `gap` leaves a clear
 * wedge (in radians) on the viewer's side, for hills close enough to block the view.
 */
export function terrainRing(opts: {
  inner: number;
  outer: number;
  height: number;
  colors: [low: string, mid: string, high: string];
  seed: number;
  lowGraphics: boolean;
  baseY?: number;
  gap?: number;
  roughness?: number;
}): THREE.Mesh {
  const noise = noiseField(opts.seed);
  const around = opts.lowGraphics ? 120 : 280;
  const across = opts.lowGraphics ? 10 : 22;
  const low = new THREE.Color(opts.colors[0]);
  const mid = new THREE.Color(opts.colors[1]);
  const high = new THREE.Color(opts.colors[2]);
  const scale = opts.roughness ?? 0.016;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= around; i++) {
    const angle = (i / around) * Math.PI * 2;
    // the viewer looks along -z, so angle 0 here is the side facing them
    const fromFront = Math.min(angle, Math.PI * 2 - angle);
    const open = opts.gap ? THREE.MathUtils.smoothstep(fromFront, opts.gap * 0.5, opts.gap * 0.5 + 0.5) : 1;
    for (let j = 0; j <= across; j++) {
      const t = j / across;
      const r = opts.inner + (opts.outer - opts.inner) * t;
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r;
      const n = noise(x * scale + 40, z * scale + 40);
      const ridge = 1 - Math.abs(2 * n - 1);
      const profile = Math.pow(Math.sin(Math.PI * t), 0.8);
      const h = opts.height * profile * open * (0.2 + ridge * ridge * 1.05);
      positions.push(x, (opts.baseY ?? 0) + h, z);
      const level = opts.height ? h / opts.height : 0;
      if (level < 0.5) c.copy(low).lerp(mid, level * 2);
      else c.copy(mid).lerp(high, Math.min(1, (level - 0.5) * 2.2));
      colors.push(c.r, c.g, c.b);
    }
  }
  const row = across + 1;
  for (let i = 0; i < around; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

/** Fine natural grain for big flat ground, so it isn't one flat colour. */
export function groundMaterial(colors: string[], repeat: number): THREE.MeshLambertMaterial {
  const noise = noiseField(9, 64);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const palette = colors.map((h) => new THREE.Color(h).convertLinearToSRGB());
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = noise((x / size) * 16, (y / size) * 16, 3);
      const speck = Math.random() * 0.1;
      const k = Math.min(palette.length - 1.001, Math.max(0, (n + speck - 0.25) * 2 * (palette.length - 1)));
      const a = palette[Math.floor(k)];
      const b = palette[Math.floor(k) + 1] ?? a;
      const f = k - Math.floor(k);
      const i = (y * size + x) * 4;
      img.data[i] = (a.r + (b.r - a.r) * f) * 255;
      img.data[i + 1] = (a.g + (b.g - a.g) * f) * 255;
      img.data[i + 2] = (a.b + (b.b - a.b) * f) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.anisotropy = 4;
  return new THREE.MeshLambertMaterial({ map });
}

// --- Water

/** A sheet of water with moving ripples that catch the light. */
export function waterPlane(opts: { width: number; depth: number; color: string; lowGraphics: boolean }) {
  const material = new THREE.MeshPhongMaterial({ color: opts.color, specular: "#dff0ff", shininess: 70 });
  let normalMap: THREE.CanvasTexture | null = null;
  if (!opts.lowGraphics) {
    const period = 16;
    const noise = noiseField(5, period);
    const size = 256;
    const height = (x: number, y: number) => noise((x / size) * period, (y / size) * period, 3);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = (height(x + 1, y) - height(x - 1, y)) * 7;
        const dy = (height(x, y + 1) - height(x, y - 1)) * 7;
        const i = (y * size + x) * 4;
        img.data[i] = (dx * 0.5 + 0.5) * 255;
        img.data[i + 1] = (dy * 0.5 + 0.5) * 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    normalMap = new THREE.CanvasTexture(canvas);
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(opts.width / 26, opts.depth / 26);
    normalMap.anisotropy = 8;
    material.normalMap = normalMap;
    material.normalScale.set(0.7, 0.7);
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(opts.width, opts.depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return {
    mesh,
    tick(time: number) {
      normalMap?.offset.set(time * 0.012, time * 0.018);
    },
  };
}

// --- Clouds

let cloudTextures: THREE.CanvasTexture[] | null = null;

function makeCloudTextures() {
  const rand = seeded(17);
  return [0, 1, 2].map(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 60; i++) {
      const spread = Math.sin((i / 60) * Math.PI);
      const x = 256 + (rand() - 0.5) * 380;
      const y = 150 - rand() * 80 * (0.4 + spread);
      const r = 26 + rand() * 62;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      // the undersides stay a little darker, like real clouds
      const shade = y > 135 ? "226,232,240" : "255,255,255";
      g.addColorStop(0, `rgba(${shade},0.42)`);
      g.addColorStop(1, `rgba(${shade},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** One soft cloud. `width` is in world units. */
export function softCloud(width: number, variant: number, opacity = 0.95): THREE.Sprite {
  cloudTextures ??= makeCloudTextures();
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: cloudTextures[variant % 3], transparent: true, opacity, depthWrite: false }),
  );
  sprite.scale.set(width, width / 2, 1);
  return sprite;
}

/** Clouds in a ring around the whole sky. Returns a tick that drifts them. */
export function cloudRing(world: THREE.Group, opts: { count: number; radius: number; height: number; width: number; seed: number }) {
  const rand = seeded(opts.seed);
  const clouds = Array.from({ length: opts.count }, (_, i) => {
    const angle = (i / opts.count) * Math.PI * 2 + rand() * 0.25;
    const r = opts.radius * (0.8 + rand() * 0.4);
    const cloud = softCloud(opts.width * (0.7 + rand() * 0.7), i);
    cloud.position.set(0, opts.height * (0.75 + rand() * 0.5), 0);
    world.add(cloud);
    return { cloud, angle, r };
  });
  return {
    clouds,
    tick(time: number) {
      for (const c of clouds) {
        const a = c.angle + time * 0.004;
        c.cloud.position.x = Math.sin(a) * c.r;
        c.cloud.position.z = Math.cos(a) * c.r;
      }
    },
  };
}

// --- Birds

/** A few birds circling far away. */
export function flock(world: THREE.Group, opts: { count: number; center: [number, number, number]; radius: number; size: number; color: string; seed: number }) {
  const rand = seeded(opts.seed);
  const material = new THREE.MeshBasicMaterial({ color: opts.color });
  const wing = new THREE.BoxGeometry(opts.size, opts.size * 0.06, opts.size * 0.3);
  const birds = Array.from({ length: opts.count }, () => {
    const bird = new THREE.Group();
    const left = new THREE.Mesh(wing, material);
    const right = new THREE.Mesh(wing, material);
    left.geometry.translate(0, 0, 0);
    bird.add(left, right);
    world.add(bird);
    return {
      bird, left, right,
      phase: rand() * Math.PI * 2,
      speed: 0.08 + rand() * 0.06,
      r: opts.radius * (0.55 + rand() * 0.45),
      lift: rand() * opts.radius * 0.18,
    };
  });
  const half = opts.size / 2;
  return {
    tick(time: number) {
      for (const b of birds) {
        const a = b.phase + time * b.speed;
        b.bird.position.set(
          opts.center[0] + Math.cos(a) * b.r,
          opts.center[1] + b.lift + Math.sin(time * 0.4 + b.phase) * 0.6,
          opts.center[2] + Math.sin(a) * b.r * 0.35,
        );
        b.bird.rotation.y = -a;
        const flap = Math.sin(time * 7 + b.phase) * 0.55;
        b.left.position.set(-Math.cos(flap) * half, Math.sin(flap) * half, 0);
        b.right.position.set(Math.cos(flap) * half, Math.sin(flap) * half, 0);
        b.left.rotation.z = -flap;
        b.right.rotation.z = flap;
      }
    },
  };
}

// --- Wind

/** Makes tree boxes in an instanced mesh sway, more towards the top of the tree. */
export function addWind(material: THREE.Material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWindTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 cwBase = instanceMatrix[3].xyz;
          float cwSway = sin(uWindTime * 1.1 + cwBase.x * 0.35 + cwBase.z * 0.27) * 0.035 * max(cwBase.y, 0.0);
          transformed.x += cwSway / max(length(instanceMatrix[0].xyz), 0.001);
        #endif`,
      );
  };
  return material;
}
