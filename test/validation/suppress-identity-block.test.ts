// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The ROOT `suppressIdentityBlock` is the S8 consumer seam. A plugin that
 * exposes a lean-system switch to its users (opencode's
 * `token_economy.lean_system_non_main` removes BOTH canonical blocks) had no
 * way to honour it, because this package composed the identity block
 * unconditionally, turning that switch into a silent no-op.
 *
 * It is a DIFFERENT field from `cacheControl.suppressIdentityBlock`, which
 * keeps the block and drops only its `cache_control` marker.
 *
 * With two independent seams the canonical system prefix has four legitimate
 * lengths — `[billing, identity]`, `[identity]`, `[billing]`, `[]` — and an
 * empty prefix is indistinguishable from a caller-only array. The parser
 * therefore READS the length from `evidence.billingBlockSuppressed` /
 * `evidence.identityBlockSuppressed` and VERIFIES each canonical block it was
 * told to expect: billing by its `x-anthropic-billing-header: cc_version=`
 * head, identity by the byte-exact identity text.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const IDENTITY_TEXT =
  "You are Claude Code, Anthropic's official CLI for Claude.";
const BILLING_PREFIX = "x-anthropic-billing-header: cc_version=";

/*
 * Realistic multi-line caller content. Two defects survived fourteen release
 * candidates because the whole corpus was single-line, so every seam added
 * since exercises embedded newlines and tabs on the wire.
 */
const MULTILINE_SYSTEM = [
  "You are a build agent.",
  "\tRules:",
  "\t- never fabricate wire bytes",
  "\r\n- report what you verified",
].join("\n");

const BASE: ClaudeCodeRequestInput = {
  accessToken: "suppress-identity-token",
  model: "claude-sonnet-4-6",
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello wire compat" }],
  runtime: {
    sessionId: "44444444-4444-4444-8444-444444444444",
    deviceId: "55555555-5555-4555-8555-555555555555",
    accountUuid: "66666666-6666-4666-8666-666666666666",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "suppress-identity-request-1",
};

interface ParsedBlock {
  readonly type: string;
  readonly text: string;
  readonly cache_control?: { readonly type: string; readonly ttl?: string };
}

function bodyRecord(body: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("body is not an object");
  }
  return parsed as Record<string, unknown>;
}

function systemBlocks(body: string): readonly ParsedBlock[] {
  const system: unknown = bodyRecord(body)["system"];
  if (!Array.isArray(system)) throw new Error("body carries no system array");
  return system as readonly ParsedBlock[];
}

function blockAt(body: string, index: number): ParsedBlock {
  const block = systemBlocks(body)[index];
  if (block === undefined)
    throw new Error(`no system block at ${String(index)}`);
  return block;
}

function texts(body: string): readonly string[] {
  return systemBlocks(body).map((block) => block.text);
}

/** Rebuilds evidence without one suppression flag and with a chosen count. */
function forgedEvidence(
  evidence: Readonly<Record<string, unknown>>,
  omitted: string,
  systemBlockCount: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(evidence)) {
    if (key !== omitted) result[key] = value;
  }
  result["systemBlockCount"] = systemBlockCount;
  return result;
}

