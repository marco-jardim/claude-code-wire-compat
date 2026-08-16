// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile } from "./contracts.js";
import { supportsStructuredOutputs as portedStructuredOutputs } from "./model-capabilities.js";
import { modelFamilyOf, normalizeModelId } from "./model-identity.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

/*
 * Read-only model queries.
 *
 * DESIGN DECISION (Phase 1.1). Two surfaces, deliberately separate:
 *
 *   1. `modelCapability(model, capability, profile)` -- the GENERIC query. The
 *      catalogue is the source of truth: it normalizes the id, looks the entry
 *      up in `profile.supportedModels` and asks whether the verbatim upstream
 *      capability string is present. It invents nothing, maps nothing, and
 *      therefore answers for capability strings this package does not model as
 *      a `ClaudeCodeCapabilities` field (`fast_mode`, `lean_prompt`,
 *      `fable_5_mitigations`, `mid_conv_system`, ...) as readily as for the
 *      six that it does.
 *
 *   2. The NAMED family/version predicates below -- `isOpus47Model` and
 *      friends. A family is not a catalogue capability; it is an identity
 *      question. They are therefore written over `normalizeModelId` and
 *      `modelFamilyOf`, NOT over a new family regex and NOT over the
 *      catalogue. Consequence, and it is intended: an id normalizing to
 *      `claude-opus-4-7` answers `isOpus47Model` true whether or not the
 *      active profile catalogues it.
 *
 * Do not fold (2) into (1). Asking `modelCapability(model, "adaptive_thinking")`
 * and asking `isAdaptiveThinkingModel(model)` are different questions with
 * different answers for ids the active profile does not catalogue, and both
 * questions have callers.
 *
 * INVALID INPUT. Every predicate here returns `false` for a non-string or an
 * empty id rather than throwing. This departs from `resolveModel`
 * (`ClaudeCodeWireError("INVALID_INPUT")`) on purpose: these are predicates,
 * their upstream counterparts are total functions returning `false` on a
 * falsy model, and a predicate that throws cannot be used in the boolean
 * position its callers put it in.
 *
 * RUNTIME NEUTRALITY. No builtins, no clock, no randomness, no I/O.
 */

/** Lowercased + dotted-to-dashed id, or `null` for input no predicate can answer for. */
function normalizedOrNull(model: string): string | null {
  if (typeof model !== "string" || model.length === 0) {
    return null;
  }
  return normalizeModelId(model);
}

/**
 * Explicit 1M markers a caller can spell into the model id.
 *
 * `\[1m\]` is deliberately absent: it marks a request-time context selection,
 * not an always-1M id, and the upstream marker check does not accept it.
 */
const ONE_MILLION_MARKER_RE = /(^|[-_ ])1m($|[-_ ])|context[-_]?1m/iu;

/** As `ONE_MILLION_MARKER_RE`, plus the bracketed request-time marker. */
const ONE_MILLION_ELIGIBLE_MARKER_RE =
  /(^|[-_ ])1m($|[-_ ])|context[-_]?1m|\[1m\]/iu;

/**
 * Vendor tokens the upstream web-search gate accepts. Transcribed as a token
 * list rather than a regex so it stays a data question, not a pattern-matching
 * one.
 */
const WEB_SEARCH_VENDOR_TOKENS: readonly string[] = Object.freeze([
  "claude",
  "sonnet",
  "opus",
  "haiku",
  "gpt",
  "gemini",
]);

/**
 * Whether the active profile's catalogue records `capability` for `model`.
 *
 * `capability` is a verbatim upstream capability string. Ids the profile does
 * not catalogue answer `false` for every capability: the catalogue is the only
 * evidence this query consults, and absence of evidence is reported as
 * absence. Callers wanting the derived nine-boolean view -- which falls back
 * to the ported predicates for uncatalogued ids -- want `resolveModel`.
 */
export function modelCapability(
  model: string,
  capability: string,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): boolean {
  const id = normalizedOrNull(model);
  if (
    id === null ||
    typeof capability !== "string" ||
    capability.length === 0
  ) {
    return false;
  }
  const entry = profile.supportedModels[id];
  if (entry === undefined) {
    return false;
  }
  return entry.capabilities.includes(capability);
}

/** Whether `model` normalizes to `claude-opus-4-6`. */
export function isOpus46Model(model: string): boolean {
  return normalizedOrNull(model) === "claude-opus-4-6";
}

