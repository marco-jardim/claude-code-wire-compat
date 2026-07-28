// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * `evidence.systemBlockCount` used to record the RAW length of the caller's
 * `system` array, but `buildCanonicalSystem` merges adjacent caller blocks that
 * share a `cache_control` and drops any block byte-identical to the pinned
 * identity text. The parser asserts
 * `systemBlockCount === body.system.length - <canonical prefix>`, so every
 * request whose caller blocks merged produced an envelope the package itself
 * refused to parse: two mergeable blocks recorded 2 against an emitted 1.
 *
 * The counted value is therefore the number of caller blocks actually EMITTED,
 * which restores the identity for every shape below.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput, SystemInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const IDENTITY_TEXT =
  "You are Claude Code, Anthropic's official CLI for Claude.";

const BASE: ClaudeCodeRequestInput = {
  accessToken: "system-block-count-token",
  model: "claude-sonnet-4-6",
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello wire compat" }],
  runtime: {
    sessionId: "11111111-1111-4111-8111-111111111111",
    deviceId: "22222222-2222-4222-8222-222222222222",
    accountUuid: "33333333-3333-4333-8333-333333333333",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "system-block-count-request-1",
};

function systemBlocks(body: string): readonly { readonly text: string }[] {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("body is not an object");
  }
  const system: unknown = (parsed as Record<string, unknown>)["system"];
  if (!Array.isArray(system)) throw new Error("body carries no system array");
  return system as readonly { readonly text: string }[];
}

describe("systemBlockCount counts emitted caller blocks", () => {
  it.each<readonly [string, readonly SystemInput[] | undefined, number]>([
    ["no system field", undefined, 0],
    ["an empty array", [], 0],
    ["one block", ["only"], 1],
    ["two mergeable blocks", ["a", "b"], 1],
    ["three mergeable blocks", ["a", "b", "c"], 1],
    [
      "two blocks with divergent cache_control",
      [
        { type: "text", text: "a", cache_control: { type: "ephemeral" } },
        { type: "text", text: "b" },
      ],
      2,
    ],
    [
      "three blocks collapsing into two runs",
      [
        { type: "text", text: "a", cache_control: { type: "ephemeral" } },
        { type: "text", text: "b" },
        { type: "text", text: "c" },
      ],
      2,
    ],
    ["a block equal to the identity text", [IDENTITY_TEXT], 0],
    [
      "the identity text between two mergeable blocks",
      ["a", IDENTITY_TEXT, "b"],
      1,
    ],
  ])("records %s as %i emitted block(s)", async (_label, system, expected) => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      ...(system === undefined ? {} : { system }),
    });

    expect(built.evidence.systemBlockCount).toBe(expected);
    expect(systemBlocks(built.body)).toHaveLength(expected + 2);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("merges two mergeable blocks into one joined block", async () => {
    const built = await buildClaudeCodeRequest({ ...BASE, system: ["a", "b"] });
    const blocks = systemBlocks(built.body);

    expect(blocks[2]?.text).toBe("a\nb");
    expect(built.evidence.systemBlockCount).toBe(1);
  });

  it("round-trips every caller block count from zero to four", async () => {
    for (let count = 0; count <= 4; count += 1) {
      const system = Array.from({ length: count }, (_, index) => ({
        type: "text" as const,
        text: `block-${String(index)}`,
        ...(index % 2 === 0
          ? { cache_control: { type: "ephemeral" as const } }
          : {}),
      }));
      const built = await buildClaudeCodeRequest({ ...BASE, system });

      expect(built.evidence.systemBlockCount).toBe(
        systemBlocks(built.body).length - 2,
      );
      expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
    }
  });
});
