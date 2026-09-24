import { expect, it } from "vitest";
import { Queue } from "./queue";

it("enqueues", () => {
  expect(new Queue().push(1).size).toBe(1);
});
