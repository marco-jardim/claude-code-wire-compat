// SPDX-License-Identifier: GPL-3.0-or-later

interface BetaRegistryEntry {
  readonly featureKey: string;
  readonly header: string;
}

/*
 * `deepFreeze` is duplicated from `src/beta-registry.ts` rather than imported,
 * for the same reason the 2.1.233 registry duplicates it: a shared helper
 * module would make every registry import-coupled for four lines of code, and
 * keeping each registry a leaf keeps a version bump from rippling.
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
 * Genuine-client beta registry as of 2.1.280, upstream factory chain at byte
 * offset 6277485 and ordered array `oy` immediately after it.
 *
 * KEY ORDER IS LOAD-BEARING, and for 2.1.280 it is load-bearing in a way it was
 * not before: upstream's array is NOT append-only. `thinking_resumption` is
 * inserted at position 17, and `per_turn_timing`, `mid_conv_tool_change` and
 * `inline_tools` are inserted at 29-31, ahead of four entries that already
 * existed. A diff that assumes new identifiers only ever land at the end will
 * mis-align eleven entries. See
 * `docs/protocol/versions/claude-code-2.1.280-analysis.md` section 4.2.
 *
 * The upstream array carries 42 slots with two explicit `null`s (indices 34 and
 * 37, `kAt` at byte 6279405 and `hZt` at byte 6279537) which `.filter(e => e
 * !== null)` removes, leaving the forty entries below. `kAt` still has dead
 * consumers at byte 14167580 -- a retry-strip handler short-circuited by
 * `kAt === null`, and a rejection reporter that reads `kAt.name` under an
 * "Auto mode classifier" label -- so upstream removed the entry and left the
 * machinery that referenced it behind. That machinery says nothing about WHICH
 * beta the slot held; see the note above `AUTO_MODE_CLASSIFIER`. Neither null
 * slot is transcribed here; a null is not an entry.
 *
 * Two further registry members are deliberately absent:
 * `mid_conv_cache_promotion_latch` and `mid_conv_cache_promotion_ok_latch`
 * (`x-cc-internal-mid-conv-cache-promotion` and its `-ok` sibling). Upstream
 * declares them through the same factory but excludes them from the ordered
 * array, and their "header" values are internal `x-cc-*` names, not beta
 * identifiers. Transcribing them would corrupt the registry.
 */