/** Whether `model` normalizes to `claude-opus-4-7`. */
export function isOpus47Model(model: string): boolean {
  return normalizedOrNull(model) === "claude-opus-4-7";
}

/** Whether `model` normalizes to `claude-opus-4-8`. */
export function isOpus48Model(model: string): boolean {
  return normalizedOrNull(model) === "claude-opus-4-8";
}

/** Whether `model` normalizes to `claude-sonnet-4-6`. */
export function isSonnet46Model(model: string): boolean {
  return normalizedOrNull(model) === "claude-sonnet-4-6";
}

/** Whether `model` normalizes to `claude-fable-5`. */
export function isFable5Model(model: string): boolean {
  return normalizedOrNull(model) === "claude-fable-5";
}

/** Whether `model` normalizes to `claude-mythos-5`. */
export function isMythos5Model(model: string): boolean {
  return normalizedOrNull(model) === "claude-mythos-5";
}

/**
 * Whether `model` belongs to the haiku family.
 *
 * Reuses `modelFamilyOf`, the package's one family classifier, so a new haiku
 * id is classified in exactly one place.
 */
export function isHaikuModel(model: string): boolean {
  const id = normalizedOrNull(model);
  return id !== null && modelFamilyOf(id) === "haiku";
}

/**
 * Whether `model` is a Claude 3 generation id.
 *
 * The `claude-3-` substring test is the same one the ported capability
 * predicates open with (`model-capabilities.ts`), applied to the normalized
 * id, so a Claude 3 id spelled with a dotted version (`claude-3.5-sonnet`)
 * classifies with its hyphenated spelling.
 */
export function isClaude3Model(model: string): boolean {
  return normalizedOrNull(model)?.includes("claude-3-") ?? false;
}

/**
 * Whether `model` may receive the 1M-context beta.
 *
 * Three sources, in order: an explicit 1M marker in the id, the active
 * profile's `context.supports1mBeta`, and -- for ids the profile does not
 * catalogue -- the ported family set (`claude-sonnet-4*`, Opus 4.6/4.7/4.8).
 */
export function isEligibleFor1MContext(
  model: string,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): boolean {
  const id = normalizedOrNull(model);
  if (id === null) {
    return false;
  }
  if (ONE_MILLION_ELIGIBLE_MARKER_RE.test(model)) {
    return true;
  }
  const entry = profile.supportedModels[id];
  if (entry !== undefined) {
    return entry.context?.supports1mBeta === true;
  }
  return (
    id.startsWith("claude-sonnet-4") ||
    id === "claude-opus-4-6" ||
    id === "claude-opus-4-7" ||
    id === "claude-opus-4-8"
  );
}

/**
 * Whether `model` names 1M context explicitly and therefore always uses it.
 *
 * Marker-only by design. The catalogue's `context.native1m` is a DIFFERENT
 * question -- the model's native window -- and consulting it here would make
 * every natively-1M id answer true, which is not what a static "always send
 * 1M" gate means. Use `modelContextWindow`-shaped catalogue reads for that.
 */
export function hasOneMillionContext(model: string): boolean {
  return normalizedOrNull(model) !== null && ONE_MILLION_MARKER_RE.test(model);
}

/**
 * Whether `model` supports the structured-outputs beta.
 *
 * Delegates to the predicate ported from the genuine client (`j4e`), which is
 * narrower and better evidenced than a family-shaped heuristic.
 */
export function supportsStructuredOutputs(model: string): boolean {
  const id = normalizedOrNull(model);
  return id !== null && portedStructuredOutputs(id);
}

/** Whether `model` supports the web-search tool. */
export function supportsWebSearch(model: string): boolean {
  const id = normalizedOrNull(model);
  return (
    id !== null && WEB_SEARCH_VENDOR_TOKENS.some((token) => id.includes(token))
  );
}

/**
 * Whether `model` uses adaptive thinking (`{type: "adaptive"}`) instead of a
 * manual `budget_tokens`.
 *
 * The union of the named family predicates, not a catalogue read: this gates
 * the shape of the emitted `thinking` block, and an uncatalogued id must not
 * inherit adaptive thinking from the permissive capability fallback. Ask
 * `modelCapability(model, "adaptive_thinking", profile)` for the catalogue's
 * answer.
 */
export function isAdaptiveThinkingModel(model: string): boolean {
  return (
    isOpus46Model(model) ||
    isOpus47Model(model) ||
    isOpus48Model(model) ||
    isSonnet46Model(model) ||
    isFable5Model(model) ||
    isMythos5Model(model)
  );
}
