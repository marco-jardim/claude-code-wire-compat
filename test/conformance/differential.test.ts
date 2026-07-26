// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import type { ClaudeCodeRequestInput } from "../../src/contracts.js";
import {
  referenceAdapter,
  syntheticInput,
  type ReferenceFixtureName,
} from "./reference-adapter.js";

const FIXTURES: readonly ReferenceFixtureName[] = [
  "outgoing-foreground.json",
  "outgoing-canary-context-hint-off.json",
];

function logicalHeaders(headers: readonly (readonly [string, string])[]) {
  return new Map(headers);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequestBody(body: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed) || typeof parsed["model"] !== "string") {
    throw new TypeError("Built request body is missing a string model.");
  }
  return parsed;
}

async function expectEvidenceSafe(input: ClaudeCodeRequestInput) {
  const built = await buildClaudeCodeRequest(input);
  const parsed = parseBuiltClaudeCodeRequest(built);
  expect(parsed).toEqual(built);
  expect(built.evidence.profileId).toBe(CLAUDE_CODE_2_1_195_PROFILE.id);
  expect(built.evidence.modelFamily).toMatch(
    /^(?:haiku|sonnet|opus|fable|mythos)$/u,
  );
  expect(built.evidence.betaFeatures).toBeInstanceOf(Array);
  expect(built.evidence.bodyByteLength).toBe(
    new TextEncoder().encode(built.body).length,
  );
  expect(built.evidence.messageCount).toBe(input.messages.length);
  expect(built.evidence.systemBlockCount).toEqual(expect.any(Number));
  expect(built.evidence.capabilityDecisions).toEqual(expect.any(Object));
  return built;
}

describe("fixture-backed differential conformance", () => {
  it.each(FIXTURES)("matches %s", async (name) => {
    const reference = referenceAdapter(name);
    const built = await expectEvidenceSafe(syntheticInput(reference));
    expect(built.url).toBe(reference.url);
    expect(built.method).toBe(reference.method);
    expect(logicalHeaders(built.headers)).toEqual(
      logicalHeaders(reference.headers),
    );
    expect(parseRequestBody(built.body)).toEqual(reference.body);
  });

  it("conforms with tools, explicit and adaptive thinking, and permitted effort", async () => {
    const reference = referenceAdapter("outgoing-canary-context-hint-off.json");
    const base = syntheticInput(reference);
    const variants: ClaudeCodeRequestInput[] = [
      {
        ...base,
        tools: [
          {
            name: "lookup",
            description: "Synthetic conformance tool",
            input_schema: { type: "object", properties: {} },
          },
        ],
      },
      { ...base, thinking: { type: "enabled", budgetTokens: 1024 } },
      { ...base, thinking: { type: "adaptive" } },
      ...(["low", "medium", "high"] as const).map((effort) => ({
        ...base,
        effort,
      })),
    ];
    for (const input of variants) {
      const built = await expectEvidenceSafe(input);
      expect(built.url).toBe(reference.url);
      expect(built.method).toBe(reference.method);
      expect(logicalHeaders(built.headers).get("authorization")).toBe(
        logicalHeaders(reference.headers).get("authorization"),
      );
      expect(parseRequestBody(built.body)).toMatchObject({ model: base.model });
    }
  });

  it("conforms for interactive, non-interactive, and short-message inputs", async () => {
    const base = syntheticInput(referenceAdapter("outgoing-foreground.json"));
    const variants: ClaudeCodeRequestInput[] = [
      base,
      { ...base, system: ["non-interactive system"] },
      { ...base, messages: [{ role: "user", content: "short" }] },
    ];
    for (const input of variants) await expectEvidenceSafe(input);
  });

  it("conforms for every pinned supported model", async () => {
    const base = syntheticInput(referenceAdapter("outgoing-foreground.json"));
    for (const model of Object.keys(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      const built = await expectEvidenceSafe({ ...base, model });
      expect(parseRequestBody(built.body)).toMatchObject({ model });
    }
  });
});
