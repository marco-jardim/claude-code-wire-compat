// SPDX-License-Identifier: GPL-3.0-or-later

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

describe("composeBetas validation", () => {
  it("rejects a non-boolean effort request", () => {
    // Intentional invalid-input fixture: the public type must be defended at runtime.
    const input = {
      capabilities: CAPABILITIES,
      effortRequested: "yes",
    } as unknown as Parameters<typeof composeBetas>[0];

    expect(() => composeBetas(input)).toThrow(
      expect.objectContaining({ code: "INVALID_EFFORT" }),
    );
  });

  it("rejects a non-boolean context-hint request", () => {
    // Intentional invalid-input fixture: the public type must be defended at runtime.
    const input = {
      capabilities: CAPABILITIES,
      effortRequested: false,
      contextHintRequested: "yes",
    } as unknown as Parameters<typeof composeBetas>[0];

    expect(() => composeBetas(input)).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_CAPABILITY" }),
    );
  });

  it.each([
    {
      name: "effort",
      input: {
        capabilities: { ...CAPABILITIES, effort: false },
        effortRequested: true,
      },
    },
    {
      name: "context hint",
      input: {
        capabilities: { ...CAPABILITIES, contextHint: false },
        effortRequested: false,
        contextHintRequested: true,
      },
    },
  ])(
    "handles an unsupported $name capability combination",
    ({ name, input }) => {
      if (name === "effort") {
        expect(() => composeBetas(input)).toThrow(
          expect.objectContaining({ code: "UNSUPPORTED_CAPABILITY" }),
        );
      } else {
        expect(composeBetas(input)).not.toContain("context-hint-2026-04-09");
      }
    },
  );

  it("emits interleaved thinking and preserves profile order exactly", () => {
    const profile: ClaudeCodeProtocolProfile = {
      ...CLAUDE_CODE_2_1_195_PROFILE,
      orderedBetas: [
        "not-selected",
        "interleaved-thinking-2025-05-14",
        "oauth-2025-04-20",
        "interleaved-thinking-2025-05-14",
      ],
    };

    expect(
      composeBetas(
        {
          capabilities: CAPABILITIES,
          effortRequested: false,
          contextHintRequested: false,
        },
        profile,
      ),
    ).toEqual(["interleaved-thinking-2025-05-14", "oauth-2025-04-20"]);
  });

  it("emits effort and context-hint betas when both are requested", () => {
    const result = composeBetas(
      {
        capabilities: CAPABILITIES,
        effortRequested: true,
        contextHintRequested: true,
      },
      { ...CLAUDE_CODE_2_1_195_PROFILE, contextHintEnabled: true },
    );

    expect(result).toContain("effort-2025-11-24");
    expect(result).toContain("context-hint-2026-04-09");
  });
});
