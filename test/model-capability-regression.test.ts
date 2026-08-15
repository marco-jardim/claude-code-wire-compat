import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../src/index.js";
import { deriveCapabilities } from "../src/model-capabilities.js";
import { resolveModel } from "../src/models.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";

/*
 * Capability derivation follows the catalogue of the profile it is given.
 *
 * Wave 1 pinned derivation to the 2.1.195 catalogue because `deriveCapabilities`
 * took only a normalized id, and this file asserted the artefact of that
 * pinning: a caller-supplied catalogue could not move a capability row. That
 * invariant is now inverted by design -- 2.1.222+ ships its own catalogue, and
 * a request built against it must derive from IT -- so the assertions below
 * pin the new contract instead.
 *
 * What kept forged profiles off the wire was never this file. It is the
 * by-reference profile registry in `src/build-request.ts`, asserted at the
 * bottom of this file and exhaustively in
 * `test/validation/profile-acceptance.test.ts`.
 */

type SupportedModels = (typeof CLAUDE_CODE_2_1_195_PROFILE)["supportedModels"];

function withCapabilities(
  overrides: Readonly<Record<string, readonly string[]>>,
): typeof CLAUDE_CODE_2_1_195_PROFILE {
  const supportedModels: Record<string, SupportedModels[string]> = {
    ...CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
  };
  for (const [modelId, capabilities] of Object.entries(overrides)) {
    const entry = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[modelId];
    if (entry === undefined) {
      throw new TypeError(`Missing catalogue entry for ${modelId}.`);
    }
    supportedModels[modelId] = { ...entry, capabilities };
  }
  return { ...CLAUDE_CODE_2_1_195_PROFILE, supportedModels };
}

describe("capability derivation follows the supplied profile catalogue", () => {
  it("honours the catalogue of a non-pinned profile", () => {
    // A profile whose id is not 2.1.195's: no C1 inheritance, no pinned
    // catalogue, the rows below come from the supplied entries alone.
    const profile = {
      ...withCapabilities({
        "claude-opus-4-7": [],
        "claude-sonnet-4-6": ["effort", "max_effort", "xhigh_effort"],
      }),
      id: "synthetic-catalogue-profile",
    };

    expect(resolveModel("claude-opus-4-7", profile).capabilities).toMatchObject(
      {
        effort: false,
        maxEffort: false,
        xhighEffort: false,
        adaptiveThinking: false,
      },
    );
    expect(
      resolveModel("claude-sonnet-4-6", profile).capabilities,
    ).toMatchObject({
      effort: true,
      maxEffort: true,
      xhighEffort: true,
    });
  });

  it("scopes the C1 effort exception to the 2.1.195 profile", () => {
    /*
     * `claude-opus-4-5` omits `effort` from its 2.1.195 capabilities array,
     * yet 2.1.195 puts `effort: true` on the wire -- the demarcated C1
     * exception in `docs/plans/BLOCKERS.md`. The exception is gated on the
     * PROFILE ID, so an identically-shaped catalogue under a different id
     * gets the honest catalogue answer.
     */
    const impostor = {
      ...CLAUDE_CODE_2_1_195_PROFILE,
      id: "synthetic-catalogue-profile",
    };

    expect(
      resolveModel("claude-opus-4-5", CLAUDE_CODE_2_1_195_PROFILE).capabilities
        .effort,
    ).toBe(true);
    expect(resolveModel("claude-opus-4-5", impostor).capabilities.effort).toBe(
      false,
    );
    // The other rows are catalogue-read either way, so they do not move.
    expect(deriveCapabilities("claude-opus-4-5", impostor)).toMatchObject({
      maxEffort: false,
      xhighEffort: false,
      adaptiveThinking: false,
    });
  });

  it("keeps forged profiles off the wire by reference, not by shape", async () => {
    // The guardian that replaced this file's old invariant. A structurally
    // perfect clone still cannot reach derivation through the public builder.
    const clone = { ...CLAUDE_CODE_2_1_195_PROFILE };
    expect(clone).toEqual(CLAUDE_CODE_2_1_195_PROFILE);

    await expect(
      buildClaudeCodeRequest(
        {
          accessToken: "sentinel-token-capability-regression-9d24",
          model: "claude-opus-4-5",
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
        },
        clone,
      ),
    ).rejects.toMatchObject({
      name: "ClaudeCodeWireError",
      code: "INVALID_INPUT",
    });
  });
});

describe("capability rows remain independent per model", () => {
  // These rows are catalogue-backed now, except `temperature`, which has no
  // catalogue string and stays on its allowlist predicate. Either way the
  // distinguishing rows must not collapse into one another.
  it("preserves every distinguishing model row and temperature allowlist polarity", () => {
    const opus45 = resolveModel("claude-opus-4-5").capabilities;
    expect(opus45).toMatchObject({
      effort: true,
      maxEffort: false,
      adaptiveThinking: false,
    });

    expect(resolveModel("claude-sonnet-4-6").capabilities).toMatchObject({
      maxEffort: true,
      xhighEffort: false,
    });
    expect(resolveModel("claude-opus-4-6").capabilities).toMatchObject({
      maxEffort: true,
      xhighEffort: false,
    });
    expect(resolveModel("claude-opus-4-7").capabilities).toMatchObject({
      xhighEffort: true,
      rejectsDisabledThinking: false,
      temperature: false,
    });
    expect(resolveModel("claude-fable-5").capabilities).toMatchObject({
      rejectsDisabledThinking: true,
      temperature: false,
    });
    expect(resolveModel("claude-3-5-haiku").capabilities.temperature).toBe(
      true,
    );
  });
});
