// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const validationDirectory = join(process.cwd(), "test", "validation");
const INTERNAL_UNIT_TEST_ALLOWLIST = new Set([
  "betas.test.ts", // Exercises beta composition directly without constructing requests.
  "build-request.test.ts", // Exercises parser and request-builder implementation helpers directly.
  "content-blocks.test.ts", // Exercises canonical content-block parsing as an internal unit.
  "experimental-body-fields.test.ts", // Exercises the body extension merger as an internal unit.
  "fingerprint-crypto.test.ts", // Exercises fingerprint crypto-provider internals directly.
  "fingerprint.test.ts", // Exercises deterministic fingerprint helpers directly.
  "header-mutants.test.ts", // Mutation tests target internal header helper branches.
  "headers.test.ts", // Exercises canonical header composition as an internal unit.
  "metadata-headers-mutants.test.ts", // Mutation tests target metadata and header internals.
  "metadata.test.ts", // Exercises runtime identity and metadata helpers directly.
  "model-identity.test.ts", // Exercises the internal model-identity port directly.
  "redaction-mutants.test.ts", // Mutation tests target internal redaction helper branches.
  "redaction.test.ts", // Exercises redaction and evidence helpers directly.
  "request-body-mutants.test.ts", // Mutation tests target canonical body internals directly.
  "request-body.test.ts", // Exercises canonical request-body parsing as an internal unit.
  "system-prompt.test.ts", // Exercises canonical system-prompt composition as an internal unit.
  "thinking-budget.test.ts", // Exercises the internal thinking-budget table directly.
  "tool-definitions.test.ts", // Exercises tool-union parsing as an internal request-body unit.
  "unicode.test.ts", // Exercises UTF-16 classification independently of request construction.
]);
const validationTests = readdirSync(validationDirectory)
  .filter((name) => name.endsWith(".test.ts"))
  .filter((name) => !INTERNAL_UNIT_TEST_ALLOWLIST.has(name))
  .sort();

describe("public path coverage", () => {
  it.each(validationTests)(
    "requires %s to import the public entry point",
    (name) => {
      const source = readFileSync(join(validationDirectory, name), "utf8");

      expect(source).toMatch(/from\s+["']\.\.\/\.\.\/src\/index\.js["']/u);
    },
  );
});
