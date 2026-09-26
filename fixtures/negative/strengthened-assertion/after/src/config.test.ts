import { expect, it } from "vitest";
import { load } from "./config";

it("loads defaults", () => {
  expect(load()).toEqual({ port: 3000, debug: false });
});
