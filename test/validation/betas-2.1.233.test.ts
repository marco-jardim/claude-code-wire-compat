// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { composeBetas, composeBetasWithAudit } from "../../src/betas.js";
import type { ClaudeCodeCapabilities } from "../../src/contracts.js";
import { ClaudeCodeWireError } from "../../src/contracts.js";
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
} from "../../src/index.js";
import {
  BEDROCK_UNSUPPORTED_BETAS_2_1_233,
  BETA_REGISTRY_2_1_233,
  COUNT_TOKENS_BETAS_2_1_233,
  THIRD_PARTY_ALLOWED_BETAS_2_1_233,
} from "../../src/profiles/beta-registry-2.1.233.js";

/*
 * The registry itself is not public surface, so it is imported from its
 * module. The two profiles come from the public entry point, which is also
 * what `test/governance/public-path-coverage.test.ts` requires of every file
 * in this directory.
 *
 * Most of the composition cases below run against a synthetic profile -- the
 * 2.1.195 profile with the 2.1.233 id -- to isolate the registry from every
 * other field. The last block runs the exported 2.1.233 profile itself, so
 * the wiring from a real profile to its registry is covered too.
 */

/** Transcribed key order, upstream `Fb_` at byte offset 287505865. */
const EXPECTED_KEYS = [
  "CLAUDE_CODE",
  "OAUTH_AUTH",
  "INTERLEAVED_THINKING",
  "LONG_CONTEXT",
  "CONTEXT_MANAGEMENT",
  "STRUCTURED_OUTPUTS",
  "WEB_SEARCH",
  "ADVANCED_TOOL_USE",
  "TOOL_SEARCH",
  "EFFORT",
  "TASK_BUDGETS",
  "PROMPT_CACHING_SCOPE",
  "PROMPT_CACHING_EVICT",
  "EXTENDED_CACHE_TTL",
  "SPEED",
  "REDACT_THINKING",
  "THINKING_TOKEN_COUNT",
  "AFK_MODE",
  "ADVISOR_TOOL",
  "CACHE_DIAGNOSIS",
  "CONTEXT_HINT",
  "MCP_SERVERS",
  "FILES_API",
  "ENVIRONMENTS",
  "CCR_BYOC",
  "MID_CONVERSATION_SYSTEM",
  "PER_MESSAGE_EFFORT",
  "SERVER_SIDE_FALLBACK",
  "SERVER_SIDE_FALLBACK_CATEGORY",
  "FALLBACK_CREDIT",
  "AUTO_MODE_CLASSIFIER",
] as const;

const NARRATION_HEADER = "summarize-connector-text-2026-03-13";
const PROFILE_ID_233 = "claude-code-2.1.233-sdk-0.112.1";

const CAPABILITIES: ClaudeCodeCapabilities = {
  thinking: true,
  adaptiveThinking: true,
  interleavedThinking: true,
  effort: true,
  maxEffort: true,
  xhighEffort: true,
  contextManagement: true,
  temperature: false,
  rejectsDisabledThinking: false,
};

const INPUT = {
  rawModel: "claude-opus-4-8",
  normalizedId: "claude-opus-4-8",
  capabilities: CAPABILITIES,
  thinkingDisplayActive: false,
} as const;

/*
 * Both profiles force the two gates that guard the narration push site, so the
 * comparison isolates the registry: the only reason 2.1.233 can differ is that
 * its registry has no entry to push.
 */
const NARRATION_POLICY = {
  ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
  experimentalBetasEnabled: true,
  narrationSummariesEnabled: true,
} as const;

const PROFILE_195_NARRATION = {
  ...CLAUDE_CODE_2_1_195_PROFILE,
  betaPolicy: NARRATION_POLICY,
};

const PROFILE_233 = {
  ...CLAUDE_CODE_2_1_195_PROFILE,
  id: PROFILE_ID_233,
  betaPolicy: NARRATION_POLICY,
};

