// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeCatalogueEntry,
  ClaudeCodeProtocolProfile,
} from "../../src/index.js";
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
} from "../../src/index.js";
import { normalizeModelId } from "../../src/model-identity.js";
import { deriveCapabilities } from "../../src/model-capabilities.js";
import { modelOutputTokenLimits } from "../../src/thinking.js";

/*
 * Every expectation below is a literal transcribed from
 * `docs/protocol/versions/claude-code-2.1.233-analysis.md`. Nothing is read
 * back out of the profile under test and compared against itself: a test that
 * derives its expectation from its subject only proves the subject equals
 * itself, and would keep passing through a wholesale catalogue rewrite.
 */

const CATALOGUE_233 = CLAUDE_CODE_2_1_233_PROFILE.supportedModels;
const CATALOGUE_195 = CLAUDE_CODE_2_1_195_PROFILE.supportedModels;

/** Catalogue order of record for 2.1.233. */
const EXPECTED_MODEL_IDS = [
  "claude-3-5-haiku",
  "claude-haiku-4-5",
  "claude-3-5-sonnet",
  "claude-3-7-sonnet",
  "claude-sonnet-4-0",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-opus-4-0",
  "claude-opus-4-1",
  "claude-opus-4-5",
  "claude-opus-4-6",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-opus-5",
  "claude-fable-5",
  "claude-mythos-5",
] as const;

type ExpectedModelId = (typeof EXPECTED_MODEL_IDS)[number];

function entry233(id: ExpectedModelId): ClaudeCodeCatalogueEntry {
  const found = CATALOGUE_233[id];
  if (found === undefined) {
    throw new Error(`2.1.233 catalogue has no entry for ${id}`);
  }
  return found;
}

describe("2.1.233 catalogue shape", () => {
  it("transcribes 17 entries in upstream catalogue order", () => {
    // Full-array equality, never `toContain`: the order is part of the
    // transcription, so a reordered entry must fail like a missing one.
    expect(Object.keys(CATALOGUE_233)).toEqual([...EXPECTED_MODEL_IDS]);
    expect(Object.keys(CATALOGUE_233)).toHaveLength(17);
  });

  it("freezes the profile, the catalogue and every entry", () => {
    expect(Object.isFrozen(CLAUDE_CODE_2_1_233_PROFILE)).toBe(true);
    expect(Object.isFrozen(CATALOGUE_233)).toBe(true);
    for (const id of EXPECTED_MODEL_IDS) {
      expect(Object.isFrozen(entry233(id))).toBe(true);
      expect(Object.isFrozen(entry233(id).capabilities)).toBe(true);
    }
  });
});

describe("2.1.233 catalogue scalars", () => {
  it("pins the identity and transport fields", () => {
    const profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_233_PROFILE;

    expect(profile.id).toBe("claude-code-2.1.233-sdk-0.112.1");
    expect(profile.cliVersion).toBe("2.1.233");
    expect(profile.sdkVersion).toBe("0.112.1");
    expect(profile.userAgent).toBe("claude-cli/2.1.233 (external, cli)");
    expect(profile.buildTime).toBe("2026-08-14T17:21:48Z");
    expect(profile.gitSha).toBe("f8d57569aaf350fe25dc4dfa10cad59db8ea4d45");
    expect(profile.endpoint).toBe(
      "https://api.anthropic.com/v1/messages?beta=true",
    );
    expect(profile.contextHintEnabled).toBe(false);
    expect(profile.provider).toBe("anthropic");
    expect(profile.anthropicVersion).toBe("2023-06-01");
  });
});

