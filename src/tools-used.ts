// SPDX-License-Identifier: GPL-3.0-or-later

import { ClaudeCodeWireError } from "./contracts.js";

/**
 * The `x-claude-code-sandy-plover` header: the tools the conversation has used.
 *
 * Transcribed from the 2.1.329 bundle (view lines 132137-132147, offsets
 * 13706379-13708766): `ka` maps each entry to `{name, ...(mcp === true &&
 * {mcp}), ...bao(url, directory_entry, unresolved)}`, so the keys are emitted
 * in the order `name`, `mcp` (only when true), `url`; `_p` serialises each with
 * `JSON.stringify`, stops at 64 entries or 7168 bytes, and the value is
 * `[` + entries joined with `,` + `]`.
 *
 * Deliberately NOT ported: `directory_entry` and `unresolved` (host-state
 * concepts of the connector-download tracker) and the truncation sentinel
 * (`pFt`, unresolved). Where the genuine client truncates, this package
 * refuses: a value over the caps is `INVALID_INPUT`. Listing the built-in tool
 * names after the others (the genuine `va` ordering) is the host's job; entry
 * order here is the caller's.
 */

/** Entries above this count make the genuine client truncate (`our`). */
export const TOOLS_USED_MAX_ENTRIES = 64;
/** Serialized byte ceiling of the header value (`Rd`). */
export const TOOLS_USED_MAX_BYTES = 7168;
/** Longest accepted tool name in bytes (`jS`); longer names are dropped. */
export const TOOLS_USED_MAX_NAME_BYTES = 256;

const ALLOWED_KEYS: ReadonlySet<string> = new Set(["name", "mcp", "url"]);
const PRINTABLE_ASCII = /^[\u0020-\u007e]*$/u;

/** One validated, normalised entry. `mcp` is present only when true. */
export interface ToolsUsedEntry {
  readonly name: string;
  readonly mcp?: true;
  readonly url?: string;
}

function invalid(
  details: Readonly<Record<string, string | number | boolean>> = {},
): never {
  throw new ClaudeCodeWireError("INVALID_INPUT", details);
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateEntry(value: unknown): ToolsUsedEntry | undefined {
  if (!isPlainRecord(value)) return invalid();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !ALLOWED_KEYS.has(key)) return invalid();
  }
  const name = Object.hasOwn(value, "name") ? value["name"] : undefined;
  if (typeof name !== "string" || !PRINTABLE_ASCII.test(name)) return invalid();
  const mcp = Object.hasOwn(value, "mcp") ? value["mcp"] : undefined;
  if (mcp !== undefined && typeof mcp !== "boolean") return invalid();
  const url = Object.hasOwn(value, "url") ? value["url"] : undefined;
  if (
    url !== undefined &&
    (typeof url !== "string" || !PRINTABLE_ASCII.test(url))
  ) {
    return invalid();
  }
  // Printable ASCII: one byte per character, so length is the byte length.
  if (name === "" || name.length > TOOLS_USED_MAX_NAME_BYTES) return undefined;
  return Object.freeze({
    name,
    ...(mcp === true ? { mcp: true as const } : {}),
    ...(url === undefined ? {} : { url }),
  });
}

/**
 * Serializes entries exactly as the genuine client does. Total over any
 * `ToolsUsedEntry` list; the caps are enforced by `validateToolsUsed`.
 */
export function serializeToolsUsed(entries: readonly ToolsUsedEntry[]): string {
  const serialized = entries.map((entry) =>
    JSON.stringify({
      name: entry.name,
      ...(entry.mcp === true ? { mcp: true } : {}),
      ...(entry.url === undefined ? {} : { url: entry.url }),
    }),
  );
  return `[${serialized.join(",")}]`;
}

/**
 * Validates caller input and returns the normalised entries.
 *
 * Throws `INVALID_INPUT` for a non-array, more than 64 entries
 * (`{maximumItems: 64}`), an entry that is not a record with only the keys
 * `name`, `mcp` and `url`, a mistyped member, a non-printable-ASCII `name` or
 * `url`, or a serialized value over 7168 bytes (`{maximumSize: 7168}`). Entries
 * with an empty name or a name over 256 bytes are dropped silently, as upstream
 * does.
 */
export function validateToolsUsed(value: unknown): readonly ToolsUsedEntry[] {
  if (!Array.isArray(value)) return invalid();
  if (value.length > TOOLS_USED_MAX_ENTRIES) {
    return invalid({ maximumItems: TOOLS_USED_MAX_ENTRIES });
  }
  const entries: ToolsUsedEntry[] = [];
  for (const candidate of value as readonly unknown[]) {
    const entry = validateEntry(candidate);
    if (entry !== undefined) entries.push(entry);
  }
  // Printable ASCII only, so the serialized length is its byte length.
  if (serializeToolsUsed(entries).length > TOOLS_USED_MAX_BYTES) {
    return invalid({ maximumSize: TOOLS_USED_MAX_BYTES });
  }
  return Object.freeze(entries);
}

/**
 * Reads a header value back into entries, for the request parser. The parser
 * rebuilds the header from the result and compares bytes, so any value this
 * accepts but would not serialize identically is still refused there.
 */
export function parseToolsUsedHeaderValue(
  value: string,
): readonly ToolsUsedEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return invalid();
  }
  return validateToolsUsed(parsed);
}
