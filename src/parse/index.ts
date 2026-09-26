import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Language, Node } from "@vscode/tree-sitter-wasm";
import type { Lang, TestCase } from "../types.js";
import { extractJsTests } from "./javascript.js";
import { extractPythonTests } from "./python.js";

const require = createRequire(import.meta.url);

const GRAMMARS: Record<Lang, string> = {
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  javascript: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
};

// The published package ships only the grammars we use in dist/wasm/ (see scripts/copy-grammars.mjs).
// When running from source, fall back to the full @vscode/tree-sitter-wasm dev dependency.
const VENDORED = join(dirname(fileURLToPath(import.meta.url)), "..", "wasm");

function wasmPath(file: string): string {
  const vendored = join(VENDORED, file);
  return existsSync(vendored) ? vendored : require.resolve(`@vscode/tree-sitter-wasm/wasm/${file}`);
}

// Vendored as .cjs because this package is "type": "module" and the runtime is a CommonJS/UMD script.
const RUNTIME = existsSync(join(VENDORED, "tree-sitter.cjs"))
  ? join(VENDORED, "tree-sitter.cjs")
  : require.resolve("@vscode/tree-sitter-wasm/wasm/tree-sitter.js");
const TreeSitter = require(RUNTIME) as typeof import("@vscode/tree-sitter-wasm");

let init: Promise<void> | undefined;
const languages = new Map<Lang, Promise<Language>>();

function loadLanguage(lang: Lang): Promise<Language> {
  init ??= TreeSitter.Parser.init({ locateFile: (file) => wasmPath(file) });
  let language = languages.get(lang);
  if (!language) {
    language = init.then(() => TreeSitter.Language.load(readFileSync(wasmPath(GRAMMARS[lang]))));
    languages.set(lang, language);
  }
  return language;
}

export function languageForPath(path: string): Lang | undefined {
  if (/\.[cm]?ts$/.test(path)) return "typescript";
  if (/\.tsx$/.test(path)) return "tsx";
  if (/\.[cm]?jsx?$/.test(path)) return "javascript";
  if (/\.py$/.test(path)) return "python";
  return undefined;
}

/**
 * Tests are matched across versions by name. Files can declare the same name twice,
 * so later occurrences get their position appended: "z.transform", "z.transform #2".
 */
function disambiguate(tests: TestCase[]): TestCase[] {
  const seen = new Map<string, number>();
  return tests.map((t) => {
    const n = (seen.get(t.name) ?? 0) + 1;
    seen.set(t.name, n);
    return n === 1 ? t : { ...t, name: `${t.name} #${n}` };
  });
}

/** Parse `source` and return the test cases it declares. */
export async function extractTests(source: string, lang: Lang): Promise<TestCase[]> {
  const language = await loadLanguage(lang);
  const parser = new TreeSitter.Parser();
  try {
    parser.setLanguage(language);
    const tree = parser.parse(source);
    if (!tree) return [];
    try {
      const root: Node = tree.rootNode;
      return disambiguate(lang === "python" ? extractPythonTests(root) : extractJsTests(root));
    } finally {
      tree.delete();
    }
  } finally {
    parser.delete();
  }
}
