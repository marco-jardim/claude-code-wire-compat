// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile } from "../contracts.js";
import { COUNT_TOKENS_ENDPOINT } from "../count-tokens.js";

/*
 * Protocol profile for genuine client 2.1.329.
 *
 * Provenance: extracted from the official 2.1.329 win32-x64 binary and
 * recorded in `docs/protocol/versions/claude-code-2.1.329-analysis.md`. The
 * scalars and the catalogue below were checked entry by entry against the
 * extractor report for that build (`npm run extract:profile` over the carved
 * multi-module dump), not against the 2.1.280 profile.
 *
 * The catalogue holds 24 entries in the extractor's order. The report also
 * lists three bare dated ids at its end (`claude-haiku-4-5-20251001`,
 * `claude-opus-4-1-20250805`, `claude-opus-4-5-20251101`). They carry no
 * family, capabilities or limits: they belong to a second, unrelated model
 * list that the widened search space of a multi-module dump picks up, exactly
 * as three spurious entries leaked in at 2.1.280. They are EXCLUDED.
 *
 * Capability strings are copied verbatim from the report, including the ones
 * `deriveCapabilitiesFromCatalogue` does not map (`total_tokens_reminder`,
 * `tool_loaded_text`, `org_locked_thinking`, `silent_turn_reminder`, ...). The
 * catalogue is a faithful transcription and the capability set is a free list
 * of strings, so an unmapped string is data, not an error. `mid_conv_system`
 * no longer appears on any entry: the beta graduated and the catalogue string
 * went with it (analysis document section 5.3).
 *
 * Not modelled, as at 2.1.280: `supports_1m_suffix` (an entry declaring a
 * 200000 window with nothing but that flag carries no `context` object), and
 * the catalogue fields `advisor_rank`, `pricing`, `effort_cost_index`,
 * `maximum_window`, `clamp_long_context_without_beta`, `fallback_chain`,
 * `picker`, `deprecation`, `min_cli_version` and `slogan`.
 *
 * `runtimeVersion` and `oauthAuthorizeScopes` are optional profile data that
 * older profiles omit, so their output is untouched. Both are `[LIVE]` values
 * from a genuine 2.1.329 session and are data only: this package neither
 * applies the runtime version (the caller still supplies
 * `runtime.runtimeVersion`) nor builds an authorize URL.
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

export const CLAUDE_CODE_2_1_329_PROFILE: ClaudeCodeProtocolProfile =
  deepFreeze({
    id: "claude-code-2.1.329-sdk-0.128.0",
    cliVersion: "2.1.329",
    sdkVersion: "0.128.0",
    endpoint: "https://api.anthropic.com/v1/messages?beta=true",
    countTokensEndpoint: COUNT_TOKENS_ENDPOINT,
    entrypoint: "cli",
    userAgent: "claude-cli/2.1.329 (external, cli)",
    buildTime: "2026-11-19T16:23:05Z",
    gitSha: "6a49dd29d929a6fe40c060bbccfeb5a7f037c958",
    // [LIVE]. The interactive OAuth captures carry the billing block, so this
    // is now evidenced rather than retained.
    attributionHeaderEnabled: true,
    provider: "anthropic",
    anthropicVersion: "2023-06-01",
    // `context_hint` remains off: the live default-path beta list contains no
    // `context-hint` identifier.
    contextHintEnabled: false,
    /*
     * The eleven flags of the 2.1.280 profile, unchanged. `afkModeEnabled`
     * stays `false` and is RETAINED, not re-derived: its gates are still
     * unresolved. The live interactive capture does list `afk-mode`; that is a
     * recorded divergence of the default composition, not something this
     * profile asserts.
     */
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
      cacheDiagnosisEnabled: true,
    },
    /** `X-Stainless-Runtime-Version` the genuine binary reports. [LIVE] */
    runtimeVersion: "v26.12.1",
    /** Scopes of the `claude auth login --claudeai` authorize URL. [LIVE] */
    oauthAuthorizeScopes: [
      "org:create_api_key",
      "user:profile",
      "user:inference",
      "user:sessions:claude_code",
      "user:mcp_servers",
      "user:file_upload",
      "user:plugins",
      "user:privacy_consents:write",
      "org:desktop_config",
    ],
    /**
     * Verbatim genuine-client catalogue, 24 entries in the catalogue's own
     * order. `defaultEffort` is policy exposed as catalogue data; this package
     * must never apply it to a request.
     */
    supportedModels: {
      "claude-3-5-haiku": {
        family: "haiku",
        capabilities: ["total_tokens_reminder", "tool_loaded_text"],
        maxOutputTokens: { default: 8192, upper: 8192 },
      },
      "claude-haiku-4-5": {
        family: "haiku",
        capabilities: [
          "context_management",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
        maxOutputTokens: { default: 32000, upper: 64000 },
      },
      // New at 2.1.329.
      "claude-haiku-5-5": {
        family: "haiku",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 128000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "xhigh_effort",
          "adaptive_thinking",
          "mid_conv_tool_change",
          "context_management",
          "rejects_disabled_thinking",
          "per_turn_effort",
          "lean_prompt",
          "org_locked_thinking",
          "haiku_5_5_early_stopping_guidance",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
        defaultEffort: "medium",
      },
      "claude-3-5-sonnet": {
        family: "sonnet",
        capabilities: ["total_tokens_reminder", "tool_loaded_text"],
        maxOutputTokens: { default: 8192, upper: 8192 },
      },
      "claude-3-7-sonnet": {
        family: "sonnet",
        capabilities: ["total_tokens_reminder", "tool_loaded_text"],
        maxOutputTokens: { default: 32000, upper: 64000 },
      },
      "claude-sonnet-4-0": {
        family: "sonnet",
        context: { window: 200000, supports1mBeta: true },
        capabilities: [
          "context_management",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
        maxOutputTokens: { default: 32000, upper: 64000 },
      },
      "claude-sonnet-4-5": {
        family: "sonnet",
        context: { window: 200000, supports1mBeta: true },
        capabilities: [
          "context_management",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
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
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
      },
      "claude-sonnet-5": {
        family: "sonnet",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "xhigh_effort",
          "adaptive_thinking",
          "context_management",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
        defaultEffort: "high",
      },
      // New at 2.1.329. The only entry carrying `silent_turn_reminder`.
      "claude-sonnet-5-5": {
        family: "sonnet",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 128000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "xhigh_effort",
          "adaptive_thinking",
          "mid_conv_tool_change",
          "context_management",
          "rejects_disabled_thinking",
          "per_turn_effort",
          "per_turn_timing",
          "lean_prompt",
          "refusal_fallback",
          "silent_turn_reminder",
          "org_locked_thinking",
          "tool_loaded_text",
        ],
        defaultEffort: "medium",
      },
      "claude-opus-4-0": {
        family: "opus",
        capabilities: [
          "context_management",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
        maxOutputTokens: { default: 32000, upper: 32000 },
      },
      "claude-opus-4-1": {
        family: "opus",
        capabilities: [
          "context_management",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
        maxOutputTokens: { default: 32000, upper: 32000 },
      },
      "claude-opus-4-5": {
        family: "opus",
        capabilities: [
          "context_management",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
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
          "total_tokens_reminder",
          "tool_loaded_text",
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
          "total_tokens_reminder",
          "tool_loaded_text",
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
          "mid_conv_tool_change",
          "context_management",
          "fast_mode",
          "lean_prompt",
          "total_tokens_reminder",
          "tool_loaded_text",
          "send_user_file_input_whole",
        ],
        defaultEffort: "high",
      },
      "claude-opus-5": {
        family: "opus",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "xhigh_effort",
          "adaptive_thinking",
          "mid_conv_tool_change",
          "context_management",
          "thinking_disabled_effort_cap",
          "fast_mode",
          "lean_prompt",
          "refusal_fallback",
          "opus_5_prompt_bundle",
          "total_tokens_reminder",
          "tool_loaded_text",
          "send_user_file_input_whole",
        ],
        defaultEffort: "high",
      },
      // Carries no `total_tokens_reminder`, as `claude-sonnet-5-5`,
      // `claude-fable-5-2` and `claude-mythos-5-2` do not either.
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
          "mid_conv_tool_change",
          "per_turn_effort",
          "per_turn_timing",
          "context_management",
          "fast_mode",
          "lean_prompt",
          "refusal_fallback",
          "opus_5_5_prompt_bundle",
          "tool_loaded_text",
        ],
        defaultEffort: "medium",
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
          "mid_conv_tool_change",
          "context_management",
          "lean_prompt",
          "fable_5_mitigations",
          "refusal_fallback",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
        defaultEffort: "high",
      },
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
          "mid_conv_tool_change",
          "per_turn_effort",
          "per_turn_timing",
          "context_management",
          "lean_prompt",
          "fable_5_mitigations",
          "refusal_fallback",
          "fable_5_1_prompt_bundle",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
        defaultEffort: "high",
      },
      // New at 2.1.329. Declares `vertex_fast_mode` and `script_output_cost`,
      // neither of which is mapped by this package.
      "claude-fable-5-2": {
        family: "fable",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 128000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "xhigh_effort",
          "adaptive_thinking",
          "rejects_disabled_thinking",
          "mid_conv_tool_change",
          "per_turn_effort",
          "per_turn_timing",
          "context_management",
          "fast_mode",
          "vertex_fast_mode",
          "lean_prompt",
          "script_output_cost",
          "refusal_fallback",
          "org_locked_thinking",
          "fable_5_2_prompt_bundle",
        ],
        defaultEffort: "medium",
      },
      // The empty-of-features entry is a denial, not a gap: no effort, no
      // adaptive thinking, only the two reminder strings.
      "claude-mythos-5": {
        family: "mythos",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 64000, upper: 128000 },
        capabilities: ["total_tokens_reminder", "tool_loaded_text"],
      },
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
          "mid_conv_tool_change",
          "per_turn_timing",
          "context_management",
          "lean_prompt",
          "fable_5_mitigations",
          "fable_5_1_prompt_bundle",
          "total_tokens_reminder",
          "tool_loaded_text",
        ],
        defaultEffort: "high",
      },
      // New at 2.1.329.
      "claude-mythos-5-2": {
        family: "mythos",
        context: { window: 1e6, native1m: true, supports1mBeta: true },
        maxOutputTokens: { default: 128000, upper: 128000 },
        capabilities: [
          "effort",
          "max_effort",
          "xhigh_effort",
          "adaptive_thinking",
          "rejects_disabled_thinking",
          "mid_conv_tool_change",
          "per_turn_effort",
          "per_turn_timing",
          "context_management",
          "fast_mode",
          "vertex_fast_mode",
          "lean_prompt",
          "org_locked_thinking",
          "fable_5_2_prompt_bundle",
        ],
        defaultEffort: "medium",
      },
    },
  });
