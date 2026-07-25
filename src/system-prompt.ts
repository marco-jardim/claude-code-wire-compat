// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeRuntimeIdentity,
  SystemInput,
  TextBlock,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { classifySurrogateAt } from "./unicode.js";

const IDENTITY_TEXT =
  "You are Claude Code, Anthropic's official CLI for Claude.";
const MAX_INPUT_DEPTH = 64;
const MAX_INPUT_SIZE = 1_000_000;
type UnknownRecord = Readonly<Record<PropertyKey, unknown>>;

function fail(
  code:
    | "INVALID_INPUT"
    | "INVALID_UNICODE"
    | "INPUT_TOO_DEEP"
    | "INPUT_TOO_LARGE"
    | "CYCLIC_INPUT",
): never {
  throw new ClaudeCodeWireError(code);
}

function validateText(text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);

    if (
      codeUnit === 0 ||
      (codeUnit < 0x20 &&
        codeUnit !== 0x09 &&
        codeUnit !== 0x0a &&
        codeUnit !== 0x0d) ||
      (codeUnit >= 0x7f && codeUnit <= 0x9f)
    ) {
      fail("INVALID_UNICODE");
    }

    const classification = classifySurrogateAt(text, index);
    if (classification === "loneSurrogate") fail("INVALID_UNICODE");
    if (classification === "surrogatePair") index += 1;
  }
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object";
}

function validateStructure(value: unknown): void {
  const ancestors = new WeakSet();
  let size = 0;

  function visit(current: unknown, depth: number): void {
    if (depth > MAX_INPUT_DEPTH) fail("INPUT_TOO_DEEP");

    if (typeof current === "string") {
      size += current.length;
      if (size > MAX_INPUT_SIZE) fail("INPUT_TOO_LARGE");
      validateText(current);
      return;
    }

    if (!isUnknownRecord(current)) return;
    if (ancestors.has(current)) fail("CYCLIC_INPUT");

    ancestors.add(current);
    for (const key of Reflect.ownKeys(current)) {
      if (typeof key === "string") {
        size += key.length;
        if (size > MAX_INPUT_SIZE) fail("INPUT_TOO_LARGE");
        validateText(key);
      }
      visit(current[key], depth + 1);
    }
    ancestors.delete(current);
  }

  visit(value, 0);
}

function cloneTextBlock(value: unknown): TextBlock {
  if (!isUnknownRecord(value)) fail("INVALID_INPUT");

  const type = value["type"];
  const text = value["text"];
  if (type !== "text" || typeof text !== "string") fail("INVALID_INPUT");

  const cacheControl = value["cache_control"];
  if (cacheControl === undefined) return Object.freeze({ type: "text", text });
  if (!isUnknownRecord(cacheControl)) fail("INVALID_INPUT");

  const cacheType = cacheControl["type"];
  const ttl = cacheControl["ttl"];
  const scope = cacheControl["scope"];
  if (
    cacheType !== "ephemeral" ||
    (ttl !== undefined && ttl !== "5m" && ttl !== "1h") ||
    (scope !== undefined && scope !== "global")
  ) {
    fail("INVALID_INPUT");
  }

  const clonedCacheControl: {
    type: "ephemeral";
    ttl?: "5m" | "1h";
    scope?: "global";
  } = { type: "ephemeral" };
  if (ttl !== undefined) clonedCacheControl.ttl = ttl;
  if (scope !== undefined) clonedCacheControl.scope = scope;

  return Object.freeze({
    type: "text",
    text,
    cache_control: Object.freeze(clonedCacheControl),
  });
}

/** Builds the pinned Claude Code system block sequence without changing caller data. */
export function buildCanonicalSystem(
  input: readonly SystemInput[] | undefined,
  billingBlock: TextBlock,
  identity: ClaudeCodeRuntimeIdentity,
): readonly TextBlock[] {
  validateStructure(input);
  if (input !== undefined && !Array.isArray(input)) fail("INVALID_INPUT");
  if (billingBlock.cache_control !== undefined) fail("INVALID_INPUT");

  const clonedBilling = cloneTextBlock(billingBlock);
  const canonicalBilling = Object.isFrozen(billingBlock)
    ? billingBlock
    : clonedBilling;

  // The runtime identity is accepted for parity with the request builder. The
  // pinned identity system text itself intentionally contains no identifiers.
  void identity;

  const blocks: TextBlock[] = [
    canonicalBilling,
    Object.freeze({
      type: "text",
      text: IDENTITY_TEXT,
      cache_control: Object.freeze({ type: "ephemeral", ttl: "1h" }),
    }),
  ];

  if (input !== undefined) {
    for (const entry of input) {
      const block =
        typeof entry === "string"
          ? Object.freeze({ type: "text" as const, text: entry })
          : cloneTextBlock(entry);

      // Upstream recognizes only the byte-for-byte identity constant. Similar
      // caller text remains ordinary prompt content.
      if (block.text !== IDENTITY_TEXT) blocks.push(block);
    }
  }

  return Object.freeze(blocks);
}
