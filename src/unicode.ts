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
