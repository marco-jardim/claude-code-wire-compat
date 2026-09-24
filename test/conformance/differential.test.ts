// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
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
  // The port plan also listed a caller-supplied-display case and a haiku case
  // as optional edge fixtures. The 2.1.233 fixture set these mirror had
  // neither, so neither was created.
  {
    name: "outgoing-foreground-2.1.280.json",
    profile: CLAUDE_CODE_2_1_280_PROFILE,
  },
  {
    name: "outgoing-canary-context-hint-off-2.1.280.json",
    profile: CLAUDE_CODE_2_1_280_PROFILE,
  },
  {
    name: "outgoing-default-path-2.1.280.json",
    profile: CLAUDE_CODE_2_1_280_PROFILE,
  },
];

// Transcribed from the 2.1.280 analysis document's default-path derivation,
// NOT captured from the builder. The separator is a bare comma, taken from the
// committed golden fixtures.
const DEFAULT_PATH_BETAS: readonly string[] = [
  "claude-code-20250219",
  "oauth-2025-04-20",
  "interleaved-thinking-2025-05-14",
  "thinking-token-count-2026-05-13",
  "context-management-2025-06-27",
  "prompt-caching-scope-2026-01-05",
  "mid-conversation-system-2026-04-07",
  "per-turn-control-2026-07-01",
  "mid-conversation-tool-changes-2026-07-01",
  "mid-conversation-system-clear-at-2026-08-21",
  "effort-2025-11-24",
  "thinking-binding-controls-2026-08-01",
  "thinking-display-updates-2026-08-18",
  "cache-diagnosis-2026-04-07",
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
  // This pattern is NOT the full family union: `modelFamilyOf` can also return
  // `mythos` and `unknown`, and the 2.1.280 catalogue does carry mythos models.
  // No fixture uses one today, so the narrower pattern is a deliberate
  // tripwire rather than an oversight -- but a future mythos fixture will fail
  // here with an opaque message, and the pattern must be widened then.
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

  it("claude-opus-5-5 default path: header equals the 14-identifier literal and thinking carries display updates", async () => {
    const reference = referenceAdapter("outgoing-default-path-2.1.280.json");
    const built = await expectEvidenceSafe(
      syntheticInput(reference),
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const betaHeader = built.headers.find(
      ([headerName]) => headerName.toLowerCase() === "anthropic-beta",
    )?.[1];
    expect(betaHeader).toBeDefined();
    const header = betaHeader ?? "";
    // The splice check and the element-wise comparison run FIRST, on purpose.
    // The exact-equality assertion below subsumes both, so if it ran first a
    // regression that only un-spliced redact-thinking would be reported as a
    // whole-string mismatch instead of naming the identifier that moved.
    expect(header).not.toContain("redact-thinking-2026-02-12");
    expect(header.split(",")).toEqual(DEFAULT_PATH_BETAS);
    expect(header).toBe(DEFAULT_PATH_BETAS.join(","));
    expect(parseRequestBody(built.body)["thinking"]).toEqual({
      type: "adaptive",
      display: "updates",
    });
    const typeIndex = built.body.indexOf('"type":"adaptive"');
    const displayIndex = built.body.indexOf('"display":"updates"');
    expect(typeIndex).not.toBe(-1);
    expect(displayIndex).not.toBe(-1);
    expect(typeIndex).toBeLessThan(displayIndex);
  });

  // The variant sweeps below are 2.1.195-only. That scoping predates the
  // 2.1.280 port -- 2.1.233 never got one either -- so it is a known gap
  // rather than a regression: the fixture replays above cover every pinned
  // profile, but the per-model catalogue sweep covers only the oldest.
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