/** Capability arrays, cell by cell, in catalogue order. */
const EXPECTED_CAPABILITIES: readonly (readonly [
  ExpectedModelId,
  readonly string[],
])[] = [
  ["claude-3-5-haiku", []],
  ["claude-haiku-4-5", ["context_management"]],
  ["claude-3-5-sonnet", []],
  ["claude-3-7-sonnet", []],
  ["claude-sonnet-4-0", ["context_management"]],
  ["claude-sonnet-4-5", ["context_management"]],
  [
    "claude-sonnet-4-6",
    ["effort", "max_effort", "adaptive_thinking", "context_management"],
  ],
  [
    "claude-sonnet-5",
    [
      "effort",
      "max_effort",
      "xhigh_effort",
      "adaptive_thinking",
      "mid_conv_system",
      "context_management",
    ],
  ],
  ["claude-opus-4-0", ["context_management"]],
  ["claude-opus-4-1", ["context_management"]],
  ["claude-opus-4-5", ["context_management"]],
  [
    "claude-opus-4-6",
    ["effort", "max_effort", "adaptive_thinking", "context_management"],
  ],
  [
    "claude-opus-4-7",
    [
      "effort",
      "max_effort",
      "xhigh_effort",
      "adaptive_thinking",
      "context_management",
    ],
  ],
  [
    "claude-opus-4-8",
    [
      "effort",
      "max_effort",
      "xhigh_effort",
      "adaptive_thinking",
      "mid_conv_system",
      "context_management",
      "fast_mode",
      "lean_prompt",
    ],
  ],
  [
    "claude-opus-5",
    [
      "effort",
      "max_effort",
      "xhigh_effort",
      "adaptive_thinking",
      "mid_conv_system",
      "context_management",
      "fast_mode",
      "lean_prompt",
      "refusal_fallback",
      "opus_5_prompt_bundle",
    ],
  ],
  [
    "claude-fable-5",
    [
      "effort",
      "max_effort",
      "xhigh_effort",
      "adaptive_thinking",
      "rejects_disabled_thinking",
      "mid_conv_system",
      "context_management",
      "lean_prompt",
      "fable_5_mitigations",
      "refusal_fallback",
    ],
  ],
  ["claude-mythos-5", []],
];

describe("2.1.233 catalogue capabilities", () => {
  it.each(EXPECTED_CAPABILITIES)(
    "%s declares its capability list verbatim",
    (id, capabilities) => {
      expect(entry233(id).capabilities).toEqual([...capabilities]);
    },
  );

  it("covers every catalogued model exactly once", () => {
    expect(EXPECTED_CAPABILITIES.map(([id]) => id)).toEqual([
      ...EXPECTED_MODEL_IDS,
    ]);
  });
});

describe("2.1.233 capability deltas against 2.1.195", () => {
  /*
   * The three D3 deltas, named one by one. The uniform cross-profile sweep
   * further down would catch them too, but only as "something changed";
   * these state which change was accepted into the record.
   */

  it("drops fast_mode from claude-opus-4-6", () => {
    expect(entry233("claude-opus-4-6").capabilities).not.toContain("fast_mode");
  });

  it("drops fast_mode from claude-opus-4-7", () => {
    expect(entry233("claude-opus-4-7").capabilities).not.toContain("fast_mode");
  });

  it("adds refusal_fallback to claude-fable-5", () => {
    expect(entry233("claude-fable-5").capabilities).toContain(
      "refusal_fallback",
    );
  });

  it("keeps fast_mode on the 2.1.195 opus-4-6 and opus-4-7 entries", () => {
    // The contrast is the point: without it, the two assertions above would
    // also pass against a 2.1.195 that never had `fast_mode` to begin with.
    expect(CATALOGUE_195["claude-opus-4-6"]?.capabilities).toContain(
      "fast_mode",
    );
    expect(CATALOGUE_195["claude-opus-4-7"]?.capabilities).toContain(
      "fast_mode",
    );
  });

  it("has no refusal_fallback on the 2.1.195 fable-5 entry", () => {
    expect(CATALOGUE_195["claude-fable-5"]?.capabilities).not.toContain(
      "refusal_fallback",
    );
  });
});

/** `maxOutputTokens` per model, `{ default, upper }`. */
const EXPECTED_OUTPUT_TOKENS: readonly (readonly [
  ExpectedModelId,
  number,
  number,
])[] = [
  ["claude-3-5-haiku", 8192, 8192],
  ["claude-haiku-4-5", 32000, 64000],
  ["claude-3-5-sonnet", 8192, 8192],
  ["claude-3-7-sonnet", 32000, 64000],
  ["claude-sonnet-4-0", 32000, 64000],
  ["claude-sonnet-4-5", 32000, 64000],
  ["claude-sonnet-4-6", 32000, 128000],
  ["claude-sonnet-5", 64000, 128000],
  ["claude-opus-4-0", 32000, 32000],
  ["claude-opus-4-1", 32000, 32000],
  ["claude-opus-4-5", 32000, 64000],
  ["claude-opus-4-6", 64000, 128000],
  ["claude-opus-4-7", 64000, 128000],
  ["claude-opus-4-8", 64000, 128000],
  ["claude-opus-5", 64000, 128000],
  ["claude-fable-5", 64000, 128000],
  ["claude-mythos-5", 64000, 128000],
];

