import { expect, it } from "vitest";
import { total } from "./cart";

it("sums line items", () => {
  expect(total([{ price: 2, qty: 3 }])).toBe(6);
});
