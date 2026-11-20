// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { composeBetasWithAudit } from "../../src/betas.js";
import type { ComposeBetasInput } from "../../src/betas.js";
import type { ClaudeCodeProtocolProfile } from "../../src/contracts.js";
import {
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
} from "../../src/index.js";
import { deriveCapabilities } from "../../src/model-capabilities.js";
import { isThinkingActive } from "../../src/thinking.js";

/*
 * Push positions of `composeBetasWithAudit` on 2.1.329. Positions are proven by
 * ordered sub-sequences and adjacency rather than a pinned full list, so a
 * later site that lands between two of these does not invalidate what is
 * proved here.
 */

const CLAUDE_CODE = "claude-code-20250219";
const CONTEXT_MANAGEMENT = "context-management-2025-06-27";
const PROMPT_CACHING_SCOPE = "prompt-caching-scope-2026-01-05";
const PER_TURN = "per-turn-control-2026-07-01";
const TOOL_CHANGES = "mid-conversation-tool-changes-2026-07-01";
const TOKEN_COUNT = "thinking-token-count-2026-05-13";
const CLEAR_AT = "mid-conversation-system-clear-at-2026-08-21";
const EFFORT = "effort-2025-11-24";
const BINDING = "thinking-binding-controls-2026-08-01";
const DISPLAY_UPDATES = "thinking-display-updates-2026-08-18";
const CACHE_DIAGNOSIS = "cache-diagnosis-2026-04-07";

function compose(
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile,
  overrides: Partial<ComposeBetasInput> = {},
): readonly string[] {
  const capabilities = deriveCapabilities(normalizedId, profile);
  const input: ComposeBetasInput = {
    rawModel: normalizedId,
    normalizedId,
    capabilities,
    thinkingDisplayActive: false,
    thinkingActive: isThinkingActive({ type: "adaptive" }, capabilities),
    ...overrides,
  };
  return composeBetasWithAudit(input, profile).betas;
}

const at = (list: readonly string[], header: string): number =>
  list.indexOf(header);

/** Asserts that every header is present and that they appear in this order. */
function expectOrder(list: readonly string[], order: readonly string[]): void {
  expect(list.filter((header) => order.includes(header))).toEqual(order);
}

describe("2.1.329 push sites", () => {
  describe("positions", () => {
    const composeDefault = (): readonly string[] =>
      compose("claude-opus-5-5", CLAUDE_CODE_2_1_329_PROFILE);

    it("pushes thinking-token-count after the per-request table and before clear-at", () => {
      const list = composeDefault();
      expectOrder(list, [
        CLAUDE_CODE,
        CONTEXT_MANAGEMENT,
        PROMPT_CACHING_SCOPE,
        PER_TURN,
        TOOL_CHANGES,
        TOKEN_COUNT,
        CLEAR_AT,
        EFFORT,
        BINDING,
        DISPLAY_UPDATES,
        CACHE_DIAGNOSIS,
      ]);
    });

    it("places thinking-token-count immediately after mid-conversation-tool-changes", () => {
      const list = composeDefault();
      expect(at(list, TOKEN_COUNT) - at(list, TOOL_CHANGES)).toBe(1);
      expect(at(list, CLEAR_AT) - at(list, TOKEN_COUNT)).toBe(1);
    });

    it("still pushes thinking-token-count for a model with no per-request betas", () => {
      // claude-opus-4-7 composes none of the mid-conversation betas, so site 6'
      // closes up directly behind the prompt-caching scope.
      const list = compose("claude-opus-4-7", CLAUDE_CODE_2_1_329_PROFILE);
      expect(at(list, TOKEN_COUNT) - at(list, PROMPT_CACHING_SCOPE)).toBe(1);
      expect(at(list, TOKEN_COUNT)).toBeLessThan(at(list, EFFORT));
    });

    it("keeps the same gates: no push without the interleaved-thinking capability", () => {
      const capabilities = {
        ...deriveCapabilities("claude-opus-5-5", CLAUDE_CODE_2_1_329_PROFILE),
        interleavedThinking: false,
      };
      const list = compose("claude-opus-5-5", CLAUDE_CODE_2_1_329_PROFILE, {
        capabilities,
      });
      expect(list).not.toContain(TOKEN_COUNT);
    });

    it("keeps the same gates: no push when the profile disables the beta", () => {
      const disabled: ClaudeCodeProtocolProfile = {
        ...CLAUDE_CODE_2_1_329_PROFILE,
        betaPolicy: {
          ...CLAUDE_CODE_2_1_329_PROFILE.betaPolicy,
          thinkingTokenCountEnabled: false,
        },
      };
      expect(compose("claude-opus-5-5", disabled)).not.toContain(TOKEN_COUNT);
    });

    it("keeps the same gates: no push without experimental betas", () => {
      const off: ClaudeCodeProtocolProfile = {
        ...CLAUDE_CODE_2_1_329_PROFILE,
        betaPolicy: {
          ...CLAUDE_CODE_2_1_329_PROFILE.betaPolicy,
          experimentalBetasEnabled: false,
        },
      };
      expect(compose("claude-opus-5-5", off)).not.toContain(TOKEN_COUNT);
    });

    it("pushes thinking-token-count exactly once", () => {
      const list = composeDefault();
      expect(list.filter((header) => header === TOKEN_COUNT)).toHaveLength(1);
    });
  });

  describe("earlier profiles keep the historical position", () => {
    it.each([
      ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
      ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
    ] as const)(
      "%s pushes thinking-token-count before context-management",
      (_label, profile) => {
        const list = compose("claude-opus-5-5", profile);
        expect(at(list, TOKEN_COUNT)).not.toBe(-1);
        expect(at(list, TOKEN_COUNT)).toBeLessThan(
          at(list, CONTEXT_MANAGEMENT),
        );
      },
    );
  });
});
