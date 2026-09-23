// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { BETA_REGISTRY, BETA_REGISTRY_2_1_233 } from "../../src/index.js";
import {
  BEDROCK_UNSUPPORTED_BETAS_2_1_280,
  BETA_REGISTRY_2_1_280,
  COUNT_TOKENS_BETAS_2_1_280,
  THIRD_PARTY_ALLOWED_BETAS_2_1_280,
} from "../../src/profiles/beta-registry-2.1.280.js";

/*
 * SECOND, INDEPENDENT TRANSCRIPTION. Every literal below was copied from the
 * analysis document's section 4.1 table
 * (`docs/protocol/versions/claude-code-2.1.280-analysis.md`), NOT from
 * `src/profiles/beta-registry-2.1.280.ts` and NOT from the port plan. That is
 * the entire point of this file: two independent readings of the same upstream
 * evidence disagree loudly if either one slipped a character. Regenerating
 * these literals from the registry module would convert this suite into a
 * tautology.
 *
 * Upstream order is ARRAY order (`oy`), which is not declaration order --
 * `thinking-binding-controls-2026-08-01` is declared third from last and placed
 * last. See section 4.2 of the analysis document.
 */
const UPSTREAM_HEADERS_IN_ARRAY_ORDER: readonly string[] = [
  "claude-code-20250219",
  "oauth-2025-04-20",
  "interleaved-thinking-2025-05-14",
  "context-1m-2025-08-07",
  "context-management-2025-06-27",
  "structured-outputs-2025-12-15",
  "web-search-2025-03-05",
  "advanced-tool-use-2025-11-20",
  "tool-search-tool-2025-10-19",
  "effort-2025-11-24",
  "task-budgets-2026-03-13",
  "prompt-caching-scope-2026-01-05",
  "prompt-caching-evict-2026-05-12",
  "extended-cache-ttl-2025-04-11",
  "fast-mode-2026-02-01",
  "redact-thinking-2026-02-12",
  "thinking-resumption-2026-07-17",
  "thinking-token-count-2026-05-13",
  "afk-mode-2026-01-31",
  "advisor-tool-2026-03-01",
  "cache-diagnosis-2026-04-07",
  "context-hint-2026-04-09",
  "mcp-servers-2025-12-04",
  "files-api-2025-04-14",
  "environments-2025-11-01",
  "ccr-byoc-2025-07-29",
  "mid-conversation-system-2026-04-07",
  "per-turn-control-2026-07-01",
  "timing-2026-09-09",
  "mid-conversation-tool-changes-2026-07-01",
  "inline-tools-2026-09-15",
  "server-side-fallback-2026-06-01",
  "server-side-fallback-2026-07-01",
  "fallback-credit-2026-06-01",
  "auto-mode-classifier-2026-07-16",
  "dangerous-tool-use-2026-09-03",
  "thinking-display-updates-2026-08-18",
  "message-threads-2026-08-12",
  "mid-conversation-system-clear-at-2026-08-21",
  "thinking-binding-controls-2026-08-01",
];

/*
 * The same table's feature-key column. Upstream calls this field `name` and
 * feeds it to logging, not to `anthropic-beta`, so a slip here is not a wire
 * defect -- but it is the column the registry keys are derived from, and
 * nothing else in this suite would catch a typo in thirty-nine of the forty.
 *
 * `tool_search` appears TWICE, at positions 8 and 9. That is upstream's own
 * duplication, not a transcription error.
 */
const UPSTREAM_FEATURE_KEYS_IN_ARRAY_ORDER: readonly string[] = [
  "claude_code",
  "oauth_auth",
  "interleaved_thinking",
  "long_context",
  "context_management",
  "structured_outputs",
  "web_search",
  "tool_search",
  "tool_search",
  "effort",
  "task_budgets",
  "prompt_caching_scope",
  "prompt_caching_evict",
  "extended_cache_ttl",
  "speed",
  "redact_thinking",
  "thinking_resumption",
  "thinking_token_count",
  "afk_mode",
  "advisor_tool",
  "cache_diagnosis",
  "context_hint",
  "mcp_servers",
  "files_api",
  "environments",
  "ccr_byoc",
  "mid_conversation_system",
  "per_message_effort",
  "per_turn_timing",
  "mid_conv_tool_change",
  "inline_tools",
  "server_side_fallback",
  "server_side_fallback_category",
  "fallback_credit",
  "auto_mode_classifier",
  "dangerous_tool_use",
  "thinking_display_updates",
  "message_threads",
  "mid_conversation_system_clear_at",
  "thinking_binding_controls",
];

