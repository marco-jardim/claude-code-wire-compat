// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeRuntimeIdentity,
  SystemInput,
  TextBlock,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { classifySurrogateAt } from "./unicode.js";

/**
 * The pinned identity text, byte-exact.
 *
 * It is exported because it is the byte-exact probe the parser uses to CONFIRM
 * the canonical system prefix. A caller block equal to it is dropped by
 * `buildCanonicalSystem` — unconditionally, even when `suppressIdentityBlock`
 * removed the canonical one — so it appears at most once in a built body.
 *
 * The parser no longer INFERS the prefix length from this text's position: the
 * root seams `suppressBillingBlock` and `suppressIdentityBlock` are recorded in
 * `evidence.billingBlockSuppressed` / `evidence.identityBlockSuppressed`, which
 * state which canonical blocks were emitted. This text is what the parser then
 * checks the identity slot against, so evidence is verified structurally rather
 * than trusted.
 */
export const IDENTITY_TEXT =
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

function equalCacheControl(
  left: TextBlock["cache_control"],
  right: TextBlock["cache_control"],
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left === null || right === null) return left === right;
  return left.ttl === right.ttl && left.scope === right.scope;
}

function joinTextBlocks(left: TextBlock, right: TextBlock): TextBlock {
  return Object.freeze({
    type: "text",
    text: `${left.text}\n${right.text}`,
    ...(left.cache_control === undefined
      ? {}
      : { cache_control: left.cache_control }),
  });
}

/** Builds the pinned Claude Code system block sequence without changing caller data. */
export function buildCanonicalSystem(
  input: readonly SystemInput[] | undefined,
  billingBlock: TextBlock,
  identity: ClaudeCodeRuntimeIdentity,
  suppressBillingBlock = false,
  suppressIdentityBlock = false,
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

  // Package extension: `suppressBillingBlock` and `suppressIdentityBlock` are
  // the only ways to omit a canonical block. Both default to `false`, which
  // keeps the two-block canonical prefix the genuine client always emits. With
  // both active the canonical prefix is empty and the emitted `system` array
  // holds caller blocks only.
  const blocks: TextBlock[] = suppressBillingBlock ? [] : [canonicalBilling];
  if (!suppressIdentityBlock) {
    blocks.push(
      Object.freeze({
        type: "text",
        text: IDENTITY_TEXT,
        cache_control: Object.freeze({ type: "ephemeral", ttl: "1h" }),
      }),
    );
  }

  if (input !== undefined) {
    let run: TextBlock | undefined;
    for (const entry of input) {
      const block: TextBlock =
        typeof entry === "string"
          ? Object.freeze({ type: "text" as const, text: entry })
          : cloneTextBlock(entry);

      // Upstream recognizes only the byte-for-byte identity constant. Similar
      // caller text remains ordinary prompt content.
      //
      // The drop stays UNCONDITIONAL under `suppressIdentityBlock`: the genuine
      // client drops it too, and a caller block equal to the identity text
      // landing at the front of a suppressed prefix would defeat the parser's
      // structural check of the canonical prefix.
      if (block.text === IDENTITY_TEXT) continue;
      if (run === undefined) {
        run = block;
      } else if (equalCacheControl(run.cache_control, block.cache_control)) {
        run = joinTextBlocks(run, block);
      } else {
        blocks.push(run);
        run = block;
      }
    }
    if (run !== undefined) blocks.push(run);
  }

  return Object.freeze(blocks);
}
