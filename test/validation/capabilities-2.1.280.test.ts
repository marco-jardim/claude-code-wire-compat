// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeCatalogueEntry,
  ClaudeCodeProtocolProfile,
} from "../../src/index.js";
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
} from "../../src/index.js";
import { deriveCapabilitiesFromCatalogue } from "../../src/model-capabilities.js";

/*
 * Catalogue-backed capability derivation against the 2.1.280 catalogue.
 *
 * Every expected value below is transcribed from the 2.1.280 analysis
 * document, not from the code under test. The catalogue-string mapping is
 * module-private in `src/model-capabilities.ts`, so it is pinned
 * behaviourally: one synthetic entry per string, asserting that exactly one
 * field turns on.
 */

type CatalogueBackedField = Exclude<
  keyof ClaudeCodeCapabilities,
  "thinking" | "interleavedThinking" | "temperature"
>;

/** [camelCase field, verbatim upstream catalogue string], hand-written. */
const EXPECTED_MAPPING: readonly (readonly [CatalogueBackedField, string])[] = [
  ["effort", "effort"],
  ["maxEffort", "max_effort"],
  ["xhighEffort", "xhigh_effort"],
  ["adaptiveThinking", "adaptive_thinking"],
  ["contextManagement", "context_management"],
  ["rejectsDisabledThinking", "rejects_disabled_thinking"],
  ["midConvToolChange", "mid_conv_tool_change"],
  ["perTurnEffort", "per_turn_effort"],
];

const IDS_2_1_280: readonly string[] = [
  "claude-3-5-haiku",
  "claude-haiku-4-5",
  "claude-3-5-sonnet",
  "claude-3-7-sonnet",
  "claude-sonnet-4-0",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-opus-4-0",
  "claude-opus-4-1",
  "claude-opus-4-5",
  "claude-opus-4-6",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-opus-5",
  "claude-opus-5-5",
  "claude-fable-5",
  "claude-fable-5-1",
  "claude-mythos-5",
  "claude-mythos-5-1",
];

const EXPECTED_PER_TURN_EFFORT: readonly string[] = [
  "claude-opus-5-5",
  "claude-fable-5-1",
];

const EXPECTED_MID_CONV_TOOL_CHANGE: readonly string[] = [
  "claude-opus-4-8",
  "claude-opus-5",
  "claude-opus-5-5",
  "claude-fable-5",
  "claude-fable-5-1",
  "claude-mythos-5-1",
];

const EXPECTED_REJECTS_DISABLED_THINKING: readonly string[] = [
  "claude-opus-5-5",
  "claude-fable-5",
  "claude-fable-5-1",
  "claude-mythos-5-1",
];

function catalogueEntry(
  profile: ClaudeCodeProtocolProfile,
  id: string,
): ClaudeCodeCatalogueEntry {
  const entry = profile.supportedModels[id];
  if (entry === undefined) {
    throw new Error(`${profile.id} catalogue has no entry for ${id}`);
  }
  return entry;
}

function derive280(id: string): ClaudeCodeCapabilities {
  return deriveCapabilitiesFromCatalogue(
    catalogueEntry(CLAUDE_CODE_2_1_280_PROFILE, id),
    id,
  );
}

function catalogueBacked(
  capabilities: ClaudeCodeCapabilities,
): Record<CatalogueBackedField, boolean> {
  return {
    effort: capabilities.effort,
    maxEffort: capabilities.maxEffort,
    xhighEffort: capabilities.xhighEffort,
    adaptiveThinking: capabilities.adaptiveThinking,
    contextManagement: capabilities.contextManagement,
    rejectsDisabledThinking: capabilities.rejectsDisabledThinking,
    midConvToolChange: capabilities.midConvToolChange,
    perTurnEffort: capabilities.perTurnEffort,
  };
}

const ALL_FALSE: Readonly<Record<CatalogueBackedField, boolean>> = {
  effort: false,
  maxEffort: false,
  xhighEffort: false,
  adaptiveThinking: false,
  contextManagement: false,
  rejectsDisabledThinking: false,
  midConvToolChange: false,
  perTurnEffort: false,
};

