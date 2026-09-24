// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { resolveBetaRegistry } from "../../src/betas.js";
import { DEFAULT_PROFILE } from "../../src/build-request.js";
import {
  BETA_REGISTRY,
  BETA_REGISTRY_2_1_233,
  BETA_REGISTRY_2_1_280,
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
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
    expect(DEFAULT_PROFILE).toBe(CLAUDE_CODE_2_1_280_PROFILE);
  });
});

/*
 * Beta registry binding.
 *
 * This is the one registration seam whose failure is SILENT. `src/betas.ts`
 * maps a profile id to its registry through `PROFILE_BETA_REGISTRIES`, read by
 * `resolveBetaRegistry`, which falls back to the 2.1.195 registry for an
 * unknown id rather than throwing.
 *
 * A mis-binding is INVISIBLE at runtime today. Every key that
 * `ComposableBetaRegistry` requires carries an identical header string in all
 * three registries, and the one key that differs -- `NARRATION_SUMMARIES` --
 * is gated off by `narrationSummariesEnabled: false` on all three profiles. So
 * a 2.1.280 id bound to the 2.1.233 registry, or unbound and falling through
 * to 2.1.195, produces byte-identical output for every input this repository
 * can construct today. There is no composed byte to observe, which is exactly
 * why the resolver has to be asked directly rather than through its effects.
 *
 * An earlier version of this suite matched the map entry in the SOURCE TEXT of
 * `src/betas.ts` instead. That was too weak, and the failure modes it missed
 * are worth naming so nobody reinstates it: the tuple relocated into dead code
 * elsewhere in the module, `resolveBetaRegistry` rewritten to ignore the map,
 * or the lookup rekeyed off a different profile field would all leave the text
 * matching while the binding did nothing. `resolveBetaRegistry` is therefore
 * exported for tests and asserted by identity below.
 *
 * What this does NOT discharge: that the registry a profile resolves to is the
 * registry whose entries reach the wire. Establishing that needs the composed
 * `anthropic-beta` list to contain at least one identifier only
 * `BETA_REGISTRY_2_1_280` carries -- and today no such identifier can reach it,
 * because `ComposableBetaRegistry` declares sixteen required keys plus one
 * optional, and every key new to 2.1.280 is absent from the type, so
 * `composeBetas` has no push site for any of them. That obligation therefore
 * falls to the phase that extends the type and adds the push sites: its final
 * composed-beta assertion must include at least one such identifier, emitted
 * under an input this suite can construct.
 */
describe("2.1.280 registration: beta registry binding", () => {
  it("resolves the 2.1.280 profile to the 2.1.280 registry", () => {
    expect(resolveBetaRegistry(CLAUDE_CODE_2_1_280_PROFILE)).toBe(
      BETA_REGISTRY_2_1_280,
    );
  });

  it("resolves the older profiles to their own registries", () => {
    // Anti-vacuity: proves the resolver discriminates rather than returning
    // the 2.1.280 registry, or one registry, for everything.
    expect(resolveBetaRegistry(CLAUDE_CODE_2_1_195_PROFILE)).toBe(
      BETA_REGISTRY,
    );
    expect(resolveBetaRegistry(CLAUDE_CODE_2_1_233_PROFILE)).toBe(
      BETA_REGISTRY_2_1_233,
    );
  });

  it("falls back to the 2.1.195 registry for an unknown id", () => {
    // Documents the fallback that makes a mis-binding silent. A profile the
    // map does not know is not refused here; the request builder refuses it.
    const unknown = {
      ...CLAUDE_CODE_2_1_280_PROFILE,
      id: "claude-code-0.0.0-sdk-0.0.0",
    };

    expect(resolveBetaRegistry(unknown)).toBe(BETA_REGISTRY);
    expect(resolveBetaRegistry(unknown)).not.toBe(BETA_REGISTRY_2_1_280);
  });
});
