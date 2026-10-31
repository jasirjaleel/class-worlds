// How points turn into progress in each world. Kept apart from the 3D code so it can be tested.

// --- Hot Air Balloons
export const BALLOON_CLOUD_POINTS = 5;
export const BALLOON_MAX_POINTS = 12;

/** 0 on the ground, 1 at the top of the sky. */
export function balloonHeight(points: number): number {
  return Math.min(Math.max(points, 0), BALLOON_MAX_POINTS) / BALLOON_MAX_POINTS;
}

// --- Garden
export const GARDEN_POINTS = [1, 3, 6, 10, 15, 20, 30];
export const GARDEN_STAGE_NAMES = ["Seed", "Sprout", "Seedling", "Plant", "Young tree", "Tree", "In flower", "Fruit"];

/** 0 = a seed in the soil, 7 = a tree with fruit. */
export function gardenStage(points: number): number {
  return GARDEN_POINTS.filter((p) => points >= p).length;
}

// --- Build the City
export const CITY_MAX_FLOORS = 40;

export function cityFloors(points: number): number {
  return Math.min(Math.max(points, 0), CITY_MAX_FLOORS);
}

// --- Ship Voyage: the map is a simple row of stops, not to scale
export const VOYAGE_PORTS = [
  { name: "Sharjah", fact: "Sharjah: our home port, in the UAE on the Arabian Gulf." },
  { name: "Muscat", fact: "Muscat: the capital of Oman, on the Gulf of Oman." },
  { name: "Kochi", fact: "Kochi: a port city in Kerala, India, famous for its spice trade." },
  { name: "Salalah", fact: "Salalah: a city in southern Oman, known for frankincense." },
  { name: "Zanzibar", fact: "Zanzibar: an island off Tanzania in East Africa, famous for cloves." },
];

/** Where the class's dhow is. `position` runs from 0 (first port) to the last port's index. */
export function voyageProgress(classPoints: number, goal: number) {
  const legs = VOYAGE_PORTS.length - 1;
  const points = Math.min(Math.max(classPoints, 0), goal);
  const lastPort = Math.floor((points * legs) / goal);
  return { position: (points * legs) / goal, lastPort };
}
