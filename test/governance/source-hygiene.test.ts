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

describe("source hygiene", () => {
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
      expect(text).not.toMatch(/\bprocess\b|\bBuffer\b|__dirname|__filename/gu);
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
