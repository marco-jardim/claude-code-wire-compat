// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { resolveBetaRegistry } from "../../src/betas.js";
import { DEFAULT_PROFILE } from "../../src/build-request.js";
import {
  BETA_REGISTRY,
  BETA_REGISTRY_2_1_233,
  BETA_REGISTRY_2_1_280,
  BETA_REGISTRY_2_1_329,
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import { BETA_REGISTRY_2_1_329 as DEEP_BETA_REGISTRY_2_1_329 } from "../../src/profiles/beta-registry-2.1.329.js";
import { CLAUDE_CODE_2_1_329_PROFILE as DEEP_CLAUDE_CODE_2_1_329_PROFILE } from "../../src/profiles/claude-code-2.1.329.js";
import { buildRedactedEvidence } from "../../src/redaction.js";
import type { BuildRedactedEvidenceInput } from "../../src/redaction.js";

/*
 * Registering a profile touches several seams: the package root re-export, the
 * builder's accepted set, the evidence validator's own id literals and the beta
 * registry map. This file pins that 2.1.329 went through every seam that is
 * observable WITHOUT reading the composed beta list, and that acceptance is by
 * object identity. The default-profile pin below is the single governance pin
 * on the default seam; it moved here from `registration-2.1.280.test.ts`.
 */

const BASE = {
  accessToken: "sentinel-token-registration-329-4c1d",
  model: "claude-opus-4-6",
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

type ProfileArgument = Parameters<typeof buildClaudeCodeRequest>[1];

const REJECTION = {
  name: "ClaudeCodeWireError",
  code: "INVALID_INPUT",
  message: "INVALID_INPUT",
};

/** One digit off in the SDK patch component: close enough to be a typo. */
const NEAR_MISS_ID = "claude-code-2.1.329-sdk-0.128.1";

function asProfile(value: unknown): ProfileArgument {
  return value as ProfileArgument;
}

const EVIDENCE_TOKEN = "sentinel-token-registration-329-evidence-7b2e";

function evidenceInput(
  profile: BuildRedactedEvidenceInput["profile"],
): BuildRedactedEvidenceInput {
  return {
    profile,
    request: {
      accessToken: EVIDENCE_TOKEN,
      model: "claude-opus-4-8",
      maxTokens: 64,
      messages: [{ role: "user", content: "synthetic prompt" }],
    },
    modelFamily: "opus",
    logicalHeaders: [["authorization", `Bearer ${EVIDENCE_TOKEN}`]],
    betaFeatures: [],
    body: "synthetic body",
  };
}

describe("2.1.329 registration: package root", () => {
  it("re-exports the profile singleton itself, not a copy", () => {
    expect(CLAUDE_CODE_2_1_329_PROFILE).toBe(DEEP_CLAUDE_CODE_2_1_329_PROFILE);
    expect(CLAUDE_CODE_2_1_329_PROFILE.id).toBe(
      "claude-code-2.1.329-sdk-0.128.0",
    );
  });

  it("re-exports the beta registry itself, not a copy", () => {
    expect(BETA_REGISTRY_2_1_329).toBe(DEEP_BETA_REGISTRY_2_1_329);
  });
});

describe("2.1.329 registration: builder acceptance", () => {
  it("accepts the singleton passed explicitly", async () => {
    const result = await buildClaudeCodeRequest(
      BASE,
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    // The id is unique per profile, so this is the discriminating assertion.
    expect(result.evidence.profileId).toBe(CLAUDE_CODE_2_1_329_PROFILE.id);
    expect(result.url).toBe(CLAUDE_CODE_2_1_329_PROFILE.endpoint);
  });

  it("rejects a shallow clone that is structurally identical", async () => {
    const clone = { ...CLAUDE_CODE_2_1_329_PROFILE };

    expect(clone).toEqual(CLAUDE_CODE_2_1_329_PROFILE);
    expect(clone).not.toBe(CLAUDE_CODE_2_1_329_PROFILE);
    await expect(
      buildClaudeCodeRequest(BASE, asProfile(clone)),
    ).rejects.toMatchObject(REJECTION);
  });

  it("rejects a deep clone", async () => {
    const deep: unknown = structuredClone(CLAUDE_CODE_2_1_329_PROFILE);

    await expect(
      buildClaudeCodeRequest(BASE, asProfile(deep)),
    ).rejects.toMatchObject(REJECTION);
  });
});

describe("2.1.329 registration: evidence id literals", () => {
  it("accepts evidence claiming the 2.1.329 id", async () => {
    const evidence = await buildRedactedEvidence(
      evidenceInput(CLAUDE_CODE_2_1_329_PROFILE),
    );

    expect(evidence.profileId).toBe(CLAUDE_CODE_2_1_329_PROFILE.id);
  });

  it("accepts a copy carrying the real id, so the id is what is checked", async () => {
    const copy = { ...CLAUDE_CODE_2_1_329_PROFILE };

    await expect(
      buildRedactedEvidence(evidenceInput(copy)),
    ).resolves.toMatchObject({ profileId: CLAUDE_CODE_2_1_329_PROFILE.id });
  });

  it("rejects evidence claiming a near-miss id", async () => {
    const nearMiss = { ...CLAUDE_CODE_2_1_329_PROFILE, id: NEAR_MISS_ID };

    await expect(
      buildRedactedEvidence(evidenceInput(nearMiss)),
    ).rejects.toMatchObject(REJECTION);
  });
});

describe("default profile: pinned", () => {
  /*
   * This pin exists so that moving the default is a deliberate act, not an
   * accident: any change to the default seam fails here until this line is
   * changed alongside it.
   *
   * The assertion is by identity, not structure, because identity is the
   * contract `ACCEPTED_PROFILES` enforces: the builder and parser accept a
   * profile only if it is one of the exported singletons. (A clone as the
   * default would not fail silently -- `validateProfile` runs on the resolved
   * default too, so every unpinned build would throw.) Asserting identity here
   * names the default seam explicitly, rather than relying on the collateral
   * failure of unrelated tests to reveal that the default changed.
   *
   * The only legitimate reason to edit this assertion is a default-profile
   * switch, which is always its own commit.
   */
  it("is the pinned profile singleton itself, by identity", () => {
    expect(DEFAULT_PROFILE).toBe(CLAUDE_CODE_2_1_329_PROFILE);
  });
});

describe("2.1.329 registration: beta registry binding", () => {
  it("resolves the 2.1.329 profile to the 2.1.329 registry", () => {
    expect(resolveBetaRegistry(CLAUDE_CODE_2_1_329_PROFILE)).toBe(
      BETA_REGISTRY_2_1_329,
    );
  });

  it("resolves every older profile to its own registry", () => {
    expect(resolveBetaRegistry(CLAUDE_CODE_2_1_195_PROFILE)).toBe(
      BETA_REGISTRY,
    );
    expect(resolveBetaRegistry(CLAUDE_CODE_2_1_233_PROFILE)).toBe(
      BETA_REGISTRY_2_1_233,
    );
    expect(resolveBetaRegistry(CLAUDE_CODE_2_1_280_PROFILE)).toBe(
      BETA_REGISTRY_2_1_280,
    );
  });

  it("falls back to the 2.1.195 registry for an unknown id", () => {
    const unknown = {
      ...CLAUDE_CODE_2_1_329_PROFILE,
      id: "claude-code-0.0.0-sdk-0.0.0",
    };

    expect(resolveBetaRegistry(unknown)).toBe(BETA_REGISTRY);
    expect(resolveBetaRegistry(unknown)).not.toBe(BETA_REGISTRY_2_1_329);
  });
});
