// SPDX-License-Identifier: GPL-3.0-or-later

interface BetaRegistryEntry {
  readonly featureKey: string;
  readonly header: string;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(Reflect.get(value, key));
    }
    Object.freeze(value);
  }
  return value;
}

/** Genuine-client beta registry, upstream `Udd`. */
export const BETA_REGISTRY = deepFreeze({
  CLAUDE_CODE: { featureKey: "claude_code", header: "claude-code-20250219" }, // Y2e
  OAUTH_AUTH: { featureKey: "oauth_auth", header: "oauth-2025-04-20" }, // qIe
  INTERLEAVED_THINKING: {
    featureKey: "interleaved_thinking",
    header: "interleaved-thinking-2025-05-14",
  }, // Gnt
  LONG_CONTEXT: { featureKey: "long_context", header: "context-1m-2025-08-07" }, // FY
  CONTEXT_MANAGEMENT: {
    featureKey: "context_management",
    header: "context-management-2025-06-27",
  }, // X2e
  STRUCTURED_OUTPUTS: {
    featureKey: "structured_outputs",
    header: "structured-outputs-2025-12-15",
  }, // lte
  WEB_SEARCH: { featureKey: "web_search", header: "web-search-2025-03-05" }, // IPt
  ADVANCED_TOOL_USE: {
    featureKey: "tool_search",
    header: "advanced-tool-use-2025-11-20",
  }, // p2r
  TOOL_SEARCH: {
    featureKey: "tool_search",
    header: "tool-search-tool-2025-10-19",
  }, // xPt
  EFFORT: { featureKey: "effort", header: "effort-2025-11-24" }, // Wnt
  TASK_BUDGETS: {
    featureKey: "task_budgets",
    header: "task-budgets-2026-03-13",
  }, // lAn
  PROMPT_CACHING_SCOPE: {
    featureKey: "prompt_caching_scope",
    header: "prompt-caching-scope-2026-01-05",
  }, // qnt
  EXTENDED_CACHE_TTL: {
    featureKey: "extended_cache_ttl",
    header: "extended-cache-ttl-2025-04-11",
  }, // J2e
  SPEED: { featureKey: "speed", header: "fast-mode-2026-02-01" }, // Vnt
  REDACT_THINKING: {
    featureKey: "redact_thinking",
    header: "redact-thinking-2026-02-12",
  }, // kPt
  THINKING_TOKEN_COUNT: {
    featureKey: "thinking_token_count",
    header: "thinking-token-count-2026-05-13",
  }, // cAn
  NARRATION_SUMMARIES: {
    featureKey: "narration_summaries",
    header: "summarize-connector-text-2026-03-13",
  }, // RPt
  AFK_MODE: { featureKey: "afk_mode", header: "afk-mode-2026-01-31" }, // T0
  ADVISOR_TOOL: {
    featureKey: "advisor_tool",
    header: "advisor-tool-2026-03-01",
  }, // f2r
  CACHE_DIAGNOSIS: {
    featureKey: "cache_diagnosis",
    header: "cache-diagnosis-2026-04-07",
  }, // fye
  CONTEXT_HINT: {
    featureKey: "context_hint",
    header: "context-hint-2026-04-09",
  }, // m2r
  MCP_SERVERS: {
    featureKey: "mcp_servers",
    header: "mcp-servers-2025-12-04",
  }, // g2r
  FILES_API: { featureKey: "files_api", header: "files-api-2025-04-14" }, // h2r
  ENVIRONMENTS: {
    featureKey: "environments",
    header: "environments-2025-11-01",
  }, // y2r
  CCR_BYOC: { featureKey: "ccr_byoc", header: "ccr-byoc-2025-07-29" }, // _2r
  MID_CONVERSATION_SYSTEM: {
    featureKey: "mid_conversation_system",
    header: "mid-conversation-system-2026-04-07",
  }, // jY
  SERVER_SIDE_FALLBACK: {
    featureKey: "server_side_fallback",
    header: "server-side-fallback-2026-06-01",
  }, // r1
  FALLBACK_CREDIT: {
    featureKey: "fallback_credit",
    header: "fallback-credit-2026-06-01",
  }, // o1
} satisfies Record<string, BetaRegistryEntry>);

// Reserved for later work packages; upstream `Pvi` third-party filtering.
export const THIRD_PARTY_ALLOWED_BETAS: ReadonlySet<string> = Object.freeze(
  new Set([
    BETA_REGISTRY.CLAUDE_CODE.header,
    BETA_REGISTRY.INTERLEAVED_THINKING.header,
    BETA_REGISTRY.LONG_CONTEXT.header,
    BETA_REGISTRY.CONTEXT_MANAGEMENT.header,
    BETA_REGISTRY.STRUCTURED_OUTPUTS.header,
    BETA_REGISTRY.WEB_SEARCH.header,
    BETA_REGISTRY.EFFORT.header,
    BETA_REGISTRY.TOOL_SEARCH.header,
    BETA_REGISTRY.AFK_MODE.header,
    BETA_REGISTRY.FALLBACK_CREDIT.header,
  ]),
);

// Reserved for later work packages; upstream `S2r` provider filtering.
export const BEDROCK_UNSUPPORTED_BETAS: ReadonlySet<string> = Object.freeze(
  new Set([
    BETA_REGISTRY.INTERLEAVED_THINKING.header,
    BETA_REGISTRY.LONG_CONTEXT.header,
    BETA_REGISTRY.TOOL_SEARCH.header,
  ]),
);

// Reserved for later work packages; upstream `E2r` count-tokens selection.
export const COUNT_TOKENS_BETAS: ReadonlySet<string> = Object.freeze(
  new Set([
    BETA_REGISTRY.CLAUDE_CODE.header,
    BETA_REGISTRY.INTERLEAVED_THINKING.header,
    BETA_REGISTRY.CONTEXT_MANAGEMENT.header,
    BETA_REGISTRY.OAUTH_AUTH.header,
  ]),
);
