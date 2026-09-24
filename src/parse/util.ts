import type { Node } from "@vscode/tree-sitter-wasm";

export function children(node: Node): Node[] {
  return node.namedChildren.filter((c): c is Node => c !== null);
}

export function descendants(node: Node, type: string): Node[] {
  return node.descendantsOfType(type).filter((c): c is Node => c !== null);
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
