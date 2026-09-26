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

describe("assertion strength", () => {
  const js = async (body: string) => (await extractTests(`it("t", () => {\n${body}\n});`, "typescript"))[0]?.strength;
  const py = async (body: string) =>
    (await extractTests(`def test_t(self):\n${body.split("\n").map((l) => "    " + l).join("\n")}\n`, "python"))[0]?.strength;

  it.each([
    ["expect(sum(1, 2)).toBe(3);", { exact: 1, weak: 0, vacuous: 0 }],
    ["expect(isValid(x)).toBe(true);", { exact: 1, weak: 0, vacuous: 0 }],
    ["expect(fn).toThrow('expired');", { exact: 1, weak: 0, vacuous: 0 }],
    ["assert.strictEqual(a, 3);", { exact: 1, weak: 0, vacuous: 0 }],
    ["expect(result).toBeDefined();", { exact: 0, weak: 1, vacuous: 0 }],
    ["expect(user).not.toBeNull();", { exact: 0, weak: 1, vacuous: 0 }],
    ["expect(fn).toThrow();", { exact: 0, weak: 1, vacuous: 0 }],
    ["expect(items.length).toBeGreaterThan(0);", { exact: 0, weak: 1, vacuous: 0 }],
    ["assert.ok(res);", { exact: 0, weak: 1, vacuous: 0 }],
    ["expect(true).toBe(true);", { exact: 0, weak: 0, vacuous: 1 }],
    ["expect(1).toBeTruthy();", { exact: 0, weak: 0, vacuous: 1 }],
    ["expect(x).toEqual(x);", { exact: 0, weak: 0, vacuous: 1 }],
    ["expect(value);", { exact: 0, weak: 0, vacuous: 1 }],
    ["try { expect(f()).toBe(1); } catch (e) {}", { exact: 0, weak: 0, vacuous: 1 }],
    ["try { expect(f()).toBe(1); } catch (e) { throw e; }", { exact: 1, weak: 0, vacuous: 0 }],
    ["try { run(); } finally { expect(f()).toBe(1); }", { exact: 1, weak: 0, vacuous: 0 }],
  ])("JS %s", async (body, expected) => {
    expect(await js(body)).toEqual(expected);
  });

  it.each([
    ["assert total == 42", { exact: 1, weak: 0, vacuous: 0 }],
    ["assert 'a' in names", { exact: 1, weak: 0, vacuous: 0 }],
    ["assert result is None", { exact: 1, weak: 0, vacuous: 0 }],
    ["assert math.isclose(a, b)", { exact: 1, weak: 0, vacuous: 0 }],
    ["self.assertEqual(charge(1), 1)", { exact: 1, weak: 0, vacuous: 0 }],
    ["self.assertRaises(ValueError, parse, '')", { exact: 1, weak: 0, vacuous: 0 }],
    ["assert result", { exact: 0, weak: 1, vacuous: 0 }],
    ["assert result is not None", { exact: 0, weak: 1, vacuous: 0 }],
    ["assert len(items) > 0", { exact: 0, weak: 1, vacuous: 0 }],
    ["assert isinstance(x, int)", { exact: 0, weak: 1, vacuous: 0 }],
    ["self.assertTrue(ok)", { exact: 0, weak: 1, vacuous: 0 }],
    ["self.assertRaises(Exception, parse, '')", { exact: 0, weak: 1, vacuous: 0 }],
    ["assert True", { exact: 0, weak: 0, vacuous: 1 }],
    ["assert x == x", { exact: 0, weak: 0, vacuous: 1 }],
    ["assert 1 == 1", { exact: 0, weak: 0, vacuous: 1 }],
    ["self.assertTrue(True)", { exact: 0, weak: 0, vacuous: 1 }],
    ["try:\n    assert f() == 1\nexcept AssertionError:\n    pass", { exact: 0, weak: 0, vacuous: 1 }],
    ["try:\n    assert f() == 1\nexcept Exception:\n    raise", { exact: 1, weak: 0, vacuous: 0 }],
    ["try:\n    assert f() == 1\nexcept KeyError:\n    pass", { exact: 1, weak: 0, vacuous: 0 }],
  ])("Python %s", async (body, expected) => {
    expect(await py(body)).toEqual(expected);
  });
});

describe("duplicate test names", () => {
  it("numbers later occurrences so each test is matched to its own counterpart", async () => {
    const tests = await extractTests(
      `test("same", () => { expect(a).toBe(1); });\ntest("same", () => { expect(b).toBeDefined(); });`,
      "typescript",
    );
    expect(tests.map((t) => t.name)).toEqual(["same", "same #2"]);
  });
});
