import { describe, expect, it } from "vitest";
import { classifyPath } from "../src/changeset/classify.js";

describe("classifyPath", () => {
  it.each([
    ["src/auth.test.ts", "test"],
    ["src/__tests__/cart.ts", "test"],
    ["tests/test_payment.py", "test"],
    ["pkg/handler_test.go", "test"],
    ["jest.config.ts", "test-config"],
    ["vitest.config.mts", "test-config"],
    ["pytest.ini", "test-config"],
    ["tests/conftest.py", "test-config"],
    [".github/workflows/ci.yml", "ci"],
    [".gitlab-ci.yml", "ci"],
    [".proofofdone.yml", "policy"],
    ["src/auth.ts", "source"],
    ["app/models.py", "source"],
    ["README.md", "other"],
    ["package.json", "other"],
  ])("%s → %s", (path, kind) => {
    expect(classifyPath(path)).toBe(kind);
  });

  it("normalises Windows separators", () => {
    expect(classifyPath("src\\__tests__\\cart.ts")).toBe("test");
  });
});
