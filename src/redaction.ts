// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  HeaderPair,
  RedactedRequestEvidence,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";

export interface BuildRedactedEvidenceInput {
  readonly profile: ClaudeCodeProtocolProfile;
  readonly request: ClaudeCodeRequestInput;
  readonly modelFamily: "haiku" | "sonnet" | "opus";
  readonly logicalHeaders: readonly HeaderPair[];
  readonly betaFeatures: readonly string[];
  readonly body: string;
}

const MAX_INPUT_DEPTH = 100;
const MAX_INPUT_SIZE = 1_000_000;
const PROFILE_ID = "claude-code-2.1.195-sdk-0.94.0";
const ENDPOINT = "https://api.anthropic.com/v1/messages?beta=true";
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_ERROR_CODES = new Set([
  "INVALID_INPUT",
  "INVALID_IDENTITY",
  "UNSUPPORTED_MODEL",
  "UNSUPPORTED_CAPABILITY",
  "INVALID_THINKING",
  "INVALID_EFFORT",
  "FORBIDDEN_HEADER",
  "DUPLICATE_HEADER",
  "HEADER_INJECTION",
  "INVALID_UNICODE",
  "INPUT_TOO_DEEP",
  "INPUT_TOO_LARGE",
  "CYCLIC_INPUT",
  "CRYPTO_UNAVAILABLE",
  "REDACTION_FAILURE",
]);

type SafePrimitive = string | number | boolean;

type TraversalEntry =
  | {
      readonly kind: "visit";
      readonly value: unknown;
      readonly depth: number;
    }
  | { readonly kind: "leave"; readonly value: object };

function wireError(
  code:
    | "INVALID_INPUT"
    | "INVALID_UNICODE"
    | "INPUT_TOO_DEEP"
    | "INPUT_TOO_LARGE"
    | "CYCLIC_INPUT"
    | "CRYPTO_UNAVAILABLE"
    | "REDACTION_FAILURE",
  safeDetails: Readonly<Record<string, SafePrimitive>> = {},
): ClaudeCodeWireError {
  return new ClaudeCodeWireError(code, safeDetails);
}

function isValidUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      // A trailing high surrogate makes charCodeAt(index + 1) return NaN.
      // Every relational comparison against NaN is false, so use a negated
      // in-range test.
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function measureString(value: string, encoder: TextEncoder): number {
  if (!isValidUnicode(value)) throw wireError("INVALID_UNICODE");
  return encoder.encode(value).byteLength;
}

function validateInputGraph(value: unknown, encoder: TextEncoder): void {
  const active = new WeakSet();
  const completed = new WeakSet();
  const stack: TraversalEntry[] = [{ kind: "visit", value, depth: 0 }];
  let aggregateSize = 0;

  try {
    // Deliberately make an empty stack the normal loop exit, avoiding an
    // untestable defensive branch after a separate length check.
    let entry: TraversalEntry | undefined;
    while ((entry = stack.pop()) !== undefined) {
      if (entry.kind === "leave") {
        active.delete(entry.value);
        completed.add(entry.value);
        continue;
      }

      const current = entry.value;
      if (entry.depth > MAX_INPUT_DEPTH) {
        throw wireError("INPUT_TOO_DEEP", { maximumDepth: MAX_INPUT_DEPTH });
      }

      if (typeof current === "string") {
        aggregateSize += measureString(current, encoder);
      } else if (
        current === null ||
        typeof current === "number" ||
        typeof current === "boolean" ||
        typeof current === "undefined"
      ) {
        aggregateSize += 1;
      } else if (typeof current !== "object") {
        throw wireError("INVALID_INPUT");
      } else {
        if (active.has(current)) throw wireError("CYCLIC_INPUT");
        if (completed.has(current)) continue;

        const prototype: unknown = Object.getPrototypeOf(current);
        if (
          prototype !== null &&
          prototype !== Object.prototype &&
          prototype !== Array.prototype
        ) {
          throw wireError("INVALID_INPUT");
        }

        active.add(current);
        stack.push({ kind: "leave", value: current });

        const keys = Reflect.ownKeys(current);
        aggregateSize += keys.length;
        for (const key of keys) {
          if (typeof key !== "string") throw wireError("INVALID_INPUT");
          if (FORBIDDEN_KEYS.has(key)) throw wireError("INVALID_INPUT");

          const descriptor = Object.getOwnPropertyDescriptor(current, key);
          if (descriptor === undefined) throw wireError("INVALID_INPUT");
          if (!("value" in descriptor)) throw wireError("INVALID_INPUT");
          if (!descriptor.enumerable) continue;

          aggregateSize += measureString(key, encoder);
          const child: unknown = descriptor.value;
          stack.push({
            kind: "visit",
            value: child,
            depth: entry.depth + 1,
          });
        }
      }

      if (aggregateSize > MAX_INPUT_SIZE) {
        throw wireError("INPUT_TOO_LARGE", { maximumSize: MAX_INPUT_SIZE });
      }
    }
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) throw error;
    throw wireError("REDACTION_FAILURE");
  }
}

