import { expect, it } from "vitest";
import { verify } from "./token";

it("rejects expired tokens", () => {
  expect(() => verify("expired")).toThrow();
});
