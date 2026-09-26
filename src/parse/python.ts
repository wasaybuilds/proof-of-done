import type { Node } from "@vscode/tree-sitter-wasm";
import type { TestCase } from "../types.js";
import { children, descendants, inSwallowingTry, normalizeBody, summarize, type Assertion, type Strength } from "./util.js";

// @pytest.mark.skip, @pytest.mark.skipif(True, ...), @pytest.mark.xfail, @unittest.skip(...)
const SKIP_DECORATOR = /^@\s*(pytest\.mark\.(skip\b|xfail\b|skipif\s*\(\s*True\b)|unittest\.skip\b|skip\b)/;
const SKIP_CALLS = new Set(["pytest.skip", "self.skipTest", "unittest.skip"]);

const LITERALS = new Set(["true", "false", "none", "integer", "float", "string", "concatenated_string"]);
const WEAK_UNITTEST = new Set([
  "assertTrue",
  "assertFalse",
  "assertIsNotNone",
  "assertIsInstance",
  "assertGreater",
  "assertGreaterEqual",
  "assertLess",
  "assertLessEqual",
]);
const EQUALITY_UNITTEST = new Set(["assertEqual", "assertEquals", "assertIs", "assertListEqual", "assertDictEqual", "assertCountEqual"]);
const WEAK_CALLS = new Set(["isinstance", "hasattr", "callable", "bool"]);
const BROAD_EXCEPTIONS = /^(Exception|BaseException)$/;

function decoratorsOf(node: Node): string[] {
  return node.type === "decorated_definition"
    ? children(node).filter((c) => c.type === "decorator").map((d) => d.text)
    : [];
}

function definitionOf(node: Node): Node | null {
  if (node.type === "decorated_definition") return node.childForFieldName("definition");
  return node.type === "function_definition" || node.type === "class_definition" ? node : null;
}

const unwrap = (n: Node): Node => (n.type === "parenthesized_expression" ? unwrap(children(n)[0] ?? n) : n);
const isLiteral = (n: Node | undefined): boolean => !!n && LITERALS.has(unwrap(n).type);

/** Operator tokens of a comparison, e.g. ["is not"] or ["<", "<="]. */
function comparisonOps(cmp: Node): string[] {
  const named = new Set(children(cmp).map((c) => c.id));
  return cmp.children
    .filter((c): c is Node => c !== null && !named.has(c.id))
    .map((c) => c.text.replace(/\s+/g, " "));
}

function classifyCondition(raw: Node | undefined): Strength {
  if (!raw) return "vacuous";
  const c = unwrap(raw);
  if (isLiteral(c)) return "vacuous"; // assert True
  if (c.type === "not_operator") return isLiteral(children(c)[0]) ? "vacuous" : "weak";
  if (c.type === "comparison_operator") {
    const operands = children(c);
    const ops = comparisonOps(c);
    if (operands.length === 2 && operands[0]?.text === operands[1]?.text) return "vacuous"; // x == x
    if (operands.every((o) => isLiteral(o))) return "vacuous"; // 1 == 1
    const last = operands[operands.length - 1];
    const opsText = ops.join(" ");
    if (/\bis not\b|!=/.test(opsText) && last && unwrap(last).type === "none") return "weak"; // x is not None
    if (ops.every((o) => ["<", ">", "<=", ">="].includes(o))) return "weak"; // bounds
    return "exact";
  }
  if (c.type === "call") return WEAK_CALLS.has(c.childForFieldName("function")?.text ?? "") ? "weak" : "exact";
  if (["identifier", "attribute", "subscript"].includes(c.type)) return "weak"; // truthiness
  return "exact";
}

function classifyUnittest(method: string, call: Node): Strength {
  const [a, b] = children(call.childForFieldName("arguments") ?? call);
  if (EQUALITY_UNITTEST.has(method) && a && b && (a.text === b.text || (isLiteral(a) && isLiteral(b)))) return "vacuous";
  if ((method === "assertTrue" || method === "assertFalse" || method === "assertIsNotNone") && isLiteral(a)) return "vacuous";
  if (method.startsWith("assertRaises")) return a && BROAD_EXCEPTIONS.test(a.text) ? "weak" : "exact";
  return WEAK_UNITTEST.has(method) ? "weak" : "exact";
}

/** An except clause swallows assertion failures if it catches them and doesn't re-raise. */
function pySwallows(tryNode: Node, bodyOf: Node): boolean {
  if (tryNode.childForFieldName("body")?.id !== bodyOf.id) return false;
  return children(tryNode)
    .filter((c) => c.type === "except_clause")
    .some((clause) => {
      const caught = children(clause).find((c) => c.type !== "block");
      const catchesAssertions = !caught || /\b(AssertionError|Exception|BaseException)\b/.test(caught.text);
      return catchesAssertions && descendants(clause, "raise_statement").length === 0;
    });
}

function collectAssertions(body: Node): Assertion[] {
  const out: Assertion[] = [];
  const add = (node: Node, strength: Strength) =>
    out.push({ strength: inSwallowingTry(node, body, pySwallows) ? "vacuous" : strength, line: node.startPosition.row + 1 });

  for (const stmt of descendants(body, "assert_statement")) add(stmt, classifyCondition(children(stmt)[0]));
  for (const call of descendants(body, "call")) {
    const fn = call.childForFieldName("function");
    const attr = fn?.type === "attribute" ? fn.childForFieldName("attribute")?.text : undefined;
    if (attr && /^assert/.test(attr)) add(call, classifyUnittest(attr, call));
  }
  return out.sort((x, y) => x.line - y.line);
}

function callsSkip(body: Node): boolean {
  return descendants(body, "call").some((call) => {
    const fn = call.childForFieldName("function");
    return fn !== null && SKIP_CALLS.has(fn.text);
  });
}

function isTestClass(def: Node): boolean {
  const name = def.childForFieldName("name")?.text ?? "";
  const bases = def.childForFieldName("superclasses")?.text ?? "";
  return name.startsWith("Test") || /TestCase\b/.test(bases);
}

export function extractPythonTests(root: Node): TestCase[] {
  const out: TestCase[] = [];

  const visit = (container: Node, scope: string[], skippedScope: boolean): void => {
    for (const node of children(container)) {
      const def = definitionOf(node);
      if (!def) continue;
      const skippedByDecorator = decoratorsOf(node).some((d) => SKIP_DECORATOR.test(d));
      const name = def.childForFieldName("name")?.text ?? "";
      const body = def.childForFieldName("body");

      if (def.type === "class_definition") {
        if (body && isTestClass(def)) visit(body, [...scope, name], skippedScope || skippedByDecorator);
        continue;
      }
      if (!name.startsWith("test") || !body) continue;
      out.push({
        name: [...scope, name].join(" > "),
        line: node.startPosition.row + 1,
        skipped: skippedScope || skippedByDecorator || callsSkip(body),
        focused: false,
        ...summarize(collectAssertions(body)),
        body: normalizeBody(body.text),
      });
    }
  };

  visit(root, [], false);
  return out;
}
