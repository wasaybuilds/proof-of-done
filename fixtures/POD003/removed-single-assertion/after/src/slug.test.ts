import { expect, it } from "vitest";
import { slugify } from "./slug";

it("slugifies titles", () => {
  expect(slugify("Hello World")).toBe("hello-world");
  expect(slugify("  Trim me  ")).toBe("trim-me");
});
