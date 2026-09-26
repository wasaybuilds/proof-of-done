import { expect, it } from "vitest";
import { query } from "./db";

it("counts rows", async () => {
  try {
    expect(await query("select count(*) from t")).toBe(3);
  } catch (e) {
    console.error(await query("select * from t"));
    throw e;
  }
});