describe("2.1.233 catalogue output-token ceilings", () => {
  it.each(EXPECTED_OUTPUT_TOKENS)(
    "%s declares %i default and %i upper output tokens",
    (id, defaultTokens, upperTokens) => {
      expect(entry233(id).maxOutputTokens).toEqual({
        default: defaultTokens,
        upper: upperTokens,
      });
    },
  );

  it("covers every catalogued model exactly once", () => {
    expect(EXPECTED_OUTPUT_TOKENS.map(([id]) => id)).toEqual([
      ...EXPECTED_MODEL_IDS,
    ]);
  });
});

/*
 * `context` per model. `supports_1m_suffix` is not modelled, so an entry whose
 * only context signal is that flag carries no `context` object at all -- the
 * absence is the transcription, not an omission.
 */
const NO_CONTEXT_MODELS: readonly ExpectedModelId[] = [
  "claude-3-5-haiku",
  "claude-haiku-4-5",
  "claude-3-5-sonnet",
  "claude-3-7-sonnet",
  "claude-opus-4-0",
  "claude-opus-4-1",
  "claude-opus-4-5",
];

const BETA_1M_MODELS: readonly ExpectedModelId[] = [
  "claude-sonnet-4-0",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
];

const NATIVE_1M_MODELS: readonly ExpectedModelId[] = [
  "claude-sonnet-5",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-opus-5",
  "claude-fable-5",
  "claude-mythos-5",
];

describe("2.1.233 catalogue context windows", () => {
  it.each(NO_CONTEXT_MODELS)("%s carries no context object", (id) => {
    expect(entry233(id).context).toBeUndefined();
  });

  it.each(BETA_1M_MODELS)("%s declares a 200k window with 1m beta", (id) => {
    expect(entry233(id).context).toEqual({
      window: 200000,
      supports1mBeta: true,
    });
    expect(entry233(id).context?.native1m).toBeUndefined();
  });

  it.each(NATIVE_1M_MODELS)("%s declares a native 1m window", (id) => {
    expect(entry233(id).context).toEqual({
      window: 1000000,
      native1m: true,
      supports1mBeta: true,
    });
  });

  it("partitions the catalogue with no model left over", () => {
    expect(
      [...NO_CONTEXT_MODELS, ...BETA_1M_MODELS, ...NATIVE_1M_MODELS].sort(),
    ).toEqual([...EXPECTED_MODEL_IDS].sort());
  });
});

/*
 * `defaultEffort` is catalogue data the genuine client applies as policy. This
 * package must never put it on a request; pinning it here keeps the value
 * visible without granting it any behaviour.
 */
const EXPECTED_DEFAULT_EFFORT: readonly (readonly [
  ExpectedModelId,
  string | undefined,
])[] = [
  ["claude-3-5-haiku", undefined],
  ["claude-haiku-4-5", undefined],
  ["claude-3-5-sonnet", undefined],
  ["claude-3-7-sonnet", undefined],
  ["claude-sonnet-4-0", undefined],
  ["claude-sonnet-4-5", undefined],
  ["claude-sonnet-4-6", undefined],
  ["claude-sonnet-5", "high"],
  ["claude-opus-4-0", undefined],
  ["claude-opus-4-1", undefined],
  ["claude-opus-4-5", undefined],
  ["claude-opus-4-6", undefined],
  ["claude-opus-4-7", "xhigh"],
  ["claude-opus-4-8", "high"],
  ["claude-opus-5", "high"],
  ["claude-fable-5", "high"],
  ["claude-mythos-5", undefined],
];

