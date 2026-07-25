// SPDX-License-Identifier: GPL-3.0-or-later

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it, beforeAll } from "vitest";

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly files: readonly string[];
  readonly scripts?: Readonly<Record<string, string>>;
}

interface PackFile {
  readonly path: string;
}

interface PackResult {
  readonly filename: string;
  readonly files: readonly PackFile[];
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
let packed: PackResult | undefined;

function npmCliPath(): string {
  const candidates: string[] = [];
  if (process.env.npm_execpath) {
    candidates.push(process.env.npm_execpath);
  }
  try {
    candidates.push(
      createRequire(import.meta.url).resolve("npm/bin/npm-cli.js"),
    );
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      (error.code !== "MODULE_NOT_FOUND" &&
        error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED")
    ) {
      throw error;
    }
  }
  candidates.push(
    resolve(
      dirname(process.execPath),
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js",
    ),
  );
  const npmCli = candidates.find((candidate) => existsSync(candidate));
  if (!npmCli) {
    throw new Error(
      `Unable to locate npm CLI; checked: ${candidates.join(", ")}`,
    );
  }
  return npmCli;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function packResult(): PackResult {
  if (!packed) throw new Error("npm pack did not produce a result");
  return packed;
}

function releaseCandidateHeading(): string | undefined {
  const versionPattern = new RegExp(
    `^##\\s*\\[${escapeRegExp(manifest.version)}\\].*$`,
    "mu",
  );
  return changelog.match(versionPattern)?.[0];
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
  beforeAll(() => {
    execFileSync(process.execPath, [npmCliPath(), "run", "build"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    const output = execFileSync(
      process.execPath,
      [npmCliPath(), "pack", "--dry-run", "--json", "--ignore-scripts"],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    [packed] = JSON.parse(output) as PackResult[];
  }, 120_000);

  it("uses the exact release candidate version", () => {
    expect(manifest.version).toBe("0.1.0-rc.1");
  });

  it("names release candidate 0.1.0-rc.1 in the changelog", () => {
    expect(changelog).toMatch(/^##\s*\[0\.1\.0-rc\.1\]/mu);
  });

  it("keeps the changelog version aligned with the manifest", () => {
    expect(releaseCandidateHeading()).toBeDefined();
  });

  it("marks the release candidate heading as unreleased", () => {
    const heading = releaseCandidateHeading();
    expect(heading !== undefined && !/\d{4}-\d{2}-\d{2}/u.test(heading)).toBe(
      true,
    );
  });

  it("derives the tarball filename from package identity", () => {
    const packageSlug = manifest.name.replace(/^@/u, "").replace(/\//gu, "-");
    expect(packResult().filename).toBe(
      `${packageSlug}-${manifest.version}.tgz`,
    );
  });

  it("packs only files covered by the manifest allowlist", () => {
    const allowedEntries = manifest.files.map((entry) =>
      entry.replace(/\\/gu, "/").replace(/\/$/u, ""),
    );
    const extraEntries = packResult()
      .files.map(({ path }) => path.replace(/\\/gu, "/"))
      .filter(
        (path) =>
          path !== "package.json" &&
          !allowedEntries.some(
            (entry) => path === entry || path.startsWith(`${entry}/`),
          ),
      );
    expect(extraEntries).toEqual([]);
  });

  it("includes compiled JavaScript and declarations", () => {
    const paths = packResult().files.map(({ path }) =>
      path.replace(/\\/gu, "/"),
    );
    expect(paths).toContain("dist/index.js");
    expect(paths).toContain("dist/index.d.ts");
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
