// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * `preserveThinkingBlockCacheControl` is the S9 consumer seam.
 *
 * The Anthropic API rejects a request whose latest assistant message carries a
 * MUTATED reasoning block:
 *
 *   400 ... thinking or redacted_thinking blocks in the latest assistant
 *   message cannot be modified. These blocks must remain as they were in the
 *   original response.
 *
 * So a consumer holding a thinking block that came back with `cache_control`
 * attached has no legal move: `delete block.cache_control` IS a modification
 * and triggers that 400, while handing the block to this package unmodified hit
 * the strict thinking-block allowlist and lost the whole request to
 * `INVALID_INPUT`. The seam accepts the key — and ONLY that key — and copies it
 * to the body verbatim.
 *
 * Evidence follows the `billingBlockSuppressed` discipline: the key appears
 * only when the seam was active AND a block actually carried a marker, and the
 * parser CONFIRMS that claim against the body instead of trusting it.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const EVIDENCE_KEY = "thinkingBlockCacheControlPreserved";

/*
 * Realistic multi-line reasoning text. Two defects survived fourteen release
 * candidates because the whole corpus was single-line, so every seam added
 * since exercises embedded newlines, tabs and CRLF on the wire.
 */
const MULTILINE_THINKING = [
  "Step 1: read the ledger.",
  "\tStep 2: do not fabricate wire bytes.",
  "\r\nStep 3: report what was verified.",
].join("\n");

const BASE: ClaudeCodeRequestInput = {
  accessToken: "preserve-thinking-token",
  model: "claude-sonnet-4-6",
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello wire compat" }],
  runtime: {
    sessionId: "77777777-7777-4777-8777-777777777777",
    deviceId: "88888888-8888-4888-8888-888888888888",
    accountUuid: "99999999-9999-4999-8999-999999999999",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "preserve-thinking-request-1",
};

function bodyRecord(body: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("body is not an object");
  }
  return parsed as Record<string, unknown>;
}

function bodyMessages(body: string): readonly Record<string, unknown>[] {
  const messages: unknown = bodyRecord(body)["messages"];
  if (!Array.isArray(messages)) throw new Error("body carries no messages");
  return messages as readonly Record<string, unknown>[];
}

function blockAt(
  body: string,
  message: number,
  block: number,
): Record<string, unknown> {
  const entry = bodyMessages(body)[message];
  if (entry === undefined) throw new Error(`no message at ${String(message)}`);
  const content = entry["content"];
  if (!Array.isArray(content)) throw new Error("message content is not a list");
  const found: unknown = content[block];
  if (typeof found !== "object" || found === null) {
    throw new Error(`no block at ${String(block)}`);
  }
  return found as Record<string, unknown>;
}

/** Replaces the body with an arbitrary structure, keeping evidence intact. */
function withBody(
  built: Awaited<ReturnType<typeof buildClaudeCodeRequest>>,
  messages: unknown,
): unknown {
  return {
    ...built,
    body: JSON.stringify({ ...bodyRecord(built.body), messages }),
  };
}

function thinkingMessage(
  block: Record<string, unknown>,
): ClaudeCodeRequestInput["messages"] {
  return [
    { role: "user", content: "please reason" },
    { role: "assistant", content: [block] },
  ] as unknown as ClaudeCodeRequestInput["messages"];
}

const PLAIN_THINKING = {
  type: "thinking",
  thinking: "counting the blocks",
  signature: "sig-plain",
};

