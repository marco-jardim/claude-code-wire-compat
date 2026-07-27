// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the canonical system-prompt surface.
 * Wave 2 must export `buildCanonicalSystem(input: readonly SystemInput[] | undefined,
 * billingBlock: TextBlock, identity: ClaudeCodeRuntimeIdentity): readonly TextBlock[]`.
 */
import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeRuntimeIdentity,
  SystemInput,
  TextBlock,
} from "../src/contracts.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "./support/wave2-modules.js";

type BuildCanonicalSystem = (
  input: readonly SystemInput[] | undefined,
  billingBlock: TextBlock,
  identity: ClaudeCodeRuntimeIdentity,
) => readonly TextBlock[];
type AdversarialBuildCanonicalSystem = (
  input: unknown,
  billingBlock: TextBlock,
  identity: ClaudeCodeRuntimeIdentity,
) => readonly TextBlock[];

const BILLING: TextBlock = Object.freeze({
  type: "text",
  text: "x-anthropic-billing-header: synthetic",
});
const IDENTITY: ClaudeCodeRuntimeIdentity = Object.freeze({
  sessionId: "00000000-0000-4000-8000-000000000001",
  deviceId: "device-synthetic",
  accountUuid: "00000000-0000-4000-8000-000000000000",
  runtime: "node",
  runtimeVersion: "v24.15.0",
  os: "Windows",
  arch: "x64",
});

function nestedObject(depth: number): unknown {
  let value: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) value = { value };
  return value;
}

describe("system-prompt (Wave 1 RED specification)", () => {
  it("records that the Wave 2 module must be implemented", async () => {
    await expect(expectModuleUnimplemented("system-prompt")).resolves.toBe(
      false,
    );
  });

  it("places billing, identity, then normalized caller blocks", async () => {
    const build = await loadWave2Function<BuildCanonicalSystem>(
      "system-prompt",
      "buildCanonicalSystem",
    );
    const caller: readonly SystemInput[] = [
      "first",
      { type: "text", text: "second" },
      { type: "text", text: "third", cache_control: { type: "ephemeral" } },
    ];
    const before = structuredClone(caller);
    const result = build(caller, BILLING, IDENTITY);

    expect(result[0]).toBe(BILLING);
    expect(result[0]).not.toHaveProperty("cache_control");
    expect(result[1]).toEqual({
      type: "text",
      text: "You are Claude Code, Anthropic's official CLI for Claude.",
      cache_control: { type: "ephemeral", ttl: "1h" },
    });
    // Caller blocks with structurally equal cache_control (both absent here)
    // join with a newline like the genuine client; caller[2] stays separate.
    expect(result.slice(2)).toEqual([
      { type: "text", text: "first\nsecond" },
      caller[2],
    ]);
    expect(caller).toEqual(before);
  });

  it.each([
    { name: "absent", input: undefined },
    { name: "empty", input: [] },
  ] as const)(
    "emits exactly two canonical blocks for $name input",
    async ({ input }) => {
      const build = await loadWave2Function<BuildCanonicalSystem>(
        "system-prompt",
        "buildCanonicalSystem",
      );
      expect(build(input, BILLING, IDENTITY)).toHaveLength(2);
    },
  );

  it.each([
    "You are Claude Code, Anthropic's official CLI for Claude. ",
    "you are Claude Code, Anthropic's official CLI for Claude.",
  ])("does not rewrite identity-like caller text: %s", async (text) => {
    const build = await loadWave2Function<BuildCanonicalSystem>(
      "system-prompt",
      "buildCanonicalSystem",
    );
    expect(build([text], BILLING, IDENTITY)[2]).toEqual({
      type: "text",
      text,
    });
  });

  it("is deterministic and deeply frozen", async () => {
    const build = await loadWave2Function<BuildCanonicalSystem>(
      "system-prompt",
      "buildCanonicalSystem",
    );
    const first = build(["same"], BILLING, IDENTITY);
    const second = build(["same"], BILLING, IDENTITY);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    for (const block of first) expect(Object.isFrozen(block)).toBe(true);
  });

  it.each([
    ["control character", "bad\u0001text", "INVALID_UNICODE"],
    ["NUL", "bad\u0000text", "INVALID_UNICODE"],
    ["lone surrogate", "bad\ud800text", "INVALID_UNICODE"],
    ["excessive size", "x".repeat(2_000_000), "INPUT_TOO_LARGE"],
  ] as const)("rejects %s", async (_name, text, code) => {
    const build = await loadWave2Function<BuildCanonicalSystem>(
      "system-prompt",
      "buildCanonicalSystem",
    );
    expect(() => build([text], BILLING, IDENTITY)).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it("rejects excessive structural depth", async () => {
    const build = await loadWave2Function<AdversarialBuildCanonicalSystem>(
      "system-prompt",
      "buildCanonicalSystem",
    );
    expect(() => build([nestedObject(200)], BILLING, IDENTITY)).toThrow(
      expect.objectContaining({ code: "INPUT_TOO_DEEP" }),
    );
  });
});
