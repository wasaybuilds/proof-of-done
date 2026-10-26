import { describe, expect, it } from "vitest";
import { parseJUnit } from "../src/runner/junit.js";

describe("parseJUnit", () => {
  it("reads a Vitest report", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites name="vitest tests" tests="3" failures="1" errors="0">
  <testsuite name="src/cart.test.ts" tests="3" failures="1">
    <testcase classname="src/cart.test.ts" name="cart &gt; adds" time="0.01"></testcase>
    <testcase classname="src/cart.test.ts" name="cart &gt; totals" time="0.01">
      <failure message="expected 2 to be 3" type="AssertionError">AssertionError: expected 2 to be 3</failure>
    </testcase>
    <testcase classname="src/cart.test.ts" name="cart &gt; later" time="0"><skipped/></testcase>
  </testsuite>
</testsuites>`;
    expect(parseJUnit(xml)).toEqual({ total: 3, skipped: 1, failed: [{ name: "cart > totals", file: "src/cart.test.ts" }] });
  });

  it("reads a pytest report, counting errors as failures", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?><testsuites><testsuite name="pytest" errors="1" failures="1" tests="3">` +
      `<testcase classname="tests.test_x" name="test_a" time="0.1"/>` +
      `<testcase classname="tests.test_x" name="test_b" time="0.1"><failure message="assert 1 == 2">assert 1 == 2</failure></testcase>` +
      `<testcase classname="tests.test_x" name="test_c" time="0.1"><error message="fixture 'db' not found"/></testcase>` +
      `</testsuite></testsuites>`;
    expect(parseJUnit(xml)).toEqual({
      total: 3,
      skipped: 0,
      failed: [
        { name: "test_b", file: "tests.test_x" },
        { name: "test_c", file: "tests.test_x" },
      ],
    });
  });

  it("prefers the file attribute, and decodes entities", () => {
    const xml = `<testcase file="test/a.spec.js" classname="A" name="it&apos;s &quot;quoted&quot; &#x2713;"><failure/></testcase>`;
    expect(parseJUnit(xml).failed).toEqual([{ name: `it's "quoted" ✓`, file: "test/a.spec.js" }]);
  });

  it("isn't fooled by markup inside CDATA or comments", () => {
    const xml = `<testsuite>
      <testcase name="prints xml"><system-out><![CDATA[</testcase><testcase name="fake"><failure/>]]></system-out></testcase>
      <!-- <testcase name="commented"><failure/></testcase> -->
    </testsuite>`;
    expect(parseJUnit(xml)).toEqual({ total: 1, skipped: 0, failed: [] });
  });

  it("returns no tests for an empty or unrelated document", () => {
    expect(parseJUnit("")).toEqual({ total: 0, skipped: 0, failed: [] });
    expect(parseJUnit("<html><body>not a report</body></html>").total).toBe(0);
  });
});
