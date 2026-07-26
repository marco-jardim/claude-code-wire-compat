// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { ClaudeCodeWireError } from "../../src/contracts.js";
import {
  modelFamilyOf,
  normalizeModelId,
  stripModelMarkers,
} from "../../src/model-identity.js";
import { resolveModel } from "../../src/models.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";

describe("model identity", () => {
  it.each([
    ["claude-fable-5", "claude-fable-5"],
    ["claude-mythos-5", "claude-mythos-5"],
    ["claude-opus-4-8", "claude-opus-4-8"],
    ["claude-opus-4-7", "claude-opus-4-7"],
    ["claude-opus-4-6", "claude-opus-4-6"],
    ["claude-opus-4-5", "claude-opus-4-5"],
    ["claude-opus-4-1", "claude-opus-4-1"],
    ["claude-opus-4", "claude-opus-4-0"],
    ["claude-sonnet-4-6", "claude-sonnet-4-6"],
    ["claude-sonnet-4-5", "claude-sonnet-4-5"],
    ["claude-sonnet-4", "claude-sonnet-4-0"],
    ["claude-haiku-4-5", "claude-haiku-4-5"],
    ["claude-3-7-sonnet", "claude-3-7-sonnet"],
    ["claude-3-5-sonnet", "claude-3-5-sonnet"],
    ["claude-3-5-haiku", "claude-3-5-haiku"],
    ["claude-3-opus", "claude-3-opus"],
    ["claude-3-sonnet", "claude-3-sonnet"],
    ["claude-3-haiku", "claude-3-haiku"],
  ])("ports the upstream normalization branch for %s", (input, expected) => {
    expect(normalizeModelId(input)).toBe(expected);
  });

  it("preserves upstream branch order", () => {
    expect(normalizeModelId("claude-opus-4-5/claude-opus-4-8")).toBe(
      "claude-opus-4-8",
    );
    // Upstream checks the sonnet-4 regex before the claude-haiku-4-5 branch.
    expect(normalizeModelId("claude-sonnet-4-haiku-4-5")).toBe(
      "claude-sonnet-4-0",
    );
  });

  it.each([
    ["CLAUDE-OPUS-4-6", "claude-opus-4-6"],
    ["anthropic/claude-opus-4-6", "claude-opus-4-6"],
    ["claude-opus-4-6-preview", "claude-opus-4-6"],
  ])("matches case-insensitively and without anchors", (input, expected) => {
    expect(normalizeModelId(input)).toBe(expected);
  });

  it.each([
    ["claude-opus-4-20250514", "claude-opus-4-0"],
    ["claude-opus-4-2", "claude-opus-4-2"],
    ["claude-sonnet-4-20250514", "claude-sonnet-4-0"],
    ["claude-sonnet-4-2", "claude-sonnet-4-2"],
  ])(
    "preserves the upstream negative-lookahead behavior",
    (input, expected) => {
      expect(normalizeModelId(input)).toBe(expected);
    },
  );

  it.each([
    ["some-model-20250101", "some-model"],
    ["some-model-2025010", "some-model-2025010"],
  ])("strips only an eight-digit fallback date", (input, expected) => {
    expect(normalizeModelId(input)).toBe(expected);
  });

  it("derives mythos and unknown families", () => {
    expect(modelFamilyOf(normalizeModelId("claude-mythos-5"))).toBe("mythos");
    expect(modelFamilyOf(normalizeModelId("gpt-4o"))).toBe("unknown");
  });

  it("models claude-mythos-5 as a catalogue-less capability bearer (decision D-1)", () => {
    expect(normalizeModelId("claude-mythos-5")).toBe("claude-mythos-5");
    expect(() => resolveModel("claude-mythos-5")).not.toThrow();
    expect(resolveModel("claude-mythos-5")).toEqual({
      id: "claude-mythos-5",
      wireId: "claude-mythos-5",
      family: "mythos",
      capabilities: CLAUDE_CODE_2_1_195_PROFILE.defaultCapabilities,
    });
    expect(
      Object.hasOwn(
        CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
        "claude-mythos-5",
      ),
    ).toBe(false);
  });

  it.each([
    ["an empty string", () => resolveModel("")],
    [
      "a non-string value",
      () => {
        Reflect.apply(resolveModel, undefined, [42]);
      },
    ],
  ])("rejects %s with INVALID_INPUT", (_description, resolve) => {
    try {
      resolve();
      throw new Error("Expected model resolution to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaudeCodeWireError);
      if (error instanceof ClaudeCodeWireError) {
        expect(error.code).toBe("INVALID_INPUT");
      }
    }
  });

  it.each(["claude-opus-4-6[1m]", "claude-opus-4-6[2M]"])(
    "strips wire markers without disturbing normalization for %s",
    (model) => {
      expect(stripModelMarkers(model)).toBe("claude-opus-4-6");
      expect(normalizeModelId(model)).toBe("claude-opus-4-6");
      expect(resolveModel(model)).toMatchObject({
        id: "claude-opus-4-6",
        wireId: "claude-opus-4-6",
      });
    },
  );

  it("passes a fully unknown model through with default capabilities", () => {
    expect(resolveModel("gpt-4o")).toEqual({
      id: "gpt-4o",
      wireId: "gpt-4o",
      family: "unknown",
      capabilities: CLAUDE_CODE_2_1_195_PROFILE.defaultCapabilities,
    });
  });

  it("resolves a dated sonnet form with claude-sonnet-4-5 capabilities", () => {
    expect(resolveModel("claude-sonnet-4-5-20250929").capabilities).toEqual(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-sonnet-4-5"]
        ?.capabilities,
    );
  });

  it("keeps catalogue families aligned with normalized ids", () => {
    for (const [id, definition] of Object.entries(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      expect(modelFamilyOf(id)).toBe(definition.family);
      expect(normalizeModelId(id)).toBe(id);
    }
  });
});
