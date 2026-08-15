import { describe, expect, it } from "vitest";

import { resolveModel } from "../src/models.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";

describe("profile-override capability arrays do not participate in capability derivation", () => {
  it("cannot remove or grant capabilities by overriding the profile catalogue", () => {
    // Since T1.1.2 the six catalogue-backed capabilities ARE read from a
    // catalogue -- but from the pinned 2.1.195 profile, because
    // `deriveCapabilities` takes only a normalized id and no profile. So a
    // caller-supplied profile cannot move a capability row: the expectations
    // below are the pinned catalogue's values, not the override's.
    //
    // `claude-opus-4-5` keeps `effort: true` through the demarcated C1
    // exception (docs/plans/BLOCKERS.md); `claude-opus-4-7` keeps its four
    // effort-family capabilities even though the override empties its array.
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

describe("capability rows remain independent per model", () => {
  // These rows are catalogue-backed now, except `temperature`, which has no
  // catalogue string and stays on its allowlist predicate. Either way the
  // distinguishing rows must not collapse into one another.
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
