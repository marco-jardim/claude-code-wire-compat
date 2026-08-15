// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/*
 * Since T1.1.2, `src/model-capabilities.ts` has ONE source of truth for the
 * six catalogue-backed capabilities: the profile catalogue, read in one place
 * by `deriveCapabilitiesFromCatalogue`. The per-model knowledge that remains
 * in code is confined to two demarcated zones:
 *
 *   1. The ported upstream predicates (`Kw`, `Hke`, `Yte`, ...), which are the
 *      fallback for ids with no catalogue entry.
 *   2. The single C1 exception in `deriveCapabilities`, where the 2.1.195
 *      catalogue disagrees with the binary that shipped it
 *      (docs/plans/BLOCKERS.md).
 *
 * Nothing else in that module may know a model id by name. The failure mode
 * this file exists to prevent is quiet re-duplication: someone adds
 * `if (normalizedId === "claude-opus-4-9") ...` to a helper, or a
 * `{ "claude-opus-4-9": { effort: true } }` lookup table, and the catalogue
 * silently stops being authoritative for that row. Types cannot catch it and
 * `capability-equivalence.test.ts` cannot either -- a duplicated table that
 * happens to agree with the catalogue today passes every behavioural test and
 * diverges on the next profile bump.
 *
 * The scan therefore runs over COMMENT-STRIPPED source. Comments in that
 * module quote upstream ids verbatim (`JB(id, "effort") || id ===
 * "claude-mythos-5"`) and must stay; a naive text scan would fail on them.
 */

const TARGET = new URL("../../src/model-capabilities.ts", import.meta.url);

/**
 * Model-id string literals as they appear in code. Matches the family-prefix
 * form (`"claude-3-"`) as well as full ids (`"claude-opus-4-5"`).
 */
const MODEL_ID_LITERAL = /"claude-[a-z0-9.-]*"/gu;

/**
 * The two demarcated zones, by the declaration that carries them. Every entry
 * is a function permitted to name model ids, with a mandatory justification.
 * `no stale zone entry` below deletes the loophole of a justification
 * outliving its code: an entry naming a function that no longer exists fails
 * the suite, so this list cannot rot into a blanket permit.
 */
const ID_ZONES: ReadonlyMap<string, string> = new Map([
  [
    "supportsEffort",
    "Ported upstream predicate `Kw`. Exclusion list, fallback path.",
  ],
  [
    "supportsMaxEffort",
    "Ported upstream predicate `Hke`. Exclusion list, fallback path.",
  ],
  [
    "supportsXhighEffort",
    "Ported upstream predicate `Yte`. Exclusion list, fallback path.",
  ],
  [
    "supportsAdaptiveThinking",
    "Ported upstream predicate `Uot`. Exclusion list, fallback path.",
  ],
  [
    "supportsThinking",
    "Ported upstream predicate `D9r`. Family-prefix test, fallback path.",
  ],
  [
    "supportsInterleavedThinking",
    "Ported upstream predicate `QOt`. Family-prefix test, fallback path.",
  ],
  [
    "supportsContextManagement",
    "Ported upstream predicate `n0d`. Family-prefix test, fallback path.",
  ],
  [
    "supportsStructuredOutputs",
    "Ported upstream predicate `j4e`. Beta-only gate with no catalogue " +
      "string, so it has no catalogue path to move to.",
  ],
  [
    "supportsMidConversationSystem",
    "Ported upstream predicate `RCn`. Beta-only gate consumed by `betas.ts` " +
      "by id; deliberately left predicate-derived by T1.1.2.",
  ],
  [
    "supportsTemperature",
    "Ported upstream predicate `LCn`. ALLOWLIST polarity, fallback path.",
  ],
  [
    "rejectsDisabledThinking",
    "Ported upstream predicate `U4e`. Exclusion list, fallback path.",
  ],
  [
    "deriveCapabilities",
    "Carries the single demarcated C1 exception (docs/plans/BLOCKERS.md): " +
      "`claude-opus-4-5` takes `effort` from the wire-authoritative " +
      "predicate rather than from the 2.1.195 catalogue.",
  ],
]);

/** The only model id the C1 exception may name. */
const C1_ID = '"claude-opus-4-5"';

/** Declarations that must exist for the two zones to be meaningful. */
const REQUIRED_DECLARATIONS = [
  "deriveCapabilitiesFromCatalogue",
  "deriveCapabilitiesFromPredicates",
  "deriveCapabilities",
] as const;

/**
 * Verbatim upstream capability strings. Each must appear exactly once in
 * code: a second occurrence is a second mapping table, which is the
 * duplication this file forbids.
 */
const CATALOGUE_CAPABILITY_STRINGS = [
  "effort",
  "max_effort",
  "xhigh_effort",
  "adaptive_thinking",
  "context_management",
  "rejects_disabled_thinking",
] as const;

/**
 * Replaces the contents of `//` and block comments with nothing, preserving
 * string and template literals verbatim.
 *
 * String literals must survive because a real per-model branch is spelled
 * with one. Comments must not survive because that is precisely where the
 * legitimate upstream notes quoting ids live.
 */
