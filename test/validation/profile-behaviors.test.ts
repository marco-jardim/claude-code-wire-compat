// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeProtocolProfile } from "../../src/contracts.js";
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
} from "../../src/index.js";
import {
  profileBehaviors,
  type ClaudeCodeProfileBehaviors,
} from "../../src/profile-behaviors.js";

/*
 * The behaviour table `src/profile-behaviors.ts` resolves, pinned per profile.
 *
 * Three modules consume these flags and each has its own suite asserting the
 * resulting wire bytes. What is pinned HERE is the dispatch itself: which side
 * of the 2.1.195 / 2.1.222+ split each profile lands on, and — the row that
 * cannot be covered anywhere else — which side an unrecognised profile lands
 * on. That default is a decision, not an accident, and it is the reason this
 * suite exists separately from the three behavioural ones.
 */

const LEGACY: ClaudeCodeProfileBehaviors = {
  requestDerivedTokenCeiling: false,
  billingChainSegments: false,
  opus45EffortException: true,
};

const MODERN: ClaudeCodeProfileBehaviors = {
  requestDerivedTokenCeiling: true,
  billingChainSegments: true,
  opus45EffortException: false,
};

describe("profileBehaviors: the shipped profiles", () => {
  it("puts 2.1.195 on the legacy side", () => {
    expect(profileBehaviors(CLAUDE_CODE_2_1_195_PROFILE)).toEqual(LEGACY);
  });

  it("puts 2.1.233 on the modern side", () => {
    expect(profileBehaviors(CLAUDE_CODE_2_1_233_PROFILE)).toEqual(MODERN);
  });

  it("disagrees on every flag, so no flag is vacuous", () => {
    const legacy = profileBehaviors(CLAUDE_CODE_2_1_195_PROFILE);
    const modern = profileBehaviors(CLAUDE_CODE_2_1_233_PROFILE);
    const keys = Object.keys(legacy) as (keyof ClaudeCodeProfileBehaviors)[];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(legacy[key]).not.toBe(modern[key]);
    }
  });

  it("names flags for behaviour, never for a version", () => {
    for (const key of Object.keys(
      profileBehaviors(CLAUDE_CODE_2_1_195_PROFILE),
    ))
      expect(key).not.toMatch(/\d+[._]\d+[._]\d+|^v?\d/);
  });
});

/*
 * An unrecognised profile inherits the MODERN side. A profile ported from a
 * client newer than 2.1.233 must not silently regress to 2.1.195 semantics
 * just because nobody edited the dispatch module; only a profile ported from a
 * client OLDER than 2.1.222 needs an edit there.
 */
describe("profileBehaviors: an unrecognised profile", () => {
  const synthetic: ClaudeCodeProtocolProfile = {
    ...CLAUDE_CODE_2_1_233_PROFILE,
    id: "claude-code/9.9.9",
  };

  it("is genuinely unrecognised", () => {
    expect(synthetic.id).not.toBe(CLAUDE_CODE_2_1_195_PROFILE.id);
    expect(synthetic.id).not.toBe(CLAUDE_CODE_2_1_233_PROFILE.id);
  });

  it("inherits the modern side", () => {
    expect(profileBehaviors(synthetic)).toEqual(MODERN);
  });

  it("dispatches on the id alone, not on any other profile field", () => {
    // A profile carrying 2.1.195's id but every other field from 2.1.233 still
    // answers legacy: the id is the whole of the question.
    const spoofed: ClaudeCodeProtocolProfile = {
      ...CLAUDE_CODE_2_1_233_PROFILE,
      id: CLAUDE_CODE_2_1_195_PROFILE.id,
    };
    expect(profileBehaviors(spoofed)).toEqual(LEGACY);
  });
});

describe("profileBehaviors: purity", () => {
  it("returns a frozen object", () => {
    for (const profile of [
      CLAUDE_CODE_2_1_195_PROFILE,
      CLAUDE_CODE_2_1_233_PROFILE,
    ]) {
      expect(Object.isFrozen(profileBehaviors(profile))).toBe(true);
    }
  });

  it("returns a stable value for repeated calls", () => {
    expect(profileBehaviors(CLAUDE_CODE_2_1_233_PROFILE)).toBe(
      profileBehaviors(CLAUDE_CODE_2_1_233_PROFILE),
    );
  });

  it("cannot be mutated through the returned reference", () => {
    const behaviors = profileBehaviors(CLAUDE_CODE_2_1_195_PROFILE);
    expect(() => {
      (
        behaviors as { requestDerivedTokenCeiling: boolean }
      ).requestDerivedTokenCeiling = true;
    }).toThrow(TypeError);
    expect(profileBehaviors(CLAUDE_CODE_2_1_195_PROFILE)).toEqual(LEGACY);
  });
});
