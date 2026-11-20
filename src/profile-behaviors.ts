// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile } from "./contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
import { CLAUDE_CODE_2_1_329_PROFILE } from "./profiles/claude-code-2.1.329.js";

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

  /**
   * Whether `messages` may carry `role: "system"` control messages with an
   * `output_config` (the per-turn effort and timing statements).
   *
   * Consumed by the message canonicaliser in `request-body.ts`. False means
   * such a message is refused with `INVALID_INPUT`, which is what every
   * profile did before the shape was transcribed.
   */
  readonly perTurnControlMessages: boolean;

  /**
   * Whether `supportsMidConversationSystem` reads the profile's catalogue
   * (`mid_conv_system` capability string) before falling back to the
   * predicate. False means the predicate alone decides, which is what a client
   * that retired the catalogue string does.
   *
   * Consumed by `supportsMidConversationSystem` in `model-capabilities.ts`.
   */
  readonly midConversationSystemFromCatalogue: boolean;

  /**
   * Whether the thinking-token-count beta is pushed after the per-request
   * sites (site 6′) instead of at its historical position (site 6).
   *
   * Consumed by `composeBetasWithAudit` in `betas.ts`.
   */
  readonly thinkingTokenCountAfterRequestTable: boolean;

  /**
   * Whether the 1M-context beta is withheld for a model whose catalogue entry
   * already declares a native 1M window.
   *
   * Consumed by site 3 of `composeBetasWithAudit` in `betas.ts`.
   */
  readonly longContextExcludesNative1m: boolean;

  /**
   * Whether the model-id normalizer uses the extended ladder (the 5.5 and 5.2
   * rungs). Declared ahead of its reader; inert until the normalizer reads it.
   */
  readonly extendedModelIdLadder: boolean;

  /**
   * Whether headers use the genuine client's layout (names, casing, ordering
   * and the request-class set). Declared ahead of its reader; inert until the
   * header builder reads it.
   */
  readonly genuineHeaderLayout: boolean;

  /**
   * Whether the billing block carries the turn-origin and turn-position
   * segments. Declared ahead of its reader; inert until the fingerprint
   * module reads it.
   */
  readonly billingTurnSegments: boolean;

  /**
   * Whether the request body carries a generated `context_management` when
   * the beta fires. Declared ahead of its reader; inert until the body builder
   * reads it.
   */
  readonly generatedContextManagement: boolean;

  /**
   * Whether the request body carries `diagnostics` alongside the cache
   * diagnosis beta. Declared ahead of its reader; inert until the body builder
   * reads it.
   */
  readonly cacheDiagnosisBody: boolean;

  /**
   * Whether body keys are emitted in the genuine client's order. Declared
   * ahead of its reader; inert until the body builder reads it.
   */
  readonly genuineBodyKeyOrder: boolean;

  /**
   * Whether caller-supplied account-served inputs (dispatch id, inline tools,
   * threads, side-query and agentic-query markers) are honoured. Declared
   * ahead of its reader; inert until the builders read it.
   */
  readonly accountServedInputs: boolean;
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
  perTurnControlMessages: false,
  midConversationSystemFromCatalogue: true,
  thinkingTokenCountAfterRequestTable: false,
  longContextExcludesNative1m: false,
  extendedModelIdLadder: false,
  genuineHeaderLayout: false,
  billingTurnSegments: false,
  generatedContextManagement: false,
  cacheDiagnosisBody: false,
  genuineBodyKeyOrder: false,
  accountServedInputs: false,
});

/**
 * Upstream 2.1.222 through 2.1.280: derivation is catalogue-first, so the
 * `claude-opus-4-5` exception does not apply, and both of the newer request
 * behaviours are present. This is also where a profile with an unrecognised id
 * lands.
 */
const CATALOGUE_ERA_BEHAVIORS: ClaudeCodeProfileBehaviors = Object.freeze({
  requestDerivedTokenCeiling: true,
  billingChainSegments: true,
  opus45EffortException: false,
  perTurnControlMessages: false,
  midConversationSystemFromCatalogue: true,
  thinkingTokenCountAfterRequestTable: false,
  longContextExcludesNative1m: false,
  extendedModelIdLadder: false,
  genuineHeaderLayout: false,
  billingTurnSegments: false,
  generatedContextManagement: false,
  cacheDiagnosisBody: false,
  genuineBodyKeyOrder: false,
  accountServedInputs: false,
});

/**
 * Upstream 2.1.329: the catalogue-era set with the wire-level differences the
 * 2.1.329 analysis records. Every flag that is true here and false in the other
 * two sets is a behaviour the older clients do not have; the flags declared
 * ahead of their readers are inert until a later change reads them.
 */
const WIRE_FAITHFUL_BEHAVIORS: ClaudeCodeProfileBehaviors = Object.freeze({
  requestDerivedTokenCeiling: true,
  billingChainSegments: true,
  opus45EffortException: false,
  perTurnControlMessages: true,
  midConversationSystemFromCatalogue: false,
  thinkingTokenCountAfterRequestTable: true,
  longContextExcludesNative1m: true,
  extendedModelIdLadder: true,
  genuineHeaderLayout: true,
  billingTurnSegments: true,
  generatedContextManagement: true,
  cacheDiagnosisBody: true,
  genuineBodyKeyOrder: true,
  accountServedInputs: true,
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
   * Three sets, two named identities. 2.1.195 is the one profile ported from
   * the older builder; 2.1.329 is the one profile whose wire behaviour was
   * transcribed from a client that no longer reads the catalogue for
   * everything the earlier ones did. Both are named here because each differs
   * in what the upstream builder is written to do, not in values it reads
   * from a catalogue.
   *
   * The fallthrough is deliberately the CATALOGUE-ERA side, and it stays
   * pre-329: a profile whose id is unrecognised (an overridden id, a synthetic
   * profile) keeps the bytes it had before 2.1.329 existed. Adopting the
   * wire-faithful set is something a profile must opt into by being named
   * here, never something it can inherit by accident. Written the other way
   * round — defaulting to legacy — every new profile would silently regress to
   * 2.1.195 semantics.
   *
   * `test/governance/version-dispatch.test.ts` asserts this comparison is
   * here, and that it is nowhere else.
   */
  if (profile.id === CLAUDE_CODE_2_1_195_PROFILE.id) return LEGACY_BEHAVIORS;
  if (profile.id === CLAUDE_CODE_2_1_329_PROFILE.id) {
    return WIRE_FAITHFUL_BEHAVIORS;
  }
  return CATALOGUE_ERA_BEHAVIORS;
}
