// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeBetaPolicy,
  ClaudeCodeCapabilities,
} from "./contracts.js";

/**
 * Extended-thinking resolution, ported from the genuine client's request
 * builder at byte offset 238154330.
 *
 * The single most surprising thing in here, and the reason this module exists
 * rather than a handful of inline branches: **the caller does not choose
 * between adaptive and enabled thinking — the model does.**
 *
 * Upstream the choice is
 *
 * ```
 * cn = aSr(s.model);
 * if (cn !== void 0 ? cn === "adaptive" : Uot(u) && !zt) { adaptive } else { enabled }
 * ```
 *
 * `aSr` is `Bt.thinkingTypeOverrides.get(e)`, a host-side override map that is
 * empty on a default install, so `cn` is undefined and the ternary falls through
 * to `Uot(u)` — the adaptive-thinking capability predicate. `zt` additionally
 * requires an environment variable that is unset by default.
 *
 * So a caller asking for `type: "enabled"` against an adaptive-capable model
 * gets `{type:"adaptive"}` on the wire and their `budgetTokens` is discarded,
 * and a caller asking for `type: "adaptive"` against a model without the
 * capability gets `{type:"enabled",budget_tokens:…}`. The caller's `type` is
 * load-bearing in exactly one way: whether or not it is `"disabled"`.
 *
 * This package reproduces that. Rejecting the mismatch instead — which is what
 * it used to do — would make its traffic distinguishable from the real client's,
 * which is the one thing it exists to avoid.
 */

/** Permitted values of the `display` property, from the schema at 241453966. */
export type ThinkingDisplay = "summarized" | "omitted";

export interface ThinkingRequest {
  readonly type: "enabled" | "adaptive" | "disabled";
  readonly budgetTokens?: number;
  readonly display?: ThinkingDisplay;
}

export interface ThinkingBudgetLimits {
  readonly default: number;
  readonly upperLimit: number;
}

export interface ResolvedThinking {
  /** The object to place at `body.thinking`, or undefined to omit the field. */
  readonly emitted: Readonly<Record<string, unknown>> | undefined;
  /**
   * Whether the caller asked for thinking at all, regardless of whether any
   * `thinking` object survived resolution. This — not `emitted` — is what
   * suppresses `temperature`, matching upstream `nr`.
   */
  readonly requestActive: boolean;
  /** Whether `tool_choice` of type `tool` must be demoted to `auto`. */
  readonly extendedThinkingActive: boolean;
}

/**
 * Per-model thinking budget limits, ported from upstream `Xxe` at byte offset
 * 227378240. Keyed on the NORMALISED model id, and deliberately independent of
 * the catalogue: `claude-3-opus`, `claude-3-sonnet` and `claude-3-haiku` are
 * reachable through the normaliser but have no catalogue entry.
 *
 * Upstream additionally consults `Vkd` and `bvi`, but both adjust only
 * `default`, never `upperLimit`, and `bvi` sits behind `_vi()` which returns
 * false. Only `upperLimit` is consumed here, so neither is modelled.
 */
export function thinkingBudgetLimits(
  normalizedId: string,
): ThinkingBudgetLimits {
  if (normalizedId === "claude-fable-5" || normalizedId === "claude-mythos-5") {
    return { default: 64000, upperLimit: 128000 };
  }
  if (normalizedId === "claude-opus-4-8") {
    return { default: 64000, upperLimit: 128000 };
  }
  if (normalizedId === "claude-opus-4-7") {
    return { default: 64000, upperLimit: 128000 };
  }
  if (normalizedId === "claude-sonnet-4-6") {
    return { default: 32000, upperLimit: 128000 };
  }
  if (normalizedId === "claude-opus-4-6") {
    return { default: 64000, upperLimit: 128000 };
  }
  if (
    normalizedId === "claude-opus-4-5" ||
    normalizedId === "claude-sonnet-4-0" ||
    normalizedId === "claude-sonnet-4-5" ||
    normalizedId === "claude-haiku-4-5"
  ) {
    return { default: 32000, upperLimit: 64000 };
  }
  if (
    normalizedId === "claude-opus-4-1" ||
    normalizedId === "claude-opus-4-0"
  ) {
    return { default: 32000, upperLimit: 32000 };
  }
  if (normalizedId === "claude-3-opus") {
    return { default: 4096, upperLimit: 4096 };
  }
  if (normalizedId === "claude-3-sonnet") {
    return { default: 8192, upperLimit: 8192 };
  }
  if (normalizedId === "claude-3-haiku") {
    return { default: 4096, upperLimit: 4096 };
  }
  if (
    normalizedId === "claude-3-5-sonnet" ||
    normalizedId === "claude-3-5-haiku"
  ) {
    return { default: 8192, upperLimit: 8192 };
  }
  if (normalizedId === "claude-3-7-sonnet") {
    return { default: 32000, upperLimit: 64000 };
  }
  return { default: 32000, upperLimit: 128000 };
}

