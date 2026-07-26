// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
} from "../../src/index.js";

const MODEL_ID = "claude-opus-4-8";
const BASE_INPUT = {
  model: MODEL_ID,
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello" }],
};

async function build(
  input: unknown,
): Promise<Readonly<Record<string, unknown>>> {
  const result = await buildClaudeCodeRequest(
    {
      accessToken: "test-token",
      runtime: {
        sessionId: "session-1",
        deviceId: "device-1",
        accountUuid: "account-1",
        runtime: "node",
        runtimeVersion: "22.0.0",
        os: "Linux",
        arch: "x64",
      },
      clientRequestId: "unknown-nested-properties-1",
      ...(input as ClaudeCodeRequestInput),
    },
    CLAUDE_CODE_2_1_195_PROFILE,
  );

  return JSON.parse(result.body) as Readonly<Record<string, unknown>>;
}

async function expectInvalid(input: unknown): Promise<void> {
  await expect(build(input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
}

function inputWithBlock(block: Record<PropertyKey, unknown>): unknown {
  if (block["type"] === "tool_result" || block["type"] === "tool_reference") {
    const resultBlock =
      block["type"] === "tool_result"
        ? block
        : { type: "tool_result", tool_use_id: "call", content: [block] };
    return {
      ...BASE_INPUT,
      messages: [
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "call", name: "tool", input: {} }],
        },
        { role: "user", content: [resultBlock] },
      ],
    };
  }
  return {
    ...BASE_INPUT,
    messages: [{ role: "assistant", content: [block] }],
  };
}

function inputWithTool(tool: Record<string, unknown>): unknown {
  return { ...BASE_INPUT, tools: [tool] };
}

const CLOSED_CONTENT_BLOCKS = [
  ["text", { type: "text", text: "text", unexpected: true }],
  [
    "tool use",
    {
      type: "tool_use",
      id: "call",
      name: "tool",
      input: {},
      unexpected: true,
    },
  ],
  [
    "tool result",
    {
      type: "tool_result",
      tool_use_id: "call",
      content: "done",
      unexpected: true,
    },
  ],
  [
    "thinking",
    {
      type: "thinking",
      signature: "sig",
      thinking: "thought",
      unexpected: true,
    },
  ],
  [
    "redacted thinking",
    { type: "redacted_thinking", data: "data", unexpected: true },
  ],
  [
    "image",
    {
      type: "image",
      source: { type: "url", url: "https://example.com/image.png" },
      unexpected: true,
    },
  ],
  [
    "document",
    {
      type: "document",
      source: { type: "text", media_type: "text/plain", data: "document" },
      unexpected: true,
    },
  ],
  [
    "search result",
    {
      type: "search_result",
      content: [{ type: "text", text: "result" }],
      source: "https://example.com",
      title: "result",
      unexpected: true,
    },
  ],
  [
    "tool reference",
    { type: "tool_reference", tool_name: "tool", unexpected: true },
  ],
] as const;

const SOURCE_CASES = [
  [
    "base64 image",
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: "AA==",
        unexpected: true,
      },
    },
  ],
  [
    "file image",
    {
      type: "image",
      source: { type: "file", file_id: "file", unexpected: true },
    },
  ],
  [
    "URL image",
    {
      type: "image",
      source: {
        type: "url",
        url: "https://example.com/image.png",
        unexpected: true,
      },
    },
  ],
  [
    "base64 PDF",
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: "AA==",
        unexpected: true,
      },
    },
  ],
  [
    "content document",
    {
      type: "document",
      source: { type: "content", content: "document", unexpected: true },
    },
  ],
  [
    "file document",
    {
      type: "document",
      source: { type: "file", file_id: "file", unexpected: true },
    },
  ],
  [
    "plain text document",
    {
      type: "document",
      source: {
        type: "text",
        media_type: "text/plain",
        data: "document",
        unexpected: true,
      },
    },
  ],
  [
    "URL PDF",
    {
      type: "document",
      source: {
        type: "url",
        url: "https://example.com/document.pdf",
        unexpected: true,
      },
    },
  ],
] as const;

const CITATIONS = [
  {
    type: "char_location",
    cited_text: "text",
    document_index: 0,
    document_title: null,
    end_char_index: 4,
    start_char_index: 0,
  },
  {
    type: "content_block_location",
    cited_text: "text",
    document_index: 0,
    document_title: null,
    end_block_index: 1,
    start_block_index: 0,
  },
  {
    type: "page_location",
    cited_text: "text",
    document_index: 0,
    document_title: null,
    end_page_number: 2,
    start_page_number: 1,
  },
  {
    type: "search_result_location",
    cited_text: "text",
    end_block_index: 1,
    search_result_index: 0,
    source: "https://example.com",
    start_block_index: 0,
    title: null,
  },
  {
    type: "web_search_result_location",
    cited_text: "text",
    encrypted_index: "index",
    title: null,
    url: "https://example.com",
  },
] as const;

