// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const runbookPath = join(root, "docs", "plans", "UPSTREAM-TRACKING-RUNBOOK.md");

/** Every backtick code span in the document, without the delimiters. */
const CODE_SPAN = /`([^`\n]+)`/gu;

/**
 * A repository-relative path: one of the tracked top-level directories, or one
 * of the tracked root files. Anything else in a code span is prose, a command,
 * or an identifier, and is not a citation.
 */
const REPO_PATH =
  /^(?:(?:src|test|scripts|docs|\.github)\/[\w./-]+|package\.json|README\.md|CHANGELOG\.md|LICENSE|NOTICE)$/u;

/**
 * Names for releases that do not exist yet are written with angle brackets,
 * such as `claude-code-<version>.ts`. They are templates, not citations, and
 * must never be resolved against the filesystem.
 */
const isPlaceholder = (value: string): boolean =>
  value.includes("<") || value.includes(">");

export const citedPaths = (contents: string): readonly string[] =>
  [
    ...new Set(
      [...contents.matchAll(CODE_SPAN)]
        .map((match) => match[1].trim())
        .filter((value) => !isPlaceholder(value))
        .filter((value) => REPO_PATH.test(value)),
    ),
  ].sort();

const contents = existsSync(runbookPath)
  ? readFileSync(runbookPath, "utf8")
  : "";
const paths = citedPaths(contents);

describe("upstream tracking runbook citations", () => {
  it("publishes the runbook", () => {
    expect(existsSync(runbookPath)).toBe(true);
  });

  it("cites enough of the repository to be a usable procedure", () => {
    // Anti-vacuity: a runbook that cites nothing would pass the existence
    // check below trivially. The gate checklist alone names far more files
    // than this floor, so the floor only catches wholesale gutting.
    expect(paths.length).toBeGreaterThanOrEqual(15);
  });

  it.each(paths)("cites %s, which exists in the repository", (path) => {
    expect(existsSync(join(root, path))).toBe(true);
  });

  it.each([
    "src/profiles/claude-code-<version>.ts",
    "src/profiles/beta-registry-<version>.ts",
    "docs/protocol/versions/claude-code-<version>-analysis.md",
    "./profiles/claude-code-<version>",
  ])("treats %s as a placeholder rather than a path", (value) => {
    expect(citedPaths(`a \`${value}\` b`)).toEqual([]);
  });

  it.each([
    "npm run extract:profile -- --dump",
    "DEFAULT_PROFILE",
    "ACCEPTED_PROFILES",
    "slice(0, 3)",
    "59cf53e54c78",
    "0x20",
    "win32-x64",
  ])("does not mistake %s for a path", (value) => {
    expect(citedPaths(`a \`${value}\` b`)).toEqual([]);
  });

  it.each([
    "src/build-request.ts",
    "test/support/profile-matrix.ts",
    "scripts/extract-upstream-profile.mjs",
    "docs/source-trace.md",
    "package.json",
    ".github/workflows/ci.yml",
  ])("recognises %s as a citation", (value) => {
    expect(citedPaths(`a \`${value}\` b`)).toEqual([value]);
  });
});
