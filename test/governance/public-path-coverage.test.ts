// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const validationDirectory = join(process.cwd(), "test", "validation");
const contractExpansionTests = readdirSync(validationDirectory)
  .filter((name) => name.endsWith("-contract-expansion.test.ts"))
  .sort();

describe("public path coverage", () => {
  it.each(contractExpansionTests)(
    "requires %s to import the public entry point",
    (name) => {
      const source = readFileSync(join(validationDirectory, name), "utf8");

      expect(source).toMatch(/from\s+["']\.\.\/\.\.\/src\/index\.js["']/u);
    },
  );
});