function stripComments(text: string): string {
  let out = "";
  let index = 0;

  while (index < text.length) {
    const char = text.charAt(index);
    const next = text.charAt(index + 1);

    if (char === '"' || char === "'" || char === "`") {
      out += char;
      index += 1;
      while (index < text.length) {
        const inner = text.charAt(index);
        out += inner;
        index += 1;
        if (inner === "\\") {
          out += text.charAt(index);
          index += 1;
          continue;
        }
        if (inner === char) break;
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
        // Newlines are preserved so line-oriented scanning stays aligned.
        if (text.charAt(index) === "\n") out += "\n";
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

function readTarget(): string {
  const path = fileURLToPath(TARGET);
  if (!existsSync(path)) {
    throw new Error(
      `single-source-of-truth guard cannot run: ${path} does not exist. ` +
        "If the module moved, move this guard with it -- do not delete it.",
    );
  }
  return readFileSync(path, "utf8");
}

/**
 * Splits comment-stripped source into top-level function bodies plus the
 * module-level remainder. Relies on the repo's Prettier formatting: top-level
 * declarations start at column zero and close with a `}` at column zero.
 */
function partition(code: string): {
  readonly functions: ReadonlyMap<string, string>;
  readonly moduleLevel: string;
} {
  const functions = new Map<string, string>();
  const moduleLevel: string[] = [];
  let openName: string | undefined;
  let body: string[] = [];

  for (const line of code.split("\n")) {
    if (openName === undefined) {
      const name = /^(?:export\s+)?function\s+(\w+)\s*\(/u.exec(line)?.[1];
      if (name === undefined) {
        moduleLevel.push(line);
        continue;
      }
      openName = name;
      body = [line];
      continue;
    }

    body.push(line);
    if (line === "}") {
      functions.set(openName, body.join("\n"));
      openName = undefined;
      body = [];
    }
  }

  if (openName !== undefined) {
    throw new Error(
      `single-source-of-truth guard could not find the end of \`${openName}\`. ` +
        "Top-level declarations must close with a `}` at column zero.",
    );
  }

  return { functions, moduleLevel: moduleLevel.join("\n") };
}

function modelIdsIn(text: string): readonly string[] {
  return text.match(MODEL_ID_LITERAL) ?? [];
}

/**
 * Removes the two id-comparison shapes the ported predicates are allowed to
 * use. Whatever model id survives this is a table, a map key, or some other
 * shape that duplicates catalogue knowledge.
 */
function stripPermittedComparisons(text: string): string {
  return text
    .replaceAll(/normalizedId\s*===\s*"claude-[a-z0-9.-]*"/gu, "")
    .replaceAll(/normalizedId\.includes\("claude-[a-z0-9.-]*"\)/gu, "");
}

const raw = readTarget();
const code = stripComments(raw);
const { functions, moduleLevel } = partition(code);

describe("model capabilities: one source of truth per capability", () => {
  it("finds the module and its demarcated declarations", () => {
    expect(raw.length).toBeGreaterThan(0);
    for (const name of REQUIRED_DECLARATIONS) {
      expect(functions.has(name)).toBe(true);
    }
  });

  it("keeps the C1 exception demarcated and traceable", () => {
    // The exception is only legitimate while it cites its finding.
    expect(raw).toContain("docs/plans/BLOCKERS.md");
    expect(raw).toContain("C1");
  });

  it("no stale zone entry", () => {
    for (const name of ID_ZONES.keys()) {
      expect(functions.has(name)).toBe(true);
    }
  });

  it("names no model id outside a function", () => {
    expect(modelIdsIn(moduleLevel)).toEqual([]);
  });

  it("names no model id outside the demarcated zones", () => {
    const offenders = new Map<string, readonly string[]>();
    for (const [name, body] of functions) {
      if (ID_ZONES.has(name)) continue;
      const ids = modelIdsIn(body);
      if (ids.length > 0) offenders.set(name, ids);
    }

    expect(Object.fromEntries(offenders)).toEqual({});
  });

  it("restricts the predicate zone to id comparisons, never tables", () => {
    for (const [name, body] of functions) {
      if (!ID_ZONES.has(name) || name === "deriveCapabilities") continue;
      expect({
        name,
        residual: modelIdsIn(stripPermittedComparisons(body)),
      }).toEqual({ name, residual: [] });
    }
  });

  it("restricts the C1 zone to exactly one id", () => {
    const body = functions.get("deriveCapabilities") ?? "";
    expect(modelIdsIn(body)).toEqual([C1_ID]);
    expect(body).toMatch(/normalizedId\s*===\s*"claude-opus-4-5"/u);
    expect(modelIdsIn(stripPermittedComparisons(body))).toEqual([]);
  });

  it("maps each catalogue capability string exactly once", () => {
    for (const capability of CATALOGUE_CAPABILITY_STRINGS) {
      const occurrences =
        code.match(new RegExp(`"${capability}"`, "gu"))?.length ?? 0;
      expect({ capability, occurrences }).toEqual({
        capability,
        occurrences: 1,
      });
    }
  });

  it("reads the catalogue in exactly one place", () => {
    const readers = [...functions]
      // The lookbehind rejects the object spread `...capabilities`, which is
      // not a catalogue read.
      .filter(([, body]) => /(?<!\.)\.capabilities\b/u.test(body))
      .map(([name]) => name);

    expect(readers).toEqual(["deriveCapabilitiesFromCatalogue"]);
  });
});
