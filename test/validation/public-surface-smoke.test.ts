// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../../src/index.js";

const base = {
  accessToken: "sentinel-token-public-surface-91f2",
  model: "claude-opus-4-6",
  maxTokens: 1024,
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
};
const userText = [
  { role: "user", content: [{ type: "text", text: "hi" }] },
] as const;

function parseBody(body: string): Readonly<Record<string, unknown>> {
  return JSON.parse(body) as Readonly<Record<string, unknown>>;
}

describe("expanded public contract surface", () => {
  it("accepts baseline text", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      messages: userText,
    });

    expect(parseBody(result.body)).toMatchObject({ messages: userText });
  });

  it("accepts a thinking block", async () => {
    const messages = [
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "t", signature: "s" }],
      },
      ...userText,
    ] as const;
    const result = await buildClaudeCodeRequest({ ...base, messages });

    expect(parseBody(result.body)).toMatchObject({ messages });
  });

  it("accepts a redacted_thinking block", async () => {
    const messages = [
      {
        role: "assistant",
        content: [{ type: "redacted_thinking", data: "d" }],
      },
      ...userText,
    ] as const;
    const result = await buildClaudeCodeRequest({ ...base, messages });

    expect(parseBody(result.body)).toMatchObject({ messages });
  });

  it("accepts an image block", async () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "iVBOR",
            },
          },
        ],
      },
    ] as const;
    const result = await buildClaudeCodeRequest({ ...base, messages });

    expect(parseBody(result.body)).toMatchObject({ messages });
  });

  it("accepts a document block", async () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: "x",
            },
          },
        ],
      },
    ] as const;
    const result = await buildClaudeCodeRequest({ ...base, messages });

    expect(parseBody(result.body)).toMatchObject({ messages });
  });

  it("preserves cache_control on a tool_result block", async () => {
    const messages = [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "tu1", name: "n", input: {} }],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu1",
            content: "ok",
            cache_control: { type: "ephemeral", ttl: "1h" },
          },
        ],
      },
    ] as const;
    const result = await buildClaudeCodeRequest({ ...base, messages });

    expect(parseBody(result.body)).toMatchObject({ messages });
  });

  it("preserves cache_control and defer_loading on a tool", async () => {
    const tools = [
      {
        name: "t",
        input_schema: { type: "object" },
        cache_control: { type: "ephemeral", ttl: "1h" },
        defer_loading: true,
      },
    ] as const;
    const result = await buildClaudeCodeRequest({
      ...base,
      messages: userText,
      tools,
    });

    expect(parseBody(result.body)).toMatchObject({ tools });
  });

  it("accepts a server tool", async () => {
    const tools = [{ type: "bash_20250124", name: "bash" }] as const;
    const result = await buildClaudeCodeRequest({
      ...base,
      messages: userText,
      tools,
    });

    expect(parseBody(result.body)).toMatchObject({ tools });
  });

  it("preserves contextManagement", async () => {
    const contextManagement = {
      edits: [{ type: "clear_thinking_20251015", keep: "all" }],
    } as const;
    const result = await buildClaudeCodeRequest({
      ...base,
      messages: userText,
      contextManagement,
    });

    expect(parseBody(result.body)["context_management"]).toEqual(
      contextManagement,
    );
  });

  it("preserves toolChoice and topP", async () => {
    const toolChoice = { type: "auto" } as const;
    const result = await buildClaudeCodeRequest({
      ...base,
      messages: userText,
      toolChoice,
      topP: 0.9,
    });

    expect(parseBody(result.body)).toMatchObject({
      tool_choice: toolChoice,
      top_p: 0.9,
    });
  });

  it("preserves experimentalBodyFields", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      messages: userText,
      experimentalBodyFields: { some_new_beta_field: { a: 1 } },
    });

    expect(parseBody(result.body)["some_new_beta_field"]).toEqual({ a: 1 });
  });

  it("preserves extraHeaders", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      messages: userText,
      extraHeaders: [["x-cc-atis", "abc"]],
    });

    expect(result.headers).toContainEqual(["x-cc-atis", "abc"]);
  });

  it("rejects an unknown property on a message object", async () => {
    const messages = [
      { role: "user" as const, content: "hi", unexpected: true },
    ];

    await expect(
      buildClaudeCodeRequest({ ...base, messages }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects an unknown property on a text block", async () => {
    const messages = [
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: "hi", unexpected: true }],
      },
    ];

    await expect(
      buildClaudeCodeRequest({ ...base, messages }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("preserves input_schema insertion order", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      messages: userText,
      tools: [
        {
          name: "t",
          input_schema: { type: "object", zeta: 1, alpha: 2 },
        },
      ],
    });
    const tools = parseBody(result.body)["tools"];
    if (!Array.isArray(tools)) throw new TypeError("Expected tools array.");
    const tool: unknown = tools[0];
    if (typeof tool !== "object" || tool === null || Array.isArray(tool)) {
      throw new TypeError("Expected tool object.");
    }
    const inputSchema: unknown = Object.fromEntries(Object.entries(tool))[
      "input_schema"
    ];
    if (
      typeof inputSchema !== "object" ||
      inputSchema === null ||
      Array.isArray(inputSchema)
    ) {
      throw new TypeError("Expected input_schema object.");
    }

    expect(Object.keys(inputSchema)).toEqual(["type", "zeta", "alpha"]);
  });
});
