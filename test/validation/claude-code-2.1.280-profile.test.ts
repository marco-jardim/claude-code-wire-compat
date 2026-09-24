// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { CLAUDE_CODE_2_1_233_PROFILE } from "../../src/index.js";
import { CLAUDE_CODE_2_1_280_PROFILE } from "../../src/profiles/claude-code-2.1.280.js";

/*
 * Independent second transcription of the 2.1.280 profile.
 *
 * Every expected value below is transcribed from
 * `docs/protocol/versions/claude-code-2.1.280-analysis.md` (§5.2, §5.3, §5.4,
 * §8.1, §13.2), never from the module under test. A copying slip in either
 * transcription surfaces as a failure here.
 */

const profile = CLAUDE_CODE_2_1_280_PROFILE;
const models = profile.supportedModels;

// §5, per-entry offset table and §5.2 row order (catalogue order).
const MODEL_IDS: readonly string[] = [
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
  "claude-opus-5-5",
  "claude-fable-5",
  "claude-fable-5-1",
  "claude-mythos-5",
  "claude-mythos-5-1",
];

// §5.2, "mot default/upper" column.
const MAX_OUTPUT_TOKENS: Record<string, { default: number; upper: number }> = {
  "claude-3-5-haiku": { default: 8192, upper: 8192 },
  "claude-haiku-4-5": { default: 32000, upper: 64000 },
  "claude-3-5-sonnet": { default: 8192, upper: 8192 },
  "claude-3-7-sonnet": { default: 32000, upper: 64000 },
  "claude-sonnet-4-0": { default: 32000, upper: 64000 },
  "claude-sonnet-4-5": { default: 32000, upper: 64000 },
  "claude-sonnet-4-6": { default: 32000, upper: 128000 },
  "claude-sonnet-5": { default: 64000, upper: 128000 },
  "claude-opus-4-0": { default: 32000, upper: 32000 },
  "claude-opus-4-1": { default: 32000, upper: 32000 },
  "claude-opus-4-5": { default: 32000, upper: 64000 },
  "claude-opus-4-6": { default: 64000, upper: 128000 },
  "claude-opus-4-7": { default: 64000, upper: 128000 },
  "claude-opus-4-8": { default: 64000, upper: 128000 },
  "claude-opus-5": { default: 64000, upper: 128000 },
  "claude-opus-5-5": { default: 128000, upper: 128000 },
  "claude-fable-5": { default: 64000, upper: 128000 },
  "claude-fable-5-1": { default: 64000, upper: 128000 },
  "claude-mythos-5": { default: 64000, upper: 128000 },
  "claude-mythos-5-1": { default: 64000, upper: 128000 },
};

// §5.2.1, verbatim. Every value is the one the model name implies, which is
// precisely why the bundle has to be read for it: the bundle states no such
// rule, so a name-derived family would be an inference, not a transcription.
const FAMILIES: Record<string, string> = {
  "claude-3-5-haiku": "haiku",
  "claude-haiku-4-5": "haiku",
  "claude-3-5-sonnet": "sonnet",
  "claude-3-7-sonnet": "sonnet",
  "claude-sonnet-4-0": "sonnet",
  "claude-sonnet-4-5": "sonnet",
  "claude-sonnet-4-6": "sonnet",
  "claude-sonnet-5": "sonnet",
  "claude-opus-4-0": "opus",
  "claude-opus-4-1": "opus",
  "claude-opus-4-5": "opus",
  "claude-opus-4-6": "opus",
  "claude-opus-4-7": "opus",
  "claude-opus-4-8": "opus",
  "claude-opus-5": "opus",
  "claude-opus-5-5": "opus",
  "claude-fable-5": "fable",
  "claude-fable-5-1": "fable",
  "claude-mythos-5": "mythos",
  "claude-mythos-5-1": "mythos",
};

/*
 * Every distinct capability string in §5.4, as a closed set.
 *
 * The character-class assertion further down cannot catch a plausible typo:
 * `context_managment` and `per_turn_timeing` are both `^[a-z0-9_]+$`. Since the
 * catalogue and its expectations were transcribed from one document by two
 * readers, an identical slip would agree with itself. A closed vocabulary is
 * the check that does not depend on the two transcriptions disagreeing -- it
 * fails on any string that is not one of the eighteen, however it got there.
 */
