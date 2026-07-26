// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";

const EXPECTED_BETAS = [
  "oauth-2025-04-20",
  "claude-code-20250219",
  "interleaved-thinking-2025-05-14",
  "prompt-caching-scope-2026-01-05",
  "extended-cache-ttl-2025-04-11",
  "context-management-2025-06-27",
  "effort-2025-11-24",
  "web-search-2025-03-05",
  "advisor-tool-2026-03-01",
  "context-hint-2026-04-09",
  "redact-thinking-2026-02-12",
  "thinking-token-count-2026-05-13",
] as const;

const EXPECTED_MODELS = {
  "claude-3-5-haiku": {
    family: "haiku",
    capabilities: {
      contextHint: false,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: false,
    },
  },
  "claude-opus-4-8": {
    family: "opus",
    capabilities: {
      contextHint: true,
      adaptiveThinking: true,
      effort: true,
      interleavedThinking: true,
    },
  },
  "claude-opus-4-7": {
    family: "opus",
    capabilities: {
      contextHint: true,
      adaptiveThinking: true,
      effort: true,
      interleavedThinking: true,
    },
  },
  "claude-opus-4-6": {
    family: "opus",
    capabilities: {
      contextHint: true,
      adaptiveThinking: true,
      effort: true,
      interleavedThinking: true,
    },
  },
  "claude-opus-4-5": {
    family: "opus",
    capabilities: {
      contextHint: true,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: true,
    },
  },
  "claude-3-5-sonnet": {
    family: "sonnet",
    capabilities: {
      contextHint: false,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: false,
    },
  },
  "claude-opus-4-1": {
    family: "opus",
    capabilities: {
      contextHint: true,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: true,
    },
  },
  "claude-3-7-sonnet": {
    family: "sonnet",
    capabilities: {
      contextHint: false,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: false,
    },
  },
  "claude-opus-4-0": {
    family: "opus",
    capabilities: {
      contextHint: true,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: true,
    },
  },
  "claude-sonnet-4-6": {
    family: "sonnet",
    capabilities: {
      contextHint: true,
      adaptiveThinking: true,
      effort: true,
      interleavedThinking: true,
    },
  },
  "claude-sonnet-4-5": {
    family: "sonnet",
    capabilities: {
      contextHint: true,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: true,
    },
  },
  "claude-sonnet-4-0": {
    family: "sonnet",
    capabilities: {
      contextHint: true,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: true,
    },
  },
  "claude-haiku-4-5": {
    family: "haiku",
    capabilities: {
      contextHint: true,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: true,
    },
  },
  "claude-fable-5": {
    family: "fable",
    capabilities: {
      contextHint: true,
      adaptiveThinking: true,
      effort: true,
      interleavedThinking: true,
    },
  },
} as const;

describe("CLAUDE_CODE_2_1_195_PROFILE", () => {
  it("pins the Claude Code and Anthropic request identity", () => {
    expect(CLAUDE_CODE_2_1_195_PROFILE).toMatchObject({
      id: "claude-code-2.1.195-sdk-0.94.0",
      cliVersion: "2.1.195",
      sdkVersion: "0.94.0",
      endpoint: "https://api.anthropic.com/v1/messages?beta=true",
      entrypoint: "cli",
      userAgent: "claude-cli/2.1.195 (external, cli)",
      buildTime: "2026-06-26T01:00:56Z",
      gitSha: "4603aa3f2ea164bd0974f82eb413ae7acc99a7ee",
      attributionHeaderEnabled: true,
      provider: "anthropic",
      anthropicVersion: "2023-06-01",
    });
    expect(CLAUDE_CODE_2_1_195_PROFILE.endpoint).toContain("?beta=true");
  });

  it("uses the empirically proven default capabilities", () => {
    // Enabling context-hint returned HTTP 400 against the live API.
    expect(CLAUDE_CODE_2_1_195_PROFILE.defaultCapabilities).toEqual({
      contextHint: false,
      adaptiveThinking: true,
      effort: true,
      interleavedThinking: true,
    });
    expect(CLAUDE_CODE_2_1_195_PROFILE.defaultCapabilities).not.toHaveProperty(
      "context-hint",
    );
  });

  it("pins the complete beta ordering vocabulary", () => {
    expect(CLAUDE_CODE_2_1_195_PROFILE.orderedBetas).toEqual(EXPECTED_BETAS);
  });

  it("pins exactly the exhaustive supported-model allowlist", () => {
    expect(Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels)).toEqual([
      "claude-3-5-haiku",
      "claude-haiku-4-5",
      "claude-3-5-sonnet",
      "claude-3-7-sonnet",
      "claude-sonnet-4-0",
      "claude-sonnet-4-5",
      "claude-sonnet-4-6",
      "claude-opus-4-0",
      "claude-opus-4-1",
      "claude-opus-4-5",
      "claude-opus-4-6",
      "claude-opus-4-7",
      "claude-opus-4-8",
      "claude-fable-5",
    ]);

    for (const [modelId, expected] of Object.entries(EXPECTED_MODELS)) {
      const actual = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[modelId];
      if (actual === undefined) {
        throw new Error(`Missing expected model: ${modelId}`);
      }
      expect(actual.family).toBe(expected.family);
      expect(actual.capabilities).toEqual(expected.capabilities);
    }
  });

  it("keeps model identifiers lowercase, whitespace-free, and unique", () => {
    const modelIds = new Set(
      Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels),
    );

    for (const [modelId, model] of Object.entries(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      expect(modelId).toBe(modelId.toLowerCase());
      expect(modelIds.has(modelId)).toBe(true);
      expect(model).toBeDefined();
      expect(modelId).not.toMatch(/\s/u);
    }
  });

  it("deep-freezes the complete profile", () => {
    expect(Object.isFrozen(CLAUDE_CODE_2_1_195_PROFILE)).toBe(true);
    expect(
      Object.isFrozen(CLAUDE_CODE_2_1_195_PROFILE.defaultCapabilities),
    ).toBe(true);
    expect(Object.isFrozen(CLAUDE_CODE_2_1_195_PROFILE.orderedBetas)).toBe(
      true,
    );

    for (const model of Object.values(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      expect(Object.isFrozen(model)).toBe(true);
      expect(Object.isFrozen(model.capabilities)).toBe(true);
    }

    expect(
      Reflect.set(CLAUDE_CODE_2_1_195_PROFILE, "id", "mutated-profile"),
    ).toBe(false);
    expect(CLAUDE_CODE_2_1_195_PROFILE.id).toBe(
      "claude-code-2.1.195-sdk-0.94.0",
    );
  });

  it("contains neither xxhash configuration nor an enabled context hint", () => {
    expect(JSON.stringify(CLAUDE_CODE_2_1_195_PROFILE)).not.toContain("xxhash");
    expect(CLAUDE_CODE_2_1_195_PROFILE.defaultCapabilities.contextHint).toBe(
      false,
    );
  });
});
