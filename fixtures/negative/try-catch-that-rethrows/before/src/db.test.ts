import { expect, it } from "vitest";
import { query } from "./db";

it("counts rows", async () => {
  expect(await query("select count(*) from t")).toBe(3);
});
