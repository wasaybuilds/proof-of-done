import { expect, it } from "vitest";
import { createApp } from "./app";

it("has a name", () => {
  expect(createApp().name).toBe("demo");
});

it("starts", () => {
  const app = createApp();
  expect(app.start).toBeDefined();
  expect(app.start()).toBeTruthy();
});
