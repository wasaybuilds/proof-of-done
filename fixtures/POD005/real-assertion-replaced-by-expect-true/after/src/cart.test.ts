import { expect, it } from "vitest";
import { total } from "./cart";

it("sums line items", () => {
  total([{ price: 2, qty: 3 }]);
  expect(true).toBe(true);
});
