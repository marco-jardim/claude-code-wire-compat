// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeAccountFeatures,
  ClaudeCodeDispatchId,
  ClaudeCodeThreadInput,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { validatePreviousMessageId } from "./request-body.js";

/**
 * Account-served features: switches the genuine client flips from a
 * server-served account entitlement this package cannot observe, so the caller
 * states each one explicitly.
 *
 * Every member is validated on every profile, so a malformed value fails the
 * same way everywhere; only a profile whose behaviour set declares
 * `accountServedInputs` acts on a validated value.
 */

const ACCOUNT_FEATURE_KEYS: ReadonlySet<string> = new Set([
  "dispatchId",
  "inlineTools",
  "toolProvenance",
  "thread",
]);
const DISPATCH_IDS: ReadonlySet<string> = new Set(["v2d", "v2s", "v2p"]);
const THREAD_CREATE_KEYS: ReadonlySet<string> = new Set(["type"]);
const THREAD_CONTINUE_KEYS: ReadonlySet<string> = new Set([
  "type",
  "previousMessageId",
]);

function invalid(): never {
  throw new ClaudeCodeWireError("INVALID_INPUT");
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) invalid();
  }
}

function validateDispatchId(value: unknown): ClaudeCodeDispatchId {
  if (typeof value !== "string" || !DISPATCH_IDS.has(value)) return invalid();
  return value as ClaudeCodeDispatchId;
}

function validateBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") return invalid();
  return value;
}

function validateThread(value: unknown): ClaudeCodeThreadInput {
  if (!isPlainRecord(value)) return invalid();
  const type = Object.hasOwn(value, "type") ? value["type"] : undefined;
  if (type === "create") {
    assertKeys(value, THREAD_CREATE_KEYS);
    return Object.freeze({ type: "create" });
  }
  if (type !== "continue") return invalid();
  assertKeys(value, THREAD_CONTINUE_KEYS);
  const previousMessageId = Object.hasOwn(value, "previousMessageId")
    ? value["previousMessageId"]
    : undefined;
  // `null` is a legal `previousMessageId` elsewhere; a continued thread has a
  // message to continue from, so it is not one here.
  const validated =
    previousMessageId === undefined
      ? null
      : validatePreviousMessageId(previousMessageId);
  if (validated === null) return invalid();
  return Object.freeze({ type: "continue", previousMessageId: validated });
}

/**
 * Validates the `accountFeatures` input and returns a normalised, frozen copy.
 *
 * Throws `INVALID_INPUT` for a non-record, an unknown key, a `dispatchId` other
 * than `v2d`/`v2s`/`v2p`, a non-boolean `inlineTools` or `toolProvenance`, or a
 * `thread` that is not `{type:"create"}` or `{type:"continue",
 * previousMessageId}` with a well-formed message id.
 */
export function validateAccountFeatures(
  value: unknown,
): ClaudeCodeAccountFeatures {
  if (!isPlainRecord(value)) return invalid();
  assertKeys(value, ACCOUNT_FEATURE_KEYS);
  const own = (key: string): unknown =>
    Object.hasOwn(value, key) ? value[key] : undefined;
  return Object.freeze({
    ...(Object.hasOwn(value, "dispatchId")
      ? { dispatchId: validateDispatchId(own("dispatchId")) }
      : {}),
    ...(Object.hasOwn(value, "inlineTools")
      ? { inlineTools: validateBoolean(own("inlineTools")) }
      : {}),
    ...(Object.hasOwn(value, "toolProvenance")
      ? { toolProvenance: validateBoolean(own("toolProvenance")) }
      : {}),
    ...(Object.hasOwn(value, "thread")
      ? { thread: validateThread(own("thread")) }
      : {}),
  });
}
