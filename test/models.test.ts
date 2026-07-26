// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the models module.
 *
 * Wave 2 export expected:
 * - `resolveModel(model: string, profile?: ClaudeCodeProtocolProfile): ResolvedClaudeCodeModel`
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
  readonly wireId: string;
  readonly family: "haiku" | "sonnet" | "opus" | "fable" | "mythos" | "unknown";
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

  it("resolves every canonical model id from the real profile", async () => {
    const resolveModel = await loadWave2Function<ResolveModel>(
      "models",
      "resolveModel",
    );

    for (const [id, definition] of Object.entries(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      expect(resolveModel(id)).toEqual({
        id,
        wireId: id,
        family: definition.family,
        capabilities: definition.capabilities,
      });
    }
    expect(
      Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels),
    ).toHaveLength(14);
  });

  it.each([
    [["claude-3-5-haiku", "haiku", false, false, false, false] as const],
    [["claude-opus-4-5", "opus", true, false, false, true] as const],
    [["claude-3-5-sonnet", "sonnet", false, false, false, false] as const],
    [["claude-3-7-sonnet", "sonnet", false, false, false, false] as const],
    [["claude-opus-4-8", "opus", true, true, true, true] as const],
    [["claude-sonnet-4-0", "sonnet", true, false, false, true] as const],
    [["claude-haiku-4-5", "haiku", true, false, false, true] as const],
  ])(
    "resolves catalogue model %s to its exact family and capabilities",
    async ([
      id,
      family,
      contextHint,
      adaptiveThinking,
      effort,
      interleavedThinking,
    ]) => {
      const resolveModel = await loadWave2Function<ResolveModel>(
        "models",
        "resolveModel",
      );

      expect(resolveModel(id)).toEqual({
        id,
        wireId: id,
        family,
        capabilities: {
          contextHint,
          adaptiveThinking,
          effort,
          interleavedThinking,
        },
      });
    },
  );

  it.each([["anthropic/claude-fable-5", "claude-fable-5"]])(
    "normalizes unanchored model identity %s to %s without rewriting the wire id",
    async (model, id) => {
      const resolveModel = await loadWave2Function<ResolveModel>(
        "models",
        "resolveModel",
      );

      expect(resolveModel(model)).toMatchObject({ id, wireId: model });
    },
  );

  it.each([
    "claude-opus-4-9",
    "opus",
    "claude-opus",
    "evil-claude-opus-4-8-evil",
    "claude-3-opus",
    "claude-mythos-5",
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-3-5-haiku-latest",
  ])("passes through unrecognised non-empty model %j", async (model) => {
    const resolveModel = await loadWave2Function<ResolveModel>(
      "models",
      "resolveModel",
    );
    expect(resolveModel(model)).toMatchObject({ wireId: model });
  });

  it("rejects the empty caller model", async () => {
    const resolveModel = await loadWave2Function<ResolveModel>(
      "models",
      "resolveModel",
    );
    expect(() => resolveModel("")).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it.each(["CLAUDE-OPUS-4-8", " claude-opus-4-8 "])(
    "normalizes identity while preserving wire spelling for %j",
    async (model) => {
      const resolveModel = await loadWave2Function<ResolveModel>(
        "models",
        "resolveModel",
      );
      expect(resolveModel(model)).toMatchObject({
        id: "claude-opus-4-8",
        wireId: model,
      });
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
