import { describe, expect, it } from "vitest";

import type { ToolDefinition } from "../../src/contracts.js";
import { buildCanonicalBody } from "../../src/request-body.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";

const MODEL_ID = "claude-opus-4-8";
const MODEL_DEFINITION = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[MODEL_ID];
if (MODEL_DEFINITION === undefined)
  throw new Error("Missing test model profile.");
const RESOLVED_MODEL = { id: MODEL_ID, ...MODEL_DEFINITION };
const BASE_INPUT = {
  model: MODEL_ID,
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello" }],
};

function build(input: unknown): Readonly<Record<string, unknown>> {
  return buildCanonicalBody(input, RESOLVED_MODEL, [], {});
}

function buildTool(tool: unknown): unknown {
  return (build({ ...BASE_INPUT, tools: [tool] })["tools"] as unknown[])[0];
}

function expectInvalid(tool: unknown): void {
  expect(() => buildTool(tool)).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
}

const TYPED_CUSTOM_TOOL: ToolDefinition = {
  name: "typed",
  input_schema: { type: "object" },
  cache_control: { type: "ephemeral", ttl: "5m" },
};

const BUILT_INS = [
  { name: "bash", type: "bash_20241022" },
  { name: "bash", type: "bash_20250124" },
  { name: "code_execution", type: "code_execution_20250522" },
  { name: "code_execution", type: "code_execution_20250825" },
  { name: "code_execution", type: "code_execution_20260120" },
  {
    display_height_px: 768,
    display_width_px: 1024,
    name: "computer",
    type: "computer_20241022",
  },
  {
    display_height_px: 768,
    display_width_px: 1024,
    name: "computer",
    type: "computer_20250124",
  },
  {
    display_height_px: 768,
    display_width_px: 1024,
    name: "computer",
    type: "computer_20251124",
  },
  { name: "memory", type: "memory_20250818" },
  { name: "str_replace_editor", type: "text_editor_20241022" },
  { name: "str_replace_editor", type: "text_editor_20250124" },
  {
    name: "str_replace_based_edit_tool",
    type: "text_editor_20250429",
  },
  {
    name: "str_replace_based_edit_tool",
    type: "text_editor_20250728",
  },
  { name: "web_search", type: "web_search_20250305" },
  { name: "web_search", type: "web_search_20260209" },
  { name: "web_fetch", type: "web_fetch_20250910" },
  { name: "web_fetch", type: "web_fetch_20260209" },
  { name: "web_fetch", type: "web_fetch_20260309" },
  { model: "claude-opus-4-8", name: "advisor", type: "advisor_20260301" },
  {
    name: "tool_search_tool_bm25",
    type: "tool_search_tool_bm25_20251119",
  },
  { name: "tool_search_tool_bm25", type: "tool_search_tool_bm25" },
  {
    name: "tool_search_tool_regex",
    type: "tool_search_tool_regex_20251119",
  },
  { name: "tool_search_tool_regex", type: "tool_search_tool_regex" },
  { mcp_server_name: "local", type: "mcp_toolset" },
] as const;

describe("cache_control contract expansion", () => {
  it("retains cache_control on tool results", () => {
    const messages = build({
      ...BASE_INPUT,
      messages: [
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "one", name: "tool", input: {} }],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "one",
              cache_control: { type: "ephemeral", ttl: "5m" },
            },
          ],
        },
      ],
    })["messages"];
    expect(messages).toEqual([
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "one", name: "tool", input: {} }],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "one",
            cache_control: { type: "ephemeral", ttl: "5m" },
          },
        ],
      },
    ]);
  });

  it("type-checks and retains custom tool cache_control", () => {
    expect(buildTool(TYPED_CUSTOM_TOOL)).toEqual(TYPED_CUSTOM_TOOL);
  });

  it("preserves explicit null and distinguishes absent cache_control", () => {
    expect(
      buildTool({
        name: "custom",
        input_schema: { type: "object" },
        cache_control: null,
      }),
    ).toHaveProperty("cache_control", null);
    expect(
      buildTool({ name: "custom", input_schema: { type: "object" } }),
    ).not.toHaveProperty("cache_control");

    const messages = build({
      ...BASE_INPUT,
      messages: [
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "one", name: "tool", input: {} }],
        },
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "one", cache_control: null },
          ],
        },
      ],
    })["messages"] as { content: unknown[] }[];
    expect(messages[1]?.content[0]).toHaveProperty("cache_control", null);
  });

  it.each([
    { type: "persistent" },
    { type: "ephemeral", ttl: "forever" },
    { type: "ephemeral", unknown: true },
  ])("rejects invalid cache control %#", (cache_control) => {
    expectInvalid({
      name: "custom",
      input_schema: { type: "object" },
      cache_control,
    });
  });

  it("rejects scope on SDK-derived tool cache control", () => {
    expectInvalid({
      name: "bash",
      type: "bash_20241022",
      cache_control: { type: "ephemeral", scope: "global" },
    });
  });
});

