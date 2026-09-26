import { expect, it } from "vitest";
import { createApp } from "./app";

it("has a name", () => {
  expect(createApp().name).toBe("demo");
});