/**
 * Upstream `Yn = nr && CM() && QOt(u) ? n.display : void 0`, combined with the
 * `if (Xn && Yn)` guard on the beta splice.
 *
 * This answers the splice question on its own, without consulting whether a
 * `thinking` object was actually emitted, because the two are equivalent: a true
 * result requires `type !== "disabled"` and `capabilities.thinking`, and those
 * two conditions are exactly what drives `resolveThinking` into one of its two
 * emitting branches. Upstream's `Xn` is therefore always set whenever `Yn` is.
 *
 * Deliberately tolerant of unvalidated input so that request assembly can ask
 * this question before the body validator has run. Anything malformed answers
 * false here and is rejected later by `buildCanonicalBody`.
 */
export function isThinkingDisplayActive(
  request: unknown,
  capabilities: ClaudeCodeCapabilities,
  betaPolicy: ClaudeCodeBetaPolicy,
): boolean {
  if (request === null || typeof request !== "object") return false;
  const record = request as Record<string, unknown>;
  if (record["type"] === "disabled") return false;
  const display = record["display"];
  if (display !== "summarized" && display !== "omitted") return false;
  return (
    capabilities.thinking &&
    capabilities.interleavedThinking &&
    betaPolicy.experimentalBetasEnabled
  );
}

/**
 * Resolves the caller's thinking request into the object the genuine client
 * would put on the wire.
 *
 * Key order is load-bearing. Upstream emits `{budget_tokens, type, display}`
 * for the enabled branch — `budget_tokens` FIRST — and `{type, display}` for
 * adaptive. Serialised bodies are compared byte for byte, so the insertion
 * order below must not be rearranged.
 */
export function resolveThinking(
  request: ThinkingRequest | undefined,
  normalizedId: string,
  capabilities: ClaudeCodeCapabilities,
  betaPolicy: ClaudeCodeBetaPolicy,
  maxTokens: number,
): ResolvedThinking {
  // Upstream `nr = n.type !== "disabled" && !CLAUDE_CODE_DISABLE_THINKING`.
  const requestActive = request !== undefined && request.type !== "disabled";
  const displayActive = isThinkingDisplayActive(
    request,
    capabilities,
    betaPolicy,
  );
  const display = displayActive ? request?.display : undefined;

  let emitted: Record<string, unknown> | undefined;

  if (requestActive && capabilities.thinking) {
    if (capabilities.adaptiveThinking) {
      emitted = { type: "adaptive" };
      if (display !== undefined) emitted["display"] = display;
    } else {
      // Upstream: `let Tr = wvi(u)` — the model's upper limit minus one —
      // overridden by the caller's budget when supplied, then clamped by
      // `Tr = Math.min(Fi - 1, Tr)` where `Fi` is the emitted `max_tokens`.
      const requested =
        request.budgetTokens ??
        thinkingBudgetLimits(normalizedId).upperLimit - 1;
      emitted = { budget_tokens: Math.min(maxTokens - 1, requested) };
      emitted["type"] = "enabled";
      if (display !== undefined) emitted["display"] = display;
    }
  } else if (
    request?.type === "disabled" &&
    capabilities.thinking &&
    !capabilities.rejectsDisabledThinking
  ) {
    emitted = { type: "disabled" };
  }

  // Upstream `Jr = Xn?.type === "enabled" || Xn?.type === "adaptive"
  //             || Xn === void 0 && U4e(u)`.
  const extendedThinkingActive =
    emitted?.["type"] === "enabled" ||
    emitted?.["type"] === "adaptive" ||
    (emitted === undefined && capabilities.rejectsDisabledThinking);

  return Object.freeze({
    emitted: emitted === undefined ? undefined : Object.freeze(emitted),
    requestActive,
    extendedThinkingActive,
  });
}
