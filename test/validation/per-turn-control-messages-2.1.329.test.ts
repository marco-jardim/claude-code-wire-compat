// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import type {
  ClaudeCodeControlMessage,
  ClaudeCodeRequestInput,
} from "../../src/index.js";

/*
 * The genuine 2.1.329 client changes effort mid-conversation by inserting a
 * `role: "system"` entry into `messages`. Transcribed from the bundle (view
 * lines 157741-157742 `tRt`, 157747 `A5n`, 158726-158727 wire mapping): the
 * entry is an `api_system` message with EMPTY content and an `outputConfig`
 * of `{ effort?, timing?: { type: "now", now } }`, and it reaches the wire as
 * `{ role: "system", content: [], output_config: { ... } }`, in that key order.
 *
 * Only the 2.1.329 behaviour set accepts the shape. Every other profile keeps
 * refusing it, exactly as before.
 */

const REJECTION = { name: "ClaudeCodeWireError", code: "INVALID_INPUT" };

const CONTROL: ClaudeCodeControlMessage = {
  role: "system",
  content: [],
  output_config: { effort: "medium" },
};

function input(
  messages: readonly unknown[],
  extra: Partial<ClaudeCodeRequestInput> = {},
): ClaudeCodeRequestInput {
  return {
    accessToken: "test-token-not-a-secret",
    model: "claude-opus-5-5",
    maxTokens: 4096,
    messages: messages as ClaudeCodeRequestInput["messages"],
    runtime: {
      sessionId: "00000000-0000-4000-8000-000000000001",
      deviceId:
        "0000000000000000000000000000000000000000000000000000000000000002",
      accountUuid: "00000000-0000-4000-8000-000000000000",
      runtime: "node",
      runtimeVersion: "v24.15.0",
      os: "Linux",
      arch: "x64",
    },
    clientRequestId: "00000000-0000-4000-8000-000000000002",
    ...extra,
  };
}

const TURNS = [
  { role: "user", content: "hello wire compat" },
  { role: "assistant", content: "hi" },
  CONTROL,
  { role: "user", content: "next question" },
];

function bodyOf(body: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null) {
    throw new TypeError("body is not an object");
  }
  return Object.fromEntries(Object.entries(parsed));
}

describe("2.1.329 per-turn control messages", () => {
  it("passes the genuine effort statement through verbatim, in key order", async () => {
    const built = await buildClaudeCodeRequest(
      input(TURNS),
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    const messages = bodyOf(built.body)["messages"];

    expect(messages).toEqual(TURNS);
    expect(built.body).toContain(
      '{"role":"system","content":[],"output_config":{"effort":"medium"}}',
    );
    expect(built.evidence.messageCount).toBe(4);
  });

  it("passes a timing statement and a combined statement through", async () => {
    const statements: readonly ClaudeCodeControlMessage[] = [
      {
        role: "system",
        content: [],
        output_config: { timing: { type: "now", now: "12:00" } },
      },
      {
        role: "system",
        content: [],
        output_config: {
          effort: "xhigh",
          timing: { type: "now", now: "12:00" },
        },
      },
    ];

    for (const statement of statements) {
      const built = await buildClaudeCodeRequest(
        input([{ role: "user", content: "hi" }, statement]),
        CLAUDE_CODE_2_1_329_PROFILE,
      );

      expect(bodyOf(built.body)["messages"]).toEqual([
        { role: "user", content: "hi" },
        statement,
      ]);
    }
  });

  it("round-trips through the parser", async () => {
    const built = await buildClaudeCodeRequest(
      input(TURNS),
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    expect(
      parseBuiltClaudeCodeRequest(built, CLAUDE_CODE_2_1_329_PROFILE),
    ).toEqual(built);
  });

  it("keeps the statement intact when cache breakpoints are applied", async () => {
    const built = await buildClaudeCodeRequest(
      input(TURNS, {
        cacheControl: { enabled: true, messageBreakpoint: true },
      }),
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    const messages = bodyOf(built.body)["messages"];

    expect(Array.isArray(messages) ? messages[2] : undefined).toEqual(CONTROL);
  });

  it("composes per-turn-control when the model declares per_turn_effort", async () => {
    const withCapability = await buildClaudeCodeRequest(
      input(TURNS),
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    const without = await buildClaudeCodeRequest(
      input(TURNS, { model: "claude-opus-4-8" }),
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    expect(withCapability.evidence.betaFeatures).toContain(
      "per-turn-control-2026-07-01",
    );
    expect(without.evidence.betaFeatures).not.toContain(
      "per-turn-control-2026-07-01",
    );
  });

  it.each([
    ["an unknown output_config key", { effort: "medium", extra: true }],
    ["an invalid effort", { effort: "ludicrous" }],
    ["an empty output_config", {}],
    ["a malformed timing", { timing: { type: "later", now: "12:00" } }],
    ["an extra timing key", { timing: { type: "now", now: "1", more: 1 } }],
  ])("rejects %s", async (_label, outputConfig) => {
    await expect(
      buildClaudeCodeRequest(
        input([
          { role: "user", content: "hi" },
          { role: "system", content: [], output_config: outputConfig },
        ]),
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).rejects.toMatchObject(REJECTION);
  });

  it("rejects a system message without output_config and an output_config on a turn", async () => {
    await expect(
      buildClaudeCodeRequest(
        input([
          { role: "user", content: "hi" },
          { role: "system", content: [] },
        ]),
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).rejects.toMatchObject(REJECTION);
    await expect(
      buildClaudeCodeRequest(
        input([
          {
            role: "user",
            content: "hi",
            output_config: { effort: "high" },
          },
        ]),
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).rejects.toMatchObject(REJECTION);
  });

  it("is refused by count-tokens even on 2.1.329", async () => {
    await expect(
      buildClaudeCodeCountTokensRequest(
        {
          accessToken: "test-token-not-a-secret",
          model: "claude-opus-5-5",
          messages: [{ role: "user", content: "hi" }, CONTROL] as never,
          runtime: input([]).runtime,
          clientRequestId: "request",
        },
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).rejects.toMatchObject(REJECTION);
  });

  it.each([
    ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
    ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ])("stays refused on %s", async (_label, profile) => {
    await expect(
      buildClaudeCodeRequest(input(TURNS), profile),
    ).rejects.toMatchObject(REJECTION);
  });

  it("stays refused when the profile id is overridden", async () => {
    await expect(
      buildClaudeCodeRequest(
        input(TURNS, { profileOverride: { id: "claude-code-custom" } }),
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).rejects.toMatchObject(REJECTION);
  });
});
