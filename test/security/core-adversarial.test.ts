// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for cross-cutting core security behavior.
 * Wave 2 must export `buildClaudeCodeRequest(input, profile?): Promise<BuiltClaudeCodeRequest>`,
 * `buildOrderedHeaders(input): readonly HeaderPair[]`, and
 * `buildCanonicalBody(input, resolvedModel, systemBlocks, metadata, profile?)`.
 */
import { webcrypto } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ClaudeCodeWireError,
  type BuiltClaudeCodeRequest,
  type HeaderPair,
} from "../../src/contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "../support/wave2-modules.js";

type BuildRequest = (input: unknown) => Promise<BuiltClaudeCodeRequest>;
type BuildHeaders = (input: unknown) => readonly HeaderPair[];

const TOKEN = "security-token-sentinel-bf4f40";
const FORBIDDEN = [
  "x-api-key",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "proxy-custom",
  "forwarded",
  "x-forwarded-for",
] as const;

function baseInput(): Record<string, unknown> {
  return {
    accessToken: "synthetic-access-token",
    model: "claude-sonnet-4-5",
    maxTokens: 128,
    messages: [{ role: "user", content: "hello" }],
    system: ["synthetic system"],
    tools: [
      {
        name: "synthetic_tool",
        description: "synthetic description",
        input_schema: {
          type: "object",
          properties: { value: { type: "string" } },
        },
      },
    ],
    runtime: {
      sessionId: "00000000-0000-4000-8000-000000000001",
      deviceId: "device-synthetic",
      accountUuid: "00000000-0000-4000-8000-000000000000",
      runtime: "node",
      runtimeVersion: "v24.15.0",
      os: "Windows",
      arch: "x64",
    },
    metadata: { synthetic: "value" },
    clientRequestId: "00000000-0000-4000-8000-000000000002",
    crypto: {
      subtle: { digest: webcrypto.subtle.digest.bind(webcrypto.subtle) },
    },
  };
}

function headerInput(extraHeaders: readonly HeaderPair[]): unknown {
  const input = baseInput();
  return {
    accessToken: input["accessToken"],
    runtime: input["runtime"],
    clientRequestId: input["clientRequestId"],
    betaFeatures: CLAUDE_CODE_2_1_195_PROFILE.orderedBetas,
    extraHeaders,
    profile: CLAUDE_CODE_2_1_195_PROFILE,
  };
}

function nested(depth: number): unknown {
  let value: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) value = { value };
  return value;
}

function assertSecretSafe(error: unknown): void {
  expect(error).toBeInstanceOf(ClaudeCodeWireError);
  if (!(error instanceof ClaudeCodeWireError)) return;
  expect(error.message).not.toContain(TOKEN);
  expect(JSON.stringify(error.safeDetails)).not.toContain(TOKEN);
  expect(JSON.stringify(error)).not.toContain(TOKEN);
  expect(Object.hasOwn(error, "cause")).toBe(false);
  expect(error.toJSON()).not.toHaveProperty("stack");
  expect(error.toJSON()).not.toHaveProperty("cause");
}

describe("security/core-adversarial (Wave 1 RED specification)", () => {
  it("records that the Wave 2 module must be implemented", async () => {
    await expect(expectModuleUnimplemented("build-request")).resolves.toBe(
      false,
    );
  });

  it.each(["\r\n", "\u0000"])(
    "rejects %s injection across string-bearing positions",
    async (injection) => {
      const build = await loadWave2Function<BuildRequest>(
        "build-request",
        "buildClaudeCodeRequest",
      );
      const hostileValues: readonly Record<string, unknown>[] = [
        { ...baseInput(), accessToken: `token${injection}` },
        { ...baseInput(), model: `claude-sonnet-4-5${injection}` },
        {
          ...baseInput(),
          messages: [{ role: "user", content: `text${injection}` }],
        },
        { ...baseInput(), system: [`system${injection}`] },
        {
          ...baseInput(),
          tools: [
            { name: `tool${injection}`, description: "x", input_schema: {} },
          ],
        },
        { ...baseInput(), metadata: { value: `metadata${injection}` } },
        {
          ...baseInput(),
          runtime: {
            ...baseInput()["runtime"],
            sessionId: `session${injection}`,
          },
        },
      ];
      for (const hostile of hostileValues)
        await expect(build(hostile)).rejects.toThrow();
    },
  );

  it("rejects case-insensitive duplicate and every forbidden header", async () => {
    const build = await loadWave2Function<BuildHeaders>(
      "headers",
      "buildOrderedHeaders",
    );
    expect(() => build(headerInput([["Authorization", "duplicate"]]))).toThrow(
      expect.objectContaining({ code: "DUPLICATE_HEADER" }),
    );
    for (const name of FORBIDDEN) {
      expect(() => build(headerInput([[name, "synthetic"]]))).toThrow(
        expect.objectContaining({ code: "FORBIDDEN_HEADER" }),
      );
    }
  });

  it("never reveals a token placed in any input position", async () => {
    const build = await loadWave2Function<BuildRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const placements: readonly Record<string, unknown>[] = [
      { ...baseInput(), accessToken: TOKEN },
      { ...baseInput(), accessToken: TOKEN, model: TOKEN },
      {
        ...baseInput(),
        accessToken: TOKEN,
        messages: [{ role: "user", content: TOKEN }],
      },
      { ...baseInput(), accessToken: TOKEN, system: [TOKEN] },
      {
        ...baseInput(),
        accessToken: TOKEN,
        tools: [
          { name: TOKEN, description: TOKEN, input_schema: { value: TOKEN } },
        ],
      },
      { ...baseInput(), accessToken: TOKEN, metadata: { value: TOKEN } },
      {
        ...baseInput(),
        accessToken: TOKEN,
        runtime: { ...baseInput()["runtime"], deviceId: TOKEN },
      },
    ];
    for (const placement of placements) {
      try {
        const built = await build(placement);
        expect(built.body).not.toContain(TOKEN);
        expect(JSON.stringify(built.evidence)).not.toContain(TOKEN);
      } catch (error: unknown) {
        assertSecretSafe(error);
      }
    }
  });

  it("rejects prototype pollution without changing Object.prototype", async () => {
    const build = await loadWave2Function<BuildRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const hostile: unknown = JSON.parse('{"__proto__":{"polluted":true}}');
    await expect(build({ ...baseInput(), metadata: hostile })).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });

  it("rejects deep, oversized, cyclic, and malformed Unicode graphs", async () => {
    const build = await loadWave2Function<BuildRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    const cases: readonly [unknown, string][] = [
      [nested(200), "INPUT_TOO_DEEP"],
      ["x".repeat(2_000_000), "INPUT_TOO_LARGE"],
      [cyclic, "CYCLIC_INPUT"],
      ["\ud800", "INVALID_UNICODE"],
      ["\udc00", "INVALID_UNICODE"],
    ];
    for (const [value, code] of cases) {
      await expect(
        build({ ...baseInput(), messages: [{ role: "user", content: value }] }),
      ).rejects.toThrow(expect.objectContaining({ code }));
    }
  });

  it("keeps ClaudeCodeWireError serialization cause- and stack-free", () => {
    const error = new ClaudeCodeWireError("INVALID_INPUT", {
      field: "synthetic",
    });
    expect(Object.hasOwn(error, "cause")).toBe(false);
    expect(error.toJSON()).toEqual({
      name: "ClaudeCodeWireError",
      code: "INVALID_INPUT",
      safeDetails: { field: "synthetic" },
    });
    expect(error.toJSON()).not.toHaveProperty("stack");
  });
});
