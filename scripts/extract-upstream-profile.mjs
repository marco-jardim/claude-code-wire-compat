// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Extracts wire-relevant protocol data from a JS dump of a Claude Code CLI
 * binary and prints it to stdout as a deterministic JSON report.
 *
 *   node scripts/extract-upstream-profile.mjs --dump <path>
 *
 * ANCHORING POLICY -- the rule this tool exists to honour.
 *
 * The dump is minified. Every identifier in it (`zx`, `Fb_`, `X5p`, ...) is a
 * name the minifier chose for one build and is free to choose differently in
 * the next, so an extractor that anchors on those names silently stops finding
 * anything one release later while still exiting 0. Every anchor here is
 * therefore one of exactly two kinds:
 *
 *   1. A DOMAIN STRING LITERAL. Feature keys (`claude_code`), beta headers
 *      (`claude-code-20250219`), header names (`anthropic-version`), model id
 *      prefixes (`claude-`). Minifiers do not rewrite string contents, so these
 *      survive across builds.
 *   2. LOCAL SYNTACTIC STRUCTURE. A two-argument call whose first argument is a
 *      string literal of feature-key shape; an `Object.freeze([...])` whose
 *      array is immediately `.filter`ed against `null`; a balanced object
 *      literal enclosing an `id:` key AND at least one catalogue-shaped key.
 *
 * Identifiers ARE read -- an array of factory results is a list of identifiers
 * and nothing else -- but only ones this run discovered structurally in the
 * same dump. No minified name is ever written into this file.
 *
 * Where only a minified name could settle a question, the report says so
 * instead of guessing. The auxiliary `new Set([...])` blocks beside the
 * registry are the standing example: their members read a property off a
 * registry entry, and once that property name is minified nothing in the dump
 * says whether it selects the feature key or the header. Such a value is
 * emitted as `{"unresolved": "<reason>"}` rather than a plausible-looking
 * answer. A wrong answer here becomes a wrong header on the wire.
 *
 * KNOWN LIMITS, stated rather than hidden:
 *   - `stainlessPackageVersion` is unresolved on observed builds. The SDK
 *     version is a hoisted const nowhere near the `X-Stainless-Package-Version`
 *     literal that names its header, and no local structure ties the two
 *     together. Widening the window until something dotted turns up would
 *     report whichever unrelated version happened to be nearest, so this stays
 *     unresolved until an anchor exists.
 *   - `userAgent` is unresolved as `anchor-ambiguous` when the `claude-cli/`
 *     literal only appears inside unrelated template text. Observed builds
 *     embed it in prose carrying `${{...}}` substitutions, which is why the
 *     capture is validated as a single-line literal free of `{{` rather than
 *     accepted on the anchor alone.
 *   - Backward scanning (finding the `{` that opens a model object) does not
 *     skip string literals, so a preceding string containing an unbalanced
 *     brace within `MODEL_BACKWARD_WINDOW` characters can hide an object. Such
 *     an occurrence is skipped, never mis-parsed.
 *   - Forward scanning skips string literals but not regex literals; a regex
 *     containing an unbalanced brace inside a scanned region would confuse it.
 *     No observed build puts one there.
 *   - Legacy `claude-3-*` token limits are read from a forward-only window
 *     after the model literal, which is where every observed build puts them.
 *     They are best-effort and marked unresolved when absent.
 *
 * Exit codes: 0 with a JSON report on stdout, or 1 with a single
 * `error=<kind>` line. Never a raw stack trace.
 */

import { readFileSync } from "node:fs";

const FAILURE_EXIT_CODE = 1;

/** How far back from an `id:` key the enclosing `{` is looked for. */
const MODEL_BACKWARD_WINDOW = 4000;
/** How far either side of the registry array auxiliary sets are collected. */
const AUXILIARY_WINDOW = 200_000;
/** Forward-only reach of a scalar anchor to its literal. */
const SCALAR_WINDOW = 400;
/** Forward-only reach of a legacy model literal to its token limit. */
const LEGACY_WINDOW = 120;

