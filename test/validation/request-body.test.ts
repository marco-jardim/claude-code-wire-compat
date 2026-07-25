// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

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

function build(
  input: unknown = BASE_INPUT,
  resolvedModel: unknown = RESOLVED_MODEL,
  systemBlocks: unknown = [],
  metadata: unknown = {},
  profile?: Parameters<typeof buildCanonicalBody>[4],
): Readonly<Record<string, unknown>> {
  return buildCanonicalBody(
    input,
    resolvedModel,
    systemBlocks,
    metadata,
    profile,
  );
}

function expectCode(code: string, operation: () => unknown): void {
  expect(operation).toThrow(expect.objectContaining({ code }));
}

function changingTypeBlock(
  dispatchedType: "tool_use" | "tool_result",
): Record<string, unknown> {
  let reads = 0;
  const target: Record<string, unknown> =
    dispatchedType === "tool_use"
      ? { type: dispatchedType, id: "id", name: "tool", input: {} }
      : { type: dispatchedType, tool_use_id: "id", content: "result" };
  return new Proxy(target, {
    get(current, property, receiver): unknown {
      if (property === "type") {
        reads += 1;
        const dispatchRead = dispatchedType === "tool_use" ? 2 : 3;
        return reads <= dispatchRead ? dispatchedType : "wrong";
      }
      return Reflect.get(current, property, receiver);
    },
  });
}

describe("buildCanonicalBody structural validation", () => {
  it("accepts a valid surrogate pair exactly", () => {
    expect(
      build({ ...BASE_INPUT, messages: [{ role: "user", content: "😀" }] })[
        "messages"
      ],
    ).toEqual([{ role: "user", content: "😀" }]);
  });

  it.each(["\ud800", "\udc00"])("rejects an unpaired surrogate %j", (text) => {
    expectCode("INVALID_UNICODE", () =>
      build({ ...BASE_INPUT, messages: [{ role: "user", content: text }] }),
    );
  });

  it("rejects a forbidden control character", () => {
    expectCode("INVALID_INPUT", () =>
      build({
        ...BASE_INPUT,
        messages: [{ role: "user", content: "invalid\u0001text" }],
      }),
    );
  });

  it.each([null, 1n, Symbol("invalid")])(
    "rejects a non-object/non-JSON input value",
    (input) => {
      expectCode("INVALID_INPUT", () => build(input));
    },
  );

  it("rejects undefined as a raw input", () => {
    expectCode("INVALID_INPUT", () =>
      buildCanonicalBody(undefined, RESOLVED_MODEL, [], {}),
    );
  });

  it("rejects MAX_ITEMS overflow", () => {
    const values = Array.from({ length: 100_001 }, () => ({}));
    expectCode("INPUT_TOO_LARGE", () => build({ ...BASE_INPUT, values }));
  });

  it("rejects MAX_SIZE overflow from an array", () => {
    expectCode("INPUT_TOO_LARGE", () =>
      build({ ...BASE_INPUT, values: new Array(1_000_001) }),
    );
  });

  it("rejects a sparse array", () => {
    expectCode("INVALID_INPUT", () =>
      build({ ...BASE_INPUT, messages: new Array(1) }),
    );
  });

  it("rejects an object with a foreign prototype", () => {
    const hostile: Record<string, unknown> = { value: "x" };
    Object.setPrototypeOf(hostile, { polluted: true });
    expectCode("INVALID_INPUT", () => build({ ...BASE_INPUT, hostile }));
  });

  it("rejects an accessor property", () => {
    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, "value", { get: () => "x" });
    expectCode("INVALID_INPUT", () => build({ ...BASE_INPUT, hostile }));
  });

  it("rejects symbol and forbidden object keys", () => {
    const symbolKey: Record<PropertyKey, unknown> = { safe: true };
    symbolKey[Symbol("unsafe")] = true;
    expectCode("INVALID_INPUT", () => build({ ...BASE_INPUT, symbolKey }));
    expectCode("INVALID_INPUT", () =>
      build({ ...BASE_INPUT, polluted: { constructor: "bad" } }),
    );
  });
});