const TOOLS = [
  ["custom", { name: "custom", input_schema: {} }],
  ["bash 20241022", { name: "bash", type: "bash_20241022" }],
  ["bash 20250124", { name: "bash", type: "bash_20250124" }],
  [
    "code execution 20250522",
    { name: "code_execution", type: "code_execution_20250522" },
  ],
  [
    "code execution 20250825",
    { name: "code_execution", type: "code_execution_20250825" },
  ],
  [
    "code execution 20260120",
    { name: "code_execution", type: "code_execution_20260120" },
  ],
  [
    "computer 20241022",
    {
      display_height_px: 768,
      display_width_px: 1024,
      name: "computer",
      type: "computer_20241022",
    },
  ],
  [
    "computer 20250124",
    {
      display_height_px: 768,
      display_width_px: 1024,
      name: "computer",
      type: "computer_20250124",
    },
  ],
  [
    "computer 20251124",
    {
      display_height_px: 768,
      display_width_px: 1024,
      name: "computer",
      type: "computer_20251124",
    },
  ],
  ["memory", { name: "memory", type: "memory_20250818" }],
  [
    "text editor 20241022",
    { name: "str_replace_editor", type: "text_editor_20241022" },
  ],
  [
    "text editor 20250124",
    { name: "str_replace_editor", type: "text_editor_20250124" },
  ],
  [
    "text editor 20250429",
    {
      name: "str_replace_based_edit_tool",
      type: "text_editor_20250429",
    },
  ],
  [
    "text editor 20250728",
    {
      name: "str_replace_based_edit_tool",
      type: "text_editor_20250728",
    },
  ],
  ["web search 20250305", { name: "web_search", type: "web_search_20250305" }],
  ["web search 20260209", { name: "web_search", type: "web_search_20260209" }],
  ["web fetch 20250910", { name: "web_fetch", type: "web_fetch_20250910" }],
  ["web fetch 20260209", { name: "web_fetch", type: "web_fetch_20260209" }],
  ["web fetch 20260309", { name: "web_fetch", type: "web_fetch_20260309" }],
  [
    "advisor",
    {
      model: MODEL_ID,
      name: "advisor",
      type: "advisor_20260301",
    },
  ],
  [
    "tool search BM25 20251119",
    {
      name: "tool_search_tool_bm25",
      type: "tool_search_tool_bm25_20251119",
    },
  ],
  [
    "tool search BM25",
    { name: "tool_search_tool_bm25", type: "tool_search_tool_bm25" },
  ],
  [
    "tool search regex 20251119",
    {
      name: "tool_search_tool_regex",
      type: "tool_search_tool_regex_20251119",
    },
  ],
  [
    "tool search regex",
    { name: "tool_search_tool_regex", type: "tool_search_tool_regex" },
  ],
  ["MCP toolset", { mcp_server_name: "local", type: "mcp_toolset" }],
] as const;

