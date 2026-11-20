// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  ClaudeCodeWireError,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
} from "../../src/index.js";

/*
 * `diagnostics` on 2.1.329: alongside the cache-diagnosis beta the body always
 * carries `{previous_message_id: <id | null>}`. Live capture: `inter329-205`
 * (`null` on the first request of a thread).
 */

const CACHE_DIAGNOSIS_BETA = "cache-diagnosis-2026-04-07";

const BASE = {
  accessToken: "diagnostics-token-not-a-secret",
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
): Promise<Record<string, unknown>> {
  const built = await buildClaudeCodeRequest({ ...BASE, ...extra }, profile);
  return JSON.parse(built.body) as Record<string, unknown>;
}

async function failureCode(
  extra: Partial<ClaudeCodeRequestInput>,
): Promise<string | undefined> {
  try {
    await buildClaudeCodeRequest(
      { ...BASE, ...extra },
      CLAUDE_CODE_2_1_329_PROFILE,
    );
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  return undefined;
}

describe("diagnostics on 2.1.329", () => {
  it("carries a null previous_message_id by default", async () => {
    const built = await buildClaudeCodeRequest(
      BASE,
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    const body = JSON.parse(built.body) as Record<string, unknown>;

    expect(built.evidence.betaFeatures).toContain(CACHE_DIAGNOSIS_BETA);
    expect(body["diagnostics"]).toStrictEqual({ previous_message_id: null });
  });

  it("carries null for an explicit null", async () => {
    const body = await bodyOf({ previousMessageId: null });

    expect(body["diagnostics"]).toStrictEqual({ previous_message_id: null });
  });

  it("echoes a valid previous message id", async () => {
    const body = await bodyOf({ previousMessageId: "msg_01AbC_dEf" });

    expect(body["diagnostics"]).toStrictEqual({
      previous_message_id: "msg_01AbC_dEf",
    });
  });

  it("accepts a 64-character id body and refuses 65", async () => {
    const longest = `msg_${"a".repeat(64)}`;
    const tooLong = `msg_${"a".repeat(65)}`;
    const ok = await bodyOf({ previousMessageId: longest });

    expect(ok["diagnostics"]).toStrictEqual({ previous_message_id: longest });
    expect(await failureCode({ previousMessageId: tooLong })).toBe(
      "INVALID_INPUT",
    );
  });

  it.each([
    ["empty", ""],
    ["no prefix", "01AbC"],
    ["bare prefix", "msg_"],
    ["wrong prefix", "req_01AbC"],
    ["hyphen", "msg_01-AbC"],
    ["space", "msg_01 AbC"],
    ["trailing newline", "msg_01AbC\n"],
  ])("rejects an invalid id (%s)", async (_name, previousMessageId) => {
    expect(await failureCode({ previousMessageId })).toBe("INVALID_INPUT");
  });

  it("rejects a non-string, non-null id", async () => {
    expect(
      await failureCode({
        previousMessageId: 7 as unknown as string,
      }),
    ).toBe("INVALID_INPUT");
  });

  it("is composed even when the beta header is suppressed", async () => {
    const body = await bodyOf({ suppressBetas: [CACHE_DIAGNOSIS_BETA] });

    expect(body["diagnostics"]).toStrictEqual({ previous_message_id: null });
  });

  it("collides with experimentalBodyFields.diagnostics", async () => {
    expect(
      await failureCode({ experimentalBodyFields: { diagnostics: {} } }),
    ).toBe("INVALID_INPUT");
  });

  it.each([
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
    ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ])("is inert on %s", async (_name, profile) => {
    const plain = await buildClaudeCodeRequest(BASE, profile);
    const withId = await buildClaudeCodeRequest(
      { ...BASE, previousMessageId: "msg_01AbC" },
      profile,
    );

    expect(JSON.parse(plain.body)).not.toHaveProperty("diagnostics");
    expect(withId).toStrictEqual(plain);
  });

  it("is validated on older profiles too", async () => {
    await expect(
      buildClaudeCodeRequest(
        { ...BASE, previousMessageId: "not-an-id" },
        CLAUDE_CODE_2_1_280_PROFILE,
      ),
    ).rejects.toThrow(ClaudeCodeWireError);
  });
});
