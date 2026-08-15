// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Behaviour of the two 2.1.233 chaining segments, at the module seam and
 * through the public builder.
 *
 * The segments carry the only caller-controlled bytes in the billing block, so
 * the malformed cases here are a security property, not a tidiness one: every
 * rejected value must be absent from the emitted line ENTIRELY, not merely
 * unrecognised. They assert on the whole line, byte for byte, and additionally
 * that the offending substring appears nowhere in it.
 */

import { describe, expect, it } from "vitest";

import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeRequestInput,
} from "../../src/contracts.js";
import { createBillingBlock } from "../../src/fingerprint.js";
import { buildClaudeCodeRequest } from "../../src/index.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
import { CLAUDE_CODE_2_1_233_PROFILE } from "../../src/profiles/claude-code-2.1.233.js";

const TOKEN = "sentinel-token-prevreq-4d17ba";
const SESSION_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_REQUEST_ID = "00000000-0000-4000-8000-000000000002";
const FIRST_USER_TEXT = "hello wire compat";

/** `hello wire compat` under each profile's CLI version. */
const BASE_233 =
  "x-anthropic-billing-header: cc_version=2.1.233.413; cc_entrypoint=cli; cch=00000;";
const BASE_195 =
  "x-anthropic-billing-header: cc_version=2.1.195.0f6; cc_entrypoint=cli; cch=00000;";

const VALID_PREVIOUS_REQUEST_ID = "req_abc123";
const VALID_PROMPT_ID = "0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6f";

function validInput(
  overrides: Partial<ClaudeCodeRequestInput> = {},
): ClaudeCodeRequestInput {
  return {
    accessToken: TOKEN,
    model: "claude-sonnet-4-5",
    maxTokens: 128,
    messages: [{ role: "user", content: FIRST_USER_TEXT }],
    system: ["synthetic system prompt"],
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
    ...overrides,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function systemTexts(built: BuiltClaudeCodeRequest): readonly string[] {
  const raw: unknown = built.body;
  const body: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!isRecord(body)) throw new Error("built request has no body object");
  const system: unknown = body["system"];
  if (!Array.isArray(system)) throw new Error("built request has no system");
  return system.map((block: unknown) => {
    if (!isRecord(block)) throw new Error("system block is not an object");
    const text: unknown = block["text"];
    return typeof text === "string" ? text : "";
  });
}

function billingLine(built: BuiltClaudeCodeRequest): string {
  return systemTexts(built)[0] ?? "";
}

async function buildLine(
  overrides: Partial<ClaudeCodeRequestInput>,
  profile = CLAUDE_CODE_2_1_233_PROFILE,
): Promise<string> {
  return billingLine(
    await buildClaudeCodeRequest(validInput(overrides), profile),
  );
}

describe("cc_prev_req and cc_prompt_id at the module seam", () => {
  it("omits both on a first turn", async () => {
    const block = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    expect(block.text).toBe(BASE_233);
  });

  it("treats an absent chain and an empty chain alike", async () => {
    const absent = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    const empty = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
      undefined,
      {},
    );
    const explicitlyUndefined = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
      undefined,
      { previousRequestId: undefined, promptId: undefined },
    );

    expect(empty.text).toBe(absent.text);
    expect(explicitlyUndefined.text).toBe(absent.text);
  });

  it("appends cc_prev_req immediately after cch", async () => {
    const block = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
      undefined,
      { previousRequestId: VALID_PREVIOUS_REQUEST_ID },
    );
    expect(block.text).toBe(`${BASE_233} cc_prev_req=req_abc123;`);
  });

  it("emits cc_prompt_id alone when only it is supplied", async () => {
    const block = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
      undefined,
      { promptId: VALID_PROMPT_ID },
    );
    expect(block.text).toBe(`${BASE_233} cc_prompt_id=${VALID_PROMPT_ID};`);
  });

  it("orders cc_prev_req before cc_prompt_id", async () => {
    const block = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
      undefined,
      {
        previousRequestId: VALID_PREVIOUS_REQUEST_ID,
        promptId: VALID_PROMPT_ID,
      },
    );
    expect(block.text).toBe(
      `${BASE_233} cc_prev_req=req_abc123; cc_prompt_id=${VALID_PROMPT_ID};`,
    );
  });

  it("accepts an upper-case prompt id, as the upstream pattern does", async () => {
    const promptId = VALID_PROMPT_ID.toUpperCase();
    const block = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
      undefined,
      { promptId },
    );
    expect(block.text).toBe(`${BASE_233} cc_prompt_id=${promptId};`);
  });

  it("accepts the full 36-character body of a request id", async () => {
    const previousRequestId = `req_${"a".repeat(36)}`;
    const block = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
      undefined,
      { previousRequestId },
    );
    expect(block.text).toBe(`${BASE_233} cc_prev_req=${previousRequestId};`);
  });

  it.each([
    ["empty", ""],
    ["prefix only", "req_"],
    ["thirty-seven characters after the prefix", `req_${"a".repeat(37)}`],
    ["an embedded space", "req_abc 123"],
    ["a semicolon", "req_abc;cc_is_subagent=true"],
    ["a control character", "req_abc\ncc_workload=x"],
    ["the wrong case in the prefix", "REQ_ABC"],
    ["no prefix", "abc123"],
    ["a leading space", " req_abc123"],
  ])(
    "drops a previous request id with %s",
    async (_label, previousRequestId) => {
      const block = await createBillingBlock(
        FIRST_USER_TEXT,
        CLAUDE_CODE_2_1_233_PROFILE,
        undefined,
        { previousRequestId },
      );

      expect(block.text).toBe(BASE_233);
      expect(block.text).not.toMatch(/cc_prev_req/u);
      if (previousRequestId.length > 0) {
        expect(block.text).not.toContain(previousRequestId);
      }
    },
  );

  it.each([
    ["empty", ""],
    ["no hyphens", "0f6e2a719d4c4b8a8f3d1c2b3a4d5e6f"],
    ["a non-hexadecimal digit", "0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6g"],
    ["one group too short", "0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6"],
    ["a semicolon", "0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6f;x=1"],
    ["a control character", "0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6f\n"],
  ])("drops a prompt id with %s", async (_label, promptId) => {
    const block = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_233_PROFILE,
      undefined,
      { promptId },
    );

    expect(block.text).toBe(BASE_233);
    expect(block.text).not.toMatch(/cc_prompt_id/u);
    if (promptId.length > 0) {
      expect(block.text).not.toContain(promptId);
    }
  });

  it("emits neither segment on the 2.1.195 profile", async () => {
    const block = await createBillingBlock(
      FIRST_USER_TEXT,
      CLAUDE_CODE_2_1_195_PROFILE,
      undefined,
      {
        previousRequestId: VALID_PREVIOUS_REQUEST_ID,
        promptId: VALID_PROMPT_ID,
      },
    );

    expect(block.text).toBe(BASE_195);
    expect(block.text).not.toMatch(/cc_prev_req|cc_prompt_id/u);
  });
});