describe("tool definition union", () => {
  it("retains all custom tool fields", () => {
    const tool: ToolDefinition = {
      name: "custom",
      input_schema: {
        type: "object",
        properties: { value: { type: "string" } },
      },
      allowed_callers: ["direct", "code_execution_20250825"],
      cache_control: { type: "ephemeral", ttl: "1h" },
      defer_loading: true,
      description: "description",
      eager_input_streaming: null,
      input_examples: [{ value: "example" }],
      strict: true,
    };
    expect(buildTool(tool)).toEqual(tool);
  });

  it.each(BUILT_INS)("accepts $type without input_schema", (tool) => {
    expect(buildTool(tool)).toEqual(tool);
  });

  it("retains built-in cache control and nullable fields", () => {
    const tool = {
      name: "web_search",
      type: "web_search_20250305",
      allowed_domains: null,
      blocked_domains: null,
      cache_control: { type: "ephemeral", ttl: "5m" },
      max_uses: null,
      user_location: null,
    };
    expect(buildTool(tool)).toEqual(tool);
    expect(buildTool(BUILT_INS[13])).not.toHaveProperty("allowed_domains");
  });

  it.each([
    {
      name: "bash",
      type: "bash_20241022",
      allowed_callers: ["code_execution_20260120"],
      cache_control: null,
      defer_loading: true,
      input_examples: [{ command: "pwd" }],
      strict: false,
    },
    {
      display_height_px: 768,
      display_width_px: 1024,
      name: "computer",
      type: "computer_20251124",
      display_number: 1,
      enable_zoom: true,
      input_examples: [{ action: "screenshot" }],
    },
    {
      name: "str_replace_based_edit_tool",
      type: "text_editor_20250728",
      max_characters: 10_000,
    },
    {
      name: "web_search",
      type: "web_search_20260209",
      allowed_domains: ["example.com"],
      blocked_domains: ["blocked.example"],
      max_uses: 3,
      user_location: {
        type: "approximate",
        city: "Lisbon",
        country: null,
        region: "Lisbon",
        timezone: null,
      },
    },
    {
      name: "web_fetch",
      type: "web_fetch_20260309",
      allowed_domains: ["example.com"],
      blocked_domains: null,
      citations: { enabled: true },
      max_content_tokens: 4096,
      max_uses: null,
      use_cache: false,
    },
    {
      model: "claude-opus-4-8",
      name: "advisor",
      type: "advisor_20260301",
      caching: { type: "ephemeral", ttl: "1h" },
      max_uses: 1,
    },
  ])("retains optional fields on $type", (tool) => {
    expect(buildTool(tool)).toEqual(tool);
  });

  it("preserves MCP config insertion order", () => {
    const tool = {
      mcp_server_name: "local",
      type: "mcp_toolset",
      configs: {
        second: { enabled: true },
        first: { defer_loading: false },
      },
      default_config: { defer_loading: true, enabled: false },
    };
    expect(JSON.stringify(buildTool(tool))).toBe(JSON.stringify(tool));
  });

  it.each(BUILT_INS)("rejects input_schema on $type", (tool) => {
    expectInvalid({ ...tool, input_schema: { type: "object" } });
  });

  it("requires input_schema on custom tools and rejects custom type", () => {
    expectInvalid({ name: "custom" });
    expectInvalid({
      name: "custom",
      type: undefined,
      input_schema: { type: "object" },
    });
    expectInvalid({
      name: "custom",
      type: "custom",
      input_schema: { type: "object" },
    });
  });

  it("rejects invalid common fields and unknown properties", () => {
    expectInvalid({ name: "wrong", type: "bash_20241022" });
    expectInvalid({ name: "bash", type: "unknown" });
    expectInvalid({
      name: "bash",
      type: "bash_20241022",
      allowed_callers: ["indirect"],
    });
    expectInvalid({
      name: "bash",
      type: "bash_20241022",
      defer_loading: "yes",
    });
    expectInvalid({ name: "bash", type: "bash_20241022", unknown: true });
  });

  it("rejects invalid MCP configs", () => {
    expectInvalid({
      mcp_server_name: "local",
      type: "mcp_toolset",
      configs: { tool: { enabled: true, unknown: false } },
    });
    expectInvalid({
      mcp_server_name: "local",
      type: "mcp_toolset",
      default_config: { defer_loading: "yes" },
    });
  });
});
