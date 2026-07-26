// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../../src/index.js";

const base = {
  accessToken: "sentinel-token-public-surface-91f2",
  model: "claude-opus-4-6",
  maxTokens: 1024,
  messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
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

function callerSystem(body: string): readonly unknown[] {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Expected request body object.");
  }
  const system: unknown = Object.fromEntries(Object.entries(parsed))["system"];
  if (!Array.isArray(system)) throw new TypeError("Expected system array.");
  return system.slice(2);
}

describe("caller system joining", () => {
  it("joins consecutive blocks without cache_control", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      system: ["static", { type: "text", text: "dynamic" }],
    });

    expect(callerSystem(result.body)).toEqual([
      { type: "text", text: "static\ndynamic" },
    ]);
  });

  it("joins consecutive blocks with structurally equal cache_control", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      system: [
        {
          type: "text",
          text: "static one",
          cache_control: { type: "ephemeral", ttl: "5m", scope: "global" },
        },
        {
          type: "text",
          text: "static two",
          cache_control: { type: "ephemeral", ttl: "5m", scope: "global" },
        },
      ],
    });

    expect(callerSystem(result.body)).toEqual([
      {
        type: "text",
        text: "static one\nstatic two",
        cache_control: { type: "ephemeral", ttl: "5m", scope: "global" },
      },
    ]);
  });

  it("keeps a single caller block byte-identical", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      system: [
        {
          type: "text",
          text: "single",
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
    });

    expect(callerSystem(result.body)).toEqual([
      {
        type: "text",
        text: "single",
        cache_control: { type: "ephemeral", ttl: "1h" },
      },
    ]);
  });
});
