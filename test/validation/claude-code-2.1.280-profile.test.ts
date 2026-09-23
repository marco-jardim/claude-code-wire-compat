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
    expect(CLAUDE_CODE_2_1_233_PROFILE.id).toBe(
      "claude-code-2.1.233-sdk-0.112.1",
    );
    expect({
      id: profile.id,
      cliVersion: profile.cliVersion,
      sdkVersion: profile.sdkVersion,
      endpoint: profile.endpoint,
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
