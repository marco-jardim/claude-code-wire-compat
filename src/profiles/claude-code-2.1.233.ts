// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile } from "../contracts.js";
import { COUNT_TOKENS_ENDPOINT } from "../count-tokens.js";

/*
 * Protocol profile for genuine client 2.1.233.
 *
 * Provenance: extracted from the official 2.1.233 win32-x64 binary. The
 * catalogue and every scalar below are transcribed from
 * `docs/protocol/versions/claude-code-2.1.233-analysis.md`, which records the
 * byte offsets they came from.
 *
 * `effort_cost_index` -- the only static-catalogue field added between 2.1.222
 * and 2.1.233 -- is deliberately omitted; the decision is recorded in
 * `docs/source-trace.md`.
 *
 * Context modelling follows 2.1.195 exactly wherever the upstream flags are
 * the same. `supports_1m_suffix` is not modelled, so an entry declaring a
 * 200000 window with nothing but that flag carries no `context` object here,
 * as in the 2.1.195 profile.
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

export const CLAUDE_CODE_2_1_233_PROFILE: ClaudeCodeProtocolProfile =
  deepFreeze({
    id: "claude-code-2.1.233-sdk-0.112.1",
    cliVersion: "2.1.233",
    sdkVersion: "0.112.1",
    endpoint: "https://api.anthropic.com/v1/messages?beta=true",
    countTokensEndpoint: COUNT_TOKENS_ENDPOINT,
    entrypoint: "cli",
    userAgent: "claude-cli/2.1.233 (external, cli)",
    buildTime: "2026-08-14T17:21:48Z",
    gitSha: "f8d57569aaf350fe25dc4dfa10cad59db8ea4d45",
    attributionHeaderEnabled: true,
    provider: "anthropic",
    anthropicVersion: "2023-06-01",
    contextHintEnabled: false,
    betaPolicy: {
      oauthAuthenticated: true,
      experimentalBetasEnabled: true,
      oneMillionContextEnabled: true,
      interleavedThinkingEnabled: true,
      interactive: true,
      thinkingSummariesShown: false,
      thinkingTokenCountEnabled: true,
      // Inert for this profile: 2.1.233 removed `narration_summaries` from the
      // beta registry, so there is no entry for this flag to gate.
      narrationSummariesEnabled: false,
      structuredOutputsEnabled: false,
      afkModeEnabled: false,
      cacheDiagnosisEnabled: false,
    },
    /**
     * Verbatim genuine-client catalogue, 17 entries in the catalogue's own
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
      // New at 2.1.233. The entry also declares `native_1m_3p` for
      // bedrock/vertex/foundry; this package is anthropic-only, so that flag
      // is not modelled.
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
      // No `effort`, and no exception restoring it. The C1 exception in
      // `model-capabilities.ts` belongs to 2.1.195, whose derivation ran off
      // predicates; 2.1.233 derives from this catalogue, so the omission is
      // the genuine answer here.
      "claude-opus-4-5": {
        family: "opus",
        capabilities: ["context_management"],
        maxOutputTokens: { default: 32000, upper: 64000 },
      },
      // Delta D3 vs 2.1.195: `fast_mode` is gone from this entry.
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
      // Delta D3 vs 2.1.195: `fast_mode` is gone from this entry too.
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
          "context_management",
          "fast_mode",
          "lean_prompt",
        ],
        defaultEffort: "high",
      },
      // New at 2.1.233.
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
          "context_management",
          "fast_mode",
          "lean_prompt",
          "refusal_fallback",
          "opus_5_prompt_bundle",
        ],
        defaultEffort: "high",
      },
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
          "context_management",
          "lean_prompt",
          "fable_5_mitigations",
          "refusal_fallback",
        ],
        defaultEffort: "high",
      },
      // New at 2.1.233, and the notable one: under 2.1.195 `claude-mythos-5`
      // had no catalogue entry at all (product decision D-1) and was
      // recognised only by name in individual predicates. Here it is
      // catalogued with an empty capability array, which is a denial rather
      // than the maximally permissive predicate fallback.
      "claude-mythos-5": {
        family: "mythos",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        capabilities: [],
        maxOutputTokens: { default: 64000, upper: 128000 },
      },
    },
  });
