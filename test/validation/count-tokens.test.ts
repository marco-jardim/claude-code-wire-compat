// SPDX-License-Identifier: GPL-3.0-or-later

import { webcrypto } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildClaudeCodeCountTokensRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const base = {
  accessToken: "sentinel-token-count-tokens-91f2",
  model: "claude-opus-4-5",
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

function headerValue(
  headers: readonly (readonly [string, string])[],
  name: string,
): string | undefined {
  return headers.find(([candidate]) => candidate === name)?.[1];
}

describe("buildClaudeCodeCountTokensRequest", () => {
  it("builds the count-tokens endpoint with only the plain wire keys", async () => {
    const result = await buildClaudeCodeCountTokensRequest(base);
    const body: unknown = JSON.parse(result.body);

    expect(result.url).toBe(
      "https://api.anthropic.com/v1/messages/count_tokens?beta=true",
    );
    expect(result.method).toBe("POST");
    expect(body).toEqual({
      model: "claude-opus-4-5",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
    });
    expect(Object.keys(body as object)).toEqual(["model", "messages", "tools"]);
    expect(body).not.toHaveProperty("system");
    expect(body).not.toHaveProperty("metadata");
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("preserves the load-bearing wire key order", async () => {
    const result = await buildClaudeCodeCountTokensRequest({
      ...base,
      messages: [
        {
          role: "assistant",
          content: [{ type: "redacted_thinking", data: "ciphertext" }],
        },
      ],
    });

    expect(result.body.indexOf('"model"')).toBeLessThan(
      result.body.indexOf('"messages"'),
    );
    expect(result.body.indexOf('"messages"')).toBeLessThan(
      result.body.indexOf('"tools"'),
    );
    expect(result.body.indexOf('"tools"')).toBeLessThan(
      result.body.indexOf('"thinking"'),
    );
  });

  it("uses the upstream fallback for an empty message list", async () => {
    const result = await buildClaudeCodeCountTokensRequest({
      ...base,
      messages: [],
    });

    expect(JSON.parse(result.body)).toMatchObject({
      messages: [{ role: "user", content: "foo" }],
    });
  });

  it("always emits an empty tools array when tools are omitted", async () => {
    const result = await buildClaudeCodeCountTokensRequest(base);
    expect(JSON.parse(result.body)).toMatchObject({ tools: [] });
  });

  it.each([
    ["thinking", { type: "thinking", thinking: "work", signature: "sig" }],
    ["redacted thinking", { type: "redacted_thinking", data: "ciphertext" }],
  ] as const)(
    "emits thinking for assistant %s blocks",
    async (_name, block) => {
      const result = await buildClaudeCodeCountTokensRequest({
        ...base,
        messages: [{ role: "assistant", content: [block] }],
      });

      expect(JSON.parse(result.body)).toHaveProperty("thinking", {
        type: "enabled",
        budget_tokens: 1024,
      });
    },
  );

  it.each([
    [
      "a user thinking block",
      [
        {
          role: "user",
          content: [{ type: "thinking", thinking: "x", signature: "s" }],
        },
      ],
    ],
    ["assistant string content", [{ role: "assistant", content: "thinking" }]],
    ["no thinking block", [{ role: "user", content: "hi" }]],
  ] as const)("does not emit thinking for %s", async (_name, messages) => {
    const result = await buildClaudeCodeCountTokensRequest({
      ...base,
      messages,
    });
    expect(JSON.parse(result.body)).not.toHaveProperty("thinking");
  });

  it.each([
    ["claude-3-5-haiku", "oauth-2025-04-20,token-counting-2024-11-01"],
    [
      "claude-haiku-4-5",
      "oauth-2025-04-20,interleaved-thinking-2025-05-14,context-management-2025-06-27,token-counting-2024-11-01",
    ],
    [
      "claude-opus-4-5",
      "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,context-management-2025-06-27,token-counting-2024-11-01",
    ],
  ] as const)(
    "emits the count-tokens beta sequence for %s",
    async (model, expected) => {
      const result = await buildClaudeCodeCountTokensRequest({
        ...base,
        model,
      });
      expect(headerValue(result.headers, "anthropic-beta")).toBe(expected);
    },
  );

  it("emits token counting when all composed betas are filtered out", async () => {
    const result = await buildClaudeCodeCountTokensRequest({
      ...base,
      model: "claude-3-5-haiku",
      profileOverride: {
        betaPolicy: {
          ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
          oauthAuthenticated: false,
          experimentalBetasEnabled: false,
          oneMillionContextEnabled: false,
          interleavedThinkingEnabled: false,
        },
      },
    });

    expect(headerValue(result.headers, "anthropic-beta")).toBe(
      "token-counting-2024-11-01",
    );
  });

  it("strips model context markers without normalising the wire model", async () => {
    const result = await buildClaudeCodeCountTokensRequest({
      ...base,
      model: "Claude-Opus-4-5[1m]",
    });
    expect(JSON.parse(result.body)).toMatchObject({ model: "Claude-Opus-4-5" });
  });

  // QA-1 (WP-6): the count-tokens path originally passed the caller's message
  // and tool arrays straight to JSON.stringify, so unknown block types,
  // smuggled extra keys and invalid roles all reached the wire even though
  // buildClaudeCodeRequest rejected every one of them. Two public entry points
  // must never offer different fail-closed guarantees for the same input.
  it.each([
    ["an unknown content block type", [{ type: "totally_made_up", wat: 1 }]],
    ["an extra key on a text block", [{ type: "text", text: "hi", smug: "x" }]],
  ])("rejects %s in the message list", async (_label, content) => {
    await expect(
      buildClaudeCodeCountTokensRequest({
        ...base,
        messages: [{ role: "user", content }],
      } as unknown as Parameters<typeof buildClaudeCodeCountTokensRequest>[0]),
    ).rejects.toThrow();
  });

  it("rejects a role the messages endpoint would also reject", async () => {
    await expect(
      buildClaudeCodeCountTokensRequest({
        ...base,
        messages: [{ role: "system", content: "hi" }],
      } as unknown as Parameters<typeof buildClaudeCodeCountTokensRequest>[0]),
    ).rejects.toThrow();
  });

  it("rejects a tool definition the messages endpoint would also reject", async () => {
    await expect(
      buildClaudeCodeCountTokensRequest({
        ...base,
        tools: [{ name: "t", description: "d", input_schema: {}, bogus: 1 }],
      } as unknown as Parameters<typeof buildClaudeCodeCountTokensRequest>[0]),
    ).rejects.toThrow();
  });

  it.each([
    ["a non-string access token", { accessToken: 1 }],
    ["a non-string model", { model: 1 }],
    ["a non-array message list", { messages: "hi" }],
    ["a non-array tool list", { tools: "hi" }],
    ["a non-string client request id", { clientRequestId: 1 }],
    ["an empty client request id", { clientRequestId: "" }],
  ])("rejects %s", async (_label, patch) => {
    await expect(
      buildClaudeCodeCountTokensRequest({
        ...base,
        ...patch,
      } as unknown as Parameters<typeof buildClaudeCodeCountTokensRequest>[0]),
    ).rejects.toThrow();
  });

  // The access token must never be echoed back through another field, or a
  // redacted evidence record could leak it. The guard matches by exact
  // equality, not by substring, exactly as the messages entry point does.
  it("rejects an access token echoed verbatim into another field", async () => {
    await expect(
      buildClaudeCodeCountTokensRequest({
        ...base,
        clientRequestId: base.accessToken,
      }),
    ).rejects.toThrow();
  });

  it.each([
    ["null", null],
    ["a string", "nope"],
    ["an array", []],
  ])("rejects %s as the whole input", async (_label, value) => {
    await expect(
      buildClaudeCodeCountTokensRequest(
        value as unknown as Parameters<
          typeof buildClaudeCodeCountTokensRequest
        >[0],
      ),
    ).rejects.toThrow();
  });

  it("accepts an injected Web Crypto provider and a tool list", async () => {
    const built = await buildClaudeCodeCountTokensRequest({
      ...base,
      tools: [
        {
          name: "read_file",
          description: "Reads a file.",
          input_schema: { type: "object" as const },
        },
      ],
      crypto: {
        subtle: { digest: webcrypto.subtle.digest.bind(webcrypto.subtle) },
      },
    });
    const body = JSON.parse(built.body) as Record<string, unknown>;
    expect(body["tools"]).toEqual([
      {
        name: "read_file",
        description: "Reads a file.",
        input_schema: { type: "object" },
      },
    ]);
    expect(built.evidence.bodySha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("rejects an unknown input key", async () => {
    const input: Record<string, unknown> = { ...base, maxTokens: 1 };
    await expect(
      buildClaudeCodeCountTokensRequest(
        input as Parameters<typeof buildClaudeCodeCountTokensRequest>[0],
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("keeps the messages parser pinned to the messages endpoint", async () => {
    const result = await buildClaudeCodeCountTokensRequest(base);
    expect(() => parseBuiltClaudeCodeRequest(result)).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });
});
