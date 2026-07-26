// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { composeBetas } from "../../src/betas.js";
import type {
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
} from "../../src/contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";

const CAPABILITIES: ClaudeCodeCapabilities = {
  thinking: true,
  adaptiveThinking: true,
  interleavedThinking: true,
  effort: true,
  maxEffort: true,
  xhighEffort: true,
  contextManagement: true,
  temperature: false,
  rejectsDisabledThinking: false,
};

const INPUT = {
  rawModel: "claude-opus-4-8",
  normalizedId: "claude-opus-4-8",
  capabilities: CAPABILITIES,
  thinkingDisplayActive: false,
} as const;

describe("composeBetas policy combinations", () => {
  it("uses push order and ignores the retained orderedBetas field", () => {
    const profile: ClaudeCodeProtocolProfile = {
      ...CLAUDE_CODE_2_1_195_PROFILE,
      orderedBetas: ["effort-2025-11-24", "oauth-2025-04-20"],
    };
    expect(composeBetas(INPUT, profile)).toEqual(
      composeBetas(INPUT, CLAUDE_CODE_2_1_195_PROFILE),
    );
  });

  it("emits context hint when the profile enables it", () => {
    const profile = {
      ...CLAUDE_CODE_2_1_195_PROFILE,
      contextHintEnabled: true,
    };
    expect(composeBetas(INPUT, profile)).toContain("context-hint-2026-04-09");
    expect(composeBetas(INPUT, CLAUDE_CODE_2_1_195_PROFILE)).not.toContain(
      "context-hint-2026-04-09",
    );
  });

  it("keeps the retained beta vocabulary out of the composer source", () => {
    const source = readFileSync(
      new URL("../../src/betas.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("orderedBetas");
  });

  it("keeps experimental base pushes disabled as one policy unit", () => {
    const profile = {
      ...CLAUDE_CODE_2_1_195_PROFILE,
      betaPolicy: {
        ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
        experimentalBetasEnabled: false,
      },
    };
    const result = composeBetas(INPUT, profile);
    expect(result).not.toContain("redact-thinking-2026-02-12");
    expect(result).not.toContain("thinking-token-count-2026-05-13");
    expect(result).not.toContain("context-management-2025-06-27");
    expect(result).not.toContain("prompt-caching-scope-2026-01-05");
  });
});
