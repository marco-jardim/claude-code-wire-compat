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

describe("pinned identity cache marker", () => {
  it("coexists with a caller-directed system breakpoint", async () => {
    const result = await buildClaudeCodeRequest({
      ...base,
      system: ["caller"],
      messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      cacheControl: {
        enabled: true,
        ttl: "1h",
        systemBreakpoint: true,
      },
    });
    const parsed: unknown = JSON.parse(result.body);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new TypeError("Expected request body object.");
    }
    const body: Readonly<Record<string, unknown>> = Object.fromEntries(
      Object.entries(parsed),
    );
    const system = body["system"];
    if (!Array.isArray(system)) throw new TypeError("Expected system array.");
    const marker = { type: "ephemeral", ttl: "1h" };

    expect(system).toHaveLength(3);
    expect(system[0]).not.toHaveProperty("cache_control");
    expect(system[1]).toMatchObject({
      text: "You are Claude Code, Anthropic's official CLI for Claude.",
      cache_control: marker,
    });
    expect(system[2]).toMatchObject({
      text: "caller",
      cache_control: marker,
    });
  });
});
