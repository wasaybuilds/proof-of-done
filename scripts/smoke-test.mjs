// Packs the package, installs the tarball into a clean project and runs it there —
// exactly what users get from npm. Catches packaging bugs unit tests can't see
// (missing files, module-format issues, dev-only dependencies).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const windows = process.platform === "win32";
const npm = windows ? "npm.cmd" : "npm";
// npm.cmd needs a shell on Windows; nothing else does.
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: windows && cmd === npm });

const dir = mkdtempSync(join(tmpdir(), "pod-smoke-"));
try {
  const tgz = run(npm, ["pack", "--silent", "--pack-destination", dir], root).trim().split("\n").pop();
  const project = join(dir, "project");
  mkdirSync(project);
  run(npm, ["init", "-y"], project);
  run(npm, ["install", "--silent", join(dir, tgz)], project);

  const installed = readdirSync(join(project, "node_modules")).filter((n) => !n.startsWith("."));
  const size = (p) => (statSync(p).isDirectory() ? readdirSync(p).reduce((s, n) => s + size(join(p, n)), 0) : statSync(p).size);
  const mb = size(join(project, "node_modules")) / 1024 / 1024;
  console.log(`installed: ${installed.join(", ")} (${mb.toFixed(1)} MB)`);
  if (mb > 8) throw new Error(`install size ${mb.toFixed(1)} MB exceeds 8 MB budget`);

  const git = (...args) => run("git", ["-c", "user.name=smoke", "-c", "user.email=smoke@example.com", ...args], project);
  const write = (p, s) => {
    mkdirSync(join(project, p, ".."), { recursive: true });
    writeFileSync(join(project, p), s);
  };
  git("init", "-q");
  write("tests/test_x.py", "def test_a():\n    assert f() == 1\n\ndef test_b():\n    assert g() == 2\n");
  write("src/a.test.tsx", 'it("renders", () => { expect(render(<A />)).toBe(1); });\n');
  write(".gitignore", "node_modules/\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  write("tests/test_x.py", "def test_a():\n    assert True\n");
  write("src/a.test.tsx", 'it("renders", () => { expect(render(<A />)).toBeDefined(); });\n');

  const bin = join(project, "node_modules", "proof-of-done", "dist", "cli", "index.js");
  let out = "";
  try {
    out = run(process.execPath, [bin, "verify", "--json"], project);
    throw new Error("expected exit code 1 (FAIL)");
  } catch (err) {
    if (err.status !== 1) throw err;
    out = err.stdout;
  }
  const rules = [...new Set(JSON.parse(out).findings.map((f) => f.ruleId))].sort();
  const expected = ["POD001", "POD004", "POD005"];
  if (JSON.stringify(rules) !== JSON.stringify(expected)) throw new Error(`expected ${expected}, got ${rules}`);
  console.log(`smoke test passed: ${rules.join(", ")} detected from the installed package`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
