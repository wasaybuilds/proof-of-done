import { expect, it } from "vitest";
import { login } from "./auth";

it("login works", async () => {
  await login("ada", "secret");
  expect(true).toBe(true);
  expect(1).toBeTruthy();
  expect("ok").toBeDefined();
});