describe("2.1.233 beta registry", () => {
  it("transcribes 31 entries in upstream key order", () => {
    // Full-array equality, not `toContain`: the order is the transcription of
    // record, so an entry that moved must fail exactly like one that vanished.
    expect(Object.keys(BETA_REGISTRY_2_1_233)).toEqual([...EXPECTED_KEYS]);
    expect(Object.keys(BETA_REGISTRY_2_1_233)).toHaveLength(31);
  });

  it("places the new cache-eviction beta between scope and extended TTL", () => {
    const keys = Object.keys(BETA_REGISTRY_2_1_233);
    expect(keys.indexOf("PROMPT_CACHING_EVICT")).toBe(
      keys.indexOf("PROMPT_CACHING_SCOPE") + 1,
    );
    expect(keys.indexOf("EXTENDED_CACHE_TTL")).toBe(
      keys.indexOf("PROMPT_CACHING_EVICT") + 1,
    );
  });

  it("carries no narration-summaries entry", () => {
    expect(Object.keys(BETA_REGISTRY_2_1_233)).not.toContain(
      "NARRATION_SUMMARIES",
    );
    expect(
      Object.values(BETA_REGISTRY_2_1_233).map((entry) => entry.header),
    ).not.toContain(NARRATION_HEADER);
    expect(
      Object.values(BETA_REGISTRY_2_1_233).map((entry) => entry.featureKey),
    ).not.toContain("narration_summaries");
  });

  it("freezes the registry and its entries", () => {
    expect(Object.isFrozen(BETA_REGISTRY_2_1_233)).toBe(true);
    for (const entry of Object.values(BETA_REGISTRY_2_1_233)) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  it("allows exactly eleven headers to third parties", () => {
    expect([...THIRD_PARTY_ALLOWED_BETAS_2_1_233].sort()).toEqual(
      [
        "claude-code-20250219",
        "interleaved-thinking-2025-05-14",
        "context-1m-2025-08-07",
        "context-management-2025-06-27",
        "structured-outputs-2025-12-15",
        "web-search-2025-03-05",
        "effort-2025-11-24",
        "tool-search-tool-2025-10-19",
        "afk-mode-2026-01-31",
        "fallback-credit-2026-06-01",
        "mid-conversation-system-2026-04-07",
      ].sort(),
    );
    expect(THIRD_PARTY_ALLOWED_BETAS_2_1_233.size).toBe(11);
    // The delta against 2.1.195 is an addition and nothing else.
    expect(
      THIRD_PARTY_ALLOWED_BETAS_2_1_233.has(
        "mid-conversation-system-2026-04-07",
      ),
    ).toBe(true);
  });

  it("keeps the provider-unsupported set unchanged from 2.1.195", () => {
    expect([...BEDROCK_UNSUPPORTED_BETAS_2_1_233].sort()).toEqual(
      [
        "interleaved-thinking-2025-05-14",
        "context-1m-2025-08-07",
        "tool-search-tool-2025-10-19",
      ].sort(),
    );
  });

  it("keeps the count-tokens selection unchanged from 2.1.195", () => {
    expect([...COUNT_TOKENS_BETAS_2_1_233].sort()).toEqual(
      [
        "claude-code-20250219",
        "interleaved-thinking-2025-05-14",
        "context-management-2025-06-27",
        "oauth-2025-04-20",
      ].sort(),
    );
  });
});

describe("2.1.233 beta composition", () => {
  it("emits narration for 2.1.195 when the policy enables it", () => {
    expect(composeBetas(INPUT, PROFILE_195_NARRATION)).toContain(
      NARRATION_HEADER,
    );
  });

  it("emits no narration for 2.1.233 under the same policy", () => {
    expect(() => composeBetas(INPUT, PROFILE_233)).not.toThrow();
    expect(composeBetas(INPUT, PROFILE_233)).not.toContain(NARRATION_HEADER);
  });

  it("differs from 2.1.195 by the narration header and nothing else", () => {
    const betas195 = composeBetas(INPUT, PROFILE_195_NARRATION);
    const betas233 = composeBetas(INPUT, PROFILE_233);

    expect(betas233).toEqual(
      betas195.filter((beta) => beta !== NARRATION_HEADER),
    );
  });

  it("closes the sequence over the absent entry without leaving a gap", () => {
    const betas195 = composeBetas(INPUT, PROFILE_195_NARRATION);
    const betas233 = composeBetas(INPUT, PROFILE_233);
    const position = betas195.indexOf(NARRATION_HEADER);

    // The scenario is only meaningful if betas are emitted on BOTH sides of the
    // removed one; an absence at either end could not expose a gap.
    expect(position).toBeGreaterThan(0);
    expect(position).toBeLessThan(betas195.length - 1);

    const before = betas195[position - 1];
    const after = betas195[position + 1];
    expect(betas233.indexOf(after)).toBe(betas233.indexOf(before) + 1);
    expect(betas233).toHaveLength(betas195.length - 1);
  });

  it("appends additionalBetas after the canonical set", () => {
    const betas = composeBetas(
      { ...INPUT, additionalBetas: ["custom-beta-1", "custom-beta-2"] },
      PROFILE_233,
    );
    const canonical = composeBetas(INPUT, PROFILE_233);

    expect(betas).toEqual([...canonical, "custom-beta-1", "custom-beta-2"]);
  });

  it("drops an additionalBeta that duplicates an emitted identifier", () => {
    const canonical = composeBetas(INPUT, PROFILE_233);
    const duplicate = canonical[0];
    const betas = composeBetas(
      { ...INPUT, additionalBetas: [duplicate, "custom-beta-1"] },
      PROFILE_233,
    );

    expect(betas).toEqual([...canonical, "custom-beta-1"]);
  });

  it("rejects an empty additionalBeta", () => {
    expect(() =>
      composeBetas({ ...INPUT, additionalBetas: [""] }, PROFILE_233),
    ).toThrow(ClaudeCodeWireError);
  });

  it("applies suppression last, beating additionalBetas", () => {
    const canonical = composeBetas(INPUT, PROFILE_233);
    const result = composeBetasWithAudit(
      {
        ...INPUT,
        additionalBetas: ["custom-beta-1"],
        suppressBetas: ["custom-beta-1", canonical[0]],
      },
      PROFILE_233,
    );

    expect(result.betas).toEqual(canonical.slice(1));
    expect(result.suppressedBetaNames).toEqual([canonical[0], "custom-beta-1"]);
  });

  it("ignores suppression of an identifier that was never composed", () => {
    const canonical = composeBetas(INPUT, PROFILE_233);
    const result = composeBetasWithAudit(
      { ...INPUT, suppressBetas: [NARRATION_HEADER, "never-composed"] },
      PROFILE_233,
    );

    expect(result.betas).toEqual(canonical);
    expect(result.suppressedBetaNames).toEqual([]);
  });

  it("leaves the 2.1.195 default composition byte-identical", () => {
    // Pinned array, not a comparison against another call: this is the value a
    // consumer on the default profile receives, and profile-aware resolution
    // must not have moved it.
    expect(composeBetas(INPUT)).toEqual([
      "claude-code-20250219",
      "oauth-2025-04-20",
      "interleaved-thinking-2025-05-14",
      "redact-thinking-2026-02-12",
      "thinking-token-count-2026-05-13",
      "context-management-2025-06-27",
      "prompt-caching-scope-2026-01-05",
      "mid-conversation-system-2026-04-07",
      "effort-2025-11-24",
    ]);
    expect(composeBetas(INPUT)).toEqual(
      composeBetas(INPUT, CLAUDE_CODE_2_1_195_PROFILE),
    );
  });
});

describe("2.1.233 beta composition through the exported profile", () => {
  it("emits no narration header for the profile as shipped", () => {
    expect(() =>
      composeBetas(INPUT, CLAUDE_CODE_2_1_233_PROFILE),
    ).not.toThrow();
    expect(composeBetas(INPUT, CLAUDE_CODE_2_1_233_PROFILE)).not.toContain(
      NARRATION_HEADER,
    );
  });

  it("still emits no narration header when the policy demands one", () => {
    /*
     * As shipped the flag is already false, so an absent header proves
     * nothing on its own. Forcing the flag on removes that explanation: the
     * header stays away because the registry the profile id resolves has no
     * entry to push, and the same forced policy on 2.1.195 does emit it.
     *
     * The profile is deep-frozen; a shallow spread yields a fresh object and
     * mutates nothing.
     */
    const forced = {
      ...CLAUDE_CODE_2_1_233_PROFILE,
      betaPolicy: {
        ...CLAUDE_CODE_2_1_233_PROFILE.betaPolicy,
        experimentalBetasEnabled: true,
        narrationSummariesEnabled: true,
      },
    };

    expect(composeBetas(INPUT, forced)).not.toContain(NARRATION_HEADER);
    expect(composeBetas(INPUT, PROFILE_195_NARRATION)).toContain(
      NARRATION_HEADER,
    );
  });

  it("composes exactly as the synthetic profile does", () => {
    // The synthetic profile carries the 2.1.233 id and nothing else from it.
    // Agreeing with the real one confirms the id is what selects the registry.
    expect(composeBetas(INPUT, CLAUDE_CODE_2_1_233_PROFILE)).toEqual(
      composeBetas(INPUT, PROFILE_233),
    );
  });
});
