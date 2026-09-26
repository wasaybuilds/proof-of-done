import type { Node } from "@vscode/tree-sitter-wasm";

export function children(node: Node): Node[] {
  return node.namedChildren.filter((c): c is Node => c !== null);
}

export function descendants(node: Node, type: string): Node[] {
  return node.descendantsOfType(type).filter((c): c is Node => c !== null);
}

export type Strength = "exact" | "weak" | "vacuous";

export interface Assertion {
  strength: Strength;
  line: number;
}

export function summarize(assertions: Assertion[]) {
  const strength = { exact: 0, weak: 0, vacuous: 0 };
  for (const a of assertions) strength[a.strength]++;
  return {
    assertions: assertions.length,
    strength,
    vacuousLines: assertions.filter((a) => a.strength === "vacuous").map((a) => a.line),
  };
}

/** Is `node` inside the body of a try statement (below `stop`) whose handlers swallow errors? */
export function inSwallowingTry(node: Node, stop: Node, swallows: (tryNode: Node, bodyOf: Node) => boolean): boolean {
  let child: Node = node;
  for (let p = node.parent; p && p.id !== stop.id; child = p, p = p.parent) {
    if (p.type === "try_statement" && swallows(p, child)) return true;
  }
  return false;
}

export function normalizeBody(text: string): string {
  return text.replace(/\s+/g, "");
}

export function stringValue(node: Node): string {
  if (node.type === "string" || node.type === "template_string") {
    return node.text.replace(/^[`'"]|[`'"]$/g, "");
  }
  return node.text;
}