describe("buildCanonicalBody field validation", () => {
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid maxTokens %s",
    (maxTokens) => {
      expectCode("INVALID_INPUT", () => build({ ...BASE_INPUT, maxTokens }));
    },
  );

  it.each([
    ["bad type", { type: "persistent" }],
    ["bad ttl", { type: "ephemeral", ttl: "forever" }],
    ["bad scope", { type: "ephemeral", scope: "local" }],
  ] as const)("rejects cache_control with %s", (_name, cache_control) => {
    expectCode("INVALID_INPUT", () =>
      build({
        ...BASE_INPUT,
        tools: [{ name: "tool", input_schema: {}, cache_control }],
      }),
    );
  });

  it("rejects wrong text, tool_use, and tool_result block types", () => {
    expectCode("INVALID_INPUT", () =>
      build([], RESOLVED_MODEL, [{ type: "wrong", text: "x" }]),
    );
    expectCode("INVALID_INPUT", () =>
      build({
        ...BASE_INPUT,
        messages: [
          { role: "assistant", content: [changingTypeBlock("tool_use")] },
        ],
      }),
    );
    expectCode("INVALID_INPUT", () =>
      build({
        ...BASE_INPUT,
        messages: [
          { role: "user", content: [changingTypeBlock("tool_result")] },
        ],
      }),
    );
  });

  it("canonicalizes tool results with string and array content", () => {
    expect(
      build({
        ...BASE_INPUT,
        messages: [
          {
            role: "assistant",
            content: [
              { type: "tool_use", id: "one", name: "tool", input: {} },
              { type: "tool_use", id: "two", name: "tool", input: {} },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "one",
                content: "string result",
                is_error: false,
              },
              {
                type: "tool_result",
                tool_use_id: "two",
                content: [{ type: "text", text: "array result" }],
                is_error: true,
              },
            ],
          },
        ],
      })["messages"],
    ).toEqual([
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "one", name: "tool", input: {} },
          { type: "tool_use", id: "two", name: "tool", input: {} },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "one",
            content: "string result",
            is_error: false,
          },
          {
            type: "tool_result",
            tool_use_id: "two",
            content: [{ type: "text", text: "array result" }],
            is_error: true,
          },
        ],
      },
    ]);
  });

  it("rejects a non-boolean tool-result is_error", () => {
    expectCode("INVALID_INPUT", () =>
      build({
        ...BASE_INPUT,
        messages: [
          {
            role: "assistant",
            content: [{ type: "tool_use", id: "id", name: "tool", input: {} }],
          },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "id",
                content: "x",
                is_error: "false",
              },
            ],
          },
        ],
      }),
    );
  });

  it.each([
    ["non-array messages", "message"],
    ["invalid role", [{ role: "system", content: "x" }]],
    ["non-array content", [{ role: "user", content: 1 }]],
    [
      "unknown content block",
      [{ role: "user", content: [{ type: "image", source: "x" }] }],
    ],
    ["non-record message", [null]],
  ] as const)("rejects %s", (_name, messages) => {
    expectCode("INVALID_INPUT", () => build({ ...BASE_INPUT, messages }));
  });

  it("rejects an unmatched tool result", () => {
    expectCode("INVALID_INPUT", () =>
      build({
        ...BASE_INPUT,
        messages: [
          {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "missing", content: "x" },
            ],
          },
        ],
      }),
    );
  });

  it("rejects duplicate tool names", () => {
    expectCode("INVALID_INPUT", () =>
      build({
        ...BASE_INPUT,
        tools: [
          { name: "duplicate", input_schema: {} },
          { name: "duplicate", input_schema: {} },
        ],
      }),
    );
  });

  it("canonicalizes string/block systems and tools with/without caching", () => {
    const result = build(
      {
        ...BASE_INPUT,
        tools: [
          { name: "plain", input_schema: { z: 1, a: [true, null] } },
          {
            name: "cached",
            description: "cached tool",
            input_schema: {},
            cache_control: {
              type: "ephemeral",
              ttl: "1h",
              scope: "global",
            },
          },
        ],
      },
      RESOLVED_MODEL,
      [
        "plain system",
        {
          type: "text",
          text: "cached system",
          cache_control: { type: "ephemeral" },
        },
      ],
    );
    expect(result["system"]).toEqual([
      { type: "text", text: "plain system" },
      {
        type: "text",
        text: "cached system",
        cache_control: { type: "ephemeral" },
      },
    ]);
    expect(result["tools"]).toEqual([
      { name: "plain", input_schema: { a: [true, null], z: 1 } },
      {
        name: "cached",
        description: "cached tool",
        input_schema: {},
        cache_control: { type: "ephemeral", ttl: "1h", scope: "global" },
      },
    ]);
  });

  it("rejects a non-string metadata user_id", () => {
    expectCode("INVALID_INPUT", () =>
      build(BASE_INPUT, RESOLVED_MODEL, [], { user_id: 1 }),
    );
  });

  it("rejects malformed model resolutions", () => {
    expectCode("INVALID_INPUT", () => build(BASE_INPUT, null));
    expectCode("INVALID_INPUT", () =>
      build(BASE_INPUT, {
        id: MODEL_ID,
        capabilities: {
          contextHint: true,
          adaptiveThinking: true,
          effort: "yes",
        },
      }),
    );
  });

  it("emits context_hint only through the fully enabled path", () => {
    expect(
      build(
        { ...BASE_INPUT, capabilities: { contextHint: true } },
        RESOLVED_MODEL,
        [],
        {},
        CLAUDE_CODE_2_1_195_PROFILE,
      )["context_hint"],
    ).toEqual({ enabled: true });
  });

  it("rejects a model mismatch", () => {
    expectCode("UNSUPPORTED_MODEL", () =>
      build({ ...BASE_INPUT, model: "claude-synthetic-mismatch" }),
    );
  });

  it("rejects a non-string value routed through requireString", () => {
    const input: unknown = {
      ...BASE_INPUT,
      tools: [{ name: 1, input_schema: {} }],
    };
    expectCode("INVALID_INPUT", () => build(input));
  });

  it("rejects a non-text block in a tool-result content array", () => {
    const input: unknown = {
      ...BASE_INPUT,
      messages: [
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "id", name: "tool", input: {} }],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "id",
              content: [{ type: "image", text: "not text" }],
            },
          ],
        },
      ],
    };
    expectCode("INVALID_INPUT", () => build(input));
  });

  it("rejects a tool-use block whose type changes after dispatch", () => {
    const input: unknown = {
      ...BASE_INPUT,
      messages: [
        { role: "assistant", content: [changingTypeBlock("tool_use")] },
      ],
    };
    expectCode("INVALID_INPUT", () => build(input));
  });

  it("rejects a tool-result block whose type changes after dispatch", () => {
    const input: unknown = {
      ...BASE_INPUT,
      messages: [{ role: "user", content: [changingTypeBlock("tool_result")] }],
    };
    expectCode("INVALID_INPUT", () => build(input));
  });

  it("rejects a non-array system value", () => {
    const systemBlocks: unknown = {};
    expectCode("INVALID_INPUT", () =>
      build(BASE_INPUT, RESOLVED_MODEL, systemBlocks),
    );
  });

  it("rejects a non-array tools value", () => {
    const input: unknown = { ...BASE_INPUT, tools: {} };
    expectCode("INVALID_INPUT", () => build(input));
  });
});

