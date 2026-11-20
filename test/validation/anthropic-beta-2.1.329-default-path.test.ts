// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_329_PROFILE,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeRequestInput,
} from "../../src/index.js";

/*
 * The `anthropic-beta` header a caller gets on 2.1.329 with NO account-served
 * input, as an independent literal. This is the default-path composition of the
 * genuine interactive client for `claude-opus-5-5` with adaptive thinking, minus
 * the betas that depend on the account (inline-tools, message-threads, advisor)
 * and on the environment or permission mode (advanced-tool-use,
 * dangerous-tool-use, afk-mode), none of which this package composes by default.
 * The order is the genuine client's emergent push order.
 */

const DEFAULT_PATH = [
  "claude-code-20250219",
  "oauth-2025-04-20",
  "interleaved-thinking-2025-05-14",
  "context-management-2025-06-27",
  "prompt-caching-scope-2026-01-05",
  "per-turn-control-2026-07-01",
  "mid-conversation-tool-changes-2026-07-01",
  "thinking-token-count-2026-05-13",
  "mid-conversation-system-clear-at-2026-08-21",
  "effort-2025-11-24",
  "thinking-binding-controls-2026-08-01",
  "thinking-display-updates-2026-08-18",
  "cache-diagnosis-2026-04-07",
] as const;

const EXTENDED_CACHE_TTL = "extended-cache-ttl-2025-04-11";

const BASE = {
  accessToken: "default-path-token-not-a-secret",
  model: "claude-opus-5-5",
  maxTokens: 128000,
  messages: [{ role: "user", content: "hello" }],
  thinking: { type: "adaptive" },
  effort: "medium",
  runtime: {
    sessionId: "00000000-0000-4000-8000-000000000001",
    deviceId:
      "0000000000000000000000000000000000000000000000000000000000000002",
    accountUuid: "00000000-0000-4000-8000-000000000000",
    runtime: "node",
    runtimeVersion: "v26.12.1",
    os: "Windows",
    arch: "x64",
  },
  clientRequestId: "00000000-0000-4000-8000-000000000002",
} as const satisfies ClaudeCodeRequestInput;

async function betasOf(
  extra: Partial<ClaudeCodeRequestInput> = {},
): Promise<readonly string[]> {
  const built: BuiltClaudeCodeRequest = await buildClaudeCodeRequest(
    { ...BASE, ...extra },
    CLAUDE_CODE_2_1_329_PROFILE,
  );
  const value = built.headers.find(([name]) => name === "anthropic-beta")?.[1];
  return (value ?? "").split(",");
}

describe("anthropic-beta default path on 2.1.329", () => {
  it("is the genuine default-path list", async () => {
    expect(await betasOf()).toStrictEqual(DEFAULT_PATH);
  });

  it("adds extended-cache-ttl for a 1h cache TTL, between the display-updates and cache-diagnosis positions", async () => {
    const list = await betasOf({ cacheControl: { ttl: "1h" } });

    // The genuine position: after the AFK position (which this package leaves
    // empty by default) and before cache-diagnosis.
    expect(list).toStrictEqual([
      ...DEFAULT_PATH.slice(0, -1),
      EXTENDED_CACHE_TTL,
      "cache-diagnosis-2026-04-07",
    ]);
  });

  it("omits extended-cache-ttl for a 5m cache TTL", async () => {
    expect(await betasOf({ cacheControl: { ttl: "5m" } })).toStrictEqual(
      DEFAULT_PATH,
    );
  });

  it("never composes tool-provenance by default", async () => {
    expect(await betasOf()).not.toContain("tool-provenance-2026-10-26");
    expect(
      await betasOf({ accountFeatures: { dispatchId: "v2d" } }),
    ).not.toContain("tool-provenance-2026-10-26");
  });
});
