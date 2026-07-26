// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  ClaudeCodeWireError,
  antiVerbosityText,
  selectAntiVerbositySection,
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

function expectInvalidModel(rawModel: string): void {
  try {
    selectAntiVerbositySection(rawModel);
  } catch (error) {
    expect(error).toBeInstanceOf(ClaudeCodeWireError);
    if (!(error instanceof ClaudeCodeWireError)) {
      throw new TypeError("Expected ClaudeCodeWireError.", { cause: error });
    }
    expect(error.code).toBe("INVALID_INPUT");
    return;
  }
  throw new TypeError("Expected INVALID_INPUT.");
}

describe("anti-verbosity selector", () => {
  it.each([
    ["claude-fable-5", "communicating-with-the-user"],
    ["claude-mythos-5", "communicating-with-the-user"],
    ["claude-3-5-haiku", "text-output"],
    ["claude-3-5-sonnet", "text-output"],
    ["claude-3-7-sonnet", "text-output"],
    ["claude-haiku-4-5", "text-output"],
    ["claude-sonnet-4-0", "text-output"],
    ["claude-sonnet-4-5", "text-output"],
    ["claude-sonnet-4-6", "text-output"],
    ["claude-opus-4-0", "text-output"],
    ["claude-opus-4-1", "text-output"],
    ["claude-opus-4-5", "text-output"],
    ["claude-opus-4-6", "text-output"],
    ["claude-opus-4-7", "text-output"],
    ["claude-opus-4-8", "lean"],
    ["gpt-4o", "lean"],
    ["some-unknown-model", "lean"],
  ] as const)("selects %s as %s", (model, section) => {
    expect(selectAntiVerbositySection(model)).toBe(section);
  });

  it.each([
    ["claude-sonnet-4-5-20250929", "text-output"],
    ["claude-opus-4-8-20260101", "lean"],
  ] as const)("normalises %s before selecting %s", (model, section) => {
    expect(selectAntiVerbositySection(model)).toBe(section);
  });

  it.each([
    "claude-sonnet-4-5-eap",
    "claude-sonnet-4-5-eap[foo]",
    "claude-sonnet-4-5-EAP",
  ])("applies the raw -eap rule to %s", (model) => {
    expect(selectAntiVerbositySection(model)).toBe("lean");
  });

  it("keeps the -eap control case distinct", () => {
    expect(selectAntiVerbositySection("claude-sonnet-4-5")).toBe("text-output");
  });

  it("rejects invalid model identifiers", () => {
    expectInvalidModel("");
    expectInvalidModel(42 as unknown as string);
  });
});

describe("anti-verbosity catalogue dependence", () => {
  // WP-2 established that the catalogue `capabilities` array never influences
  // the nine model-capability predicates, because each one falls back to a
  // provider test that is unconditionally true on first party. The selector is
  // the opposite case: upstream `Mte` and `Kkd` have no such fallback, so the
  // array genuinely decides the branch. These two tests pin that contrast, so
  // that nobody generalises the WP-2 finding and deletes the arrays.
  it("loses the communicating-with-the-user branch without fable_5_mitigations", () => {
    expect(selectAntiVerbositySection("claude-fable-5")).toBe(
      "communicating-with-the-user",
    );
    expect(
      selectAntiVerbositySection(
        "claude-fable-5",
        withCapabilities("claude-fable-5", []),
      ),
    ).toBe("lean");
  });

  it("grants the communicating-with-the-user branch via fable_5_mitigations", () => {
    expect(selectAntiVerbositySection("claude-haiku-4-5")).toBe("text-output");
    expect(
      selectAntiVerbositySection(
        "claude-haiku-4-5",
        withCapabilities("claude-haiku-4-5", ["fable_5_mitigations"]),
      ),
    ).toBe("communicating-with-the-user");
  });

  it("drives the lean branch from lean_prompt", () => {
    // Deliberately exercised on Haiku rather than on one of the two models that
    // actually carry `lean_prompt`. Under the pinned catalogue the clause is
    // unobservable: `claude-fable-5` is claimed earlier by `Mte`, and
    // `claude-opus-4-8` is absent from the upstream allowlist below the clause,
    // so it reaches the lean branch with or without the capability. Haiku is in
    // that allowlist, so granting it `lean_prompt` is the only way to show the
    // clause carries weight. Upstream keeps it for the same reason.
    expect(selectAntiVerbositySection("claude-haiku-4-5")).toBe("text-output");
    expect(
      selectAntiVerbositySection(
        "claude-haiku-4-5",
        withCapabilities("claude-haiku-4-5", ["lean_prompt"]),
      ),
    ).toBe("lean");
    expect(
      selectAntiVerbositySection(
        "claude-opus-4-8",
        withCapabilities("claude-opus-4-8", []),
      ),
    ).toBe("lean");
  });
});

describe("anti-verbosity policy", () => {
  it("switches communicating-with-the-user text according to host policy", () => {
    const full = antiVerbosityText("claude-fable-5");
    const brief = antiVerbosityText("claude-fable-5", {
      briefModeEnabled: true,
      pewterOwlToolEnabled: false,
    });
    const pewterOwl = antiVerbosityText("claude-fable-5", {
      briefModeEnabled: false,
      pewterOwlToolEnabled: true,
    });

    expect(full).toBe(antiVerbosityText("claude-mythos-5"));
    expect(brief).not.toBe(full);
    expect(pewterOwl).toBe(brief);
  });

  it.each([
    ["null", null],
    ["a number", 7],
    ["a missing field", { briefModeEnabled: true }],
    [
      "a non-boolean field",
      { briefModeEnabled: "yes", pewterOwlToolEnabled: false },
    ],
    [
      "a non-boolean second field",
      { briefModeEnabled: false, pewterOwlToolEnabled: 1 },
    ],
  ])("rejects a policy that is %s", (_name, policy) => {
    // Rejected for every model, not only the one branch that reads the policy,
    // so a malformed policy fails identically regardless of the model paired
    // with it.
    for (const model of ["claude-fable-5", "claude-opus-4-8", "gpt-4o"]) {
      expect(() =>
        antiVerbosityText(
          model,
          policy as unknown as Parameters<typeof antiVerbosityText>[1],
        ),
      ).toThrow(ClaudeCodeWireError);
    }
  });

  it("does not apply policy to lean or text-output models", () => {
    const policy = {
      briefModeEnabled: true,
      pewterOwlToolEnabled: true,
    };
    expect(antiVerbosityText("claude-opus-4-8", policy)).toBe(
      antiVerbosityText("some-unknown-model"),
    );
    expect(antiVerbosityText("claude-sonnet-4-5", policy)).toBe(
      antiVerbosityText("claude-opus-4-7"),
    );
  });
});
