// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
} from "../../src/index.js";
import { describe, expect, it } from "vitest";

describe("public request input contract", () => {
  it("builds a request using an explicitly annotated public input", async () => {
    const clientRequestId = "public-contract-request-1";
    const input: ClaudeCodeRequestInput = {
      accessToken: "test-token",
      model: "claude-sonnet-4-6",
      maxTokens: 1024,
      messages: [{ role: "user", content: "Hello" }],
      runtime: {
        sessionId: "session-1",
        deviceId: "device-1",
        accountUuid: "account-1",
        runtime: "node",
        runtimeVersion: "22.0.0",
        os: "Linux",
        arch: "x64",
      },
      clientRequestId,
    };

    const result = buildClaudeCodeRequest(input, CLAUDE_CODE_2_1_195_PROFILE);
    await expect(result).resolves.toBeDefined();
    const built = await result;
    expect(built.headers).toContainEqual([
      "x-client-request-id",
      clientRequestId,
    ]);
  });

  it("accepts the package-extension seams through the public input type", async () => {
    const input: ClaudeCodeRequestInput = {
      accessToken: "test-token",
      model: "claude-sonnet-4-6",
      maxTokens: 1024,
      messages: [{ role: "user", content: "Hello" }],
      runtime: {
        sessionId: "session-1",
        deviceId: "device-1",
        accountUuid: "account-1",
        runtime: "node",
        runtimeVersion: "22.0.0",
        os: "Linux",
        arch: "x64",
      },
      clientRequestId: "public-contract-request-2",
      additionalBetas: ["public-contract-beta-2026-01-01"],
      betaOverrides: { use1MContext: true },
      cacheControl: { suppressIdentityBlock: true },
    };

    const built = await buildClaudeCodeRequest(
      input,
      CLAUDE_CODE_2_1_195_PROFILE,
    );

    expect(built.evidence.betaFeatures).toContain(
      "public-contract-beta-2026-01-01",
    );
    expect(built.evidence.capabilityDecisions.use1MContext).toBe(true);
  });

  it("rejects a public-contract input missing the mandatory client request id", async () => {
    const input: ClaudeCodeRequestInput = {
      accessToken: "test-token",
      model: "claude-sonnet-4-6",
      maxTokens: 1024,
      messages: [{ role: "user", content: "Hello" }],
      runtime: {
        sessionId: "session-1",
        deviceId: "device-1",
        accountUuid: "account-1",
        runtime: "node",
        runtimeVersion: "22.0.0",
        os: "Linux",
        arch: "x64",
      },
      clientRequestId: "removed-before-build",
    };
    Reflect.deleteProperty(input, "clientRequestId");

    await expect(
      buildClaudeCodeRequest(input, CLAUDE_CODE_2_1_195_PROFILE),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
