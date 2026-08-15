// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { BETA_REGISTRY } from "../../src/beta-registry.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
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

  it("mirrors the 2.1.195 profile metadata verbatim", () => {
    const entry = entryById(CLAUDE_CODE_2_1_195_PROFILE.id);

    expect(entry.profile).toBe(CLAUDE_CODE_2_1_195_PROFILE);
    expect(entry.id).toBe(CLAUDE_CODE_2_1_195_PROFILE.id);
    expect(entry.cliVersion).toBe(CLAUDE_CODE_2_1_195_PROFILE.cliVersion);
    expect(entry.sdkVersion).toBe(CLAUDE_CODE_2_1_195_PROFILE.sdkVersion);
    expect(entry.endpoint).toBe(CLAUDE_CODE_2_1_195_PROFILE.endpoint);
    expect(entry.userAgent).toBe(CLAUDE_CODE_2_1_195_PROFILE.userAgent);
  });

  it("carries counts derived from the real registry and catalogue", () => {
    const entry = entryById(CLAUDE_CODE_2_1_195_PROFILE.id);

    expect(entry.expectedBetaCount).toBe(Object.keys(BETA_REGISTRY).length);
    expect(entry.expectedModelCount).toBe(
      Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels).length,
    );
  });

  it("pins the observed beta and model counts", () => {
    const entry = entryById(CLAUDE_CODE_2_1_195_PROFILE.id);

    expect(entry.expectedBetaCount).toBe(28);
    expect(entry.expectedModelCount).toBe(14);
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
