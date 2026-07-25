// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeRuntimeIdentity,
  SystemInput,
  TextBlock,
} from "../../src/contracts.js";
import { buildCanonicalSystem } from "../../src/system-prompt.js";

const IDENTITY_TEXT =
  "You are Claude Code, Anthropic's official CLI for Claude.";
const BILLING: TextBlock = Object.freeze({
  type: "text",
  text: "x-anthropic-billing-header: synthetic",
});
const IDENTITY: ClaudeCodeRuntimeIdentity = Object.freeze({
  sessionId: "00000000-0000-4000-8000-000000000001",
  deviceId: "device-synthetic",
  accountUuid: "00000000-0000-4000-8000-000000000000",
  runtime: "node",
  runtimeVersion: "v0.0.0-synthetic",
  os: "Windows",
  arch: "x64",
});

function invalidInput(value: unknown): readonly SystemInput[] {
  // Intentional invalid-input fixture: runtime validation is the behavior under test.
  return value as readonly SystemInput[];
}

function invalidBilling(value: unknown): TextBlock {
  // Intentional invalid-input fixture: runtime validation is the behavior under test.
  return value as TextBlock;
}

describe("buildCanonicalSystem validation", () => {
  it("accepts a valid surrogate pair and preserves its exact text", () => {
    expect(
      buildCanonicalSystem(["valid 😀 pair"], BILLING, IDENTITY)[2],
    ).toEqual({ type: "text", text: "valid 😀 pair" });
  });

  it.each(["\ud800", "\udc00"])("rejects an unpaired surrogate %j", (text) => {
    expect(() => buildCanonicalSystem([text], BILLING, IDENTITY)).toThrow(
      expect.objectContaining({ code: "INVALID_UNICODE" }),
    );
  });

  it("rejects a forbidden control character", () => {
    expect(() =>
      buildCanonicalSystem(["invalid\u0001text"], BILLING, IDENTITY),
    ).toThrow(expect.objectContaining({ code: "INVALID_UNICODE" }));
  });

  it("rejects a cyclic input graph", () => {
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(() =>
      buildCanonicalSystem(invalidInput(cyclic), BILLING, IDENTITY),
    ).toThrow(expect.objectContaining({ code: "CYCLIC_INPUT" }));
  });

  it("rejects input whose cumulative text is oversized", () => {
    expect(() =>
      buildCanonicalSystem(["x".repeat(1_000_001)], BILLING, IDENTITY),
    ).toThrow(expect.objectContaining({ code: "INPUT_TOO_LARGE" }));
  });

  it.each([
    ["non-record entry", null],
    ["wrong block type", { type: "image", text: "x" }],
    ["non-string block text", { type: "text", text: 1 }],
    [
      "non-record cache control",
      { type: "text", text: "x", cache_control: "ephemeral" },
    ],
    [
      "wrong cache type",
      { type: "text", text: "x", cache_control: { type: "persistent" } },
    ],
    [
      "wrong cache ttl",
      {
        type: "text",
        text: "x",
        cache_control: { type: "ephemeral", ttl: "forever" },
      },
    ],
    [
      "wrong cache scope",
      {
        type: "text",
        text: "x",
        cache_control: { type: "ephemeral", scope: "local" },
      },
    ],
  ] as const)("rejects a %s", (_name, entry) => {
    expect(() =>
      buildCanonicalSystem(invalidInput([entry]), BILLING, IDENTITY),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("canonicalizes cache control with scope absent and present", () => {
    expect(
      buildCanonicalSystem(
        [
          {
            type: "text",
            text: "absent",
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: "present",
            cache_control: {
              type: "ephemeral",
              ttl: "5m",
              scope: "global",
            },
          },
        ],
        BILLING,
        IDENTITY,
      ).slice(2),
    ).toEqual([
      { type: "text", text: "absent", cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: "present",
        cache_control: { type: "ephemeral", ttl: "5m", scope: "global" },
      },
    ]);
  });

  it("rejects a non-array input", () => {
    expect(() =>
      buildCanonicalSystem(invalidInput({}), BILLING, IDENTITY),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("rejects cache control on the billing block", () => {
    const billing = invalidBilling({
      type: "text",
      text: "billing",
      cache_control: { type: "ephemeral" },
    });
    expect(() => buildCanonicalSystem([], billing, IDENTITY)).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("drops only an exact duplicate identity block", () => {
    expect(
      buildCanonicalSystem(
        [IDENTITY_TEXT, { type: "text", text: IDENTITY_TEXT }],
        BILLING,
        IDENTITY,
      ),
    ).toEqual([
      BILLING,
      {
        type: "text",
        text: IDENTITY_TEXT,
        cache_control: { type: "ephemeral", ttl: "1h" },
      },
    ]);
  });

  it("canonicalizes an unfrozen billing block", () => {
    const billing: TextBlock = { type: "text", text: "billing" };
    expect(buildCanonicalSystem(undefined, billing, IDENTITY)[0]).toEqual({
      type: "text",
      text: "billing",
    });
  });

  it("ignores symbol metadata while preserving canonical output", () => {
    const marker = Symbol("marker");
    const entry: Record<PropertyKey, unknown> = { type: "text", text: "x" };
    entry[marker] = "metadata";
    expect(
      buildCanonicalSystem(invalidInput([entry]), BILLING, IDENTITY)[2],
    ).toEqual({ type: "text", text: "x" });
  });

  it("rejects input whose cumulative property-key size is oversized", () => {
    const oversizedInput: unknown = { ["x".repeat(1_000_001)]: true };

    expect(() => {
      Reflect.apply(buildCanonicalSystem, undefined, [
        oversizedInput,
        BILLING,
        IDENTITY,
      ]);
    }).toThrow(expect.objectContaining({ code: "INPUT_TOO_LARGE" }));
  });
});