/*
 * The nine entries new since 2.1.233, marked **NEW** in the section 4.1 table.
 * Four of them are INSERTED rather than appended, which is why the order test
 * above is order-sensitive: an append-only assumption mis-aligns eleven
 * entries.
 */
const NEW_SINCE_2_1_233: readonly string[] = [
  "thinking-resumption-2026-07-17",
  "timing-2026-09-09",
  "mid-conversation-tool-changes-2026-07-01",
  "inline-tools-2026-09-15",
  "dangerous-tool-use-2026-09-03",
  "thinking-display-updates-2026-08-18",
  "message-threads-2026-08-12",
  "mid-conversation-system-clear-at-2026-08-21",
  "thinking-binding-controls-2026-08-01",
];

/*
 * Upstream `Dg` at byte 7029997, in literal order. The conditional spread
 * `...BR ? [BR] : []` contributes `thinking-token-count-2026-05-13` in
 * thirteenth position because `BR` is unconditionally defined in this build.
 *
 * Fourteen members. This count is a COINCIDENCE: the default-path
 * `anthropic-beta` literal analysed in section 7.6 of the analysis document
 * also has fourteen identifiers, and the two sets are neither equal nor
 * related. Do not derive one from the other.
 */
const THIRD_PARTY_ALLOWED_IN_UPSTREAM_ORDER: readonly string[] = [
  "claude-code-20250219",
  "interleaved-thinking-2025-05-14",
  "context-1m-2025-08-07",
  "context-management-2025-06-27",
  "structured-outputs-2025-12-15",
  "web-search-2025-03-05",
  "effort-2025-11-24",
  "tool-search-tool-2025-10-19",
  "afk-mode-2026-01-31",
  "dangerous-tool-use-2026-09-03",
  "fallback-credit-2026-06-01",
  "mid-conversation-system-2026-04-07",
  "thinking-token-count-2026-05-13",
  "thinking-binding-controls-2026-08-01",
];

/* Upstream `qbr` at byte 6280270, in literal order. */
const BEDROCK_UNSUPPORTED_IN_UPSTREAM_ORDER: readonly string[] = [
  "interleaved-thinking-2025-05-14",
  "context-1m-2025-08-07",
  "tool-search-tool-2025-10-19",
];

/* Upstream `iNn` at byte 6280282, in literal order. */
const COUNT_TOKENS_IN_UPSTREAM_ORDER: readonly string[] = [
  "claude-code-20250219",
  "interleaved-thinking-2025-05-14",
  "context-management-2025-06-27",
  "oauth-2025-04-20",
];

/*
 * Registry members upstream declares through the same factory but EXCLUDES from
 * the ordered array. Their values are internal `x-cc-*` names, not beta
 * identifiers (analysis document section 4.3). Transcribing either one would
 * corrupt the registry, so their absence is asserted rather than assumed.
 */
const INTERNAL_NON_BETA_MEMBERS: readonly string[] = [
  "x-cc-internal-mid-conv-cache-promotion",
  "x-cc-internal-mid-conv-cache-promotion-ok",
];

const entries = Object.entries(BETA_REGISTRY_2_1_280);
const headers = entries.map(([, entry]) => entry.header);
const featureKeys = entries.map(([, entry]) => entry.featureKey);