describe("preserveThinkingBlockCacheControl seam", () => {
  it("produces byte-identical output when the field is omitted", async () => {
    const input = { ...BASE, messages: thinkingMessage(PLAIN_THINKING) };
    const withoutField = await buildClaudeCodeRequest(input);
    const withFalse = await buildClaudeCodeRequest({
      ...input,
      preserveThinkingBlockCacheControl: false,
    });

    expect(withFalse.body).toBe(withoutField.body);
    expect(withFalse.headers).toEqual(withoutField.headers);
    expect(withFalse.evidence).toEqual(withoutField.evidence);
    expect(Object.hasOwn(withFalse.evidence, EVIDENCE_KEY)).toBe(false);
    expect(Object.hasOwn(withoutField.evidence, EVIDENCE_KEY)).toBe(false);
  });

  it("still rejects cache_control on a thinking block with the seam off", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        messages: thinkingMessage({
          ...PLAIN_THINKING,
          cache_control: { type: "ephemeral" },
        }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("still rejects cache_control on a redacted_thinking block with the seam off", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        messages: thinkingMessage({
          type: "redacted_thinking",
          data: "redacted-payload",
          cache_control: { type: "ephemeral" },
        }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("copies cache_control on a thinking block verbatim", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      preserveThinkingBlockCacheControl: true,
      messages: thinkingMessage({
        ...PLAIN_THINKING,
        // Key order is deliberately NOT the canonical one: verbatim means the
        // caller's own bytes, so no normalisation may reorder this.
        cache_control: { ttl: "1h", type: "ephemeral" },
      }),
    });

    expect(built.body).toContain(
      '"cache_control":{"ttl":"1h","type":"ephemeral"}',
    );
    expect(blockAt(built.body, 1, 0)).toEqual({
      type: "thinking",
      thinking: "counting the blocks",
      signature: "sig-plain",
      cache_control: { ttl: "1h", type: "ephemeral" },
    });
    expect(built.evidence.thinkingBlockCacheControlPreserved).toBe(true);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("copies cache_control on a redacted_thinking block verbatim", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      preserveThinkingBlockCacheControl: true,
      messages: thinkingMessage({
        type: "redacted_thinking",
        data: "redacted-payload",
        cache_control: { type: "ephemeral", ttl: "5m" },
      }),
    });

    expect(built.body).toContain(
      '"cache_control":{"type":"ephemeral","ttl":"5m"}',
    );
    expect(blockAt(built.body, 1, 0)).toEqual({
      type: "redacted_thinking",
      data: "redacted-payload",
      cache_control: { type: "ephemeral", ttl: "5m" },
    });
    expect(built.evidence.thinkingBlockCacheControlPreserved).toBe(true);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("preserves an explicit null marker, as every other block type does", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      preserveThinkingBlockCacheControl: true,
      messages: thinkingMessage({ ...PLAIN_THINKING, cache_control: null }),
    });

    expect(built.body).toContain('"cache_control":null');
    expect(built.evidence.thinkingBlockCacheControlPreserved).toBe(true);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("records nothing in evidence when the seam is on but unused", async () => {
    const off = await buildClaudeCodeRequest({
      ...BASE,
      messages: thinkingMessage(PLAIN_THINKING),
    });
    const on = await buildClaudeCodeRequest({
      ...BASE,
      preserveThinkingBlockCacheControl: true,
      messages: thinkingMessage(PLAIN_THINKING),
    });

    expect(Object.hasOwn(on.evidence, EVIDENCE_KEY)).toBe(false);
    expect(on.body).toBe(off.body);
    expect(on.evidence).toEqual(off.evidence);
    expect(parseBuiltClaudeCodeRequest(on)).toEqual(on);
  });

  it("keeps the allowlist closed: an unknown key is still rejected", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        preserveThinkingBlockCacheControl: true,
        messages: thinkingMessage({ ...PLAIN_THINKING, foo: "bar" }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        preserveThinkingBlockCacheControl: true,
        messages: thinkingMessage({
          type: "redacted_thinking",
          data: "redacted-payload",
          foo: "bar",
        }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it.each([
    ["a non-ephemeral type", { type: "persistent" }],
    ["an unknown ttl", { type: "ephemeral", ttl: "7d" }],
    ["the text-block legacy scope key", { type: "ephemeral", scope: "global" }],
    ["a missing type", { ttl: "1h" }],
    ["a non-record marker", "ephemeral"],
  ])("rejects %s even with the seam on", async (_name, marker) => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        preserveThinkingBlockCacheControl: true,
        messages: thinkingMessage({
          ...PLAIN_THINKING,
          cache_control: marker,
        }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a non-boolean seam value", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        preserveThinkingBlockCacheControl: "true",
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("carries multi-line, tabbed and CRLF reasoning text byte-exact", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      preserveThinkingBlockCacheControl: true,
      messages: thinkingMessage({
        type: "thinking",
        thinking: MULTILINE_THINKING,
        signature: "sig-multiline",
        cache_control: { type: "ephemeral", ttl: "1h" },
      }),
    });

    expect(blockAt(built.body, 1, 0)["thinking"]).toBe(MULTILINE_THINKING);
    expect(built.body).toContain("\\r\\nStep 3");
    expect(built.body).toContain("\\tStep 2");
    expect(built.evidence.thinkingBlockCacheControlPreserved).toBe(true);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("scans past string content and past non-reasoning blocks", async () => {
    // Ordering is load-bearing for the scan: a string-content message and a
    // text block both precede the marked block, so neither may short-circuit
    // the search that decides whether evidence is emitted.
    const built = await buildClaudeCodeRequest({
      ...BASE,
      preserveThinkingBlockCacheControl: true,
      messages: [
        { role: "user", content: "plain string content" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "a text block first" },
            {
              type: "thinking",
              thinking: MULTILINE_THINKING,
              signature: "sig-late",
              cache_control: { type: "ephemeral" },
            },
          ],
        },
      ] as unknown as ClaudeCodeRequestInput["messages"],
    });

    expect(built.evidence.thinkingBlockCacheControlPreserved).toBe(true);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("leaves the marker out of this package's cache-control machinery", async () => {
    // `cacheControl.enabled` normalises markers the caller placed on its own
    // blocks and then re-places breakpoints. Reasoning blocks are exempt from
    // both halves, so the preserved marker must survive untouched and no
    // message breakpoint may land on it.
    const built = await buildClaudeCodeRequest({
      ...BASE,
      preserveThinkingBlockCacheControl: true,
      cacheControl: { enabled: true, messageBreakpoint: true, ttl: "1h" },
      messages: thinkingMessage({
        ...PLAIN_THINKING,
        cache_control: { type: "ephemeral" },
      }),
    });

    expect(blockAt(built.body, 1, 0)["cache_control"]).toEqual({
      type: "ephemeral",
    });
    expect(built.evidence.thinkingBlockCacheControlPreserved).toBe(true);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("rejects an envelope claiming the seam over a body with no marker", async () => {
    // The forgery is byte-length preserving and evidence-self-consistent: the
    // body is UNTOUCHED, so `bodyByteLength`, `bodySha256`, `messageCount` and
    // `systemBlockCount` all still agree. Only the structural confirmation of
    // the claim can reject it, which is what proves the parser does not trust
    // the flag blindly.
    const built = await buildClaudeCodeRequest({
      ...BASE,
      preserveThinkingBlockCacheControl: true,
      messages: thinkingMessage(PLAIN_THINKING),
    });
    const evidence = { ...built.evidence, [EVIDENCE_KEY]: true };

    // The canonical identity system block carries its own marker, so absence is
    // asserted on the reasoning block, which is what the claim is about.
    expect(Object.hasOwn(blockAt(built.body, 1, 0), "cache_control")).toBe(
      false,
    );
    expect(Object.hasOwn(built.evidence, EVIDENCE_KEY)).toBe(false);
    expect(new TextEncoder().encode(built.body).byteLength).toBe(
      built.evidence.bodyByteLength,
    );
    expect(() => parseBuiltClaudeCodeRequest({ ...built, evidence })).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it.each([
    ["messages that are not a list", "not-a-list"],
    ["a message that is not a record", ["not-a-record"]],
    [
      "a content block that is not a record",
      [{ role: "assistant", content: ["not-a-record"] }],
    ],
    [
      "a message whose content is absent",
      [{ role: "assistant", text: "no content key" }],
    ],
  ])(
    "rejects an envelope claiming the seam over %s",
    async (_name, messages) => {
      const built = await buildClaudeCodeRequest({
        ...BASE,
        preserveThinkingBlockCacheControl: true,
        messages: thinkingMessage({
          ...PLAIN_THINKING,
          cache_control: { type: "ephemeral" },
        }),
      });

      expect(built.evidence.thinkingBlockCacheControlPreserved).toBe(true);
      expect(() =>
        parseBuiltClaudeCodeRequest(withBody(built, messages)),
      ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
    },
  );

  it("composes with every other root seam", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      preserveThinkingBlockCacheControl: true,
      suppressBillingBlock: true,
      suppressIdentityBlock: true,
      additionalBetas: ["extra-2026-01-01"],
      messages: thinkingMessage({
        type: "thinking",
        thinking: MULTILINE_THINKING,
        signature: "sig-composed",
        cache_control: { type: "ephemeral", ttl: "1h" },
      }),
    });

    expect(built.evidence.billingBlockSuppressed).toBe(true);
    expect(built.evidence.identityBlockSuppressed).toBe(true);
    expect(built.evidence.thinkingBlockCacheControlPreserved).toBe(true);
    expect(built.evidence.betaFeatures).toContain("extra-2026-01-01");
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });
});
