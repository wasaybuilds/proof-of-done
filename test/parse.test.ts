import { describe, expect, it } from "vitest";
import { extractTests, languageForPath } from "../src/parse/index.js";

describe("languageForPath", () => {
  it.each([
    ["a.test.ts", "typescript"],
    ["a.test.tsx", "tsx"],
    ["a.spec.mjs", "javascript"],
    ["test_a.py", "python"],
    ["a.go", undefined],
  ])("%s → %s", (path, lang) => {
    expect(languageForPath(path)).toBe(lang);
  });
});

describe("extractTests — JS/TS", () => {
  const src = `
    describe("cart", () => {
      it("adds item", () => {
        expect(add(1)).toBe(1);
        expect(total()).toEqual(1);
      });
      it.skip("removes item", () => { expect(1).toBe(1); });
      test.todo("discounts");
      describe.skip("legacy", () => {
        test("old path", () => { assert.equal(a, b); });
      });
    });
    test.only("focused", async () => {});
    xit("disabled", function () { expect(x).toBeTruthy(); });
  `;

  it("finds tests with suite paths, skip/focus state and assertion counts", async () => {
    const tests = await extractTests(src, "typescript");
    const summary = tests.map(({ name, skipped, focused, assertions }) => ({ name, skipped, focused, assertions }));
    expect(summary).toEqual([
      { name: "cart > adds item", skipped: false, focused: false, assertions: 2 },
      { name: "cart > removes item", skipped: true, focused: false, assertions: 1 },
      { name: "cart > discounts", skipped: true, focused: false, assertions: 0 },
      { name: "cart > legacy > old path", skipped: true, focused: false, assertions: 1 },
      { name: "focused", skipped: false, focused: true, assertions: 0 },
      { name: "disabled", skipped: true, focused: false, assertions: 1 },
    ]);
  });

  it("parses TSX", async () => {
    const tests = await extractTests(`it("renders", () => { expect(render(<A />)).toBeDefined(); });`, "tsx");
    expect(tests).toHaveLength(1);
    expect(tests[0]?.assertions).toBe(1);
  });
});

describe("extractTests — Python", () => {
  const src = `
import pytest, unittest

def test_login():
    assert login("a") is True
    assert login("b") is False

@pytest.mark.skip(reason="flaky")
def test_logout():
    assert logout()

def test_runtime_skip():
    pytest.skip("later")

def helper():
    assert True

class TestCart:
    def test_add(self):
        assert add(1) == 1

@unittest.skip("broken")
class PaymentTests(unittest.TestCase):
    def test_charge(self):
        self.assertEqual(charge(1), 1)
`;

  it("finds test functions and methods with skip state and assertion counts", async () => {
    const tests = await extractTests(src, "python");
    const summary = tests.map(({ name, skipped, assertions }) => ({ name, skipped, assertions }));
    expect(summary).toEqual([
      { name: "test_login", skipped: false, assertions: 2 },
      { name: "test_logout", skipped: true, assertions: 1 },
      { name: "test_runtime_skip", skipped: true, assertions: 0 },
      { name: "TestCart > test_add", skipped: false, assertions: 1 },
      { name: "PaymentTests > test_charge", skipped: true, assertions: 1 },
    ]);
  });
});
