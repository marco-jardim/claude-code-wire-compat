// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the models module.
 *
 * Wave 2 export expected:
 * - `resolveModel(model: string, profile?: ClaudeCodeProtocolProfile): { readonly id: string; readonly family: "haiku" | "sonnet" | "opus"; readonly capabilities: ClaudeCodeCapabilities }`
 */

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
} from "../src/contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "./support/wave2-modules.js";

interface ResolvedModel {
  readonly id: string;
  readonly family: "haiku" | "sonnet" | "opus";
  readonly capabilities: ClaudeCodeCapabilities;
}

type ResolveModel = (
  model: string,
  profile?: ClaudeCodeProtocolProfile,
) => ResolvedModel;

describe("models (Wave 1 RED specification)", () => {
  it("the Wave 2 module is implemented", async () => {
    expect(await expectModuleUnimplemented("models")).toBe(false);
  });

  it("resolves all nine canonical model ids from the real profile", async () => {
    const resolveModel = await loadWave2Function<ResolveModel>(
      "models",
      "resolveModel",
    );

    for (const [id, definition] of Object.entries(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      expect(resolveModel(id)).toEqual({
        id,
        family: definition.family,
        capabilities: definition.capabilities,
      });
    }
    expect(
      Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels),
    ).toHaveLength(9);
  });

  it("resolves every profile alias to its canonical id", async () => {
    const resolveModel = await loadWave2Function<ResolveModel>(
      "models",
      "resolveModel",
    );

    for (const [id, definition] of Object.entries(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      for (const alias of definition.aliases) {
        expect(resolveModel(alias)).toEqual({
          id,
          family: definition.family,
          capabilities: definition.capabilities,
        });
      }
    }
  });

  it.each([
    "claude-opus-4-9",
    "claude-3-opus",
    "claude-fable-5",
    "claude-mythos-5",
    "opus",
    "claude-opus",
    "",
    "evil-claude-opus-4-8-evil",
  ])("fails closed for unsupported model %j", async (model) => {
    const resolveModel = await loadWave2Function<ResolveModel>(
      "models",
      "resolveModel",
    );
    expect(() => resolveModel(model)).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_MODEL" }),
    );
  });

  it.each(["CLAUDE-OPUS-4-8", " claude-opus-4-8 "])(
    "rejects rather than normalizes %j",
    async (model) => {
      const resolveModel = await loadWave2Function<ResolveModel>(
        "models",
        "resolveModel",
      );
      // Upstream used unanchored case-insensitive regexes; this package deliberately diverges to fail closed.
      expect(() => resolveModel(model)).toThrow(
        expect.objectContaining({ code: "UNSUPPORTED_MODEL" }),
      );
    },
  );

  it("returns a frozen value without mutating the profile", async () => {
    const resolveModel = await loadWave2Function<ResolveModel>(
      "models",
      "resolveModel",
    );
    const before = JSON.stringify(CLAUDE_CODE_2_1_195_PROFILE);

    const resolved = resolveModel(
      "claude-opus-4-8",
      CLAUDE_CODE_2_1_195_PROFILE,
    );
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(JSON.stringify(CLAUDE_CODE_2_1_195_PROFILE)).toBe(before);
  });
});
