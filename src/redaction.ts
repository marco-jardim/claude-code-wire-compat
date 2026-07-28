// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeCapabilityDecisions,
  ClaudeCodeModelFamily,
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  HeaderPair,
  RedactedRequestEvidence,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { classifySurrogateAt } from "./unicode.js";

/** Excludes values used only while validating and assembling the request. */
export type NormalizedRequestInput = Omit<
  ClaudeCodeRequestInput,
  "clientRequestId" | "crypto" | "profileOverride"
>;

export interface BuildRedactedEvidenceInput {
  readonly profile: ClaudeCodeProtocolProfile;
  /** Supplies the validated effective profile when an override is active. */
  readonly effectiveProfile?: ClaudeCodeProtocolProfile;
  readonly request: NormalizedRequestInput;
  readonly modelFamily: ClaudeCodeModelFamily;
  readonly logicalHeaders: readonly HeaderPair[];
  readonly betaFeatures: readonly string[];
  readonly body: string;
  /**
   * Carries the names discarded by `extraHeaderPolicy: "dropConflicting"`.
   *
   * Supplied only under that policy, so evidence for every other request keeps
   * its original shape.
   */
  readonly droppedExtraHeaderNames?: readonly string[];
  readonly suppressedBetaNames?: readonly string[];
  /**
   * Carries the number of caller system blocks the canonical system actually
   * EMITTED, which is not the raw length of `request.system`: adjacent caller
   * blocks sharing a `cache_control` merge into one, and a block byte-identical
   * to the pinned identity text is dropped.
   *
   * The parser asserts `systemBlockCount === body.system.length - <canonical>`,
   * so the raw length made every merged request unparseable by this package.
   */
  readonly emittedSystemBlockCount?: number;
  /**
   * Set only when `suppressBillingBlock` removed the billing block, so evidence
   * for every request that ignores the seam keeps its original shape.
   */
  readonly billingBlockSuppressed?: true;
  /**
   * Set only when the root `suppressIdentityBlock` removed the identity block,
   * so evidence for every request that ignores the seam keeps its shape.
   */
  readonly identityBlockSuppressed?: true;
  /**
   * Set only when `preserveThinkingBlockCacheControl` was active AND at least
   * one emitted reasoning block actually carried `cache_control`, so evidence
   * for every request that ignores the seam keeps its shape.
   */
  readonly thinkingBlockCacheControlPreserved?: true;
}

