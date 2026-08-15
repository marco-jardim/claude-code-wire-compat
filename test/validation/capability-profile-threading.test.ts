// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeProtocolProfile } from "../../src/index.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/index.js";
import {
  deriveCapabilities,
  supportsMidConversationSystem,
} from "../../src/model-capabilities.js";
import { resolveModel } from "../../src/models.js";
import { modelOutputTokenLimits } from "../../src/thinking.js";

/*
 * Derivation is a function of (normalized id, profile), not of the id alone.
 *
 * The profile threaded through `resolveModel`, `deriveCapabilities`,
 * `modelOutputTokenLimits` and the mid-conversation-system gate is what lets a
 * later profile ship a catalogue that disagrees with 2.1.195 without the
 * 2.1.195 answers moving. This file pins both halves of that: the synthetic
 * catalogue below is honoured, and the pinned catalogue is not disturbed.
 *
 * The synthetic profile is deliberately shaped like the 2.1.222+ deltas that
 * motivated the threading: `claude-opus-4-5` genuinely without `effort`, a
 * sonnet-5-class id carrying `mid_conv_system`, and its own output limits.
 */

type CatalogueEntry =
  ClaudeCodeProtocolProfile["supportedModels"][keyof ClaudeCodeProtocolProfile["supportedModels"]];

const PINNED = CLAUDE_CODE_2_1_195_PROFILE.supportedModels;

function entryFor(modelId: string): CatalogueEntry {
  const entry = PINNED[modelId];
  if (entry === undefined) {
    throw new TypeError(`Missing catalogue entry for ${modelId}.`);
  }
  return entry;
}

/** An id absent from BOTH catalogues, so every lookup falls to the predicates. */
const UNCATALOGUED_ID = "claude-mythos-5";

const SYNTHETIC: ClaudeCodeProtocolProfile = {
  ...CLAUDE_CODE_2_1_195_PROFILE,
  id: "synthetic-233-preview",
  supportedModels: {
    // No `effort`: the C1 exception must not follow the model id here.
    "claude-opus-4-5": {
      ...entryFor("claude-opus-4-5"),
      capabilities: ["context_management"],
      maxOutputTokens: { default: 8192, upper: 16384 },
    },
    // A sonnet-5-class id the 2.1.195 predicate would refuse the beta for.
    "claude-sonnet-5": {
      ...entryFor("claude-sonnet-4-6"),
      capabilities: ["effort", "max_effort", "mid_conv_system"],
      maxOutputTokens: { default: 16384, upper: 32768 },
    },
    // Catalogued, but without the string: the catalogue answer is a denial,
    // not a fall-through to the permissive predicate.
    "claude-opus-5": {
      ...entryFor("claude-opus-4-8"),
      capabilities: ["effort"],
      maxOutputTokens: { default: 8192, upper: 16384 },
    },
  },
};

describe("deriveCapabilities honours the profile it is given", () => {
  it("reads the synthetic catalogue rather than the pinned one", () => {
    expect(deriveCapabilities("claude-sonnet-5", SYNTHETIC)).toMatchObject({
      effort: true,
      maxEffort: true,
      xhighEffort: false,
      contextManagement: false,
      adaptiveThinking: false,
    });
    expect(deriveCapabilities("claude-opus-4-5", SYNTHETIC)).toMatchObject({
      contextManagement: true,
      maxEffort: false,
      xhighEffort: false,
    });
  });

  it("scopes the C1 effort exception to the 2.1.195 profile", () => {
    // Same model id, same absent `effort` string, opposite answers: the only
    // difference is which profile asked.
    expect(deriveCapabilities("claude-opus-4-5", SYNTHETIC).effort).toBe(false);
    expect(
      deriveCapabilities("claude-opus-4-5", CLAUDE_CODE_2_1_195_PROFILE).effort,
    ).toBe(true);
    expect(deriveCapabilities("claude-opus-4-5").effort).toBe(true);
  });

  it("falls back to the predicates for an id the profile does not catalogue", () => {
    expect(deriveCapabilities(UNCATALOGUED_ID, SYNTHETIC)).toEqual(
      deriveCapabilities(UNCATALOGUED_ID),
    );
  });
});

