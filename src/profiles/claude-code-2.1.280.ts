// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile } from "../contracts.js";
import { COUNT_TOKENS_ENDPOINT } from "../count-tokens.js";

/*
 * Protocol profile for genuine client 2.1.280.
 *
 * Provenance: extracted from the official 2.1.280 win32-x64 binary. The
 * catalogue and every scalar below are transcribed from
 * `docs/protocol/versions/claude-code-2.1.280-analysis.md`, which records the
 * byte offsets they came from. The catalogue was additionally re-extracted
 * from the carved bundle independently of that document (cluster bytes
 * 5941320-5955961) and agreed on every field of all twenty entries; that
 * re-extraction is not a claim you have to take on trust, because the method
 * it used is written down in section 5.2.1 of the analysis document and can be
 * re-run against the same dump.
 *
 * `effort_cost_index` is deliberately omitted, as in the 2.1.233 profile, and
 * so are the other nine static-catalogue fields the package does not model
 * (analysis document section 5.1).
 *
 * Context modelling follows 2.1.233 exactly. `supports_1m_suffix` is not
 * modelled, so an entry declaring a 200000 window with nothing but that flag
 * carries no `context` object here. `native_1m_3p` on `claude-sonnet-5` names
 * bedrock, vertex and foundry; this package is anthropic-only, so that flag is
 * not modelled either.
 */

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(Reflect.get(value, key));
    }
    Object.freeze(value);
  }
  return value;
}

