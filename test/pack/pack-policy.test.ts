// SPDX-License-Identifier: GPL-3.0-or-later

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface PackageManifest {
  files: string[];
}

interface PackFile {
  path: string;
}

interface PackResult {
  files: PackFile[];
}

const repositoryRoot = join(import.meta.dirname, "..", "..");
const expectedPublishedEntries = [
  "dist",
  "README.md",
  "LICENSE",
  "NOTICE",
  "CHANGELOG.md",
];

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

describe("published tarball policy", () => {
  it("contains only the declared public files and compiled output", () => {
    const manifest = JSON.parse(
      readFileSync(join(repositoryRoot, "package.json"), "utf8"),
    ) as PackageManifest;
    expect(new Set(manifest.files)).toEqual(new Set(expectedPublishedEntries));
    const packOutput = execFileSync(
      process.execPath,
      [npmCliPath(), "pack", "--dry-run", "--json", "--ignore-scripts"],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    const [packResult] = JSON.parse(packOutput) as PackResult[];
    expect(packResult).toBeDefined();

    const declaredEntries = manifest.files.map((entry) =>
      entry.replace(/\\/gu, "/").replace(/\/$/u, ""),
    );
    const allowedExactFiles = new Set([
      "package.json",
      ...declaredEntries.filter(
        (entry) => !entry.includes("/") && entry !== "dist",
      ),
    ]);
    const allowedDirectories = declaredEntries.filter(
      (entry) => entry === "dist" || entry.includes("/"),
    );
    const paths = packResult.files.map(({ path }) => path.replace(/\\/gu, "/"));

    expect(paths.length).toBeGreaterThan(0);
    expect(
      paths.filter(
        (path) =>
          !allowedExactFiles.has(path) &&
          !allowedDirectories.some((directory) =>
            path.startsWith(`${directory}/`),
          ),
      ),
    ).toEqual([]);
    expect(paths).toContain("dist/index.js");
    expect(paths).toContain("dist/index.d.ts");
    expect(
      paths.some((path) =>
        /^(?:src|test|scripts|\.github|\.com466-evidence)\//u.test(path),
      ),
    ).toBe(false);
    expect(paths.some((path) => /\.(?:test|spec)\./u.test(path))).toBe(false);
  });
});
