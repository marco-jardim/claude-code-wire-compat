// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { BETA_REGISTRY } from "../../src/beta-registry.js";
import { composeBetas, composeBetasWithAudit } from "../../src/betas.js";
import type { ComposeBetasInput } from "../../src/betas.js";
import type {
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
} from "../../src/contracts.js";
import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
} from "../../src/index.js";
import { deriveCapabilities } from "../../src/model-capabilities.js";
import { BETA_REGISTRY_2_1_233 } from "../../src/profiles/beta-registry-2.1.233.js";
import { BETA_REGISTRY_2_1_280 } from "../../src/profiles/beta-registry-2.1.280.js";
import { isThinkingActive } from "../../src/thinking.js";

/*
 * Sites 11a, 11b, 11c and 12a of `composeBetasWithAudit`. Positions are proven
 * by adjacency and ordered sub-sequences rather than a pinned full list: a
 * later phase adds a site and removes an identifier, and a pinned intermediate
 * list would prove less than the relative order does.
 *
 * Catalogue questions use capabilities derived from the real profile; guard
 * questions use the synthetic literal below so each conjunct can be flipped on
 * its own.
 */

const PER_TURN = "per-turn-control-2026-07-01";
const TOOL_CHANGES = "mid-conversation-tool-changes-2026-07-01";
const CLEAR_AT = "mid-conversation-system-clear-at-2026-08-21";
const BINDING = "thinking-binding-controls-2026-08-01";
const MID_SYSTEM = "mid-conversation-system-2026-04-07";
const EFFORT = "effort-2025-11-24";
const CLAUDE_CODE = "claude-code-20250219";
const SPEED = "fast-mode-2026-02-01";
const DISPLAY_UPDATES = "thinking-display-updates-2026-08-18";

const FOUR = [PER_TURN, TOOL_CHANGES, CLEAR_AT, BINDING] as const;

/** A caller request that puts no active thinking on the wire. */
const NO_THINKING = { type: "disabled" } as const;

const at = (list: readonly string[], header: string): number =>
  list.indexOf(header);

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
  midConvToolChange: false,
  perTurnEffort: false,
};

/** Every capability the four sites read, forced on. */
const FORCED_CAPABILITIES: ClaudeCodeCapabilities = {
  ...CAPABILITIES,
  midConvToolChange: true,
  perTurnEffort: true,
};

const INPUT: ComposeBetasInput = {
  rawModel: "claude-opus-5-5",
  normalizedId: "claude-opus-5-5",
  capabilities: CAPABILITIES,
  thinkingDisplayActive: false,
  thinkingActive: true,
};

const FORCED_INPUT: ComposeBetasInput = {
  ...INPUT,
  capabilities: FORCED_CAPABILITIES,
};

/*
 * Profiles are deep-frozen; a shallow spread yields a fresh object and mutates
 * nothing. Both copies keep the real id, so the registry resolved is the real
 * one.
 */
function withExperimental(
  profile: ClaudeCodeProtocolProfile,
  experimentalBetasEnabled: boolean,
): ClaudeCodeProtocolProfile {
  return {
    ...profile,
    betaPolicy: { ...profile.betaPolicy, experimentalBetasEnabled },
  };
}

const PROFILE_280_ON = withExperimental(CLAUDE_CODE_2_1_280_PROFILE, true);
const PROFILE_280_OFF = withExperimental(CLAUDE_CODE_2_1_280_PROFILE, false);

function realInput(
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile,
  thinkingRequest: unknown = { type: "adaptive" },
): ComposeBetasInput {
  // `thinkingActive` is derived too, as a real call site does: the caller's
  // thinking request plus the derived capabilities decide it.
  const capabilities = deriveCapabilities(normalizedId, profile);
  return {
    ...INPUT,
    rawModel: normalizedId,
    normalizedId,
    capabilities,
    thinkingActive: isThinkingActive(thinkingRequest, capabilities),
  };
}

