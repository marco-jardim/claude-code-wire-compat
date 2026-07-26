// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  ClaudeCodeWireError,
  antiVerbosityText,
  selectAntiVerbositySection,
} from "../../src/index.js";

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
    expect(selectAntiVerbositySection("claude-sonnet-4-5")).toBe("text-output");
  });

  it("rejects invalid model identifiers", () => {
    expectInvalidModel("");
    expectInvalidModel(42 as unknown as string);
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
