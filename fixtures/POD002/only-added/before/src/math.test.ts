import { expect, it } from "vitest";
import { div } from "./math";

it("divides", () => {
  expect(div(6, 3)).toBe(2);
});

it("throws on divide by zero", () => {
  expect(() => div(1, 0)).toThrow();
});
