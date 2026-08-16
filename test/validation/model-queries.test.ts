// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  hasOneMillionContext,
  isAdaptiveThinkingModel,
  isClaude3Model,
  isEligibleFor1MContext,
  isFable5Model,
  isHaikuModel,
  isMythos5Model,
  isOpus46Model,
  isOpus47Model,
  isOpus48Model,
  isSonnet46Model,
  modelCapability,
  supportsStructuredOutputs,
  supportsWebSearch,
} from "../../src/index.js";
import type { ClaudeCodeProtocolProfile } from "../../src/index.js";

/** Rebuilds the pinned profile with one catalogue entry's capabilities replaced. */
function withCapabilities(
  modelId: string,
  capabilities: readonly string[],
): ClaudeCodeProtocolProfile {
  const entry = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[modelId];
  if (entry === undefined) {
    throw new TypeError(`Missing catalogue entry for ${modelId}.`);
  }
  return {
    ...CLAUDE_CODE_2_1_195_PROFILE,
    supportedModels: {
      ...CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
      [modelId]: { ...entry, capabilities },
    },
  };
}

/** Every query that takes a bare model id, for the shared invalid-input law. */
const MODEL_ONLY_QUERIES: readonly (readonly [
  string,
  (model: string) => boolean,
])[] = Object.freeze([
  ["isOpus46Model", isOpus46Model],
  ["isOpus47Model", isOpus47Model],
  ["isOpus48Model", isOpus48Model],
  ["isSonnet46Model", isSonnet46Model],
  ["isFable5Model", isFable5Model],
  ["isMythos5Model", isMythos5Model],
  ["isHaikuModel", isHaikuModel],
  ["isClaude3Model", isClaude3Model],
  ["isEligibleFor1MContext", isEligibleFor1MContext],
  ["hasOneMillionContext", hasOneMillionContext],
  ["supportsStructuredOutputs", supportsStructuredOutputs],
  ["supportsWebSearch", supportsWebSearch],
  ["isAdaptiveThinkingModel", isAdaptiveThinkingModel],
] as const);

