// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeModelFamily } from "./contracts.js";

/** Ports upstream `dp` (binary offset 226644497). */
export function stripModelMarkers(model: string): string {
  return model.replace(/\[(1|2)m\]/gi, "");
}

/** Ports upstream `$_` (binary offset 226639025). */
export function normalizeModelId(model: string): string {
  model = model.toLowerCase();
  if (model.includes("claude-fable-5")) return "claude-fable-5";
  if (model.includes("claude-mythos-5")) return "claude-mythos-5";
  if (model.includes("claude-opus-4-8")) return "claude-opus-4-8";
  if (model.includes("claude-opus-4-7")) return "claude-opus-4-7";
  if (model.includes("claude-opus-4-6")) return "claude-opus-4-6";
  if (model.includes("claude-opus-4-5")) return "claude-opus-4-5";
  if (model.includes("claude-opus-4-1")) return "claude-opus-4-1";
  if (/claude-opus-4(?!-\d(?!\d))/.test(model)) return "claude-opus-4-0";
  if (model.includes("claude-sonnet-4-6")) return "claude-sonnet-4-6";
  if (model.includes("claude-sonnet-4-5")) return "claude-sonnet-4-5";
  if (/claude-sonnet-4(?!-\d(?!\d))/.test(model)) return "claude-sonnet-4-0";
  if (model.includes("claude-haiku-4-5")) return "claude-haiku-4-5";
  if (model.includes("claude-3-7-sonnet")) return "claude-3-7-sonnet";
  if (model.includes("claude-3-5-sonnet")) return "claude-3-5-sonnet";
  if (model.includes("claude-3-5-haiku")) return "claude-3-5-haiku";
  if (model.includes("claude-3-opus")) return "claude-3-opus";
  if (model.includes("claude-3-sonnet")) return "claude-3-sonnet";
  if (model.includes("claude-3-haiku")) return "claude-3-haiku";
  return model.replace(/-\d{8}$/, "");
}

/**
 * Derives the package-local family classification used only by
 * `RedactedRequestEvidence`; upstream has no corresponding family concept.
 */
export function modelFamilyOf(normalizedId: string): ClaudeCodeModelFamily {
  if (normalizedId.includes("fable")) return "fable";
  if (normalizedId.includes("mythos")) return "mythos";
  if (normalizedId.includes("haiku")) return "haiku";
  if (normalizedId.includes("sonnet")) return "sonnet";
  if (normalizedId.includes("opus")) return "opus";
  return "unknown";
}
