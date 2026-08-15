// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile } from "./contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

/**
 * Per-profile behaviour dispatch.
 *
 * Three modules — `thinking.ts`, `fingerprint.ts` and `model-capabilities.ts` —
 * each need to know whether the profile they were handed behaves like upstream
 * 2.1.195 or like upstream 2.1.222+. Each grew its own
 * `profile.id === CLAUDE_CODE_2_1_195_PROFILE.id` comparison as its feature
 * landed, and three copies of one question is three places to forget when a
 * fourth profile arrives. This module is the single place that asks it.
 *
 * The flags are named for the BEHAVIOUR they gate, never for a version. A call
 * site reading `profileBehaviors(profile).billingChainSegments` says what it is
 * deciding; a call site reading `profile.id !== …195….id` says only which
 * client it is not, and leaves the reader to reconstruct why that matters.
 * `test/governance/version-dispatch.test.ts` fails the build if a fourth copy
 * of the comparison appears in `src/`.
 *
 * `ClaudeCodeProfileBehaviors` deliberately stays here rather than moving to
 * `contracts.ts`. It is not part of the wire contract and is not exported from
 * `index.ts`: it is an internal derivation over a profile, and putting it in
 * the contract module would imply consumers can supply one, which they cannot.
 * Behaviour is derived from the profile, never declared alongside it.
 */
export interface ClaudeCodeProfileBehaviors {
  /**
   * Whether a caller's own `max_tokens` of 4096 or more raises the model's
   * `upperLimit` and lowers its `default` to fit under it.
   *
   * Consumed by `modelOutputTokenLimits` in `thinking.ts`, whose one
   * wire-visible effect is the seed of the default thinking budget.
   */
  readonly requestDerivedTokenCeiling: boolean;

  /**
   * Whether the billing block may carry the `cc_prev_req` and `cc_prompt_id`
   * conversation-chaining segments.
   *
   * Consumed by `createBillingBlock` in `fingerprint.ts`. False means the
   * segments are dropped silently even when the caller supplies both, which is
   * what a client with no parameter for them does.
   */
  readonly billingChainSegments: boolean;

  /**
   * Whether `claude-opus-4-5` takes its `effort` capability from the predicate
   * rather than from the catalogue.
   *
   * Consumed by `deriveCapabilities` in `model-capabilities.ts`. See
   * `docs/plans/BLOCKERS.md`, finding C1: this is the one cell where the
   * 2.1.195 catalogue disagrees with the binary that shipped it, and the
   * predicate is wire-authoritative for that profile alone.
   */
  readonly opus45EffortException: boolean;
}

/**
 * Upstream 2.1.195: derivation is predicate-driven, the request builder has no
 * request-derived token ceiling, and the billing block has no parameter for
 * conversation chaining.
 */
const LEGACY_BEHAVIORS: ClaudeCodeProfileBehaviors = Object.freeze({
  requestDerivedTokenCeiling: false,
  billingChainSegments: false,
  opus45EffortException: true,
});

/**
 * Upstream 2.1.222 and later: derivation is catalogue-first, so the
 * `claude-opus-4-5` exception does not apply, and both of the newer request
 * behaviours are present.
 */
const MODERN_BEHAVIORS: ClaudeCodeProfileBehaviors = Object.freeze({
  requestDerivedTokenCeiling: true,
  billingChainSegments: true,
  opus45EffortException: false,
});

/**
 * Resolves the behaviour set a profile follows.
 *
 * Pure and total: every profile answers, and the answer depends on nothing but
 * the profile's identity.
 */
export function profileBehaviors(
  profile: ClaudeCodeProtocolProfile,
): ClaudeCodeProfileBehaviors {
  /*
   * ---- Demarcated: the ONLY per-version identity comparison in `src/`. ----
   *
   * The split is 2.1.195 versus 2.1.222+, and it is structural rather than a
   * capability flag: these are differences in what the upstream builder is
   * written to do, not values it reads from a catalogue. 2.1.195 is the one
   * profile ported from the older builder, so it is the one named here.
   *
   * The default is deliberately the MODERN side. A profile ported from a
   * client newer than 2.1.233 inherits the current behaviour and needs no edit
   * here; only a profile ported from a client OLDER than 2.1.222 would, and
   * adding one is a decision that should require touching this module. Written
   * the other way round — naming the modern profiles and defaulting to legacy
   * — every new profile would silently regress to 2.1.195 semantics.
   *
   * `test/governance/version-dispatch.test.ts` asserts this comparison is
   * here, and that it is nowhere else.
   */
  if (profile.id === CLAUDE_CODE_2_1_195_PROFILE.id) {
    return LEGACY_BEHAVIORS;
  }
  return MODERN_BEHAVIORS;
}