describe("2.1.233 catalogue default effort", () => {
  it.each(EXPECTED_DEFAULT_EFFORT)(
    "%s declares a default effort of %s",
    (id, effort) => {
      expect(entry233(id).defaultEffort).toBe(effort);
    },
  );

  it("covers every catalogued model exactly once", () => {
    expect(EXPECTED_DEFAULT_EFFORT.map(([id]) => id)).toEqual([
      ...EXPECTED_MODEL_IDS,
    ]);
  });
});

/*
 * Cross-profile sweep. Transcribing a catalogue by hand invites two mistakes
 * the per-cell tests above cannot catch: a value silently carried over from
 * 2.1.195, and a value silently changed. So every id present in both
 * catalogues is compared field by field, and the only capability differences
 * tolerated are the ones declared here. An undeclared delta -- in either
 * direction -- fails.
 */
interface CapabilityDelta {
  readonly removed: readonly string[];
  readonly added: readonly string[];
}

const KNOWN_CAPABILITY_DELTAS: Readonly<Record<string, CapabilityDelta>> = {
  "claude-opus-4-6": { removed: ["fast_mode"], added: [] },
  "claude-opus-4-7": { removed: ["fast_mode"], added: [] },
  "claude-fable-5": { removed: [], added: ["refusal_fallback"] },
};

/** Ids new at 2.1.233, with nothing in 2.1.195 to compare against. */
const NEW_AT_233: readonly ExpectedModelId[] = [
  "claude-sonnet-5",
  "claude-opus-5",
  "claude-mythos-5",
];

const SHARED_MODEL_IDS = EXPECTED_MODEL_IDS.filter(
  (id) => !NEW_AT_233.includes(id),
);

describe("2.1.233 catalogue against 2.1.195", () => {
  it("shares fourteen ids and introduces three", () => {
    expect(SHARED_MODEL_IDS).toHaveLength(14);
    expect(Object.keys(CATALOGUE_195)).toEqual([...SHARED_MODEL_IDS]);
    for (const id of NEW_AT_233) {
      expect(CATALOGUE_195[id]).toBeUndefined();
    }
  });

  it.each(SHARED_MODEL_IDS)(
    "%s differs from 2.1.195 only by its declared capability delta",
    (id) => {
      const before = CATALOGUE_195[id];
      const after = entry233(id);
      if (before === undefined) {
        throw new Error(`2.1.195 catalogue has no entry for ${id}`);
      }

      const delta = KNOWN_CAPABILITY_DELTAS[id] ?? { removed: [], added: [] };
      const projected = [
        ...before.capabilities.filter(
          (capability) => !delta.removed.includes(capability),
        ),
        ...delta.added,
      ];

      expect(after.capabilities).toEqual(projected);
      expect(after.family).toEqual(before.family);
      expect(after.maxOutputTokens).toEqual(before.maxOutputTokens);
      expect(after.defaultEffort).toEqual(before.defaultEffort);
      expect(after.context).toEqual(before.context);
    },
  );

  it("declares a delta only where one exists", () => {
    // Guards the sweep against a delta entry that quietly stops applying:
    // a `removed` capability the 2.1.195 entry never had, or an `added` one
    // it already had, would make the projection a no-op and the sweep blind.
    for (const [id, delta] of Object.entries(KNOWN_CAPABILITY_DELTAS)) {
      const before = CATALOGUE_195[id];
      expect(before).toBeDefined();
      for (const capability of delta.removed) {
        expect(before?.capabilities).toContain(capability);
      }
      for (const capability of delta.added) {
        expect(before?.capabilities).not.toContain(capability);
      }
    }
  });
});

/*
 * Derivation edges. The catalogue only matters if resolution actually reads
 * it, so each case below is one where the 2.1.233 answer is reachable by no
 * other route: a model 2.1.195 never catalogued, an exception that belongs to
 * 2.1.195 alone, and the fallback for an id in neither catalogue.
 */
