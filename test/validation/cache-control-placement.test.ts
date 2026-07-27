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
} as const;

const textMessages = [
  { role: "user", content: [{ type: "text", text: "hi" }] },
] as const;

function parseBody(body: string): Readonly<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Expected request body object.");
  }
  return Object.fromEntries(Object.entries(parsed));
}

function requireArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError("Expected array.");
  return value;
}

function requireRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected object.");
  }
  return Object.fromEntries(Object.entries(value));
}

function invalidCacheControl(cacheControl: unknown): Promise<unknown> {
  const input = {
    ...base,
    messages: textMessages,
    cacheControl: { enabled: true },
  };
  Object.defineProperty(input, "cacheControl", {
    value: cacheControl,
    enumerable: true,
  });
  return buildClaudeCodeRequest(input);
}

describe("caller-directed cache breakpoint placement", () => {
  it("treats absent and null cacheControl as the current behavior", async () => {
    const absent = await buildClaudeCodeRequest({
      ...base,
      messages: textMessages,
    });
    const explicitNull = await buildClaudeCodeRequest({
      ...base,
      messages: textMessages,
      cacheControl: null,
    });

    expect(explicitNull.body).toBe(absent.body);
    expect(requireArray(parseBody(absent.body)["system"])[1]).toMatchObject({
      cache_control: { type: "ephemeral", ttl: "1h" },
    });
  });

  it("adds no package breakpoint when disabled", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      messages: textMessages,
      cacheControl: { enabled: false },
    });
    const body = parseBody(result.body);
    const system = requireArray(body["system"]);

    // The identity pin is package-owned protocol identity, so disabling
    // caller-directed placement does not suppress it.
    expect(system[1]).toEqual({
      type: "text",
      text: "You are Claude Code, Anthropic's official CLI for Claude.",
      cache_control: { type: "ephemeral" },
    });
    expect(result.body.match(/"cache_control"/gu)).toHaveLength(1);
  });

  it("uses one explicit TTL for selected system, tool, and message breakpoints", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      system: ["static", "dynamic"],
      tools: [
        { name: "first", input_schema: { type: "object" } },
        { name: "last", input_schema: { type: "object" } },
      ],
      messages: textMessages,
      cacheControl: {
        enabled: true,
        ttl: "1h",
        systemBreakpoint: true,
        toolBreakpoint: true,
        messageBreakpoint: true,
      },
    });
    const body = parseBody(result.body);
    const system = requireArray(body["system"]);
    const tools = requireArray(body["tools"]);
    const messages = requireArray(body["messages"]);
    const lastMessage = requireRecord(messages.at(-1));
    const content = requireArray(lastMessage["content"]);
    const marker = { type: "ephemeral", ttl: "1h" };

    expect(system).toHaveLength(3);
    expect(system[1]).toMatchObject({ cache_control: marker });
    expect(system[2]).toMatchObject({
      text: "static\ndynamic",
      cache_control: marker,
    });
    expect(tools[0]).not.toHaveProperty("cache_control");
    expect(tools[1]).toMatchObject({ cache_control: marker });
    expect(content[0]).toMatchObject({ cache_control: marker });
  });

  it("emits no ttl member when ttl is explicitly null", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      system: ["caller"],
      tools: [{ name: "last", input_schema: { type: "object" } }],
      messages: textMessages,
      cacheControl: {
        enabled: true,
        ttl: null,
        systemBreakpoint: true,
        toolBreakpoint: true,
        messageBreakpoint: true,
      },
    });
    const bodyText = result.body;

    expect(
      bodyText.match(/"cache_control":\{"type":"ephemeral"\}/gu),
      // Identity plus selected system, tool, and message markers omit ttl.
    ).toHaveLength(4);
    expect(bodyText).not.toContain('"ttl"');
  });

  it("emits no ttl member when ttl is absent", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      tools: [{ name: "last", input_schema: { type: "object" } }],
      messages: textMessages,
      cacheControl: { enabled: true, toolBreakpoint: true },
    });
    const tools = requireArray(parseBody(result.body)["tools"]);

    expect(tools[0]).toMatchObject({
      cache_control: { type: "ephemeral" },
    });
    expect(JSON.stringify(tools[0])).not.toContain('"ttl"');
  });

  it("strips incoming markers and places the message marker on a final tool_result", async () => {
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "thought", signature: "signature" },
          { type: "tool_use", id: "tool-1", name: "first", input: {} },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "before",
            cache_control: { type: "ephemeral", ttl: "5m" },
          },
          {
            type: "tool_result",
            tool_use_id: "tool-1",
            content: "done",
            cache_control: { type: "ephemeral", ttl: "5m" },
          },
        ],
      },
    ] as const;
    const result = await buildClaudeCodeRequest({
      ...base,
      tools: [
        {
          name: "first",
          input_schema: { type: "object" },
          cache_control: { type: "ephemeral", ttl: "5m" },
        },
        {
          name: "last",
          input_schema: { type: "object" },
          cache_control: { type: "ephemeral", ttl: "5m" },
        },
      ],
      messages,
      cacheControl: {
        enabled: true,
        ttl: "1h",
        messageBreakpoint: true,
      },
    });
    const body = parseBody(result.body);
    const tools = requireArray(body["tools"]);
    const outputMessages = requireArray(body["messages"]);
    const assistantContent = requireArray(
      requireRecord(outputMessages[0])["content"],
    );
    const userContent = requireArray(
      requireRecord(outputMessages[1])["content"],
    );

    expect(
      tools.every(
        (tool) => !Object.hasOwn(requireRecord(tool), "cache_control"),
      ),
    ).toBe(true);
    expect(assistantContent[0]).toEqual(messages[0].content[0]);
    expect(userContent[0]).not.toHaveProperty("cache_control");
    expect(userContent[1]).toMatchObject({
      type: "tool_result",
      cache_control: { type: "ephemeral", ttl: "1h" },
    });
  });

  it("does not relocate a message breakpoint when the literal last block is thinking", async () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "before" },
          { type: "thinking", thinking: "thought", signature: "signature" },
        ],
      },
    ] as const;
    const result = await buildClaudeCodeRequest({
      ...base,
      messages,
      cacheControl: { enabled: true, messageBreakpoint: true },
    });
    const outputMessages = requireArray(parseBody(result.body)["messages"]);
    const content = requireArray(requireRecord(outputMessages[0])["content"]);

    expect(content).toEqual(messages[0].content);
  });

  it.each([
    ["an unknown key", { enabled: true, unexpected: true }],
    ["a non-object value", "enabled"],
  ])("rejects %s", async (_name, cacheControl) => {
    await expect(invalidCacheControl(cacheControl)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});
