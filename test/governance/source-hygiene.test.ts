// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync, readdirSync } from "node:fs";
import { builtinModules } from "node:module";

import { describe, expect, it } from "vitest";

function sourceFiles(directory: URL): readonly URL[] {
  const files: URL[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory())
      files.push(...sourceFiles(new URL(`${entry.name}/`, directory)));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(url);
  }
  return files;
}

/**
 * Matches a read of a host global rather than the bare word.
 *
 * This deliberately requires member access, a `typeof` guard, or a property
 * lookup off another object. `src/anti-verbosity.ts` carries verbatim prompt
 * prose extracted from the pinned client, and that prose contains the English
 * noun "process" three times ("they didn't watch your process unfold"). A
 * bare-word rule flagged it, which is a false positive: a string literal is not
 * an ambient runtime dependency. Every way of actually reaching these globals
 * still matches, and `ambient global forms` below pins that.
 */
const AMBIENT_GLOBALS =
  /\b(?:process|Buffer)\.[A-Za-z_$]|\b(?:process|Buffer)\[|\btypeof\s+(?:process|Buffer)\b|\bnew\s+Buffer\b|\.(?:process|Buffer)\b|\[["'](?:process|Buffer)["']\]|__dirname|__filename/u;

describe("source hygiene", () => {
  it("keeps the ambient global pattern strict enough to matter", () => {
    for (const bad of [
      "process.env.HOME",
      'process["env"]',
      "typeof process",
      "typeof Buffer",
      "Buffer.from(x)",
      "new Buffer(8)",
      "globalThis.process",
      'globalThis["Buffer"]',
      "const d = __dirname;",
      "const f = __filename;",
    ]) {
      expect(bad).toMatch(AMBIENT_GLOBALS);
    }

    for (const good of [
      "they didn't watch your process unfold",
      "a running commentary on your thought process",
      "the review process is documented",
      "a Buffer of prose is still just prose",
    ]) {
      expect(good).not.toMatch(AMBIENT_GLOBALS);
    }
  });

  it("keeps every source module free of ambient runtime dependencies", () => {
    const builtins = new Set(
      builtinModules.flatMap((name) => [name, name.replace(/^node:/u, "")]),
    );
    const src = new URL("../../src/", import.meta.url);
    for (const file of sourceFiles(src)) {
      const text = readFileSync(file, "utf8");
      const importSpecifiers = [
        ...text.matchAll(/(?:from\s+|import\s*\()(["'])([^"']+)\1/gu),
      ];
      for (const match of importSpecifiers) {
        const specifier = match[2];
        expect(specifier).toBeDefined();
        if (specifier !== undefined) {
          expect(builtins.has(specifier.replace(/^node:/u, ""))).toBe(false);
        }
      }
      expect(text).not.toMatch(AMBIENT_GLOBALS);
      expect(text).not.toMatch(/\brequire\s*\(|\bfetch\s*\(/gu);
      expect(text).not.toMatch(/\bset(?:Timeout|Interval)\s*\(/gu);
      expect(text).not.toMatch(/\bDate\.now\s*\(|\bnew\s+Date\s*\(/gu);
      expect(text).not.toMatch(/\bMath\.random\s*\(/gu);
    }
  });

  it("keeps every source module free of xxHash", () => {
    const files = sourceFiles(new URL("../../src/", import.meta.url));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(/xxhash/iu);
    }
  });
});
