import * as THREE from "three";
import { seeded } from "../../engine/voxel";

// Planet surfaces drawn with code (equirectangular maps), used when the real
// texture files are not in public/textures/solar/. Each painter returns the
// colour for a point given longitude u (0–1, wraps) and latitude v (0 top – 1 bottom).

type RGB = [number, number, number];
type Painter = (u: number, v: number, n: Noise) => RGB | [number, number, number, number];

const hex = (h: string): RGB => {
  const c = new THREE.Color(h);
  return [c.r * 255, c.g * 255, c.b * 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Value noise that wraps horizontally so the seam on the back of the sphere is invisible. */
class Noise {
  constructor(private seed: number) {}
  private hash(x: number, y: number) {
    const s = Math.sin(x * 127.1 + y * 311.7 + this.seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  }
  private value(x: number, y: number, period: number) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const wx = (i: number) => ((i % period) + period) % period;
    const a = this.hash(wx(ix), iy);
    const b = this.hash(wx(ix + 1), iy);
    const c = this.hash(wx(ix), iy + 1);
    const d = this.hash(wx(ix + 1), iy + 1);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  /** Fractal noise 0–1. `scale` = features around the equator. */
  fbm(u: number, v: number, scale: number, octaves = 5) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const period = Math.round(scale * freq);
      sum += amp * this.value(u * period, v * scale * 0.5 * freq, period);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}

function paint(width: number, seed: number, painter: Painter, alpha = false): THREE.CanvasTexture {
  const height = width / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  const noise = new Noise(seed);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = painter(x / width, y / height, noise);
      const i = (y * width + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = alpha && c.length === 4 ? c[3] : 255;
    }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Bowl-shaped craters sprinkled over a surface: returns a light/dark offset. */
function craters(seed: number, count: number) {
  const r = seeded(seed);
  const list = Array.from({ length: count }, () => ({ u: r(), v: 0.1 + r() * 0.8, s: 0.008 + r() * r() * 0.05 }));
  return (u: number, v: number) => {
    let shade = 0;
    for (const c of list) {
      let du = Math.abs(u - c.u);
      du = Math.min(du, 1 - du) * 2; // longitude is stretched on an equirect map
      const d = Math.hypot(du, v - c.v) / c.s;
      if (d < 1) shade -= 0.18 * (1 - d * d);
      else if (d < 1.25) shade += 0.12;
    }
    return shade;
  };
}

const lighten = (c: RGB, k: number): RGB => [c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k)];

export type SurfaceId =
  | "sun" | "mercury" | "venus" | "earth" | "earthClouds" | "moon" | "mars"
  | "jupiter" | "saturn" | "uranus" | "neptune" | "pluto" | "ceres" | "saturnRing";

export function drawSurface(id: SurfaceId, lowGraphics: boolean): THREE.CanvasTexture {
  const w = lowGraphics ? 256 : 512;
  switch (id) {
    case "sun":
      return paint(w, 1, (u, v, n) => {
        const g = n.fbm(u, v, 24, 4);
        return mix(hex("#ff7a00"), hex("#fff3a0"), g * 1.4 - 0.1);
      });
    case "mercury": {
      const cr = craters(2, 70);
      return paint(w, 2, (u, v, n) => lighten(mix(hex("#5b5651"), hex("#a8a29b"), n.fbm(u, v, 10)), cr(u, v)));
    }
    case "venus":
      return paint(w, 3, (u, v, n) => {
        const swirl = n.fbm(u + n.fbm(u, v, 3) * 0.3, v * 2.2, 6, 4);
        return mix(hex("#c9a46b"), hex("#f3dfb0"), swirl);
      });
    case "earth":
      return paint(w, 4, (u, v, n) => {
        const lat = Math.abs(v - 0.5) * 2;
        if (lat > 0.86) return hex("#f1f5f9"); // polar ice
        const land = n.fbm(u, v, 7);
        if (land < 0.52) return mix(hex("#0b2f6b"), hex("#1f5fae"), land / 0.52);
        const dry = n.fbm(u + 0.37, v, 14, 3);
        const green = mix(hex("#2f6b2a"), hex("#8a7448"), dry * 1.2 - 0.2 + (lat < 0.35 ? 0.25 : 0));
        return mix(green, hex("#e2e8f0"), smooth(0.7, 0.86, lat));
      });
    case "earthClouds":
      return paint(w, 5, (u, v, n) => {
        const c = smooth(0.5, 0.75, n.fbm(u, v, 9));
        return [255, 255, 255, c * 235];
      }, true);
    case "moon": {
      const cr = craters(6, 50);
      return paint(w, 6, (u, v, n) => {
        const maria = smooth(0.55, 0.6, n.fbm(u, v, 5, 3));
        return lighten(mix(hex("#b8b5b0"), hex("#6f6c69"), maria), cr(u, v));
      });
    }
    case "mars":
      return paint(w, 7, (u, v, n) => {
        const lat = Math.abs(v - 0.5) * 2;
        if (lat > 0.9) return hex("#f8fafc");
        const dark = smooth(0.5, 0.7, n.fbm(u, v, 8));
        return mix(mix(hex("#c1440e"), hex("#e27b45"), n.fbm(u, v, 20, 3)), hex("#6b2a14"), dark * 0.7);
      });
    case "jupiter":
      return paint(w, 8, (u, v, n) => {
        const bands = ["#c9b18c", "#efe3cc", "#a8794f", "#f2e7d5", "#b88a5e", "#e9dcc4", "#9b6b46", "#efe3cc"];
        const t = v * 18 + n.fbm(u, v, 12, 4) * 1.6;
        const b = Math.floor(t) % bands.length;
        let c = mix(hex(bands[b]), hex(bands[(b + 1) % bands.length]), smooth(0.7, 1, t % 1));
        // Great Red Spot, south of the equator
        let du = Math.abs(u - 0.62);
        du = Math.min(du, 1 - du);
        const d = Math.hypot(du / 0.06, (v - 0.64) / 0.035);
        if (d < 1) c = mix(c, hex("#b5502f"), (1 - d) * 1.6);
        return c;
      });
    case "saturn":
      return paint(w, 9, (u, v, n) => {
        const t = v * 14 + n.fbm(u, v, 10, 3) * 0.5;
        return mix(hex("#c8a96b"), hex("#efdcae"), (Math.sin(t * 2.1) + 1) / 2);
      });
    case "uranus":
      return paint(w, 10, (u, v, n) => mix(hex("#9fd8df"), hex("#c6eef1"), (Math.sin(v * 9) + 1) / 4 + n.fbm(u, v, 6, 2) * 0.3));
    case "neptune":
      return paint(w, 11, (u, v, n) => {
        let c = mix(hex("#2848b8"), hex("#4f7be0"), (Math.sin(v * 12 + n.fbm(u, v, 8, 3) * 3) + 1) / 2);
        let du = Math.abs(u - 0.3);
        du = Math.min(du, 1 - du);
        if (Math.hypot(du / 0.05, (v - 0.62) / 0.03) < 1) c = hex("#162a6e"); // Great Dark Spot
        return c;
      });
    case "pluto":
      return paint(w / 2, 12, (u, v, n) => {
        let du = Math.abs(u - 0.5);
        du = Math.min(du, 1 - du);
        const heart = Math.hypot(du / 0.14, (v - 0.55) / 0.16) < 1; // the light "heart" region
        return heart ? hex("#efe2cf") : mix(hex("#7a5a43"), hex("#c9a98a"), n.fbm(u, v, 8));
      });
    case "ceres": {
      const cr = craters(13, 30);
      return paint(w / 2, 13, (u, v, n) => lighten(mix(hex("#5f5c58"), hex("#8f8a84"), n.fbm(u, v, 8)), cr(u, v)));
    }
    case "saturnRing": {
      // 1-pixel tall strip: u runs from the inner edge to the outer edge
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      const img = ctx.createImageData(512, 1);
      const noise = new Noise(14);
      for (let x = 0; x < 512; x++) {
        const t = x / 512;
        const cassini = t > 0.62 && t < 0.68 ? 0.08 : 1; // the Cassini Division gap
        const a = (0.45 + noise.fbm(t, 0, 60, 3) * 0.55) * cassini * smooth(0, 0.06, t) * (1 - smooth(0.94, 1, t));
        const c = mix(hex("#b59a6a"), hex("#efe2c2"), noise.fbm(t, 0.5, 30, 2));
        img.data.set([c[0], c[1], c[2], a * 255], x * 4);
      }
      ctx.putImageData(img, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
  }
}
