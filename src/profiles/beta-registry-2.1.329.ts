// SPDX-License-Identifier: GPL-3.0-or-later

interface BetaRegistryEntry {
  readonly featureKey: string;
  readonly header: string;
}

/*
 * `deepFreeze` is duplicated from `src/beta-registry.ts` rather than imported,
 * for the same reason the 2.1.233 and 2.1.280 registries duplicate it: a shared
 * helper module would make every registry import-coupled for four lines of
 * code, and keeping each registry a leaf keeps a version bump from rippling.
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
 * Genuine-client beta registry as of 2.1.329, upstream factory chain at byte
 * offset 7881648 (view line 109432) and ordered array `a1i` immediately after
 * it.
 *
 * KEY ORDER IS LOAD-BEARING. The array is the raw slot order and is NOT
 * append-only: six entries are new since 2.1.280 and none of them sits at the
 * end. See `docs/protocol/versions/claude-code-2.1.329-analysis.md` section 5.1.
 *
 * The upstream array carries 48 slots. Two are explicit `null` (indices 39 and
 * 43, `yBn` and `ml`) and one is a header-less member (index 30, `fS`, declared
 * as `pl("mid_conversation_system")`), leaving the forty-five entries below.
 * Both nulls are null IN THIS BUILD, which is all the bytes establish; neither
 * is transcribed, because a null is not an entry.
 *
 * `mid_conversation_system` is deliberately ABSENT. The 2.1.280 registry
 * carried it with the header `mid-conversation-system-2026-04-07`. In 2.1.329
 * the slot is declared as `pl("mid_conversation_system")`, a call that passes a
 * name and no header, and the old identifier survives only as a bare string
 * constant (`Zkt`) that no registry member points at. The beta therefore graduated: the client no longer
 * advertises it, while the behaviour it gated stays on. That is why
 * `ComposableBetaRegistry.MID_CONVERSATION_SYSTEM` is optional. The slot sits
 * between `TOOL_PROVENANCE` and `PER_MESSAGE_EFFORT` and is recorded here
 * rather than silently closed up, because a later build may give it a header.
 *
 * `NARRATION_SUMMARIES` stays absent exactly as in the two previous registries.
 *
 * Further registry members are deliberately absent:
 * `tool_provenance_server_url_latch` (new at 2.1.329),
 * `mid_conv_cache_promotion_latch` and `mid_conv_cache_promotion_ok_latch`.
 * Upstream declares them through the same factory but excludes them from the
 * ordered array, and their "header" values are internal `x-cc-*` names, not
 * beta identifiers. Transcribing them would corrupt the registry. Likewise
 * `thinking_display` (`i1i`, declared through `pl()`) is outside the array.
 *
 * `oauth_auth` is the one entry whose header is NOT a string literal upstream:
 * the declaration reads `hWe=k("oauth_auth",Yu)`, and `Yu` resolves to
 * `"oauth-2025-04-20"`.
 *
 * `tool_search` is reused by two entries (`ADVANCED_TOOL_USE` and
 * `TOOL_SEARCH`) as in 2.1.280; the two headers differ and only the second is
 * a member of the third-party set.
 */
