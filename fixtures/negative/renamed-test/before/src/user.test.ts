import { expect, it } from "vitest";
import { fullName } from "./user";

it("works", () => {
  expect(fullName({ first: "Ada", last: "Lovelace" })).toBe("Ada Lovelace");
});
