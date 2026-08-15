// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeCapabilities } from "../../src/index.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/index.js";
import {
  deriveCapabilities,
  supportsMidConversationSystem,
  supportsStructuredOutputs,
} from "../../src/model-capabilities.js";

/*
 * Executable specification of capability derivation for the 2.1.195 profile.
 *
 * This file is a BEHAVIOR PIN, written before the catalogue-driven derivation
 * refactor (T1.1.2) and required to pass unchanged both before and after it.
 * It asserts three separate things:
 *
 *   1. Cell-by-cell equivalence between the wire-authoritative predicates in
 *      `src/model-capabilities.ts` and the profile catalogue's
 *      `capabilities[]` strings, for the six catalogue-backed capabilities.
 *   2. The single known divergence (see docs/plans/BLOCKERS.md finding C1),
 *      pinned from BOTH sides so drift on either side fails.
 *   3. Exact tables for the capabilities that have no catalogue
 *      representation, for the two beta-only gates outside
 *      `ClaudeCodeCapabilities`, and for ids absent from the catalogue.
 */

/** Catalogue string <-> `ClaudeCodeCapabilities` field, for the six
 * capabilities that the catalogue represents. */
const CATALOGUE_BACKED = [
  ["effort", "effort"],
  ["maxEffort", "max_effort"],
  ["xhighEffort", "xhigh_effort"],
  ["adaptiveThinking", "adaptive_thinking"],
  ["contextManagement", "context_management"],
  ["rejectsDisabledThinking", "rejects_disabled_thinking"],
] as const satisfies readonly (readonly [
  keyof ClaudeCodeCapabilities,
  string,
])[];

/**
 * Capabilities with NO catalogue representation: no `capabilities[]` string
 * exists for them, so they are predicate/family-derived and must not be
 * compared against the catalogue. Pinned by exact table instead.
 */
const PREDICATE_ONLY = [
  "thinking",
  "interleavedThinking",
  "temperature",
] as const satisfies readonly (keyof ClaudeCodeCapabilities)[];

/**
 * Catalogue strings that carry no `ClaudeCodeCapabilities` field. They are
 * consumed elsewhere (`mid_conv_system` is a beta-only gate; the rest by later
 * work packages) and are ignored by the equivalence comparison.
 */
const CATALOGUE_STRINGS_WITHOUT_PREDICATE = [
  "fast_mode",
  "lean_prompt",
  "fable_5_mitigations",
  "mid_conv_system",
] as const;

/**
 * FROZEN. docs/plans/BLOCKERS.md, finding C1. Exactly one cell where the
 * wire-authoritative predicate and the catalogue disagree in 2.1.195.
 * Adding an entry here is a behavior change and requires a BLOCKERS entry.
 */
const KNOWN_DIVERGENCES = [
  {
    id: "claude-opus-4-5",
    capability: "effort",
    predicate: true,
    catalogue: false,
  },
] as const satisfies readonly {
  readonly id: string;
  readonly capability: keyof ClaudeCodeCapabilities;
  readonly predicate: boolean;
  readonly catalogue: boolean;
}[];

const catalogueIds = Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels);

function catalogueHas(id: string, capabilityString: string): boolean {
  const entry = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[id];
  if (entry === undefined) throw new Error(`no catalogue entry for ${id}`);
  return entry.capabilities.includes(capabilityString);
}

function divergenceFor(
  id: string,
  capability: keyof ClaudeCodeCapabilities,
): (typeof KNOWN_DIVERGENCES)[number] | undefined {
  return KNOWN_DIVERGENCES.find(
    (row) => row.id === id && row.capability === capability,
  );
}

