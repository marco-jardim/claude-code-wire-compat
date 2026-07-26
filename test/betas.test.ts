// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { composeBetas } from "../src/betas.js";
import type { ClaudeCodeProtocolProfile } from "../src/contracts.js";
import { resolveModel } from "../src/models.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";

function betasFor(
  model: string,
  options: Readonly<{
    cacheTtl?: "5m" | "1h" | null;
    speed?: "standard" | "fast" | null;
  }> = {},
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): readonly string[] {
  const resolved = resolveModel(model, profile);
  return composeBetas(
    {
      rawModel: model,
      normalizedId: resolved.id,
      capabilities: resolved.capabilities,
      thinkingDisplayActive: false,
      ...options,
    },
    profile,
  );
}

function withPolicy(
  override: Partial<ClaudeCodeProtocolProfile["betaPolicy"]>,
): ClaudeCodeProtocolProfile {
  return {
    ...CLAUDE_CODE_2_1_195_PROFILE,
    betaPolicy: {
      ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
      ...override,
    },
  };
}

describe("composeBetas", () => {
  it.each([
    [
      "claude-3-5-haiku",
      ["oauth-2025-04-20", "prompt-caching-scope-2026-01-05"],
    ],
    [
      "claude-haiku-4-5",
      [
        "oauth-2025-04-20",
        "interleaved-thinking-2025-05-14",
        "redact-thinking-2026-02-12",
        "thinking-token-count-2026-05-13",
        "context-management-2025-06-27",
        "prompt-caching-scope-2026-01-05",
      ],
    ],
    [
      "claude-opus-4-5",
      [
        "claude-code-20250219",
        "oauth-2025-04-20",
        "interleaved-thinking-2025-05-14",
        "redact-thinking-2026-02-12",
        "thinking-token-count-2026-05-13",
        "context-management-2025-06-27",
        "prompt-caching-scope-2026-01-05",
        "effort-2025-11-24",
      ],
    ],
    [
      "claude-opus-4-8",
      [
        "claude-code-20250219",
        "oauth-2025-04-20",
        "interleaved-thinking-2025-05-14",
        "redact-thinking-2026-02-12",
        "thinking-token-count-2026-05-13",
        "context-management-2025-06-27",
        "prompt-caching-scope-2026-01-05",
        "mid-conversation-system-2026-04-07",
        "effort-2025-11-24",
      ],
    ],
  ] as const)("pins the full emergent beta order for %s", (model, expected) => {
    expect(betasFor(model)).toEqual(expected);
  });

  it("D1: suppresses claude-code for haiku models", () => {
    expect(betasFor("claude-haiku-4-5")).not.toContain("claude-code-20250219");
  });

  it("D3: emits oauth only when the pinned authentication gate is enabled", () => {
    expect(
      betasFor(
        "claude-opus-4-8",
        {},
        withPolicy({ oauthAuthenticated: false }),
      ),
    ).not.toContain("oauth-2025-04-20");
  });

  it("D9: structured outputs requires both its model predicate and policy gate", () => {
    const profile = withPolicy({ structuredOutputsEnabled: true });
    expect(betasFor("claude-opus-4-8", {}, profile)).toContain(
      "structured-outputs-2025-12-15",
    );
    expect(betasFor("claude-opus-4-0", {}, profile)).not.toContain(
      "structured-outputs-2025-12-15",
    );
  });

  it("D10: never emits web search on the pinned first-party profile", () => {
    expect(betasFor("claude-opus-4-8")).not.toContain("web-search-2025-03-05");
  });

  it("D11: emits effort for every effort-capable model without a request gate", () => {
    expect(betasFor("claude-opus-4-8")).toContain("effort-2025-11-24");
  });

  it("extended-cache-ttl: emits only for 1h cache TTL with experimental betas", () => {
    expect(betasFor("claude-opus-4-8", { cacheTtl: "5m" })).not.toContain(
      "extended-cache-ttl-2025-04-11",
    );
    expect(betasFor("claude-opus-4-8", { cacheTtl: "1h" })).toContain(
      "extended-cache-ttl-2025-04-11",
    );
    expect(
      betasFor(
        "claude-opus-4-8",
        { cacheTtl: "1h" },
        withPolicy({ experimentalBetasEnabled: false }),
      ),
    ).not.toContain("extended-cache-ttl-2025-04-11");
  });

  it("emits the 1m marker beta from the raw caller model", () => {
    expect(betasFor("claude-opus-4-8[1m]")).toContain("context-1m-2025-08-07");
  });

  it("emits fast mode in builder-push order", () => {
    const result = betasFor("claude-opus-4-8", { speed: "fast" });
    expect(result.at(-1)).toBe("fast-mode-2026-02-01");
  });

  it("never emits advisor tool without an observed push site", () => {
    expect(betasFor("claude-opus-4-8")).not.toContain(
      "advisor-tool-2026-03-01",
    );
  });

  it("returns a frozen, deterministic, duplicate-free array", () => {
    const first = betasFor("claude-opus-4-8", {
      cacheTtl: "1h",
      speed: "fast",
    });
    const second = betasFor("claude-opus-4-8", {
      cacheTtl: "1h",
      speed: "fast",
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });
});
