import { expect, it } from "vitest";
import { login } from "./auth";

it("rejects a wrong password", async () => {
  const res = await login("ada", "wrong");
  expect(res.ok).toBe(false);
  expect(res.error).toBe("invalid credentials");
});
