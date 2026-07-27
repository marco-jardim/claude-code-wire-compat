// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  ContextManagementConfig,
  JSONOutputFormat,
  OutputConfigInput,
  ToolChoice,
} from "../../src/contracts.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
} from "../../src/index.js";
import { buildCanonicalBody } from "../../src/request-body.js";

const MODEL_ID = "claude-opus-4-8";
const MODEL_DEFINITION = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[MODEL_ID];
if (MODEL_DEFINITION === undefined)
  throw new Error("Missing test model profile.");
const RESOLVED_MODEL = { id: MODEL_ID, wireId: MODEL_ID, ...MODEL_DEFINITION };
const BASE_INPUT = {
  model: MODEL_ID,
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello" }],
};

function profileWithExperimentalBetas(
  experimentalBetasEnabled: boolean,
): ClaudeCodeProtocolProfile {
  return {
    ...CLAUDE_CODE_2_1_195_PROFILE,
    betaPolicy: {
      ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
      experimentalBetasEnabled,
    },
  };
}

function build(
  input: unknown,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): Readonly<Record<string, unknown>> {
  return buildCanonicalBody(input, RESOLVED_MODEL, [], {}, profile);
}

function buildField(
  key: string,
  value: unknown,
  profile?: ClaudeCodeProtocolProfile,
): Readonly<Record<string, unknown>> {
  return build({ ...BASE_INPUT, [key]: value }, profile);
}

function expectInvalid(input: unknown): void {
  expect(() => build({ ...BASE_INPUT, ...requireObject(input) })).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
}

function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected object test input.");
  }
  return Object.fromEntries(Object.entries(value));
}

describe("top-level request controls", () => {
  it("type-checks the expanded public declarations", () => {
    const contextManagement: ContextManagementConfig = {
      edits: [{ type: "clear_thinking_20251015", keep: "all" }],
    };
    const outputConfig: OutputConfigInput = {
      effort: "xhigh",
      maxOutputTokens: null,
    };
    const outputFormat: JSONOutputFormat = {
      schema: { type: "object" },
      type: "json_schema",
    };
    const toolChoice: ToolChoice = {
      name: "inspect",
      type: "tool",
      disable_parallel_tool_use: true,
    };
    const input: ClaudeCodeRequestInput = {
      accessToken: "sentinel-token-top-level-91f2",
      model: MODEL_ID,
      maxTokens: 1024,
      messages: [{ role: "user", content: "hello" }],
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
      contextManagement,
      outputConfig,
      speed: "standard",
      serviceTier: "auto",
      outputFormat,
      toolChoice,
      topP: 0.9,
      topK: 40,
      stopSequences: ["stop"],
      stream: false,
      temperature: 0.25,
    };
    expect(input.contextManagement).toBe(contextManagement);
  });

  it.each([
    ["contextManagement", "context_management", { edits: [] }],
    ["outputConfig", "output_config", { effort: "high" }],
    ["speed", "speed", "standard"],
    ["serviceTier", "service_tier", "standard_only"],
    [
      "outputFormat",
      "output_format",
      { schema: { type: "object" }, type: "json_schema" },
    ],
    ["toolChoice", "tool_choice", { type: "auto" }],
    ["topP", "top_p", 0.8],
    ["topK", "top_k", 32],
    ["stopSequences", "stop_sequences", ["done"]],
    ["stream", "stream", true],
  ] as const)("maps %s to %s", (inputKey, wireKey, value) => {
    const result = buildField(inputKey, value);
    expect(result[wireKey]).toEqual(value);
    // The caller-facing key must survive on the wire only when it is also the
    // wire key; a renamed field must not leak its input name. Asserted
    // unconditionally so the check cannot be silently skipped.
    expect(Object.hasOwn(result, inputKey)).toBe(inputKey === wireKey);
  });

  it.each([
    ["contextManagement", "context_management"],
    ["speed", "speed"],
    ["outputFormat", "output_format"],
  ] as const)("distinguishes absent and null %s", (inputKey, wireKey) => {
    expect(build(BASE_INPUT)).not.toHaveProperty(wireKey);
    expect(buildField(inputKey, null)).toHaveProperty(wireKey, null);
  });

  it("preserves optional-field insertion order while translating names", () => {
    const result = build({
      ...BASE_INPUT,
      topK: 7,
      serviceTier: "auto",
      topP: 0.75,
      stopSequences: ["stop"],
    });
    expect(Object.keys(result).slice(4)).toEqual([
      "top_k",
      "service_tier",
      "top_p",
      "stop_sequences",
      "metadata",
    ]);
  });

  it("propagates expanded fields through the public request builder", async () => {
    const request = await buildClaudeCodeRequest({
      accessToken: "sentinel-token-top-level-91f2",
      model: MODEL_ID,
      maxTokens: 1024,
      messages: [{ role: "user", content: "hello" }],
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
      topP: 0.7,
      stopSequences: ["stop"],
    });
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({ top_p: 0.7, stop_sequences: ["stop"] }),
    );
  });
});