const CAPABILITY_VOCABULARY: readonly string[] = [
  "adaptive_thinking",
  "context_management",
  "effort",
  "fable_5_1_prompt_bundle",
  "fable_5_mitigations",
  "fast_mode",
  "lean_prompt",
  "max_effort",
  "mid_conv_system",
  "mid_conv_tool_change",
  "opus_5_5_prompt_bundle",
  "opus_5_prompt_bundle",
  "per_turn_effort",
  "per_turn_timing",
  "refusal_fallback",
  "rejects_disabled_thinking",
  "thinking_disabled_effort_cap",
  "xhigh_effort",
];

// §5.4, verbatim and in document order.
const CAPABILITIES: Record<string, readonly string[]> = {
  "claude-3-5-haiku": [],
  "claude-haiku-4-5": ["context_management"],
  "claude-3-5-sonnet": [],
  "claude-3-7-sonnet": [],
  "claude-sonnet-4-0": ["context_management"],
  "claude-sonnet-4-5": ["context_management"],
  "claude-sonnet-4-6": [
    "effort",
    "max_effort",
    "adaptive_thinking",
    "context_management",
  ],
  "claude-sonnet-5": [
    "effort",
    "max_effort",
    "xhigh_effort",
    "adaptive_thinking",
    "mid_conv_system",
    "context_management",
  ],
  "claude-opus-4-0": ["context_management"],
  "claude-opus-4-1": ["context_management"],
  "claude-opus-4-5": ["context_management"],
  "claude-opus-4-6": [
    "effort",
    "max_effort",
    "adaptive_thinking",
    "context_management",
  ],
  "claude-opus-4-7": [
    "effort",
    "max_effort",
    "xhigh_effort",
    "adaptive_thinking",
    "context_management",
  ],
  "claude-opus-4-8": [
    "effort",
    "max_effort",
    "xhigh_effort",
    "adaptive_thinking",
    "mid_conv_system",
    "mid_conv_tool_change",
    "context_management",
    "fast_mode",
    "lean_prompt",
  ],
  "claude-opus-5": [
    "effort",
    "max_effort",
    "xhigh_effort",
    "adaptive_thinking",
    "mid_conv_system",
    "mid_conv_tool_change",
    "context_management",
    "thinking_disabled_effort_cap",
    "fast_mode",
    "lean_prompt",
    "refusal_fallback",
    "opus_5_prompt_bundle",
  ],
  "claude-opus-5-5": [
    "effort",
    "max_effort",
    "xhigh_effort",
    "adaptive_thinking",
    "rejects_disabled_thinking",
    "mid_conv_system",
    "mid_conv_tool_change",
    "per_turn_effort",
    "per_turn_timing",
    "context_management",
    "fast_mode",
    "lean_prompt",
    "refusal_fallback",
    "opus_5_5_prompt_bundle",
  ],
  "claude-fable-5": [
    "effort",
    "max_effort",
    "xhigh_effort",
    "adaptive_thinking",
    "rejects_disabled_thinking",
    "mid_conv_system",
    "mid_conv_tool_change",
    "context_management",
    "lean_prompt",
    "fable_5_mitigations",
    "refusal_fallback",
  ],
  "claude-fable-5-1": [
    "effort",
    "max_effort",
    "xhigh_effort",
    "adaptive_thinking",
    "rejects_disabled_thinking",
    "mid_conv_system",
    "mid_conv_tool_change",
    "per_turn_effort",
    "per_turn_timing",
    "context_management",
    "lean_prompt",
    "fable_5_mitigations",
    "refusal_fallback",
    "fable_5_1_prompt_bundle",
  ],
  "claude-mythos-5": [],
  "claude-mythos-5-1": [
    "effort",
    "max_effort",
    "xhigh_effort",
    "adaptive_thinking",
    "rejects_disabled_thinking",
    "mid_conv_system",
    "mid_conv_tool_change",
    "per_turn_timing",
    "context_management",
    "lean_prompt",
    "fable_5_mitigations",
    "fable_5_1_prompt_bundle",
  ],
};

/*
 * §5.3 under its stated rule: a `context` object exists iff the upstream entry
 * declares `native_1m` or `supports_1m_beta`; `supports_1m_suffix` and
 * `native_1m_3p` are dropped. Thirteen of twenty.
 */