export const CLAUDE_CODE_2_1_280_PROFILE: ClaudeCodeProtocolProfile =
  deepFreeze({
    id: "claude-code-2.1.280-sdk-0.112.1",
    cliVersion: "2.1.280",
    sdkVersion: "0.112.1",
    endpoint: "https://api.anthropic.com/v1/messages?beta=true",
    countTokensEndpoint: COUNT_TOKENS_ENDPOINT,
    entrypoint: "cli",
    userAgent: "claude-cli/2.1.280 (external, cli)",
    buildTime: "2026-09-21T20:40:17Z",
    gitSha: "80abbfe7d7232280011ff01a21ae3338f4c6e372",
    // RETAINED from 2.1.233, not asserted. The 2.1.280 analysis document does
    // not examine the billing block at all -- it contains no occurrence of
    // "attribution" -- so this is silence, which is not the same as evidence of
    // no change. The only indirect support is that the salt behind the
    // fingerprint is unchanged (section 13); the fingerprint it produces, not
    // the salt, is what appears on the billing line. Section 13.2 draws this
    // exact distinction for the beta policy and it applies here too: where the
    // evidence is absent the previous release's value is retained rather than
    // re-derived, and a later release that captures live traffic should settle
    // it.
    attributionHeaderEnabled: true,
    provider: "anthropic",
    anthropicVersion: "2023-06-01",
    // Section 9.2: `context_hint` remains off for 2.1.280. Section 7.6 agrees
    // -- its fourteen-identifier default-path `anthropic-beta` literal contains
    // no `context-hint` identifier -- but that is the same gate restated, not a
    // second line of evidence, because the 7.6 row cites the gate 9.2 resolves.
    // Only two things put that identifier into an emitted list: this flag,
    // which also emits a `context_hint` body field, and a caller passing the
    // identifier explicitly through the `additionalBetas` request seam.
    contextHintEnabled: false,
    /*
     * The eleven flags of analysis document section 13.2, which grades each
     * one. That grading is carried here per flag, because two of the eleven are
     * *retained* from 2.1.233 rather than resolved from this build -- their
     * upstream gates gave no answer -- and nothing in the value itself
     * distinguishes a retained flag from a derived one. A later release that
     * resolves a retained gate changes that flag on evidence; a later release
     * that merely repeats it has learned nothing.
     */
    betaPolicy: {
      // RETAINED. The gate reduces to a predicate whose own gate is
      // unresolved. What it decides is position rather than presence: the SDK
      // appends the OAuth beta unconditionally on a token-cache session
      // (section 8.3), so the choice is slot 2 versus appended last, and this
      // profile pins slot 2 as 2.1.195 and 2.1.233 do.
      oauthAuthenticated: true,
      // Derived.
      experimentalBetasEnabled: true,
      // From the bundle: the gate reads an opt-out environment variable that is
      // unset by default.
      oneMillionContextEnabled: true,
      // Derived.
      interleavedThinkingEnabled: true,
      // Derived.
      interactive: true,
      // Derived.
      thinkingSummariesShown: false,
      // Derived.
      thinkingTokenCountEnabled: true,
      // From the bundle, and inert for this profile either way: the 2.1.280
      // registry slot that would carry `narration_summaries` is null in this
      // build, so there is no entry for this flag to gate.
      narrationSummariesEnabled: false,
      // Derived.
      structuredOutputsEnabled: false,
      // RETAINED. Its gates are unresolved in this build.
      afkModeEnabled: false,
      // Changed from 2.1.233, where the 2.1.233 profile pins `false`. Section
      // 7.6.2 resolves all three legs of the 2.1.280 gate to true. Whether the
      // 2.1.233 value was always wrong cannot be settled without the 2.1.233
      // binary, and inferring one release's value from another's is exactly
      // what the tracking runbook forbids, so that profile is deliberately left
      // alone.
      cacheDiagnosisEnabled: true,
    },
    /**
     * Verbatim genuine-client catalogue, 20 entries in the catalogue's own
     * order. `defaultEffort` is policy exposed as catalogue data; this package
     * must never apply it to a request.
     */
    supportedModels: {
      "claude-3-5-haiku": {
        family: "haiku",
        capabilities: [],
        maxOutputTokens: { default: 8192, upper: 8192 },
      },
      "claude-haiku-4-5": {
        family: "haiku",
        capabilities: ["context_management"],
        maxOutputTokens: { default: 32000, upper: 64000 },
      },
      "claude-3-5-sonnet": {
        family: "sonnet",
        capabilities: [],
        maxOutputTokens: { default: 8192, upper: 8192 },
      },
      "claude-3-7-sonnet": {
        family: "sonnet",
        capabilities: [],
        maxOutputTokens: { default: 32000, upper: 64000 },
      },
      "claude-sonnet-4-0": {
        family: "sonnet",
        context: { window: 200000, supports1mBeta: true },
        capabilities: ["context_management"],
        maxOutputTokens: { default: 32000, upper: 64000 },
      },
      "claude-sonnet-4-5": {
        family: "sonnet",
        context: { window: 200000, supports1mBeta: true },
        capabilities: ["context_management"],
        maxOutputTokens: { default: 32000, upper: 64000 },
      },
      "claude-sonnet-4-6": {
        family: "sonnet",
        context: { window: 200000, supports1mBeta: true },
        maxOutputTokens: { default: 32000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "adaptive_thinking",
          "context_management",
        ],
      },
      // The entry also declares `native_1m_3p` for bedrock/vertex/foundry;
      // this package is anthropic-only, so that flag is not modelled.
      "claude-sonnet-5": {
        family: "sonnet",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "xhigh_effort",
          "adaptive_thinking",
          "mid_conv_system",
          "context_management",
        ],
        defaultEffort: "high",
      },
      "claude-opus-4-0": {
        family: "opus",
        capabilities: ["context_management"],
        maxOutputTokens: { default: 32000, upper: 32000 },
      },
      "claude-opus-4-1": {
        family: "opus",
        capabilities: ["context_management"],
        maxOutputTokens: { default: 32000, upper: 32000 },
      },
      "claude-opus-4-5": {
        family: "opus",
        capabilities: ["context_management"],
        maxOutputTokens: { default: 32000, upper: 64000 },
      },
      "claude-opus-4-6": {
        family: "opus",
        context: { window: 200000, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "adaptive_thinking",
          "context_management",
        ],
      },
      "claude-opus-4-7": {
        family: "opus",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "xhigh_effort",
          "adaptive_thinking",
          "context_management",
        ],
        defaultEffort: "xhigh",
      },
      // Gains `mid_conv_tool_change` since 2.1.233. That key is mapped by
      // `deriveCapabilitiesFromCatalogue` to `midConvToolChange`, and it
      // drives the `mid-conversation-tool-changes-2026-07-01` beta header
      // (section 7.6) through the guard transcribed in section 13.3.
      "claude-opus-4-8": {
        family: "opus",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
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
        defaultEffort: "high",
      },
      // Gains `mid_conv_tool_change` and `thinking_disabled_effort_cap` since
      // 2.1.233.
      "claude-opus-5": {
        family: "opus",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
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
        defaultEffort: "high",
      },
      // New at 2.1.280, and the only catalogue entry in any ported profile
      // whose `default_effort` is `medium`. It is also the only entry whose
      // default and upper output-token limits are both 128000.
      "claude-opus-5-5": {
        family: "opus",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 128000, upper: 128000 },
        capabilities: [
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
        defaultEffort: "medium",
      },
      // Gains `mid_conv_tool_change` since 2.1.233. Carries no `fast_mode`,
      // as in 2.1.233.
      "claude-fable-5": {
        family: "fable",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
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
        defaultEffort: "high",
      },
      // New at 2.1.280.
      "claude-fable-5-1": {
        family: "fable",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
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
        defaultEffort: "high",
      },
      // Keeps the empty capability array it was catalogued with at 2.1.233.
      // That is a denial, not a gap.
      "claude-mythos-5": {
        family: "mythos",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        capabilities: [],
        maxOutputTokens: { default: 64000, upper: 128000 },
      },
      // New at 2.1.280. Unlike `claude-fable-5-1` it carries no
      // `per_turn_effort` and no `refusal_fallback`.
      "claude-mythos-5-1": {
        family: "mythos",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
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
        defaultEffort: "high",
      },
    },
  });
