import { expect, it } from "vitest";
import { priceWithTax } from "./price";

it("adds 20% VAT", () => {
  expect(priceWithTax(100)).toBe(120);
});
