// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { DEFAULT_PROFILE } from "../../src/build-request.js";
import {
  BETA_REGISTRY_2_1_280,
  CLAUDE_CODE_2_1_280_PROFILE,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import { BETA_REGISTRY_2_1_280 as DEEP_BETA_REGISTRY_2_1_280 } from "../../src/profiles/beta-registry-2.1.280.js";
import { CLAUDE_CODE_2_1_280_PROFILE as DEEP_CLAUDE_CODE_2_1_280_PROFILE } from "../../src/profiles/claude-code-2.1.280.js";
import { buildRedactedEvidence } from "../../src/redaction.js";
import type { BuildRedactedEvidenceInput } from "../../src/redaction.js";

/*
 * Registering a profile touches several seams: the package root re-export,
 * the builder's accepted set, the header-plan identity check, the evidence
 * validator's own id literals, and the beta registry map. This file pins that
 * the 2.1.280 profile went through every seam that is observable WITHOUT
 * reading the composed beta list, and that acceptance is by object identity.
 *
 * Deliberately out of scope: the `anthropic-beta` header, any beta
 * identifier or count, and the body's `thinking` object. Those bytes are
 * mid-change for this profile; the tests that pin them land once they are
 * final. Nothing below reads them.
 */

const BASE = {
  accessToken: "sentinel-token-registration-280-9e3b",
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

/** The exact rejection, pinned in full. */
const REJECTION = {
  name: "ClaudeCodeWireError",
  code: "INVALID_INPUT",
  message: "INVALID_INPUT",
};

/** One digit off in the SDK patch component: close enough to be a typo. */
const NEAR_MISS_ID = "claude-code-2.1.280-sdk-0.112.2";

function asProfile(value: unknown): ProfileArgument {
  return value as ProfileArgument;
}

const EVIDENCE_TOKEN = "sentinel-token-registration-280-evidence-5a17";

/*
 * The smallest input the evidence builder accepts, mirroring the fixture in
 * `test/validation/redaction.test.ts`. The evidence path validates untrusted
 * records, so it checks the profile id against its own literals rather than
 * by identity -- which is why a spread carrying the real id is a valid
 * control below.
 */
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

describe("2.1.280 registration: package root", () => {
  it("re-exports the profile singleton itself, not a copy", () => {
    expect(CLAUDE_CODE_2_1_280_PROFILE).toBe(DEEP_CLAUDE_CODE_2_1_280_PROFILE);
    expect(CLAUDE_CODE_2_1_280_PROFILE.id).toBe(
      "claude-code-2.1.280-sdk-0.112.1",
    );
  });

  it("re-exports the beta registry itself, not a copy", () => {
    expect(BETA_REGISTRY_2_1_280).toBe(DEEP_BETA_REGISTRY_2_1_280);
  });
});

describe("2.1.280 registration: builder acceptance", () => {
  it("accepts the singleton passed explicitly", async () => {
    const result = await buildClaudeCodeRequest(
      BASE,
      CLAUDE_CODE_2_1_280_PROFILE,
    );

    // Read off the profile rather than retyped, so this cannot disagree with it.
    expect(result.url).toBe(CLAUDE_CODE_2_1_280_PROFILE.endpoint);
    expect(result.evidence.profileId).toBe(CLAUDE_CODE_2_1_280_PROFILE.id);
  });

  it("rejects a shallow clone that is structurally identical", async () => {
    const clone = { ...CLAUDE_CODE_2_1_280_PROFILE };

    // Shape is not what is checked: the clone compares equal...
    expect(clone).toEqual(CLAUDE_CODE_2_1_280_PROFILE);
    expect(clone).not.toBe(CLAUDE_CODE_2_1_280_PROFILE);
    // ...and is still refused, because it is a different object.
    await expect(
      buildClaudeCodeRequest(BASE, asProfile(clone)),
    ).rejects.toMatchObject(REJECTION);
  });

  it("rejects a deep clone", async () => {
    const deep: unknown = structuredClone(CLAUDE_CODE_2_1_280_PROFILE);

    await expect(
      buildClaudeCodeRequest(BASE, asProfile(deep)),
    ).rejects.toMatchObject(REJECTION);
  });
});

describe("2.1.280 registration: evidence id literals", () => {
  it("accepts evidence claiming the 2.1.280 id", async () => {
    const evidence = await buildRedactedEvidence(
      evidenceInput(CLAUDE_CODE_2_1_280_PROFILE),
    );

    expect(evidence.profileId).toBe(CLAUDE_CODE_2_1_280_PROFILE.id);
  });

  it("accepts a copy carrying the real id, so the id is what is checked", async () => {
    // Control for the near-miss case: without it, a rejection there could be
    // blamed on the copy rather than on the id.
    const copy = { ...CLAUDE_CODE_2_1_280_PROFILE };

    await expect(
      buildRedactedEvidence(evidenceInput(copy)),
    ).resolves.toMatchObject({ profileId: CLAUDE_CODE_2_1_280_PROFILE.id });
  });

  it("rejects evidence claiming a near-miss id", async () => {
    const nearMiss = { ...CLAUDE_CODE_2_1_280_PROFILE, id: NEAR_MISS_ID };

    await expect(
      buildRedactedEvidence(evidenceInput(nearMiss)),
    ).rejects.toMatchObject(REJECTION);
  });
});

describe("default profile: always an accepted profile", () => {
  /*
   * Version-agnostic on purpose. The claim is that whatever the default seam
   * points at is registered, so this must keep passing when the default moves.
   */
  it("builds with the profile argument omitted", async () => {
    await expect(buildClaudeCodeRequest(BASE)).resolves.toMatchObject({
      evidence: { profileId: DEFAULT_PROFILE.id },
    });
  });

  it("builds with the default passed explicitly, to the same profile id", async () => {
    const implicit = await buildClaudeCodeRequest(BASE);
    const explicit = await buildClaudeCodeRequest(BASE, DEFAULT_PROFILE);

    expect(explicit.evidence.profileId).toBe(implicit.evidence.profileId);
  });
});

/*
 * Beta registry binding: documented here, NOT asserted.
 *
 * `src/betas.ts` maps a profile id to its registry through
 * `PROFILE_BETA_REGISTRIES`, read by `resolveBetaRegistry`. Both are
 * module-private: neither is exported, so this file cannot ask which registry
 * the 2.1.280 id resolves to. The only observable consequence of that binding
 * is the composed beta list (`composeBetas` / the `anthropic-beta` header),
 * and those bytes are deliberately excluded from this file while they are
 * still changing.
 *
 * What this file therefore does NOT prove: that the 2.1.280 id is bound to
 * `BETA_REGISTRY_2_1_280` rather than to another registry, or bound at all.
 * `resolveBetaRegistry` falls back to the 2.1.195 registry for an unknown id
 * instead of throwing, so an unbound id or a wrong binding would pass every
 * test above without a single failure. That binding is proven later by the
 * test that pins the final composed 2.1.280 beta identifiers once those bytes
 * stop changing.
 */
