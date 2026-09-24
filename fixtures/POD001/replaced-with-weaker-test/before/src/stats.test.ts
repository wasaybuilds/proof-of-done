import { expect, it } from "vitest";
import { median } from "./stats";

it("returns the middle value for odd length", () => {
  expect(median([3, 1, 2])).toBe(2);
});

it("averages the middle values for even length", () => {
  expect(median([1, 2, 3, 4])).toBe(2.5);
  expect(median([4, 1])).toBe(2.5);
  expect(median([10, 20, 30, 40])).toBe(25);
});
