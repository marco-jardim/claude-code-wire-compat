// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeCatalogueEntry,
  ClaudeCodeProtocolProfile,
} from "./contracts.js";
import { profileBehaviors } from "./profile-behaviors.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

/*
 * Capability derivation, ported from the genuine client's nine capability
 * predicates.
 *
 * READ THIS FIRST -- there are two derivation paths and they are not
 * interchangeable:
 *
 *   1. Catalogue path (`deriveCapabilitiesFromCatalogue`), taken for every id
 *      present in the 2.1.195 catalogue. Six of the nine capabilities have a
 *      verbatim upstream string in `ClaudeCodeCatalogueEntry.capabilities`
 *      (`effort`, `max_effort`, `xhigh_effort`, `adaptive_thinking`,
 *      `context_management`, `rejects_disabled_thinking`) and are read from
 *      there. The other three (`thinking`, `interleavedThinking`,
 *      `temperature`) have NO catalogue string in any client version and stay
 *      predicate-derived.
 *   2. Predicate fallback (`deriveCapabilitiesFromPredicates`), taken for ids
 *      with no catalogue entry -- `claude-mythos-5` (absent by product
 *      decision D-1), ids from a newer client, and anything that escaped
 *      normalization. Those fall through every exclusion list and resolve
 *      maximally permissive, `temperature` excepted because its predicate is
 *      an allowlist.
 *
 * The two paths agree on every catalogue cell but one; see the demarcated
 * C1 block in `deriveCapabilities`. `test/validation/capability-equivalence
 * .test.ts` pins the agreement cell by cell and pins that one divergence from
 * both sides, so neither path can drift silently.
 *
 * THE LOAD-BEARING FACT about the predicates, stated up front because it is
 * surprising:
 *
 *   On the first-party provider -- the only provider this package targets --
 *   every one of these nine predicates reduces to a pure function of the
 *   normalized model id.
 *
 * Why. Upstream, each predicate has the shape
 *
 *     let override = W9(model, cap);            // env-var capability override
 *     if (override !== undefined) return override;
 *     let id = mo(model);                       // normalize
 *     if (<exclusion list>) return false;
 *     if (JB(id, cap) || id === "claude-mythos-5") return true;
 *     return ZO(l_(model));                     // provider fallback
 *
 * and in this package:
 *
 *   - `W9` opens with `if (td()) return;` and `td()` is true for first party,
 *     so the override always yields `undefined`. It also reads environment
 *     variables, which this package is designed never to do. Guard dropped.
 *   - `ZO(...)` is `provider is firstParty|anthropicAws|foundry|mantle`. The
 *     profile pins `provider: "anthropic"`, so `ZO(...)` is unconditionally
 *     true and `return ZO(l_(e))` becomes `return true`.
 *   - Therefore the `JB(id, cap)` catalogue-membership test and the
 *     `claude-mythos-5` special case can only return `true` from a position
 *     where the fallback already returns `true`. They are unobservable.
 *   - `l_(e) === "foundry"` branches are unreachable for the same reason.
 *   - `ut(CLAUDE_CODE_ALWAYS_ENABLE_EFFORT)` reads an environment variable;
 *     dropped by the same design rule as `W9`.
 *
 * Only the leading exclusion list is observable, so that is all these
 * functions contain.
 *
 * WARNING TO FUTURE READERS. Two things follow that look like bugs and are not:
 *
 *   1. The individual predicates below still carry no `JB`-equivalent
 *      membership test, and must not grow one. Catalogue membership is
 *      consulted in exactly one place -- `deriveCapabilitiesFromCatalogue` --
 *      so the fallback path stays a pure function of the id and the
 *      equivalence between the two paths stays testable. A membership check
 *      inside a predicate would be a dead branch on the catalogue path and an
 *      unreachable one on the fallback path.
 *   2. The catalogue `capabilities` arrays carry strings this module does not
 *      map to a `ClaudeCodeCapabilities` field -- `fast_mode`, `lean_prompt`,
 *      `fable_5_mitigations` and `mid_conv_system`. They are faithful
 *      transcribed evidence and are consumed elsewhere. Do NOT delete them
 *      because this module ignores them.
 *
 * `claude-mythos-5` has no catalogue entry by product decision D-1. Upstream
 * special-cases it by name in `Kw`, `Hke`, `Yte` and `Uot`; this port subsumes
 * those clauses into the first-party fallback, which yields an identical
 * result. The explicit D-1 test asserting its full nine-boolean row is the
 * guard for that equivalence.
 *
 * Model ids reaching these functions have already been normalized by
 * `resolveModel` via `normalizeModelId`.
 */

/**
 * Upstream `Kw` at byte offset 227719902.
 *
 * Elided: the `W9` override, `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT`, the
 * `JB(id, "effort") || id === "claude-mythos-5"` test, and the `ZO` fallback.
 */
