// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly files: readonly string[];
  readonly scripts?: Readonly<Record<string, string>>;
}

const repositoryRoot = join(import.meta.dirname, "..", "..");
const manifest = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
) as PackageManifest;
const changelog = readFileSync(join(repositoryRoot, "CHANGELOG.md"), "utf8");
const publishWorkflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "publish.yml"),
  "utf8",
);
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function releaseCandidateHeading(): string | undefined {
  return /^##\s*\[[^\]]+\].*$/mu.exec(changelog)?.[0];
}

function manifestReleaseCandidateHeadingPattern(): RegExp {
  return new RegExp(`^##\\s*\\[${escapeRegExp(manifest.version)}\\].*$`, "mu");
}

function workflowTriggerNames(source: string): readonly string[] {
  const lines = source.split(/\r?\n/u);
  const onLine = lines.findIndex((line) => /^on:\s*$/u.test(line));
  if (onLine === -1) return [];

  const triggers: string[] = [];
  for (const line of lines.slice(onLine + 1)) {
    if (/^\S/u.test(line)) break;
    const match = /^ {2}([A-Za-z_]+):/u.exec(line);
    if (match?.[1]) triggers.push(match[1]);
  }
  return triggers;
}

describe("release candidate policy", () => {
  it("has a release candidate heading in the changelog", () => {
    expect(releaseCandidateHeading()).toBeDefined();
  });

  it("keeps the changelog version aligned with the manifest", () => {
    expect(releaseCandidateHeading()).toMatch(
      manifestReleaseCandidateHeadingPattern(),
    );
  });

  // The rule is conditional on the manifest version because the two cases have
  // opposite failure modes. A prerelease heading is transient and superseded
  // within days, so at commit time its date is not yet a fact and must be
  // absent. A stable heading is permanent and nothing ever fills the date in
  // afterwards: 0.1.0-rc.16 and 0.1.0-rc.17 were both published and both sat at
  // "Unreleased" in this changelog until 0.1.0 corrected them retroactively.
  // Do not collapse these branches back into a single unconditional assertion —
  // an unconditional "must not be dated" rule passes an undated stable release,
  // which is the defect above.
  it("leaves a prerelease heading undated and requires a stable heading to be dated", () => {
    const heading = releaseCandidateHeading();
    expect(heading).toBeDefined();
    const dated = /\d{4}-\d{2}-\d{2}/u.test(heading ?? "");
    expect(dated).toBe(!manifest.version.includes("-"));
  });

  it("declares the exact published file allowlist", () => {
    expect(manifest.files).toEqual([
      "dist",
      "src",
      "README.md",
      "LICENSE",
      "NOTICE",
      "CHANGELOG.md",
    ]);
  });

  it("limits publication workflow triggers", () => {
    expect(new Set(workflowTriggerNames(publishWorkflow))).toEqual(
      new Set(["workflow_dispatch", "release"]),
    );
    expect(publishWorkflow).not.toMatch(/^ {2}push:/mu);
  });

  it("declares no automatic publish lifecycle hook", () => {
    const lifecycleHooks = [
      "prepublish",
      "prepublishOnly",
      "postpublish",
      "prepare",
    ];
    const automaticPublishHooks = lifecycleHooks.filter((hook) =>
      manifest.scripts?.[hook]?.includes("publish"),
    );
    expect(automaticPublishHooks).toEqual([]);
  });

  it("keeps npm credentials out of the repository root", () => {
    expect(existsSync(join(repositoryRoot, ".npmrc"))).toBe(false);
  });
});