describe("2.1.280 catalogue-backed capabilities", () => {
  it("maps each catalogue string to exactly one capability field", () => {
    const actual = EXPECTED_MAPPING.map(([field, catalogueString]) => {
      const entry: ClaudeCodeCatalogueEntry = {
        family: "opus",
        capabilities: [catalogueString],
      };
      return {
        catalogueString,
        derived: catalogueBacked(
          deriveCapabilitiesFromCatalogue(entry, "claude-opus-5-5"),
        ),
        field,
      };
    });
    const expected = EXPECTED_MAPPING.map(([field, catalogueString]) => ({
      catalogueString,
      derived: { ...ALL_FALSE, [field]: true },
      field,
    }));

    expect(actual).toEqual(expected);
  });

  it("derives no field from per_turn_timing", () => {
    const entry: ClaudeCodeCatalogueEntry = {
      family: "opus",
      capabilities: ["per_turn_timing"],
    };
    expect(
      catalogueBacked(
        deriveCapabilitiesFromCatalogue(entry, "claude-opus-5-5"),
      ),
    ).toEqual(ALL_FALSE);

    const mythos51 = catalogueEntry(
      CLAUDE_CODE_2_1_280_PROFILE,
      "claude-mythos-5-1",
    );
    expect({
      carriesPerTurnTiming: mythos51.capabilities.includes("per_turn_timing"),
      perTurnEffort: derive280("claude-mythos-5-1").perTurnEffort,
    }).toEqual({ carriesPerTurnTiming: true, perTurnEffort: false });
  });

  it.each(IDS_2_1_280)("%s derives perTurnEffort correctly", (id) => {
    const expected = EXPECTED_PER_TURN_EFFORT.includes(id);
    expect({ id, perTurnEffort: derive280(id).perTurnEffort }).toEqual({
      id,
      perTurnEffort: expected,
    });
  });

  it.each(IDS_2_1_280)("%s derives midConvToolChange correctly", (id) => {
    const expected = EXPECTED_MID_CONV_TOOL_CHANGE.includes(id);
    expect({ id, midConvToolChange: derive280(id).midConvToolChange }).toEqual({
      id,
      midConvToolChange: expected,
    });
  });

  it("derives both new fields false for every 2.1.195 and 2.1.233 catalogue entry", () => {
    const olderProfiles: readonly ClaudeCodeProtocolProfile[] = [
      CLAUDE_CODE_2_1_195_PROFILE,
      CLAUDE_CODE_2_1_233_PROFILE,
    ];

    expect(
      olderProfiles.map((profile) => ({
        profile: profile.id,
        nonEmpty: Object.keys(profile.supportedModels).length > 0,
      })),
    ).toEqual(
      olderProfiles.map((profile) => ({ profile: profile.id, nonEmpty: true })),
    );

    const offenders: string[] = [];
    for (const profile of olderProfiles) {
      for (const [id, entry] of Object.entries(profile.supportedModels)) {
        const derived = deriveCapabilitiesFromCatalogue(entry, id);
        if (derived.midConvToolChange || derived.perTurnEffort) {
          offenders.push(`${profile.id}:${id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the existing derivations unchanged", () => {
    const rejecting = Object.entries(
      CLAUDE_CODE_2_1_280_PROFILE.supportedModels,
    )
      .filter(
        ([id, entry]) =>
          deriveCapabilitiesFromCatalogue(entry, id).rejectsDisabledThinking,
      )
      .map(([id]) => id);
    expect([...rejecting].sort()).toEqual(
      [...EXPECTED_REJECTS_DISABLED_THINKING].sort(),
    );

    expect({
      "claude-opus-4-6": derive280("claude-opus-4-6").xhighEffort,
      "claude-sonnet-4-6": derive280("claude-sonnet-4-6").xhighEffort,
    }).toEqual({ "claude-opus-4-6": false, "claude-sonnet-4-6": false });
  });

  it("derives every catalogue-backed field false for claude-mythos-5", () => {
    expect(catalogueBacked(derive280("claude-mythos-5"))).toEqual({
      effort: false,
      maxEffort: false,
      xhighEffort: false,
      adaptiveThinking: false,
      contextManagement: false,
      rejectsDisabledThinking: false,
      midConvToolChange: false,
      perTurnEffort: false,
    });
  });
});
