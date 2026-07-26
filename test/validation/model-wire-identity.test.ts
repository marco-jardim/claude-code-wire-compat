// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
} from "../../src/index.js";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_REQUEST_ID = "00000000-0000-4000-8000-000000000002";

type RuntimeBuildInput = ClaudeCodeRequestInput & {
  readonly clientRequestId: string;
};

function inputFor(model: string): RuntimeBuildInput {
  return {
    accessToken: "sentinel-token-model-identity",
    model,
    maxTokens: 128,
    messages: [{ role: "user", content: "model identity regression" }],
    runtime: {
      sessionId: SESSION_ID,
      deviceId:
        "0000000000000000000000000000000000000000000000000000000000000002",
      accountUuid: "00000000-0000-4000-8000-000000000000",
      runtime: "node",
      runtimeVersion: "v24.15.0",
      os: "Windows",
      arch: "x64",
    },
    clientRequestId: CLIENT_REQUEST_ID,
  };
}

describe("public model wire identity", () => {
  it("builds every catalogue model without rewriting its wire id", async () => {
    for (const [canonicalModelId, definition] of Object.entries(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      const built = await buildClaudeCodeRequest(inputFor(canonicalModelId));
      const body: unknown = JSON.parse(built.body);

      expect(body).toEqual(
        expect.objectContaining({ model: canonicalModelId }),
      );
      expect(built.evidence.modelFamily).toBe(definition.family);
    }
  });

  it.each(["claude-opus-4-9", "gpt-4o"])(
    "passes an unrecognised model %s through",
    async (model) => {
      const built = await buildClaudeCodeRequest(inputFor(model));
      expect(JSON.parse(built.body)).toEqual(
        expect.objectContaining({ model }),
      );
      expect(built.evidence.modelFamily).toBe(
        model.includes("opus") ? "opus" : "unknown",
      );
    },
  );

  it.each(["claude-opus-4-6[1m]", "claude-opus-4-6[2M]"])(
    "removes only model markers from the wire id for %s",
    async (model) => {
      const built = await buildClaudeCodeRequest(inputFor(model));
      expect(JSON.parse(built.body)).toEqual(
        expect.objectContaining({ model: "claude-opus-4-6" }),
      );
      expect(built.evidence.modelFamily).toBe("opus");
    },
  );

  it("preserves a dated real-world model id on the wire", async () => {
    const model = "claude-sonnet-4-5-20250929";
    const built = await buildClaudeCodeRequest(inputFor(model));

    expect(JSON.parse(built.body)).toEqual(expect.objectContaining({ model }));
    expect(built.evidence.modelFamily).toBe("sonnet");
  });
});
