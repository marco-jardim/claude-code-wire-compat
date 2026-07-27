// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const manifestPath = join(root, "test", "fixtures", "golden", "manifest.json");
const tracePath = join(root, "docs", "source-trace.md");

const SHA256_HEX = /\b[0-9a-f]{64}\b/gu;
const TEST_PATH = /`(test\/[^`\s]+\.test(?:-d)?\.ts)`/gu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The golden manifest is the source of truth; the trace document is not. */
function manifestFixtures(): ReadonlyMap<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!isRecord(parsed) || !isRecord(parsed.fixtures)) {
    throw new Error("golden manifest has no `fixtures` object");
  }

  const entries = new Map<string, string>();
  for (const [name, hash] of Object.entries(parsed.fixtures)) {
    if (typeof hash !== "string") {
      throw new Error(`golden manifest hash for ${name} is not a string`);
    }
    entries.set(name, hash);
  }
  return entries;
}

/**
 * Narrow the hash scan to the fixture-integrity table so unrelated digests
 * elsewhere in the document cannot satisfy or break this invariant.
 */
function fixtureIntegritySection(markdown: string): string {
  const start = markdown.indexOf("### Fixture integrity");
  if (start < 0) {
    throw new Error("docs/source-trace.md has no `### Fixture integrity`");
  }
  const rest = markdown.slice(start);
  const end = rest.search(/^## /mu);
  return end < 0 ? rest : rest.slice(0, end);
}

const fixtures = manifestFixtures();
const trace = readFileSync(tracePath, "utf8");
const section = fixtureIntegritySection(trace);

describe("source-trace fixture integrity", () => {
  it("has fixtures to enforce", () => {
    expect(fixtures.size).toBeGreaterThan(0);
  });

  it.each([...fixtures.entries()])(
    "documents %s and its manifest hash in docs/source-trace.md",
    (name, hash) => {
      expect(section).toContain(name);
      expect(section).toContain(hash);
    },
  );

  it("documents no SHA-256 the manifest no longer publishes", () => {
    const documented = section.match(SHA256_HEX) ?? [];
    const published = [...fixtures.values()];

    expect(documented.length).toBeGreaterThan(0);
    for (const hash of documented) {
      expect(published).toContain(hash);
    }
  });

  /*
   * The "Future package test" column is a set of claims about this repository,
   * and claims rot exactly the way the fixture hashes above rotted. Pin every
   * cited path to a file that actually exists so a rename cannot leave the
   * trace pointing at nothing.
   */
  it("cites only test files that exist", () => {
    const cited = [...new Set(trace.match(TEST_PATH) ?? [])].map((match) =>
      match.replaceAll("`", ""),
    );

    expect(cited.length).toBeGreaterThan(0);
    expect(cited.filter((path) => !existsSync(join(root, path)))).toEqual([]);
  });
});