export function supportsEffort(normalizedId: string): boolean {
  if (
    normalizedId.includes("claude-3-") ||
    normalizedId === "claude-opus-4-0" ||
    normalizedId === "claude-opus-4-1" ||
    normalizedId === "claude-sonnet-4-0" ||
    normalizedId === "claude-sonnet-4-5" ||
    normalizedId === "claude-haiku-4-5"
  ) {
    return false;
  }
  return true;
}

/**
 * Upstream `Hke` at byte offset 227720257.
 *
 * Its exclusion list is `Kw`'s plus `claude-opus-4-5`. Elided: the `W9`
 * override, the `JB(id, "max_effort") || id === "claude-mythos-5"` test, and
 * the `ZO` fallback.
 */
export function supportsMaxEffort(normalizedId: string): boolean {
  if (
    normalizedId.includes("claude-3-") ||
    normalizedId === "claude-opus-4-0" ||
    normalizedId === "claude-opus-4-1" ||
    normalizedId === "claude-opus-4-5" ||
    normalizedId === "claude-sonnet-4-0" ||
    normalizedId === "claude-sonnet-4-5" ||
    normalizedId === "claude-haiku-4-5"
  ) {
    return false;
  }
  return true;
}

/**
 * Upstream `Yte` at byte offset 227720583.
 *
 * Its exclusion list is `Hke`'s plus `claude-opus-4-6` and
 * `claude-sonnet-4-6`. Elided: the `W9` override, the
 * `JB(id, "xhigh_effort") || id === "claude-mythos-5"` test, and the `ZO`
 * fallback.
 */
export function supportsXhighEffort(normalizedId: string): boolean {
  if (
    normalizedId.includes("claude-3-") ||
    normalizedId === "claude-opus-4-0" ||
    normalizedId === "claude-opus-4-1" ||
    normalizedId === "claude-opus-4-5" ||
    normalizedId === "claude-opus-4-6" ||
    normalizedId === "claude-sonnet-4-0" ||
    normalizedId === "claude-sonnet-4-5" ||
    normalizedId === "claude-sonnet-4-6" ||
    normalizedId === "claude-haiku-4-5"
  ) {
    return false;
  }
  return true;
}

/**
 * Upstream `Uot` at byte offset 227383245.
 *
 * Its exclusion list is `Kw`'s plus `claude-opus-4-5`, matching `Hke`'s today.
 * The two are transcribed separately on purpose: they are independent upstream
 * predicates that happen to agree at this client version. Elided: the `W9`
 * override, the `JB(id, "adaptive_thinking") || id === "claude-mythos-5"`
 * test, and the `ZO` fallback.
 */
export function supportsAdaptiveThinking(normalizedId: string): boolean {
  if (
    normalizedId.includes("claude-3-") ||
    normalizedId === "claude-opus-4-0" ||
    normalizedId === "claude-opus-4-1" ||
    normalizedId === "claude-opus-4-5" ||
    normalizedId === "claude-sonnet-4-0" ||
    normalizedId === "claude-sonnet-4-5" ||
    normalizedId === "claude-haiku-4-5"
  ) {
    return false;
  }
  return true;
}

/**
 * Upstream `D9r` at byte offset 227382784.
 *
 * Reduces to the same body as `supportsInterleavedThinking` and
 * `supportsContextManagement` at this client version. Kept separate on
 * purpose: three independent upstream predicates with different provenance
 * that are versioned independently upstream. Do not merge them.
 *
 * Elided: the `W9` override.
 */
export function supportsThinking(normalizedId: string): boolean {
  return !normalizedId.includes("claude-3-");
}

/**
 * Upstream `QOt` at byte offset 227384610.
 *
 * See the note on `supportsThinking` about the three identical bodies.
 * Elided: the `W9` override, the unreachable `foundry` branch, and the
 * non-`ZO` provider tail (`claude-haiku-4-5` is excluded only for providers
 * outside `ZO`, which cannot occur here -- note this is why haiku 4.5 has
 * interleaved thinking on first party but not on, say, vertex).
 */
export function supportsInterleavedThinking(normalizedId: string): boolean {
  return !normalizedId.includes("claude-3-");
}

/**
 * Upstream `n0d` at byte offset 227385143.
 *
 * See the note on `supportsThinking` about the three identical bodies.
 * Elided: the unreachable `foundry` branch and the non-`ZO` tail
 * `JB(id, "context_management") || id === "claude-mythos-5"`. `n0d` has no
 * `W9` override upstream.
 */
export function supportsContextManagement(normalizedId: string): boolean {
  return !normalizedId.includes("claude-3-");
}

