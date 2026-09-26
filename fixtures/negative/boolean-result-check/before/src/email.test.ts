import { expect, it } from "vitest";
import { isValid } from "./email";

it("accepts a normal address", () => {
  expect(isValid("ada@example.com")).toBe(true);
});
