import type { Node } from "@vscode/tree-sitter-wasm";
import type { TestCase } from "../types.js";
import { children, descendants, normalizeBody } from "./util.js";

// @pytest.mark.skip, @pytest.mark.skipif(True, ...), @pytest.mark.xfail, @unittest.skip(...)
const SKIP_DECORATOR = /^@\s*(pytest\.mark\.(skip\b|xfail\b|skipif\s*\(\s*True\b)|unittest\.skip\b|skip\b)/;
const SKIP_CALLS = new Set(["pytest.skip", "self.skipTest", "unittest.skip"]);

function decoratorsOf(node: Node): string[] {
  return node.type === "decorated_definition"
    ? children(node).filter((c) => c.type === "decorator").map((d) => d.text)
    : [];
}

function definitionOf(node: Node): Node | null {
  if (node.type === "decorated_definition") return node.childForFieldName("definition");
  return node.type === "function_definition" || node.type === "class_definition" ? node : null;
}

function countAssertions(body: Node): number {
  const statements = descendants(body, "assert_statement").length;
  const methodCalls = descendants(body, "call").filter((call) => {
    const fn = call.childForFieldName("function");
    const attr = fn?.type === "attribute" ? fn.childForFieldName("attribute") : null;
    return attr !== null && attr !== undefined && /^assert/.test(attr.text);
  }).length;
  return statements + methodCalls;
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
        assertions: countAssertions(body),
        body: normalizeBody(body.text),
      });
    }
  };

  visit(root, [], false);
  return out;
}