describe("context management", () => {
  it.each([
    { type: "clear_thinking_20251015", keep: "all" },
    { type: "clear_thinking_20251015", keep: { type: "all" } },
    {
      type: "clear_thinking_20251015",
      keep: { type: "thinking_turns", value: 2 },
    },
    {
      type: "clear_tool_uses_20250919",
      clear_at_least: { type: "input_tokens", value: 100 },
      clear_tool_inputs: ["search", "fetch"],
      exclude_tools: ["bash"],
      keep: { type: "tool_uses", value: 3 },
      trigger: { type: "input_tokens", value: 500 },
    },
    {
      type: "clear_tool_uses_20250919",
      clear_tool_inputs: true,
      trigger: { type: "tool_uses", value: 5 },
    },
    {
      type: "compact_20260112",
      instructions: "compact carefully",
      pause_after_compaction: true,
      trigger: { type: "input_tokens", value: 1000 },
    },
  ])("accepts edit shape $type %#", (edit) => {
    expect(buildField("contextManagement", { edits: [edit] })).toEqual(
      expect.objectContaining({ context_management: { edits: [edit] } }),
    );
  });

  it.each([
    ["clear_at_least", { type: "clear_tool_uses_20250919" }],
    ["clear_tool_inputs", { type: "clear_tool_uses_20250919" }],
    ["exclude_tools", { type: "clear_tool_uses_20250919" }],
    ["instructions", { type: "compact_20260112" }],
    ["trigger", { type: "compact_20260112" }],
  ] as const)("distinguishes absent and null edit field %s", (key, base) => {
    const absent = buildField("contextManagement", { edits: [base] });
    const present = buildField("contextManagement", {
      edits: [{ ...base, [key]: null }],
    });
    expect(
      (absent["context_management"] as { edits: Record<string, unknown>[] })
        .edits[0],
    ).not.toHaveProperty(key);
    expect(
      (present["context_management"] as { edits: Record<string, unknown>[] })
        .edits[0],
    ).toHaveProperty(key, null);
  });

  it("rejects unknown edit keys and malformed nested shapes", () => {
    expectInvalid({
      contextManagement: {
        edits: [{ type: "clear_thinking_20251015", unknown: true }],
      },
    });
    expectInvalid({
      contextManagement: {
        edits: [
          {
            type: "clear_tool_uses_20250919",
            trigger: { type: "input_tokens", value: "many" },
          },
        ],
      },
    });
  });
});

