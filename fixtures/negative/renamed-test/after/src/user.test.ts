import { expect, it } from "vitest";
import { fullName } from "./user";

it("joins first and last name", () => {
  expect(fullName({ first: "Ada", last: "Lovelace" })).toBe("Ada Lovelace");
});
