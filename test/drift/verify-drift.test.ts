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

const DEFAULT_PROFILE_ID = "claude-code-2.1.195-sdk-0.94.0";

function runVerifier(source: string, ...extra: readonly string[]) {
  return spawnSync(
    process.execPath,
    [scriptPath, "--source", source, ...extra],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );
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
      fixture: "unknown-beta",
      field: "betaRegistry",
      category: "protocol",
      forbidden: "unmodelled-upstream-beta-2099-01-01",
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

  /*
   * `--profile` selects which monitored profile to verify. Every existing
   * caller omits it, so the default path must stay byte-identical -- the
   * assertions above are that pin, and the two below prove the flag is a
   * no-op when it names the default.
   */
  it("produces identical output when the default profile is named explicitly", () => {
    const implicit = runVerifier(path.join(fixtureRoot, "valid"));
    const explicit = runVerifier(
      path.join(fixtureRoot, "valid"),
      "--profile",
      DEFAULT_PROFILE_ID,
    );

    expect(explicit.status).toBe(implicit.status);
    expect(explicit.stdout).toBe(implicit.stdout);
    expect(explicit.stderr).toBe(implicit.stderr);
    expect(explicit.stdout).toBe(`profile=${DEFAULT_PROFILE_ID} drift=none\n`);
  });

  it("rejects an unmonitored profile with a distinct exit code", () => {
    const result = runVerifier(
      path.join(fixtureRoot, "valid"),
      "--profile",
      "claude-code-9.9.9-sdk-9.9.9",
    );

    // Not 0 (verified), not 1 (drift), not 2 (source unavailable): a typo must
    // not be able to masquerade as any of those.
    expect(result.status).toBe(3);
    expect(result.stdout).toBe(
      `error=unknown-profile known=${DEFAULT_PROFILE_ID}\n`,
    );
    expect(result.stderr).toBe("");
  });

  it("rejects `--profile` with no value", () => {
    const result = runVerifier(path.join(fixtureRoot, "valid"), "--profile");

    expect(result.status).toBe(3);
    expect(result.stdout).toBe(
      `error=unknown-profile known=${DEFAULT_PROFILE_ID}\n`,
    );
    expect(result.stderr).toBe("");
  });

  it("does not echo the requested profile back into the log", () => {
    const injected = "claude-code-2.1.195-sdk-0.94.0-LEAKED-SECRET";
    const result = runVerifier(
      path.join(fixtureRoot, "valid"),
      "--profile",
      injected,
    );

    expect(result.status).toBe(3);
    expect(result.stdout).not.toContain(injected);
    expect(result.stdout).not.toContain("LEAKED-SECRET");
    expect(result.stdout).not.toContain("drift=none");
    expect(result.stderr).toBe("");
  });

  it("rejects an unmonitored profile even when the source is unavailable", () => {
    const missingSource = path.join(fixtureRoot, "does-not-exist");
    expect(existsSync(missingSource)).toBe(false);

    const result = runVerifier(
      missingSource,
      "--profile",
      "claude-code-9.9.9-sdk-9.9.9",
    );

    // The usage error is decided before the source is read, so it wins.
    expect(result.status).toBe(3);
    expect(result.stdout).not.toContain("SOURCE_UNAVAILABLE");
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