describe("claude-code-2.1.280 beta registry", () => {
  it("has exactly 40 entries", () => {
    expect(entries).toHaveLength(40);
    expect(UPSTREAM_HEADERS_IN_ARRAY_ORDER).toHaveLength(40);
  });

  it("lists headers in upstream array order", () => {
    expect(headers).toEqual(UPSTREAM_HEADERS_IN_ARRAY_ORDER);
  });

  it("lists feature keys in upstream array order", () => {
    expect(featureKeys).toEqual(UPSTREAM_FEATURE_KEYS_IN_ARRAY_ORDER);
  });

  it("has no duplicate headers", () => {
    expect(new Set(headers).size).toBe(40);
    // Feature keys are NOT unique: `tool_search` is upstream's own duplicate.
    expect(new Set(featureKeys).size).toBe(39);
  });

  /*
   * Both the registry and this suite read section 4.1 of the analysis document,
   * so a defect introduced while READING that table -- a homoglyph hyphen
   * (U+2010), a trailing space, an uppercase letter -- would be copied into
   * both and agree with itself. Only a property assertion catches that class,
   * because it depends on neither transcription.
   */
  it("emits only lowercase ASCII beta identifiers", () => {
    expect(
      headers.filter((header) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(header)),
    ).toEqual([]);
    expect(
      featureKeys.filter((key) => !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(key)),
    ).toEqual([]);
  });

  it("carries the nine entries new since 2.1.233 and no others", () => {
    const previous = new Set(
      Object.values(BETA_REGISTRY_2_1_233).map((entry) => entry.header),
    );
    const current = new Set(headers);

    const added = headers.filter((header) => !previous.has(header));
    const removed = [...previous].filter((header) => !current.has(header));

    expect(added).toEqual(NEW_SINCE_2_1_233);
    expect(removed).toEqual([]);
  });

  /*
   * The two `null` slots at array indices 34 and 37 are filtered out upstream by
   * `.filter(e => e !== null)`. A null is not an entry, so nothing may stand in
   * for one -- not an empty header, not a placeholder key.
   */
  it("does not contain the two null slots or the two internal non-beta members", () => {
    for (const [key, entry] of entries) {
      expect({ key, header: entry.header.length > 0 }).toEqual({
        key,
        header: true,
      });
      expect({ key, featureKey: entry.featureKey.length > 0 }).toEqual({
        key,
        featureKey: true,
      });
    }

    for (const internal of INTERNAL_NON_BETA_MEMBERS) {
      expect(headers).not.toContain(internal);
    }
    expect(featureKeys).not.toContain("mid_conv_cache_promotion_latch");
    expect(featureKeys).not.toContain("mid_conv_cache_promotion_ok_latch");
  });

  /*
   * NEGATIVE ASSERTION, LOAD-BEARING, inherited from 2.1.233. Upstream removed
   * narration summaries in 2.1.222+ and 2.1.280 still does not send the header.
   * The expectation is read from the 2.1.195 registry so this test cannot drift
   * from the string the package considers canonical.
   */
  it("keeps narration_summaries absent", () => {
    const narration = BETA_REGISTRY.NARRATION_SUMMARIES;

    expect(narration.header).toBe("summarize-connector-text-2026-03-13");
    expect(headers).not.toContain(narration.header);
    expect(featureKeys).not.toContain(narration.featureKey);
    expect(Object.keys(BETA_REGISTRY_2_1_280)).not.toContain(
      "NARRATION_SUMMARIES",
    );
  });

  it("is deeply frozen", () => {
    expect(Object.isFrozen(BETA_REGISTRY_2_1_280)).toBe(true);
    for (const [key, entry] of entries) {
      expect({ key, frozen: Object.isFrozen(entry) }).toEqual({
        key,
        frozen: true,
      });
    }

    // Readonly is erased at runtime, so the freeze is what actually protects
    // the transcription. ESM is strict mode, so the write throws rather than
    // failing silently.
    const mutableView: { header: string } = BETA_REGISTRY_2_1_280.CLAUDE_CODE;
    expect(() => {
      mutableView.header = "mutated";
    }).toThrow(TypeError);
    expect(BETA_REGISTRY_2_1_280.CLAUDE_CODE.header).toBe(
      "claude-code-20250219",
    );
  });

  it("names entry 39 by uppercasing its feature key, per the file's convention", () => {
    /*
     * Load-bearing for Phase 3.2: the `ComposableBetaRegistry` key must match
     * this string character for character, or the push site is silently inert.
     *
     * The key is derived from the FEATURE KEY column, not from the upstream
     * alias -- the alias here is `V1`. `ADVANCED_TOOL_USE` is the one entry
     * named from its header instead, because it shares `tool_search` with
     * `TOOL_SEARCH` and two keys cannot collide.
     */
    expect(Object.keys(BETA_REGISTRY_2_1_280)).toContain(
      "MID_CONVERSATION_SYSTEM_CLEAR_AT",
    );
    expect(BETA_REGISTRY_2_1_280.MID_CONVERSATION_SYSTEM_CLEAR_AT).toEqual({
      featureKey: "mid_conversation_system_clear_at",
      header: "mid-conversation-system-clear-at-2026-08-21",
    });
  });

  it("places thinking_resumption between redact_thinking and thinking_token_count", () => {
    const index = headers.indexOf("thinking-resumption-2026-07-17");

    expect(index).toBe(16);
    expect(headers[index - 1]).toBe("redact-thinking-2026-02-12");
    expect(headers[index + 1]).toBe("thinking-token-count-2026-05-13");
  });

  it("places thinking_binding_controls last despite being declared earlier", () => {
    expect(headers.indexOf("thinking-binding-controls-2026-08-01")).toBe(39);
    expect(headers.at(-1)).toBe("thinking-binding-controls-2026-08-01");
  });

  /*
   * `Object.isFrozen` on a `Set` is weaker than it looks: freezing seals the
   * object's own properties but leaves the internal set data mutable, so
   * `.add()` still succeeds. The real guarantee is `ReadonlySet<string>`, which
   * is compile-time only. The assertion is kept because it does pin that the
   * exported object was frozen -- it is not evidence that the membership cannot
   * change at runtime, and must not be read as such.
   */
  it("THIRD_PARTY_ALLOWED_BETAS_2_1_280 has the 14 members in upstream order", () => {
    expect([...THIRD_PARTY_ALLOWED_BETAS_2_1_280]).toEqual(
      THIRD_PARTY_ALLOWED_IN_UPSTREAM_ORDER,
    );
    expect(Object.isFrozen(THIRD_PARTY_ALLOWED_BETAS_2_1_280)).toBe(true);
  });

  it("BEDROCK_UNSUPPORTED_BETAS_2_1_280 has the 3 members in upstream order", () => {
    expect([...BEDROCK_UNSUPPORTED_BETAS_2_1_280]).toEqual(
      BEDROCK_UNSUPPORTED_IN_UPSTREAM_ORDER,
    );
    expect(Object.isFrozen(BEDROCK_UNSUPPORTED_BETAS_2_1_280)).toBe(true);
  });

  it("COUNT_TOKENS_BETAS_2_1_280 has the 4 members in upstream order", () => {
    expect([...COUNT_TOKENS_BETAS_2_1_280]).toEqual(
      COUNT_TOKENS_IN_UPSTREAM_ORDER,
    );
    expect(Object.isFrozen(COUNT_TOKENS_BETAS_2_1_280)).toBe(true);
  });

  /*
   * TAUTOLOGICAL AGAINST TODAY'S SOURCE, DELIBERATELY KEPT. The three sets are
   * built from `BETA_REGISTRY_2_1_280.<KEY>.header` reads, so membership holds
   * by construction and this cannot fail on current data. It exists to catch
   * the next edit: the moment anyone writes a bare string literal into one of
   * the sets -- the obvious way to add a member -- this becomes a real check.
   */
  it("keeps every auxiliary-set member resolvable to a registry header", () => {
    const known = new Set(headers);
    const auxiliary = [
      ...THIRD_PARTY_ALLOWED_BETAS_2_1_280,
      ...BEDROCK_UNSUPPORTED_BETAS_2_1_280,
      ...COUNT_TOKENS_BETAS_2_1_280,
    ];

    expect(auxiliary.filter((header) => !known.has(header))).toEqual([]);
  });
});
