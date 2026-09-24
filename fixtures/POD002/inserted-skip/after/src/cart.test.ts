import { expect, test } from "vitest";
import { applyDiscount } from "./cart";

test.skip("applies percentage discount", () => {
  expect(applyDiscount(100, "10%")).toBe(90);
});

test("ignores unknown codes", () => {
  expect(applyDiscount(100, "NOPE")).toBe(100);
});
