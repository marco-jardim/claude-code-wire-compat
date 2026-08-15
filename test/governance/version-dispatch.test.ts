// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

/*
 * Per-version behaviour dispatch lives in exactly one module.
 *
 * Three separate features of this wave — the request-derived token ceiling in
 * `thinking.ts`, the billing chain segments in `fingerprint.ts`, and the
 * `claude-opus-4-5` effort exception in `model-capabilities.ts` — each need to
 * know whether their profile behaves like upstream 2.1.195 or like 2.1.222+.
 * Each grew its own `profile.id === CLAUDE_CODE_2_1_195_PROFILE.id` comparison
 * as it landed. Three copies of one question is three places to forget when a
 * fourth profile arrives, and forgetting one is silent: the profile simply
 * takes the wrong branch and emits the wrong bytes.
 *
 * `src/profile-behaviors.ts` now owns the question. This file is what stops a
 * fourth copy appearing, because nothing else would: a new inline comparison
 * typechecks, lints, and passes every behavioural suite for the two profiles
 * that exist today.
 *
 * MENTION versus DISPATCH is the hard part here, exactly as it is in
 * `provider-scope.test.ts`, and the same technique answers it. Legitimate
 * reverse-engineering notes name versions constantly — `thinking.ts` and
 * `fingerprint.ts` both explain their branch by citing 2.1.222 in prose — so
 * the scan runs over COMMENT-STRIPPED source. What survives is code.
 *
 * `stripComments` and `sourceFiles` are replicated from that file rather than
 * shared, following the precedent set by `single-source-of-truth.test.ts`: a
 * governance suite that imports its scanner from another test can be disarmed
 * by editing that other test, and a helper shared between guards is a single
 * point of failure for both.
 */

const SRC_DIR = new URL("../../src/", import.meta.url);

/** The module permitted to dispatch on profile identity. */
const DISPATCH_MODULE = "profile-behaviors.ts";

/**
 * Upstream client versions this package has profiles for. A literal of one of
 * these in comment-stripped `src/` is what the version-literal scan looks for.
 */
const VERSION_LITERALS = ["2.1.195", "2.1.233"] as const;

/**
 * Files permitted to name a profile identity in code, with the reason.
 *
 * Every entry is ACCEPTANCE — deciding whether an object or string the CALLER
 * supplied is a profile this package supports — and never BEHAVIOUR — deciding
 * what bytes to emit for a profile already accepted. That distinction is the
 * whole of the rule: acceptance necessarily names what it accepts, behaviour
 * never has to.
 *
 * `redaction.ts` is the only entry, and the two other acceptance sites are
 * deliberately ABSENT rather than allowlisted. `build-request.ts`
 * (`ACCEPTED_PROFILES`, `DEFAULT_PROFILE`) and `headers.ts` (`parseProfile`)
 * both accept by OBJECT identity — `value === CLAUDE_CODE_2_1_195_PROFILE` —
 * which names no id and no version, so neither scan below sees them and
 * neither needs excusing. That is a property worth stating: object-identity
 * acceptance is invisible to this guard for the same reason it is the safer
 * spelling, since it rejects a structural clone. `redaction.ts` cannot use it,
 * and therefore is here.
 *
 * `no stale allowlist entry` below deletes the loophole of a justification
 * outliving the code it excuses — which is what would happen if the two files
 * named above were added "for completeness".
 */
const ACCEPTANCE_ALLOWLIST: ReadonlyMap<string, string> = new Map([
  [
    "redaction.ts",
    "Acceptance by id STRING. `PINNED_PROFILE_IDS` is a Set of the two " +
      "supported profile ids, membership-tested against an id read off an " +
      "untrusted object that may not be a real profile at all — so object " +
      "identity comparison is unavailable here and the literals are " +
      "unavoidable. It answers 'is this a profile we support', never 'what " +
      "does this profile do'.",
  ],
]);

/**
 * Replaces the contents of `//` and block comments with nothing, preserving
 * string and template literals verbatim.
 *
 * String literals must survive because a real dispatch can be spelled with one
 * (`profile.id === "claude-code-2.1.195-sdk-0.94.0"`). Comments must not
 * survive because that is precisely where the legitimate upstream notes live.
 */
