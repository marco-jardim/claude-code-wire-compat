// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * `suppressBillingBlock` is the S7 consumer seam. A plugin that exposes a user
 * switch such as `CLAUDE_CODE_ATTRIBUTION_HEADER=0` had no way to honour it,
 * because this package composed the billing block at system index 0
 * unconditionally, turning that switch into a silent no-op.
 *
 * The parser never sees the input flag — it receives only `{url, method,
 * headers, body, evidence}` — so it reads `evidence.billingBlockSuppressed` for
 * the canonical prefix length and then VERIFIES the blocks that flag says are
 * present: the billing head at index 0, the byte-exact identity text after it.
 * See `suppress-identity-block.test.ts` for the four-state matrix the root
 * `suppressIdentityBlock` seam adds.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const IDENTITY_TEXT =
  "You are Claude Code, Anthropic's official CLI for Claude.";

const BASE: ClaudeCodeRequestInput = {
  accessToken: "suppress-billing-token",
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
  clientRequestId: "suppress-billing-request-1",
};

interface ParsedBlock {
  readonly type: string;
  readonly text: string;
  readonly cache_control?: { readonly type: string; readonly ttl?: string };
}

function systemBlocks(body: string): readonly ParsedBlock[] {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("body is not an object");
  }
  const system: unknown = (parsed as Record<string, unknown>)["system"];
  if (!Array.isArray(system)) throw new Error("body carries no system array");
  return system as readonly ParsedBlock[];
}

function blockAt(body: string, index: number): ParsedBlock {
  const block = systemBlocks(body)[index];
  if (block === undefined)
    throw new Error(`no system block at ${String(index)}`);
  return block;
}

describe("suppressBillingBlock seam", () => {
  it("produces byte-identical output when the field is omitted", async () => {
    const withoutField = await buildClaudeCodeRequest(BASE);
    const withFalse = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: false,
    });

    expect(withFalse.body).toBe(withoutField.body);
    expect(withFalse.headers).toEqual(withoutField.headers);
    expect(withFalse.evidence).toEqual(withoutField.evidence);
    expect(Object.hasOwn(withFalse.evidence, "billingBlockSuppressed")).toBe(
      false,
    );
  });

  it("keeps the billing block at index 0 by default", async () => {
    const built = await buildClaudeCodeRequest(BASE);

    expect(blockAt(built.body, 0).text).not.toBe(IDENTITY_TEXT);
    expect(blockAt(built.body, 1).text).toBe(IDENTITY_TEXT);
    expect(systemBlocks(built.body)).toHaveLength(2);
  });

  it("drops the billing block and promotes identity to index 0", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
    });

    expect(systemBlocks(built.body)).toHaveLength(1);
    expect(blockAt(built.body, 0).text).toBe(IDENTITY_TEXT);
    expect(built.evidence.billingBlockSuppressed).toBe(true);
  });

  it("keeps the identity cache marker on the promoted block", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
    });

    expect(blockAt(built.body, 0).cache_control).toEqual({
      type: "ephemeral",
      ttl: "1h",
    });
  });

  it("still honours suppressIdentityBlock on the promoted block", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      cacheControl: { suppressIdentityBlock: true },
    });

    expect(blockAt(built.body, 0).text).toBe(IDENTITY_TEXT);
    expect(Object.hasOwn(blockAt(built.body, 0), "cache_control")).toBe(false);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("preserves caller system blocks after the promoted identity", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      system: ["caller one"],
    });

    expect(systemBlocks(built.body)).toHaveLength(2);
    expect(blockAt(built.body, 0).text).toBe(IDENTITY_TEXT);
    expect(blockAt(built.body, 1).text).toBe("caller one");
    expect(built.evidence.systemBlockCount).toBe(1);
  });

  it("counts merged caller blocks against the shortened prefix", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      system: ["a", "b", "c"],
    });

    expect(systemBlocks(built.body)).toHaveLength(2);
    expect(blockAt(built.body, 1).text).toBe("a\nb\nc");
    expect(built.evidence.systemBlockCount).toBe(1);
  });

  it("round-trips through the parser with the billing block suppressed", async () => {
    for (const system of [
      undefined,
      ["only"],
      ["a", "b"],
      ["a", "b", "c", "d"],
    ]) {
      const built = await buildClaudeCodeRequest({
        ...BASE,
        suppressBillingBlock: true,
        ...(system === undefined ? {} : { system }),
      });

      expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
      expect(built.evidence.billingBlockSuppressed).toBe(true);
    }
  });

  it("still places the trailing system breakpoint on the last caller block", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      cacheControl: { enabled: true, systemBreakpoint: true },
      system: ["caller one"],
    });

    expect(blockAt(built.body, 1).cache_control).toEqual({ type: "ephemeral" });
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("rejects an envelope whose system carries no identity block", async () => {
    // The mutation must be BYTE-LENGTH PRESERVING. `bodyByteLength` is checked
    // before the system-prefix discriminator, so a shorter or longer forgery
    // would be rejected earlier and would never prove that the discriminator
    // itself refuses an envelope this package did not emit.
    const built = await buildClaudeCodeRequest(BASE);
    const forged = built.body.replace(
      IDENTITY_TEXT,
      "X".repeat(IDENTITY_TEXT.length),
    );

    expect(forged).not.toBe(built.body);
    expect(new TextEncoder().encode(forged).byteLength).toBe(
      built.evidence.bodyByteLength,
    );
    expect(() =>
      parseBuiltClaudeCodeRequest({ ...built, body: forged }),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("rejects an envelope whose identity block sits below index 1", async () => {
    // Same byte length, identity pushed to index 2: neither probed position
    // matches, so the discriminator refuses instead of guessing a prefix.
    const built = await buildClaudeCodeRequest({
      ...BASE,
      system: ["caller one"],
    });
    const parsed: Record<string, unknown> = JSON.parse(built.body) as Record<
      string,
      unknown
    >;
    const blocks = parsed["system"] as readonly unknown[];
    parsed["system"] = [blocks[0], blocks[2], blocks[1]];

    expect(() =>
      parseBuiltClaudeCodeRequest({ ...built, body: JSON.stringify(parsed) }),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("rejects a non-boolean value", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        suppressBillingBlock: "true",
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("leaves every other seam composable with it", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      additionalBetas: ["extra-2026-01-01"],
      suppressBetas: ["effort-2025-11-24"],
    });

    expect(built.evidence.betaFeatures).toContain("extra-2026-01-01");
    expect(built.evidence.betaFeatures).not.toContain("effort-2025-11-24");
    expect(built.evidence.suppressedBetaNames).toEqual(["effort-2025-11-24"]);
    expect(built.evidence.billingBlockSuppressed).toBe(true);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("composes with metadataOverrides on the emitted body", async () => {
    // `metadataOverrides` with an opaque `userId` makes the envelope
    // unparseable BY DESIGN — see `metadata-overrides.test.ts`, "keeps
    // parseBuiltClaudeCodeRequest strict about an opaque user_id". That is an
    // S4 consequence, not an S7 one, so composition is proved on the emitted
    // body instead of through a round trip.
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      metadataOverrides: { userId: "host-supplied-opaque-user-id" },
    });
    const parsed: Record<string, unknown> = JSON.parse(built.body) as Record<
      string,
      unknown
    >;

    expect(parsed["metadata"]).toEqual({
      user_id: "host-supplied-opaque-user-id",
    });
    expect(systemBlocks(built.body)).toHaveLength(1);
    expect(blockAt(built.body, 0).text).toBe(IDENTITY_TEXT);
    expect(built.evidence.billingBlockSuppressed).toBe(true);
  });
});
