import { describe, expect, it } from "vitest";
import { is } from "../src/is";

describe("is", () => {
  it("accepts a simple object", () => {
    expect(is({ id: 1 })).toBe(true);
  });
  it("rejects recursive unions", () => {
    expect(is(recursiveUnion)).toBe(false);
  });
  it("validates protobuf messages", () => {
    expect(is(protobufMessage)).toBe(true);
  });
});