const FEATURE_KEY = /^[a-z][a-z0-9_]*$/u;
/*
 * `claude-code-20250219`, `oauth-2025-04-20`, `context-1m-2025-08-07`: a
 * lowercase kebab name closed by a date in one of the two forms upstream has
 * ever used. This is the discriminator that separates a registry factory call
 * from any other two-string call in the bundle.
 */
const BETA_HEADER =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:\d{8}|\d{4}-\d{2}-\d{2})$/u;

const ASSIGNED_FACTORY =
  /([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\s*\(\s*["']([a-z][a-z0-9_]*)["']\s*,\s*["']([a-z][a-z0-9-]*)["']\s*\)/gu;
/*
 * The same call with an identifier where the header literal should be. Upstream
 * hoists one entry's header into a const and passes it by name, so a rule that
 * demands two literals drops that entry and silently renumbers everything after
 * it. This form is far weaker as a discriminator -- `x=f("some_key",y)` is
 * common -- so its matches are kept in a separate pool that only counts for an
 * element the chosen registry array actually references.
 */
const ASSIGNED_INDIRECT_FACTORY =
  /([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\s*\(\s*["']([a-z][a-z0-9_]*)["']\s*,\s*([A-Za-z_$][\w$]*)\s*\)/gu;
const ASSIGNED_NULL = /([A-Za-z_$][\w$]*)\s*=\s*null\b/gu;
const FROZEN_ARRAY = /Object\s*\.\s*freeze\s*\(\s*\[/gu;
const NULL_FILTER =
  /^\s*\.\s*filter\s*\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*\1\s*!==?\s*null\s*\)/u;
const ANY_FILTER = /^\s*\.\s*filter\s*\(/u;
const NEW_SET = /new\s+Set\s*\(\s*\[/gu;
const MODEL_ID_ANCHOR = /(?:"id"|'id'|\bid)\s*:\s*["']claude-/gu;

/*
 * A model object must carry one of these beside its `id` to be a catalogue
 * entry. Without it the `id:"claude-` anchor also matches unrelated records --
 * token descriptors, design-system entries -- that share the id namespace but
 * carry none of the catalogue's shape. They are skipped, not errors.
 */
const CATALOGUE_KEYS = [
  "family",
  "max_output_tokens",
  "capabilities",
  "pricing",
];

const LEGACY_MODELS = ["claude-3-haiku", "claude-3-opus", "claude-3-sonnet"];
const LEGACY_LIMIT = /\b(?:4096|8192|32000|128000)\b/gu;

/**
 * Thrown when a balanced construct runs off the end of the dump. That is the
 * signature of a truncated capture, and it is reported as such rather than as
 * "nothing found" -- a half-copied dump is an operator error worth naming.
 */
class TruncatedDumpError extends Error {}

function unresolved(reason) {
  return { unresolved: reason };
}

/*
 * Sorting keys at the very end is what makes the report byte-stable: every
 * section can build its object in whatever order is convenient and the output
 * still lands in one canonical shape. Arrays keep their order -- for the beta
 * registry that order is the payload.
 */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map((item) => sortKeys(item));
  if (value === null || typeof value !== "object") return value;

  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeys(Reflect.get(value, key));
  }
  return sorted;
}

/** Index of the closing quote of the literal opening at `start`, or -1. */
function skipString(text, start) {
  const quote = text[start];
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === quote) return index;
    if (quote !== "`" && (character === "\n" || character === "\r")) return -1;
  }
  return -1;
}

function skipTrivia(text, start) {
  let index = start;
  while (index < text.length) {
    const character = text[index];
    if (
      character === " " ||
      character === "\t" ||
      character === "\n" ||
      character === "\r"
    ) {
      index += 1;
      continue;
    }
    if (text.startsWith("//", index)) {
      const end = text.indexOf("\n", index);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith("/*", index)) {
      const end = text.indexOf("*/", index);
      index = end < 0 ? text.length : end + 2;
      continue;
    }
    return index;
  }
  return index;
}

/** Index of the bracket closing the one at `openIndex`. Throws when truncated. */
function matchBalanced(text, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' || character === "'" || character === "`") {
      const end = skipString(text, index);
      if (end < 0) throw new TruncatedDumpError("string literal");
      index = end;
      continue;
    }
    if (character === "{" || character === "[" || character === "(") {
      depth += 1;
      continue;
    }
    if (character === "}" || character === "]" || character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new TruncatedDumpError("bracketed construct");
}

/**
 * Index of the `{` that opens the object containing `index`. Bounded, and -1
 * when no enclosing object literal is in reach -- the caller skips rather than
 * widening, because a wider guess is a worse guess.
 */
function enclosingObjectStart(text, index) {
  const floor = Math.max(0, index - MODEL_BACKWARD_WINDOW);
  let depth = 0;
  for (let cursor = index; cursor >= floor; cursor -= 1) {
    const character = text[cursor];
    if (character === "}" || character === "]" || character === ")") {
      depth += 1;
      continue;
    }
    if (character === "{" || character === "[" || character === "(") {
      if (depth === 0) return character === "{" ? cursor : -1;
      depth -= 1;
    }
  }
  return -1;
}

/** Splits the inside of a bracketed list on its top-level commas. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' || character === "'" || character === "`") {
      const end = skipString(text, index);
      if (end < 0) throw new TruncatedDumpError("string literal");
      index = end;
      continue;
    }
    if (character === "{" || character === "[" || character === "(") depth += 1;
    else if (character === "}" || character === "]" || character === ")")
      depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last.length > 0 || parts.length === 0) parts.push(last);
  return parts;
}

const STRING_ESCAPES = new Map([
  ["n", "\n"],
  ["r", "\r"],
  ["t", "\t"],
  ["b", "\b"],
  ["f", "\f"],
  ["v", "\v"],
  ["0", "\0"],
]);

function decodeString(raw) {
  let decoded = "";
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character !== "\\") {
      decoded += character;
      continue;
    }
    const escape = raw[index + 1];
    if (escape === undefined) break;
    if (escape === "u" && raw[index + 2] === "{") {
      const end = raw.indexOf("}", index + 3);
      if (end < 0) break;
      decoded += String.fromCodePoint(
        Number.parseInt(raw.slice(index + 3, end), 16),
      );
      index = end;
      continue;
    }
    if (escape === "u") {
      decoded += String.fromCharCode(
        Number.parseInt(raw.slice(index + 2, index + 6), 16),
      );
      index += 5;
      continue;
    }
    if (escape === "x") {
      decoded += String.fromCharCode(
        Number.parseInt(raw.slice(index + 2, index + 4), 16),
      );
      index += 3;
      continue;
    }
    decoded += STRING_ESCAPES.get(escape) ?? escape;
    index += 1;
  }
  return decoded;
}

/**
 * Marks a value the parser recognised as syntax but cannot reduce to data --
 * an identifier reference, a call, a template with substitutions. Never
 * confusable with a real extracted value.
 */
const OPAQUE = Symbol("opaque");

const NUMBER_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/u;

/*
 * A reader for the JS-value subset a minified bundle actually emits: unquoted
 * keys, `!0`/`!1` for booleans, `1e6` and `.47` for numbers. Objects become
 * Maps so a dump containing a `__proto__` or `constructor` key cannot reach
 * this process's own object graph.
 */
function parseValue(text, start) {
  const index = skipTrivia(text, start);
  if (index >= text.length) throw new TruncatedDumpError("value");

  const character = text[index];
  if (character === '"' || character === "'") {
    const end = skipString(text, index);
    if (end < 0) throw new TruncatedDumpError("string literal");
    return { value: decodeString(text.slice(index + 1, end)), next: end + 1 };
  }
  if (character === "{") return parseObject(text, index);
  if (character === "[") return parseArray(text, index);
  if (text.startsWith("!0", index)) return { value: true, next: index + 2 };
  if (text.startsWith("!1", index)) return { value: false, next: index + 2 };
  if (text.startsWith("true", index)) return { value: true, next: index + 4 };
  if (text.startsWith("false", index)) return { value: false, next: index + 5 };
  if (text.startsWith("null", index)) return { value: null, next: index + 4 };

  const number = NUMBER_LITERAL.exec(text.slice(index, index + 48));
  if (number !== null) {
    return { value: Number(number[0]), next: index + number[0].length };
  }
  return { value: OPAQUE, next: skipOpaque(text, index) };
}

/** Consumes an expression this reader does not model, up to its list separator. */
function skipOpaque(text, start) {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' || character === "'" || character === "`") {
      const end = skipString(text, index);
      if (end < 0) throw new TruncatedDumpError("string literal");
      index = end;
      continue;
    }
    if (character === "{" || character === "[" || character === "(") depth += 1;
    else if (character === "}" || character === "]" || character === ")") {
      if (depth === 0) return index;
      depth -= 1;
    } else if (character === "," && depth === 0) return index;
  }
  throw new TruncatedDumpError("expression");
}

const OBJECT_KEY = /^(?:\.\.\.|([A-Za-z_$][\w$]*)|(\d+(?:\.\d+)?))/u;

function parseObject(text, openIndex) {
  const entries = new Map();
  let index = openIndex + 1;

  for (;;) {
    index = skipTrivia(text, index);
    if (index >= text.length) throw new TruncatedDumpError("object literal");
    if (text[index] === "}") return { value: entries, next: index + 1 };
    if (text[index] === ",") {
      index += 1;
      continue;
    }

    let key;
    const character = text[index];
    if (character === '"' || character === "'") {
      const end = skipString(text, index);
      if (end < 0) throw new TruncatedDumpError("string literal");
      key = decodeString(text.slice(index + 1, end));
      index = end + 1;
    } else if (character === "[") {
      // A computed key: real syntax, unknowable name. Skip the whole property.
      index = matchBalanced(text, index) + 1;
      key = undefined;
    } else {
      const name = OBJECT_KEY.exec(text.slice(index, index + 96));
      if (name === null) {
        index = skipOpaque(text, index);
        continue;
      }
      key = name[1] ?? name[2];
      index += name[0].length;
    }

    index = skipTrivia(text, index);
    if (text[index] !== ":") {
      // Shorthand property or spread: no literal value to record.
      index = skipOpaque(text, index);
      continue;
    }

    const parsed = parseValue(text, index + 1);
    if (key !== undefined && !entries.has(key)) entries.set(key, parsed.value);
    index = parsed.next;
  }
}

function parseArray(text, openIndex) {
  const items = [];
  let index = openIndex + 1;

  for (;;) {
    index = skipTrivia(text, index);
    if (index >= text.length) throw new TruncatedDumpError("array literal");
    if (text[index] === "]") return { value: items, next: index + 1 };
    if (text[index] === ",") {
      index += 1;
      continue;
    }
    const parsed = parseValue(text, index);
    items.push(parsed.value);
    index = parsed.next;
  }
}

function fieldOf(entries, key) {
  return entries instanceof Map ? entries.get(key) : undefined;
}

function assignTyped(target, entries, key, kinds) {
  const value = fieldOf(entries, key);
  if (kinds.includes(typeof value)) target[key] = value;
}

function subRecord(entries, fields) {
  if (!(entries instanceof Map)) return undefined;

  const record = {};
  for (const [key, kinds] of fields) assignTyped(record, entries, key, kinds);
  return Object.keys(record).length > 0 ? record : undefined;
}

function numberRecord(entries) {
  if (!(entries instanceof Map)) return undefined;

  const record = {};
  for (const [key, value] of entries) {
    if (typeof value === "number") record[key] = value;
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

const CONTEXT_FIELDS = [
  ["window", ["number"]],
  ["native_1m", ["boolean"]],
  ["supports_1m_beta", ["boolean"]],
  ["supports_1m_suffix", ["boolean", "string"]],
];
const MAX_OUTPUT_FIELDS = [
  ["default", ["number"]],
  ["upper", ["number"]],
];

/** Known fields only; anything else in the object is ignored, never an error. */
function modelRecord(entries) {
  const record = {};
  assignTyped(record, entries, "id", ["string"]);
  assignTyped(record, entries, "family", ["string"]);

  const context = subRecord(fieldOf(entries, "context"), CONTEXT_FIELDS);
  if (context !== undefined) record.context = context;

  const maxOutput = subRecord(
    fieldOf(entries, "max_output_tokens"),
    MAX_OUTPUT_FIELDS,
  );
  if (maxOutput !== undefined) record.max_output_tokens = maxOutput;

  const capabilities = fieldOf(entries, "capabilities");
  if (Array.isArray(capabilities)) {
    record.capabilities = capabilities.filter(
      (item) => typeof item === "string",
    );
  }

  assignTyped(record, entries, "default_effort", ["string"]);

  const effortCost = numberRecord(fieldOf(entries, "effort_cost_index"));
  if (effortCost !== undefined) record.effort_cost_index = effortCost;

  assignTyped(record, entries, "pricing", ["string"]);
  assignTyped(record, entries, "advisor_rank", ["number"]);
  return record;
}

function factoryTable(dump) {
  const literal = new Map();
  for (const match of dump.matchAll(ASSIGNED_FACTORY)) {
    const [, identifier, featureKey, header] = match;
    if (!FEATURE_KEY.test(featureKey) || !BETA_HEADER.test(header)) continue;
    if (!literal.has(identifier))
      literal.set(identifier, { featureKey, header });
  }

  const indirect = new Map();
  for (const match of dump.matchAll(ASSIGNED_INDIRECT_FACTORY)) {
    const [, identifier, featureKey, headerIdentifier] = match;
    if (!FEATURE_KEY.test(featureKey)) continue;
    if (literal.has(identifier) || indirect.has(identifier)) continue;
    indirect.set(identifier, { featureKey, headerIdentifier });
  }
  return { literal, indirect };
}

/*
 * Reads the literal behind a header identifier the array itself handed us. The
 * name is discovered in this run and interpolated into the search, never
 * written into this file -- the same discipline as reading an array element.
 * Only a value of beta-header shape is accepted, so an identifier that happens
 * to hold some other string resolves to nothing rather than to a wrong header.
 */
function resolveHeaderIdentifier(dump, identifier) {
  const escaped = identifier.replaceAll("$", "\\$");
  const assignment = new RegExp(
    `(?:^|[^\\w$.])${escaped}\\s*=\\s*["']([a-z][a-z0-9-]*)["']`,
    "u",
  );
  const header = assignment.exec(dump)?.[1];
  return header !== undefined && BETA_HEADER.test(header) ? header : undefined;
}

function nullIdentifiers(dump) {
  const identifiers = new Set();
  for (const match of dump.matchAll(ASSIGNED_NULL)) identifiers.add(match[1]);
  return identifiers;
}

/*
 * Locates the frozen registry array. Candidate arrays are scored by how many of
 * their elements resolve to a factory call anchored earlier, and the best score
 * wins: that keeps an unrelated `Object.freeze([...]).filter(...)` elsewhere in
 * the bundle from being mistaken for the registry, without knowing its name.
 */
function frozenRegistryArray(dump, factories) {
  let best;
  for (const match of dump.matchAll(FROZEN_ARRAY)) {
    const openIndex = match.index + match[0].length - 1;
    const closeIndex = matchBalanced(dump, openIndex);
    const tail = dump.slice(closeIndex + 1, closeIndex + 96);
    const nullFiltered = NULL_FILTER.test(tail);
    if (!nullFiltered && !ANY_FILTER.test(tail)) continue;

    const elements = splitTopLevel(dump.slice(openIndex + 1, closeIndex));
    const score = elements.filter((element) =>
      factories.literal.has(element),
    ).length;
    if (score === 0) continue;

    /*
     * Indirect matches count towards the total but never towards the primary
     * score: they are weak enough that letting them decide which array is the
     * registry would hand the choice to any `f("k",x)` call in the bundle.
     */
    const total =
      score +
      elements.filter((element) => factories.indirect.has(element)).length;
    const candidate = {
      elements,
      score,
      total,
      nullFiltered,
      start: openIndex,
      end: closeIndex,
    };
    if (best === undefined || betterCandidate(candidate, best))
      best = candidate;
  }
  return best;
}

function betterCandidate(candidate, best) {
  if (candidate.score !== best.score) return candidate.score > best.score;
  if (candidate.total !== best.total) return candidate.total > best.total;
  return candidate.nullFiltered && !best.nullFiltered;
}

const SET_LITERAL = /^["']([^"']*)["']$/u;
const SET_MEMBER = /^([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)$/u;

function resolveSetMembers(elements, byIdentifier) {
  const members = [];
  for (const element of elements) {
    const literal = SET_LITERAL.exec(element);
    if (literal !== null) {
      members.push(literal[1]);
      continue;
    }

    const member = SET_MEMBER.exec(element);
    if (member === null) {
      return unresolved(
        "a member is neither a string literal nor a single property read",
      );
    }
    const entry = byIdentifier.get(member[1]);
    if (entry === undefined || typeof entry.header !== "string") {
      return unresolved(
        "a member reads a property of an identifier with no anchored factory call",
      );
    }
    if (member[2] !== "header") {
      return unresolved(
        "a member reads a minified property name; nothing in the dump says which of the entry's two strings it selects",
      );
    }
    members.push(entry.header);
  }
  return { members };
}

function auxiliarySets(dump, bounds, byIdentifier) {
  const start =
    bounds === undefined ? 0 : Math.max(0, bounds.start - AUXILIARY_WINDOW);
  const end =
    bounds === undefined
      ? dump.length
      : Math.min(dump.length, bounds.end + AUXILIARY_WINDOW);
  const region = dump.slice(start, end);

  const sets = [];
  for (const match of region.matchAll(NEW_SET)) {
    const openIndex = match.index + match[0].length - 1;
    const closeIndex = matchBalanced(region, openIndex);
    const elements = splitTopLevel(
      region.slice(openIndex + 1, closeIndex),
    ).filter((element) => element.length > 0);
    if (elements.length === 0) continue;
    sets.push(resolveSetMembers(elements, byIdentifier));
  }
  return sets;
}

function extractBetaRegistry(dump) {
  const factories = factoryTable(dump);
  if (factories.literal.size === 0) {
    return unresolved(
      "no two-string factory call of the registry's shape is present",
    );
  }

  const nulls = nullIdentifiers(dump);
  const array = frozenRegistryArray(dump, factories);
  const sets = auxiliarySets(dump, array, factories.literal);

  if (array === undefined) {
    return {
      auxiliarySets: sets,
      entries: [...factories.literal.values()],
      order: "call-order",
      slotOrder: unresolved(
        "no Object.freeze([...]).filter(...) array references the anchored factory calls",
      ),
    };
  }

  const entries = [];
  const nullSlots = [];
  const unresolvedSlots = [];
  array.elements.forEach((element, slot) => {
    const entry = factories.literal.get(element);
    if (entry !== undefined) {
      entries.push(entry);
      return;
    }

    const indirect = factories.indirect.get(element);
    if (indirect !== undefined) {
      const header = resolveHeaderIdentifier(dump, indirect.headerIdentifier);
      entries.push({
        featureKey: indirect.featureKey,
        header: header ?? unresolved("identifier-valued"),
      });
      return;
    }
    if (element === "null" || nulls.has(element)) {
      nullSlots.push(slot);
      return;
    }
    unresolvedSlots.push(slot);
  });

  return {
    auxiliarySets: sets,
    entries,
    nullFiltered: array.nullFiltered,
    nullSlots,
    order: "frozen-array",
    slotCount: array.elements.length,
    unresolvedSlots,
  };
}

/*
 * The same model id appears in many places in a bundle (routing tables, alias
 * maps). The occurrence carrying the most known fields is the catalogue entry;
 * ties keep the earlier one. Catalogue order is the order of first appearance.
 */
function extractModels(dump) {
  const byId = new Map();
  const order = [];

  for (const match of dump.matchAll(MODEL_ID_ANCHOR)) {
    const openIndex = enclosingObjectStart(dump, match.index);
    if (openIndex < 0) continue;

    const parsed = parseObject(dump, openIndex);
    if (!CATALOGUE_KEYS.some((key) => parsed.value.has(key))) continue;

    const record = modelRecord(parsed.value);
    if (typeof record.id !== "string") continue;

    const previous = byId.get(record.id);
    if (previous === undefined) {
      byId.set(record.id, record);
      order.push(record.id);
      continue;
    }
    if (Object.keys(record).length > Object.keys(previous).length) {
      byId.set(record.id, record);
    }
  }
  return order.map((id) => byId.get(id));
}

/** First capture of `pattern` in the window that follows any `anchor` occurrence. */
function literalNear(dump, anchor, pattern, radius = SCALAR_WINDOW) {
  let index = dump.indexOf(anchor);
  while (index >= 0) {
    const match = pattern.exec(
      dump.slice(index, index + anchor.length + radius),
    );
    if (match !== null) return match[1];
    index = dump.indexOf(anchor, index + 1);
  }
  return undefined;
}

function literalAnywhere(dump, pattern) {
  return pattern.exec(dump)?.[1];
}

const USER_AGENT_ANCHOR = "claude-cli/";

/**
 * Contents of the string or template literal containing `index`, or undefined
 * when the surrounding text is not one line of a single literal. Both scans
 * stop at a newline, and the forward scan stops at a backtick that would open
 * a nested template, so an anchor sitting in free-running prose yields nothing
 * instead of a run of unrelated source.
 */
function enclosingLiteral(dump, index) {
  let open = -1;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const character = dump[cursor];
    if (character === "\n" || character === "\r") return undefined;
    if (character === '"' || character === "'" || character === "`") {
      if (dump[cursor - 1] === "\\") continue;
      open = cursor;
      break;
    }
  }
  if (open < 0) return undefined;

  const quote = dump[open];
  for (let cursor = index; cursor < dump.length; cursor += 1) {
    const character = dump[cursor];
    if (character === "\\") {
      cursor += 1;
      continue;
    }
    if (character === "\n" || character === "\r") return undefined;
    if (character === quote) return dump.slice(open + 1, cursor);
    if (character === "`") return undefined;
  }
  return undefined;
}

/*
 * The `claude-cli/` literal is not unique in the bundle: it also appears inside
 * long prose templates that merely mention the user agent. Those carry `{{`
 * from a nested substitution, which no real user-agent template does, and they
 * run past their own line. An anchor that survives both checks is the template;
 * one that does not is reported ambiguous rather than emitted as garbage.
 */
function userAgentTemplate(dump) {
  let index = dump.indexOf(USER_AGENT_ANCHOR);
  if (index < 0) return undefined;

  while (index >= 0) {
    const literal = enclosingLiteral(dump, index);
    if (
      literal !== undefined &&
      literal.includes(USER_AGENT_ANCHOR) &&
      !literal.includes("{{")
    ) {
      return literal;
    }
    index = dump.indexOf(USER_AGENT_ANCHOR, index + 1);
  }
  return unresolved("anchor-ambiguous");
}

const SCALAR_SOURCES = [
  [
    "version",
    (dump) =>
      literalAnywhere(
        dump,
        /\bVERSION\s*[:=]\s*["'](\d+\.\d+\.\d+[\w.+-]*)["']/u,
      ) ?? literalNear(dump, "BUILD_TIME", /["'](\d+\.\d+\.\d+[\w.+-]*)["']/u),
    "no VERSION literal and no dotted version beside BUILD_TIME",
  ],
  [
    "buildTime",
    (dump) =>
      literalAnywhere(dump, /\bBUILD_TIME\s*[:=]\s*["']([^"']+)["']/u) ??
      literalNear(dump, "BUILD_TIME", /["'](\d{4}-\d{2}-\d{2}T[\d:.]+Z?)["']/u),
    "no ISO timestamp beside BUILD_TIME",
  ],
  [
    "gitSha",
    (dump) =>
      literalNear(dump, "GIT_SHA", /["']([0-9a-f]{40})["']/u) ??
      literalAnywhere(dump, /["']([0-9a-f]{40})["']/u),
    "no 40-character hex literal in the dump",
  ],
  [
    "anthropicVersion",
    (dump) =>
      literalNear(dump, "anthropic-version", /["'](\d{4}-\d{2}-\d{2})["']/u),
    "no dated literal beside the anthropic-version header name",
  ],
  [
    "stainlessPackageVersion",
    (dump) =>
      literalNear(
        dump,
        "X-Stainless-Package-Version",
        /["'](\d+\.\d+\.\d+[\w.+-]*)["']/u,
      ) ??
      literalNear(
        dump,
        "x-stainless-package-version",
        /["'](\d+\.\d+\.\d+[\w.+-]*)["']/u,
      ),
    "no dotted version beside the X-Stainless-Package-Version header name",
  ],
  ["userAgent", userAgentTemplate, "no literal containing claude-cli/"],
  [
    "endpoint",
    (dump) =>
      literalAnywhere(dump, /["'](\/v1\/messages\?beta=true)["']/u) ??
      literalAnywhere(dump, /["'](\/v1\/messages[^"'\n]*)["']/u),
    "no /v1/messages literal",
  ],
  [
    /*
     * The salt is a bare 12-hex literal concatenated with seed characters. Hex
     * of that length is not distinctive on its own -- a dump holds thousands of
     * such runs -- so the anchor is the known salt value itself, a domain
     * literal like any header string. An unknown salt is reported unresolved
     * rather than guessed from the shape.
     */
    "fingerprintSalt",
    (dump) => (dump.includes("59cf53e54c78") ? "59cf53e54c78" : undefined),
    "the known salt literal is absent and a bare 12-hex run is not distinguishable from any other hex literal",
  ],
];

function extractScalars(dump) {
  const scalars = {};
  for (const [name, read, reason] of SCALAR_SOURCES) {
    const value = read(dump);
    scalars[name] = value === undefined ? unresolved(reason) : value;
  }
  return scalars;
}

function extractTokenLimits(dump) {
  const limits = {};
  for (const model of LEGACY_MODELS) {
    const found = new Set();
    let index = dump.indexOf(model);
    while (index >= 0) {
      const window = dump.slice(
        index + model.length,
        index + model.length + LEGACY_WINDOW,
      );
      for (const match of window.matchAll(LEGACY_LIMIT))
        found.add(Number(match[0]));
      index = dump.indexOf(model, index + 1);
    }
    if (found.size > 0) limits[model] = [...found].sort((a, b) => a - b);
  }
  return Object.keys(limits).length > 0
    ? limits
    : unresolved(
        "no legacy claude-3 model literal carries a known fallback limit nearby",
      );
}

function isUnresolved(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof Reflect.get(value, "unresolved") === "string"
  );
}

function extract(dump) {
  const report = {
    betaRegistry: extractBetaRegistry(dump),
    models: extractModels(dump),
    scalars: extractScalars(dump),
    tokenLimits: extractTokenLimits(dump),
  };

  const anchored =
    !isUnresolved(report.betaRegistry) ||
    report.models.length > 0 ||
    !isUnresolved(report.tokenLimits) ||
    Object.values(report.scalars).some((value) => !isUnresolved(value));
  if (!anchored) return undefined;

  return report;
}

function dumpArgument(argv) {
  const index = argv.indexOf("--dump");
  if (index === -1) return undefined;

  const dumpPath = argv[index + 1];
  return typeof dumpPath === "string" && dumpPath.length > 0
    ? dumpPath
    : undefined;
}

function fail(kind) {
  console.log(`error=${kind}`);
  process.exitCode = FAILURE_EXIT_CODE;
}

function main(argv) {
  const dumpPath = dumpArgument(argv);
  if (dumpPath === undefined) {
    fail("missing-dump");
    return;
  }

  let dump;
  try {
    dump = readFileSync(dumpPath).toString("utf8");
  } catch {
    // The path is caller-controlled text bound for a CI log; the kind is the
    // useful half of the message and echoing the path is the risky half.
    fail("unreadable-dump");
    return;
  }

  if (dump.trim().length === 0) {
    fail("empty-dump");
    return;
  }

  let report;
  try {
    report = extract(dump);
  } catch (error) {
    if (error instanceof TruncatedDumpError) {
      fail("truncated-dump");
      return;
    }
    fail("extraction-failed");
    return;
  }

  if (report === undefined) {
    fail("no-anchors");
    return;
  }
  console.log(JSON.stringify(sortKeys(report), undefined, 2));
}

main(process.argv.slice(2));
