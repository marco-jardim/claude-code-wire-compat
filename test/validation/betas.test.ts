// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { composeBetas } from "../../src/betas.js";
import type { ClaudeCodeCapabilities } from "../../src/contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
import { describeEachProfile } from "../support/profile-matrix.js";

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

describeEachProfile("composeBetas policy combinations", (entry) => {
  it("emits context hint when the profile enables it", () => {
    const profile = {
      ...entry.profile,
      contextHintEnabled: true,
    };
    expect(composeBetas(INPUT, profile)).toContain("context-hint-2026-04-09");
    // The negative half is a concrete 195 design value (`contextHintEnabled:
    // false`), not a profile-invariant, so it stays pinned to that profile.
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
      ...entry.profile,
      betaPolicy: {
        ...entry.profile.betaPolicy,
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
