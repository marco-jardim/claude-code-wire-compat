// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { composeBetasWithAudit } from "../../src/betas.js";
import type { ComposeBetasInput } from "../../src/betas.js";
import type { ClaudeCodeProtocolProfile } from "../../src/contracts.js";
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
} from "../../src/index.js";
import {
  deriveCapabilities,
  supportsMidConversationSystem,
} from "../../src/model-capabilities.js";
import { isThinkingActive } from "../../src/thinking.js";

/*
 * 2.1.329 graduated `mid-conversation-system`: the registry carries no header
 * for it and no catalogue entry carries the `mid_conv_system` string, while the
 * behaviour the beta gated (and the two betas keyed on it) stays on. The
 * activity question is therefore answered by the predicate alone on that
 * profile, which is what these tests pin.
 */

const MID_SYSTEM = "mid-conversation-system-2026-04-07";
const TOOL_CHANGES = "mid-conversation-tool-changes-2026-07-01";
const CLEAR_AT = "mid-conversation-system-clear-at-2026-08-21";
const MID_CONVERSATION_BETAS = [MID_SYSTEM, TOOL_CHANGES, CLEAR_AT] as const;

function compose(
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile,
): readonly string[] {
  const capabilities = deriveCapabilities(normalizedId, profile);
  const input: ComposeBetasInput = {
    rawModel: normalizedId,
    normalizedId,
    capabilities,
    thinkingDisplayActive: false,
    thinkingActive: isThinkingActive({ type: "adaptive" }, capabilities),
  };
  return composeBetasWithAudit(input, profile).betas;
}

const present = (list: readonly string[]): readonly string[] =>
  MID_CONVERSATION_BETAS.filter((beta) => list.includes(beta));

describe("2.1.329 mid-conversation betas", () => {
  it("composes tool-changes and clear-at, but not mid-conversation-system, for claude-opus-5-5", () => {
    const list = compose("claude-opus-5-5", CLAUDE_CODE_2_1_329_PROFILE);
    expect(present(list)).toEqual([TOOL_CHANGES, CLEAR_AT]);
    expect(list.indexOf(TOOL_CHANGES)).toBeLessThan(list.indexOf(CLEAR_AT));
  });

  it("composes none of the three for claude-opus-4-7", () => {
    const list = compose("claude-opus-4-7", CLAUDE_CODE_2_1_329_PROFILE);
    expect(present(list)).toEqual([]);
  });

  it("composes clear-at only for claude-mythos-5", () => {
    // The model is catalogued without `mid_conv_tool_change`, and the
    // predicate admits it, which is the upstream `sw` outcome.
    const list = compose("claude-mythos-5", CLAUDE_CODE_2_1_329_PROFILE);
    expect(present(list)).toEqual([CLEAR_AT]);
  });

  it("answers the activity question from the predicate, not the catalogue", () => {
    expect(
      supportsMidConversationSystem(
        "claude-opus-5-5",
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).toBe(true);
    expect(
      supportsMidConversationSystem(
        "claude-opus-4-7",
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).toBe(false);
    expect(
      supportsMidConversationSystem(
        "claude-mythos-5",
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).toBe(true);
  });

  it("keeps mid-conversation-system for claude-opus-5-5 on 2.1.280", () => {
    expect(compose("claude-opus-5-5", CLAUDE_CODE_2_1_280_PROFILE)).toContain(
      MID_SYSTEM,
    );
  });

  it("keeps reading the catalogue on the earlier profiles", () => {
    for (const profile of [
      CLAUDE_CODE_2_1_195_PROFILE,
      CLAUDE_CODE_2_1_233_PROFILE,
      CLAUDE_CODE_2_1_280_PROFILE,
    ]) {
      for (const id of Object.keys(profile.supportedModels)) {
        const entry = profile.supportedModels[id];
        expect({
          id,
          profile: profile.id,
          active: supportsMidConversationSystem(id, profile),
        }).toEqual({
          id,
          profile: profile.id,
          active: entry?.capabilities.includes("mid_conv_system") === true,
        });
      }
    }
  });
});