describe("model queries", () => {
  describe("invalid input", () => {
    it.each(MODEL_ONLY_QUERIES)(
      "%s answers false for an empty id instead of throwing",
      (_name, query) => {
        expect(query("")).toBe(false);
      },
    );

    it.each(MODEL_ONLY_QUERIES)(
      "%s answers false for a non-string id instead of throwing",
      (_name, query) => {
        expect(Reflect.apply(query, undefined, [42])).toBe(false);
      },
    );

    it("modelCapability answers false for empty ids and empty capabilities", () => {
      expect(modelCapability("", "effort")).toBe(false);
      expect(modelCapability("claude-opus-4-7", "")).toBe(false);
      expect(
        Reflect.apply(modelCapability, undefined, ["claude-opus-4-7", 42]),
      ).toBe(false);
    });
  });

  describe("family and version predicates", () => {
    it.each([
      ["claude-opus-4-6", isOpus46Model],
      ["claude-opus-4-7", isOpus47Model],
      ["claude-opus-4-8", isOpus48Model],
      ["claude-sonnet-4-6", isSonnet46Model],
      ["claude-fable-5", isFable5Model],
      ["claude-mythos-5", isMythos5Model],
    ])("identifies %s across every accepted spelling", (id, query) => {
      const dotted = id.replace(/-(\d)-(\d)$/u, "-$1.$2");

      expect(query(id)).toBe(true);
      expect(query(dotted)).toBe(true);
      expect(query(id.toUpperCase())).toBe(true);
      expect(query(`${id}-20250929`)).toBe(true);
      expect(query(`${id}-eap`)).toBe(true);
      expect(query(`${dotted}-EAP[foo]`)).toBe(true);
      expect(query(`${id}[1m]`)).toBe(true);
      expect(query(`anthropic/${id}`)).toBe(true);
    });

    it("keeps the version predicates mutually exclusive", () => {
      expect(isOpus46Model("claude-opus-4-7")).toBe(false);
      expect(isOpus47Model("claude-opus-4-6")).toBe(false);
      expect(isOpus48Model("claude-opus-4-7")).toBe(false);
      expect(isSonnet46Model("claude-opus-4-6")).toBe(false);
      expect(isFable5Model("claude-mythos-5")).toBe(false);
      expect(isMythos5Model("claude-fable-5")).toBe(false);
    });

    it.each([
      ["claude-3-5-haiku", true],
      ["claude-3.5-haiku", true],
      ["claude-haiku-4-5", true],
      ["claude-haiku-4.5", true],
      ["claude-haiku-4-5-20250929", true],
      ["claude-sonnet-4-5", false],
      ["claude-opus-4-7", false],
      ["gpt-4o", false],
    ])("classifies the haiku family for %s", (model, expected) => {
      expect(isHaikuModel(model)).toBe(expected);
    });

    it.each([
      ["claude-3-opus", true],
      ["claude-3-5-sonnet", true],
      ["claude-3.5-sonnet", true],
      ["claude-3-7-sonnet", true],
      ["claude-3-haiku", true],
      ["claude-sonnet-4-5", false],
      ["claude-opus-4-7", false],
      ["gpt-4o", false],
    ])("classifies the claude 3 generation for %s", (model, expected) => {
      expect(isClaude3Model(model)).toBe(expected);
    });

    it.each([
      ["claude-opus-4-6", true],
      ["claude-opus-4.7", true],
      ["claude-opus-4-8-20250929", true],
      ["claude-sonnet-4-6", true],
      ["claude-fable-5", true],
      ["claude-mythos-5", true],
      ["claude-opus-4-5", false],
      ["claude-sonnet-4-5", false],
      ["claude-haiku-4-5", false],
      ["claude-3-5-sonnet", false],
      ["gpt-4o", false],
    ])("classifies adaptive thinking for %s", (model, expected) => {
      expect(isAdaptiveThinkingModel(model)).toBe(expected);
    });

    it("does not let the catalogue decide adaptive thinking for uncatalogued ids", () => {
      expect(
        Object.hasOwn(CLAUDE_CODE_2_1_195_PROFILE.supportedModels, "gpt-4o"),
      ).toBe(false);
      expect(isAdaptiveThinkingModel("gpt-4o")).toBe(false);
      // `claude-mythos-5` is uncatalogued under 2.1.195 by product decision
      // D-1, yet it is an adaptive-thinking model on both profiles.
      expect(
        Object.hasOwn(
          CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
          "claude-mythos-5",
        ),
      ).toBe(false);
      expect(isAdaptiveThinkingModel("claude-mythos-5")).toBe(true);
    });
  });

  describe("dotted and dashed spellings agree", () => {
    it.each([
      ["claude-opus-4.7", "claude-opus-4-7"],
      ["claude-opus-4.6", "claude-opus-4-6"],
      ["claude-sonnet-4.6", "claude-sonnet-4-6"],
      ["claude-sonnet-4.5-20250929", "claude-sonnet-4-5-20250929"],
      ["claude-haiku-4.5", "claude-haiku-4-5"],
      ["claude-3.5-sonnet", "claude-3-5-sonnet"],
      ["CLAUDE-OPUS-4.8-EAP", "CLAUDE-OPUS-4-8-EAP"],
    ])("answers identically for %s and %s", (dotted, dashed) => {
      for (const [, query] of MODEL_ONLY_QUERIES) {
        expect(query(dotted)).toBe(query(dashed));
      }
      expect(modelCapability(dotted, "context_management")).toBe(
        modelCapability(dashed, "context_management"),
      );
    });
  });

  describe("generic capability query", () => {
    it("reads the verbatim capability string from the active catalogue", () => {
      expect(modelCapability("claude-haiku-4-5", "context_management")).toBe(
        true,
      );
      expect(modelCapability("claude-haiku-4-5", "effort")).toBe(false);
      expect(modelCapability("claude-3-5-sonnet", "context_management")).toBe(
        false,
      );
    });

    it("answers for capability strings the package does not model as a field", () => {
      const profile = withCapabilities("claude-haiku-4-5", [
        "effort",
        "fast_mode",
      ]);

      expect(modelCapability("claude-haiku-4-5", "effort", profile)).toBe(true);
      expect(modelCapability("claude-haiku-4-5", "fast_mode", profile)).toBe(
        true,
      );
      expect(modelCapability("claude-haiku-4-5", "max_effort", profile)).toBe(
        false,
      );
      expect(
        modelCapability("claude-haiku-4-5", "context_management", profile),
      ).toBe(false);
    });

    it("normalizes the id before the catalogue lookup", () => {
      expect(
        modelCapability("claude-sonnet-4.5-20250929", "context_management"),
      ).toBe(true);
      expect(
        modelCapability(
          "ANTHROPIC/claude-sonnet-4-5[1m]",
          "context_management",
        ),
      ).toBe(true);
    });

    it("answers false for ids the active profile does not catalogue", () => {
      expect(modelCapability("gpt-4o", "context_management")).toBe(false);
      expect(modelCapability("claude-mythos-5", "context_management")).toBe(
        false,
      );
    });

    it("follows the profile it is given", () => {
      // 2.1.195 does not catalogue mythos (D-1); 2.1.233 does, with an empty
      // capability array.
      expect(
        modelCapability(
          "claude-mythos-5",
          "context_management",
          CLAUDE_CODE_2_1_233_PROFILE,
        ),
      ).toBe(false);
      expect(
        Object.hasOwn(
          CLAUDE_CODE_2_1_233_PROFILE.supportedModels,
          "claude-mythos-5",
        ),
      ).toBe(true);
      // `claude-opus-5` exists only on 2.1.233.
      expect(modelCapability("claude-opus-5", "context_management")).toBe(
        false,
      );
      expect(
        Object.hasOwn(
          CLAUDE_CODE_2_1_233_PROFILE.supportedModels,
          "claude-opus-5",
        ),
      ).toBe(true);
    });
  });

  describe("1M context", () => {
    it.each([
      ["claude-sonnet-4-0", true],
      ["claude-sonnet-4-5", true],
      ["claude-sonnet-4-6", true],
      ["claude-opus-4-6", true],
      ["claude-opus-4.7", true],
      ["claude-opus-4-8", true],
      ["claude-opus-4-5", false],
      ["claude-opus-4-1", false],
      ["claude-opus-4-0", false],
      ["claude-haiku-4-5", false],
      ["claude-3-5-sonnet", false],
      ["gpt-4o", false],
    ])("decides 1M beta eligibility for %s", (model, expected) => {
      expect(isEligibleFor1MContext(model)).toBe(expected);
    });

    it.each([
      "claude-opus-4-6[1m]",
      "claude-opus-4-5[1m]",
      "some-model-1m",
      "1m-model",
      "model-context-1m",
      "model-context1m",
    ])("treats the explicit marker in %s as eligible", (model) => {
      expect(isEligibleFor1MContext(model)).toBe(true);
    });

    it("falls back to the ported family set for uncatalogued ids", () => {
      expect(
        Object.hasOwn(
          CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
          "claude-mythos-5",
        ),
      ).toBe(false);
      expect(isEligibleFor1MContext("claude-mythos-5")).toBe(false);
      // The same id is catalogued with `supports1mBeta` on 2.1.233.
      expect(
        isEligibleFor1MContext("claude-mythos-5", CLAUDE_CODE_2_1_233_PROFILE),
      ).toBe(true);
    });

    it.each([
      ["claude-opus-4-6-1m", true],
      ["claude-opus-4-6_1m", true],
      ["model-context-1m", true],
      ["model-context1m", true],
      ["claude-opus-4-6[1m]", false],
      ["claude-opus-4-7", false],
      ["claude-opus-4-8", false],
      ["claude-sonnet-4-5", false],
      ["gpt-4o", false],
    ])("decides the always-1M marker for %s", (model, expected) => {
      expect(hasOneMillionContext(model)).toBe(expected);
    });

    it("keeps the always-1M marker independent of the catalogue window", () => {
      const entry =
        CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-7"];
      expect(entry?.context?.native1m).toBe(true);
      expect(hasOneMillionContext("claude-opus-4-7")).toBe(false);
    });
  });

  describe("beta and tool gates", () => {
    it.each([
      ["claude-opus-4-7", true],
      ["claude-opus-4.7", true],
      ["claude-sonnet-4-5", true],
      ["claude-haiku-4-5", true],
      ["claude-opus-4-0", false],
      ["claude-sonnet-4-0", false],
      ["claude-3-5-sonnet", false],
      ["claude-3.5-sonnet", false],
    ])("decides structured-output support for %s", (model, expected) => {
      expect(supportsStructuredOutputs(model)).toBe(expected);
    });

    it.each([
      ["claude-opus-4-7", true],
      ["claude-sonnet-4-5", true],
      ["claude-haiku-4-5", true],
      ["claude-3-5-sonnet", true],
      ["gpt-4o", true],
      ["gemini-2-5-pro", true],
      ["llama-4", false],
      ["mistral-large", false],
    ])("decides web-search support for %s", (model, expected) => {
      expect(supportsWebSearch(model)).toBe(expected);
    });
  });
});
