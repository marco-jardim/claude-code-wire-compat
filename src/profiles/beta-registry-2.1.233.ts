// SPDX-License-Identifier: GPL-3.0-or-later

interface BetaRegistryEntry {
  readonly featureKey: string;
  readonly header: string;
}

/*
 * `deepFreeze` is duplicated from `src/beta-registry.ts` rather than imported.
 * A shared helper module would make the two registries import-coupled for four
 * lines of code, and the 2.1.195 registry already carries its own copy; keeping
 * each registry a leaf keeps a version bump from rippling.
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

/**
 * Genuine-client beta registry as of 2.1.233, upstream `Fb_` (byte offset
 * 287505865).
 *
 * KEY ORDER IS LOAD-BEARING. Upstream neither sorts this object nor keeps a
 * canonical list elsewhere, and `src/betas.ts` emits headers in the order its
 * push sites fire, not in registry order -- but the registry order is the
 * transcription of record and the only thing that makes a diff against a future
 * build meaningful. Do not reorder for tidiness, alphabetisation, or grouping.
 */
export const BETA_REGISTRY_2_1_233 = deepFreeze({
  CLAUDE_CODE: { featureKey: "claude_code", header: "claude-code-20250219" },
  OAUTH_AUTH: { featureKey: "oauth_auth", header: "oauth-2025-04-20" },
  INTERLEAVED_THINKING: {
    featureKey: "interleaved_thinking",
    header: "interleaved-thinking-2025-05-14",
  },
  LONG_CONTEXT: { featureKey: "long_context", header: "context-1m-2025-08-07" },
  CONTEXT_MANAGEMENT: {
    featureKey: "context_management",
    header: "context-management-2025-06-27",
  },
  STRUCTURED_OUTPUTS: {
    featureKey: "structured_outputs",
    header: "structured-outputs-2025-12-15",
  },
  WEB_SEARCH: { featureKey: "web_search", header: "web-search-2025-03-05" },
  ADVANCED_TOOL_USE: {
    featureKey: "tool_search",
    header: "advanced-tool-use-2025-11-20",
  },
  TOOL_SEARCH: {
    featureKey: "tool_search",
    header: "tool-search-tool-2025-10-19",
  },
  EFFORT: { featureKey: "effort", header: "effort-2025-11-24" },
  TASK_BUDGETS: {
    featureKey: "task_budgets",
    header: "task-budgets-2026-03-13",
  },
  PROMPT_CACHING_SCOPE: {
    featureKey: "prompt_caching_scope",
    header: "prompt-caching-scope-2026-01-05",
  },
  PROMPT_CACHING_EVICT: {
    featureKey: "prompt_caching_evict",
    header: "prompt-caching-evict-2026-05-12",
  },
  EXTENDED_CACHE_TTL: {
    featureKey: "extended_cache_ttl",
    header: "extended-cache-ttl-2025-04-11",
  },
  SPEED: { featureKey: "speed", header: "fast-mode-2026-02-01" },
  REDACT_THINKING: {
    featureKey: "redact_thinking",
    header: "redact-thinking-2026-02-12",
  },
  THINKING_TOKEN_COUNT: {
    featureKey: "thinking_token_count",
    header: "thinking-token-count-2026-05-13",
  },
  AFK_MODE: { featureKey: "afk_mode", header: "afk-mode-2026-01-31" },
  ADVISOR_TOOL: {
    featureKey: "advisor_tool",
    header: "advisor-tool-2026-03-01",
  },
  CACHE_DIAGNOSIS: {
    featureKey: "cache_diagnosis",
    header: "cache-diagnosis-2026-04-07",
  },
  CONTEXT_HINT: {
    featureKey: "context_hint",
    header: "context-hint-2026-04-09",
  },
  MCP_SERVERS: {
    featureKey: "mcp_servers",
    header: "mcp-servers-2025-12-04",
  },
  FILES_API: { featureKey: "files_api", header: "files-api-2025-04-14" },
  ENVIRONMENTS: {
    featureKey: "environments",
    header: "environments-2025-11-01",
  },
  CCR_BYOC: { featureKey: "ccr_byoc", header: "ccr-byoc-2025-07-29" },
  MID_CONVERSATION_SYSTEM: {
    featureKey: "mid_conversation_system",
    header: "mid-conversation-system-2026-04-07",
  },
  PER_MESSAGE_EFFORT: {
    featureKey: "per_message_effort",
    header: "per-turn-control-2026-07-01",
  },
  SERVER_SIDE_FALLBACK: {
    featureKey: "server_side_fallback",
    header: "server-side-fallback-2026-06-01",
  },
  SERVER_SIDE_FALLBACK_CATEGORY: {
    featureKey: "server_side_fallback_category",
    header: "server-side-fallback-2026-07-01",
  },
  FALLBACK_CREDIT: {
    featureKey: "fallback_credit",
    header: "fallback-credit-2026-06-01",
  },
  /*
   * NARRATION_SUMMARIES BELONGS HERE AND IS DELIBERATELY ABSENT.
   *
   * 2.1.195 carried `NARRATION_SUMMARIES` (`narration_summaries` /
   * `summarize-connector-text-2026-03-13`, upstream `RPt`) at exactly this
   * position, between `FALLBACK_CREDIT` and `AUTO_MODE_CLASSIFIER`. Upstream
   * removed it in 2.1.222+: the frozen array in the 2.1.233 build has a null
   * slot here and the header string appears nowhere in the binary.
   *
   * This is a REMOVAL, not a transcription gap. Re-adding the entry would
   * reintroduce a header the genuine client no longer sends and would break the
   * wire-compatibility claim on the first request. `src/betas.ts` treats the
   * narration push site as conditional on the entry's presence precisely so
   * this absence needs no special-casing anywhere else. Do not "fix" it.
   */
  AUTO_MODE_CLASSIFIER: {
    featureKey: "auto_mode_classifier",
    header: "auto-mode-classifier-2026-07-16",
  },
} satisfies Record<string, BetaRegistryEntry>);

