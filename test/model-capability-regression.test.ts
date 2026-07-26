import { describe, expect, it } from "vitest";

import { resolveModel } from "../src/models.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";

describe("catalogue capability arrays do not participate in capability derivation", () => {
  it("cannot remove or grant id-derived capabilities", () => {
    // This guards the deliberate simplification documented in the header comment of
    // src/model-capabilities.ts: first-party capabilities are pure functions of model ids.
    const supportedModels = {
      ...CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
      "claude-opus-4-7": {
        ...CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-7"],
        capabilities: [],
      },
      "claude-opus-4-5": {
        ...CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-5"],
        capabilities: ["max_effort", "xhigh_effort", "adaptive_thinking"],
      },
    };

    const profileOverride = {
      ...CLAUDE_CODE_2_1_195_PROFILE,
      supportedModels,
    };

    expect(
      resolveModel("claude-opus-4-7", profileOverride).capabilities,
    ).toMatchObject({
      effort: true,
      maxEffort: true,
      xhighEffort: true,
      adaptiveThinking: true,
    });
    expect(
      resolveModel("claude-opus-4-5", profileOverride).capabilities,
    ).toMatchObject({
      maxEffort: false,
      xhighEffort: false,
      adaptiveThinking: false,
    });
  });
});

describe("capability predicate exclusion lists remain independent", () => {
  it("preserves every distinguishing model row and temperature allowlist polarity", () => {
    const opus45 = resolveModel("claude-opus-4-5").capabilities;
    expect(opus45).toMatchObject({
      effort: true,
      maxEffort: false,
      adaptiveThinking: false,
    });

    expect(resolveModel("claude-sonnet-4-6").capabilities).toMatchObject({
      maxEffort: true,
      xhighEffort: false,
    });
    expect(resolveModel("claude-opus-4-6").capabilities).toMatchObject({
      maxEffort: true,
      xhighEffort: false,
    });
    expect(resolveModel("claude-opus-4-7").capabilities).toMatchObject({
      xhighEffort: true,
      rejectsDisabledThinking: false,
      temperature: false,
    });
    expect(resolveModel("claude-fable-5").capabilities).toMatchObject({
      rejectsDisabledThinking: true,
      temperature: false,
    });
    expect(resolveModel("claude-3-5-haiku").capabilities.temperature).toBe(
      true,
    );
  });
});
