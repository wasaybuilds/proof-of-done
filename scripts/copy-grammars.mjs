// Copies only the tree-sitter runtime and the grammars we use into dist/wasm/.
// @vscode/tree-sitter-wasm ships ~22 MB of grammars for 17 languages; we need ~4 MB.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = dirname(require.resolve("@vscode/tree-sitter-wasm/package.json"));
const target = join(root, "dist", "wasm");

const FILES = [
  "tree-sitter.js",
  "tree-sitter.wasm",
  "tree-sitter-typescript.wasm",
  "tree-sitter-tsx.wasm",
  "tree-sitter-javascript.wasm",
  "tree-sitter-python.wasm",
];

mkdirSync(target, { recursive: true });
// Our package is "type": "module"; the runtime is a CommonJS/UMD script, so ship it as .cjs.
for (const file of FILES) copyFileSync(join(source, "wasm", file), join(target, file.replace(/\.js$/, ".cjs")));
copyFileSync(join(source, "LICENSE"), join(target, "LICENSE"));
console.log(`copied ${FILES.length} tree-sitter files to dist/wasm`);
