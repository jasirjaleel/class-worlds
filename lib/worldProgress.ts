// How points turn into progress in each world. Kept apart from the 3D code so it can be tested.
// Everyone starts with a head start, so no student ever sits on an empty spot at zero.

// --- Hot Air Balloons
export const BALLOON_CLOUD_POINTS = 5;
export const BALLOON_MAX_POINTS = 12;

/** Already off the ground at 0 points; 1 is the top of the sky. */
export function balloonHeight(points: number): number {
  const headStart = 0.6;
  return (Math.min(Math.max(points, 0), BALLOON_MAX_POINTS) + headStart) / (BALLOON_MAX_POINTS + headStart);
}

// --- Garden
export const GARDEN_POINTS = [1, 4, 8, 13, 20, 30];
export const GARDEN_STAGE_NAMES = ["Seed", "Sprout", "Seedling", "Plant", "Young tree", "Tree", "In flower", "Fruit"];

/** 1 = a sprout, already up at 0 points; 7 = a tree with fruit. */
export function gardenStage(points: number): number {
  return 1 + GARDEN_POINTS.filter((p) => points >= p).length;
}

// --- Build the City
export const CITY_MAX_FLOORS = 40;

export function cityFloors(points: number): number {
  return Math.min(Math.max(points, 0) + 1, CITY_MAX_FLOORS); // the ground floor comes free
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
