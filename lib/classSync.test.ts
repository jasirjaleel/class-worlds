import { describe, expect, it } from "vitest";
import { classTopic, unseenEvents } from "./classSync";
import type { PointEvent } from "./types";

const point = (id: string): PointEvent => ({ id, studentId: "s", amount: 1, at: 1 });

describe("unseenEvents", () => {
  it("plays nothing on first load: existing points are history", () => {
    expect(unseenEvents(null, [point("a"), point("b")])).toEqual([]);
  });

  it("returns each new point once", () => {
    const seen = new Set(["a"]);
    expect(unseenEvents(seen, [point("a"), point("b"), point("c")]).map((e) => e.id)).toEqual(["b", "c"]);
    seen.add("b").add("c");
    expect(unseenEvents(seen, [point("a"), point("b"), point("c")])).toEqual([]);
  });

  it("ignores a point being taken back", () => {
    expect(unseenEvents(new Set(["a", "b"]), [point("a")])).toEqual([]);
  });
});

describe("classTopic", () => {
  it("matches the channel name the database policy checks", () => {
    expect(classTopic("abc")).toBe("class:abc");
  });
});
