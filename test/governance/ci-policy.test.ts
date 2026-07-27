// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ci = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
const publish = readFileSync(
  join(root, ".github", "workflows", "publish.yml"),
  "utf8",
);
const packageJson = readFileSync(join(root, "package.json"), "utf8");

describe("CI policy", () => {
  it.each(["node-20:", "node-22:", "node-24:", "bun:", "workerd:", "quality:"])(
    "defines required job %s",
    (job) => {
      expect(ci).toContain(job);
    },
  );

  it.each([
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run test:coverage",
    "npm run build",
    "npm run pack:check",
    "license-checker-rseidelsohn",
    "gitleaks",
    "npx vitest run test/drift",
  ])("contains quality gate %s", (gate) => {
    expect(ci).toContain(gate);
  });

  it("has fully removed the Stryker mutation-testing gate", () => {
    // Stryker mutation testing was retired: a CI run exceeded 2.5 hours and was
    // too costly. Its cheaper replacement is the @vitest/eslint-plugin rule set
    // (run inside `npm run lint`) plus the coverage thresholds in
    // vitest.config.ts. This guard prevents the slow gate from silently
    // returning.
    expect(existsSync(join(root, ".github", "workflows", "mutation.yml"))).toBe(
      false,
    );
    expect(existsSync(join(root, "stryker.config.mjs"))).toBe(false);
    expect(existsSync(join(root, "vitest.mutation.config.ts"))).toBe(false);
    expect(packageJson).not.toContain("test:mutation");
    expect(packageJson).not.toContain("stryker");
    expect(ci).not.toContain("npm run test:mutation");
  });

  it("does not consume repository secrets for pull requests", () => {
    expect(ci).toContain("pull_request:");
    expect(ci).not.toContain("secrets.");
  });

  it("restricts publication to provenance-enabled automation", () => {
    expect(publish).toContain("workflow_dispatch:");
    expect(publish).toContain("release:");
    expect(publish).toContain("id-token: write");
    expect(publish).toContain("contents: write");
    expect(publish).toContain("NPM_CONFIG_PROVENANCE: true");
    expect(publish).toContain('npm publish "$TARBALL" --access public');
    expect(publish).toContain("--tag beta");
    expect(publish).toContain("--tag latest");
  });

  it("authenticates publication with OIDC rather than a long-lived token", () => {
    // npm trusted publishing is configured on npmjs.com against this repository
    // and `publish.yml`. The npm CLI only attempts the OIDC exchange when no
    // token is present: setup-node writes an .npmrc whose auth line expands
    // ${NODE_AUTH_TOKEN}, and if that variable is defined at all — an empty
    // string included — npm authenticates with its value instead. So the
    // assertion has to be that the name is absent from the file entirely, not
    // that it is unset or blank.
    //
    // There is no token fallback to fall back to: the package has
    // "Require two-factor authentication and disallow tokens" enabled on
    // npmjs.com and the publish token was revoked. A token line reintroduced
    // here would not merely downgrade the release path, it would break it
    // outright — which this guard catches at lint time rather than at release
    // time.
    //
    // The match is deliberately anchored to an active YAML assignment rather
    // than the bare identifier. The workflow's own comments name the variable
    // in order to explain why it is absent, so a substring search would flag
    // the documentation that exists to prevent the very regression being
    // guarded against.
    const activeAssignments = publish
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => !line.startsWith("#"));
    expect(
      activeAssignments.filter((line) => line.startsWith("NODE_AUTH_TOKEN:")),
    ).toEqual([]);
    expect(
      activeAssignments.filter((line) => line.includes("secrets.NPM_TOKEN")),
    ).toEqual([]);
    // Trusted publishing requires the runner to mint an OIDC token, and npm
    // requires CLI >= 11.5.1 to perform the exchange. Node 24 ships npm 11.
    expect(publish).toContain("id-token: write");
    expect(publish).toContain("node-version: 24");
  });

  it("detects a token assignment that is actually active", () => {
    // Proves the narrowed matcher in the test above is not vacuously true. A
    // guard that only ever sees a clean file cannot distinguish "no token" from
    // "matcher is broken", so the matcher is exercised against both forms here.
    const activeLines = (workflow: string) =>
      workflow
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => !line.startsWith("#"));

    const withToken = [
      "        env:",
      "          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}",
      "          NPM_CONFIG_PROVENANCE: true",
    ].join("\n");
    expect(
      activeLines(withToken).filter((line) =>
        line.startsWith("NODE_AUTH_TOKEN:"),
      ),
    ).toHaveLength(1);
    expect(
      activeLines(withToken).filter((line) =>
        line.includes("secrets.NPM_TOKEN"),
      ),
    ).toHaveLength(1);

    // An empty assignment must also be caught: npm treats a defined-but-blank
    // variable as a credential and skips the OIDC exchange entirely.
    const withBlankToken = ["        env:", "          NODE_AUTH_TOKEN:"].join(
      "\n",
    );
    expect(
      activeLines(withBlankToken).filter((line) =>
        line.startsWith("NODE_AUTH_TOKEN:"),
      ),
    ).toHaveLength(1);

    // Prose naming the variable must NOT be caught, which is the whole reason
    // the matcher is anchored rather than a substring search.
    const commentedOnly = [
      "        # NODE_AUTH_TOKEN must not be set here.",
      "        # Recovery: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}",
      "        env:",
      "          NPM_CONFIG_PROVENANCE: true",
    ].join("\n");
    expect(
      activeLines(commentedOnly).filter(
        (line) =>
          line.startsWith("NODE_AUTH_TOKEN:") ||
          line.includes("secrets.NPM_TOKEN"),
      ),
    ).toEqual([]);
  });

  it("pins every GitHub Action to an immutable commit SHA", () => {
    for (const workflow of [ci, publish]) {
      const refs = [...workflow.matchAll(/uses:\s*(\S+)/gu)].map(
        (match) => match[1],
      );
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(ref).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/u);
      }
    }
  });

  it("verifies the secret scanner download against a pinned checksum", () => {
    expect(ci).toMatch(/GITLEAKS_SHA256:\s*[0-9a-f]{64}/u);
    expect(ci).toContain("sha256sum -c -");
    expect(ci).not.toContain("gitleaks-action");
  });
});
