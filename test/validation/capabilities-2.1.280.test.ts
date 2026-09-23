// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeCatalogueEntry,
  ClaudeCodeProtocolProfile,
} from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  parseBuiltClaudeCodeRequest,
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

  it("covers every id the 2.1.280 catalogue declares", () => {
    // The two `it.each` blocks below iterate the hand-written list, so without
    // this a twenty-first catalogue entry would be silently uncovered by both.
    expect([...IDS_2_1_280].sort()).toEqual(
      Object.keys(CLAUDE_CODE_2_1_280_PROFILE.supportedModels).sort(),
    );
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

describe("2.1.280 capability decisions reach the evidence", () => {
  const BASE = {
    accessToken: "sentinel-token-capability-evidence-3f81",
    maxTokens: 1024,
    messages: [{ role: "user", content: "hi" }],
    runtime: {
      sessionId: "00000000-0000-4000-8000-000000000001",
      deviceId:
        "0000000000000000000000000000000000000000000000000000000000000002",
      accountUuid: "00000000-0000-4000-8000-000000000000",
      runtime: "node",
      runtimeVersion: "22.0.0",
      os: "Linux",
      arch: "x64",
    },
    clientRequestId: "request",
  } as const;

  /*
   * `evidence.capabilityDecisions` records the caller's stated `capabilities`
   * (absent => every field false), after the builder has cross-checked them
   * against the model. So each row is supplied as the request's
   * `capabilities` and must come back unchanged in the evidence: a request a
   * swapped cross-check would refuse, or a swapped redaction would mis-echo.
   *
   * Why these two models: they differ in exactly two of the eleven fields,
   * `rejectsDisabledThinking` and `perTurnEffort`. On the new pair,
   * claude-opus-4-8 carries midConvToolChange=true / perTurnEffort=false, so a
   * swap between those two fields anywhere in the plumbing flips that row and
   * fails. claude-opus-5-5 carries both true and pins that neither is dropped.
   * A pair that agreed on both new fields would not catch a swap.
   */
  const OPUS_4_8 = {
    thinking: true,
    adaptiveThinking: true,
    interleavedThinking: true,
    effort: true,
    maxEffort: true,
    xhighEffort: true,
    contextManagement: true,
    temperature: false,
    rejectsDisabledThinking: false,
    midConvToolChange: true,
    perTurnEffort: false,
  } as const;

  const OPUS_5_5 = {
    thinking: true,
    adaptiveThinking: true,
    interleavedThinking: true,
    effort: true,
    maxEffort: true,
    xhighEffort: true,
    contextManagement: true,
    temperature: false,
    rejectsDisabledThinking: true,
    midConvToolChange: true,
    perTurnEffort: true,
  } as const;

  it("claude-opus-4-8 reaches the evidence with midConvToolChange true and perTurnEffort false", async () => {
    const result = await buildClaudeCodeRequest(
      { ...BASE, model: "claude-opus-4-8", capabilities: OPUS_4_8 },
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    expect(result.evidence.capabilityDecisions).toEqual(OPUS_4_8);
  });

  it("claude-opus-5-5 reaches the evidence with both new capabilities true", async () => {
    const result = await buildClaudeCodeRequest(
      { ...BASE, model: "claude-opus-5-5", capabilities: OPUS_5_5 },
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    expect(result.evidence.capabilityDecisions).toEqual(OPUS_5_5);
  });

  it("the decisions survive a parse round-trip", async () => {
    const built = await buildClaudeCodeRequest(
      { ...BASE, model: "claude-opus-5-5", capabilities: OPUS_5_5 },
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const parsed = parseBuiltClaudeCodeRequest(
      built,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    expect(parsed.evidence.capabilityDecisions).toEqual(
      built.evidence.capabilityDecisions,
    );
  });

  it("requesting per_turn_effort on a model that lacks it is refused", async () => {
    await expect(
      buildClaudeCodeRequest(
        {
          ...BASE,
          model: "claude-opus-4-8",
          capabilities: { perTurnEffort: true },
        },
        CLAUDE_CODE_2_1_280_PROFILE,
      ),
    ).rejects.toMatchObject({
      name: "ClaudeCodeWireError",
      code: "UNSUPPORTED_CAPABILITY",
    });
  });
});