describe("root suppressIdentityBlock seam", () => {
  it("produces byte-identical output when the field is omitted", async () => {
    const withoutField = await buildClaudeCodeRequest(BASE);
    const withFalse = await buildClaudeCodeRequest({
      ...BASE,
      suppressIdentityBlock: false,
    });

    expect(withFalse.body).toBe(withoutField.body);
    expect(withFalse.headers).toEqual(withoutField.headers);
    expect(withFalse.evidence).toEqual(withoutField.evidence);
    expect(Object.hasOwn(withFalse.evidence, "identityBlockSuppressed")).toBe(
      false,
    );
  });

  it("emits the four canonical prefixes the two seams allow", async () => {
    const both = await buildClaudeCodeRequest({
      ...BASE,
      system: ["caller one"],
    });
    const identityOnly = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      system: ["caller one"],
    });
    const billingOnly = await buildClaudeCodeRequest({
      ...BASE,
      suppressIdentityBlock: true,
      system: ["caller one"],
    });
    const neither = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      suppressIdentityBlock: true,
      system: ["caller one"],
    });

    expect(blockAt(both.body, 0).text.startsWith(BILLING_PREFIX)).toBe(true);
    expect(texts(both.body).slice(1)).toEqual([IDENTITY_TEXT, "caller one"]);
    expect(texts(identityOnly.body)).toEqual([IDENTITY_TEXT, "caller one"]);
    expect(blockAt(billingOnly.body, 0).text.startsWith(BILLING_PREFIX)).toBe(
      true,
    );
    expect(texts(billingOnly.body).slice(1)).toEqual(["caller one"]);
    expect(texts(neither.body)).toEqual(["caller one"]);

    for (const built of [both, identityOnly, billingOnly, neither]) {
      expect(built.evidence.systemBlockCount).toBe(1);
    }
  });

  it("records the seam in evidence only when it removed the block", async () => {
    const suppressed = await buildClaudeCodeRequest({
      ...BASE,
      suppressIdentityBlock: true,
    });
    const kept = await buildClaudeCodeRequest(BASE);

    expect(suppressed.evidence.identityBlockSuppressed).toBe(true);
    expect(Object.hasOwn(suppressed.evidence, "billingBlockSuppressed")).toBe(
      false,
    );
    expect(Object.hasOwn(kept.evidence, "identityBlockSuppressed")).toBe(false);
  });

  it("round-trips every prefix state through the parser", async () => {
    for (const suppressBillingBlock of [false, true]) {
      for (const suppressIdentityBlock of [false, true]) {
        for (const system of [
          undefined,
          ["only"],
          [MULTILINE_SYSTEM],
          ["a", "b", "c", "d"],
        ]) {
          const built = await buildClaudeCodeRequest({
            ...BASE,
            suppressBillingBlock,
            suppressIdentityBlock,
            ...(system === undefined ? {} : { system }),
          });

          expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
        }
      }
    }
  });

  it("keeps multi-line caller text byte-exact with no canonical prefix", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      suppressIdentityBlock: true,
      system: [MULTILINE_SYSTEM],
    });

    expect(texts(built.body)).toEqual([MULTILINE_SYSTEM]);
    expect(built.evidence.systemBlockCount).toBe(1);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("emits an empty system array when both seams strip a caller-less request", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      suppressIdentityBlock: true,
    });

    expect(Object.hasOwn(bodyRecord(built.body), "system")).toBe(true);
    expect(systemBlocks(built.body)).toEqual([]);
    expect(built.evidence.systemBlockCount).toBe(0);
    expect(built.body).toContain('"system":[]');
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("still drops a caller block equal to the identity text", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressIdentityBlock: true,
      system: [IDENTITY_TEXT, "caller one"],
    });

    expect(texts(built.body).slice(1)).toEqual(["caller one"]);
    expect(built.body).not.toContain(IDENTITY_TEXT);
    expect(built.evidence.systemBlockCount).toBe(1);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("makes cacheControl.suppressIdentityBlock inert, there being no block", async () => {
    const withMarkerSeam = await buildClaudeCodeRequest({
      ...BASE,
      suppressIdentityBlock: true,
      cacheControl: { suppressIdentityBlock: true },
      system: ["caller one"],
    });
    const withoutMarkerSeam = await buildClaudeCodeRequest({
      ...BASE,
      suppressIdentityBlock: true,
      system: ["caller one"],
    });

    expect(withMarkerSeam.body).toBe(withoutMarkerSeam.body);
    expect(texts(withMarkerSeam.body).slice(1)).toEqual(["caller one"]);
  });

  it("places the trailing system breakpoint with no identity block present", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      suppressIdentityBlock: true,
      cacheControl: { enabled: true, systemBreakpoint: true },
      system: ["caller one"],
    });

    expect(blockAt(built.body, 0).text).toBe("caller one");
    expect(blockAt(built.body, 0).cache_control).toEqual({ type: "ephemeral" });
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("rejects an envelope that claims identity suppression while carrying it", async () => {
    // The evidence is made SELF-CONSISTENT: `systemBlockCount` is adjusted to
    // the length the forged prefix implies, so the arithmetic check cannot
    // catch it. Only the STRUCTURAL check of the identity slot can — which is
    // what proves the parser does not trust the flags blindly.
    const built = await buildClaudeCodeRequest({
      ...BASE,
      system: ["caller one"],
    });
    const evidence = {
      ...built.evidence,
      identityBlockSuppressed: true,
      systemBlockCount: 2,
    };

    expect(systemBlocks(built.body)).toHaveLength(3);
    expect(() => parseBuiltClaudeCodeRequest({ ...built, evidence })).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("rejects an envelope that claims both suppressions while carrying both", async () => {
    // Prefix zero performs no positional check at all, so only the absence
    // invariant on the identity text can refute this forgery.
    const built = await buildClaudeCodeRequest({
      ...BASE,
      system: ["caller one"],
    });
    const evidence = {
      ...built.evidence,
      billingBlockSuppressed: true,
      identityBlockSuppressed: true,
      systemBlockCount: 3,
    };

    expect(() => parseBuiltClaudeCodeRequest({ ...built, evidence })).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("rejects an envelope that hides identity suppression it performed", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressIdentityBlock: true,
      system: ["caller one"],
    });
    const evidence = forgedEvidence(
      built.evidence,
      "identityBlockSuppressed",
      0,
    );

    expect(systemBlocks(built.body)).toHaveLength(2);
    expect(() => parseBuiltClaudeCodeRequest({ ...built, evidence })).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("rejects an envelope that hides billing suppression it performed", async () => {
    // The mirror case. The replaced position probe never inspected the billing
    // slot at all, so it accepted this envelope: `[identity, caller]` read as a
    // one-block prefix regardless of what the flags said.
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      system: ["caller one"],
    });
    const evidence = forgedEvidence(
      built.evidence,
      "billingBlockSuppressed",
      0,
    );

    expect(blockAt(built.body, 0).text).toBe(IDENTITY_TEXT);
    expect(() => parseBuiltClaudeCodeRequest({ ...built, evidence })).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("rejects an envelope that claims billing suppression while carrying it", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      system: ["caller one"],
    });
    const evidence = {
      ...built.evidence,
      billingBlockSuppressed: true,
      systemBlockCount: 2,
    };

    expect(() => parseBuiltClaudeCodeRequest({ ...built, evidence })).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("rejects an envelope whose billing block was replaced in place", async () => {
    // Byte-length preserving: `bodyByteLength` is checked before the prefix
    // verification, so a shorter forgery would be rejected earlier and would
    // never exercise the billing probe.
    const built = await buildClaudeCodeRequest(BASE);
    const billingText = blockAt(built.body, 0).text;
    const forged = built.body.replace(
      billingText,
      `Y${"X".repeat(billingText.length - 1)}`,
    );

    expect(forged).not.toBe(built.body);
    expect(new TextEncoder().encode(forged).byteLength).toBe(
      built.evidence.bodyByteLength,
    );
    expect(() =>
      parseBuiltClaudeCodeRequest({ ...built, body: forged }),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("rejects an envelope whose billing slot carries no text at all", async () => {
    // Also byte-length preserving: renaming the `text` key of the first block
    // leaves the body the same size but makes the billing probe read a
    // non-string, which must be refused rather than coerced.
    const built = await buildClaudeCodeRequest(BASE);
    const forged = built.body.replace(
      '"type":"text","text":"x-a',
      '"type":"text","txet":"x-a',
    );

    expect(forged).not.toBe(built.body);
    expect(new TextEncoder().encode(forged).byteLength).toBe(
      built.evidence.bodyByteLength,
    );
    expect(() =>
      parseBuiltClaudeCodeRequest({ ...built, body: forged }),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("rejects a non-boolean value", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        suppressIdentityBlock: "true",
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("leaves every other seam composable with it", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBillingBlock: true,
      suppressIdentityBlock: true,
      additionalBetas: ["extra-2026-01-01"],
      suppressBetas: ["effort-2025-11-24"],
      system: [MULTILINE_SYSTEM],
    });

    expect(built.evidence.betaFeatures).toContain("extra-2026-01-01");
    expect(built.evidence.betaFeatures).not.toContain("effort-2025-11-24");
    expect(built.evidence.suppressedBetaNames).toEqual(["effort-2025-11-24"]);
    expect(built.evidence.billingBlockSuppressed).toBe(true);
    expect(built.evidence.identityBlockSuppressed).toBe(true);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });
});