const LEGACY_1M_BETA = { window: 200000, supports1mBeta: true };
const NATIVE_1M = { window: 1e6, native1m: true, supports1mBeta: true };
const CONTEXTS: Record<string, object> = {
  "claude-sonnet-4-0": LEGACY_1M_BETA,
  "claude-sonnet-4-5": LEGACY_1M_BETA,
  "claude-sonnet-4-6": LEGACY_1M_BETA,
  "claude-sonnet-5": NATIVE_1M,
  "claude-opus-4-6": LEGACY_1M_BETA,
  "claude-opus-4-7": NATIVE_1M,
  "claude-opus-4-8": NATIVE_1M,
  "claude-opus-5": NATIVE_1M,
  "claude-opus-5-5": NATIVE_1M,
  "claude-fable-5": NATIVE_1M,
  "claude-fable-5-1": NATIVE_1M,
  "claude-mythos-5": NATIVE_1M,
  "claude-mythos-5-1": NATIVE_1M,
};

// §5.2, `default_effort` column: eight entries.
const DEFAULT_EFFORTS: Record<string, string> = {
  "claude-sonnet-5": "high",
  "claude-opus-4-7": "xhigh",
  "claude-opus-4-8": "high",
  "claude-opus-5": "high",
  "claude-opus-5-5": "medium",
  "claude-fable-5": "high",
  "claude-fable-5-1": "high",
  "claude-mythos-5-1": "high",
};

