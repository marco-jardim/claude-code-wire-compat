// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync } from "node:fs";

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

    // NOT discriminating: all three pinned profiles declare the same endpoint,
    // so this would also pass if the builder had silently substituted another
    // profile. It is kept because it pins the URL against the profile rather
    // than against a retyped literal, which is a different property.
    expect(result.url).toBe(CLAUDE_CODE_2_1_280_PROFILE.endpoint);
    // This is the discriminating assertion: the id is unique per profile.
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
 * Beta registry binding.
 *
 * This is the one registration seam whose failure is SILENT. `src/betas.ts`
 * maps a profile id to its registry through `PROFILE_BETA_REGISTRIES`, read by
 * `resolveBetaRegistry`, which falls back to the 2.1.195 registry for an
 * unknown id rather than throwing. Both symbols are module-private, so no test
 * can ask the resolver directly what the 2.1.280 id resolves to.
 *
 * Worse, a mis-binding is currently INVISIBLE at runtime. Every key that
 * `ComposableBetaRegistry` requires carries an identical header string in all
 * three registries, and the one key that differs -- `NARRATION_SUMMARIES` --
 * is gated off by `narrationSummariesEnabled: false` on all three profiles. So
 * a 2.1.280 id bound to the 2.1.233 registry, or unbound and falling through
 * to 2.1.195, produces byte-identical output for every input this repository
 * can construct today. There is no composed byte to observe.
 *
 * The binding is therefore pinned below by reading the source, the same
 * technique `test/governance/version-dispatch.test.ts` and
 * `test/governance/provider-scope.test.ts` use. That is not an intermediate
 * assertion: the map entry is registration, and it does not change when the
 * composed beta list changes.
 *
 * What still has to be discharged later: the test that pins the final composed
 * 2.1.280 `anthropic-beta` list must include at least one identifier that
 * exists ONLY in `BETA_REGISTRY_2_1_280`. The five keys new to 2.1.280 are
 * optional on `ComposableBetaRegistry`, so a fallback registry drops their
 * push sites silently. A final assertion built only from identifiers the older
 * registries also carry would pass under a mis-binding.
 */
describe("2.1.280 registration: beta registry binding", () => {
  const betasSource = readFileSync(
    new URL("../../src/betas.ts", import.meta.url),
    "utf8",
  );
  // Comment-stripped and whitespace-collapsed: what the module executes, and
  // insensitive to how prettier chooses to wrap the map entries.
  const betasCode = betasSource
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\/\/[^\n]*/gu, "")
    .replace(/\s+/gu, " ");

  function bindingPattern(profile: string, registry: string): RegExp {
    return new RegExp(
      `\\[\\s*${profile}\\.id\\s*,\\s*${registry}\\s*,?\\s*\\]`,
      "u",
    );
  }

  it("binds the 2.1.280 profile id to the 2.1.280 registry", () => {
    expect(betasCode).toMatch(
      bindingPattern("CLAUDE_CODE_2_1_280_PROFILE", "BETA_REGISTRY_2_1_280"),
    );
  });

  it("recognises the existing bindings, so the pattern is not vacuous", () => {
    expect(betasCode).toMatch(
      bindingPattern("CLAUDE_CODE_2_1_195_PROFILE", "BETA_REGISTRY"),
    );
    expect(betasCode).toMatch(
      bindingPattern("CLAUDE_CODE_2_1_233_PROFILE", "BETA_REGISTRY_2_1_233"),
    );
  });

  it("does not match a binding that is absent", () => {
    // Guards the reverse failure: a pattern loose enough to match anything
    // would make the assertions above meaningless.
    expect(betasCode).not.toMatch(
      bindingPattern("CLAUDE_CODE_2_1_280_PROFILE", "BETA_REGISTRY_2_1_233"),
    );
  });
});
