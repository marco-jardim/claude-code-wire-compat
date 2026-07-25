// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function typescriptSourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return typescriptSourceFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

const sourcePaths = typescriptSourceFiles(join(root, "src"));
const guardedModules = [
  "build-request.ts",
  "metadata.ts",
  "redaction.ts",
  "system-prompt.ts",
  "request-body.ts",
] as const;

describe("Unicode validation governance", () => {
  it("rejects NaN-unsafe surrogate guards in source files", () => {
    expect(sourcePaths.length).toBeGreaterThan(0);

    // Relational comparisons against NaN are false, so an OR range exclusion
    // can accept a trailing high surrogate when charCodeAt returns NaN.
    const unsafeSurrogateGuard = /<\s*0xdc00\s*\|\|[^\n]*>\s*0xdfff/iu;
    for (const path of sourcePaths) {
      expect(readFileSync(path, "utf8")).not.toMatch(unsafeSurrogateGuard);
    }
  });

  it.each(guardedModules)("retains the NaN-safe guard in src/%s", (module) => {
    const source = readFileSync(join(root, "src", module), "utf8");
    expect(source).toContain(">= 0xdc00 &&");
  });
});
