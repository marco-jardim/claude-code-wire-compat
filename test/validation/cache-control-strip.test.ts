// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Regression: the cache_control STRIP was unconditional while the RE-ADD was
 * gated.
 *
 * `applyToolCacheControl` and `applyMessageCacheControl` in
 * `src/request-body.ts` stripped every caller-supplied `cache_control` as their
 * first act, and only then consulted `enabled` / `toolBreakpoint` /
 * `messageBreakpoint` to decide whether to put a breakpoint back.
 *
 * Consequence: `cacheControl: { suppressIdentityBlock: true }` — the S3 seam,
 * on its own — deleted every `cache_control` the caller had placed on tools and
 * messages and restored nothing. The seam could not serve the use case it was
 * created for.
 *
 * The strip is now gated exactly like the re-add: it happens only when
 * `enabled === true`.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import { buildClaudeCodeRequest } from "../../src/index.js";

const RUNTIME = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  deviceId: "22222222-2222-4222-8222-222222222222",
  accountUuid: "33333333-3333-4333-8333-333333333333",
  runtime: "node",
  runtimeVersion: "22.0.0",
  os: "Linux",
  arch: "x64",
} as const;

const CALLER_TOOLS = [
  {
    name: "read_file",
    description: "reads a file",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "write_file",
    description: "writes a file",
    input_schema: { type: "object", properties: {} },
    cache_control: { type: "ephemeral" },
  },
] as const;

const CALLER_MESSAGES = [
  {
    role: "user",
    content: [
      { type: "text", text: "first block" },
      {
        type: "text",
        text: "cached block",
        cache_control: { type: "ephemeral" },
      },
    ],
  },
] as const;

const BASE: ClaudeCodeRequestInput = {
  accessToken: "cache-strip-token",
  model: "claude-sonnet-4-6",
  maxTokens: 2048,
  messages: CALLER_MESSAGES,
  tools: CALLER_TOOLS,
  runtime: RUNTIME,
  clientRequestId: "cache-strip-request-1",
};

function bodyOf(body: string): Record<string, unknown> {
  return JSON.parse(body) as Record<string, unknown>;
}

function toolCacheControls(body: string): readonly unknown[] {
  const tools = bodyOf(body)["tools"];
  if (!Array.isArray(tools)) throw new Error("tools missing");
  return tools.map((tool: unknown) =>
    tool !== null && typeof tool === "object"
      ? (tool as Record<string, unknown>)["cache_control"]
      : undefined,
  );
}

function messageBlockCacheControls(body: string): readonly unknown[] {
  const messages = bodyOf(body)["messages"];
  if (!Array.isArray(messages)) throw new Error("messages missing");
  const first: unknown = messages[0];
  if (first === null || typeof first !== "object") {
    throw new Error("message missing");
  }
  const content = (first as Record<string, unknown>)["content"];
  if (!Array.isArray(content)) throw new Error("content missing");
  return content.map((block: unknown) =>
    block !== null && typeof block === "object"
      ? (block as Record<string, unknown>)["cache_control"]
      : undefined,
  );
}

describe("suppressIdentityBlock alone preserves caller cache_control", () => {
  it("keeps the caller's tool cache_control", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: { suppressIdentityBlock: true },
    });

    expect(toolCacheControls(built.body)).toEqual([
      undefined,
      { type: "ephemeral" },
    ]);
  });

  it("keeps the caller's message block cache_control", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: { suppressIdentityBlock: true },
    });

    expect(messageBlockCacheControls(built.body)).toEqual([
      undefined,
      { type: "ephemeral" },
    ]);
  });

  it("matches the no-cacheControl baseline for tools and messages", async () => {
    const withSeam = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: { suppressIdentityBlock: true },
    });
    const withoutCacheControl = await buildClaudeCodeRequest(BASE);

    expect(toolCacheControls(withSeam.body)).toEqual(
      toolCacheControls(withoutCacheControl.body),
    );
    expect(messageBlockCacheControls(withSeam.body)).toEqual(
      messageBlockCacheControls(withoutCacheControl.body),
    );
  });
});

describe("the strip is gated exactly like the re-add", () => {
  it("does not strip when enabled is absent", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: { ttl: "5m" },
    });

    expect(toolCacheControls(built.body)).toEqual([
      undefined,
      { type: "ephemeral" },
    ]);
  });

  it("does not strip when enabled is explicitly false", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: {
        enabled: false,
        toolBreakpoint: true,
        messageBreakpoint: true,
      },
    });

    expect(toolCacheControls(built.body)).toEqual([
      undefined,
      { type: "ephemeral" },
    ]);
    expect(messageBlockCacheControls(built.body)).toEqual([
      undefined,
      { type: "ephemeral" },
    ]);
  });

  it("still strips and does not re-add when enabled is true but the breakpoint is off", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: {
        enabled: true,
        toolBreakpoint: false,
        messageBreakpoint: false,
      },
    });

    expect(toolCacheControls(built.body)).toEqual([undefined, undefined]);
    expect(messageBlockCacheControls(built.body)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("still strips and re-adds a single breakpoint when fully enabled", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: {
        enabled: true,
        toolBreakpoint: true,
        messageBreakpoint: true,
      },
    });

    // The caller's own breakpoints are normalised away and exactly one is
    // placed on the last tool and the last user block, as before.
    expect(toolCacheControls(built.body)).toEqual([
      undefined,
      { type: "ephemeral" },
    ]);
    expect(messageBlockCacheControls(built.body)).toEqual([
      undefined,
      { type: "ephemeral" },
    ]);
  });
});
