// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_329_PROFILE,
} from "../../src/index.js";

/*
 * Hand-check of the 2.1.329 packed-consumer scenario, recorded BEFORE its
 * cross-runtime digest was frozen in `scripts/verify-packed-consumers.mjs`.
 *
 * A digest only proves that three runtimes agree with each other; it says
 * nothing about whether the bytes they agree on are the right ones. This test
 * states, in readable form, what the frozen digest is a digest OF: the shared
 * frozen packed-consumer input (copied from that script — it must never
 * change, because every frozen digest is computed from it) built under the
 * pinned 2.1.329 profile.
 */
const INPUT: ClaudeCodeRequestInput = {
  accessToken: "test-token-not-a-secret",
  model: "claude-sonnet-4-5",
  maxTokens: 128,
  messages: [{ role: "user", content: "hello wire compat" }],
  system: ["synthetic system prompt"],
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
};

function header(
  headers: readonly (readonly [string, string])[],
  name: string,
): string | undefined {
  return headers.find(([key]) => key.toLowerCase() === name)?.[1];
}

describe("2.1.329 packed-consumer scenario", () => {
  it("composes the expected betas", async () => {
    const built = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    expect(header(built.headers, "anthropic-beta")).toBe(
      [
        "claude-code-20250219",
        "oauth-2025-04-20",
        "interleaved-thinking-2025-05-14",
        "redact-thinking-2026-02-12",
        "context-management-2025-06-27",
        "prompt-caching-scope-2026-01-05",
        "thinking-token-count-2026-05-13",
        "cache-diagnosis-2026-04-07",
      ].join(","),
    );
  });

  it("emits the wire-faithful body keys in genuine order", async () => {
    const built = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    const body = JSON.parse(built.body) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual([
      "model",
      "messages",
      "system",
      "metadata",
      "max_tokens",
      "temperature",
      "diagnostics",
    ]);
    expect(body["diagnostics"]).toEqual({ previous_message_id: null });
  });

  it("carries the new 2.1.329 headers and no prompt id", async () => {
    const built = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    expect(header(built.headers, "accept")).toBe("application/json");
    expect(header(built.headers, "x-claude-1p-request-class")).toBe("main");
    expect(header(built.headers, "x-claude-code-request-class")).toBe("main");
    expect(header(built.headers, "x-claude-code-sandy-plover")).toBe("[]");
    expect(header(built.headers, "x-claude-code-prompt-id")).toBeUndefined();
  });

  it("derives the billing fingerprint from the first user text", async () => {
    const built = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    const body = JSON.parse(built.body) as {
      system: readonly { text: string }[];
    };

    expect(body.system[0]?.text).toBe(
      "x-anthropic-billing-header: cc_version=2.1.329.dac; cc_entrypoint=cli; cch=00000;",
    );
  });
});