function isCryptoProvider(value: unknown): value is Pick<Crypto, "subtle"> {
  if (typeof value !== "object" || value === null) return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, "subtle");
  if (descriptor !== undefined && "value" in descriptor) {
    return typeof descriptor.value === "object" && descriptor.value !== null;
  }
  try {
    return typeof Reflect.get(value, "subtle") === "object";
  } catch {
    return false;
  }
}

function getDefaultCrypto(): Pick<Crypto, "subtle"> {
  let candidate: unknown;
  try {
    candidate = globalThis.crypto;
  } catch {
    throw wireError("CRYPTO_UNAVAILABLE");
  }
  if (!isCryptoProvider(candidate)) throw wireError("CRYPTO_UNAVAILABLE");
  return candidate;
}

function selectCryptoProvider(
  injected: Pick<Crypto, "subtle"> | undefined,
): Pick<Crypto, "subtle"> {
  if (injected !== undefined) return injected;
  return getDefaultCrypto();
}

function toHex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}

function capabilityDecisions(
  input: BuildRedactedEvidenceInput,
): Readonly<Record<keyof ClaudeCodeCapabilities, boolean>> {
  const defaults = input.profile.defaultCapabilities;
  const requested = input.request.capabilities;
  return Object.freeze({
    contextHint: requested?.contextHint ?? defaults.contextHint,
    adaptiveThinking: requested?.adaptiveThinking ?? defaults.adaptiveThinking,
    effort: requested?.effort ?? defaults.effort,
    interleavedThinking:
      requested?.interleavedThinking ?? defaults.interleavedThinking,
  });
}

function readOwnValue(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    throw wireError("INVALID_INPUT");
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw wireError("INVALID_INPUT");
  }
  const result: unknown = descriptor.value;
  return result;
}

function assertEvidenceSources(value: unknown): void {
  const profile = readOwnValue(value, "profile");
  const profileId = readOwnValue(profile, "id");
  const endpoint = readOwnValue(profile, "endpoint");
  const modelFamily = readOwnValue(value, "modelFamily");
  const logicalHeaders = readOwnValue(value, "logicalHeaders");
  const betaFeatures = readOwnValue(value, "betaFeatures");

  if (profileId !== PROFILE_ID || endpoint !== ENDPOINT) {
    throw wireError("INVALID_INPUT");
  }
  if (
    modelFamily !== "haiku" &&
    modelFamily !== "sonnet" &&
    modelFamily !== "opus"
  ) {
    throw wireError("INVALID_INPUT");
  }
  if (!Array.isArray(logicalHeaders) || !Array.isArray(betaFeatures)) {
    throw wireError("INVALID_INPUT");
  }
}

function containsCredential(
  value: string,
  credentials: readonly string[],
): boolean {
  for (const credential of credentials) {
    if (credential.length > 0 && value.includes(credential)) return true;
  }
  return false;
}

function collectCredentialValues(
  input: BuildRedactedEvidenceInput,
): readonly string[] {
  const credentials = [input.request.accessToken];
  for (const header of input.logicalHeaders) {
    const candidate: unknown = header;
    if (!Array.isArray(candidate) || candidate.length !== 2) {
      throw wireError("INVALID_INPUT");
    }
    const name = header[0];
    const value = header[1];
    if (typeof name !== "string" || typeof value !== "string") {
      throw wireError("INVALID_INPUT");
    }
    if (name.toLowerCase() === "authorization") {
      const separator = value.indexOf(" ");
      credentials.push(separator === -1 ? value : value.slice(separator + 1));
    }
  }
  return credentials;
}

