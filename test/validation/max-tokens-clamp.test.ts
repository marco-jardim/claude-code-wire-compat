// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../../src/index.js";

const base = {
  accessToken: "sentinel-token-max-tokens-clamp-4c81",
  model: "claude-opus-4-6",
  maxTokens: 1024,
  messages: [{ role: "user", content: "hi" }],
  runtime: {
    sessionId: "00000000-0000-4000-8000-000000000001",
    deviceId:
      "0000000000000000000000000000000000000000000000000000000000000002",
    accountUuid: "00000000-0000-4000-8000-000000000000",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "request",
} as const;

async function body(overrides: object = {}): Promise<Record<string, unknown>> {
  const built = await buildClaudeCodeRequest({ ...base, ...overrides });
  return JSON.parse(built.body) as Record<string, unknown>;
}

describe("max_tokens clamp (D16)", () => {
  it.each([
    ["claude-opus-4-8", 64000],
    ["claude-opus-4-7", 64000],
    ["claude-opus-4-6", 64000],
    ["claude-sonnet-4-6", 32000],
    ["claude-opus-4-5", 32000],
    ["claude-haiku-4-5", 32000],
    ["claude-opus-4-0", 32000],
    ["claude-3-5-sonnet", 8192],
    ["claude-fable-5", 64000],
  ] as const)("caps %s at its default output limit", async (model, cap) => {
    await expect(body({ model, maxTokens: cap + 1 })).resolves.toMatchObject({
      max_tokens: cap,
    });
    await expect(body({ model, maxTokens: 999999 })).resolves.toMatchObject({
      max_tokens: cap,
    });
  });

  it("passes a request at or below the model default through untouched", async () => {
    await expect(
      body({ model: "claude-opus-4-8", maxTokens: 64000 }),
    ).resolves.toMatchObject({ max_tokens: 64000 });
    await expect(
      body({ model: "claude-opus-4-8", maxTokens: 8000 }),
    ).resolves.toMatchObject({ max_tokens: 8000 });
    await expect(
      body({ model: "claude-opus-4-8", maxTokens: 1 }),
    ).resolves.toMatchObject({ max_tokens: 1 });
  });

  it("caps silently rather than rejecting", async () => {
    // The genuine client logs and continues; it never fails the request. An
    // oversized max_tokens must therefore resolve, not throw.
    await expect(
      buildClaudeCodeRequest({ ...base, maxTokens: Number.MAX_SAFE_INTEGER }),
    ).resolves.toBeDefined();
  });

  it("bounds by the model default, not its upper limit", async () => {
    // claude-opus-4-8 is default 64000 / upperLimit 128000. Upstream `qct`
    // only ever compares the CLAUDE_CODE_MAX_OUTPUT_TOKENS environment value
    // against upperLimit; this package reads no environment, so upperLimit
    // plays no part in this bound. Clamping at 128000 would let 100000 pass.
    await expect(
      body({ model: "claude-opus-4-8", maxTokens: 100000 }),
    ).resolves.toMatchObject({ max_tokens: 64000 });
  });

  it("feeds the clamped value into the thinking budget", async () => {
    // claude-opus-4-5 is non-adaptive (so thinking resolves to `enabled`),
    // default 32000, upperLimit 64000. Upstream computes the budget as
    // `Math.min(Fi - 1, wvi)` where `Fi` is the CLAMPED max_tokens and `wvi`
    // is upperLimit - 1. Passing the unclamped 60000 would yield 59999.
    await expect(
      body({
        model: "claude-opus-4-5",
        maxTokens: 60000,
        thinking: { type: "enabled" },
      }),
    ).resolves.toMatchObject({
      max_tokens: 32000,
      thinking: { budget_tokens: 31999, type: "enabled" },
    });
  });

  it("still clamps an explicit budget against the clamped max_tokens", async () => {
    await expect(
      body({
        model: "claude-opus-4-5",
        maxTokens: 50000,
        thinking: { type: "enabled", budgetTokens: 45000 },
      }),
    ).resolves.toMatchObject({
      max_tokens: 32000,
      thinking: { budget_tokens: 31999, type: "enabled" },
    });
  });

  it("leaves an explicit budget below the clamped ceiling alone", async () => {
    await expect(
      body({
        model: "claude-opus-4-5",
        maxTokens: 50000,
        thinking: { type: "enabled", budgetTokens: 4096 },
      }),
    ).resolves.toMatchObject({
      max_tokens: 32000,
      thinking: { budget_tokens: 4096, type: "enabled" },
    });
  });

  it("clamps an unrecognised model at the fallback default", async () => {
    await expect(
      body({ model: "some-unreleased-model", maxTokens: 999999 }),
    ).resolves.toMatchObject({ max_tokens: 32000 });
  });

  it("applies the clamp to the model's normalised id, not the wire string", async () => {
    // The wire carries the caller's string verbatim (WP-1), but the limit
    // table is keyed on the normalised id.
    await expect(
      body({ model: "claude-opus-4-8-20260101", maxTokens: 999999 }),
    ).resolves.toMatchObject({
      model: "claude-opus-4-8-20260101",
      max_tokens: 64000,
    });
  });
});
