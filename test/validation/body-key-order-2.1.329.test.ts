// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
} from "../../src/index.js";

/*
 * Body key order on 2.1.329. The genuine client builds its body from one
 * object literal; the slots below are that literal's order, with every key it
 * does not name (service_tier, output_format, top_p, top_k, stop_sequences and
 * unknown experimental fields) in one slot between `context_hint` and
 * `output_config`. The LIVE order below is the body-key order of the
 * interactive capture `inter329-205`, whose host-served `safeguards` key
 * (between `context_management` and `output_config`) is left out.
 */

const LIVE_ORDER = [
  "model",
  "messages",
  "system",
  "tools",
  "metadata",
  "max_tokens",
  "thinking",
  "context_management",
  "output_config",
  "thread",
  "diagnostics",
  "stream",
] as const;

const BASE = {
  accessToken: "body-order-token-not-a-secret",
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

const SLOT_ORDER = [
  "model",
  "messages",
  "system",
  "tools",
  "tool_choice",
  "metadata",
  "max_tokens",
  "thinking",
  "temperature",
  "context_management",
  "context_hint",
  "service_tier",
  "output_config",
  "speed",
  "thread",
  "diagnostics",
  "stream",
] as const;

async function keysOf(
  extra: Partial<ClaudeCodeRequestInput> = {},
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_329_PROFILE,
): Promise<readonly string[]> {
  const built = await buildClaudeCodeRequest({ ...BASE, ...extra }, profile);
  return Object.keys(JSON.parse(built.body) as object);
}

describe("body key order on 2.1.329", () => {
  it("matches the live capture order for the same fields", async () => {
    const keys = await keysOf({
      tools: [
        {
          name: "Read",
          description: "Reads a file",
          input_schema: { type: "object", properties: {} },
        },
      ],
      thinking: { type: "adaptive" },
      effort: "medium",
      stream: true,
    });

    // The live body also carries `thread`, which a later change adds; every
    // other live key is reproduced, in the live order.
    expect(keys).toStrictEqual(LIVE_ORDER.filter((key) => key !== "thread"));
  });

  it("is independent of the order the inputs are supplied in", async () => {
    const keys = await keysOf({
      stream: true,
      effort: "medium",
      thinking: { type: "adaptive" },
      toolChoice: { type: "auto" },
      temperature: 1,
      tools: [
        {
          name: "Read",
          input_schema: { type: "object", properties: {} },
        },
      ],
      speed: "standard",
    });

    expect(keys).toStrictEqual(
      SLOT_ORDER.filter((slot) => keys.includes(slot)),
    );
    expect(keys).toContain("tool_choice");
    expect(keys.indexOf("tool_choice")).toBe(keys.indexOf("tools") + 1);
    expect(keys.indexOf("speed")).toBeGreaterThan(
      keys.indexOf("output_config"),
    );
  });

  it("places the extra keys between context_hint and output_config in insertion order", async () => {
    const keys = await keysOf({
      thinking: { type: "adaptive" },
      effort: "medium",
      stopSequences: ["END"],
      topK: 5,
      outputFormat: {
        type: "json_schema",
        schema: { type: "object" },
      },
      serviceTier: "auto",
      experimentalBodyFields: { zeta: 1, alpha: 2 },
      stream: true,
    });
    // The input keys are visited in the assembly order of the body builder
    // (service tier, output format, top-k, stop sequences), then the
    // experimental fields in the caller's order.
    const extras = [
      "service_tier",
      "output_format",
      "top_k",
      "stop_sequences",
      "zeta",
      "alpha",
    ];
    const first = keys.indexOf(extras[0] ?? "");

    expect(keys.slice(first, first + extras.length)).toStrictEqual(extras);
    expect(keys.indexOf("context_management")).toBe(first - 1);
    expect(keys.indexOf("output_config")).toBe(first + extras.length);
  });

  it("keeps the 2.1.280 order unchanged", async () => {
    const keys = await keysOf(
      {
        thinking: { type: "adaptive" },
        effort: "medium",
        stream: true,
        topK: 5,
      },
      CLAUDE_CODE_2_1_280_PROFILE,
    );

    // Assembly order, not the genuine order: the key set differs too.
    expect(keys).toStrictEqual([
      "model",
      "max_tokens",
      "system",
      "messages",
      "thinking",
      "output_config",
      "top_k",
      "stream",
      "metadata",
    ]);
  });
});
