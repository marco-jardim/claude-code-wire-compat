// SPDX-License-Identifier: GPL-3.0-or-later

import { BETA_REGISTRY } from "./beta-registry.js";
import type {
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
} from "./contracts.js";
import {
  supportsMidConversationSystem,
  supportsStructuredOutputs,
} from "./model-capabilities.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

export interface ComposeBetasInput {
  readonly rawModel: string;
  readonly normalizedId: string;
  readonly capabilities: ClaudeCodeCapabilities;
  readonly thinkingDisplayActive: boolean;
  readonly cacheTtl?: "5m" | "1h" | null;
  readonly speed?: "standard" | "fast" | null;
}

export function composeBetas(
  input: ComposeBetasInput,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): readonly string[] {
  const out: string[] = [];
  const policy = profile.betaPolicy;
  const experimental = policy.experimentalBetasEnabled;

  if (!input.normalizedId.includes("haiku"))
    out.push(BETA_REGISTRY.CLAUDE_CODE.header);
  if (policy.oauthAuthenticated) out.push(BETA_REGISTRY.OAUTH_AUTH.header);
  if (policy.oneMillionContextEnabled && /\[1m\]/iu.test(input.rawModel)) {
    out.push(BETA_REGISTRY.LONG_CONTEXT.header);
  }
  if (
    policy.interleavedThinkingEnabled &&
    input.capabilities.interleavedThinking
  ) {
    out.push(BETA_REGISTRY.INTERLEAVED_THINKING.header);
  }
  if (
    experimental &&
    input.capabilities.interleavedThinking &&
    policy.interactive &&
    !policy.thinkingSummariesShown &&
    !input.thinkingDisplayActive
  ) {
    out.push(BETA_REGISTRY.REDACT_THINKING.header);
  }
  if (
    policy.thinkingTokenCountEnabled &&
    experimental &&
    input.capabilities.interleavedThinking
  ) {
    out.push(BETA_REGISTRY.THINKING_TOKEN_COUNT.header);
  }
  if (experimental && policy.narrationSummariesEnabled)
    out.push(BETA_REGISTRY.NARRATION_SUMMARIES.header);
  if (experimental && input.capabilities.contextManagement)
    out.push(BETA_REGISTRY.CONTEXT_MANAGEMENT.header);
  if (
    experimental &&
    supportsStructuredOutputs(input.normalizedId) &&
    policy.structuredOutputsEnabled
  ) {
    out.push(BETA_REGISTRY.STRUCTURED_OUTPUTS.header);
  }

  // No web-search beta: upstream pushes it only for vertex and foundry.
  if (experimental) out.push(BETA_REGISTRY.PROMPT_CACHING_SCOPE.header);
  if (supportsMidConversationSystem(input.normalizedId))
    out.push(BETA_REGISTRY.MID_CONVERSATION_SYSTEM.header);
  if (input.capabilities.effort) out.push(BETA_REGISTRY.EFFORT.header);

  if (input.speed === "fast" && !out.includes(BETA_REGISTRY.SPEED.header)) {
    out.push(BETA_REGISTRY.SPEED.header);
  }
  if (policy.afkModeEnabled && !out.includes(BETA_REGISTRY.AFK_MODE.header)) {
    out.push(BETA_REGISTRY.AFK_MODE.header);
  }
  if (
    input.cacheTtl === "1h" &&
    experimental &&
    !out.includes(BETA_REGISTRY.EXTENDED_CACHE_TTL.header)
  ) {
    out.push(BETA_REGISTRY.EXTENDED_CACHE_TTL.header);
  }
  if (profile.contextHintEnabled) out.push(BETA_REGISTRY.CONTEXT_HINT.header);
  if (
    policy.cacheDiagnosisEnabled &&
    !out.includes(BETA_REGISTRY.CACHE_DIAGNOSIS.header)
  ) {
    out.push(BETA_REGISTRY.CACHE_DIAGNOSIS.header);
  }

  // No advisor-tool beta: upstream has no observed unconditional push site.
  return Object.freeze(out);
}
