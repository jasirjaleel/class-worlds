import { describe, expect, it } from "vitest";
import { isReason, reasonMessage } from "./reasons";

describe("reasons", () => {
  it("accepts only known reasons", () => {
    expect(isReason("homework")).toBe(true);
    expect(isReason("nonsense")).toBe(false);
    expect(isReason("toString")).toBe(false);
    expect(isReason(undefined)).toBe(false);
  });

  it("has a message for every saved point, old ones included", () => {
    expect(reasonMessage("homework")).toBe("Homework done");
    expect(reasonMessage(null)).toBe("Well done");
    expect(reasonMessage("removed-reason")).toBe("Well done");
  });
});
