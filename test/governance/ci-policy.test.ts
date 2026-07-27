// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ci = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
const mutation = readFileSync(
  join(root, ".github", "workflows", "mutation.yml"),
  "utf8",
);
const publish = readFileSync(
  join(root, ".github", "workflows", "publish.yml"),
  "utf8",
);

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

  it("defines the scheduled and on-demand mutation gate", () => {
    expect(mutation).toContain("jobs:\n  mutation:");
    expect(mutation).toContain("workflow_dispatch:");
    expect(mutation).toContain("schedule:");
    expect(mutation).toContain("npm run test:mutation");
    expect(mutation).not.toContain("secrets.");
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

  it("pins every GitHub Action to an immutable commit SHA", () => {
    for (const workflow of [ci, mutation, publish]) {
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