export function toSafeErrorDetails(
  value: unknown,
): Readonly<Record<string, string | number | boolean>> {
  const details: Record<string, SafePrimitive> = {};
  if (!(value instanceof ClaudeCodeWireError)) return Object.freeze(details);

  let code: unknown;
  let safeDetails: unknown;
  try {
    code = readOwnValue(value, "code");
    safeDetails = readOwnValue(value, "safeDetails");
  } catch {
    return Object.freeze(details);
  }
  if (typeof code !== "string" || !SAFE_ERROR_CODES.has(code)) {
    return Object.freeze(details);
  }
  details["code"] = code;
  if (typeof safeDetails !== "object" || safeDetails === null) {
    return Object.freeze(details);
  }
  const numericKeys = [
    "bodyByteLength",
    "messageCount",
    "systemBlockCount",
    "logicalHeaderCount",
    "betaFeatureCount",
    "maximumDepth",
    "maximumSize",
  ] as const;
  const booleanKeys = ["hasSystem", "hasTools"] as const;

  for (const key of numericKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(safeDetails, key);
    const detail: unknown =
      descriptor !== undefined && "value" in descriptor
        ? descriptor.value
        : undefined;
    if (typeof detail === "number" && Number.isFinite(detail)) {
      details[key] = detail;
    }
  }
  for (const key of booleanKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(safeDetails, key);
    const detail: unknown =
      descriptor !== undefined && "value" in descriptor
        ? descriptor.value
        : undefined;
    if (typeof detail === "boolean") details[key] = detail;
  }
  return Object.freeze(details);
}

export async function buildRedactedEvidence(
  input: BuildRedactedEvidenceInput,
  cryptoProvider?: Pick<Crypto, "subtle">,
): Promise<RedactedRequestEvidence> {
  const encoder = new TextEncoder();
  validateInputGraph(input, encoder);
  assertEvidenceSources(input);

  if (typeof input.body !== "string") throw wireError("INVALID_INPUT");
  const bodyBytes = encoder.encode(input.body);
  const credentials = collectCredentialValues(input);
  const logicalHeaderNames: string[] = [];
  for (const header of input.logicalHeaders) {
    const name = header[0];
    if (containsCredential(name, credentials)) throw wireError("INVALID_INPUT");
    logicalHeaderNames.push(name);
  }
  const betaFeatures: string[] = [];
  for (const feature of input.betaFeatures) {
    if (containsCredential(feature, credentials))
      throw wireError("INVALID_INPUT");
    betaFeatures.push(feature);
  }

  const provider = selectCryptoProvider(cryptoProvider);
  if (!isCryptoProvider(provider)) throw wireError("CRYPTO_UNAVAILABLE");

  let digest: ArrayBuffer;
  try {
    digest = await provider.subtle.digest("SHA-256", bodyBytes);
  } catch {
    throw wireError("REDACTION_FAILURE", {
      bodyByteLength: bodyBytes.byteLength,
      messageCount: input.request.messages.length,
      systemBlockCount: input.request.system?.length ?? 0,
    });
  }

  let bodySha256: string;
  try {
    const digestBytes = new Uint8Array(digest);
    if (digestBytes.byteLength !== 32) throw wireError("REDACTION_FAILURE");
    bodySha256 = toHex(digestBytes);
  } catch {
    throw wireError("REDACTION_FAILURE", {
      bodyByteLength: bodyBytes.byteLength,
      messageCount: input.request.messages.length,
      systemBlockCount: input.request.system?.length ?? 0,
    });
  }

  const evidence: RedactedRequestEvidence = {
    profileId: PROFILE_ID,
    url: ENDPOINT,
    method: "POST",
    modelFamily: input.modelFamily,
    logicalHeaderNames: Object.freeze(logicalHeaderNames),
    betaFeatures: Object.freeze(betaFeatures),
    bodySha256,
    bodyByteLength: bodyBytes.byteLength,
    messageCount: input.request.messages.length,
    systemBlockCount: input.request.system?.length ?? 0,
    capabilityDecisions: capabilityDecisions(input),
  };
  return Object.freeze(evidence);
}
