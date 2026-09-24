// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeProtocolProfile } from "../../src/index.js";
import {
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  buildClaudeCodeRequest,
} from "../../src/index.js";

const base = {
  accessToken: "sentinel-token-thinking-contract-91f2",
  model: "claude-opus-4-6",
  maxTokens: 100000,
  messages: [{ role: "user", content: "hi" }],
  runtime: {
    sessionId: "00000000-0000-4000-8000-000000000001",
    deviceId:
      "0000000000000000000000000000000000000000000000000000000000000002",
    accountUuid: "00000000-0000-4000-8000-000000000000",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "request",
} as const;

/**
 * Every builder call that asserts emitted bytes names its profile explicitly;
 * only the input-validation rejections at the bottom use `DEFAULT_PROFILE`. The
 * profile is a required argument so a new byte-level test cannot silently
 * inherit whatever the default happens to be.
 */
async function body(
  profile: ClaudeCodeProtocolProfile,
  overrides: object = {},
): Promise<Record<string, unknown>> {
  const built = await buildClaudeCodeRequest(
    { ...base, ...overrides },
    profile,
  );
  return JSON.parse(built.body) as Record<string, unknown>;
}

/**
 * This group asserts the 2.1.233 thinking contract and is pinned to that
 * profile. 2.1.280 deliberately differs: on a first-party interactive path with
 * thinking active and no caller `display`, it injects `display: "updates"`,
 * emits `thinking-display-updates-2026-08-18` and splices out
 * `redact-thinking-2026-02-12`. Several assertions below are partial matches
 * that would also pass on 2.1.280 only because they ignore the injected
 * `display`; they are pinned for that reason, not because they fail.
 *
 * The 2.1.280 side of the display/redact contract lives in
 * `test/validation/thinking-display-updates-2.1.280.test.ts`.
 */
describe("thinking wire contract (2.1.233)", () => {
  it.each(["summarized", "omitted"] as const)(
    "emits adaptive display %s",
    async (display) => {
      await expect(
        body(CLAUDE_CODE_2_1_233_PROFILE, {
          thinking: { type: "adaptive", display },
        }),
      ).resolves.toMatchObject({ thinking: { type: "adaptive", display } });
    },
  );

  it("omits display when the caller omits it", async () => {
    // 2.1.233 contract; 2.1.280 injects `display: "updates"` here instead.
    const result = await body(CLAUDE_CODE_2_1_233_PROFILE, {
      thinking: { type: "adaptive" },
    });
    expect(result["thinking"]).toEqual({ type: "adaptive" });
    expect(result["thinking"]).not.toHaveProperty("display");
  });

  it("emits or omits disabled thinking according to model capability", async () => {
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-opus-4-6",
        thinking: { type: "disabled" },
      }),
    ).resolves.toMatchObject({ thinking: { type: "disabled" } });
    const rejecting = await body(CLAUDE_CODE_2_1_233_PROFILE, {
      model: "claude-fable-5",
      thinking: { type: "disabled" },
    });
    expect(rejecting).not.toHaveProperty("thinking");
  });

  it("clamps an explicit enabled budget to max_tokens minus one", async () => {
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-opus-4-0",
        maxTokens: 5000,
        thinking: { type: "enabled", budgetTokens: 40000 },
      }),
    ).resolves.toMatchObject({
      thinking: { budget_tokens: 4999, type: "enabled" },
    });
  });

  it("defaults an enabled budget from the model table", async () => {
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-opus-4-0",
        thinking: { type: "enabled" },
      }),
    ).resolves.toMatchObject({
      thinking: { budget_tokens: 31999, type: "enabled" },
    });
  });

  it("removes redact-thinking only when display is active", async () => {
    // 2.1.233 contract; 2.1.280 splices redact-thinking out of `normal` too.
    const normal = await buildClaudeCodeRequest(
      {
        ...base,
        thinking: { type: "adaptive" },
      },
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    const displayed = await buildClaudeCodeRequest(
      {
        ...base,
        thinking: { type: "adaptive", display: "summarized" },
      },
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    expect(normal.evidence.betaFeatures).toContain(
      "redact-thinking-2026-02-12",
    );
    expect(displayed.evidence.betaFeatures).not.toContain(
      "redact-thinking-2026-02-12",
    );
  });

  it("demotes forced tool choice during extended thinking", async () => {
    const toolChoice = { type: "tool", name: "X" } as const;
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        thinking: { type: "adaptive" },
        toolChoice,
      }),
    ).resolves.toMatchObject({ tool_choice: { type: "auto" } });
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-fable-5",
        toolChoice,
      }),
    ).resolves.toMatchObject({ tool_choice: { type: "auto" } });
  });

  it("lets an adaptive model override enabled thinking", async () => {
    // 2.1.233 contract; the 2.1.280 counterpart is in the group below.
    const result = await body(CLAUDE_CODE_2_1_233_PROFILE, {
      model: "claude-opus-4-8",
      thinking: { type: "enabled", budgetTokens: 1234 },
    });
    expect(result["thinking"]).toEqual({ type: "adaptive" });
    expect(result["thinking"]).not.toHaveProperty("budget_tokens");
  });

  it("lets a non-adaptive model override adaptive thinking", async () => {
    await expect(
      body(CLAUDE_CODE_2_1_233_PROFILE, {
        model: "claude-opus-4-0",
        thinking: { type: "adaptive" },
      }),
    ).resolves.toMatchObject({
      thinking: { budget_tokens: 31999, type: "enabled" },
    });
  });

  it("emits display on the enabled branch too", async () => {
    // claude-opus-4-5 has thinking and interleavedThinking but NOT
    // adaptiveThinking, so it is the only shape that reaches `display` through
    // the enabled branch rather than the adaptive one.
    const built = await buildClaudeCodeRequest(
      {
        ...base,
        model: "claude-opus-4-5",
        maxTokens: 5000,
        thinking: { type: "enabled", display: "summarized" },
      },
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    const result = JSON.parse(built.body) as Record<string, unknown>;
    expect(result["thinking"]).toEqual({
      budget_tokens: 4999,
      type: "enabled",
      display: "summarized",
    });
    expect(built.body.indexOf('"budget_tokens":4999')).toBeLessThan(
      built.body.indexOf('"type":"enabled"'),
    );
    expect(built.body.indexOf('"type":"enabled"')).toBeLessThan(
      built.body.indexOf('"display":"summarized"'),
    );
  });

  it("serializes budget_tokens before type", async () => {
    const built = await buildClaudeCodeRequest(
      {
        ...base,
        model: "claude-opus-4-0",
        thinking: { type: "enabled", budgetTokens: 1234 },
      },
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    expect(built.body.indexOf('"budget_tokens":1234')).toBeLessThan(
      built.body.indexOf('"type":"enabled"'),
    );
  });

  it("suppresses temperature when an unsupported thinking request is active", async () => {
    const result = await body(CLAUDE_CODE_2_1_233_PROFILE, {
      model: "claude-3-5-sonnet",
      thinking: { type: "enabled" },
      temperature: 0.5,
    });
    expect(result).not.toHaveProperty("thinking");
    expect(result).not.toHaveProperty("temperature");
  });
});