function stripComments(text: string): string {
  let out = "";
  let index = 0;

  // `charAt` is used throughout rather than index access: it is typed `string`
  // and returns "" past the end, so every branch below narrows without a cast.
  while (index < text.length) {
    const char = text.charAt(index);
    const next = text.charAt(index + 1);

    if (char === '"' || char === "'" || char === "`") {
      out += char;
      index += 1;
      while (index < text.length) {
        const inner = text.charAt(index);
        if (inner === "\\") {
          out += text.slice(index, index + 2);
          index += 2;
          continue;
        }
        out += inner;
        index += 1;
        if (inner === char) break;
        // An unterminated quote cannot span a line; bail rather than eat the file.
        if (char !== "`" && inner === "\n") break;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < text.length && text.charAt(index) !== "\n") index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (
        index < text.length &&
        !(text.charAt(index) === "*" && text.charAt(index + 1) === "/")
      ) {
        index += 1;
      }
      index += 2;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

/**
 * Removes the module-specifier string of every `from "…"` clause.
 *
 * A profile module is NAMED after the client it transcribes, so every importer
 * of `./profiles/claude-code-2.1.195.js` carries that version in a string
 * literal that survives `stripComments`. A filename is not a decision: nothing
 * branches on it, and renaming the file to evade the scan would be pure
 * obfuscation. The version-literal scan below is about a version used as a
 * VALUE, so the specifiers come out first.
 *
 * Deliberately narrow — only the quoted specifier of a `from` clause is
 * removed, so a version literal anywhere else in the file still trips.
 */
function stripModuleSpecifiers(code: string): string {
  return code.replace(/\bfrom\s*(["'])(?:(?!\1).)*\1/g, "from ''");
}

function sourceFiles(directory: URL): readonly URL[] {
  const files: URL[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory())
      files.push(...sourceFiles(new URL(`${entry.name}/`, directory)));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(url);
  }
  return files;
}

interface SourceFile {
  readonly path: string;
  readonly raw: string;
  /** Comment-stripped source: what the file actually executes. */
  readonly code: string;
  /** `code` with module specifiers blanked: what the file actually decides on. */
  readonly values: string;
}

const SOURCES: readonly SourceFile[] = sourceFiles(SRC_DIR).map((url) => {
  const raw = readFileSync(url, "utf8");
  const code = stripComments(raw);
  return {
    path: url.href.slice(SRC_DIR.href.length),
    raw,
    code,
    values: stripModuleSpecifiers(code),
  };
});

/**
 * `.id ===` / `.id !==` against a profile singleton's `.id`, or against a
 * string literal carrying a profile id. Both spellings of the same dispatch.
 */
const ID_COMPARISON =
  /\.id\s*(?:===|!==)\s*(?:[A-Za-z_$][\w$]*\.id\b|["'`][^"'`]*\bclaude-code-[^"'`]*["'`])/g;

/** The reverse operand order: `X.id === profile.id`. */
const ID_COMPARISON_REVERSED =
  /[A-Za-z_$][\w$]*\.id\s*(?:===|!==)\s*[A-Za-z_$][\w$]*\.id\b/g;

function matches(pattern: RegExp, text: string): readonly string[] {
  return [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map(
    (match) => match[0],
  );
}

describe("anti-vacuity: the dispatch module is real", () => {
  it("exists in src/", () => {
    expect(SOURCES.map((file) => file.path)).toContain(DISPATCH_MODULE);
  });

  it("contains the demarcated identity comparison", () => {
    const module = SOURCES.find((file) => file.path === DISPATCH_MODULE);
    expect(module).toBeDefined();
    expect(
      matches(ID_COMPARISON, module?.code ?? "").length +
        matches(ID_COMPARISON_REVERSED, module?.code ?? "").length,
    ).toBeGreaterThan(0);
  });

  it("demarcates that comparison in prose", () => {
    const module = SOURCES.find((file) => file.path === DISPATCH_MODULE);
    expect(module?.raw).toContain("---- Demarcated:");
  });

  it("scans a plausible number of source files", () => {
    // Guards against a broken readdir silently making every assertion vacuous.
    expect(SOURCES.length).toBeGreaterThan(10);
  });

  it("would catch a comparison if one existed (regex self-test)", () => {
    expect(
      matches(ID_COMPARISON, "if (profile.id === OTHER_PROFILE.id) {}").length,
    ).toBe(1);
    expect(
      matches(
        ID_COMPARISON,
        'if (p.id !== "claude-code-2.1.195-sdk-0.94.0") {}',
      ).length,
    ).toBe(1);
    expect(
      matches(ID_COMPARISON, "if (profile.id === undefined) {}").length,
    ).toBe(0);
  });
});

describe("profile identity is compared in exactly one module", () => {
  for (const file of SOURCES) {
    if (file.path === DISPATCH_MODULE) continue;

    it(`${file.path} does not dispatch on profile identity`, () => {
      const found = [
        ...matches(ID_COMPARISON, file.code),
        ...matches(ID_COMPARISON_REVERSED, file.code),
      ];
      const excuse = ACCEPTANCE_ALLOWLIST.get(file.path);
      if (excuse !== undefined && found.length > 0) {
        expect(excuse.length).toBeGreaterThan(80);
        return;
      }
      if (found.length > 0) {
        // Thrown rather than passed to `expect` as a message: `valid-expect`
        // permits one argument only, and a bare `toEqual([])` failure would
        // name the file without saying what to do about it.
        throw new Error(
          `src/${file.path} compares profile identity outside ` +
            `src/${DISPATCH_MODULE} (${found.join(", ")}). Behaviour that ` +
            `differs per profile belongs in a named flag on ` +
            `ClaudeCodeProfileBehaviors, not in an inline identity ` +
            `comparison. If this is acceptance rather than behaviour, add a ` +
            `justified entry to ACCEPTANCE_ALLOWLIST.`,
        );
      }
      expect(found).toEqual([]);
    });
  }
});

describe("version literals do not gate code", () => {
  for (const file of SOURCES) {
    if (file.path === DISPATCH_MODULE) continue;
    // Profile modules are the transcription of a specific client version; the
    // version literal IS their payload, and they contain no branches.
    if (file.path.startsWith("profiles/")) continue;

    it(`${file.path} carries no version literal in code`, () => {
      const found = VERSION_LITERALS.filter((version) =>
        file.values.includes(version),
      );
      const excuse = ACCEPTANCE_ALLOWLIST.get(file.path);
      if (excuse !== undefined && found.length > 0) return;
      if (found.length > 0) {
        throw new Error(
          `src/${file.path} carries an upstream version literal in code ` +
            `rather than in a comment (${found.join(", ")}). Version-shaped ` +
            `decisions belong in src/${DISPATCH_MODULE}.`,
        );
      }
      expect(found).toEqual([]);
    });
  }

  it("finds the literals it looks for somewhere, so the scan is not vacuous", () => {
    const anywhere = SOURCES.filter((file) =>
      VERSION_LITERALS.some((version) => file.values.includes(version)),
    );
    expect(anywhere.map((file) => file.path)).toContain("redaction.ts");
  });

  it("still sees module specifiers, so stripping them is not over-broad", () => {
    // If `stripModuleSpecifiers` ever blanked more than the specifier, the
    // scan above would go quiet everywhere. Prove the raw code still has them.
    const importers = SOURCES.filter((file) =>
      VERSION_LITERALS.some((version) => file.code.includes(version)),
    );
    expect(importers.length).toBeGreaterThan(3);
  });
});

describe("no stale allowlist entry", () => {
  for (const [path, excuse] of ACCEPTANCE_ALLOWLIST) {
    it(`${path} still needs its exemption`, () => {
      const file = SOURCES.find((candidate) => candidate.path === path);
      if (file === undefined) {
        throw new Error(`src/${path} is allowlisted but does not exist`);
      }
      const found = [
        ...matches(ID_COMPARISON, file.code),
        ...matches(ID_COMPARISON_REVERSED, file.code),
        ...VERSION_LITERALS.filter((version) => file.values.includes(version)),
      ];
      if (found.length === 0) {
        throw new Error(
          `src/${path} no longer matches anything the guard forbids. Delete ` +
            `its ACCEPTANCE_ALLOWLIST entry rather than leaving a ` +
            `justification for code that is gone.`,
        );
      }
      expect(found).not.toEqual([]);
      expect(excuse).toMatch(/[Aa]cceptance/);
    });
  }
});
