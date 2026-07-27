// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile } from "../contracts.js";
import { COUNT_TOKENS_ENDPOINT } from "../count-tokens.js";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(Reflect.get(value, key));
    }
    Object.freeze(value);
  }
  return value;
}

export const CLAUDE_CODE_2_1_195_PROFILE: ClaudeCodeProtocolProfile =
  deepFreeze({
    id: "claude-code-2.1.195-sdk-0.94.0",
    cliVersion: "2.1.195",
    sdkVersion: "0.94.0",
    endpoint: "https://api.anthropic.com/v1/messages?beta=true",
    countTokensEndpoint: COUNT_TOKENS_ENDPOINT,
    entrypoint: "cli",
    userAgent: "claude-cli/2.1.195 (external, cli)",
    buildTime: "2026-06-26T01:00:56Z",
    gitSha: "4603aa3f2ea164bd0974f82eb413ae7acc99a7ee",
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
      narrationSummariesEnabled: false,
      structuredOutputsEnabled: false,
      afkModeEnabled: false,
      cacheDiagnosisEnabled: false,
    },
    /**
     * Retained only as a drift-detection anchor against the upstream plugin.
     * It does not influence emitted betas; `src/betas.ts` is authoritative.
     */
    orderedBetas: [
      "oauth-2025-04-20",
      "claude-code-20250219",
      "interleaved-thinking-2025-05-14",
      "prompt-caching-scope-2026-01-05",
      "extended-cache-ttl-2025-04-11",
      "context-management-2025-06-27",
      "effort-2025-11-24",
      "web-search-2025-03-05",
      "advisor-tool-2026-03-01",
      "context-hint-2026-04-09",
      "redact-thinking-2026-02-12",
      "thinking-token-count-2026-05-13",
    ],
    /**
     * Verbatim genuine-client catalogue at byte offset 226599191.
     * `defaultEffort` is policy exposed as catalogue data; this package must
     * never apply it to a request.
     */
    supportedModels: {
      "claude-3-5-haiku": {
        family: "haiku",
        capabilities: [],
      },
      "claude-haiku-4-5": {
        family: "haiku",
        capabilities: ["context_management"],
      },
      "claude-3-5-sonnet": {
        family: "sonnet",
        capabilities: [],
      },
      "claude-3-7-sonnet": {
        family: "sonnet",
        capabilities: [],
      },
      "claude-sonnet-4-0": {
        family: "sonnet",
        context: { window: 200000, supports1mBeta: true },
        capabilities: ["context_management"],
      },
      "claude-sonnet-4-5": {
        family: "sonnet",
        context: { window: 200000, supports1mBeta: true },
        capabilities: ["context_management"],
      },
      "claude-sonnet-4-6": {
        family: "sonnet",
        context: { window: 200000, supports1mBeta: true },
        capabilities: [
          "effort",
          "max_effort",
          "adaptive_thinking",
          "context_management",
        ],
      },
      "claude-opus-4-0": {
        family: "opus",
        capabilities: ["context_management"],
      },
      "claude-opus-4-1": {
        family: "opus",
        capabilities: ["context_management"],
      },
      "claude-opus-4-5": {
        family: "opus",
        capabilities: ["context_management"],
      },
      "claude-opus-4-6": {
        family: "opus",
        context: { window: 200000, supports1mBeta: true },
        capabilities: [
          "effort",
          "max_effort",
          "adaptive_thinking",
          "context_management",
          "fast_mode",
        ],
      },
      "claude-opus-4-7": {
        family: "opus",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        capabilities: [
          "effort",
          "max_effort",
          "xhigh_effort",
          "adaptive_thinking",
          "context_management",
          "fast_mode",
        ],
        defaultEffort: "xhigh",
      },
      "claude-opus-4-8": {
        family: "opus",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
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
      "claude-fable-5": {
        family: "fable",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
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
        ],
        defaultEffort: "high",
      },
    },
  });
