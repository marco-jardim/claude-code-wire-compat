// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../../src/index.js";

const base = {
  accessToken: "sentinel-token-thinking-contract-91f2",
  model: "claude-opus-4-6",
  maxTokens: 100000,
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

async function body(overrides: object = {}): Promise<Record<string, unknown>> {
  const built = await buildClaudeCodeRequest({ ...base, ...overrides });
  return JSON.parse(built.body) as Record<string, unknown>;
}

describe("thinking wire contract", () => {
  it.each(["summarized", "omitted"] as const)(
    "emits adaptive display %s",
    async (display) => {
      await expect(
        body({ thinking: { type: "adaptive", display } }),
      ).resolves.toMatchObject({ thinking: { type: "adaptive", display } });
    },
  );

  it("omits display when the caller omits it", async () => {
    const result = await body({ thinking: { type: "adaptive" } });
    expect(result["thinking"]).toEqual({ type: "adaptive" });
    expect(result["thinking"]).not.toHaveProperty("display");
  });

  it("emits or omits disabled thinking according to model capability", async () => {
    await expect(
      body({ model: "claude-opus-4-6", thinking: { type: "disabled" } }),
    ).resolves.toMatchObject({ thinking: { type: "disabled" } });
    const rejecting = await body({
      model: "claude-fable-5",
      thinking: { type: "disabled" },
    });
    expect(rejecting).not.toHaveProperty("thinking");
  });

  it("clamps an explicit enabled budget to max_tokens minus one", async () => {
    await expect(
      body({
        model: "claude-opus-4-0",
        maxTokens: 5000,
        thinking: { type: "enabled", budgetTokens: 40000 },
      }),
    ).resolves.toMatchObject({
      thinking: { budget_tokens: 4999, type: "enabled" },
    });
  });

  it("defaults an enabled budget from the model table", async () => {
    await expect(
      body({
        model: "claude-opus-4-0",
        thinking: { type: "enabled" },
      }),
    ).resolves.toMatchObject({
      thinking: { budget_tokens: 31999, type: "enabled" },
    });
  });

  it("removes redact-thinking only when display is active", async () => {
    const normal = await buildClaudeCodeRequest({
      ...base,
      thinking: { type: "adaptive" },
    });
    const displayed = await buildClaudeCodeRequest({
      ...base,
      thinking: { type: "adaptive", display: "summarized" },
    });
    expect(normal.evidence.betaFeatures).toContain(
      "redact-thinking-2026-02-12",
    );
    expect(displayed.evidence.betaFeatures).not.toContain(
      "redact-thinking-2026-02-12",
    );
  });

  it("demotes forced tool choice during extended thinking", async () => {
    const toolChoice = { type: "tool", name: "X" } as const;
    await expect(
      body({ thinking: { type: "adaptive" }, toolChoice }),
    ).resolves.toMatchObject({ tool_choice: { type: "auto" } });
    await expect(
      body({ model: "claude-fable-5", toolChoice }),
    ).resolves.toMatchObject({ tool_choice: { type: "auto" } });
  });

  it("lets an adaptive model override enabled thinking", async () => {
    const result = await body({
      model: "claude-opus-4-8",
      thinking: { type: "enabled", budgetTokens: 1234 },
    });
    expect(result["thinking"]).toEqual({ type: "adaptive" });
    expect(result["thinking"]).not.toHaveProperty("budget_tokens");
  });

  it("lets a non-adaptive model override adaptive thinking", async () => {
    await expect(
      body({
        model: "claude-opus-4-0",
        thinking: { type: "adaptive" },
      }),
    ).resolves.toMatchObject({
      thinking: { budget_tokens: 31999, type: "enabled" },
    });
  });

  it("serializes budget_tokens before type", async () => {
    const built = await buildClaudeCodeRequest({
      ...base,
      model: "claude-opus-4-0",
      thinking: { type: "enabled", budgetTokens: 1234 },
    });
    expect(built.body.indexOf('"budget_tokens":1234')).toBeLessThan(
      built.body.indexOf('"type":"enabled"'),
    );
  });

  it("suppresses temperature when an unsupported thinking request is active", async () => {
    const result = await body({
      model: "claude-3-5-sonnet",
      thinking: { type: "enabled" },
      temperature: 0.5,
    });
    expect(result).not.toHaveProperty("thinking");
    expect(result).not.toHaveProperty("temperature");
  });
});

describe("thinking validation", () => {
  async function expectInvalid(thinking: unknown): Promise<void> {
    const input: Record<string, unknown> = { ...base, thinking };
    await expect(
      buildClaudeCodeRequest(
        input as Parameters<typeof buildClaudeCodeRequest>[0],
      ),
    ).rejects.toMatchObject({ code: "INVALID_THINKING" });
  }

  it.each([
    null,
    "enabled",
    { type: "enabled", extra: true },
    { type: "automatic" },
    { type: "enabled", budgetTokens: 0 },
    { type: "enabled", budgetTokens: 1.5 },
    { type: "enabled", display: "full" },
    { type: "disabled", display: "omitted" },
  ])("rejects malformed thinking %#", expectInvalid);
});
