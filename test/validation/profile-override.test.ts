// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../../src/index.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";

const base = {
  accessToken: "sentinel-token-profile-override-91f2",
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

function headerValue(
  headers: readonly (readonly [string, string])[],
  name: string,
): string | undefined {
  return headers.find(([candidate]) => candidate === name)?.[1];
}

describe("catalogue entry validation coverage", () => {
  const modelId = "claude-opus-4-7";
  const catalogueEntry = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[modelId];

  it.each([
    ["non-object context", "not-an-object"],
    ["unknown context key", { ...catalogueEntry.context, unexpected: true }],
    [
      "non-numeric context window",
      { ...catalogueEntry.context, window: "200000" },
    ],
    ["zero context window", { ...catalogueEntry.context, window: 0 }],
    ["negative context window", { ...catalogueEntry.context, window: -1 }],
    ["non-boolean native1m", { ...catalogueEntry.context, native1m: "true" }],
    [
      "non-boolean supports1mBeta",
      { ...catalogueEntry.context, supports1mBeta: "true" },
    ],
  ])("rejects %s", async (_name, context) => {
    await expect(
      buildWithOverride({
        supportedModels: {
          [modelId]: { ...catalogueEntry, context },
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it.each([
    ["non-array capabilities", { thinking: true }],
    ["non-string capability element", ["thinking", 1]],
  ])("rejects %s", async (_name, capabilities) => {
    await expect(
      buildWithOverride({
        supportedModels: {
          [modelId]: { ...catalogueEntry, capabilities },
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects an invalid defaultEffort", async () => {
    await expect(
      buildWithOverride({
        supportedModels: {
          [modelId]: { ...catalogueEntry, defaultEffort: "maximum" },
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a non-string defaultEffort", async () => {
    await expect(
      buildWithOverride({
        supportedModels: {
          [modelId]: { ...catalogueEntry, defaultEffort: 1 },
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a non-boolean profile flag", async () => {
    await expect(
      buildWithOverride({ contextHintEnabled: "true" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

function buildWithOverride(profileOverride: unknown) {
  const input: Record<string, unknown> = { ...base, profileOverride };
  return buildClaudeCodeRequest(
    input as Parameters<typeof buildClaudeCodeRequest>[0],
  );
}

describe("protocol profile override", () => {
  it("preserves pinned output when the override is absent", async () => {
    const result = await buildClaudeCodeRequest(base);

    expect(headerValue(result.headers, "user-agent")).toBe(
      "claude-cli/2.1.195 (external, cli)",
    );
    expect(headerValue(result.headers, "anthropic-version")).toBe("2023-06-01");
  });

  it("uses a consistent CLI version in the user-agent and billing headers", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      profileOverride: {
        cliVersion: "2.1.196",
        userAgent: "claude-cli/2.1.196 (external, cli)",
      },
    });

    expect(headerValue(result.headers, "user-agent")).toBe(
      "claude-cli/2.1.196 (external, cli)",
    );
    expect(result.body).toContain("cc_version=2.1.196.");
  });

  it("reports an overridden profile id as effective evidence", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      profileOverride: { id: "emergency-profile" },
    });

    expect(result.evidence.profileId).toBe("emergency-profile");
  });

  it("keeps the pinned endpoint for a valid override", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      profileOverride: { id: "emergency-profile" },
    });

    expect(result.url).toBe("https://api.anthropic.com/v1/messages?beta=true");
  });

  it.each([
    { endpoint: "https://evil.example/v1" },
    { provider: "bedrock" },
    { anthropicVersion: "2024-01-01" },
    { typo: 1 },
    {},
    { cliVersion: "2.1.196" },
    {
      cliVersion: "2.1.196",
      userAgent: "claude-cli/2.1.195 (external, cli)",
    },
  ])(
    "rejects forbidden or inconsistent override %#",
    async (profileOverride) => {
      await expect(buildWithOverride(profileOverride)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    },
  );

  // Each case is wrapped in its own array because `it.each` SPREADS array
  // elements as arguments: a bare `[]` case supplies zero arguments, so
  // `profileOverride` would arrive as `undefined` rather than as the empty
  // array under test. Wrapping keeps every case a single argument.
  it.each([[null], [[]], ["2.1.196"], [new Date()]])(
    "rejects a non-record override %#",
    async (profileOverride) => {
      await expect(buildWithOverride(profileOverride)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    },
  );

  it.each([
    "id",
    "cliVersion",
    "sdkVersion",
    "entrypoint",
    "userAgent",
    "buildTime",
    "gitSha",
  ])("rejects an empty %s", async (field) => {
    await expect(buildWithOverride({ [field]: "" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("uses an overridden supported-model table for model resolution", async () => {
    const model = "claude-emergency-5-0";
    const input = { ...base, model };
    const passthrough = await buildClaudeCodeRequest(input);
    expect(passthrough.evidence.modelFamily).toBe("unknown");

    const result = await buildClaudeCodeRequest({
      ...input,
      profileOverride: {
        supportedModels: {
          [model]: {
            family: "opus",
            capabilities: [],
          },
        },
      },
    });

    expect(JSON.parse(result.body)).toMatchObject({ model });
  });

  it("accepts the pinned profile's own model table as an override", async () => {
    const pinned = await buildClaudeCodeRequest(base);
    const overridden = await buildClaudeCodeRequest({
      ...base,
      profileOverride: {
        supportedModels: CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
      },
    });

    expect(overridden.body).toBe(pinned.body);
    expect(overridden.headers).toEqual(pinned.headers);
  });

  it.each([
    ["a non-array", "override-model"],
    ["duplicate entries", ["override-model", "override-model"]],
    ["an empty string", [""]],
  ])(
    "rejects a removed descriptor field containing %s",
    async (_description, removedFieldValue) => {
      await expect(
        buildWithOverride({
          supportedModels: {
            [base.model]: {
              family: "opus",
              removedField: removedFieldValue,
              capabilities: [],
            },
          },
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    },
  );

  it("accepts Claude 3 while retaining interleaved thinking for other supported models", async () => {
    const existing = await buildClaudeCodeRequest(base);

    await expect(
      buildClaudeCodeRequest({
        ...base,
        model: "claude-3-5-haiku",
      }),
    ).resolves.toMatchObject({ evidence: { modelFamily: "haiku" } });
    expect(headerValue(existing.headers, "anthropic-beta")).toContain(
      "interleaved-thinking-2025-05-14",
    );
  });

  it("applies an SDK version override to the package-version header", async () => {
    const result = await buildWithOverride({ sdkVersion: "0.95.1" });
    expect(headerValue(result.headers, "x-stainless-package-version")).toBe(
      "0.95.1",
    );
  });

  it("accepts and preserves every remaining scalar override", async () => {
    const result = await buildWithOverride({
      buildTime: "2026-02-03T04:05:06.000Z",
      gitSha: "profile-override-sha",
      attributionHeaderEnabled: false,
    });

    expect(result.method).toBe("POST");
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([true, false])(
    "accepts boolean attributionHeaderEnabled=%s",
    async (attributionHeaderEnabled) => {
      await expect(
        buildWithOverride({ attributionHeaderEnabled }),
      ).resolves.toMatchObject({ method: "POST" });
    },
  );

  it.each([[null], [0], ["false"], [[]], [{}]])(
    "rejects non-boolean attributionHeaderEnabled %#",
    async (attributionHeaderEnabled) => {
      await expect(
        buildWithOverride({ attributionHeaderEnabled }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    },
  );

  it("uses a context-hint override", async () => {
    const result = await buildWithOverride({ contextHintEnabled: true });
    expect(JSON.parse(result.body)).toHaveProperty("context_hint", {
      enabled: true,
    });
    expect(result.headers).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(["anthropic-beta", expect.any(String)]),
      ]),
    );
  });

  it.each([
    ["narrationSummariesEnabled", "summarize-connector-text-2026-03-13", 5],
    ["afkModeEnabled", "afk-mode-2026-01-31", 8],
    ["cacheDiagnosisEnabled", "cache-diagnosis-2026-04-07", 8],
  ] as const)(
    "emits %s at its upstream push position",
    async (flag, expectedBeta, expectedIndex) => {
      const result = await buildWithOverride({
        betaPolicy: {
          ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
          [flag]: true,
        },
      });

      expect(result.evidence.betaFeatures).toContain(expectedBeta);
      expect(result.evidence.betaFeatures.indexOf(expectedBeta)).toBe(
        expectedIndex,
      );
    },
  );

  it.each([
    ["a non-record value", null],
    [
      "a missing key",
      Object.fromEntries(
        Object.entries(CLAUDE_CODE_2_1_195_PROFILE.betaPolicy).filter(
          ([key]) => key !== "cacheDiagnosisEnabled",
        ),
      ),
    ],
    [
      "an extra key",
      { ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy, unexpected: true },
    ],
    [
      "a non-boolean value",
      { ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy, afkModeEnabled: "false" },
    ],
  ])("rejects betaPolicy with %s", async (_description, betaPolicy) => {
    await expect(buildWithOverride({ betaPolicy })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it.each([
    // `orderedBetas` was a real protocol field on the public contract until it
    // was removed in this work package; `composeBetas` now derives beta order
    // from model and host state. The key must never be silently accepted
    // again, so it is pinned here alongside never-existing names.
    "orderedBetas",
    "notAProfileField",
    "betaOrder",
  ])(
    "rejects an unrecognised top-level override key %s",
    async (unrecognisedKey) => {
      await expect(
        buildWithOverride({ [unrecognisedKey]: ["effort-2025-11-24"] }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    },
  );

  it.each([
    null,
    [],
    {},
    { contextHint: false },
    {
      contextHint: false,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: false,
      unexpected: false,
    },
    {
      contextHint: "false",
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: false,
    },
    {
      contextHint: false,
      adaptiveThinking: 0,
      effort: false,
      interleavedThinking: false,
    },
    {
      contextHint: false,
      adaptiveThinking: false,
      effort: null,
      interleavedThinking: false,
    },
    {
      contextHint: false,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: "false",
    },
  ])("rejects removed default capabilities %#", async (defaultCapabilities) => {
    await expect(
      buildWithOverride({ defaultCapabilities }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it.each([["haiku"], ["sonnet"], ["opus"], ["fable"]] as const)(
    "accepts the exact supported-model family %s",
    async (family) => {
      const model = `claude-override-${family}`;
      const result = await buildClaudeCodeRequest({
        ...base,
        model,
        profileOverride: {
          supportedModels: {
            [model]: {
              family,
              capabilities: [],
            },
          },
        },
      });

      expect(result.evidence.modelFamily).toBe(family);
    },
  );

  it("rejects an unrecognised supported-model family", async () => {
    await expect(
      buildWithOverride({
        supportedModels: {
          "claude-override-falcon": {
            family: "falcon",
            capabilities: {
              contextHint: true,
              adaptiveThinking: true,
              effort: true,
              interleavedThinking: true,
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it.each([
    null,
    [],
    {},
    { model: null },
    {
      model: {
        family: "invalid",
        removedField: ["model"],
        capabilities: {
          contextHint: true,
          adaptiveThinking: true,
          effort: true,
          interleavedThinking: true,
        },
      },
    },
    {
      model: {
        family: 7,
        removedField: ["model"],
        capabilities: {
          contextHint: true,
          adaptiveThinking: true,
          effort: true,
          interleavedThinking: true,
        },
      },
    },
    {
      model: {
        family: "opus",
        removedField: [""],
        capabilities: {
          contextHint: true,
          adaptiveThinking: true,
          effort: true,
          interleavedThinking: true,
        },
      },
    },
    {
      model: {
        family: "opus",
        removedField: ["same", "same"],
        capabilities: {
          contextHint: true,
          adaptiveThinking: true,
          effort: true,
          interleavedThinking: true,
        },
      },
    },
  ])(
    "rejects a malformed supported-model table %#",
    async (supportedModels) => {
      await expect(
        buildWithOverride({ supportedModels }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    },
  );

  it("rejects empty and symbol supported-model keys", async () => {
    const validModel = {
      family: "opus",
      capabilities: {
        contextHint: true,
        adaptiveThinking: true,
        effort: true,
        interleavedThinking: true,
      },
    } as const;
    await expect(
      buildWithOverride({ supportedModels: { "": validModel } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    const supportedModels = { model: validModel };
    Object.defineProperty(supportedModels, Symbol("model"), {
      enumerable: true,
      value: validModel,
    });
    await expect(buildWithOverride({ supportedModels })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("rejects an empty supported-model key beside the requested model", async () => {
    const validModel = {
      family: "opus",
      capabilities: {
        contextHint: true,
        adaptiveThinking: true,
        effort: true,
        interleavedThinking: true,
      },
    } as const;
    await expect(
      buildWithOverride({
        supportedModels: {
          "": validModel,
          [base.model]: validModel,
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a symbol supported-model key beside the requested model", async () => {
    const validModel = {
      family: "opus",
      capabilities: {
        contextHint: true,
        adaptiveThinking: true,
        effort: true,
        interleavedThinking: true,
      },
    } as const;
    const supportedModels = { [base.model]: validModel };
    Object.defineProperty(supportedModels, Symbol("model"), {
      enumerable: true,
      value: validModel,
    });
    await expect(buildWithOverride({ supportedModels })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});
