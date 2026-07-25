// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/contracts.js";
import { buildClaudeCodeRequest } from "../../src/build-request.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_REQUEST_ID = "00000000-0000-4000-8000-000000000002";

type RuntimeBuildInput = ClaudeCodeRequestInput & {
  readonly clientRequestId: string;
};

function inputFor(model: string): RuntimeBuildInput {
  return {
    accessToken: "sentinel-token-model-aliases",
    model,
    maxTokens: 128,
    messages: [{ role: "user", content: "model alias regression" }],
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

describe("model aliases", () => {
  it("builds every canonical model and alias with canonical evidence", async () => {
    for (const [canonicalModelId, definition] of Object.entries(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      for (const model of [canonicalModelId, ...definition.aliases]) {
        const built = await buildClaudeCodeRequest(inputFor(model));
        const body: unknown = JSON.parse(built.body);

        expect(body).toEqual(
          expect.objectContaining({ model: canonicalModelId }),
        );
        expect(built.evidence.modelFamily).toBe(definition.family);
      }
    }
  });

  it.each(["claude-opus-4-9", "evil-claude-opus-4-8-evil"])(
    "rejects unsupported model %s",
    async (model) => {
      await expect(buildClaudeCodeRequest(inputFor(model))).rejects.toThrow(
        expect.objectContaining({ code: "UNSUPPORTED_MODEL" }),
      );
    },
  );
});