/**
 * Upstream `j4e` at byte offset 227385302.
 *
 * Elided: the unconditionally true `ZO` provider gate.
 * This beta-only gate is intentionally absent from `ClaudeCodeCapabilities`.
 *
 * Stays predicate-derived and takes no part in the catalogue path: no
 * `structured_outputs` string exists in any catalogue entry, so there is
 * nothing to read. Deliberately takes no profile parameter -- upstream does
 * not gate this beta on the catalogue in any modelled version, so making it
 * profile-aware would invent behaviour rather than port it.
 */
export function supportsStructuredOutputs(normalizedId: string): boolean {
  return !(
    normalizedId.includes("claude-3-") ||
    normalizedId === "claude-opus-4-0" ||
    normalizedId === "claude-sonnet-4-0"
  );
}

/**
 * Upstream `RCn` at byte offset 227387413.
 *
 * Elided: host-state gates, the `W9` override, the unobservable `JB`/mythos
 * clause, and the unconditionally true `ZO` fallback. This exclusion list
 * differs from `rejectsDisabledThinking` by one member: that predicate also
 * excludes `claude-opus-4-8`. Do not merge them.
 * This beta-only gate is intentionally absent from `ClaudeCodeCapabilities`.
 *
 * Catalogue-first WHEN a profile is supplied and that profile catalogues the
 * id: `mid_conv_system` exists as a catalogue string, and from 2.1.222+ the
 * catalogue is what upstream reads. The switch is behaviour-preserving for
 * 2.1.195, which is the point of the equivalence pinning in
 * `test/validation/capability-equivalence.test.ts`: in the 2.1.195 catalogue
 * exactly `claude-opus-4-8` and `claude-fable-5` carry the string, and those
 * are exactly the two ids the exclusion list below admits.
 *
 * Without a profile -- or for an id the profile does not catalogue, such as
 * `claude-mythos-5` under 2.1.195 -- the predicate remains authoritative.
 */
export function supportsMidConversationSystem(
  normalizedId: string,
  profile?: ClaudeCodeProtocolProfile,
): boolean {
  const entry = profile?.supportedModels[normalizedId];
  if (entry !== undefined) {
    return entry.capabilities.includes("mid_conv_system");
  }
  return !(
    normalizedId.includes("claude-3-") ||
    normalizedId === "claude-opus-4-0" ||
    normalizedId === "claude-opus-4-1" ||
    normalizedId === "claude-opus-4-5" ||
    normalizedId === "claude-opus-4-6" ||
    normalizedId === "claude-opus-4-7" ||
    normalizedId === "claude-sonnet-4-0" ||
    normalizedId === "claude-sonnet-4-5" ||
    normalizedId === "claude-sonnet-4-6" ||
    normalizedId === "claude-haiku-4-5"
  );
}

/**
 * Upstream `LCn` at byte offset 227385451.
 *
 * INVERTED POLARITY relative to every other predicate in this module: this
 * list is an ALLOWLIST. Membership means temperature IS supported. Do not
 * refactor it into the shared exclusion-list shape.
 *
 * Elided: the `W9` override.
 */
export function supportsTemperature(normalizedId: string): boolean {
  return (
    normalizedId.includes("claude-3-") ||
    normalizedId === "claude-opus-4-0" ||
    normalizedId === "claude-opus-4-1" ||
    normalizedId === "claude-opus-4-5" ||
    normalizedId === "claude-opus-4-6" ||
    normalizedId === "claude-sonnet-4-0" ||
    normalizedId === "claude-sonnet-4-5" ||
    normalizedId === "claude-sonnet-4-6" ||
    normalizedId === "claude-haiku-4-5"
  );
}

/**
 * Upstream `U4e` at byte offset 227382881.
 *
 * Its exclusion list is the widest of the five: every catalogue model except
 * `claude-fable-5`. It has no `W9` override and no `claude-mythos-5` clause
 * upstream. Elided: the `JB(id, "rejects_disabled_thinking")` test and the
 * `ZO` fallback.
 */
export function rejectsDisabledThinking(normalizedId: string): boolean {
  if (
    normalizedId.includes("claude-3-") ||
    normalizedId === "claude-opus-4-0" ||
    normalizedId === "claude-opus-4-1" ||
    normalizedId === "claude-opus-4-5" ||
    normalizedId === "claude-opus-4-6" ||
    normalizedId === "claude-opus-4-7" ||
    normalizedId === "claude-opus-4-8" ||
    normalizedId === "claude-sonnet-4-0" ||
    normalizedId === "claude-sonnet-4-5" ||
    normalizedId === "claude-sonnet-4-6" ||
    normalizedId === "claude-haiku-4-5"
  ) {
    return false;
  }
  return true;
}

/**
 * The six `ClaudeCodeCapabilities` fields the catalogue represents, paired
 * with their verbatim upstream capability string. The three omitted fields --
 * `thinking`, `interleavedThinking`, `temperature` -- have no catalogue
 * string in any client version and are derived from their predicates on both
 * paths.
 */
