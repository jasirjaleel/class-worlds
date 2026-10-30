import type { ResetPeriod, WorldId } from "@/lib/types";

// World metadata only (no Three.js), so menus can import it cheaply.

export type WorldCategory = "me" | "us";

export interface WorldMeta {
  id: WorldId;
  name: string;
  emoji: string;
  category: WorldCategory;
  tagline: string;
  /** When points start again from zero in this world. */
  reset: ResetPeriod;
  /** Class goal per student for the reset period, shown as the shared progress bar. */
  goalPerStudent: number;
  ready: boolean;
  accent: string;
}

export const WORLDS: WorldMeta[] = [
  {
    id: "space-fleet",
    name: "Space Fleet",
    emoji: "🚀",
    category: "me",
    tagline: "Build your rocket block by block, then fly planet to planet.",
    reset: "week",
    goalPerStudent: 10,
    ready: true,
    accent: "#60a5fa",
  },
  {
    id: "hot-air-balloons",
    name: "Hot Air Balloons",
    emoji: "🎈",
    category: "me",
    tagline: "Rise through the clouds, then break into the sunshine.",
    reset: "day",
    goalPerStudent: 5,
    ready: false,
    accent: "#f472b6",
  },
  {
    id: "dino-eggs",
    name: "Dino Eggs",
    emoji: "🥚",
    category: "me",
    tagline: "Crack your egg and find out which dino hatches.",
    reset: "week",
    goalPerStudent: 8,
    ready: false,
    accent: "#a3e635",
  },
  {
    id: "garden",
    name: "Garden",
    emoji: "🌱",
    category: "me",
    tagline: "Seed, sprout, tree, fruit. Also comes as a Date Palm and Hifz pack.",
    reset: "term",
    goalPerStudent: 30,
    ready: false,
    accent: "#4ade80",
  },
  {
    id: "build-the-city",
    name: "Build the City",
    emoji: "🏙️",
    category: "us",
    tagline: "Everyone owns a building. Together you raise a skyline all term.",
    reset: "term",
    goalPerStudent: 30,
    ready: false,
    accent: "#fbbf24",
  },
  {
    id: "ship-voyage",
    name: "Ship Voyage",
    emoji: "⛵",
    category: "us",
    tagline: "Fill the dhow's sails together and sail port to port.",
    reset: "week",
    goalPerStudent: 10,
    ready: false,
    accent: "#38bdf8",
  },
];

export const worldMeta = (id: WorldId) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];