describe("cc_prev_req and cc_prompt_id through the public builder", () => {
  it("leaves a first turn byte-identical", async () => {
    await expect(buildLine({})).resolves.toBe(BASE_233);
  });

  it("carries a valid previous request id onto the wire", async () => {
    await expect(
      buildLine({ previousRequestId: VALID_PREVIOUS_REQUEST_ID }),
    ).resolves.toBe(`${BASE_233} cc_prev_req=req_abc123;`);
  });

  it("carries both ids in upstream order", async () => {
    await expect(
      buildLine({
        previousRequestId: VALID_PREVIOUS_REQUEST_ID,
        promptId: VALID_PROMPT_ID,
      }),
    ).resolves.toBe(
      `${BASE_233} cc_prev_req=req_abc123; cc_prompt_id=${VALID_PROMPT_ID};`,
    );
  });

  it("emits a prompt id without a previous request id", async () => {
    await expect(buildLine({ promptId: VALID_PROMPT_ID })).resolves.toBe(
      `${BASE_233} cc_prompt_id=${VALID_PROMPT_ID};`,
    );
  });

  it("rejects an explicitly undefined id, as it does every other field", async () => {
    // Not a property of these two fields: the input graph inspector rejects an
    // explicit `undefined` for every key except `crypto`, which it skips. The
    // module seam below the builder does treat absent and undefined alike.
    await expect(
      buildLine({ previousRequestId: undefined, promptId: undefined }),
    ).rejects.toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it.each([
    ["req_abc;cc_is_subagent=true"],
    ["req_abc\ncc_workload=x"],
    ["req_"],
    [""],
    ["abc123"],
  ])("never interpolates the malformed id %j", async (previousRequestId) => {
    const line = await buildLine({ previousRequestId });

    expect(line).toBe(BASE_233);
    if (previousRequestId.length > 0) {
      expect(line).not.toContain(previousRequestId);
    }
  });

  it("keeps the 2.1.195 request byte-identical with both ids supplied", async () => {
    await expect(
      buildLine(
        {
          previousRequestId: VALID_PREVIOUS_REQUEST_ID,
          promptId: VALID_PROMPT_ID,
        },
        CLAUDE_CODE_2_1_195_PROFILE,
      ),
    ).resolves.toBe(BASE_195);
  });

  it("rejects a non-string id with INVALID_INPUT", async () => {
    const withPrevious = {
      ...validInput(),
      previousRequestId: 7,
    } as unknown as ClaudeCodeRequestInput;
    const withPrompt = {
      ...validInput(),
      promptId: { toString: () => VALID_PROMPT_ID },
    } as unknown as ClaudeCodeRequestInput;

    await expect(buildClaudeCodeRequest(withPrevious)).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
    await expect(buildClaudeCodeRequest(withPrompt)).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("omits the whole block when billing is suppressed", async () => {
    const built = await buildClaudeCodeRequest(
      validInput({
        suppressBillingBlock: true,
        previousRequestId: VALID_PREVIOUS_REQUEST_ID,
        promptId: VALID_PROMPT_ID,
      }),
      CLAUDE_CODE_2_1_233_PROFILE,
    );

    for (const text of systemTexts(built)) {
      expect(text).not.toContain("x-anthropic-billing-header");
      expect(text).not.toContain("cc_prev_req");
      expect(text).not.toContain("cc_prompt_id");
    }
  });
});
