// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeCapabilities } from "./contracts.js";

/*
 * Capability derivation, ported from the genuine client's nine capability
 * predicates.
 *
 * THE LOAD-BEARING FACT, stated up front because it is surprising:
 *
 *   On the first-party provider -- the only provider this package targets --
 *   every one of these nine predicates reduces to a pure function of the
 *   normalized model id. The catalogue's `capabilities` string array does not
 *   participate in capability derivation at all.
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
 *   1. No membership test was lost. Do NOT "restore" a `JB`-equivalent check
 *      here. Adding one back cannot change any result, but it reintroduces
 *      dead branches that cannot be covered or mutation-killed.
 *   2. The catalogue `capabilities` arrays are retained in the profile as
 *      faithful transcribed evidence AND are consumed elsewhere --
 *      `mid_conv_system`, `lean_prompt` and `fast_mode` are read by later
 *      work packages. Do NOT delete them because this module ignores them.
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
 */
export function supportsMidConversationSystem(normalizedId: string): boolean {
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

export function deriveCapabilities(
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
