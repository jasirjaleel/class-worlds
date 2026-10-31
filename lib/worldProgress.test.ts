import { describe, expect, it } from "vitest";
import {
  BALLOON_MAX_POINTS,
  CITY_MAX_FLOORS,
  VOYAGE_PORTS,
  balloonHeight,
  cityFloors,
  gardenStage,
  voyageProgress,
} from "./worldProgress";

describe("balloonHeight", () => {
  it("rises with points and stops at the top", () => {
    expect(balloonHeight(0)).toBe(0);
    expect(balloonHeight(BALLOON_MAX_POINTS / 2)).toBe(0.5);
    expect(balloonHeight(BALLOON_MAX_POINTS + 50)).toBe(1);
  });
});

describe("gardenStage", () => {
  it("grows at each threshold", () => {
    expect([0, 1, 2, 3, 6, 10, 15, 20, 29, 30, 99].map(gardenStage)).toEqual([0, 1, 1, 2, 3, 4, 5, 6, 6, 7, 7]);
  });
});

describe("cityFloors", () => {
  it("adds a floor per point up to the limit", () => {
    expect(cityFloors(0)).toBe(0);
    expect(cityFloors(7)).toBe(7);
    expect(cityFloors(CITY_MAX_FLOORS + 5)).toBe(CITY_MAX_FLOORS);
  });
});

describe("voyageProgress", () => {
  const legs = VOYAGE_PORTS.length - 1;

  it("starts at the first port and ends at the last exactly at the goal", () => {
    expect(voyageProgress(0, 240)).toEqual({ position: 0, lastPort: 0 });
    expect(voyageProgress(239, 240).lastPort).toBe(legs - 1);
    expect(voyageProgress(240, 240)).toEqual({ position: legs, lastPort: legs });
  });

  it("reaches each port at its exact share of the goal", () => {
    expect(voyageProgress(59, 240).lastPort).toBe(0);
    expect(voyageProgress(60, 240).lastPort).toBe(1);
    expect(voyageProgress(120, 240).lastPort).toBe(2);
  });

  it("stays at the last port when points go past the goal", () => {
    expect(voyageProgress(500, 240).position).toBe(legs);
  });
});
