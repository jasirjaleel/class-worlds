import { hashText } from "./hash";
import { localWeekKey } from "./points";
import type { PointEvent, Student } from "./types";

// Which dinosaur hides in each egg. It is worked out from the student and the
// week, so nothing extra is stored: the surprise stays the same on every screen,
// a new week brings a new egg, and past hatches can be rebuilt from the points.

export const HATCH_POINTS = 5;
/** Points at which a hatched dinosaur grows: baby, young, adult. */
export const GROWTH_POINTS = [5, 9, 14];
const GOLD_CHANCE = 12; // about 1 egg in 12 is a rare gold egg

export type SpeciesId = "t-rex" | "triceratops" | "stegosaurus" | "brachiosaurus" | "velociraptor" | "ankylosaurus";

export const SPECIES: { id: SpeciesId; name: string; fact: string }[] = [
  { id: "t-rex", name: "T. rex", fact: "Its full name, Tyrannosaurus rex, means \"tyrant lizard king\"." },
  { id: "triceratops", name: "Triceratops", fact: "Its name means \"three-horned face\"." },
  { id: "stegosaurus", name: "Stegosaurus", fact: "It had bony plates on its back and spikes on its tail." },
  { id: "brachiosaurus", name: "Brachiosaurus", fact: "Its long neck let it eat leaves high up in the treetops." },
  { id: "velociraptor", name: "Velociraptor", fact: "It was about the size of a turkey and had feathers." },
  { id: "ankylosaurus", name: "Ankylosaurus", fact: "It was covered in armour and had a bony club on its tail." },
];

export function eggFor(studentId: string, weekKey: string) {
  const species = SPECIES[hashText(`${studentId}:${weekKey}:species`) % SPECIES.length];
  return { species, gold: hashText(`${studentId}:${weekKey}:gold`) % GOLD_CHANCE === 0 };
}

/** 0–4 while in the egg (more cracks each point), then 5 = baby, 6 = young, 7 = adult. */
export function dinoStage(points: number): number {
  if (points < HATCH_POINTS) return Math.max(0, points);
  return HATCH_POINTS + GROWTH_POINTS.filter((p) => points >= p).length - 1;
}

export interface CollectionEntry {
  speciesId: SpeciesId;
  gold: boolean;
  studentName: string;
  weekKey: string;
}

/** Every dinosaur the class has hatched, one per student per week that reached the hatch points. */
export function classCollection(events: PointEvent[], students: Student[], timeZone: string): CollectionEntry[] {
  const pointsByStudentWeek = new Map<string, number>();
  for (const e of events) {
    const k = `${e.studentId}|${localWeekKey(e.at, timeZone)}`;
    pointsByStudentWeek.set(k, (pointsByStudentWeek.get(k) ?? 0) + e.amount);
  }
  const out: CollectionEntry[] = [];
  for (const [k, points] of pointsByStudentWeek) {
    if (points < HATCH_POINTS) continue;
    const [studentId, weekKey] = k.split("|");
    const student = students.find((s) => s.id === studentId);
    if (!student) continue;
    const egg = eggFor(studentId, weekKey);
    out.push({ speciesId: egg.species.id, gold: egg.gold, studentName: student.name, weekKey });
  }
  return out;
}
