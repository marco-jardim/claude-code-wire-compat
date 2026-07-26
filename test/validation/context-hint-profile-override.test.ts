// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../../src/index.js";

describe("context hint profile override", () => {
  it("emits context_hint when the effective profile enables it", async () => {
    const result = await buildClaudeCodeRequest({
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
      profileOverride: { contextHintEnabled: true },
    });

    expect(JSON.parse(result.body)).toHaveProperty("context_hint", {
      enabled: true,
    });
  });
});