describe("capability derivation: catalogue equivalence", () => {
  it("the catalogue is non-empty (anti-vacuity guard)", () => {
    expect(catalogueIds.length).toBeGreaterThanOrEqual(1);
  });

  it("every catalogue string is either mapped or explicitly unmapped", () => {
    const mapped = new Set<string>(
      CATALOGUE_BACKED.map(([, capabilityString]) => capabilityString),
    );
    const unmapped = new Set<string>(CATALOGUE_STRINGS_WITHOUT_PREDICATE);
    const unaccounted = new Set<string>();
    for (const entry of Object.values(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      for (const capabilityString of entry.capabilities) {
        if (!mapped.has(capabilityString) && !unmapped.has(capabilityString)) {
          unaccounted.add(capabilityString);
        }
      }
    }
    expect([...unaccounted]).toEqual([]);
  });

  for (const id of catalogueIds) {
    for (const [field, capabilityString] of CATALOGUE_BACKED) {
      const divergence = divergenceFor(id, field);

      if (divergence === undefined) {
        it(`${id} x ${capabilityString}: predicate === catalogue`, () => {
          expect(deriveCapabilities(id)[field]).toBe(
            catalogueHas(id, capabilityString),
          );
        });
        continue;
      }

      it(`${id} x ${capabilityString}: known divergence (C1), pinned both sides`, () => {
        expect(deriveCapabilities(id)[field]).toBe(divergence.predicate);
        expect(catalogueHas(id, capabilityString)).toBe(divergence.catalogue);
        expect(divergence.predicate).not.toBe(divergence.catalogue);
      });
    }
  }

  it("the set of divergent cells is exactly KNOWN_DIVERGENCES", () => {
    const observed = [];
    for (const id of catalogueIds) {
      for (const [field, capabilityString] of CATALOGUE_BACKED) {
        const predicate = deriveCapabilities(id)[field];
        const catalogue = catalogueHas(id, capabilityString);
        if (predicate !== catalogue) {
          observed.push({ id, capability: field, predicate, catalogue });
        }
      }
    }
    expect(observed).toEqual([...KNOWN_DIVERGENCES]);
    expect(KNOWN_DIVERGENCES).toHaveLength(1);
  });
});

/**
 * Exact table for the three capabilities with no catalogue representation.
 * Transcribed from `supportsThinking`, `supportsInterleavedThinking` and
 * `supportsTemperature` (the last has INVERTED polarity: it is an allowlist).
 */
const PREDICATE_ONLY_TABLE: Readonly<
  Record<
    string,
    Readonly<Pick<ClaudeCodeCapabilities, (typeof PREDICATE_ONLY)[number]>>
  >
> = {
  "claude-3-5-haiku": {
    thinking: false,
    interleavedThinking: false,
    temperature: true,
  },
  "claude-3-5-sonnet": {
    thinking: false,
    interleavedThinking: false,
    temperature: true,
  },
  "claude-3-7-sonnet": {
    thinking: false,
    interleavedThinking: false,
    temperature: true,
  },
  "claude-haiku-4-5": {
    thinking: true,
    interleavedThinking: true,
    temperature: true,
  },
  "claude-sonnet-4-0": {
    thinking: true,
    interleavedThinking: true,
    temperature: true,
  },
  "claude-sonnet-4-5": {
    thinking: true,
    interleavedThinking: true,
    temperature: true,
  },
  "claude-sonnet-4-6": {
    thinking: true,
    interleavedThinking: true,
    temperature: true,
  },
  "claude-opus-4-0": {
    thinking: true,
    interleavedThinking: true,
    temperature: true,
  },
  "claude-opus-4-1": {
    thinking: true,
    interleavedThinking: true,
    temperature: true,
  },
  "claude-opus-4-5": {
    thinking: true,
    interleavedThinking: true,
    temperature: true,
  },
  "claude-opus-4-6": {
    thinking: true,
    interleavedThinking: true,
    temperature: true,
  },
  "claude-opus-4-7": {
    thinking: true,
    interleavedThinking: true,
    temperature: false,
  },
  "claude-opus-4-8": {
    thinking: true,
    interleavedThinking: true,
    temperature: false,
  },
  "claude-fable-5": {
    thinking: true,
    interleavedThinking: true,
    temperature: false,
  },
};

/** Beta-only gates, deliberately outside `ClaudeCodeCapabilities`. */
const BETA_GATE_TABLE: Readonly<
  Record<
    string,
    { readonly structuredOutputs: boolean; readonly midConvSystem: boolean }
  >
> = {
  "claude-3-5-haiku": { structuredOutputs: false, midConvSystem: false },
  "claude-3-5-sonnet": { structuredOutputs: false, midConvSystem: false },
  "claude-3-7-sonnet": { structuredOutputs: false, midConvSystem: false },
  "claude-haiku-4-5": { structuredOutputs: true, midConvSystem: false },
  "claude-sonnet-4-0": { structuredOutputs: false, midConvSystem: false },
  "claude-sonnet-4-5": { structuredOutputs: true, midConvSystem: false },
  "claude-sonnet-4-6": { structuredOutputs: true, midConvSystem: false },
  "claude-opus-4-0": { structuredOutputs: false, midConvSystem: false },
  "claude-opus-4-1": { structuredOutputs: true, midConvSystem: false },
  "claude-opus-4-5": { structuredOutputs: true, midConvSystem: false },
  "claude-opus-4-6": { structuredOutputs: true, midConvSystem: false },
  "claude-opus-4-7": { structuredOutputs: true, midConvSystem: false },
  "claude-opus-4-8": { structuredOutputs: true, midConvSystem: true },
  "claude-fable-5": { structuredOutputs: true, midConvSystem: true },
};

describe("capability derivation: predicate-only capabilities", () => {
  it("the pinned table covers exactly the catalogue ids", () => {
    expect(Object.keys(PREDICATE_ONLY_TABLE).sort()).toEqual(
      [...catalogueIds].sort(),
    );
  });

  it("every pinned row covers exactly the predicate-only capabilities", () => {
    const expectedKeys = [...PREDICATE_ONLY].sort();
    for (const row of Object.values(PREDICATE_ONLY_TABLE)) {
      expect(Object.keys(row).sort()).toEqual(expectedKeys);
    }
  });

  for (const [id, expected] of Object.entries(PREDICATE_ONLY_TABLE)) {
    it(`${id}: thinking / interleavedThinking / temperature`, () => {
      const derived = deriveCapabilities(id);
      expect({
        thinking: derived.thinking,
        interleavedThinking: derived.interleavedThinking,
        temperature: derived.temperature,
      }).toEqual(expected);
    });
  }
});

describe("capability derivation: beta-only gates", () => {
  it("the pinned table covers exactly the catalogue ids", () => {
    expect(Object.keys(BETA_GATE_TABLE).sort()).toEqual(
      [...catalogueIds].sort(),
    );
  });

  for (const [id, expected] of Object.entries(BETA_GATE_TABLE)) {
    it(`${id}: structuredOutputs / midConversationSystem`, () => {
      expect({
        structuredOutputs: supportsStructuredOutputs(id),
        midConvSystem: supportsMidConversationSystem(id),
      }).toEqual(expected);
    });
  }
});

/*
 * Ids that reach derivation without a catalogue entry fall through every
 * exclusion list and resolve maximally permissive. `temperature` is the sole
 * exception because its predicate is an allowlist, not an exclusion list.
 */
const MAXIMALLY_PERMISSIVE: ClaudeCodeCapabilities = {
  thinking: true,
  adaptiveThinking: true,
  interleavedThinking: true,
  effort: true,
  maxEffort: true,
  xhighEffort: true,
  contextManagement: true,
  temperature: false,
  rejectsDisabledThinking: true,
};

const OUT_OF_CATALOGUE_IDS = [
  "claude-mythos-5",
  "claude-opus-5",
  "foo",
  "",
  "claude-sonnet-4-5[1m]",
] as const;

describe("capability derivation: ids outside the catalogue", () => {
  it("none of the probe ids is in the catalogue", () => {
    for (const id of OUT_OF_CATALOGUE_IDS) {
      expect(catalogueIds).not.toContain(id);
    }
  });

  for (const id of OUT_OF_CATALOGUE_IDS) {
    it(`${JSON.stringify(id)}: resolves maximally permissive`, () => {
      expect(deriveCapabilities(id)).toEqual(MAXIMALLY_PERMISSIVE);
      expect(supportsStructuredOutputs(id)).toBe(true);
      expect(supportsMidConversationSystem(id)).toBe(true);
    });
  }
});
