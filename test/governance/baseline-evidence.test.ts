// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const baselinePath = join(root, "docs", "plans", "baseline-2026-08-05.md");
const goldenDir = join(root, "test", "fixtures", "golden");

const COMMIT_LINE = /^- \*\*Commit:\*\* `([^`]*)`$/mu;
const SHA1_HEX = /^[0-9a-f]{40}$/u;
const SHA256_HEX = /^[0-9a-f]{64}$/u;

/**
 * The evidence document is only worth anything if it still describes the tree.
 * Everything below reads the document as data, never as prose.
 */
function baselineMarkdown(): string {
  if (!existsSync(baselinePath)) {
    throw new Error(`baseline evidence document is missing: ${baselinePath}`);
  }
  return readFileSync(baselinePath, "utf8");
}

/**
 * Scope the table scan to the `## Golden fixture hashes` section and stop at
 * the next heading of any level, so the neighbouring coherence table (same
 * leading column, different second column) cannot be parsed as fixture hashes.
 */
function goldenHashSection(markdown: string): string {
  const heading = "## Golden fixture hashes";
  const start = markdown.indexOf(heading);
  if (start < 0) {
    throw new Error(
      `docs/plans/baseline-2026-08-05.md has no \`${heading}\` heading`,
    );
  }
  const rest = markdown.slice(start + heading.length);
  const end = rest.search(/^#{1,6} /mu);
  return end < 0 ? rest : rest.slice(0, end);
}

/** Prettier pads markdown table cells, so every cell is trimmed. */
function parseHashTable(section: string): ReadonlyMap<string, string> {
  const rows = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .replace(/^\|/u, "")
        .replace(/\|$/u, "")
        .split("|")
        .map((cell) => cell.trim()),
    );

  const entries = new Map<string, string>();
  for (const cells of rows) {
    const [file, sha256] = cells;
    if (file === undefined || sha256 === undefined || cells.length !== 2) {
      throw new Error(
        `golden fixture table row is not two columns: ${cells.join(" | ")}`,
      );
    }
    if (file === "file" && sha256 === "sha256") {
      continue;
    }
    if (/^-+$/u.test(file) && /^-+$/u.test(sha256)) {
      continue;
    }
    if (entries.has(file)) {
      throw new Error(`golden fixture table lists ${file} more than once`);
    }
    entries.set(file, sha256);
  }
  return entries;
}

function sha256OfFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const markdown = baselineMarkdown();
const documented = parseHashTable(goldenHashSection(markdown));
const onDisk = readdirSync(goldenDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();

describe("baseline evidence integrity", () => {
  it("publishes the baseline evidence document", () => {
    expect(existsSync(baselinePath)).toBe(true);
  });

  it("records a well-formed commit SHA-1", () => {
    const match = COMMIT_LINE.exec(markdown);
    expect(
      match,
      "docs/plans/baseline-2026-08-05.md has no `- **Commit:** `<sha>`` line",
    ).not.toBeNull();

    const sha = match?.[1] ?? "";
    expect(
      SHA1_HEX.test(sha),
      `baseline commit \`${sha}\` is not a 40-character lowercase hex SHA-1`,
    ).toBe(true);
  });

  it("has fixture hashes to enforce", () => {
    expect(documented.size).toBeGreaterThan(0);
    expect(onDisk.length).toBeGreaterThan(0);
  });

  it.each([...documented.entries()])(
    "matches the recorded SHA-256 of %s",
    (file, hash) => {
      expect(
        SHA256_HEX.test(hash),
        `recorded hash for ${file} is not a 64-character lowercase hex SHA-256: \`${hash}\``,
      ).toBe(true);

      const path = join(goldenDir, file);
      expect(
        existsSync(path),
        `baseline lists ${file} but test/fixtures/golden/${file} does not exist`,
      ).toBe(true);

      const actual = sha256OfFile(path);
      expect(
        actual,
        `test/fixtures/golden/${file} hashes to ${actual}, baseline records ${hash}`,
      ).toBe(hash);
    },
  );

  /*
   * The reverse direction: a fixture added after the snapshot would otherwise
   * slip past the per-row checks above, leaving the evidence silently partial.
   */
  it("records every file present in test/fixtures/golden/", () => {
    const undocumented = onDisk.filter((file) => !documented.has(file));
    expect(
      undocumented,
      `test/fixtures/golden/ files missing from the baseline table: ${undocumented.join(", ")}`,
    ).toEqual([]);
  });

  it("records no file absent from test/fixtures/golden/", () => {
    const stale = [...documented.keys()].filter(
      (file) => !onDisk.includes(file),
    );
    expect(
      stale,
      `baseline table lists files that no longer exist: ${stale.join(", ")}`,
    ).toEqual([]);
  });
});