describe("CLAUDE_CODE_2_1_280_PROFILE (independent transcription of the analysis doc)", () => {
  it("carries the §8.1 transport scalars", () => {
    expect({
      id: profile.id,
      cliVersion: profile.cliVersion,
      sdkVersion: profile.sdkVersion,
      endpoint: profile.endpoint,
      countTokensEndpoint: profile.countTokensEndpoint,
      entrypoint: profile.entrypoint,
      userAgent: profile.userAgent,
      buildTime: profile.buildTime,
      gitSha: profile.gitSha,
      provider: profile.provider,
      anthropicVersion: profile.anthropicVersion,
    }).toEqual({
      id: "claude-code-2.1.280-sdk-0.112.1",
      cliVersion: "2.1.280",
      sdkVersion: "0.112.1",
      endpoint: "https://api.anthropic.com/v1/messages?beta=true",
      countTokensEndpoint:
        "https://api.anthropic.com/v1/messages/count_tokens?beta=true",
      entrypoint: "cli",
      userAgent: "claude-cli/2.1.280 (external, cli)",
      buildTime: "2026-09-21T20:40:17Z",
      gitSha: "80abbfe7d7232280011ff01a21ae3338f4c6e372",
      provider: "anthropic",
      anthropicVersion: "2023-06-01",
    });
  });

  it("carries exactly the eleven §13.2 betaPolicy flags", () => {
    expect(profile.betaPolicy).toEqual({
      oauthAuthenticated: true,
      experimentalBetasEnabled: true,
      oneMillionContextEnabled: true,
      interleavedThinkingEnabled: true,
      interactive: true,
      thinkingSummariesShown: false,
      thinkingTokenCountEnabled: true,
      narrationSummariesEnabled: false,
      structuredOutputsEnabled: false,
      afkModeEnabled: false,
      cacheDiagnosisEnabled: true,
    });
  });

  it("pins contextHintEnabled and attributionHeaderEnabled", () => {
    // contextHintEnabled: §13 table and §7.6 (`tengu_hazel_osprey`, default
    // false). attributionHeaderEnabled is not discussed in the 2.1.280
    // analysis; it is expected unchanged from 2.1.233.
    expect({
      contextHintEnabled: profile.contextHintEnabled,
      attributionHeaderEnabled: profile.attributionHeaderEnabled,
    }).toEqual({
      contextHintEnabled: false,
      attributionHeaderEnabled: true,
    });
  });

  it("catalogues exactly twenty models in catalogue order", () => {
    expect(MODEL_IDS).toHaveLength(20);
    expect(Object.keys(models)).toEqual(MODEL_IDS);
  });

  it("matches the §5.2 maxOutputTokens pair for every model", () => {
    expect(
      Object.fromEntries(
        Object.entries(models).map(([id, entry]) => [
          id,
          entry.maxOutputTokens,
        ]),
      ),
    ).toEqual(MAX_OUTPUT_TOKENS);
  });

  it("matches the §5.4 capability arrays, in order, for every model", () => {
    expect(
      Object.fromEntries(
        Object.entries(models).map(([id, entry]) => [id, entry.capabilities]),
      ),
    ).toEqual(CAPABILITIES);
  });

  it("emits a context object for exactly the §5.3 thirteen, with modelled keys only", () => {
    const present = Object.fromEntries(
      Object.entries(models)
        .filter(([, entry]) => Object.hasOwn(entry, "context"))
        .map(([id, entry]) => [id, entry.context]),
    );
    expect(Object.keys(CONTEXTS)).toHaveLength(13);
    expect(present).toEqual(CONTEXTS);
    expect(Object.keys(present)).toEqual(Object.keys(CONTEXTS));
    const withoutContext = Object.keys(models).filter(
      (id) => !Object.hasOwn(models[id] ?? {}, "context"),
    );
    expect(withoutContext).toEqual([
      "claude-3-5-haiku",
      "claude-haiku-4-5",
      "claude-3-5-sonnet",
      "claude-3-7-sonnet",
      "claude-opus-4-0",
      "claude-opus-4-1",
      "claude-opus-4-5",
    ]);
  });

  it("carries defaultEffort on exactly the eight §5.2 models", () => {
    const present = Object.fromEntries(
      Object.entries(models)
        .filter(([, entry]) => Object.hasOwn(entry, "defaultEffort"))
        .map(([id, entry]) => [id, entry.defaultEffort]),
    );
    expect(present).toEqual(DEFAULT_EFFORTS);
    const unexpectedKey = Object.keys(models).filter(
      (id) =>
        !Object.hasOwn(DEFAULT_EFFORTS, id) &&
        Object.hasOwn(models[id] ?? {}, "defaultEffort"),
    );
    expect(unexpectedKey).toEqual([]);
  });

  it("keeps all seventeen 2.1.233 ids and adds exactly the three new ones", () => {
    // Anchors the comparand: the id assertion pins which profile the oracle
    // is, so a wrong import fails here rather than silently weakening this
    // test -- and the cross-profile sweep below relies on the same module.
    expect(CLAUDE_CODE_2_1_233_PROFILE.id).toBe(
      "claude-code-2.1.233-sdk-0.112.1",
    );
    const previous = Object.keys(CLAUDE_CODE_2_1_233_PROFILE.supportedModels);
    const current = Object.keys(models);
    expect(previous).toHaveLength(17);
    expect(previous.filter((id) => !current.includes(id))).toEqual([]);
    expect(current.filter((id) => !previous.includes(id))).toEqual([
      "claude-opus-5-5",
      "claude-fable-5-1",
      "claude-mythos-5-1",
    ]);
  });

  it("matches the §5.2.1 family of every model", () => {
    expect(
      Object.fromEntries(
        Object.entries(models).map(([id, entry]) => [id, entry.family]),
      ),
    ).toEqual(FAMILIES);
  });

  it("uses only the eighteen §5.4 capability strings", () => {
    const vocabulary = [
      ...new Set(Object.values(models).flatMap((entry) => entry.capabilities)),
    ].sort((left, right) => left.localeCompare(right));
    expect(vocabulary).toEqual(CAPABILITY_VOCABULARY);
  });

  it("uses only plain ASCII in model ids and capability strings", () => {
    const badIds = Object.keys(models).filter(
      (id) => !/^claude-[a-z0-9-]+$/.test(id),
    );
    const badCapabilities = Object.entries(models).flatMap(([id, entry]) =>
      entry.capabilities
        .filter((capability) => !/^[a-z0-9_]+$/.test(capability))
        .map((capability) => `${id}: ${JSON.stringify(capability)}`),
    );
    expect({ badIds, badCapabilities }).toEqual({
      badIds: [],
      badCapabilities: [],
    });
  });
});