export const BETA_REGISTRY_2_1_280 = deepFreeze({
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
  // New at 2.1.280, and inserted HERE rather than appended. Every entry below
  // this point sat one slot lower in 2.1.233.
  THINKING_RESUMPTION: {
    featureKey: "thinking_resumption",
    header: "thinking-resumption-2026-07-17",
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
  MID_CONVERSATION_SYSTEM: {
    featureKey: "mid_conversation_system",
    header: "mid-conversation-system-2026-04-07",
  },
  PER_MESSAGE_EFFORT: {
    featureKey: "per_message_effort",
    header: "per-turn-control-2026-07-01",
  },
  // New at 2.1.280. Also inserted rather than appended: the four entries below
  // `INLINE_TOOLS` all predate this release.
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
  SERVER_SIDE_FALLBACK_CATEGORY: {
    featureKey: "server_side_fallback_category",
    header: "server-side-fallback-2026-07-01",
  },
  FALLBACK_CREDIT: {
    featureKey: "fallback_credit",
    header: "fallback-credit-2026-06-01",
  },
  /*
   * NARRATION_SUMMARIES IS DELIBERATELY ABSENT, exactly as in the 2.1.233
   * registry, and re-adding it would reintroduce a header the genuine client no
   * longer sends. Do not "fix" it.
   *
   * This position -- between `FALLBACK_CREDIT` and `AUTO_MODE_CLASSIFIER` -- is
   * where the 2.1.233 registry records the removal, and it is also where array
   * index 34 (`kAt`, null) falls. That correspondence is suggestive and NOT
   * EVIDENCED: the `summarize-connector-text-2026-03-13` header string appears
   * nowhere in the 2.1.280 bundle, so nothing ties it to `kAt` rather than to
   * `hZt`, and `kAt`'s surviving consumer at byte 14167580 reports rejections
   * under an "Auto mode classifier" label, which points the other way. The
   * analysis document asserts only that two slots are null and this file
   * asserts no more. See section 4.2 of
   * `docs/protocol/versions/claude-code-2.1.280-analysis.md`.
   */
  AUTO_MODE_CLASSIFIER: {
    featureKey: "auto_mode_classifier",
    header: "auto-mode-classifier-2026-07-16",
  },
  // New at 2.1.280.
  DANGEROUS_TOOL_USE: {
    featureKey: "dangerous_tool_use",
    header: "dangerous-tool-use-2026-09-03",
  },
  /*
   * The SECOND null slot (`hZt`, upstream index 37) belongs here. As with the
   * first, what upstream removed is unknown: no header string in any analysed
   * release is tied to it by evidence. It is recorded rather than silently
   * closed up, because a future build may reuse the slot.
   */
  // New at 2.1.280.
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
   * LAST in the array, though upstream DECLARES it alongside
   * `thinking_display_updates` and `message_threads`. Declaration order and
   * array order differ here and the array is what this transcription follows.
   */
  THINKING_BINDING_CONTROLS: {
    featureKey: "thinking_binding_controls",
    header: "thinking-binding-controls-2026-08-01",
  },
} satisfies Record<string, BetaRegistryEntry>);

/*
 * Third-party filtering as of 2.1.280, upstream `Dg` at byte 7029997, consumed
 * by `DDn(e) { if (iwe()) return e; return e.filter(n => Dg.has(n)) }` in the
 * same run -- that is, the set is applied only when the request is NOT
 * first-party, which is how it was identified: by call site, not by resemblance
 * to the 2.1.233 set.
 *
 * Upstream writes one member as a conditional spread, `...BR ? [BR] : []`. That
 * is why the extractor reported this set `unresolved` ("a member is neither a
 * string literal nor a single property read"). `BR` is unconditionally defined
 * at byte 6278332 in this build, so the spread always contributes and the set
 * has fourteen members.
 *
 * Delta against the 2.1.233 set: `dangerous_tool_use`, `thinking_token_count`
 * and `thinking_binding_controls` were ADDED; nothing was removed. Order below
 * follows upstream's literal.
 */
export const THIRD_PARTY_ALLOWED_BETAS_2_1_280: ReadonlySet<string> =
  Object.freeze(
    new Set([
      BETA_REGISTRY_2_1_280.CLAUDE_CODE.header,
      BETA_REGISTRY_2_1_280.INTERLEAVED_THINKING.header,
      BETA_REGISTRY_2_1_280.LONG_CONTEXT.header,
      BETA_REGISTRY_2_1_280.CONTEXT_MANAGEMENT.header,
      BETA_REGISTRY_2_1_280.STRUCTURED_OUTPUTS.header,
      BETA_REGISTRY_2_1_280.WEB_SEARCH.header,
      BETA_REGISTRY_2_1_280.EFFORT.header,
      BETA_REGISTRY_2_1_280.TOOL_SEARCH.header,
      BETA_REGISTRY_2_1_280.AFK_MODE.header,
      BETA_REGISTRY_2_1_280.DANGEROUS_TOOL_USE.header,
      BETA_REGISTRY_2_1_280.FALLBACK_CREDIT.header,
      BETA_REGISTRY_2_1_280.MID_CONVERSATION_SYSTEM.header,
      BETA_REGISTRY_2_1_280.THINKING_TOKEN_COUNT.header,
      BETA_REGISTRY_2_1_280.THINKING_BINDING_CONTROLS.header,
    ]),
  );

/*
 * Provider filtering as of 2.1.280, upstream `qbr` at byte 6280270.
 *
 * Identified by behaviour rather than by shape: `Y5` at byte 7029210 reads
 * `if (sc(e) === "bedrock") return n.filter(r => !qbr.has(r))`, and the
 * complementary `lco` at the same site keeps exactly this set as bedrock
 * extra-body parameters. Byte-identical to the 2.1.233 set.
 *
 * A DIFFERENT `qbr` exists at byte 13922760 in another module -- a set of grep
 * flags. Minified names are module-scoped; this entry is the one the beta
 * pipeline consumes.
 *
 * Static reference data with no call site in `src/`, exactly like its 2.1.233
 * counterpart. See `test/governance/provider-scope.test.ts`.
 */
export const BEDROCK_UNSUPPORTED_BETAS_2_1_280: ReadonlySet<string> =
  Object.freeze(
    new Set([
      BETA_REGISTRY_2_1_280.INTERLEAVED_THINKING.header,
      BETA_REGISTRY_2_1_280.LONG_CONTEXT.header,
      BETA_REGISTRY_2_1_280.TOOL_SEARCH.header,
    ]),
  );

/*
 * Count-tokens selection as of 2.1.280, upstream `iNn` at byte 6280282,
 * consumed as `betas: y.filter(he => iNn.has(he))` inside
 * `beta.messages.countTokens` at bytes 12304007, 12304164 and 12305087.
 * Byte-identical to the 2.1.233 set.
 */
export const COUNT_TOKENS_BETAS_2_1_280: ReadonlySet<string> = Object.freeze(
  new Set([
    BETA_REGISTRY_2_1_280.CLAUDE_CODE.header,
    BETA_REGISTRY_2_1_280.INTERLEAVED_THINKING.header,
    BETA_REGISTRY_2_1_280.CONTEXT_MANAGEMENT.header,
    BETA_REGISTRY_2_1_280.OAUTH_AUTH.header,
  ]),
);
