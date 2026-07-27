// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
} from "../src/index.js";

function input(model: string) {
  return {
    accessToken: "test-token",
    model,
    maxTokens: 1024,
    messages: [{ role: "user" as const, content: "hello" }],
    runtime: {
      sessionId: "00000000-0000-4000-8000-000000000001",
      deviceId:
        "0000000000000000000000000000000000000000000000000000000000000002",
      accountUuid: "00000000-0000-4000-8000-000000000000",
      runtime: "node" as const,
      runtimeVersion: "24.0.0",
      os: "Linux" as const,
      arch: "x64",
    },
    clientRequestId: "capability-wire-test",
  };
}

async function body(
  model: string,
  extra: Readonly<Record<string, unknown>> = {},
): Promise<Record<string, unknown>> {
  const built = await buildClaudeCodeRequest({ ...input(model), ...extra });
  return JSON.parse(built.body) as Record<string, unknown>;
}

describe("model capability wire behavior", () => {
  it("emits the default temperature only for a supporting inactive model", async () => {
    await expect(body("claude-opus-4-5")).resolves.toHaveProperty(
      "temperature",
      1,
    );
    await expect(body("claude-opus-4-7")).resolves.not.toHaveProperty(
      "temperature",
    );
  });

  it("discards unsupported and thinking-active caller temperatures", async () => {
    await expect(
      body("claude-fable-5", { temperature: 0.5 }),
    ).resolves.not.toHaveProperty("temperature");
    await expect(
      body("claude-opus-4-5", {
        thinking: { type: "enabled", budgetTokens: 256 },
        temperature: 0.5,
      }),
    ).resolves.not.toHaveProperty("temperature");
    await expect(
      body("claude-opus-4-5", { temperature: 0.5 }),
    ).resolves.toHaveProperty("temperature", 0.5);
  });

  it.each([
    ["claude-opus-4-7", "xhigh"],
    ["claude-opus-4-6", "max"],
  ] as const)("accepts effort on %s at tier %s", async (model, effort) => {
    await expect(body(model, { effort })).resolves.toEqual(expect.any(Object));
  });

  it.each([
    ["claude-opus-4-6", "xhigh"],
    ["claude-opus-4-5", "max"],
    ["claude-haiku-4-5", "high"],
  ] as const)("rejects effort %s on %s", async (model, effort) => {
    await expect(body(model, { effort })).rejects.toMatchObject({
      code: "INVALID_EFFORT",
    });
  });

  it("exposes but never applies the Opus 4.7 default effort", async () => {
    expect(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-7"]
        ?.defaultEffort,
    ).toBe("xhigh");
    await expect(body("claude-opus-4-7")).resolves.not.toHaveProperty(
      "output_config",
    );
  });
});
