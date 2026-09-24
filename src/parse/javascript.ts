import type { Node } from "@vscode/tree-sitter-wasm";
import type { TestCase } from "../types.js";
import { children, descendants, normalizeBody, stringValue } from "./util.js";

const TEST_FNS = new Set(["it", "test", "xit", "xtest", "fit"]);
const SUITE_FNS = new Set(["describe", "xdescribe", "fdescribe", "suite", "context"]);
const SKIP_MODS = new Set(["skip", "todo"]);
const ASSERT_FNS = new Set(["expect", "assert", "expectTypeOf"]);

/** `test.skip.each(t)` → ["test", "skip", "each"]. Follows curried calls like `test.each(t)(...)`. */
function calleeChain(fn: Node): string[] | null {
  if (fn.type === "identifier") return [fn.text];
  if (fn.type === "member_expression") {
    const object = fn.childForFieldName("object");
    const property = fn.childForFieldName("property");
    const chain = object ? calleeChain(object) : null;
    return chain && property ? [...chain, property.text] : null;
  }
  if (fn.type === "call_expression") {
    const inner = fn.childForFieldName("function");
    return inner ? calleeChain(inner) : null;
  }
  return null;
}

interface TestCall {
  kind: "test" | "suite";
  name: string;
  skipped: boolean;
  focused: boolean;
  body: Node | null;
}

function asTestCall(call: Node): TestCall | null {
  const fn = call.childForFieldName("function");
  const chain = fn ? calleeChain(fn) : null;
  if (!chain) return null;
  const [root, ...mods] = chain;
  if (root === undefined) return null;
  const kind = TEST_FNS.has(root) ? "test" : SUITE_FNS.has(root) ? "suite" : null;
  if (!kind) return null;

  const args = children(call.childForFieldName("arguments") ?? call);
  const first = args[0];
  if (!first) return null;
  const callback = [...args]
    .reverse()
    .find((a) => a.type === "arrow_function" || a.type === "function_expression" || a.type === "function");

  return {
    kind,
    name: stringValue(first),
    skipped: root.startsWith("x") || mods.some((m) => SKIP_MODS.has(m)) || (kind === "test" && !callback),
    focused: root.startsWith("f") || mods.includes("only"),
    body: callback?.childForFieldName("body") ?? null,
  };
}

function countAssertions(body: Node): number {
  return descendants(body, "call_expression").filter((call) => {
    const fn = call.childForFieldName("function");
    if (!fn) return false;
    if (fn.type === "identifier") return ASSERT_FNS.has(fn.text);
    // assert.equal(...), assert.strictEqual(...) — but not expect(x).toBe(y), which is counted via the inner expect(x)
    if (fn.type === "member_expression") {
      const object = fn.childForFieldName("object");
      return object?.type === "identifier" && object.text === "assert";
    }
    return false;
  }).length;
}

export function extractJsTests(root: Node): TestCase[] {
  const out: TestCase[] = [];

  const visit = (node: Node, scope: string[], skippedScope: boolean, focusedScope: boolean): void => {
    for (const child of children(node)) {
      const call = child.type === "call_expression" ? asTestCall(child) : null;
      if (!call) {
        visit(child, scope, skippedScope, focusedScope);
        continue;
      }
      const skipped = skippedScope || call.skipped;
      const focused = focusedScope || call.focused;
      if (call.kind === "suite") {
        if (call.body) visit(call.body, [...scope, call.name], skipped, focused);
        continue;
      }
      out.push({
        name: [...scope, call.name].join(" > "),
        line: child.startPosition.row + 1,
        skipped,
        focused,
        assertions: call.body ? countAssertions(call.body) : 0,
        body: call.body ? normalizeBody(call.body.text) : "",
      });
    }
  };

  visit(root, [], false, false);
  return out;
}
