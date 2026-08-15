// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import type { ClaudeCodeRequestInput } from "../../src/contracts.js";
import {
  referenceAdapter,
  syntheticInput,
  type ReferenceFixtureName,
} from "./reference-adapter.js";

type ConformanceProfile = NonNullable<
  Parameters<typeof buildClaudeCodeRequest>[1]
>;

interface FixtureCase {
  /** Committed reference capture. */
  readonly name: ReferenceFixtureName;
  /** Profile the capture was taken under, always named rather than defaulted. */
  readonly profile: ConformanceProfile;
}

const FIXTURES: readonly FixtureCase[] = [
  { name: "outgoing-foreground.json", profile: CLAUDE_CODE_2_1_195_PROFILE },
  {
    name: "outgoing-canary-context-hint-off.json",
    profile: CLAUDE_CODE_2_1_195_PROFILE,
  },
  {
    name: "outgoing-foreground-2.1.233.json",
    profile: CLAUDE_CODE_2_1_233_PROFILE,
  },
  {
    name: "outgoing-canary-context-hint-off-2.1.233.json",
    profile: CLAUDE_CODE_2_1_233_PROFILE,
  },
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

async function expectEvidenceSafe(
  input: ClaudeCodeRequestInput,
  profile: ConformanceProfile,
) {
  // Every reference fixture is a capture of one specific release, so the
  // profile is named rather than defaulted: this suite is a statement about
  // each pinned release and must keep making it whichever profile the builder
  // defaults to.
  const built = await buildClaudeCodeRequest(input, profile);
  const parsed = parseBuiltClaudeCodeRequest(built, profile);
  expect(parsed).toEqual(built);
  expect(built.evidence.profileId).toBe(profile.id);
  expect(built.evidence.modelFamily).toMatch(/^(?:haiku|sonnet|opus|fable)$/u);
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
  it.each(FIXTURES)("matches $name", async ({ name, profile }) => {
    const reference = referenceAdapter(name);
    const built = await expectEvidenceSafe(syntheticInput(reference), profile);
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
      const built = await expectEvidenceSafe(
        input,
        CLAUDE_CODE_2_1_195_PROFILE,
      );
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
    for (const input of variants)
      await expectEvidenceSafe(input, CLAUDE_CODE_2_1_195_PROFILE);
  });

  it("conforms for every pinned supported model", async () => {
    const base = syntheticInput(referenceAdapter("outgoing-foreground.json"));
    for (const model of Object.keys(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      const built = await expectEvidenceSafe(
        { ...base, model },
        CLAUDE_CODE_2_1_195_PROFILE,
      );
      expect(parseRequestBody(built.body)).toMatchObject({ model });
    }
  });
});
