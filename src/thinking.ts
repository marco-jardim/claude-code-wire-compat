// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeBetaPolicy,
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
} from "./contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

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
 *
 * This module also owns `modelOutputTokenLimits` and `clampMaxTokens`, which
 * bound `max_tokens` rather than anything thinking-specific. They live here
 * because upstream derives both from one table (`Xxe`) and feeds one clamped
 * value (`Fi`) into both the emitted `max_tokens` and the thinking budget, so
 * splitting them would separate two things that must not drift apart. If a
 * third consumer of the limit table ever appears, extract all three into their
 * own module at that point.
 */

/** Permitted values of the `display` property, from the schema at 241453966. */
export type ThinkingDisplay = "summarized" | "omitted";

export interface ThinkingRequest {
  readonly type: "enabled" | "adaptive" | "disabled";
  readonly budgetTokens?: number;
  readonly display?: ThinkingDisplay;
}

export interface ModelOutputTokenLimits {
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
 * Per-model output token limits, ported from upstream `Xxe` at byte offset
 * 227378240. Keyed on the NORMALISED model id.
 *
 * Resolution order, since Fase 1.2:
 *
 *   1. The pinned 2.1.195 catalogue, when the id has an entry carrying
 *      `maxOutputTokens`. That is the single source of truth for every model
 *      the profile knows, and `token-limits-equivalence.test.ts` pins the two
 *      sources cell by cell.
 *   2. Otherwise the transcribed `Xxe` table below, preserved intact as the
 *      demarcated fallback. It is NOT dead code and must not be trimmed to
 *      "only the ids the catalogue lacks": `claude-3-opus`, `claude-3-sonnet`
 *      and `claude-3-haiku` are reachable through the normaliser with no
 *      catalogue entry, `claude-mythos-5` is absent from the catalogue by
 *      product decision D-1, and any id from a newer client lands on the
 *      final fallback row.
 *
 * Both fields are load-bearing. `upperLimit` seeds the thinking budget when the
 * caller supplies none (upstream `wvi = Xxe(e).upperLimit - 1`); `default` caps
 * the emitted `max_tokens` (upstream `qct`, see `clampMaxTokens`).
 *
 * Upstream additionally consults `Vkd` and `bvi`, neither of which is modelled:
 *
 *   - `Vkd(e)` lowers `default` from the host config object `heather_vale`.
 *     That object is absent on a default install, so it returns null and makes
 *     no adjustment. Same class as `W9` in `model-capabilities.ts`: a host-side
 *     override this package cannot observe.
 *   - `bvi(e)` adjusts BOTH fields, but sits behind `_vi()`, which returns a
 *     hard `false`. Dead code upstream.
 *
 * From 2.1.222 onward upstream grew a THIRD adjustment, this one derived from
 * the request rather than from host state, and therefore observable: see
 * `requestedMaxTokens` below.
 *
 * @param requestedMaxTokens
 *   The caller's own `max_tokens`, when the call site has it. Modelled for
 *   profiles from 2.1.222 onward only; see the demarcated block below.
 */
export function modelOutputTokenLimits(
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
  requestedMaxTokens?: number,
): ModelOutputTokenLimits {
  const resolved = resolveDeclaredLimits(normalizedId, profile);

  /*
   * ---- Demarcated: request-derived upper bound, upstream 2.1.222+. ----
   *
   * Upstream raises `upperLimit` to the caller's own `max_tokens` and lowers
   * `default` to fit under it:
   *
   *   upperLimit = requestedMaxTokens;
   *   default    = Math.min(default, upperLimit);
   *
   * Verified byte-identical between upstream 2.1.222 and 2.1.233.
   *
   * The gate is STRUCTURAL, not a capability flag: this behaviour exists in
   * upstream 2.1.222+ and 2.1.195 does not have it, so the 195 profile must
   * never see it. Centralising per-version dispatch — so that this reads as a
   * profile trait rather than an identity comparison — is a later task.
   *
   * `Number.isSafeInteger` is deliberately stricter than upstream's truthy
   * check. The upstream runtime only ever produces integers in this field, so
   * the two agree on every reachable input; here a NaN or Infinity would
   * propagate straight into `budget_tokens`, which must stay an integer.
   */
  if (
    profile.id !== CLAUDE_CODE_2_1_195_PROFILE.id &&
    requestedMaxTokens !== undefined &&
    Number.isSafeInteger(requestedMaxTokens) &&
    requestedMaxTokens >= 4096
  ) {
    const upperLimit = requestedMaxTokens;
    return { default: Math.min(resolved.default, upperLimit), upperLimit };
  }

  return resolved;
}

function resolveDeclaredLimits(
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile,
): ModelOutputTokenLimits {
  const declared = profile.supportedModels[normalizedId]?.maxOutputTokens;
  if (declared !== undefined) {
    // `upper` is the catalogue's name for what this module calls `upperLimit`;
    // the rename happens here and nowhere else.
    return { default: declared.default, upperLimit: declared.upper };
  }

  /*
   * ---- Demarcated fallback: the reachable remainder of `Xxe`. ----
   *
   * No catalogue id reaches this point. Every entry of the 2.1.195 catalogue
   * declares `maxOutputTokens`, and `capability-equivalence.test.ts` fails if
   * one stops doing so, which is what keeps the rows below to the ids the
   * catalogue genuinely cannot answer for:
   *
   *   - `claude-mythos-5` has no catalogue entry by product decision D-1.
   *   - `claude-3-opus`, `claude-3-sonnet` and `claude-3-haiku` are reachable
   *     through the normaliser and predate the catalogue.
   *
   * The rows for catalogued ids were deleted rather than kept "just in case":
   * they were unreachable, so they could be neither covered nor
   * mutation-killed, and a second copy of a limit that no longer serves any
   * request is exactly the duplicated table
   * `test/governance/single-source-of-truth.test.ts` exists to prevent.
   *
   * This mirrors upstream 2.1.222, where derivation is catalogue-first and
   * the surviving legacy rows are the `claude-3-*` ones plus a generic tail.
   *
   * If a future profile omits `maxOutputTokens` for some id, that id lands on
   * the generic tail below -- 32000/128000 -- rather than on a stale
   * per-model row. That is deliberate: a wrong-but-loud generic limit is
   * recoverable, a silently stale per-model limit is not. The equivalence
   * guard fires first in any case.
   */
  if (normalizedId === "claude-mythos-5") {
    return { default: 64000, upperLimit: 128000 };
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
  return { default: 32000, upperLimit: 128000 };
}

/**
 * Caps the caller's `max_tokens` at the model's default output limit, porting
 * upstream `Fi = Math.min(En?.maxTokensOverride || s.maxOutputTokensOverride
 * || la, la)` where `la = qct(u)`.
 *
 * `qct` is `Fue("CLAUDE_CODE_MAX_OUTPUT_TOKENS", <env>, t.default,
 * t.upperLimit).effective` over `t = Xxe(model)`. `Fue` returns `t.default`
 * untouched whenever the environment variable is unset, and only ever clamps
 * the ENVIRONMENT value against `t.upperLimit` — never the default. This
 * package reads no environment, so `qct` reduces to `Xxe(model).default` and
 * `upperLimit` plays no part in this bound.
 *
 * The result is load-bearing twice over: it is the emitted `max_tokens`, and it
 * is the `Fi` that `resolveThinking` clamps the thinking budget against via
 * `Tr = Math.min(Fi - 1, Tr)`. Both call sites must receive the CLAMPED value.
 *
 * Upstream uses `||`, not `??`, so a zero override would fall back to the
 * default. Unreachable here: `max_tokens` is validated as a positive integer
 * before this runs.
 *
 * `requested` is forwarded as the request-derived bound so that this call site
 * reads the same table upstream reads. It cannot change the result: the
 * override only ever lowers `default` to `requested`, and
 * `min(requested, min(default, requested)) === min(requested, default)`. It is
 * passed for coherence of reading, not for effect.
 */
export function clampMaxTokens(
  requested: number,
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): number {
  return Math.min(
    requested,
    modelOutputTokenLimits(normalizedId, profile, requested).default,
  );
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
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
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
      //
      // This is the one wire-visible consumer of the request-derived bound: on
      // a 2.1.222+ profile a caller asking for a `max_tokens` above the
      // catalogue's upper limit seeds the default budget from THEIR number
      // minus one, not from the catalogue's.
      const requested =
        request.budgetTokens ??
        modelOutputTokenLimits(normalizedId, profile, maxTokens).upperLimit - 1;
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
