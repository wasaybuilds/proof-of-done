import { expect, it } from "vitest";
import { format } from "./money";

function checkCents() {
  expect(format(150)).toBe("$1.50");
  expect(format(5)).toBe("$0.05");
}

it("formats cents", checkCents);
