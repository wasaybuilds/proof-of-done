import { expect, it } from "vitest";
import { median } from "./stats";

it("returns the middle value for odd length", () => {
  expect(median([3, 1, 2])).toBe(2);
});

it("handles even length", () => {
  expect(median([1, 2, 3, 4])).toBeDefined();
});