export const BETA_REGISTRY_2_1_329 = deepFreeze({
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
  // New at 2.1.329.
  WEB_SEARCH_RESULTS_ONLY: {
    featureKey: "web_search_results_only",
    header: "web-search-results-only-2026-11-15",
  },
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
  // New at 2.1.329.
  CACHE_KEEPALIVE: {
    featureKey: "cache_keepalive",
    header: "cache-keepalive-2026-09-03",
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
  THINKING_RESUMPTION: {
    featureKey: "thinking_resumption",
    header: "thinking-resumption-2026-07-17",
  },
  // New at 2.1.329, and inserted rather than appended: it sits directly after
  // `THINKING_RESUMPTION`, ahead of entries that already existed.
  RESUMPTION: {
    featureKey: "resumption",
    header: "resumption-2026-10-08",
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
  MCP_SERVERS: { featureKey: "mcp_servers", header: "mcp-servers-2025-12-04" },
  FILES_API: { featureKey: "files_api", header: "files-api-2025-04-14" },
  ENVIRONMENTS: {
    featureKey: "environments",
    header: "environments-2025-11-01",
  },
  CCR_BYOC: { featureKey: "ccr_byoc", header: "ccr-byoc-2025-07-29" },
  // New at 2.1.329. The feature key is `ccr_tool_provenance`.
  TOOL_PROVENANCE: {
    featureKey: "ccr_tool_provenance",
    header: "tool-provenance-2026-10-26",
  },
  // Slot 30 (`mid_conversation_system`, header-less) belongs here and is not
  // transcribed; see the header comment above.
  PER_MESSAGE_EFFORT: {
    featureKey: "per_message_effort",
    header: "per-turn-control-2026-07-01",
  },
  PER_TURN_TIMING: {
    featureKey: "per_turn_timing",
    header: "timing-2026-09-09",
  },
  MID_CONV_TOOL_CHANGE: {
    featureKey: "mid_conv_tool_change",
    header: "mid-conversation-tool-changes-2026-07-01",
  },
  INLINE_TOOLS: {
    featureKey: "inline_tools",
    header: "inline-tools-2026-09-15",
  },
  SERVER_SIDE_FALLBACK: {
    featureKey: "server_side_fallback",
    header: "server-side-fallback-2026-06-01",
  },
  // New at 2.1.329.
  PROGRAM_USE_CASE_IDS: {
    featureKey: "program_use_case_ids",
    header: "program-use-case-ids-2026-09-17",
  },
  SERVER_SIDE_FALLBACK_CATEGORY: {
    featureKey: "server_side_fallback_category",
    header: "server-side-fallback-2026-07-01",
  },
  FALLBACK_CREDIT: {
    featureKey: "fallback_credit",
    header: "fallback-credit-2026-06-01",
  },
  // The first null slot (`yBn`, upstream index 39) belongs here. As at 2.1.280,
  // nothing ties it to a header string by evidence.
  AUTO_MODE_CLASSIFIER: {
    featureKey: "auto_mode_classifier",
    header: "auto-mode-classifier-2026-07-16",
  },
  // New at 2.1.329. Pushed by upstream before the effort beta on the
  // per-attempt path (analysis document section 5.4).
  CLAUDE_CODE_SIDE_QUERY: {
    featureKey: "claude_code_side_query",
    header: "claude-code-side-query-2026-09-29",
  },
  DANGEROUS_TOOL_USE: {
    featureKey: "dangerous_tool_use",
    header: "dangerous-tool-use-2026-09-03",
  },
  // The second null slot (`ml`, upstream index 43) belongs here.
  THINKING_DISPLAY_UPDATES: {
    featureKey: "thinking_display_updates",
    header: "thinking-display-updates-2026-08-18",
  },
  MESSAGE_THREADS: {
    featureKey: "message_threads",
    header: "message-threads-2026-08-12",
  },
  MID_CONVERSATION_SYSTEM_CLEAR_AT: {
    featureKey: "mid_conversation_system_clear_at",
    header: "mid-conversation-system-clear-at-2026-08-21",
  },
  /*
   * LAST in the array, though upstream DECLARES it before `message_threads`
   * and `mid_conversation_system_clear_at`. Declaration order and array order
   * differ here and the array is what this transcription follows.
   */
  THINKING_BINDING_CONTROLS: {
    featureKey: "thinking_binding_controls",
    header: "thinking-binding-controls-2026-08-01",
  },
} satisfies Record<string, BetaRegistryEntry>);

/*
 * Third-party filtering as of 2.1.329, upstream `cw` at byte 9419770 (view line
 * 113823), consumed by `Pyo(e) { if (tAe()) return e; return e.filter(r =>
 * cw.has(r)) }` in the same run.
 *
 * Upstream's literal lists fifteen members. One of them, `fS`, is the
 * header-less `mid_conversation_system` slot and contributes no identifier, so
 * the set has fourteen. Delta against the 2.1.280 set: `mid-conversation-system`
 * left (it has no header any more) and `thinking_display_updates` was ADDED.
 * Order below follows upstream's literal.
 */
export const THIRD_PARTY_ALLOWED_BETAS_2_1_329: ReadonlySet<string> =
  Object.freeze(
    new Set([
      BETA_REGISTRY_2_1_329.CLAUDE_CODE.header,
      BETA_REGISTRY_2_1_329.INTERLEAVED_THINKING.header,
      BETA_REGISTRY_2_1_329.LONG_CONTEXT.header,
      BETA_REGISTRY_2_1_329.CONTEXT_MANAGEMENT.header,
      BETA_REGISTRY_2_1_329.STRUCTURED_OUTPUTS.header,
      BETA_REGISTRY_2_1_329.WEB_SEARCH.header,
      BETA_REGISTRY_2_1_329.EFFORT.header,
      BETA_REGISTRY_2_1_329.TOOL_SEARCH.header,
      BETA_REGISTRY_2_1_329.AFK_MODE.header,
      BETA_REGISTRY_2_1_329.DANGEROUS_TOOL_USE.header,
      BETA_REGISTRY_2_1_329.FALLBACK_CREDIT.header,
      BETA_REGISTRY_2_1_329.THINKING_TOKEN_COUNT.header,
      BETA_REGISTRY_2_1_329.THINKING_BINDING_CONTROLS.header,
      BETA_REGISTRY_2_1_329.THINKING_DISPLAY_UPDATES.header,
    ]),
  );

/*
 * Provider filtering as of 2.1.329 (`Bkr` in the analysis document): the
 * interleaved-thinking, 1M-context and tool-search-tool betas. Unchanged from
 * 2.1.280.
 *
 * Static reference data with no call site in `src/`, exactly like its
 * predecessors. See `test/governance/provider-scope.test.ts`.
 */
export const BEDROCK_UNSUPPORTED_BETAS_2_1_329: ReadonlySet<string> =
  Object.freeze(
    new Set([
      BETA_REGISTRY_2_1_329.INTERLEAVED_THINKING.header,
      BETA_REGISTRY_2_1_329.LONG_CONTEXT.header,
      BETA_REGISTRY_2_1_329.TOOL_SEARCH.header,
    ]),
  );

/*
 * Count-tokens selection as of 2.1.329 (`bBn` in the analysis document):
 * claude-code, interleaved-thinking, context-management and oauth. Unchanged
 * from 2.1.280.
 */
export const COUNT_TOKENS_BETAS_2_1_329: ReadonlySet<string> = Object.freeze(
  new Set([
    BETA_REGISTRY_2_1_329.CLAUDE_CODE.header,
    BETA_REGISTRY_2_1_329.INTERLEAVED_THINKING.header,
    BETA_REGISTRY_2_1_329.CONTEXT_MANAGEMENT.header,
    BETA_REGISTRY_2_1_329.OAUTH_AUTH.header,
  ]),
);
