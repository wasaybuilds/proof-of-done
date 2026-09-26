import type { Node } from "@vscode/tree-sitter-wasm";
import type { TestCase } from "../types.js";
import { children, descendants, inSwallowingTry, normalizeBody, stringValue, summarize, type Assertion, type Strength } from "./util.js";

const TEST_FNS = new Set(["it", "test", "xit", "xtest", "fit"]);
const SUITE_FNS = new Set(["describe", "xdescribe", "fdescribe", "suite", "context"]);
const SKIP_MODS = new Set(["skip", "todo"]);

// Matchers that only check existence, truthiness, type or a bound — weaker than checking a value.
const WEAK_MATCHERS = new Set([
  "toBeDefined",
  "toBeTruthy",
  "toBeFalsy",
  "toBeInstanceOf",
  "toBeTypeOf",
  "toBeGreaterThan",
  "toBeGreaterThanOrEqual",
  "toBeLessThan",
  "toBeLessThanOrEqual",
  "toHaveBeenCalled",
  "toBeCalled",
]);
const WEAK_WHEN_NEGATED = new Set(["toBeNull", "toBeUndefined", "toBeFalsy", "toBeNaN"]);
const WEAK_WITHOUT_ARGS = new Set(["toThrow", "toThrowError", "toHaveBeenCalledWith"]);
const EQUALITY_MATCHERS = new Set(["toBe", "toEqual", "toStrictEqual", "toMatchObject"]);
const NODE_ASSERT_EXACT = new Set([
  "equal",
  "strictEqual",
  "deepEqual",
  "deepStrictEqual",
  "notEqual",
  "notStrictEqual",
  "notDeepEqual",
  "notDeepStrictEqual",
  "match",
  "doesNotMatch",
]);

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

function isLiteral(n: Node | undefined): boolean {
  if (!n) return false;
  if (["number", "string", "true", "false", "null", "regex"].includes(n.type)) return true;
  if (n.type === "identifier") return n.text === "undefined";
  if (n.type === "template_string") return !children(n).some((c) => c.type === "template_substitution");
  if (n.type === "unary_expression") return isLiteral(children(n)[0]);
  return false;
}

const args = (call: Node): Node[] => children(call.childForFieldName("arguments") ?? call);

/** `expect(subject).not.toBe(x)` → matcher "toBe", mods ["not"], matcher args [x]. */
function expectChain(expectCall: Node): { mods: string[]; matcher?: string; matcherArgs: Node[] } {
  const mods: string[] = [];
  let node = expectCall;
  for (let parent = node.parent; parent?.type === "member_expression"; parent = node.parent) {
    if (parent.childForFieldName("object")?.id !== node.id) break;
    const prop = parent.childForFieldName("property")?.text ?? "";
    const grand = parent.parent;
    if (grand?.type === "call_expression" && grand.childForFieldName("function")?.id === parent.id) {
      return { mods, matcher: prop, matcherArgs: args(grand) };
    }
    mods.push(prop);
    node = parent;
  }
  return { mods, matcherArgs: [] };
}

function classifyExpect(expectCall: Node): Strength {
  const subject = args(expectCall)[0];
  const { mods, matcher, matcherArgs } = expectChain(expectCall);
  if (!matcher) return "vacuous"; // `expect(x)` on its own checks nothing
  const first = matcherArgs[0];
  if (isLiteral(subject) && matcherArgs.every(isLiteral)) return "vacuous"; // expect(true).toBe(true)
  if (EQUALITY_MATCHERS.has(matcher) && subject && first && subject.text === first.text) return "vacuous"; // expect(x).toBe(x)
  const negated = mods.includes("not");
  if (WEAK_MATCHERS.has(matcher)) return "weak";
  if (negated && WEAK_WHEN_NEGATED.has(matcher)) return "weak";
  if (WEAK_WITHOUT_ARGS.has(matcher) && matcherArgs.length === 0) return "weak";
  if (matcherArgs.some((a) => /^expect\.(anything|any)\(/.test(a.text))) return "weak";
  return "exact";
}

function classifyNodeAssert(method: string | undefined, call: Node): Strength {
  const [a, b] = args(call);
  if (method === undefined || method === "ok") return isLiteral(a) ? "vacuous" : "weak"; // assert(x), assert.ok(x)
  if (a && b && a.text === b.text) return "vacuous";
  if (isLiteral(a) && isLiteral(b)) return "vacuous";
  if (method === "throws" || method === "rejects") return b ? "exact" : "weak";
  return NODE_ASSERT_EXACT.has(method) ? "exact" : "weak";
}

/** A catch clause swallows assertion failures unless it rethrows or asserts. */
function jsSwallows(tryNode: Node, bodyOf: Node): boolean {
  if (tryNode.childForFieldName("body")?.id !== bodyOf.id) return false;
  const handler = tryNode.childForFieldName("handler");
  const handlerBody = handler?.childForFieldName("body");
  if (!handlerBody) return false;
  if (descendants(handlerBody, "throw_statement").length) return false;
  return !descendants(handlerBody, "call_expression").some((c) => /^(expect|assert|fail)\b/.test(c.text));
}

function collectAssertions(body: Node): Assertion[] {
  const out: Assertion[] = [];
  for (const call of descendants(body, "call_expression")) {
    const fn = call.childForFieldName("function");
    if (!fn) continue;
    let strength: Strength | undefined;
    if (fn.type === "identifier" && (fn.text === "expect" || fn.text === "expectTypeOf")) {
      strength = fn.text === "expectTypeOf" ? "exact" : classifyExpect(call);
    } else if (fn.type === "identifier" && fn.text === "assert") {
      strength = classifyNodeAssert(undefined, call);
    } else if (fn.type === "member_expression" && fn.childForFieldName("object")?.text === "assert") {
      // assert.equal(...) — but not expect(x).toBe(y), which is counted via the inner expect(x)
      strength = classifyNodeAssert(fn.childForFieldName("property")?.text, call);
    }
    if (!strength) continue;
    if (inSwallowingTry(call, body, jsSwallows)) strength = "vacuous";
    out.push({ strength, line: call.startPosition.row + 1 });
  }
  return out;
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
        ...summarize(call.body ? collectAssertions(call.body) : []),
        body: call.body ? normalizeBody(call.body.text) : "",
      });
    }
  };

  visit(root, [], false, false);
  return out;
}
