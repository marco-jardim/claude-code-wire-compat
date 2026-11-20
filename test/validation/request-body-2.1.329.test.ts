// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
} from "../../src/index.js";

/*
 * Generated `context_management` on 2.1.329: when the context-management beta
 * fired and thinking is adaptive or enabled, the genuine client attaches
 * `{edits:[{type:"clear_thinking_20251015",keep:"all"}]}` unless the caller
 * supplied its own value. Live capture: `inter329-205`.
 */

const CONTEXT_MANAGEMENT_BETA = "context-management-2025-06-27";
const GENERATED = {
  edits: [{ type: "clear_thinking_20251015", keep: "all" }],
};

const BASE = {
  accessToken: "request-body-token-not-a-secret",
  model: "claude-opus-5-5",
  maxTokens: 128,
  messages: [{ role: "user", content: "hello" }],
  runtime: {
    sessionId: "00000000-0000-4000-8000-000000000001",
    deviceId:
      "0000000000000000000000000000000000000000000000000000000000000002",
    accountUuid: "00000000-0000-4000-8000-000000000000",
    runtime: "node",
    runtimeVersion: "v24.15.0",
    os: "Windows",
    arch: "x64",
  },
  clientRequestId: "00000000-0000-4000-8000-000000000002",
} as const satisfies ClaudeCodeRequestInput;

async function bodyOf(
  extra: Partial<ClaudeCodeRequestInput> = {},
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_329_PROFILE,
): Promise<{
  readonly body: Record<string, unknown>;
  readonly betas: readonly string[];
}> {
  const built = await buildClaudeCodeRequest({ ...BASE, ...extra }, profile);
  return {
    body: JSON.parse(built.body) as Record<string, unknown>,
    betas: built.evidence.betaFeatures,
  };
}

describe("generated context_management on 2.1.329", () => {
  it("is generated when thinking is adaptive", async () => {
    const { body, betas } = await bodyOf({ thinking: { type: "adaptive" } });

    expect(betas).toContain(CONTEXT_MANAGEMENT_BETA);
    expect(body["context_management"]).toStrictEqual(GENERATED);
  });

  it("is generated when thinking is enabled", async () => {
    const { body } = await bodyOf({
      thinking: { type: "enabled", budgetTokens: 1024 },
    });

    expect(body["context_management"]).toStrictEqual(GENERATED);
  });

  it("is absent without thinking", async () => {
    const { body, betas } = await bodyOf();

    expect(betas).toContain(CONTEXT_MANAGEMENT_BETA);
    expect(body).not.toHaveProperty("context_management");
  });

  it("is absent when thinking is disabled", async () => {
    const { body } = await bodyOf({ thinking: { type: "disabled" } });

    expect(body).not.toHaveProperty("context_management");
  });

  it("is absent without the context-management capability", async () => {
    const { body, betas } = await bodyOf({
      thinking: { type: "adaptive" },
      capabilities: { contextManagement: false },
    });

    expect(betas).not.toContain(CONTEXT_MANAGEMENT_BETA);
    expect(body).not.toHaveProperty("context_management");
  });

  it("yields to the caller's contextManagement value", async () => {
    const edits = [
      {
        type: "clear_tool_uses_20250919",
        keep: { type: "tool_uses", value: 3 },
      },
    ] as const;
    const { body } = await bodyOf({
      thinking: { type: "adaptive" },
      contextManagement: { edits },
    });

    expect(body["context_management"]).toStrictEqual({
      edits: [
        {
          type: "clear_tool_uses_20250919",
          keep: { type: "tool_uses", value: 3 },
        },
      ],
    });
  });

  it("yields to an explicit null from the caller", async () => {
    const { body } = await bodyOf({
      thinking: { type: "adaptive" },
      contextManagement: null,
    });

    expect(body["context_management"]).toBeNull();
  });

  it("yields to a context_management experimental body field", async () => {
    const { body } = await bodyOf({
      thinking: { type: "adaptive" },
      experimentalBodyFields: { context_management: { edits: [] } },
    });

    expect(body["context_management"]).toStrictEqual({ edits: [] });
  });

  it("survives suppressing the beta identifier (header only)", async () => {
    const { body, betas } = await bodyOf({
      thinking: { type: "adaptive" },
      suppressBetas: [CONTEXT_MANAGEMENT_BETA],
    });

    expect(betas).not.toContain(CONTEXT_MANAGEMENT_BETA);
    expect(body["context_management"]).toStrictEqual(GENERATED);
  });

  it.each([
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
    ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ])("is not generated on %s", async (_name, profile) => {
    const { body, betas } = await bodyOf(
      { thinking: { type: "adaptive" } },
      profile,
    );

    expect(betas).toContain(CONTEXT_MANAGEMENT_BETA);
    expect(body).not.toHaveProperty("context_management");
  });
});