describe("2.1.233 capability derivation", () => {
  it("reads claude-sonnet-5 out of the catalogue", () => {
    const derived = deriveCapabilities(
      "claude-sonnet-5",
      CLAUDE_CODE_2_1_233_PROFILE,
    );

    expect(derived.effort).toBe(true);
    expect(derived.maxEffort).toBe(true);
    expect(derived.xhighEffort).toBe(true);
    expect(derived.adaptiveThinking).toBe(true);
    expect(derived.contextManagement).toBe(true);
  });

  it("reads claude-opus-5 out of the catalogue rather than granting it all", () => {
    const derived = deriveCapabilities(
      "claude-opus-5",
      CLAUDE_CODE_2_1_233_PROFILE,
    );

    expect(derived.effort).toBe(true);
    expect(derived.xhighEffort).toBe(true);
    expect(derived.contextManagement).toBe(true);
    // The catalogue entry has no `rejects_disabled_thinking`. A permissive
    // fallback would hand it over anyway, so this is what separates a
    // catalogue read from a blanket yes.
    expect(derived.rejectsDisabledThinking).toBe(false);
  });

  it("denies claude-mythos-5 under 2.1.233 where 2.1.195 permitted it", () => {
    // 2.1.195 had no entry for this id at all, so it fell through to the
    // maximally permissive predicate. 2.1.233 catalogues it with an empty
    // capability array, which is a denial -- the sharpest evidence that
    // derivation consults the catalogue and not a name.
    const under233 = deriveCapabilities(
      "claude-mythos-5",
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    const under195 = deriveCapabilities(
      "claude-mythos-5",
      CLAUDE_CODE_2_1_195_PROFILE,
    );

    expect(under233.effort).toBe(false);
    expect(under233.maxEffort).toBe(false);
    expect(under233.xhighEffort).toBe(false);
    expect(under233.adaptiveThinking).toBe(false);
    expect(under233.contextManagement).toBe(false);

    expect(under195.effort).toBe(true);
  });

  it("withholds effort from claude-opus-4-5 under 2.1.233", () => {
    // The C1 exception restores `effort` for this id, but it is gated on the
    // 2.1.195 profile id. 2.1.233 catalogues the entry without `effort`, and
    // that omission is the genuine answer here.
    expect(
      deriveCapabilities("claude-opus-4-5", CLAUDE_CODE_2_1_233_PROFILE).effort,
    ).toBe(false);
    expect(
      deriveCapabilities("claude-opus-4-5", CLAUDE_CODE_2_1_195_PROFILE).effort,
    ).toBe(true);
  });

  it("falls back to the permissive predicate for an uncatalogued id", () => {
    expect(CATALOGUE_233["claude-foo-9"]).toBeUndefined();

    const derived = deriveCapabilities(
      "claude-foo-9",
      CLAUDE_CODE_2_1_233_PROFILE,
    );

    expect(derived.effort).toBe(true);
    expect(derived.contextManagement).toBe(true);
  });

  it("strips the 1m suffix before the catalogue lookup", () => {
    expect(normalizeModelId("claude-sonnet-4-5[1m]")).toBe("claude-sonnet-4-5");

    const suffixed = deriveCapabilities(
      normalizeModelId("claude-sonnet-4-5[1m]"),
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    const plain = deriveCapabilities(
      "claude-sonnet-4-5",
      CLAUDE_CODE_2_1_233_PROFILE,
    );

    expect(suffixed).toEqual(plain);
    // Not the permissive fallback an unnormalised lookup would have produced.
    expect(suffixed.effort).toBe(false);
    expect(suffixed.contextManagement).toBe(true);
  });
});

describe("2.1.233 output-token resolution", () => {
  it("resolves catalogued ceilings through the 2.1.233 profile", () => {
    expect(
      modelOutputTokenLimits("claude-sonnet-5", CLAUDE_CODE_2_1_233_PROFILE),
    ).toEqual({ default: 64000, upperLimit: 128000 });
    expect(
      modelOutputTokenLimits("claude-opus-4-5", CLAUDE_CODE_2_1_233_PROFILE),
    ).toEqual({ default: 32000, upperLimit: 64000 });
  });

  it("resolves claude-mythos-5, which 2.1.195 could not catalogue", () => {
    expect(
      modelOutputTokenLimits("claude-mythos-5", CLAUDE_CODE_2_1_233_PROFILE),
    ).toEqual({ default: 64000, upperLimit: 128000 });
  });
});
