// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { BETA_REGISTRY, BETA_REGISTRY_2_1_280 } from "../../src/index.js";
import {
  BEDROCK_UNSUPPORTED_BETAS_2_1_280,
  COUNT_TOKENS_BETAS_2_1_280,
} from "../../src/profiles/beta-registry-2.1.280.js";
import {
  BEDROCK_UNSUPPORTED_BETAS_2_1_329,
  BETA_REGISTRY_2_1_329,
  COUNT_TOKENS_BETAS_2_1_329,
  THIRD_PARTY_ALLOWED_BETAS_2_1_329,
} from "../../src/profiles/beta-registry-2.1.329.js";

/*
 * The expected key order is the upstream array order (`a1i` at view line
 * 109432), transcribed here independently of the module under test: 48 raw
 * slots, two nulls and one header-less slot, leaving forty-five entries.
 */
const EXPECTED_KEYS: readonly string[] = [
  "CLAUDE_CODE",
  "OAUTH_AUTH",
  "INTERLEAVED_THINKING",
  "LONG_CONTEXT",
  "CONTEXT_MANAGEMENT",
  "STRUCTURED_OUTPUTS",
  "WEB_SEARCH",
  "WEB_SEARCH_RESULTS_ONLY",
  "ADVANCED_TOOL_USE",
  "TOOL_SEARCH",
  "EFFORT",
  "TASK_BUDGETS",
  "PROMPT_CACHING_SCOPE",
  "PROMPT_CACHING_EVICT",
  "CACHE_KEEPALIVE",
  "EXTENDED_CACHE_TTL",
  "SPEED",
  "REDACT_THINKING",
  "THINKING_RESUMPTION",
  "RESUMPTION",
  "THINKING_TOKEN_COUNT",
  "AFK_MODE",
  "ADVISOR_TOOL",
  "CACHE_DIAGNOSIS",
  "CONTEXT_HINT",
  "MCP_SERVERS",
  "FILES_API",
  "ENVIRONMENTS",
  "CCR_BYOC",
  "TOOL_PROVENANCE",
  "PER_MESSAGE_EFFORT",
  "PER_TURN_TIMING",
  "MID_CONV_TOOL_CHANGE",
  "INLINE_TOOLS",
  "SERVER_SIDE_FALLBACK",
  "PROGRAM_USE_CASE_IDS",
  "SERVER_SIDE_FALLBACK_CATEGORY",
  "FALLBACK_CREDIT",
  "AUTO_MODE_CLASSIFIER",
  "CLAUDE_CODE_SIDE_QUERY",
  "DANGEROUS_TOOL_USE",
  "THINKING_DISPLAY_UPDATES",
  "MESSAGE_THREADS",
  "MID_CONVERSATION_SYSTEM_CLEAR_AT",
  "THINKING_BINDING_CONTROLS",
];

