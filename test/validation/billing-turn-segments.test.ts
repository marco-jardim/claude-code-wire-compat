// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  ClaudeCodeWireError,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeRequestInput,
} from "../../src/index.js";

/*
 * The 2.1.329 billing block carries `cc_turn_origin`, then the prompt and turn
 * index pair, after `cc_prompt_id`. The known-answer below is the shape the
 * genuine interactive client sent in a live capture (first user text `hello`,
 * fingerprint `e8c`, `cch` `2eecf`); the prompt id is a synthetic stand-in
 * for the captured one, so the template is asserted with that UUID.
 */

const PROMPT_ID = "00000000-0000-4000-8000-000000000003";

const BASE = {
  accessToken: "turn-segments-token-not-a-secret",
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

function billingText(built: BuiltClaudeCodeRequest): string {
  const body = JSON.parse(built.body) as {
    system: readonly { readonly text: string }[];
  };
  const [first] = body.system;
  if (first === undefined) throw new Error("billing block missing");
  return first.text;
}

async function billingFor(
  extra: Readonly<Record<string, unknown>>,
  profile: Parameters<
    typeof buildClaudeCodeRequest
  >[1] = CLAUDE_CODE_2_1_329_PROFILE,
): Promise<string> {
  const built: BuiltClaudeCodeRequest = await Reflect.apply(
    buildClaudeCodeRequest,
    undefined,
    [{ ...BASE, ...extra }, profile],
  );
  return billingText(built);
}

describe("billing turn segments on 2.1.329", () => {
  it("reproduces the live interactive billing template byte for byte", async () => {
    const text = await billingFor({
      cch: "2eecf",
      promptId: PROMPT_ID,
      turnOrigin: "human",
      turnPosition: { promptIndex: 1, turnIndex: 1 },
    });

    expect(text).toBe(
      `x-anthropic-billing-header: cc_version=2.1.329.e8c; cc_entrypoint=cli; cch=2eecf; cc_prompt_id=${PROMPT_ID}; cc_turn_origin=human; cc_prompt_index=1; cc_turn_index=1;`,
    );
  });

  it("emits nothing extra when the inputs are absent", async () => {
    expect(await billingFor({})).toBe(
      "x-anthropic-billing-header: cc_version=2.1.329.e8c; cc_entrypoint=cli; cch=00000;",
    );
  });

  it("orders the segments after the chaining segments", async () => {
    const text = await billingFor({
      previousRequestId: "req_abc123",
      promptId: PROMPT_ID,
      turnOrigin: "human",
      turnPosition: { promptIndex: 0, turnIndex: 1 },
    });

    expect(text).toBe(
      `x-anthropic-billing-header: cc_version=2.1.329.e8c; cc_entrypoint=cli; cch=00000; cc_prev_req=req_abc123; cc_prompt_id=${PROMPT_ID}; cc_turn_origin=human; cc_prompt_index=0; cc_turn_index=1;`,
    );
  });

  it("emits the origin and the position independently", async () => {
    expect(await billingFor({ turnOrigin: "sdk_cli" })).toBe(
      "x-anthropic-billing-header: cc_version=2.1.329.e8c; cc_entrypoint=cli; cch=00000; cc_turn_origin=sdk_cli;",
    );
    expect(
      await billingFor({ turnPosition: { promptIndex: 3, turnIndex: 4 } }),
    ).toBe(
      "x-anthropic-billing-header: cc_version=2.1.329.e8c; cc_entrypoint=cli; cch=00000; cc_prompt_index=3; cc_turn_index=4;",
    );
  });

  it.each([
    ["an upper-case letter", "Human"],
    ["a leading underscore", "_human"],
    ["a digit", "human2"],
    ["a hyphen", "human-origin"],
    ["a space", "human origin"],
    ["more than 32 characters", "a".repeat(33)],
    ["an empty string", ""],
    ["an injected segment", "human; cch=ffffff"],
  ])("drops a turn origin with %s", async (_label, origin) => {
    expect(await billingFor({ turnOrigin: origin })).not.toContain(
      "cc_turn_origin",
    );
  });

  it("accepts the longest origin the guard allows", async () => {
    const origin = `a${"b".repeat(31)}`;

    expect(await billingFor({ turnOrigin: origin })).toContain(
      ` cc_turn_origin=${origin};`,
    );
  });

  it.each([
    ["a negative prompt index", { promptIndex: -1, turnIndex: 1 }],
    ["a zero turn index", { promptIndex: 1, turnIndex: 0 }],
    ["a fractional index", { promptIndex: 1.5, turnIndex: 1 }],
    [
      "a prompt index above ten million",
      { promptIndex: 1e7 + 1, turnIndex: 1 },
    ],
    ["a turn index above ten million", { promptIndex: 1, turnIndex: 1e7 + 1 }],
  ])("drops the position pair for %s", async (_label, position) => {
    const text = await billingFor({ turnPosition: position });

    expect(text).not.toContain("cc_prompt_index");
    expect(text).not.toContain("cc_turn_index");
  });

  it("accepts the bounds of the integer guard", async () => {
    expect(
      await billingFor({ turnPosition: { promptIndex: 0, turnIndex: 1 } }),
    ).toContain(" cc_prompt_index=0; cc_turn_index=1;");
    expect(
      await billingFor({ turnPosition: { promptIndex: 1e7, turnIndex: 1e7 } }),
    ).toContain(" cc_prompt_index=10000000; cc_turn_index=10000000;");
  });

  describe("type-level validation", () => {
    async function code(extra: Readonly<Record<string, unknown>>) {
      try {
        await billingFor(extra);
      } catch (error) {
        if (error instanceof ClaudeCodeWireError) return error.code;
        throw error;
      }
      return "no error";
    }

    it.each([
      ["a numeric turn origin", { turnOrigin: 1 }],
      ["a non-object turn position", { turnPosition: 1 }],
      ["a null turn position", { turnPosition: null }],
      ["an array turn position", { turnPosition: [1, 1] }],
      ["a turn position missing a key", { turnPosition: { promptIndex: 1 } }],
      [
        "a turn position with an extra key",
        { turnPosition: { promptIndex: 1, turnIndex: 1, extra: 1 } },
      ],
      // Non-finite numbers never reach the integer guard: the shared input
      // inspection refuses them like every other non-finite number.
      [
        "a non-finite index",
        { turnPosition: { promptIndex: Number.NaN, turnIndex: 1 } },
      ],
      [
        "an infinite index",
        { turnPosition: { promptIndex: 1, turnIndex: Infinity } },
      ],
      ["a string index", { turnPosition: { promptIndex: "1", turnIndex: 1 } }],
    ])("rejects %s", async (_label, extra) => {
      expect(await code(extra)).toBe("INVALID_INPUT");
    });
  });
});

describe("billing turn segments on earlier profiles", () => {
  it.each([
    ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
    ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ])("%s ignores both inputs", async (_name, profile) => {
    const without = await billingFor({ promptId: PROMPT_ID }, profile);
    const withTurn = await billingFor(
      {
        promptId: PROMPT_ID,
        turnOrigin: "human",
        turnPosition: { promptIndex: 1, turnIndex: 1 },
      },
      profile,
    );

    expect(withTurn).toBe(without);
    expect(withTurn).not.toContain("cc_turn_origin");
    expect(withTurn).not.toContain("cc_prompt_index");
  });
});