describe("mid-conversation-system is catalogue-first when a profile is given", () => {
  it("admits an id whose synthetic entry carries the string", () => {
    expect(supportsMidConversationSystem("claude-sonnet-5", SYNTHETIC)).toBe(
      true,
    );
    // Without the profile the predicate answers for this id on its own terms;
    // the catalogue is what makes the answer authoritative.
    expect(supportsMidConversationSystem("claude-opus-5", SYNTHETIC)).toBe(
      false,
    );
    expect(supportsMidConversationSystem("claude-opus-4-5", SYNTHETIC)).toBe(
      false,
    );
  });

  it("keeps the predicate for an id outside the catalogue", () => {
    expect(supportsMidConversationSystem(UNCATALOGUED_ID, SYNTHETIC)).toBe(
      supportsMidConversationSystem(UNCATALOGUED_ID),
    );
    expect(supportsMidConversationSystem(UNCATALOGUED_ID)).toBe(true);
  });

  it("agrees with the predicate across the whole 2.1.195 catalogue", () => {
    for (const modelId of Object.keys(PINNED)) {
      expect({
        modelId,
        catalogue: supportsMidConversationSystem(
          modelId,
          CLAUDE_CODE_2_1_195_PROFILE,
        ),
      }).toEqual({
        modelId,
        catalogue: supportsMidConversationSystem(modelId),
      });
    }
  });
});

describe("modelOutputTokenLimits honours the profile it is given", () => {
  it("reads the synthetic catalogue's declared limits", () => {
    expect(modelOutputTokenLimits("claude-sonnet-5", SYNTHETIC)).toEqual({
      default: 16384,
      upperLimit: 32768,
    });
    // Same id, different profile, different limits.
    expect(modelOutputTokenLimits("claude-opus-4-5", SYNTHETIC)).toEqual({
      default: 8192,
      upperLimit: 16384,
    });
    expect(
      modelOutputTokenLimits("claude-opus-4-5", CLAUDE_CODE_2_1_195_PROFILE),
    ).toEqual(modelOutputTokenLimits("claude-opus-4-5"));
  });

  it("falls back to the legacy rows for an id the profile omits", () => {
    for (const modelId of [
      UNCATALOGUED_ID,
      "claude-3-opus",
      "claude-3-sonnet",
      "claude-3-haiku",
      "claude-unknown-9",
    ]) {
      expect({
        modelId,
        limits: modelOutputTokenLimits(modelId, SYNTHETIC),
      }).toEqual({ modelId, limits: modelOutputTokenLimits(modelId) });
    }
    // `claude-opus-4-7` is catalogued by 2.1.195 and NOT by the synthetic
    // profile, so under the synthetic profile it lands on the generic tail.
    expect(modelOutputTokenLimits("claude-opus-4-7", SYNTHETIC)).toEqual({
      default: 32000,
      upperLimit: 128000,
    });
  });
});

describe("resolveModel carries the profile into derivation", () => {
  it("reports the synthetic catalogue's capabilities and family", () => {
    const resolved = resolveModel("claude-sonnet-5", SYNTHETIC);

    expect(resolved.id).toBe("claude-sonnet-5");
    expect(resolved.capabilities).toEqual(
      deriveCapabilities("claude-sonnet-5", SYNTHETIC),
    );
    expect(resolved.capabilities.effort).toBe(true);
    expect(resolveModel("claude-opus-4-5", SYNTHETIC).capabilities.effort).toBe(
      false,
    );
  });
});

describe("2.1.195 derivation is untouched by the threading", () => {
  it("derives every catalogued id identically with and without the profile", () => {
    const ids = Object.keys(PINNED);
    expect(ids).toHaveLength(14);

    for (const modelId of ids) {
      expect({
        modelId,
        capabilities: deriveCapabilities(modelId),
      }).toEqual({
        modelId,
        capabilities: deriveCapabilities(modelId, CLAUDE_CODE_2_1_195_PROFILE),
      });
      expect({
        modelId,
        limits: modelOutputTokenLimits(modelId),
      }).toEqual({
        modelId,
        limits: modelOutputTokenLimits(modelId, CLAUDE_CODE_2_1_195_PROFILE),
      });
    }
  });
});