describe("output controls", () => {
  it.each([
    { type: "auto", disable_parallel_tool_use: true },
    { type: "any", disable_parallel_tool_use: false },
    { type: "none" },
    { name: "inspect", type: "tool", disable_parallel_tool_use: true },
  ])("accepts tool choice $type", (toolChoice) => {
    expect(buildField("toolChoice", toolChoice)["tool_choice"]).toEqual(
      toolChoice,
    );
  });

  it("preserves output effort and beta-only token budget in input order", () => {
    const result = buildField("outputConfig", {
      maxOutputTokens: 2048,
      effort: "xhigh",
    });
    expect(result["output_config"]).toEqual({
      max_output_tokens: 2048,
      effort: "xhigh",
    });
    expect(Object.keys(result["output_config"] as object)).toEqual([
      "max_output_tokens",
      "effort",
    ]);
  });

  it.each(["effort", "maxOutputTokens"] as const)(
    "distinguishes absent and null outputConfig.%s",
    (key) => {
      const absent = buildField("outputConfig", {})["output_config"];
      const present = buildField("outputConfig", { [key]: null })[
        "output_config"
      ];
      expect(absent).not.toHaveProperty(
        key === "maxOutputTokens" ? "max_output_tokens" : key,
      );
      expect(present).toHaveProperty(
        key === "maxOutputTokens" ? "max_output_tokens" : key,
        null,
      );
    },
  );

  it("requires experimental betas for maxOutputTokens", () => {
    expect(() =>
      buildField(
        "outputConfig",
        { maxOutputTokens: 1024 },
        profileWithExperimentalBetas(false),
      ),
    ).toThrow(expect.objectContaining({ code: "UNSUPPORTED_CAPABILITY" }));
    expect(
      buildField("outputConfig", { maxOutputTokens: Number.MAX_SAFE_INTEGER })[
        "output_config"
      ],
    ).toEqual({ max_output_tokens: Number.MAX_SAFE_INTEGER });
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid maxOutputTokens %#",
    (maxOutputTokens) => {
      expect(() => buildField("outputConfig", { maxOutputTokens })).toThrow(
        expect.objectContaining({ code: "INVALID_INPUT" }),
      );
    },
  );

  it("merges equal adapter effort and rejects conflicts", () => {
    expect(
      build({
        ...BASE_INPUT,
        thinking: { type: "adaptive" },
        effort: "high",
        outputConfig: { effort: "high" },
      })["output_config"],
    ).toEqual({ effort: "high" });
    expect(() =>
      build({
        ...BASE_INPUT,
        thinking: { type: "adaptive" },
        effort: "high",
        outputConfig: { effort: "low" },
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("discards temperature when the model does not support it", () => {
    expect(buildField("temperature", 0.125)).not.toHaveProperty("temperature");
    expect(build(BASE_INPUT)).not.toHaveProperty("temperature");
    expect(
      build({
        ...BASE_INPUT,
        thinking: { type: "adaptive" },
        temperature: 0.5,
      }),
    ).not.toHaveProperty("temperature");
  });

  it("couples fast speed to experimental betas", () => {
    expect(() =>
      buildField("speed", "fast", profileWithExperimentalBetas(false)),
    ).toThrow(expect.objectContaining({ code: "UNSUPPORTED_CAPABILITY" }));
    expect(buildField("speed", "fast")["speed"]).toBe("fast");
  });

  it.each([
    { topP: Number.NaN },
    { topK: Number.POSITIVE_INFINITY },
    { temperature: Number.NEGATIVE_INFINITY },
    { stopSequences: ["ok", 1] },
    { serviceTier: "premium" },
    { speed: "turbo" },
    { outputConfig: { effort: "extreme" } },
    { outputFormat: { type: "text", schema: {} } },
    { toolChoice: { type: "none", disable_parallel_tool_use: false } },
    { toolChoice: { type: "tool" } },
    { outputConfig: { effort: "high", unknown: true } },
  ])("rejects invalid output control %#", (input) => {
    expectInvalid(input);
  });

  it("rejects anthropic_beta pending evidence", () => {
    // NO EVIDENCE FOUND for its value shape; blocked pending evidence.
    expectInvalid({ anthropic_beta: ["unknown"] });
  });
});