describe("unknown nested properties", () => {
  it("rejects an unknown message property", async () => {
    await expectInvalid({
      ...BASE_INPUT,
      messages: [{ role: "user", content: "hello", unexpected: true }],
    });
  });

  it.each(CLOSED_CONTENT_BLOCKS)(
    "rejects one on a %s block",
    async (_name, block) => {
      await expectInvalid(inputWithBlock(block));
    },
  );

  it.each(SOURCE_CASES)("rejects one on a %s source", async (_name, block) => {
    await expectInvalid(inputWithBlock(block));
  });

  it.each([
    [
      "cache control",
      {
        type: "image",
        source: { type: "url", url: "https://example.com/image.png" },
        cache_control: { type: "ephemeral", unexpected: true },
      },
    ],
    [
      "legacy text cache control",
      {
        type: "text",
        text: "text",
        cache_control: {
          type: "ephemeral",
          scope: "global",
          unexpected: true,
        },
      },
    ],
    [
      "citations config",
      {
        type: "document",
        source: { type: "text", media_type: "text/plain", data: "document" },
        citations: { enabled: true, unexpected: true },
      },
    ],
  ] as const)("rejects one on %s", async (_name, block) => {
    await expectInvalid(inputWithBlock(block));
  });

  it.each([
    ["direct", { type: "direct", unexpected: true }],
    [
      "server 20250825",
      { type: "code_execution_20250825", tool_id: "server", unexpected: true },
    ],
    [
      "server 20260120",
      { type: "code_execution_20260120", tool_id: "server", unexpected: true },
    ],
  ] as const)("rejects one on a %s caller", async (_name, caller) => {
    await expectInvalid(
      inputWithBlock({
        type: "tool_use",
        id: "call",
        name: "tool",
        input: {},
        caller,
      }),
    );
  });

  it.each(CITATIONS)("rejects one on citation $type", async (citation) => {
    await expectInvalid(
      inputWithBlock({
        type: "text",
        text: "text",
        citations: [{ ...citation, unexpected: true }],
      }),
    );
  });

  it.each(TOOLS)("rejects one on the %s tool", async (_name, tool) => {
    await expectInvalid(inputWithTool({ ...tool, unexpected: true }));
  });

  it("rejects one on web-search user_location", async () => {
    await expectInvalid(
      inputWithTool({
        name: "web_search",
        type: "web_search_20260209",
        user_location: { type: "approximate", unexpected: true },
      }),
    );
  });

  it.each(["configs", "default_config"] as const)(
    "rejects one on an MCP %s value",
    async (field) => {
      const config = { enabled: true, unexpected: true };
      await expectInvalid(
        inputWithTool({
          mcp_server_name: "local",
          type: "mcp_toolset",
          [field]: field === "configs" ? { tool: config } : config,
        }),
      );
    },
  );

  it.each([
    ["context config", { contextManagement: { edits: [], unexpected: true } }],
    [
      "clear-thinking edit",
      {
        contextManagement: {
          edits: [
            { type: "clear_thinking_20251015", keep: "all", unexpected: true },
          ],
        },
      },
    ],
    [
      "clear-tool-uses edit",
      {
        contextManagement: {
          edits: [{ type: "clear_tool_uses_20250919", unexpected: true }],
        },
      },
    ],
    [
      "compact edit",
      {
        contextManagement: {
          edits: [{ type: "compact_20260112", unexpected: true }],
        },
      },
    ],
    [
      "all-thinking keep",
      {
        contextManagement: {
          edits: [
            {
              type: "clear_thinking_20251015",
              keep: { type: "all", unexpected: true },
            },
          ],
        },
      },
    ],
    [
      "thinking-turns keep",
      {
        contextManagement: {
          edits: [
            {
              type: "clear_thinking_20251015",
              keep: { type: "thinking_turns", value: 1, unexpected: true },
            },
          ],
        },
      },
    ],
    [
      "input-token clear_at_least",
      {
        contextManagement: {
          edits: [
            {
              type: "clear_tool_uses_20250919",
              clear_at_least: {
                type: "input_tokens",
                value: 1,
                unexpected: true,
              },
            },
          ],
        },
      },
    ],
    [
      "tool-use keep",
      {
        contextManagement: {
          edits: [
            {
              type: "clear_tool_uses_20250919",
              keep: { type: "tool_uses", value: 1, unexpected: true },
            },
          ],
        },
      },
    ],
    [
      "tool-use trigger",
      {
        contextManagement: {
          edits: [
            {
              type: "clear_tool_uses_20250919",
              trigger: { type: "tool_uses", value: 1, unexpected: true },
            },
          ],
        },
      },
    ],
    [
      "compact input-token trigger",
      {
        contextManagement: {
          edits: [
            {
              type: "compact_20260112",
              trigger: { type: "input_tokens", value: 1, unexpected: true },
            },
          ],
        },
      },
    ],
    ["output config", { outputConfig: { unexpected: true } }],
    [
      "JSON output format",
      {
        outputFormat: {
          schema: { type: "object" },
          type: "json_schema",
          unexpected: true,
        },
      },
    ],
    ["auto tool choice", { toolChoice: { type: "auto", unexpected: true } }],
    ["any tool choice", { toolChoice: { type: "any", unexpected: true } }],
    ["none tool choice", { toolChoice: { type: "none", unexpected: true } }],
    [
      "named tool choice",
      { toolChoice: { name: "tool", type: "tool", unexpected: true } },
    ],
  ] as const)("rejects one on the %s", async (_name, fields) => {
    await expectInvalid({ ...BASE_INPUT, ...fields });
  });

  it("rejects an unknown property whose value is undefined", async () => {
    await expectInvalid({
      ...BASE_INPUT,
      messages: [{ role: "user", content: "hello", unexpected: undefined }],
    });
  });

  it("rejects a symbol property", async () => {
    const message: Record<PropertyKey, unknown> = {
      role: "user",
      content: "hello",
    };
    message[Symbol("unexpected")] = true;
    await expectInvalid({ ...BASE_INPUT, messages: [message] });
  });
});

describe("open JSON extension envelopes", () => {
  it("retains safe arbitrary schema keys in insertion order", async () => {
    const schema = {
      zExtension: { enabled: true },
      type: "object",
      aExtension: ["first", "second"],
    };
    const result = await build(
      inputWithTool({ name: "custom", input_schema: schema }),
    );
    const tool = (result["tools"] as readonly Record<string, unknown>[])[0];
    expect(tool?.["input_schema"]).toEqual(schema);
    expect(Object.keys(tool?.["input_schema"] as object)).toEqual([
      "zExtension",
      "type",
      "aExtension",
    ]);
  });

  it("allows future body names only inside the experimental envelope", async () => {
    await expectInvalid({
      ...BASE_INPUT,
      future_nested_property: { enabled: true },
    });
    expect(
      await build({
        ...BASE_INPUT,
        experimentalBodyFields: {
          future_nested_property: { enabled: true },
        },
      }),
    ).toHaveProperty("future_nested_property", { enabled: true });
  });
});
