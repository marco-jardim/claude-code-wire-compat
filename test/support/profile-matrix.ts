// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Profile parametrisation harness for the multi-profile migration.
 *
 * A suite that must hold for EVERY pinned protocol profile registers itself
 * through `describeEachProfile` instead of hard-coding one profile import. As
 * further profiles land they are appended to `PROFILES_UNDER_TEST` and every
 * parametrised suite covers them without being edited.
 *
 * The registry carries the expected counts alongside each profile so a suite
 * can assert catalogue size without duplicating the catalogue itself.
 */

import { describe } from "vitest";

import type { ClaudeCodeProtocolProfile } from "../../src/contracts.js";
import { BETA_REGISTRY } from "../../src/beta-registry.js";
import { BETA_REGISTRY_2_1_233 } from "../../src/profiles/beta-registry-2.1.233.js";
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
} from "../../src/index.js";

/** One pinned profile, plus the metadata a parametrised suite asserts on. */
export interface ProfileUnderTest {
  readonly profile: ClaudeCodeProtocolProfile;
  readonly id: string;
  readonly cliVersion: string;
  readonly sdkVersion: string;
  readonly endpoint: ClaudeCodeProtocolProfile["endpoint"];
  readonly userAgent: string;
  /**
   * Size of the beta registry the profile draws from. This is NOT
   * profile-invariant: 2.1.195 draws from the shared `BETA_REGISTRY` module
   * while 2.1.233 pins its own `BETA_REGISTRY_2_1_233`. A suite asserting on
   * registry size must read it from the entry rather than importing a registry
   * directly.
   */
  readonly expectedBetaCount: number;
  /** Number of keys in the profile's `supportedModels` catalogue. */
  readonly expectedModelCount: number;
}

/**
 * Validate a candidate registry.
 *
 * Exported so the harness's own test can exercise both guards without
 * mutating the real registry. Throws rather than returning a verdict, because
 * every caller treats a malformed registry as unrecoverable.
 */
export function assertValidProfileRegistry(
  entries: readonly ProfileUnderTest[],
): void {
  if (entries.length === 0) {
    throw new Error(
      "PROFILES_UNDER_TEST is empty: a parametrised suite would silently " +
        "register zero tests and pass without asserting anything.",
    );
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(
        `PROFILES_UNDER_TEST contains a duplicate profile id: "${entry.id}".`,
      );
    }
    seen.add(entry.id);
  }
}

function entryFor(
  profile: ClaudeCodeProtocolProfile,
  betaRegistry: Readonly<Record<string, unknown>>,
): ProfileUnderTest {
  return {
    profile,
    id: profile.id,
    cliVersion: profile.cliVersion,
    sdkVersion: profile.sdkVersion,
    endpoint: profile.endpoint,
    userAgent: profile.userAgent,
    expectedBetaCount: Object.keys(betaRegistry).length,
    expectedModelCount: Object.keys(profile.supportedModels).length,
  };
}

/** Every profile a parametrised suite must hold for. */
export const PROFILES_UNDER_TEST: readonly ProfileUnderTest[] = Object.freeze([
  entryFor(CLAUDE_CODE_2_1_195_PROFILE, BETA_REGISTRY),
  entryFor(CLAUDE_CODE_2_1_233_PROFILE, BETA_REGISTRY_2_1_233),
]);

assertValidProfileRegistry(PROFILES_UNDER_TEST);

/**
 * Register `fn` once per profile, inside a `describe` naming that profile.
 *
 * Throws when the registry is empty rather than registering nothing: a suite
 * that quietly disappears is the failure mode this harness exists to prevent.
 */
export function describeEachProfile(
  name: string,
  fn: (entry: ProfileUnderTest) => void,
  entries: readonly ProfileUnderTest[] = PROFILES_UNDER_TEST,
): void {
  assertValidProfileRegistry(entries);

  for (const entry of entries) {
    describe(`${name} [${entry.id}]`, () => {
      fn(entry);
    });
  }
}
