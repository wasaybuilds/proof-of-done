import type { FailedTest } from "../types.js";

export interface JUnitResult {
  total: number;
  skipped: number;
  failed: FailedTest[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    const name = m[1];
    if (name) out[name] = decode(m[3] ?? m[4] ?? "");
  }
  return out;
}

/**
 * Test outcomes from a JUnit XML report (Vitest, Jest with jest-junit, pytest, Mocha, Go, Java…).
 * Reads `<testcase>` elements: a `<failure>` or `<error>` child means failed, `<skipped>` means skipped.
 */
export function parseJUnit(xml: string): JUnitResult {
  // Failure messages and captured output can contain anything, including markup; drop them first.
  const body = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const result: JUnitResult = { total: 0, skipped: 0, failed: [] };
  for (const m of body.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    result.total++;
    const inner = m[3] ?? "";
    if (/<(failure|error)\b/.test(inner)) {
      const attrs = attributes(m[1] ?? "");
      const file = attrs.file ?? attrs.classname;
      result.failed.push({ name: attrs.name ?? "(unnamed test)", ...(file && { file }) });
    } else if (/<skipped\b/.test(inner)) {
      result.skipped++;
    }
  }
  return result;
}
