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
 * Fourteen members. This count is a COINCIDENCE, unrelated to the fourteen
 * identifiers of the default-path `anthropic-beta` literal.
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

  it("has no duplicate headers", () => {
    expect(new Set(headers).size).toBe(40);
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

  it("names entry 39 by the registry's own alias-uppercasing convention", () => {
    /*
     * Load-bearing for Phase 3.2: the `ComposableBetaRegistry` key must match
     * this string character for character, or the push site is silently inert.
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

  it("every auxiliary-set member is a registry header", () => {
    const known = new Set(headers);
    const auxiliary = [
      ...THIRD_PARTY_ALLOWED_BETAS_2_1_280,
      ...BEDROCK_UNSUPPORTED_BETAS_2_1_280,
      ...COUNT_TOKENS_BETAS_2_1_280,
    ];

    expect(auxiliary.filter((header) => !known.has(header))).toEqual([]);
  });
});