// Only the adaptive override is asserted here for 2.1.280. The `display:
// "updates"` injection and the redact-thinking removal are covered in
// `test/validation/thinking-display-updates-2.1.280.test.ts`. The 2.1.280
// enabled-budget clamp, budget default, adaptive-to-enabled coercion and
// forced tool-choice demotion are covered in the `(2.1.280)` group of
// `test/validation/max-tokens-clamp.test.ts`.
describe("thinking wire contract (2.1.280)", () => {
  it("lets an adaptive model override enabled thinking", async () => {
    const built = await buildClaudeCodeRequest(
      {
        ...base,
        model: "claude-opus-4-8",
        thinking: { type: "enabled", budgetTokens: 1234 },
      },
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const result = JSON.parse(built.body) as Record<string, unknown>;
    expect(result["thinking"]).toEqual({
      type: "adaptive",
      display: "updates",
    });
    expect(result["thinking"]).not.toHaveProperty("budget_tokens");
    expect(built.body.indexOf('"type":"adaptive"')).toBeLessThan(
      built.body.indexOf('"display":"updates"'),
    );
  });
});

describe("thinking validation", () => {
  async function expectInvalid(thinking: unknown): Promise<void> {
    const input: Record<string, unknown> = { ...base, thinking };
    await expect(
      buildClaudeCodeRequest(
        input as Parameters<typeof buildClaudeCodeRequest>[0],
      ),
    ).rejects.toMatchObject({ code: "INVALID_THINKING" });
  }

  it.each([
    null,
    "enabled",
    { type: "enabled", extra: true },
    { type: "automatic" },
    { type: "enabled", budgetTokens: 0 },
    { type: "enabled", budgetTokens: 1.5 },
    { type: "enabled", display: "full" },
    { type: "disabled", display: "omitted" },
  ])("rejects malformed thinking %#", (thinking) => expectInvalid(thinking));
});
