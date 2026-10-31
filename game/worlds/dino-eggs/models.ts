import type { SpeciesId } from "@/lib/dinos";
import { seeded, type Voxel } from "../../engine/voxel";

// Our own blocky dinosaurs, drawn side-on facing +x with feet at y = 0.

interface Palette {
  main: string;
  belly: string;
  accent: string;
}

const PALETTES: Record<SpeciesId, Palette> = {
  "t-rex": { main: "#65803f", belly: "#c7cf8e", accent: "#46592b" },
  triceratops: { main: "#a2703f", belly: "#dcc08f", accent: "#d97706" },
  stegosaurus: { main: "#4f8a6b", belly: "#bcd8bd", accent: "#d9534f" },
  brachiosaurus: { main: "#6d87a8", belly: "#c5d3e4", accent: "#4f6785" },
  velociraptor: { main: "#b0663a", belly: "#ecd2ac", accent: "#3f7fc4" },
  ankylosaurus: { main: "#8a7a5c", belly: "#cfc4a4", accent: "#5a4d36" },
};
const GOLD: Palette = { main: "#eab308", belly: "#fef08a", accent: "#ca8a04" };
const EYE = "#111827";

export function dinoVoxels(species: SpeciesId, gold: boolean): Voxel[] {
  const { main, belly, accent } = gold ? GOLD : PALETTES[species];
  const v: Voxel[] = [];
  /** Fills a block of voxels; both ends of each range are included. */
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) v.push([x, y, z, c]);
  };
  const eyes = (x: number, y: number, side: number) => v.push([x, y, side, EYE], [x, y, -side, EYE]);
  const legs = (xs: number[], top: number, c = main) => {
    for (const x of xs) for (const z of [-1, 1]) box(x, x, 0, top, z, z, c);
  };

  switch (species) {
    case "t-rex":
      for (const z of [-1, 1]) box(-2, -1, 0, 3, z, z, main);
      box(-3, 2, 4, 7, -1, 1, main);
      box(-1, 2, 4, 4, -1, 1, belly);
      box(-6, -4, 5, 6, 0, 0, main);
      box(-9, -7, 6, 6, 0, 0, accent);
      box(2, 3, 8, 9, -1, 1, main);
      box(2, 6, 10, 12, -1, 1, main);
      box(4, 6, 9, 9, -1, 1, belly);
      box(3, 4, 5, 5, -2, -2, accent);
      box(3, 4, 5, 5, 2, 2, accent);
      eyes(4, 11, 2);
      break;
    case "triceratops":
      legs([-3, 2], 2);
      box(-4, 3, 3, 6, -1, 1, main);
      box(-3, 2, 3, 3, -1, 1, belly);
      box(-7, -5, 4, 4, 0, 0, main);
      box(4, 4, 4, 8, -2, 2, accent);
      box(5, 7, 3, 6, -1, 1, main);
      box(8, 9, 6, 6, 1, 1, belly);
      box(8, 9, 6, 6, -1, -1, belly);
      box(8, 8, 4, 4, 0, 0, belly);
      eyes(6, 5, 2);
      break;
    case "stegosaurus":
      legs([-3, 2], 2);
      box(-4, 3, 3, 6, -1, 1, main);
      box(-3, 2, 3, 3, -1, 1, belly);
      box(4, 4, 3, 4, 0, 0, main);
      box(5, 6, 3, 4, -1, 1, main);
      for (const x of [-3, -1, 1]) box(x, x, 7, 9, 0, 0, accent);
      box(-8, -5, 4, 4, 0, 0, main);
      box(-8, -8, 5, 6, 0, 0, accent);
      box(-6, -6, 5, 6, 0, 0, accent);
      eyes(6, 4, 2);
      break;
    case "brachiosaurus":
      legs([-3, 3], 5);
      box(-4, 4, 6, 9, -1, 1, main);
      box(-3, 3, 6, 6, -1, 1, belly);
      box(4, 5, 10, 17, 0, 0, main);
      box(5, 8, 18, 19, -1, 1, main);
      box(-7, -5, 7, 7, 0, 0, main);
      box(-10, -8, 6, 6, 0, 0, accent);
      eyes(7, 19, 2);
      break;
    case "velociraptor":
      for (const z of [-1, 1]) box(-1, -1, 0, 2, z, z, main);
      box(-3, 1, 3, 5, -1, 1, main);
      box(-2, 1, 3, 3, -1, 1, belly);
      box(-3, 1, 6, 6, 0, 0, accent);
      box(-8, -4, 4, 4, 0, 0, main);
      box(-10, -9, 4, 5, 0, 0, accent);
      box(2, 2, 5, 7, 0, 0, main);
      box(2, 5, 8, 9, -1, 1, main);
      box(1, 2, 4, 4, -2, -2, accent);
      box(1, 2, 4, 4, 2, 2, accent);
      eyes(4, 9, 2);
      break;
    case "ankylosaurus":
      legs([-3, 3], 1);
      box(-5, 4, 2, 5, -2, 2, main);
      box(-4, 3, 2, 2, -2, 2, belly);
      for (let x = -5; x <= 4; x += 2) for (let z = -2; z <= 2; z += 2) v.push([x, 6, z, accent]);
      box(5, 7, 2, 4, -1, 1, main);
      box(-9, -6, 3, 3, 0, 0, main);
      box(-11, -10, 2, 4, -1, 1, accent);
      eyes(7, 4, 2);
      break;
  }
  return v;
}

/**
 * A speckled egg with cracks for `cracks` = 0–4, and the student's colour in the
 * speckles so each child can spot theirs. Cracks face the viewer.
 */
export function eggVoxels(cracks: number, speckle: string, gold: boolean, seed: number): Voxel[] {
  const rand = seeded(seed);
  const shell = gold ? "#facc15" : "#f5ecd7";
  const spot = gold ? "#fef9c3" : speckle;
  const crackColor = "#3f2a1a";
  const radii = [2, 3, 3, 3, 3, 2, 2, 1];
  const v: Voxel[] = [];
  radii.forEach((r, y) => {
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++) {
        const d = Math.hypot(x, z);
        if (d > r + 0.3) continue;
        // a zigzag down the side facing the camera, longer with each crack
        const zig = y % 2 === 0 ? -1 : 0;
        const halfLen = cracks;
        const onCrack = cracks > 0 && z > 0 && d > r - 1 && x === zig && Math.abs(y - 3.5) <= halfLen;
        const onSecond = cracks >= 3 && z > 0 && d > r - 1 && x === zig + 2 && Math.abs(y - 3.5) <= cracks - 2;
        v.push([x, y, z, onCrack || onSecond ? crackColor : rand() > 0.86 ? spot : shell]);
      }
  });
  return v;
}

/** A ring of twigs around the egg. */
export function nestVoxels(seed: number): Voxel[] {
  const rand = seeded(seed);
  const v: Voxel[] = [];
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++) {
      const d = Math.hypot(x, z);
      if (d > 3.4) continue;
      const color = rand() > 0.5 ? "#8b5a2b" : "#a0703a";
      v.push([x, 0, z, d < 1.8 ? "#6b4423" : color]);
      if (d > 2.3) v.push([x, 1, z, color]);
    }
  return v;
}