/*
 * Cross-profile sweep against 2.1.233.
 *
 * Everything above compares the module to a transcription of the analysis
 * document. Both were produced by reading the same document, so an identical
 * misreading agrees with itself and passes. This sweep uses a different oracle
 * entirely: the 2.1.233 profile module. What makes it trustworthy is
 * `test/validation/catalogue-2.1.233.test.ts`, which asserts that catalogue
 * cell by cell against its own analysis document, so the module cannot be
 * edited to make this sweep pass without failing that test. The frozen
 * `test:pack` digest is only an additional constraint, and a narrow one: it
 * hashes emitted request bytes, `family` never reaches the wire, and the other
 * swept fields reach it only for the model the digest scenario uses.
 * Every id present in both catalogues is compared field by field, and the only
 * capability differences tolerated are the ones declared here.
 *
 * The projection is order-aware rather than reconstructive. §5.5 records that
 * the 2.1.280 additions are inserted mid-array -- `mid_conv_tool_change` lands
 * immediately after `mid_conv_system`, not at the tail -- so rebuilding the
 * expected array as "previous entries, then the additions" would fail on
 * correct data. Instead: the carried-over strings must appear in their previous
 * relative order, and whatever else is present must be exactly the declared
 * additions.
 *
 * Limitation: this constrains the relative order of carried-over capabilities
 * and catches drops, duplicates and undeclared additions, but it is
 * position-blind for a declared addition -- a newly added string could sit at
 * any index and still pass. That is inherent, since the 2.1.233 module carries
 * no information about where a new string belongs; the per-model ordered-array
 * assertion against §5.4 earlier in this file is what pins position.
 */
interface CapabilityDelta {
  readonly removed: readonly string[];
  readonly added: readonly string[];
}

const NO_DELTA: CapabilityDelta = { removed: [], added: [] };

// §5.5, as corrected: three pre-existing models gain `mid_conv_tool_change`,
// and `claude-opus-5` also gains `thinking_disabled_effort_cap`. `added` is
// listed in the order the strings occupy in the 2.1.280 array.
const KNOWN_CAPABILITY_DELTAS: Readonly<Record<string, CapabilityDelta>> = {
  "claude-opus-4-8": { removed: [], added: ["mid_conv_tool_change"] },
  "claude-opus-5": {
    removed: [],
    added: ["mid_conv_tool_change", "thinking_disabled_effort_cap"],
  },
  "claude-fable-5": { removed: [], added: ["mid_conv_tool_change"] },
};

const previousModels = CLAUDE_CODE_2_1_233_PROFILE.supportedModels;
const SHARED_MODEL_IDS = MODEL_IDS.filter((id) =>
  Object.hasOwn(previousModels, id),
);

describe("2.1.280 catalogue against 2.1.233", () => {
  it("shares seventeen ids", () => {
    expect(SHARED_MODEL_IDS).toHaveLength(17);
  });

  it.each(SHARED_MODEL_IDS)(
    "%s differs from 2.1.233 only by its declared capability delta",
    (id) => {
      const before = previousModels[id];
      const after = models[id];
      if (before === undefined || after === undefined) {
        throw new Error(`${id} is missing from one of the two catalogues`);
      }

      const delta = KNOWN_CAPABILITY_DELTAS[id] ?? NO_DELTA;
      const survivors = before.capabilities.filter(
        (capability) => !delta.removed.includes(capability),
      );

      // Carried-over strings keep their relative order.
      expect(
        after.capabilities.filter((capability) =>
          survivors.includes(capability),
        ),
      ).toEqual(survivors);
      // Everything else is exactly what was declared.
      expect(
        after.capabilities.filter(
          (capability) => !survivors.includes(capability),
        ),
      ).toEqual(delta.added);
      for (const capability of delta.removed) {
        expect(after.capabilities).not.toContain(capability);
      }

      expect(after.family).toEqual(before.family);
      expect(after.maxOutputTokens).toEqual(before.maxOutputTokens);
      expect(after.defaultEffort).toEqual(before.defaultEffort);
      expect(after.context).toEqual(before.context);
    },
  );

  it("declares a delta only where one applies", () => {
    // Guards the sweep against a delta entry that quietly stops applying: a
    // `removed` capability the 2.1.233 entry never had, or an `added` one it
    // already carried, would make the projection a no-op and the sweep blind.
    for (const [id, delta] of Object.entries(KNOWN_CAPABILITY_DELTAS)) {
      const before = previousModels[id];
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
