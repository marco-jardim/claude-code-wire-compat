// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import { buildClaudeCodeRequest } from "../../src/index.js";

const BASE: ClaudeCodeRequestInput = {
  accessToken: "suppress-identity-token",
  model: "claude-sonnet-4-6",
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello wire compat" }],
  system: ["caller supplied guidance"],
  runtime: {
    sessionId: "11111111-1111-4111-8111-111111111111",
    deviceId: "22222222-2222-4222-8222-222222222222",
    accountUuid: "33333333-3333-4333-8333-333333333333",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "suppress-identity-request-1",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function systemBlocks(body: string): readonly Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed)) throw new Error("body is not an object");
  const system: unknown = parsed["system"];
  if (!Array.isArray(system)) throw new Error("body has no system array");
  return system.map((block: unknown): Record<string, unknown> => {
    if (!isRecord(block)) throw new Error("malformed system block");
    return block;
  });
}

function identityBlock(body: string): Record<string, unknown> {
  const block = systemBlocks(body)[1];
  if (block === undefined) throw new Error("body has no identity block");
  return block;
}

describe("cacheControl.suppressIdentityBlock seam", () => {
  it("keeps the hardcoded 1h marker when cacheControl is omitted entirely", async () => {
    const built = await buildClaudeCodeRequest(BASE);

    expect(identityBlock(built.body)["cache_control"]).toEqual({
      type: "ephemeral",
      ttl: "1h",
    });
  });

  it("keeps the unconditional overwrite when the flag is omitted", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: { enabled: false },
    });

    expect(identityBlock(built.body)["cache_control"]).toEqual({
      type: "ephemeral",
    });
  });

  it("keeps the unconditional overwrite when the flag is explicitly false", async () => {
    const withoutFlag = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: { enabled: false, ttl: "5m" },
    });
    const withFalseFlag = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: {
        enabled: false,
        ttl: "5m",
        suppressIdentityBlock: false,
      },
    });

    expect(withFalseFlag.body).toBe(withoutFlag.body);
    expect(identityBlock(withFalseFlag.body)["cache_control"]).toEqual({
      type: "ephemeral",
      ttl: "5m",
    });
  });

  it("emits the identity block without any marker when suppression is on", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: { suppressIdentityBlock: true },
    });
    const block = identityBlock(built.body);

    expect(Object.hasOwn(block, "cache_control")).toBe(false);
    expect(block["type"]).toBe("text");
    expect(block["text"]).toBe(
      "You are Claude Code, Anthropic's official CLI for Claude.",
    );
  });

  it("suppresses the identity marker without disturbing the billing block", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const suppressed = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: { suppressIdentityBlock: true },
    });

    expect(systemBlocks(suppressed.body)[0]).toEqual(
      systemBlocks(canonical.body)[0],
    );
    expect(suppressed.evidence.systemBlockCount).toBe(
      canonical.evidence.systemBlockCount,
    );
  });

  it("still honours the trailing system breakpoint while suppressing the identity marker", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      cacheControl: {
        enabled: true,
        systemBreakpoint: true,
        ttl: "5m",
        suppressIdentityBlock: true,
      },
    });
    const blocks = systemBlocks(built.body);
    const last = blocks[blocks.length - 1];
    if (last === undefined) throw new Error("no trailing system block");

    expect(Object.hasOwn(identityBlock(built.body), "cache_control")).toBe(
      false,
    );
    expect(last["cache_control"]).toEqual({ type: "ephemeral", ttl: "5m" });
  });

  it("rejects a non-boolean flag", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        cacheControl: { suppressIdentityBlock: "yes" },
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
