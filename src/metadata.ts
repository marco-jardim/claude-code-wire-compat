// SPDX-License-Identifier: GPL-3.0-or-later

import { ClaudeCodeWireError } from "./contracts.js";
import type { ClaudeCodeRuntimeIdentity, JsonValue } from "./contracts.js";
import { inspectJsonInputs, validatedJson } from "./request-body.js";
import { classifySurrogateAt } from "./unicode.js";

const MAX_TEXT_LENGTH = 8_192;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const CORRELATION_KEYS = new Set([
  "user_id",
  "device_id",
  "account_uuid",
  "session_id",
]);

function hasInvalidUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const classification = classifySurrogateAt(value, index);
    if (classification === "loneSurrogate") return true;
    if (classification === "surrogatePair") index += 1;
  }
  return false;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

function ownDataValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor === undefined || !("value" in descriptor)
    ? undefined
    : descriptor.value;
}

function validateIdentityText(
  value: unknown,
  field: keyof ClaudeCodeRuntimeIdentity,
): string {
  if (typeof value !== "string") {
    throw new ClaudeCodeWireError("INVALID_IDENTITY", { field });
  }
  if (hasInvalidUtf16(value)) {
    throw new ClaudeCodeWireError("INVALID_UNICODE", { field });
  }
  if (
    value.length === 0 ||
    value.length > MAX_TEXT_LENGTH ||
    value.trim().length === 0 ||
    hasControlCharacter(value)
  ) {
    throw new ClaudeCodeWireError("INVALID_IDENTITY", { field });
  }
  return value;
}

function validateIdentityObject(identity: unknown): object {
  if (
    typeof identity !== "object" ||
    identity === null ||
    Array.isArray(identity)
  ) {
    throw new ClaudeCodeWireError("INVALID_IDENTITY");
  }
  for (const key of Reflect.ownKeys(identity)) {
    if (typeof key !== "string" || FORBIDDEN_KEYS.has(key)) {
      throw new ClaudeCodeWireError("INVALID_IDENTITY");
    }
  }
  return identity;
}

export function validateRuntimeIdentity(
  identity: unknown,
): ClaudeCodeRuntimeIdentity {
  const source = validateIdentityObject(identity);
  const sessionId = validateIdentityText(
    ownDataValue(source, "sessionId"),
    "sessionId",
  );
  const deviceId = validateIdentityText(
    ownDataValue(source, "deviceId"),
    "deviceId",
  );
  const accountUuid = validateIdentityText(
    ownDataValue(source, "accountUuid"),
    "accountUuid",
  );
  const runtime = validateIdentityText(
    ownDataValue(source, "runtime"),
    "runtime",
  );
  const runtimeVersion = validateIdentityText(
    ownDataValue(source, "runtimeVersion"),
    "runtimeVersion",
  );
  const os = validateIdentityText(ownDataValue(source, "os"), "os");
  const arch = validateIdentityText(ownDataValue(source, "arch"), "arch");

  if (runtime !== "node" && runtime !== "bun" && runtime !== "workerd") {
    throw new ClaudeCodeWireError("INVALID_IDENTITY", { field: "runtime" });
  }
  if (os !== "Windows" && os !== "Linux" && os !== "macOS") {
    throw new ClaudeCodeWireError("INVALID_IDENTITY", { field: "os" });
  }

  return Object.freeze({
    sessionId,
    deviceId,
    accountUuid,
    runtime,
    runtimeVersion,
    os,
    arch,
  });
}

function validateMetadataKey(key: PropertyKey): string {
  if (typeof key !== "string" || FORBIDDEN_KEYS.has(key)) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  if (hasInvalidUtf16(key)) {
    throw new ClaudeCodeWireError("INVALID_UNICODE", { field: "metadataKey" });
  }
  if (key.length > MAX_TEXT_LENGTH) {
    throw new ClaudeCodeWireError("INPUT_TOO_LARGE", {
      field: "metadataKey",
    });
  }
  if (key.length === 0 || hasControlCharacter(key)) {
    throw new ClaudeCodeWireError("INVALID_INPUT", { field: "metadataKey" });
  }
  return key;
}

function validateMetadataValue(value: unknown, key: string): JsonValue {
  if (typeof value === "string") {
    if (hasInvalidUtf16(value)) {
      throw new ClaudeCodeWireError("INVALID_UNICODE", { field: key });
    }
    if (value.length > MAX_TEXT_LENGTH) {
      throw new ClaudeCodeWireError("INPUT_TOO_LARGE", { field: key });
    }
    if (hasControlCharacter(value)) {
      throw new ClaudeCodeWireError("INVALID_UNICODE", { field: key });
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ClaudeCodeWireError("INVALID_INPUT", { field: key });
    }
    return value;
  }
  if (typeof value === "boolean" || value === null) return value;
  if (typeof value !== "object") {
    throw new ClaudeCodeWireError("INVALID_INPUT", { field: key });
  }
  inspectJsonInputs([value], (nestedString) => {
    if (hasInvalidUtf16(nestedString)) {
      throw new ClaudeCodeWireError("INVALID_UNICODE", { field: key });
    }
    if (nestedString.length > MAX_TEXT_LENGTH) {
      throw new ClaudeCodeWireError("INPUT_TOO_LARGE", { field: key });
    }
    if (hasControlCharacter(nestedString)) {
      throw new ClaudeCodeWireError("INVALID_UNICODE", { field: key });
    }
  });
  return validatedJson(value);
}

function expectedCorrelationValue(
  key: string,
  identity: ClaudeCodeRuntimeIdentity,
  userId: string,
): string | undefined {
  switch (key) {
    case "user_id":
      return userId;
    case "device_id":
      return identity.deviceId;
    case "account_uuid":
      return identity.accountUuid;
    case "session_id":
      return identity.sessionId;
    default:
      return undefined;
  }
}

function validateMetadataObject(metadata: unknown): object {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    throw new ClaudeCodeWireError("INVALID_INPUT", { field: "metadata" });
  }
  return metadata;
}

export function buildCorrelatedMetadata(
  identity: ClaudeCodeRuntimeIdentity,
  suppliedMetadata?: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  const validatedIdentity = validateRuntimeIdentity(identity);
  const userId = JSON.stringify({
    device_id: validatedIdentity.deviceId,
    account_uuid: validatedIdentity.accountUuid,
    session_id: validatedIdentity.sessionId,
  });
  const entries: [string, JsonValue][] = [["user_id", userId]];

  if (suppliedMetadata === undefined) return Object.freeze({ user_id: userId });
  const metadataObject = validateMetadataObject(suppliedMetadata);

  for (const rawKey of Reflect.ownKeys(metadataObject)) {
    const key = validateMetadataKey(rawKey);
    const value = validateMetadataValue(ownDataValue(metadataObject, key), key);
    if (CORRELATION_KEYS.has(key)) {
      const expected = expectedCorrelationValue(key, validatedIdentity, userId);
      if (value !== expected) {
        throw new ClaudeCodeWireError("INVALID_INPUT", { field: key });
      }
      if (key === "user_id") continue;
    }
    entries.push([key, value]);
  }

  return Object.freeze(Object.fromEntries(entries));
}
