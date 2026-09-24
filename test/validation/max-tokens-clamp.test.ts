// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeProtocolProfile } from "../../src/index.js";
import {
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  buildClaudeCodeRequest,
} from "../../src/index.js";

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

/**
 * The profile is a required argument so no future test in this file can
 * inherit whatever `DEFAULT_PROFILE` happens to be by omission.
 */
async function body(
  profile: ClaudeCodeProtocolProfile,
  overrides: object = {},
): Promise<Record<string, unknown>> {
  const built = await buildClaudeCodeRequest(
    { ...base, ...overrides },
    profile,
  );
  return JSON.parse(built.body) as Record<string, unknown>;
}

/**
 * These assertions are 2.1.233 catalogue limits and 2.1.233 thinking bytes, and
 * the group is pinned to that profile. Several of them are partial matches
 * (`toMatchObject`), so they would not have noticed 2.1.280 injecting
 * `display: "updates"` into the thinking object. The 2.1.280 counterparts,
 * asserted with whole-object equality, live in the `(2.1.280)` group below.
 */
describe("max_tokens clamp (D16) (2.1.233)", () => {
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
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, { model, maxTokens: cap + 1 }),
    ).resolves.toMatchObject({
      max_tokens: cap,
    });
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, { model, maxTokens: 999999 }),
    ).resolves.toMatchObject({
      max_tokens: cap,
    });
  });

  it("passes a request at or below the model default through untouched", async () => {
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-opus-4-8",
        maxTokens: 64000,
      }),
    ).resolves.toMatchObject({ max_tokens: 64000 });
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-opus-4-8",
        maxTokens: 8000,
      }),
    ).resolves.toMatchObject({ max_tokens: 8000 });
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-opus-4-8",
        maxTokens: 1,
      }),
    ).resolves.toMatchObject({ max_tokens: 1 });
  });

  it("caps silently rather than rejecting", async () => {
    // The genuine client logs and continues; it never fails the request. An
    // oversized max_tokens must therefore resolve, not throw.
    await expect(
      buildClaudeCodeRequest(
        { ...base, maxTokens: Number.MAX_SAFE_INTEGER },
        CLAUDE_CODE_2_1_233_PROFILE,
      ),
    ).resolves.toBeDefined();
  });

  it("bounds by the model default, not its upper limit", async () => {
    // claude-opus-4-8 is default 64000 / upperLimit 128000. Upstream `qct`
    // only ever compares the CLAUDE_CODE_MAX_OUTPUT_TOKENS environment value
    // against upperLimit; this package reads no environment, so upperLimit
    // plays no part in this bound. Clamping at 128000 would let 100000 pass.
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-opus-4-8",
        maxTokens: 100000,
      }),
    ).resolves.toMatchObject({ max_tokens: 64000 });
  });

  it("feeds the clamped value into the thinking budget", async () => {
    // claude-opus-4-5 is non-adaptive (so thinking resolves to `enabled`),
    // default 32000, upperLimit 64000. Upstream computes the budget as
    // `Math.min(Fi - 1, wvi)` where `Fi` is the CLAMPED max_tokens and `wvi`
    // is upperLimit - 1. Passing the unclamped 60000 would yield 59999.
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
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
      body(CLAUDE_CODE_2_1_233_PROFILE, {
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
      body(CLAUDE_CODE_2_1_233_PROFILE, {
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
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "some-unreleased-model",
        maxTokens: 999999,
      }),
    ).resolves.toMatchObject({ max_tokens: 32000 });
  });

  it("applies the clamp to the model's normalised id, not the wire string", async () => {
    // The wire carries the caller's string verbatim (WP-1), but the limit
    // table is keyed on the normalised id.
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-opus-4-8-20260101",
        maxTokens: 999999,
      }),
    ).resolves.toMatchObject({
      model: "claude-opus-4-8-20260101",
      max_tokens: 64000,
    });
  });
});

/**
 * 2.1.280 injects `display: "updates"` into the thinking object when thinking
 * is active and the caller supplies no `display`. Every thinking assertion here
 * is whole-object equality so that injected key is visible, and each test pins
 * the load-bearing key order on the wire.
 */
describe("max_tokens clamp (D16) (2.1.280)", () => {
  async function build280(
    overrides: object,
  ): Promise<{ raw: string; result: Record<string, unknown> }> {
    const built = await buildClaudeCodeRequest(
      { ...base, ...overrides },
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    return {
      raw: built.body,
      result: JSON.parse(built.body) as Record<string, unknown>,
    };
  }

  it("still clamps an explicit budget against the clamped max_tokens", async () => {
    const { raw, result } = await build280({
      model: "claude-opus-4-5",
      maxTokens: 50000,
      thinking: { type: "enabled", budgetTokens: 45000 },
    });
    expect(result["max_tokens"]).toBe(32000);
    expect(result["thinking"]).toEqual({
      budget_tokens: 31999,
      type: "enabled",
      display: "updates",
    });
    expect(raw.indexOf('"budget_tokens"')).toBeLessThan(
      raw.indexOf('"type":"enabled"'),
    );
    expect(raw.indexOf('"type":"enabled"')).toBeLessThan(
      raw.indexOf('"display":"updates"'),
    );
  });

  it("feeds the clamped value into the default thinking budget", async () => {
    const { raw, result } = await build280({
      model: "claude-opus-4-5",
      maxTokens: 60000,
      thinking: { type: "enabled" },
    });
    expect(result["max_tokens"]).toBe(32000);
    expect(result["thinking"]).toEqual({
      budget_tokens: 31999,
      type: "enabled",
      display: "updates",
    });
    expect(raw.indexOf('"budget_tokens"')).toBeLessThan(
      raw.indexOf('"type":"enabled"'),
    );
    expect(raw.indexOf('"type":"enabled"')).toBeLessThan(
      raw.indexOf('"display":"updates"'),
    );
  });

  it("coerces an adaptive request to enabled on a non-adaptive model", async () => {
    // claude-opus-4-5's 2.1.280 capability list is ["context_management"]
    // only: no adaptive_thinking, so thinking resolves to `enabled`.
    const { raw, result } = await build280({
      model: "claude-opus-4-5",
      thinking: { type: "adaptive" },
    });
    expect(result["thinking"]).toEqual({
      budget_tokens: 1023,
      type: "enabled",
      display: "updates",
    });
    expect(result["thinking"]).not.toMatchObject({ type: "adaptive" });
    expect(raw.indexOf('"budget_tokens"')).toBeLessThan(
      raw.indexOf('"type":"enabled"'),
    );
    expect(raw.indexOf('"type":"enabled"')).toBeLessThan(
      raw.indexOf('"display":"updates"'),
    );
  });

  it("demotes forced tool choice during extended thinking", async () => {
    const { raw, result } = await build280({
      thinking: { type: "adaptive" },
      toolChoice: { type: "tool", name: "X" },
    });
    expect(result["tool_choice"]).toEqual({ type: "auto" });
    expect(result["thinking"]).toEqual({
      type: "adaptive",
      display: "updates",
    });
    expect(raw.indexOf('"type":"adaptive"')).toBeLessThan(
      raw.indexOf('"display":"updates"'),
    );
  });
});
