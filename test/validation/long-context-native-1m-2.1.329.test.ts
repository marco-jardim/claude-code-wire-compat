// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { composeBetasWithAudit } from "../../src/betas.js";
import type { ComposeBetasInput } from "../../src/betas.js";
import type { ClaudeCodeProtocolProfile } from "../../src/contracts.js";
import {
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
} from "../../src/index.js";
import { deriveCapabilities } from "../../src/model-capabilities.js";
import { isThinkingActive } from "../../src/thinking.js";

/*
 * On 2.1.329 a model whose catalogue entry declares a native 1M window never
 * gets `context-1m-2025-08-07`, whatever the `[1m]` marker or the override
 * says. Models that only reach 1M through the beta still get it. Earlier
 * profiles keep sending it for the marker.
 */

const CONTEXT_1M = "context-1m-2025-08-07";
const P329 = CLAUDE_CODE_2_1_329_PROFILE;
const P280 = CLAUDE_CODE_2_1_280_PROFILE;
const P233 = CLAUDE_CODE_2_1_233_PROFILE;

function compose(
  rawModel: string,
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile,
  use1MContextOverride?: boolean,
): readonly string[] {
  const capabilities = deriveCapabilities(normalizedId, profile);
  const input: ComposeBetasInput = {
    rawModel,
    normalizedId,
    capabilities,
    thinkingDisplayActive: false,
    thinkingActive: isThinkingActive({ type: "adaptive" }, capabilities),
    ...(use1MContextOverride === undefined ? {} : { use1MContextOverride }),
  };
  return composeBetasWithAudit(input, profile).betas;
}

describe("2.1.329 context-1m for natively-1M models", () => {
  it("fixtures: the catalogue marks opus-5-5 native and sonnet-4-6 not native", () => {
    const models = P329.supportedModels;
    expect({
      opus55: models["claude-opus-5-5"]?.context?.native1m,
      sonnet46: models["claude-sonnet-4-6"]?.context?.native1m,
    }).toEqual({ opus55: true, sonnet46: undefined });
  });

  it("omits context-1m for claude-opus-5-5[1m]", () => {
    const list = compose("claude-opus-5-5[1m]", "claude-opus-5-5", P329);
    expect(list).not.toContain(CONTEXT_1M);
  });

  it("still sends context-1m for claude-sonnet-4-6[1m]", () => {
    const list = compose("claude-sonnet-4-6[1m]", "claude-sonnet-4-6", P329);
    expect(list).toContain(CONTEXT_1M);
  });

  it("omits context-1m for claude-opus-5-5 even when the override is true", () => {
    const list = compose("claude-opus-5-5", "claude-opus-5-5", P329, true);
    expect(list).not.toContain(CONTEXT_1M);
  });

  it("lets an override of true force context-1m for a non-native model without the marker", () => {
    const list = compose("claude-sonnet-4-6", "claude-sonnet-4-6", P329, true);
    expect(list).toContain(CONTEXT_1M);
  });

  it("lets an override of false suppress context-1m for a non-native model with the marker", () => {
    const list = compose(
      "claude-sonnet-4-6[1m]",
      "claude-sonnet-4-6",
      P329,
      false,
    );
    expect(list).not.toContain(CONTEXT_1M);
  });

  it("sends nothing without the marker or an override", () => {
    const list = compose("claude-sonnet-4-6", "claude-sonnet-4-6", P329);
    expect(list).not.toContain(CONTEXT_1M);
  });

  it("treats an id with no catalogue entry as not native", () => {
    const list = compose("claude-unknown-9[1m]", "claude-unknown-9", P329);
    expect(list).toContain(CONTEXT_1M);
  });

  it("does not read an inherited property as a catalogue entry", () => {
    // Capabilities are supplied directly so the composition itself, not the
    // capability derivation, is what meets the inherited name.
    const input: ComposeBetasInput = {
      rawModel: "constructor[1m]",
      normalizedId: "constructor",
      capabilities: deriveCapabilities("claude-opus-5-5", P329),
      thinkingDisplayActive: false,
      thinkingActive: false,
    };
    expect(composeBetasWithAudit(input, P329).betas).toContain(CONTEXT_1M);
  });

  it("is unchanged on 2.1.233: opus-5-5[1m] keeps context-1m", () => {
    const list = compose("claude-opus-5-5[1m]", "claude-opus-5-5", P233);
    expect(list).toContain(CONTEXT_1M);
  });

  it("is unchanged on 2.1.280: opus-5-5[1m] keeps context-1m", () => {
    const list = compose("claude-opus-5-5[1m]", "claude-opus-5-5", P280);
    expect(list).toContain(CONTEXT_1M);
  });

  it("is unchanged on 2.1.280: an override of true still forces context-1m for opus-5-5", () => {
    const list = compose("claude-opus-5-5", "claude-opus-5-5", P280, true);
    expect(list).toContain(CONTEXT_1M);
  });
});
