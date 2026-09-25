// SPDX-License-Identifier: GPL-3.0-or-later

export type SurrogateClassification =
  "notSurrogate" | "surrogatePair" | "loneSurrogate";

/**
 * Classifies the UTF-16 code unit at `index`.
 *
 * A trailing high surrogate makes charCodeAt(index + 1) return NaN, and every
 * relational comparison against NaN is false, so the low-surrogate test must be
 * a negated in-range test rather than an out-of-range test.
 */
export function classifySurrogateAt(
  value: string,
  index: number,
): SurrogateClassification {
  const unit = value.charCodeAt(index);
  if (unit >= 0xd800 && unit <= 0xdbff) {
    const next = value.charCodeAt(index + 1);
    return next >= 0xdc00 && next <= 0xdfff ? "surrogatePair" : "loneSurrogate";
  }
  if (unit >= 0xdc00 && unit <= 0xdfff) return "loneSurrogate";
  return "notSurrogate";
}

export type TextViolationReason = "control-char" | "lone-surrogate";

/**
 * One character-level policy violation found while screening a string.
 *
 * `offset` is the UTF-16 code-unit index of the offending unit and `codeUnit`
 * is the unit itself. Both are safe diagnostics: offsets are numbers and the
 * only code units ever reported are control characters or surrogate halves,
 * never prose content.
 */
export interface TextViolation {
  readonly reason: TextViolationReason;
  readonly offset: number;
  readonly codeUnit: number;
}

/**
 * Character-level acceptance policy for one string lane.
 *
 * `rejectControls` rejects every C0 control except TAB (0x09), LF (0x0A) and
 * CR (0x0D), plus DEL (0x7F). `rejectC1` additionally rejects the C1 range
 * (0x80-0x9F); it is only meaningful together with `rejectControls`. Lone
 * surrogates are ALWAYS rejected regardless of policy, because `TextEncoder`
 * silently replaces them with U+FFFD and would desync the body hash.
 */
export interface TextPolicy {
  readonly rejectControls: boolean;
  readonly rejectC1: boolean;
}

/** Body prose: every well-formed UTF-16 string is accepted. */
export const TEXT_POLICY_PROSE: TextPolicy = Object.freeze({
  rejectControls: false,
  rejectC1: false,
});

/**
 * Identifiers and legacy body lanes: C0 except TAB/LF/CR, plus DEL, plus lone
 * surrogates. This is exactly the set the graph inspectors rejected before the
 * shared validator existed.
 */
export const TEXT_POLICY_IDENTIFIER: TextPolicy = Object.freeze({
  rejectControls: true,
  rejectC1: false,
});

/**
 * The pre-unification system-field rule: IDENTIFIER plus the C1 range. Kept so
 * the refactor can reproduce the historical system behavior byte-for-byte; the
 * body-prose relaxation removes this preset.
 */
export const TEXT_POLICY_SYSTEM_LEGACY: TextPolicy = Object.freeze({
  rejectControls: true,
  rejectC1: true,
});

/**
 * Screens one string under `policy`, returning the first violation or null.
 *
 * The walk order matches the historical per-module inspectors: at each index
 * the control check runs before the surrogate check, and a well-formed pair
 * consumes two code units. `classifySurrogateAt` is the single surrogate
 * authority; this function never re-implements it.
 */
export function inspectText(
  value: string,
  policy: TextPolicy,
): TextViolation | null {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (
      policy.rejectControls &&
      ((unit <= 0x1f && unit !== 0x09 && unit !== 0x0a && unit !== 0x0d) ||
        unit === 0x7f ||
        (policy.rejectC1 && unit >= 0x80 && unit <= 0x9f))
    ) {
      return { reason: "control-char", offset: index, codeUnit: unit };
    }
    const classification = classifySurrogateAt(value, index);
    if (classification === "loneSurrogate") {
      return { reason: "lone-surrogate", offset: index, codeUnit: unit };
    }
    if (classification === "surrogatePair") index += 1;
  }
  return null;
}
