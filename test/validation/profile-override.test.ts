// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../../src/index.js";

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

  it.each([null, [], "2.1.196", new Date()])(
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

  it.each([[], ["beta-one", "beta-one"]])(
    "rejects an invalid ordered beta list %#",
    async (orderedBetas) => {
      await expect(buildWithOverride({ orderedBetas })).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    },
  );

  it("uses an overridden supported-model table for model resolution", async () => {
    const model = "claude-emergency-5-0";
    const input = { ...base, model };
    await expect(buildClaudeCodeRequest(input)).rejects.toMatchObject({
      code: "UNSUPPORTED_MODEL",
    });

    const result = await buildClaudeCodeRequest({
      ...input,
      profileOverride: {
        supportedModels: {
          [model]: {
            family: "opus",
            aliases: ["emergency-5-0"],
            capabilities: {
              contextHint: true,
              adaptiveThinking: true,
              effort: true,
              interleavedThinking: true,
            },
          },
        },
      },
    });

    expect(JSON.parse(result.body)).toMatchObject({ model });
  });
});