function betas280(
  input: ComposeBetasInput,
  profile: ClaudeCodeProtocolProfile = PROFILE_280_ON,
): readonly string[] {
  return composeBetasWithAudit(input, profile).betas;
}

describe("2.1.280 push sites 11a-12a", () => {
  describe("positions", () => {
    // Composed inside each test, so a throwing composition fails that test
    // rather than erroring the whole suite at collection time.
    const composeDefault = (): readonly string[] =>
      betas280(realInput("claude-opus-5-5", PROFILE_280_ON));

    it("emits per-turn-control immediately after mid-conversation-system", () => {
      const list = composeDefault();
      expect(at(list, MID_SYSTEM)).not.toBe(-1);
      expect(at(list, PER_TURN)).not.toBe(-1);
      expect(at(list, PER_TURN) - at(list, MID_SYSTEM)).toBe(1);
    });

    it("emits mid-conversation-tool-changes then clear-at, in that order, all before effort", () => {
      const list = composeDefault();
      const order = [MID_SYSTEM, PER_TURN, TOOL_CHANGES, CLEAR_AT, EFFORT];
      const indices = order.map((header) => at(list, header));
      for (const index of indices) expect(index).not.toBe(-1);
      for (let i = 1; i < indices.length; i += 1) {
        expect({ pair: [order[i - 1], order[i]], ascending: true }).toEqual({
          pair: [order[i - 1], order[i]],
          ascending: indices[i] > indices[i - 1],
        });
      }
    });

    it("emits thinking-binding-controls immediately after effort", () => {
      const list = composeDefault();
      expect(at(list, EFFORT)).not.toBe(-1);
      expect(at(list, BINDING)).not.toBe(-1);
      expect(at(list, BINDING) - at(list, EFFORT)).toBe(1);
    });

    it("emits thinking-binding-controls before the speed header", () => {
      // Every other case here omits `speed`, so the speed site never fires and
      // nothing else would catch these two sites being transposed.
      const list = betas280({
        ...realInput("claude-opus-5-5", PROFILE_280_ON),
        speed: "fast",
      });
      expect(at(list, BINDING)).not.toBe(-1);
      expect(at(list, SPEED)).not.toBe(-1);
      expect(at(list, SPEED)).toBeGreaterThan(at(list, BINDING));
    });

    it("emits thinking-display-updates immediately after thinking-binding-controls and before the speed header", () => {
      // Pins site 12b on both sides in a composition where the speed site
      // fires: moving the 12b block later in the sequence fails here.
      const list = betas280({
        ...realInput("claude-opus-5-5", PROFILE_280_ON),
        speed: "fast",
      });
      expect(at(list, BINDING)).not.toBe(-1);
      expect(at(list, DISPLAY_UPDATES)).not.toBe(-1);
      expect(at(list, SPEED)).not.toBe(-1);
      expect(at(list, DISPLAY_UPDATES) - at(list, BINDING)).toBe(1);
      expect(at(list, SPEED)).toBeGreaterThan(at(list, DISPLAY_UPDATES));
    });
  });

  describe("catalogue-borne", () => {
    it("per-turn-control is absent for claude-fable-5 and present for claude-fable-5-1", () => {
      const fable5 = betas280(realInput("claude-fable-5", PROFILE_280_ON));
      const fable51 = betas280(realInput("claude-fable-5-1", PROFILE_280_ON));

      expect(fable5).not.toContain(PER_TURN);
      expect(fable51).toContain(PER_TURN);
      expect(fable5.filter((beta) => beta !== PER_TURN)).toEqual(
        fable51.filter((beta) => beta !== PER_TURN),
      );
    });

    /*
     * Both models lack `adaptive_thinking` but still derive `thinking` and
     * `interleavedThinking`, so a caller who asks for thinking gets `enabled`
     * thinking and site 12a fires: that site follows the thinking decision, not
     * the catalogue. "None of the four" therefore holds for a request with
     * thinking disabled; the three catalogue-borne sites stay silent either way.
     */
    it("claude-haiku-4-5 emits none of the four and no claude-code beta", () => {
      const list = betas280(
        realInput("claude-haiku-4-5", PROFILE_280_ON, NO_THINKING),
      );
      for (const header of FOUR) expect(list).not.toContain(header);
      expect(list).not.toContain(CLAUDE_CODE);

      const thinking = betas280(realInput("claude-haiku-4-5", PROFILE_280_ON));
      for (const header of [PER_TURN, TOOL_CHANGES, CLEAR_AT]) {
        expect(thinking).not.toContain(header);
      }
      expect(thinking).toContain(BINDING);
    });

    it("claude-mythos-5 emits none of the four", () => {
      const list = betas280(
        realInput("claude-mythos-5", PROFILE_280_ON, NO_THINKING),
      );
      for (const header of FOUR) expect(list).not.toContain(header);
      // Positive anchor: the first site excludes only haiku-class ids, so the
      // claude-code beta fires unconditionally for this model. An empty list
      // would otherwise satisfy every absence above.
      expect(list).toContain(CLAUDE_CODE);

      const thinking = betas280(realInput("claude-mythos-5", PROFILE_280_ON));
      for (const header of [PER_TURN, TOOL_CHANGES, CLEAR_AT]) {
        expect(thinking).not.toContain(header);
      }
      expect(thinking).toContain(CLAUDE_CODE);
    });
  });

  describe("guard negatives", () => {
    it("per-turn-control is absent when experimental is false though the capability is present", () => {
      expect(betas280(FORCED_INPUT, PROFILE_280_ON)).toContain(PER_TURN);
      expect(betas280(FORCED_INPUT, PROFILE_280_OFF)).not.toContain(PER_TURN);
    });

    it("per-turn-control is absent when the capability is false though experimental is true", () => {
      const input = {
        ...FORCED_INPUT,
        capabilities: { ...FORCED_CAPABILITIES, perTurnEffort: false },
      };
      expect(betas280(input, PROFILE_280_ON)).not.toContain(PER_TURN);
    });

    it("mid-conversation-tool-changes is absent when mid-conversation-system did not fire", () => {
      const input = {
        ...FORCED_INPUT,
        rawModel: "claude-haiku-4-5",
        normalizedId: "claude-haiku-4-5",
      };
      const list = betas280(input, PROFILE_280_ON);
      expect(list).not.toContain(MID_SYSTEM);
      expect(list).not.toContain(TOOL_CHANGES);
    });

    it("mid-conversation-tool-changes is absent when mid-conversation-system fired but midConvToolChange is false", () => {
      const input = {
        ...FORCED_INPUT,
        capabilities: { ...FORCED_CAPABILITIES, midConvToolChange: false },
      };
      const list = betas280(input, PROFILE_280_ON);
      expect(list).toContain(MID_SYSTEM);
      expect(list).not.toContain(TOOL_CHANGES);
      expect(betas280(FORCED_INPUT, PROFILE_280_ON)).toContain(TOOL_CHANGES);
    });

    it("mid-conversation-tool-changes is absent when experimental is false though both other conjuncts hold", () => {
      const list = betas280(FORCED_INPUT, PROFILE_280_OFF);
      expect(list).toContain(MID_SYSTEM);
      expect(list).not.toContain(TOOL_CHANGES);
    });

    it("clear-at is absent when experimental is false even though mid-conversation-system fired", () => {
      const list = betas280(FORCED_INPUT, PROFILE_280_OFF);
      expect(list).toContain(MID_SYSTEM);
      expect(list).not.toContain(CLEAR_AT);
      expect(betas280(FORCED_INPUT, PROFILE_280_ON)).toContain(CLEAR_AT);
    });

    it("clear-at is absent when mid-conversation-system did not fire", () => {
      const input = {
        ...FORCED_INPUT,
        rawModel: "claude-haiku-4-5",
        normalizedId: "claude-haiku-4-5",
      };
      const list = betas280(input, PROFILE_280_ON);
      expect(list).not.toContain(MID_SYSTEM);
      expect(list).not.toContain(CLEAR_AT);
    });

    it("thinking-binding-controls is absent when experimental is false though thinking is active", () => {
      expect(betas280(FORCED_INPUT, PROFILE_280_ON)).toContain(BINDING);
      expect(betas280(FORCED_INPUT, PROFILE_280_OFF)).not.toContain(BINDING);
    });

    it("thinking-binding-controls is absent when thinkingActive is false", () => {
      const input = { ...FORCED_INPUT, thinkingActive: false };
      expect(betas280(FORCED_INPUT, PROFILE_280_ON)).toContain(BINDING);
      expect(betas280(input, PROFILE_280_ON)).not.toContain(BINDING);
    });
  });

  describe("registry-borne inertness", () => {
    it("all four sites are inert for 2.1.195 even with every capability forced", () => {
      // Registry absence, not the guards, is what makes this true: every guard
      // conjunct below is forced on, and the 2.1.195 registry has no entry for
      // any of the four sites to push.
      const profile = withExperimental(CLAUDE_CODE_2_1_195_PROFILE, true);
      const list = composeBetas(FORCED_INPUT, profile);
      for (const header of FOUR) expect(list).not.toContain(header);
      // Positive anchors, so an empty composition cannot pass: the input's id
      // is not haiku-class, so the claude-code site fires, and the effort site
      // is gated only on the forced `effort` capability.
      expect(list).toContain(CLAUDE_CODE);
      expect(list).toContain(EFFORT);
    });

    it("three of the four are inert for 2.1.233 even with every capability forced, and per-turn-control is not", () => {
      /*
       * The 2.1.233 registry declares `PER_MESSAGE_EFFORT`, so what keeps this
       * site silent on that profile in practice is the catalogue, not the
       * registry. This test drives the internal composition function directly
       * with the capability forced on. Through the public builder that same
       * override is refused: `requestedCapabilities` throws
       * `UNSUPPORTED_CAPABILITY` for any capability the catalogue does not
       * declare. The only public route to this behaviour is a profile override
       * whose model catalogue declares the capability.
       */
      const profile = withExperimental(CLAUDE_CODE_2_1_233_PROFILE, true);
      const list = composeBetas(FORCED_INPUT, profile);
      expect(list).not.toContain(TOOL_CHANGES);
      expect(list).not.toContain(CLEAR_AT);
      expect(list).not.toContain(BINDING);
      expect(list).toContain(PER_TURN);
    });

    it("no 2.1.233 catalogue model derives perTurnEffort, so the default 2.1.233 composition never carries per-turn-control", () => {
      const forcedOn = withExperimental(CLAUDE_CODE_2_1_233_PROFILE, true);
      const ids = Object.keys(CLAUDE_CODE_2_1_233_PROFILE.supportedModels);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        const input = realInput(id, CLAUDE_CODE_2_1_233_PROFILE);
        expect({ id, perTurnEffort: input.capabilities.perTurnEffort }).toEqual(
          { id, perTurnEffort: false },
        );
        for (const profile of [CLAUDE_CODE_2_1_233_PROFILE, forcedOn]) {
          expect({
            id,
            carries: composeBetas(input, profile).includes(PER_TURN),
          }).toEqual({ id, carries: false });
        }
      }
    });

    it("the older registries lack the keys the new sites index", () => {
      const keys = [
        "PER_MESSAGE_EFFORT",
        "MID_CONV_TOOL_CHANGE",
        "MID_CONVERSATION_SYSTEM_CLEAR_AT",
        "THINKING_BINDING_CONTROLS",
        "THINKING_DISPLAY_UPDATES",
      ] as const;
      const defined = (registry: object): Record<string, boolean> =>
        Object.fromEntries(
          keys.map((key) => [
            key,
            (registry as Record<string, unknown>)[key] !== undefined,
          ]),
        );

      expect(defined(BETA_REGISTRY)).toEqual({
        PER_MESSAGE_EFFORT: false,
        MID_CONV_TOOL_CHANGE: false,
        MID_CONVERSATION_SYSTEM_CLEAR_AT: false,
        THINKING_BINDING_CONTROLS: false,
        THINKING_DISPLAY_UPDATES: false,
      });
      expect(defined(BETA_REGISTRY_2_1_233)).toEqual({
        PER_MESSAGE_EFFORT: true,
        MID_CONV_TOOL_CHANGE: false,
        MID_CONVERSATION_SYSTEM_CLEAR_AT: false,
        THINKING_BINDING_CONTROLS: false,
        THINKING_DISPLAY_UPDATES: false,
      });
      expect(defined(BETA_REGISTRY_2_1_280)).toEqual({
        PER_MESSAGE_EFFORT: true,
        MID_CONV_TOOL_CHANGE: true,
        MID_CONVERSATION_SYSTEM_CLEAR_AT: true,
        THINKING_BINDING_CONTROLS: true,
        THINKING_DISPLAY_UPDATES: true,
      });
    });
  });

  describe("isThinkingActive", () => {
    it("is true for adaptive thinking on an interleaved-capable model", () => {
      expect(isThinkingActive({ type: "adaptive" }, CAPABILITIES)).toBe(true);
    });

    it("is false when the caller disabled thinking", () => {
      expect(isThinkingActive({ type: "disabled" }, CAPABILITIES)).toBe(false);
    });

    it("is false when the caller supplied no thinking at all", () => {
      expect(isThinkingActive(undefined, CAPABILITIES)).toBe(false);
    });

    it("is false for a model without the thinking capability even when the caller asked for adaptive", () => {
      expect(
        isThinkingActive(
          { type: "adaptive" },
          { ...CAPABILITIES, thinking: false },
        ),
      ).toBe(false);
    });

    it("is false for a model without interleavedThinking", () => {
      expect(
        isThinkingActive(
          { type: "adaptive" },
          { ...CAPABILITIES, interleavedThinking: false },
        ),
      ).toBe(false);
    });

    it("tolerates a malformed thinking value", () => {
      expect(() => isThinkingActive(null, CAPABILITIES)).not.toThrow();
      expect(isThinkingActive(null, CAPABILITIES)).toBe(false);
      expect(() =>
        isThinkingActive({ type: "nonsense" }, CAPABILITIES),
      ).not.toThrow();
      expect(isThinkingActive({ type: "nonsense" }, CAPABILITIES)).toBe(false);
    });
  });

  describe("error precedence", () => {
    /*
     * This input is invalid on two independent axes: the caller beta list
     * (rejected inside beta composition) and the thinking request (rejected
     * during canonical body construction). Each alone yields its own code.
     * The test exists to pin which validator reports first, because the
     * composition / body-construction order in the builder is load-bearing
     * for that answer: composition runs first, so the beta error wins.
     */
    it("reports the beta-list error when both the betas and the thinking request are invalid", async () => {
      const input: ClaudeCodeRequestInput = {
        accessToken: "error-precedence-token",
        model: "claude-opus-5-5",
        maxTokens: 1024,
        messages: [{ role: "user", content: "hello wire compat" }],
        runtime: {
          sessionId: "11111111-1111-4111-8111-111111111111",
          deviceId: "22222222-2222-4222-8222-222222222222",
          accountUuid: "33333333-3333-4333-8333-333333333333",
          runtime: "node",
          runtimeVersion: "22.0.0",
          os: "Linux",
          arch: "x64",
        },
        clientRequestId: "error-precedence-request-1",
        additionalBetas: [""],
      };
      const thinking = { type: "nonsense" } as unknown as NonNullable<
        ClaudeCodeRequestInput["thinking"]
      >;

      await expect(
        buildClaudeCodeRequest(
          { ...input, additionalBetas: ["valid-2026-01-01"], thinking },
          CLAUDE_CODE_2_1_280_PROFILE,
        ),
      ).rejects.toMatchObject({ code: "INVALID_THINKING" });
      await expect(
        buildClaudeCodeRequest(
          { ...input, thinking },
          CLAUDE_CODE_2_1_280_PROFILE,
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
  });
});