const CATALOGUE_BACKED_CAPABILITIES = {
  effort: "effort",
  maxEffort: "max_effort",
  xhighEffort: "xhigh_effort",
  adaptiveThinking: "adaptive_thinking",
  contextManagement: "context_management",
  rejectsDisabledThinking: "rejects_disabled_thinking",
} as const;

/**
 * Pure catalogue -> capabilities mapping. Reads nothing but `entry` for the
 * six catalogue-backed fields; `normalizedId` is used only for the three
 * fields the catalogue does not represent.
 *
 * This function applies no exceptions and no id special cases. The one cell
 * where the 2.1.195 catalogue disagrees with the wire is corrected by the
 * caller, so that this mapping stays a faithful reading of the data and the
 * correction stays visible at exactly one site.
 */
export function deriveCapabilitiesFromCatalogue(
  entry: ClaudeCodeCatalogueEntry,
  normalizedId: string,
): ClaudeCodeCapabilities {
  const has = (capability: string): boolean =>
    entry.capabilities.includes(capability);

  return Object.freeze({
    thinking: supportsThinking(normalizedId),
    adaptiveThinking: has(CATALOGUE_BACKED_CAPABILITIES.adaptiveThinking),
    interleavedThinking: supportsInterleavedThinking(normalizedId),
    effort: has(CATALOGUE_BACKED_CAPABILITIES.effort),
    maxEffort: has(CATALOGUE_BACKED_CAPABILITIES.maxEffort),
    xhighEffort: has(CATALOGUE_BACKED_CAPABILITIES.xhighEffort),
    contextManagement: has(CATALOGUE_BACKED_CAPABILITIES.contextManagement),
    temperature: supportsTemperature(normalizedId),
    rejectsDisabledThinking: has(
      CATALOGUE_BACKED_CAPABILITIES.rejectsDisabledThinking,
    ),
  });
}

/**
 * Fallback for ids with no catalogue entry. Every field comes from its
 * predicate, which is the pre-catalogue behaviour of this module, preserved
 * byte for byte in result: unknown ids fall through every exclusion list and
 * resolve maximally permissive, `temperature` excepted (allowlist polarity).
 *
 * `claude-mythos-5` reaches this path -- it has no catalogue entry by product
 * decision D-1 -- and upstream special-cases it by name in `Kw`, `Hke`, `Yte`
 * and `Uot`. Those clauses are subsumed here by the first-party fallback,
 * which yields an identical result.
 */
function deriveCapabilitiesFromPredicates(
  normalizedId: string,
): ClaudeCodeCapabilities {
  return Object.freeze({
    thinking: supportsThinking(normalizedId),
    adaptiveThinking: supportsAdaptiveThinking(normalizedId),
    interleavedThinking: supportsInterleavedThinking(normalizedId),
    effort: supportsEffort(normalizedId),
    maxEffort: supportsMaxEffort(normalizedId),
    xhighEffort: supportsXhighEffort(normalizedId),
    contextManagement: supportsContextManagement(normalizedId),
    temperature: supportsTemperature(normalizedId),
    rejectsDisabledThinking: rejectsDisabledThinking(normalizedId),
  });
}

export function deriveCapabilities(
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): ClaudeCodeCapabilities {
  const entry = profile.supportedModels[normalizedId];
  if (entry === undefined) {
    return deriveCapabilitiesFromPredicates(normalizedId);
  }

  const capabilities = deriveCapabilitiesFromCatalogue(entry, normalizedId);

  /*
   * DEMARCATED EXCEPTION -- docs/plans/BLOCKERS.md, finding C1.
   *
   * Exactly one cell of the 2.1.195 catalogue disagrees with the binary that
   * shipped it: `claude-opus-4-5` omits `effort` from its `capabilities`
   * array, but 2.1.195 derives capabilities from predicate code and `Kw`
   * (`supportsEffort`) does not exclude `claude-opus-4-5`. The predicate is
   * therefore wire-authoritative for this profile, and the golden fixtures
   * and packed-consumer digests prove `effort: true` is what 2.1.195 sends.
   *
   * Scope. This exception belongs to the 2.1.195 profile only, and the
   * behaviour guard below enforces that mechanically. Upstream 2.1.222+
   * switches derivation to the catalogue, which makes `effort: false`
   * genuine there: for those profiles the catalogue IS the truth, so a
   * profile ported from them does NOT inherit this block. Which profiles are
   * on which side is `profile-behaviors.ts`'s question, not this module's.
   */
  if (
    profileBehaviors(profile).opus45EffortException &&
    normalizedId === "claude-opus-4-5"
  ) {
    return Object.freeze({
      ...capabilities,
      effort: supportsEffort(normalizedId),
    });
  }

  return capabilities;
}
