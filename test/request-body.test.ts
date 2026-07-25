// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the canonical request-body surface.
 * Wave 2 must export `buildCanonicalBody(input, resolvedModel, systemBlocks,
 * metadata, profile?): Readonly<Record<string, unknown>>`.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "./support/wave2-modules.js";

type BuildCanonicalBody = (
  input: unknown,
  resolvedModel: unknown,
  systemBlocks: unknown,
  metadata: unknown,
  profile?: unknown,
) => Readonly<Record<string, unknown>>;

const GOLDENS = [
  "outgoing-foreground.json",
  "outgoing-canary-context-hint-off.json",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function goldenBody(filename: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(
    readFileSync(
      new URL(`./fixtures/golden/${filename}`, import.meta.url),
      "utf8",
    ),
  );
  if (!isRecord(parsed) || !isRecord(parsed["body"])) {
    throw new TypeError("Golden fixture body is missing.");
  }
  return parsed["body"];
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string")
    throw new TypeError(`${name} must be a string.`);
  return value;
}

function bodyArguments(
  body: Record<string, unknown>,
): readonly [
  input: unknown,
  resolvedModel: unknown,
  systemBlocks: unknown,
  metadata: unknown,
] {
  const model = requireString(body["model"], "model");
  const modelProfile = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[model];
  if (modelProfile === undefined)
    throw new TypeError("Golden model is unsupported.");
  const input: Record<string, unknown> = {
    model,
    maxTokens: body["max_tokens"],
    messages: body["messages"],
  };
  if (body["tools"] !== undefined) input["tools"] = body["tools"];
  if (body["thinking"] !== undefined) input["thinking"] = body["thinking"];
  if (isRecord(body["output_config"])) {
    input["effort"] = body["output_config"]["effort"];
  }
  return [
    input,
    { id: model, ...modelProfile },
    body["system"],
    body["metadata"],
  ];
}

function nestedObject(depth: number): unknown {
  let value: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) value = { value };
  return value;
}