describe("buildCanonicalBody thinking validation", () => {
  it("rejects an invalid thinking type", () => {
    expectCode("INVALID_THINKING", () =>
      build({ ...BASE_INPUT, thinking: { type: "automatic" } }),
    );
  });

  it("rejects adaptive thinking when unsupported", () => {
    expectCode("INVALID_THINKING", () =>
      build(
        { ...BASE_INPUT, thinking: { type: "adaptive" } },
        {
          id: MODEL_ID,
          capabilities: {
            contextHint: true,
            adaptiveThinking: false,
            effort: true,
          },
        },
      ),
    );
  });

  it("rejects missing and forbidden thinking budgets", () => {
    expectCode("INVALID_THINKING", () =>
      build({ ...BASE_INPUT, thinking: { type: "enabled" } }),
    );
    expectCode("INVALID_THINKING", () =>
      build({
        ...BASE_INPUT,
        thinking: { type: "adaptive", budgetTokens: 1024 },
      }),
    );
  });

  it("accepts the max effort boundary with adaptive thinking", () => {
    const result = build({
      ...BASE_INPUT,
      thinking: { type: "adaptive" },
      effort: "max",
    });
    expect(result["thinking"]).toEqual({ type: "adaptive" });
    expect(result["output_config"]).toEqual({ effort: "max" });
  });

  it("canonicalizes enabled thinking with a positive budget", () => {
    const result = build({
      ...BASE_INPUT,
      thinking: { type: "enabled", budgetTokens: 1024 },
    });
    expect(result["thinking"]).toEqual({
      type: "enabled",
      budget_tokens: 1024,
    });
    expect(result).not.toHaveProperty("temperature");
  });

  it("rejects effort beyond the max boundary", () => {
    expectCode("INVALID_EFFORT", () =>
      build({ ...BASE_INPUT, effort: "maximum" }),
    );
  });
});
