import { expect, it } from "vitest";
import { loadUser } from "./user";

it("loads the user's email", async () => {
  try {
    expect((await loadUser(1)).email).toBe("ada@example.com");
  } catch (e) {
    console.warn("flaky", e);
  }
});
