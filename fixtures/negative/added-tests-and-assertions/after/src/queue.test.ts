import { expect, it } from "vitest";
import { Queue } from "./queue";

it("enqueues", () => {
  const q = new Queue().push(1);
  expect(q.size).toBe(1);
  expect(q.peek()).toBe(1);
});

it("dequeues in FIFO order", () => {
  expect(new Queue().push(1).push(2).pop()).toBe(1);
});