describe("request-body (Wave 1 RED specification)", () => {
  it("records that the Wave 2 module must be implemented", async () => {
    await expect(expectModuleUnimplemented("request-body")).resolves.toBe(
      false,
    );
  });

  it.each(GOLDENS)(
    "matches body golden %s and its key order",
    async (filename) => {
      const build = await loadWave2Function<BuildCanonicalBody>(
        "request-body",
        "buildCanonicalBody",
      );
      const golden = goldenBody(filename);
      const result = build(
        ...bodyArguments(golden),
        CLAUDE_CODE_2_1_195_PROFILE,
      );
      expect(result).toEqual(golden);
      expect(Object.keys(result)).toEqual(Object.keys(golden));
      expect(result).not.toHaveProperty("context_hint");
    },
  );

  it("emits temperature only when thinking is inactive", async () => {
    const build = await loadWave2Function<BuildCanonicalBody>(
      "request-body",
      "buildCanonicalBody",
    );
    const foreground = goldenBody(GOLDENS[0]);
    const canary = goldenBody(GOLDENS[1]);
    // Mirrors upstream lib/mimicry/request-body.mjs:147-176.
    expect(build(...bodyArguments(foreground))["temperature"]).toBe(1);
    expect(build(...bodyArguments(canary))).not.toHaveProperty("temperature");

    const enabledArguments = bodyArguments(canary);
    const enabledInput = enabledArguments[0];
    if (!isRecord(enabledInput))
      throw new TypeError("Expected body input record.");
    const withEnabledThinking = {
      ...enabledInput,
      thinking: { type: "enabled", budgetTokens: 1024 },
    };
    expect(
      build(
        withEnabledThinking,
        enabledArguments[1],
        enabledArguments[2],
        enabledArguments[3],
      ),
    ).not.toHaveProperty("temperature");
  });

  it("uses the canary adaptive-thinking and effort shapes", async () => {
    const build = await loadWave2Function<BuildCanonicalBody>(
      "request-body",
      "buildCanonicalBody",
    );
    const golden = goldenBody(GOLDENS[1]);
    const result = build(...bodyArguments(golden));
    expect(result["thinking"]).toEqual({ type: "adaptive" });
    expect(result["output_config"]).toEqual({ effort: "high" });

    const foreground = goldenBody(GOLDENS[0]);
    expect(build(...bodyArguments(foreground))).not.toHaveProperty(
      "output_config",
    );
  });

  it("gates effort on both model capability and an explicit request", async () => {
    const build = await loadWave2Function<BuildCanonicalBody>(
      "request-body",
      "buildCanonicalBody",
    );
    const capable = bodyArguments(goldenBody(GOLDENS[1]));
    if (!isRecord(capable[0]))
      throw new TypeError("Expected capable input record.");
    const withoutEffort = Object.fromEntries(
      Object.entries(capable[0]).filter(([key]) => key !== "effort"),
    );
    expect(
      build(withoutEffort, capable[1], capable[2], capable[3]),
    ).not.toHaveProperty("output_config");

    const incapable = bodyArguments(goldenBody(GOLDENS[0]));
    if (!isRecord(incapable[0]))
      throw new TypeError("Expected incapable input record.");
    expect(() =>
      build(
        { ...incapable[0], effort: "high" },
        incapable[1],
        incapable[2],
        incapable[3],
      ),
    ).toThrow(expect.objectContaining({ code: "INVALID_EFFORT" }));
  });

  it.each([
    ["excessive depth", nestedObject(200), "INPUT_TOO_DEEP"],
    ["excessive size", "x".repeat(2_000_000), "INPUT_TOO_LARGE"],
    ["non-finite NaN", Number.NaN, "INVALID_INPUT"],
    ["non-finite Infinity", Number.POSITIVE_INFINITY, "INVALID_INPUT"],
    ["lone surrogate", "\ud800", "INVALID_UNICODE"],
    [
      "prototype key",
      JSON.parse('{"__proto__":{"polluted":true}}'),
      "INVALID_INPUT",
    ],
    ["prototype name", { prototype: "polluted" }, "INVALID_INPUT"],
    ["constructor name", { constructor: "polluted" }, "INVALID_INPUT"],
  ] as const)("rejects %s", async (_name, hostile, code) => {
    const build = await loadWave2Function<BuildCanonicalBody>(
      "request-body",
      "buildCanonicalBody",
    );
    const golden = goldenBody(GOLDENS[0]);
    const args = bodyArguments(golden);
    expect(() =>
      build({ messages: [hostile] }, args[1], args[2], args[3]),
    ).toThrow(expect.objectContaining({ code }));
  });

  it("rejects cyclic input graphs", async () => {
    const build = await loadWave2Function<BuildCanonicalBody>(
      "request-body",
      "buildCanonicalBody",
    );
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    const args = bodyArguments(goldenBody(GOLDENS[0]));
    expect(() => build(cyclic, args[1], args[2], args[3])).toThrow(
      expect.objectContaining({ code: "CYCLIC_INPUT" }),
    );
  });

  it.each([
    [
      "orphan result",
      [
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "missing", content: "x" },
          ],
        },
      ],
    ],
    [
      "duplicate use ids",
      [
        {
          role: "assistant",
          content: [
            { type: "tool_use", id: "duplicate", name: "one", input: {} },
            { type: "tool_use", id: "duplicate", name: "two", input: {} },
          ],
        },
      ],
    ],
  ] as const)(
    "rejects tool-integrity violation: %s",
    async (_name, messages) => {
      const build = await loadWave2Function<BuildCanonicalBody>(
        "request-body",
        "buildCanonicalBody",
      );
      const golden = goldenBody(GOLDENS[0]);
      const args = bodyArguments(golden);
      expect(() =>
        build({ ...args[0], messages }, args[1], args[2], args[3]),
      ).toThrow();
    },
  );

  it("does not mutate input and freezes output", async () => {
    const build = await loadWave2Function<BuildCanonicalBody>(
      "request-body",
      "buildCanonicalBody",
    );
    const golden = goldenBody(GOLDENS[0]);
    const args = bodyArguments(golden);
    const input = args[0];
    const before = structuredClone(input);
    const result = build(...args);
    expect(input).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
