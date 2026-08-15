// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { BETA_REGISTRY } from "../../src/beta-registry.js";
import { BETA_REGISTRY_2_1_233 } from "../../src/profiles/beta-registry-2.1.233.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
import { CLAUDE_CODE_2_1_233_PROFILE } from "../../src/profiles/claude-code-2.1.233.js";
import type { ProfileUnderTest } from "../support/profile-matrix.js";
import {
  assertValidProfileRegistry,
  describeEachProfile,
  PROFILES_UNDER_TEST,
} from "../support/profile-matrix.js";

function entryById(id: string): ProfileUnderTest {
  const entry = PROFILES_UNDER_TEST.find((candidate) => candidate.id === id);
  if (entry === undefined) {
    throw new Error(`No profile registered under id "${id}".`);
  }
  return entry;
}

describe("profile matrix registry", () => {
  it("is not empty", () => {
    expect(PROFILES_UNDER_TEST.length).toBeGreaterThan(0);
  });

  it("registers unique profile ids", () => {
    const ids = PROFILES_UNDER_TEST.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    { label: "2.1.195", profile: CLAUDE_CODE_2_1_195_PROFILE },
    { label: "2.1.233", profile: CLAUDE_CODE_2_1_233_PROFILE },
  ])("mirrors the $label profile metadata verbatim", ({ profile }) => {
    const entry = entryById(profile.id);

    expect(entry.profile).toBe(profile);
    expect(entry.id).toBe(profile.id);
    expect(entry.cliVersion).toBe(profile.cliVersion);
    expect(entry.sdkVersion).toBe(profile.sdkVersion);
    expect(entry.endpoint).toBe(profile.endpoint);
    expect(entry.userAgent).toBe(profile.userAgent);
  });

  /**
   * The beta registry is no longer profile-invariant: 2.1.195 draws from the
   * shared module, 2.1.233 pins its own. Each entry is therefore paired with
   * the registry it must derive its count from.
   */
  it.each([
    {
      label: "2.1.195",
      profile: CLAUDE_CODE_2_1_195_PROFILE,
      betaRegistry: BETA_REGISTRY,
    },
    {
      label: "2.1.233",
      profile: CLAUDE_CODE_2_1_233_PROFILE,
      betaRegistry: BETA_REGISTRY_2_1_233,
    },
  ])(
    "carries $label counts derived from the real registry and catalogue",
    ({ profile, betaRegistry }) => {
      const entry = entryById(profile.id);

      expect(entry.expectedBetaCount).toBe(Object.keys(betaRegistry).length);
      expect(entry.expectedModelCount).toBe(
        Object.keys(profile.supportedModels).length,
      );
    },
  );

  it.each([
    {
      label: "2.1.195",
      profile: CLAUDE_CODE_2_1_195_PROFILE,
      betaCount: 28,
      modelCount: 14,
    },
    {
      label: "2.1.233",
      profile: CLAUDE_CODE_2_1_233_PROFILE,
      betaCount: 31,
      modelCount: 17,
    },
  ])(
    "pins the observed $label beta and model counts",
    ({ profile, betaCount, modelCount }) => {
      const entry = entryById(profile.id);

      expect(entry.expectedBetaCount).toBe(betaCount);
      expect(entry.expectedModelCount).toBe(modelCount);
    },
  );

  it("registers every profile that ships a pinned expectation", () => {
    expect(PROFILES_UNDER_TEST.map((entry) => entry.id)).toEqual([
      CLAUDE_CODE_2_1_195_PROFILE.id,
      CLAUDE_CODE_2_1_233_PROFILE.id,
    ]);
  });
});

describe("assertValidProfileRegistry", () => {
  it("accepts the live registry", () => {
    expect(() => {
      assertValidProfileRegistry(PROFILES_UNDER_TEST);
    }).not.toThrow();
  });

  it("throws on an empty registry", () => {
    expect(() => {
      assertValidProfileRegistry([]);
    }).toThrow(/empty/u);
  });

  it("throws on duplicate profile ids", () => {
    const entry = entryById(CLAUDE_CODE_2_1_195_PROFILE.id);

    expect(() => {
      assertValidProfileRegistry([entry, entry]);
    }).toThrow(/duplicate profile id/u);
  });
});

describe("describeEachProfile", () => {
  it("throws instead of registering nothing for an empty registry", () => {
    expect(() => {
      describeEachProfile(
        "vacuous",
        () => {
          throw new Error("callback must never run for an empty registry");
        },
        [],
      );
    }).toThrow(/empty/u);
  });

  it("throws for a registry with duplicate ids", () => {
    const entry = entryById(CLAUDE_CODE_2_1_195_PROFILE.id);

    expect(() => {
      describeEachProfile("duplicated", () => undefined, [entry, entry]);
    }).toThrow(/duplicate profile id/u);
  });
});

const visited: string[] = [];

describeEachProfile("describeEachProfile invocation", (entry) => {
  visited.push(entry.id);

  it("runs the callback body for this profile", () => {
    expect(entry.profile.id).toBe(entry.id);
  });
});

describe("describeEachProfile fan-out", () => {
  it("invokes the callback exactly once per registered profile", () => {
    expect(visited).toStrictEqual(PROFILES_UNDER_TEST.map((entry) => entry.id));
  });
});
