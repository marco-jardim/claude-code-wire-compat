// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const scriptPath = path.join(repositoryRoot, "scripts", "verify-drift.mjs");
const fixtureRoot = path.join(repositoryRoot, "test", "drift", "fixtures");
const realSource = String.raw`D:\git\opencode-anthropic-fix`;

function runVerifier(source: string) {
  return spawnSync(process.execPath, [scriptPath, "--source", source], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

describe("offline protocol drift verifier", () => {
  it("accepts a matching synthetic source", () => {
    const result = runVerifier(path.join(fixtureRoot, "valid"));

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "profile=claude-code-2.1.195-sdk-0.94.0 drift=none\n",
    );
    expect(result.stderr).toBe("");
  });

  it.each([
    {
      fixture: "cli-version",
      field: "cliVersion",
      category: "protocol",
      forbidden: "2.1.196",
    },
    {
      fixture: "endpoint",
      field: "endpoint",
      category: "protocol",
      forbidden: "example.invalid",
    },
    {
      fixture: "beta-order",
      field: "orderedBetas",
      category: "protocol",
      forbidden: "oauth-2025-04-20",
    },
    {
      fixture: "header-name",
      field: "headerNames",
      category: "protocol",
      forbidden: "x-client-id",
    },
    {
      fixture: "billing-prefix",
      field: "billingPrefix",
      category: "protocol",
      forbidden: "x-synthetic-billing-header:",
    },
    {
      fixture: "golden-hash",
      field: "goldenHashes",
      category: "integrity",
      forbidden:
        "0000000000000000000000000000000000000000000000000000000000000000",
    },
  ])(
    "reports only the field name for $fixture drift",
    ({ fixture, field, category, forbidden }) => {
      const result = runVerifier(path.join(fixtureRoot, fixture));

      expect(result.status).toBe(1);
      expect(result.stdout).toBe(`category=${category} fields=${field}\n`);
      expect(result.stdout).not.toContain(forbidden);
      expect(result.stdout).not.toContain("claude-code-2.1.195-sdk-0.94.0");
      expect(result.stderr).toBe("");
    },
  );

  it("uses a distinct failure for an unavailable source", () => {
    const missingSource = path.join(fixtureRoot, "does-not-exist");
    expect(existsSync(missingSource)).toBe(false);

    const result = runVerifier(missingSource);

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("SOURCE_UNAVAILABLE\n");
    expect(result.stdout).not.toContain("drift=none");
    expect(result.stderr).toBe("");
  });

  it.skipIf(!existsSync(realSource))("accepts the pinned real source", () => {
    const result = runVerifier(realSource);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "profile=claude-code-2.1.195-sdk-0.94.0 drift=none\n",
    );
    expect(result.stderr).toBe("");
  });
});
