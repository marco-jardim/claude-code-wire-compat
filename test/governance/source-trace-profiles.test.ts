// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const profilesDir = join(root, "src", "profiles");
const tracePath = join(root, "docs", "source-trace.md");

/** `claude-code-<cli>-sdk-<sdk>` as written in both the module and the trace. */
const PROFILE_ID = /claude-code-(\d+\.\d+\.\d+)-sdk-\d+\.\d+\.\d+/gu;
const MODULE_ID = /\bid:\s*"([^"]+)"/u;
const ANALYSIS_DOC =
  /`(docs\/protocol\/versions\/claude-code-[^`\s]+-analysis\.md)`/gu;

/**
 * Narrow both scans to the profile registry so an id or an analysis path
 * mentioned elsewhere in the document cannot satisfy either invariant.
 *
 * `### Fixture integrity` is parsed the same way by
 * `source-trace-integrity.test.ts`; the two sections are disjoint and neither
 * helper may widen past the next `## ` heading.
 */
function profileSection(markdown: string): string {
  const heading = "## Pinned profile";
  const start = markdown.indexOf(heading);
  if (start < 0) {
    throw new Error("docs/source-trace.md has no `## Pinned profile`");
  }
  const rest = markdown.slice(start + heading.length);
  const end = rest.search(/^## /mu);
  return end < 0 ? rest : rest.slice(0, end);
}

interface ProfileModules {
  /** Protocol profiles, by filename, with the id each declares. */
  readonly ids: ReadonlyMap<string, string>;
  /**
   * Files outside the `claude-code-` prefix that declare an `id` anyway. A
   * protocol profile shipped under a non-conforming filename would land here,
   * and `declares every profile under the conforming name` fails on it.
   */
  readonly misnamed: readonly string[];
}

/**
 * Profile modules, discovered by readdir rather than named.
 *
 * `src/profiles/` holds two kinds of file. A protocol profile is
 * `claude-code-<version>.ts` and declares an `id`; a versioned registry
 * artifact is `beta-registry-<version>.ts` and is transcribed upstream data
 * with no id to declare. Requiring an `id` of the second kind would demand a
 * field the artifact cannot honestly have.
 *
 * The prefix is not taken on trust: a file that skips the prefix but declares
 * an `id` is recorded as `misnamed` and fails below, so renaming a profile is
 * not a way around direction A.
 */
function profileModules(): ProfileModules {
  const ids = new Map<string, string>();
  const misnamed: string[] = [];
  for (const entry of readdirSync(profilesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }
    if (entry.name === "index.ts" || entry.name.endsWith(".test.ts")) {
      continue;
    }
    const source = readFileSync(join(profilesDir, entry.name), "utf8");
    const id = MODULE_ID.exec(source)?.[1];
    if (!entry.name.startsWith("claude-code-")) {
      if (id !== undefined) misnamed.push(entry.name);
      continue;
    }
    if (id === undefined) {
      throw new Error(`src/profiles/${entry.name} declares no \`id\``);
    }
    ids.set(entry.name, id);
  }
  return { ids, misnamed };
}

const trace = readFileSync(tracePath, "utf8");
const section = profileSection(trace);
const { ids: modules, misnamed } = profileModules();
const registeredIds = [...new Set(section.match(PROFILE_ID) ?? [])];
const citedDocs = [...new Set(section.match(ANALYSIS_DOC) ?? [])].map((match) =>
  match.replaceAll("`", ""),
);

describe("source-trace profile registry", () => {
  it("has profile modules to enforce", () => {
    expect(modules.size).toBeGreaterThan(0);
  });

  it("has registered profile entries to enforce", () => {
    expect(registeredIds.length).toBeGreaterThan(0);
  });

  it("declares every profile under the conforming name", () => {
    expect(misnamed).toEqual([]);
  });

  /*
   * Direction A, strict: a profile module that nobody wrote down is a profile
   * nobody reviewed. Every shipped module must appear in the registry.
   */
  it.each([...modules.entries()])(
    "registers the profile id declared by src/profiles/%s",
    (_name, id) => {
      expect(section).toContain(id);
    },
  );

  /*
   * Direction B, deliberately anchored in the analysis document rather than in
   * `src/profiles/`. The inverse of direction A — "every registered entry has a
   * module" — would be the obvious symmetry and it is the wrong invariant: a
   * trace entry is allowed to precede its TypeScript module by one phase, and
   * the 2.1.233 entry does exactly that. What must never be absent is the
   * evidence, so the anchor is the analysis doc, which exists for an entry from
   * the moment the entry is written.
   */
  it.each(registeredIds)("anchors %s in an analysis document", (id) => {
    const version = new RegExp(PROFILE_ID.source, "u").exec(id)?.[1];
    expect(version).toBeDefined();

    const doc = `docs/protocol/versions/claude-code-${version ?? ""}-analysis.md`;
    expect(citedDocs).toContain(doc);
    expect(existsSync(join(root, doc))).toBe(true);
  });
});
