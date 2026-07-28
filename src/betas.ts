// SPDX-License-Identifier: GPL-3.0-or-later

import { BETA_REGISTRY } from "./beta-registry.js";
import type {
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import {
  supportsMidConversationSystem,
  supportsStructuredOutputs,
} from "./model-capabilities.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

/*
 * Provenance. The emitted order is a port of the genuine client's base beta set
 * `$9r` (byte offset 227387921), followed by the gated pushes the request
 * builder performs afterwards (bytes 238153535-238155672). The identifiers
 * themselves come from registry `Udd`, ported verbatim as `BETA_REGISTRY`.
 *
 * The order is EMERGENT, not declared: upstream neither sorts the array nor
 * keeps a canonical list, so the sequence below is load-bearing and must not be
 * reordered for tidiness. `docs/source-trace.md` records the same fact under
 * "Beta registry and push order".
 */
export interface ComposeBetasInput {
  readonly rawModel: string;
  readonly normalizedId: string;
  readonly capabilities: ClaudeCodeCapabilities;
  readonly thinkingDisplayActive: boolean;
  readonly cacheTtl?: "5m" | "1h" | null;
  readonly speed?: "standard" | "fast" | null;
  /**
   * Package extension, not observed upstream behaviour. Consumer-supplied beta
   * identifiers appended AFTER the derived canonical set. See
   * `docs/source-trace.md`, governance ledger L10.
   */
  readonly additionalBetas?: readonly string[];
  /**
   * Package extension, not observed upstream behaviour. Beta identifiers
   * removed from the emitted set AFTER composition and AFTER the
   * `additionalBetas` merge, so suppression beats addition. An identifier that
   * is not in the composed set is a silent no-op. See `docs/source-trace.md`,
   * governance ledger L14.
   */
  readonly suppressBetas?: readonly string[];
  /**
   * Package extension, not observed upstream behaviour. Forces (`true`) or
   * suppresses (`false`) the 1M-context beta for this request, overriding the
   * `[1m]` model marker. See `docs/source-trace.md`, governance ledger L10.
   */
  readonly use1MContextOverride?: boolean;
}

/**
 * Reports the emitted beta set together with the identifiers `suppressBetas`
 * actually removed. `suppressedBetaNames` is empty when the seam is unused or
 * matched nothing, which is what keeps the evidence key absent for every
 * request built before the seam existed.
 */
export interface ComposedBetas {
  readonly betas: readonly string[];
  readonly suppressedBetaNames: readonly string[];
}

/**
 * Bounds a caller-supplied beta list (`additionalBetas` and `suppressBetas`
 * share these rules verbatim). The header is a comma-joined single
 * field, so a comma, control character, or whitespace in an entry would let a
 * caller synthesize extra beta values (or, with CR/LF, an entirely separate
 * header). The allowlist below is deliberately narrower than the observed
 * upstream identifiers require, because every genuine beta name in
 * `BETA_REGISTRY` matches it.
 */
const ADDITIONAL_BETA_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const MAX_ADDITIONAL_BETA_LENGTH = 128;
const MAX_ADDITIONAL_BETAS = 32;

function validateAdditionalBetas(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_ADDITIONAL_BETAS) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value.map((entry: unknown): string => {
    if (
      typeof entry !== "string" ||
      entry.length === 0 ||
      entry.length > MAX_ADDITIONAL_BETA_LENGTH ||
      !ADDITIONAL_BETA_PATTERN.test(entry)
    ) {
      throw new ClaudeCodeWireError("INVALID_INPUT");
    }
    return entry;
  });
}

const NO_SUPPRESSED_BETAS: readonly string[] = Object.freeze([]);

export function composeBetas(
  input: ComposeBetasInput,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): readonly string[] {
  return composeBetasWithAudit(input, profile).betas;
}

export function composeBetasWithAudit(
  input: ComposeBetasInput,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): ComposedBetas {
  const out: string[] = [];
  const policy = profile.betaPolicy;
  const experimental = policy.experimentalBetasEnabled;

  if (!input.normalizedId.includes("haiku"))
    out.push(BETA_REGISTRY.CLAUDE_CODE.header);
  if (policy.oauthAuthenticated) out.push(BETA_REGISTRY.OAUTH_AUTH.header);
  // Package extension: `use1MContextOverride` replaces the model-marker gate
  // for this request. The profile gate still applies, so an override cannot
  // enable a beta the pinned profile declares unavailable.
  const oneMillionRequested =
    input.use1MContextOverride ?? /\[1m\]/iu.test(input.rawModel);
  if (policy.oneMillionContextEnabled && oneMillionRequested) {
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

  // Package extension. Canonical, upstream-derived identifiers always precede
  // caller-supplied ones, and a caller entry that duplicates an already-emitted
  // identifier is dropped rather than reordering the canonical prefix.
  if (input.additionalBetas !== undefined) {
    for (const beta of validateAdditionalBetas(input.additionalBetas)) {
      if (!out.includes(beta)) out.push(beta);
    }
  }

  // Package extension. The suppression filter is deliberately LAST: it runs
  // after the canonical composition and after the `additionalBetas` merge, so
  // an identifier named by both seams does not reach the wire. Removal is
  // reported in composed order, never in caller order, and an identifier that
  // was never composed is a silent no-op because a consumer cannot know which
  // betas this package derives for a given model.
  if (input.suppressBetas === undefined) {
    return Object.freeze({
      betas: Object.freeze(out),
      suppressedBetaNames: NO_SUPPRESSED_BETAS,
    });
  }
  const suppressed = new Set(validateAdditionalBetas(input.suppressBetas));
  const kept: string[] = [];
  const removed: string[] = [];
  for (const beta of out) {
    if (suppressed.has(beta)) removed.push(beta);
    else kept.push(beta);
  }
  return Object.freeze({
    betas: Object.freeze(kept),
    suppressedBetaNames: Object.freeze(removed),
  });
}