/*
 * Third-party filtering as of 2.1.233, upstream `X5p` (consumed by `J4u`).
 *
 * Delta against the 2.1.195 set (`Pvi`): `mid-conversation-system-2026-04-07`
 * was ADDED; nothing was removed. Eleven headers, extracted from the 2.1.233
 * build rather than assumed to have carried over.
 */
export const THIRD_PARTY_ALLOWED_BETAS_2_1_233: ReadonlySet<string> =
  Object.freeze(
    new Set([
      BETA_REGISTRY_2_1_233.CLAUDE_CODE.header,
      BETA_REGISTRY_2_1_233.INTERLEAVED_THINKING.header,
      BETA_REGISTRY_2_1_233.LONG_CONTEXT.header,
      BETA_REGISTRY_2_1_233.CONTEXT_MANAGEMENT.header,
      BETA_REGISTRY_2_1_233.STRUCTURED_OUTPUTS.header,
      BETA_REGISTRY_2_1_233.WEB_SEARCH.header,
      BETA_REGISTRY_2_1_233.EFFORT.header,
      BETA_REGISTRY_2_1_233.TOOL_SEARCH.header,
      BETA_REGISTRY_2_1_233.AFK_MODE.header,
      BETA_REGISTRY_2_1_233.FALLBACK_CREDIT.header,
      BETA_REGISTRY_2_1_233.MID_CONVERSATION_SYSTEM.header,
    ]),
  );

/*
 * Provider filtering as of 2.1.233, upstream `pts` (consumed by `y1s`).
 * Extracted, not assumed: the set is byte-identical to the 2.1.195 one (`S2r`).
 *
 * Static reference data with no call site in `src/`, exactly like its 2.1.195
 * counterpart. See `test/governance/provider-scope.test.ts`.
 */
export const BEDROCK_UNSUPPORTED_BETAS_2_1_233: ReadonlySet<string> =
  Object.freeze(
    new Set([
      BETA_REGISTRY_2_1_233.INTERLEAVED_THINKING.header,
      BETA_REGISTRY_2_1_233.LONG_CONTEXT.header,
      BETA_REGISTRY_2_1_233.TOOL_SEARCH.header,
    ]),
  );

/*
 * Count-tokens selection as of 2.1.233, upstream `fts` (consumed by `_1s`).
 * Extracted, not assumed: identical to the 2.1.195 set (`E2r`).
 */
export const COUNT_TOKENS_BETAS_2_1_233: ReadonlySet<string> = Object.freeze(
  new Set([
    BETA_REGISTRY_2_1_233.CLAUDE_CODE.header,
    BETA_REGISTRY_2_1_233.INTERLEAVED_THINKING.header,
    BETA_REGISTRY_2_1_233.CONTEXT_MANAGEMENT.header,
    BETA_REGISTRY_2_1_233.OAUTH_AUTH.header,
  ]),
);
