// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeProtocolProfile } from "../../src/contracts.js";
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
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
  perTurnControlMessages: false,
  midConversationSystemFromCatalogue: true,
  thinkingTokenCountAfterRequestTable: false,
  longContextExcludesNative1m: false,
  extendedModelIdLadder: false,
  genuineHeaderLayout: false,
  billingTurnSegments: false,
  generatedContextManagement: false,
  cacheDiagnosisBody: false,
  genuineBodyKeyOrder: false,
  accountServedInputs: false,
};

// The set 2.1.233 and 2.1.280 share, and where an unrecognised id lands.
const CATALOGUE_ERA: ClaudeCodeProfileBehaviors = {
  requestDerivedTokenCeiling: true,
  billingChainSegments: true,
  opus45EffortException: false,
  perTurnControlMessages: false,
  midConversationSystemFromCatalogue: true,
  thinkingTokenCountAfterRequestTable: false,
  longContextExcludesNative1m: false,
  extendedModelIdLadder: false,
  genuineHeaderLayout: false,
  billingTurnSegments: false,
  generatedContextManagement: false,
  cacheDiagnosisBody: false,
  genuineBodyKeyOrder: false,
  accountServedInputs: false,
};

// 2.1.329: catalogue-era request behaviours plus every wire-faithful flag.
const WIRE_FAITHFUL: ClaudeCodeProfileBehaviors = {
  ...CATALOGUE_ERA,
  perTurnControlMessages: true,
  midConversationSystemFromCatalogue: false,
  thinkingTokenCountAfterRequestTable: true,
  longContextExcludesNative1m: true,
  extendedModelIdLadder: true,
  genuineHeaderLayout: true,
  billingTurnSegments: true,
  generatedContextManagement: true,
  cacheDiagnosisBody: true,
  genuineBodyKeyOrder: true,
  accountServedInputs: true,
};

describe("profileBehaviors: the shipped profiles", () => {
  it("puts 2.1.195 on the legacy side", () => {
    expect(profileBehaviors(CLAUDE_CODE_2_1_195_PROFILE)).toEqual(LEGACY);
  });

  it("puts 2.1.233 on the catalogue-era side", () => {
    expect(profileBehaviors(CLAUDE_CODE_2_1_233_PROFILE)).toEqual(
      CATALOGUE_ERA,
    );
  });

  it("puts 2.1.280 on the catalogue-era side", () => {
    expect(profileBehaviors(CLAUDE_CODE_2_1_280_PROFILE)).toBe(
      profileBehaviors(CLAUDE_CODE_2_1_233_PROFILE),
    );
    expect(profileBehaviors(CLAUDE_CODE_2_1_280_PROFILE)).toEqual(
      CATALOGUE_ERA,
    );
  });

  it("puts 2.1.329 on the wire-faithful side", () => {
    expect(profileBehaviors(CLAUDE_CODE_2_1_329_PROFILE)).toEqual(
      WIRE_FAITHFUL,
    );
  });

  describe("the 4-profile x flag table", () => {
    const FLAG_TABLE: readonly (readonly [
      keyof ClaudeCodeProfileBehaviors,
      boolean,
      boolean,
      boolean,
      boolean,
    ])[] = [
      ["requestDerivedTokenCeiling", false, true, true, true],
      ["billingChainSegments", false, true, true, true],
      ["opus45EffortException", true, false, false, false],
      ["perTurnControlMessages", false, false, false, true],
      ["midConversationSystemFromCatalogue", true, true, true, false],
      ["thinkingTokenCountAfterRequestTable", false, false, false, true],
      ["longContextExcludesNative1m", false, false, false, true],
      ["extendedModelIdLadder", false, false, false, true],
      ["genuineHeaderLayout", false, false, false, true],
      ["billingTurnSegments", false, false, false, true],
      ["generatedContextManagement", false, false, false, true],
      ["cacheDiagnosisBody", false, false, false, true],
      ["genuineBodyKeyOrder", false, false, false, true],
      ["accountServedInputs", false, false, false, true],
    ];

    it("lists every flag exactly once", () => {
      expect(FLAG_TABLE.map(([flag]) => flag as string).sort()).toEqual(
        Object.keys(LEGACY).sort(),
      );
    });

    const PROFILES = [
      CLAUDE_CODE_2_1_195_PROFILE,
      CLAUDE_CODE_2_1_233_PROFILE,
      CLAUDE_CODE_2_1_280_PROFILE,
      CLAUDE_CODE_2_1_329_PROFILE,
    ];

    for (const [flag, ...cells] of FLAG_TABLE) {
      it(`${flag} resolves ${cells.join("/")} for 195/233/280/329`, () => {
        const resolved = PROFILES.map((profile) => {
          return profileBehaviors(profile)[flag];
        });
        expect(resolved).toEqual(cells);
      });
    }
  });

  it("has two shipped behaviour sets disagree on every flag, so no flag is vacuous", () => {
    const sets = [
      profileBehaviors(CLAUDE_CODE_2_1_195_PROFILE),
      profileBehaviors(CLAUDE_CODE_2_1_233_PROFILE),
      profileBehaviors(CLAUDE_CODE_2_1_329_PROFILE),
    ];
    const keys = Object.keys(
      sets[0] ?? {},
    ) as (keyof ClaudeCodeProfileBehaviors)[];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(new Set(sets.map((set) => set[key])).size).toBe(2);
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
 * An unrecognised profile inherits the CATALOGUE-ERA side, never the
 * wire-faithful one. A profile must be named in the dispatch module to adopt
 * the 2.1.329 behaviours, and an overridden id must keep the bytes it had
 * before that profile existed.
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

  it("inherits the catalogue-era side", () => {
    expect(profileBehaviors(synthetic)).toEqual(CATALOGUE_ERA);
  });

  it("resolves an overridden id on a 2.1.329 profile to the catalogue-era set", () => {
    const overridden: ClaudeCodeProtocolProfile = {
      ...CLAUDE_CODE_2_1_329_PROFILE,
      id: "claude-code-custom",
    };
    const behaviors = profileBehaviors(overridden);
    expect(behaviors).toEqual(CATALOGUE_ERA);
    expect(behaviors.midConversationSystemFromCatalogue).toBe(true);
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