const MAX_INPUT_DEPTH = 100;
const MAX_INPUT_SIZE = 1_000_000;
const ENDPOINT = "https://api.anthropic.com/v1/messages?beta=true";
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_ERROR_CODES = new Set([
  "INVALID_INPUT",
  "INVALID_IDENTITY",
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
    const classification = classifySurrogateAt(value, index);
    if (classification === "loneSurrogate") return false;
    if (classification === "surrogatePair") index += 1;
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
): ClaudeCodeCapabilityDecisions {
  const requested = input.request.capabilities;
  const use1MContext = input.request.betaOverrides?.use1MContext;
  return Object.freeze({
    // Package extension: emitted only when the caller stated a decision, so
    // evidence for requests without `betaOverrides` keeps its original shape.
    ...(use1MContext === undefined ? {} : { use1MContext }),
    thinking: requested?.thinking ?? false,
    adaptiveThinking: requested?.adaptiveThinking ?? false,
    effort: requested?.effort ?? false,
    interleavedThinking: requested?.interleavedThinking ?? false,
    maxEffort: requested?.maxEffort ?? false,
    xhighEffort: requested?.xhighEffort ?? false,
    contextManagement: requested?.contextManagement ?? false,
    temperature: requested?.temperature ?? false,
    rejectsDisabledThinking: requested?.rejectsDisabledThinking ?? false,
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
  if (typeof value !== "object" || value === null) {
    throw wireError("INVALID_INPUT");
  }
  const profile = readOwnValue(value, "profile");
  const profileId = readOwnValue(profile, "id");
  const endpoint = readOwnValue(profile, "endpoint");
  const effectiveProfile = Object.hasOwn(value, "effectiveProfile")
    ? readOwnValue(value, "effectiveProfile")
    : undefined;
  const modelFamily = readOwnValue(value, "modelFamily");
  const logicalHeaders = readOwnValue(value, "logicalHeaders");
  const betaFeatures = readOwnValue(value, "betaFeatures");

  if (profileId !== "claude-code-2.1.195-sdk-0.94.0" || endpoint !== ENDPOINT) {
    throw wireError("INVALID_INPUT");
  }
  if (effectiveProfile !== undefined) {
    const effectiveId = readOwnValue(effectiveProfile, "id");
    if (
      typeof effectiveId !== "string" ||
      effectiveId.length === 0 ||
      readOwnValue(effectiveProfile, "endpoint") !== ENDPOINT ||
      readOwnValue(effectiveProfile, "provider") !== "anthropic" ||
      readOwnValue(effectiveProfile, "anthropicVersion") !== "2023-06-01"
    ) {
      throw wireError("INVALID_INPUT");
    }
  }
  if (
    modelFamily !== "haiku" &&
    modelFamily !== "sonnet" &&
    modelFamily !== "opus" &&
    modelFamily !== "fable" &&
    modelFamily !== "mythos" &&
    modelFamily !== "unknown"
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

  // Dropped names are caller-controlled text that lands in evidence. They get
  // the same credential screening as the header names that did reach the wire.
  const droppedExtraHeaderNames: string[] = [];
  for (const name of input.droppedExtraHeaderNames ?? []) {
    if (containsCredential(name, credentials)) throw wireError("INVALID_INPUT");
    droppedExtraHeaderNames.push(name);
  }

  // Suppressed names never reached the wire, but they are caller-controlled
  // text landing in evidence, so they get the same credential screening.
  const suppressedBetaNames: string[] = [];
  for (const name of input.suppressedBetaNames ?? []) {
    if (containsCredential(name, credentials)) throw wireError("INVALID_INPUT");
    suppressedBetaNames.push(name);
  }

  // The emitted count is authoritative when supplied; the raw caller length is
  // only a fallback for callers that assemble evidence without a built system.
  const systemBlockCount =
    input.emittedSystemBlockCount ?? input.request.system?.length ?? 0;

  const provider = selectCryptoProvider(cryptoProvider);
  if (!isCryptoProvider(provider)) throw wireError("CRYPTO_UNAVAILABLE");

  let digest: ArrayBuffer;
  try {
    digest = await provider.subtle.digest("SHA-256", bodyBytes);
  } catch {
    throw wireError("REDACTION_FAILURE", {
      bodyByteLength: bodyBytes.byteLength,
      messageCount: input.request.messages.length,
      systemBlockCount,
    });
  }

  let digestBytes: Uint8Array;
  try {
    digestBytes = new Uint8Array(digest);
  } catch {
    throw wireError("REDACTION_FAILURE", {
      bodyByteLength: bodyBytes.byteLength,
      messageCount: input.request.messages.length,
      systemBlockCount,
    });
  }
  if (digestBytes.byteLength !== 32) {
    throw wireError("REDACTION_FAILURE", {
      bodyByteLength: bodyBytes.byteLength,
      messageCount: input.request.messages.length,
      systemBlockCount,
    });
  }
  const bodySha256 = toHex(digestBytes);

  const evidence: RedactedRequestEvidence = {
    profileId: input.effectiveProfile?.id ?? input.profile.id,
    url: ENDPOINT,
    method: "POST",
    modelFamily: input.modelFamily,
    logicalHeaderNames: Object.freeze(logicalHeaderNames),
    betaFeatures: Object.freeze(betaFeatures),
    bodySha256,
    bodyByteLength: bodyBytes.byteLength,
    messageCount: input.request.messages.length,
    systemBlockCount,
    capabilityDecisions: capabilityDecisions(input),
    // Package extension: emitted only when the caller opted into
    // `dropConflicting`, so evidence for every other request is unchanged.
    ...(input.droppedExtraHeaderNames === undefined
      ? {}
      : { droppedExtraHeaderNames: Object.freeze(droppedExtraHeaderNames) }),
    // Package extension: emitted only when the suppression seam removed at
    // least one identifier, so evidence for every other request is unchanged.
    ...(suppressedBetaNames.length === 0
      ? {}
      : { suppressedBetaNames: Object.freeze(suppressedBetaNames) }),
    // Package extension: emitted only when the billing block was actually
    // suppressed, so evidence for every other request is unchanged.
    ...(input.billingBlockSuppressed === true
      ? { billingBlockSuppressed: true }
      : {}),
    // Package extension: emitted only when the identity block was actually
    // suppressed, so evidence for every other request is unchanged.
    ...(input.identityBlockSuppressed === true
      ? { identityBlockSuppressed: true }
      : {}),
    // Package extension: emitted only when the seam was active AND a reasoning
    // block actually carried the marker, so evidence for every other request is
    // unchanged.
    ...(input.thinkingBlockCacheControlPreserved === true
      ? { thinkingBlockCacheControlPreserved: true }
      : {}),
  };
  return Object.freeze(evidence);
}
