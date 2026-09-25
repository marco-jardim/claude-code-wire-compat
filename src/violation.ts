// SPDX-License-Identifier: GPL-3.0-or-later

import type { TextViolation } from "./unicode.js";

/*
 * Safe validation-failure diagnostics (decision P1.T1, D4).
 *
 * Every value produced here is safe by construction: reasons come from a
 * closed set, path segments from a closed vocabulary of schema-defined keys
 * plus numeric indices and the `*` placeholder for user-controlled keys, and
 * reported code units only ever come from control or surrogate ranges. No
 * caller text, key name or excerpt can leak through these fields.
 */

export const VIOLATION_REASONS: ReadonlySet<string> = new Set([
  "lone-surrogate",
  "control-char",
  "forbidden-key",
]);

/**
 * Schema-defined keys allowed verbatim in a violation path. Any other object
 * key (tool input names, `input_schema` property names, arbitrary metadata
 * members) is user-controlled text and is reported as `*`.
 */
const PATH_KEY_VOCABULARY: ReadonlySet<string> = new Set([
  "$schema",
  "accept",
  "additionalBetas",
  "additionalProperties",
  "anthropicAdditionalProtection",
  "app",
  "arch",
  "accountUuid",
  "body",
  "cache_control",
  "citations",
  "clientApp",
  "clientRequestId",
  "claudeRemoteContainerId",
  "claudeRemoteSessionId",
  "content",
  "context",
  "crypto",
  "data",
  "default",
  "defer_loading",
  "description",
  "deviceId",
  "document",
  "effort",
  "enum",
  "evidence",
  "examples",
  "extraHeaderPolicy",
  "extraHeaders",
  "headers",
  "id",
  "image",
  "input",
  "input_schema",
  "items",
  "length",
  "max_tokens",
  "maxTokens",
  "media_type",
  "messages",
  "metadata",
  "metadataOverrides",
  "method",
  "model",
  "name",
  "os",
  "output_config",
  "profileOverride",
  "properties",
  "redacted_thinking",
  "required",
  "role",
  "runtime",
  "runtimeVersion",
  "search_results",
  "sessionId",
  "signature",
  "source",
  "stainlessHelper",
  "stainlessRetryCount",
  "stop_sequences",
  "stream",
  "strict",
  "system",
  "text",
  "thinking",
  "timing",
  "title",
  "tool_name",
  "tool_reference",
  "tool_result",
  "tool_use",
  "tool_use_id",
  "tools",
  "type",
  "url",
  "user_id",
  "userId",
  "userIdFields",
]);

const MAX_PATH_SEGMENTS = 16;
const MAX_PATH_LENGTH = 256;
const TRUNCATION_MARKER = "...";

export type ViolationPathSegment = string | number;

function mapSegment(segment: ViolationPathSegment): string {
  if (typeof segment === "number") {
    return Number.isSafeInteger(segment) && segment >= 0
      ? String(segment)
      : "*";
  }
  return PATH_KEY_VOCABULARY.has(segment) ? segment : "*";
}

/**
 * Renders a pointer-like path (`/messages/0/content`) from walk segments.
 * At most 16 segments, then a trailing `/...`; at most 256 characters.
 */
export function formatViolationPath(
  segments: readonly ViolationPathSegment[],
): string {
  const mapped = segments.map(mapSegment);
  const truncated =
    mapped.length > MAX_PATH_SEGMENTS
      ? [...mapped.slice(0, MAX_PATH_SEGMENTS), TRUNCATION_MARKER]
      : mapped;
  const path = `/${truncated.join("/")}`;
  return path.length > MAX_PATH_LENGTH
    ? `${path.slice(0, MAX_PATH_LENGTH - (TRUNCATION_MARKER.length + 1))}/${TRUNCATION_MARKER}`
    : path;
}

export function isValidViolationReason(value: string): boolean {
  return VIOLATION_REASONS.has(value);
}

const PATH_INDEX_SEGMENT = /^\d{1,6}$/u;

/**
 * Revalidates a formatted violation path for the redaction allowlist. Every
 * segment must be a vocabulary key, a decimal index of at most 6 digits, `*`,
 * or the single trailing truncation marker; the whole string is capped.
 */
export function isValidViolationPath(value: string): boolean {
  if (value.length === 0 || value.length > MAX_PATH_LENGTH) return false;
  if (!value.startsWith("/")) return false;
  const segments = value.slice(1).split("/");
  if (segments.length > MAX_PATH_SEGMENTS + 1) return false;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === undefined) return false;
    if (segment === TRUNCATION_MARKER) return index === segments.length - 1;
    if (segment === "*") continue;
    if (PATH_INDEX_SEGMENT.test(segment)) continue;
    if (!PATH_KEY_VOCABULARY.has(segment)) return false;
  }
  return true;
}

/** Numeric range guard for `violationCodeUnit`: controls or surrogates only. */
export function isValidViolationCodeUnit(value: number): boolean {
  if (!Number.isInteger(value) || value < 0) return false;
  return (
    value <= 0x1f ||
    (value >= 0x7f && value <= 0x9f) ||
    (value >= 0xd800 && value <= 0xdfff)
  );
}

/**
 * Builds the safeDetails record for one text violation found at `path`.
 * `inKey` distinguishes an offending object key from an offending value.
 */
export function violationDetails(
  violation: TextViolation,
  path: readonly ViolationPathSegment[],
  textLength: number,
  inKey: boolean,
): Readonly<Record<string, string | number | boolean>> {
  return {
    violationReason: violation.reason,
    violationPath: formatViolationPath(path),
    violationOffset: violation.offset,
    violationCodeUnit: violation.codeUnit,
    violationTextLength: textLength,
    violationInKey: inKey,
  };
}
