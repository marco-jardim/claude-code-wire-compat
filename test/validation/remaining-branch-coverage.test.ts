// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const baseInput = {
  accessToken: "branch-coverage-token",
  model: "claude-sonnet-4-6",
  maxTokens: 1_024,
  messages: [{ role: "user", content: "branch coverage" }],
  runtime: {
    sessionId: "branch-coverage-session",
    deviceId: "branch-coverage-device",
    accountUuid: "branch-coverage-account",
    runtime: "node",
    runtimeVersion: "20.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "branch-coverage-request",
} as const;

async function expectInvalidInput(
  overrides: Readonly<Record<string, unknown>>,
): Promise<void> {
  await expect(
    Reflect.apply(buildClaudeCodeRequest, undefined, [
      { ...baseInput, ...overrides },
    ]),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
}

function metadataWithDelayedNestedValue(value: string): object {
  let descriptorReads = 0;
  const nested = new Proxy(
    {},
    {
      ownKeys: () => ["value"],
      getOwnPropertyDescriptor: (_target, key) => {
        if (key !== "value") return undefined;
        descriptorReads += 1;
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: descriptorReads < 3 ? "safe" : value,
        };
      },
    },
  );
  return { nested };
}

describe("remaining public validation branches", () => {
  it("rejects unsupported context-management numeric discriminators", async () => {
    await expectInvalidInput({
      contextManagement: {
        edits: [
          {
            type: "clear_tool_uses_20250919",
            keep: { type: "messages", value: 1 },
          },
        ],
      },
    });
  });

  it("rejects unknown context-management edit types", async () => {
    await expectInvalidInput({
      contextManagement: { edits: [{ type: "unknown" }] },
    });
  });

  it("adds adapter effort when output config omits it", async () => {
    const built = await buildClaudeCodeRequest({
      ...baseInput,
      thinking: { type: "adaptive" },
      effort: "high",
      outputConfig: {},
    });

    expect(JSON.parse(built.body)).toMatchObject({
      output_config: { effort: "high" },
    });
  });

  it.each([
    ["nested invalid UTF-16", "\ud800", "INVALID_UNICODE"],
    ["oversized nested text", "x".repeat(8_193), "INPUT_TOO_LARGE"],
    ["nested control characters", "control\u0001", "INVALID_UNICODE"],
  ])("rejects %s after graph inspection", async (_name, value, code) => {
    await expect(
      buildClaudeCodeRequest({
        ...baseInput,
        metadata: metadataWithDelayedNestedValue(value),
      }),
    ).rejects.toMatchObject({ code });
  });

  it("retains optional scalar fields in evidence reconstruction", async () => {
    const built = await buildClaudeCodeRequest({
      ...baseInput,
      stainlessHelper: "branch-helper",
      speed: "standard",
      serviceTier: "auto",
      topK: 1,
      stream: false,
      temperature: 0,
    });

    expect(JSON.parse(built.body)).toMatchObject({
      speed: "standard",
      service_tier: "auto",
      top_k: 1,
      stream: false,
      temperature: 0,
    });
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it.each([
    [
      "a citation collection that is not an array",
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "x", citations: {} }],
          },
        ],
      },
    ],
    [
      "an unknown citation type",
      {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "x",
                citations: [{ type: "unknown" }],
              },
            ],
          },
        ],
      },
    ],
    [
      "an unknown image source type",
      {
        messages: [
          {
            role: "user",
            content: [{ type: "image", source: { type: "unknown", url: "x" } }],
          },
        ],
      },
    ],
    [
      "a document with the wrong media type",
      {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "text/plain",
                  data: "x",
                },
              },
            ],
          },
        ],
      },
    ],
    [
      "non-array document content",
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "content", content: {} } },
            ],
          },
        ],
      },
    ],
    [
      "an unknown nested document block",
      {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "content",
                  content: [{ type: "unknown" }],
                },
              },
            ],
          },
        ],
      },
    ],
    [
      "non-array search-result content",
      {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "search_result",
                content: {},
                source: "source",
                title: "title",
              },
            ],
          },
        ],
      },
    ],
    [
      "an unknown tool caller",
      {
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "call",
                name: "tool",
                input: {},
                caller: { type: "unknown" },
              },
            ],
          },
        ],
      },
    ],
    [
      "non-array tool-result content",
      {
        messages: [
          {
            role: "assistant",
            content: [
              { type: "tool_use", id: "call", name: "tool", input: {} },
            ],
          },
          {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "call", content: {} },
            ],
          },
        ],
      },
    ],
    ["non-array stop sequences", { stopSequences: {} }],
    [
      "non-array tool input examples",
      { tools: [{ name: "tool", input_schema: {}, input_examples: {} }] },
    ],
    [
      "a non-object tool input schema",
      { tools: [{ name: "tool", input_schema: { type: "array" } }] },
    ],
    [
      "non-array required schema properties",
      {
        tools: [
          {
            name: "tool",
            input_schema: { type: "object", required: "value" },
          },
        ],
      },
    ],
    [
      "an unsupported user-location type",
      {
        tools: [
          {
            name: "web_search",
            type: "web_search_20250305",
            user_location: { type: "exact" },
          },
        ],
      },
    ],
    [
      "non-array context-management edits",
      { contextManagement: { edits: {} } },
    ],
    ["an unknown tool choice", { toolChoice: { type: "unknown" } }],
  ])("rejects %s through the public builder", async (_name, overrides) => {
    await expectInvalidInput(overrides);
  });
});
