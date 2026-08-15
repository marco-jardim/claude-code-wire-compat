// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Per-profile coverage floor.
 *
 * A new pinned profile must never be born half-tested. Registering an entry in
 * `PROFILES_UNDER_TEST` is cheap; the risk is that the registration lands while
 * the evidence behind it does not. This suite is the net for that failure mode,
 * with two independent mechanisms:
 *
 *  1. Structural fan-out — every suite listed in `PARAMETRISED_SUITES` must go
 *     through `describeEachProfile`, so a newly registered profile multiplies
 *     those suites automatically instead of requiring each file to be edited.
 *     A suite that stops using the harness (or is deleted/renamed) fails here.
 *  2. Fixture coverage — every registered profile must own at least one golden
 *     wire fixture carrying its `profileId`. A profile registered without
 *     captured evidence fails here by name.
 *
 * DOCUMENTED DEVIATION FROM THE PLAN: the `thinking` and `metadata` areas are
 * deliberately NOT part of this phase's minimum floor. Their suites are
 * profile-agnostic today — they exercise pure algorithms with no profile seam
 * to parametrise over, so forcing `describeEachProfile` on them would add
 * ceremony without adding coverage. They join the floor in Wave 1, when token
 * limits become catalogue-driven and therefore profile-dependent.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PROFILES_UNDER_TEST } from "../support/profile-matrix.js";

const validationDirectory = join(process.cwd(), "test", "validation");
const goldenDirectory = join(process.cwd(), "test", "fixtures", "golden");

/**
 * The suites that must hold for EVERY registered profile.
 *
 * Maintained by hand rather than discovered, so that dropping a suite from the
 * floor is a visible, reviewable edit instead of a silent consequence of a
 * rename. Adding a profile-dependent suite means adding it here.
 */
const PARAMETRISED_SUITES: readonly string[] = [
  "headers.test.ts", // Canonical header composition per profile.
  "betas.test.ts", // Beta registry composition per profile.
  "header-mutants.test.ts", // Header helper branch mutants per profile.
  "model-wire-identity.test.ts", // Wire-level model identity per profile.
  "model-identity.test.ts", // Model-identity port per profile.
  "request-body-mutants.test.ts", // Canonical body internals mutants per profile.
  "redaction-mutants.test.ts", // Redaction helper mutants per profile.
  "build-request-mutants.test.ts", // Request-builder mutants per profile.
];

/** Matches an import of the harness regardless of the relative prefix used. */
const HARNESS_IMPORT =
  /import\s*\{[^}]*\bdescribeEachProfile\b[^}]*\}\s*from\s+["'][^"']*support\/profile-matrix\.js["']/u;
/** Matches an actual call site, not merely the import. */
const HARNESS_INVOCATION = /\bdescribeEachProfile\s*\(/u;

function readSuite(name: string): string {
  const path = join(validationDirectory, name);

  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `Parametrised suite "${name}" is declared in PARAMETRISED_SUITES but ` +
        `does not exist at ${path}. Either restore the suite or remove it ` +
        `from the coverage floor — a declared-but-missing suite means the ` +
        `floor silently stopped covering that area.`,
    );
  }
}

/** Every `profileId` claimed by a golden wire fixture. */
function collectFixtureProfileIds(): ReadonlyMap<string, readonly string[]> {
  const byProfile = new Map<string, string[]>();

  for (const name of readdirSync(goldenDirectory).sort()) {
    if (!name.endsWith(".json")) {
      continue;
    }

    const parsed: unknown = JSON.parse(
      readFileSync(join(goldenDirectory, name), "utf8"),
    );

    if (typeof parsed !== "object" || parsed === null) {
      continue;
    }

    // `manifest.json` carries no `profileId`: it is the manifest over the
    // fixtures, not a captured wire sample. Skipping by shape rather than by
    // filename keeps the check honest if the manifest is ever renamed.
    const profileId = (parsed as { profileId?: unknown }).profileId;

    if (typeof profileId !== "string" || profileId.length === 0) {
      continue;
    }

    const existing = byProfile.get(profileId);

    if (existing === undefined) {
      byProfile.set(profileId, [name]);
    } else {
      existing.push(name);
    }
  }

  return byProfile;
}

describe("profile coverage floor", () => {
  describe("registry integrity", () => {
    it("registers at least one profile", () => {
      // The harness throws on an empty registry at import time; this pins the
      // post-condition so a future relaxation of the harness is caught here.
      expect(PROFILES_UNDER_TEST.length).toBeGreaterThan(0);
    });

    it("registers each profile id exactly once", () => {
      const ids = PROFILES_UNDER_TEST.map((entry) => entry.id);

      expect([...new Set(ids)].sort()).toStrictEqual([...ids].sort());
    });
  });

  describe("structural fan-out", () => {
    it.each(PARAMETRISED_SUITES)(
      "requires %s to import describeEachProfile from the profile matrix",
      (name) => {
        expect(readSuite(name)).toMatch(HARNESS_IMPORT);
      },
    );

    it.each(PARAMETRISED_SUITES)(
      "requires %s to invoke describeEachProfile",
      (name) => {
        expect(readSuite(name)).toMatch(HARNESS_INVOCATION);
      },
    );
  });

  describe("golden fixture coverage", () => {
    const fixturesByProfile = collectFixtureProfileIds();

    it("collects at least one profile-bearing golden fixture", () => {
      expect(fixturesByProfile.size).toBeGreaterThan(0);
    });

    it.each(PROFILES_UNDER_TEST.map((entry) => entry.id))(
      "requires profile %s to own at least one golden wire fixture",
      (id) => {
        const fixtures = fixturesByProfile.get(id) ?? [];
        // The diagnostic rides inside the asserted value: `expect` takes a
        // single argument under this repo's lint rules, so a failure has to
        // read out of the actual value rather than a custom message.
        const verdict =
          fixtures.length > 0
            ? `covered by ${fixtures.join(", ")}`
            : `UNCOVERED: profile "${id}" is registered in ` +
              `PROFILES_UNDER_TEST but no golden fixture in ` +
              `test/fixtures/golden declares profileId "${id}". Capture wire ` +
              `evidence for the profile before registering it, otherwise its ` +
              `parametrised suites assert against nothing real. Profiles ` +
              `with fixtures: ${[...fixturesByProfile.keys()].join(", ")}.`;

        expect(verdict).toMatch(/^covered by /u);
      },
    );
  });
});