describe("2.1.329 beta registry", () => {
  it("carries the forty-five entries in upstream array order", () => {
    expect(Object.keys(BETA_REGISTRY_2_1_329)).toEqual(EXPECTED_KEYS);
    expect(EXPECTED_KEYS).toHaveLength(45);
  });

  it("is deeply frozen", () => {
    expect(Object.isFrozen(BETA_REGISTRY_2_1_329)).toBe(true);
    for (const entry of Object.values(BETA_REGISTRY_2_1_329)) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  it("carries the six entries new since 2.1.280, with their exact pairs", () => {
    expect(BETA_REGISTRY_2_1_329.WEB_SEARCH_RESULTS_ONLY).toEqual({
      featureKey: "web_search_results_only",
      header: "web-search-results-only-2026-11-15",
    });
    expect(BETA_REGISTRY_2_1_329.CACHE_KEEPALIVE).toEqual({
      featureKey: "cache_keepalive",
      header: "cache-keepalive-2026-09-03",
    });
    expect(BETA_REGISTRY_2_1_329.RESUMPTION).toEqual({
      featureKey: "resumption",
      header: "resumption-2026-10-08",
    });
    expect(BETA_REGISTRY_2_1_329.TOOL_PROVENANCE).toEqual({
      featureKey: "ccr_tool_provenance",
      header: "tool-provenance-2026-10-26",
    });
    expect(BETA_REGISTRY_2_1_329.PROGRAM_USE_CASE_IDS).toEqual({
      featureKey: "program_use_case_ids",
      header: "program-use-case-ids-2026-09-17",
    });
    expect(BETA_REGISTRY_2_1_329.CLAUDE_CODE_SIDE_QUERY).toEqual({
      featureKey: "claude_code_side_query",
      header: "claude-code-side-query-2026-09-29",
    });
  });

  it("is exactly the 2.1.280 registry plus those six, minus mid-conversation-system", () => {
    const previous = new Set(Object.keys(BETA_REGISTRY_2_1_280));
    const current = new Set(Object.keys(BETA_REGISTRY_2_1_329));
    const added = [...current].filter((key) => !previous.has(key)).sort();
    const removed = [...previous].filter((key) => !current.has(key)).sort();

    expect(added).toEqual([
      "CACHE_KEEPALIVE",
      "CLAUDE_CODE_SIDE_QUERY",
      "PROGRAM_USE_CASE_IDS",
      "RESUMPTION",
      "TOOL_PROVENANCE",
      "WEB_SEARCH_RESULTS_ONLY",
    ]);
    expect(removed).toEqual(["MID_CONVERSATION_SYSTEM"]);
  });

  it("keeps every entry that already existed byte-identical", () => {
    const current: Readonly<Record<string, unknown>> = BETA_REGISTRY_2_1_329;

    for (const [key, entry] of Object.entries(BETA_REGISTRY_2_1_280)) {
      if (key === "MID_CONVERSATION_SYSTEM") continue;
      expect({ key, entry: current[key] }).toEqual({ key, entry });
    }
  });

  /*
   * NEGATIVE ASSERTIONS, LOAD-BEARING. The mid-conversation-system slot is
   * header-less in 2.1.329 and narration summaries were removed upstream
   * before 2.1.233. Re-adding either would emit an identifier the genuine
   * client does not send.
   */
  it("carries no mid-conversation-system or narration-summaries entry", () => {
    const keys = Object.keys(BETA_REGISTRY_2_1_329);
    const headers = Object.values(BETA_REGISTRY_2_1_329).map(
      (entry) => entry.header,
    );
    const featureKeys = Object.values(BETA_REGISTRY_2_1_329).map(
      (entry) => entry.featureKey,
    );

    expect(keys).not.toContain("MID_CONVERSATION_SYSTEM");
    expect(keys).not.toContain("NARRATION_SUMMARIES");
    expect(headers).not.toContain("mid-conversation-system-2026-04-07");
    expect(headers).not.toContain("summarize-connector-text-2026-03-13");
    expect(featureKeys).not.toContain("mid_conversation_system");
    expect(featureKeys).not.toContain("narration_summaries");
    // Anti-vacuity: the 2.1.195 registry does carry the narration entry.
    expect(Object.keys(BETA_REGISTRY)).toContain("NARRATION_SUMMARIES");
  });

  it("has no duplicate header, and reuses tool_search across two headers", () => {
    const entries = Object.values(BETA_REGISTRY_2_1_329);
    const headers = entries.map((entry) => entry.header);

    expect(new Set(headers).size).toBe(headers.length);
    expect(
      entries
        .filter((entry) => entry.featureKey === "tool_search")
        .map((entry) => entry.header)
        .sort(),
    ).toEqual(["advanced-tool-use-2025-11-20", "tool-search-tool-2025-10-19"]);
  });

  it("keeps the unchanged beta sets identical to 2.1.280", () => {
    expect([...BEDROCK_UNSUPPORTED_BETAS_2_1_329]).toEqual([
      ...BEDROCK_UNSUPPORTED_BETAS_2_1_280,
    ]);
    expect([...COUNT_TOKENS_BETAS_2_1_329]).toEqual([
      ...COUNT_TOKENS_BETAS_2_1_280,
    ]);
    expect(BEDROCK_UNSUPPORTED_BETAS_2_1_329.size).toBe(3);
    expect(COUNT_TOKENS_BETAS_2_1_329.size).toBe(4);
  });

  it("pins the fourteen-member third-party set in upstream order", () => {
    expect([...THIRD_PARTY_ALLOWED_BETAS_2_1_329]).toEqual([
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
      "thinking-token-count-2026-05-13",
      "thinking-binding-controls-2026-08-01",
      "thinking-display-updates-2026-08-18",
    ]);
  });
});
