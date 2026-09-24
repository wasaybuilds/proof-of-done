import { describe, expect, it } from "vitest";
import { is } from "../src/is";

describe("is", () => {
  it("accepts a simple object", () => {
    expect(is({ id: 1 })).toBe(true);
  });
});
