// SPDX-License-Identifier: GPL-3.0-or-later

import { composeBetas } from "./betas.js";
import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  HeaderPair,
  RedactedRequestEvidence,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { createBillingBlock } from "./fingerprint.js";
import { buildOrderedHeaders } from "./headers.js";
import {
  buildCorrelatedMetadata,
  validateRuntimeIdentity,
} from "./metadata.js";
import { resolveModel } from "./models.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
import { buildRedactedEvidence, toSafeErrorDetails } from "./redaction.js";
import { buildCanonicalBody } from "./request-body.js";
import { sha256Hex } from "./sha256.js";
import { buildCanonicalSystem } from "./system-prompt.js";
import { classifySurrogateAt } from "./unicode.js";

const METHOD = "POST";
const MAX_INPUT_DEPTH = 100;
const MAX_INPUT_SIZE = 1_000_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const INPUT_KEYS = new Set([
  "accessToken",
  "model",
  "maxTokens",
  "messages",
  "system",
  "tools",
  "runtime",
  "capabilities",
  "thinking",
  "effort",
  "metadata",
  "clientRequestId",
  "crypto",
]);
const BUILT_KEYS = new Set(["url", "method", "headers", "body", "evidence"]);
const EVIDENCE_KEYS = new Set([
  "profileId",
  "url",
  "method",
  "modelFamily",
  "logicalHeaderNames",
  "betaFeatures",
  "bodySha256",
  "bodyByteLength",
  "messageCount",
  "systemBlockCount",
  "capabilityDecisions",
]);
const CAPABILITY_KEYS = [
  "contextHint",
  "adaptiveThinking",
  "effort",
  "interleavedThinking",
] as const;

type UnknownRecord = Readonly<Record<string, unknown>>;

function fail(
  code: ConstructorParameters<typeof ClaudeCodeWireError>[0] = "INVALID_INPUT",
): never {
  throw new ClaudeCodeWireError(code);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) fail();
  return descriptor.value;
}

function assertExactKeys(value: object, allowed: ReadonlySet<string>): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) fail();
  }
}

function inspectString(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit <= 0x1f || unit === 0x7f) fail("INVALID_UNICODE");
    const classification = classifySurrogateAt(value, index);
    if (classification === "loneSurrogate") fail("INVALID_UNICODE");
    if (classification === "surrogatePair") index += 1;
  }
  return new TextEncoder().encode(value).byteLength;
}

function inspectGraph(value: unknown): void {
  const active = new WeakSet();
  let size = 0;

  function visit(current: unknown, depth: number): void {
    if (depth > MAX_INPUT_DEPTH) fail("INPUT_TOO_DEEP");
    if (typeof current === "string") {
      size += inspectString(current);
    } else if (
      current === null ||
      typeof current === "boolean" ||
      typeof current === "number"
    ) {
      if (typeof current === "number" && !Number.isFinite(current)) fail();
      size += 1;
    } else if (typeof current !== "object") {
      fail();
    } else {
      const prototype = Reflect.getPrototypeOf(current);
      if (
        prototype !== null &&
        prototype !== Object.prototype &&
        prototype !== Array.prototype
      ) {
        fail();
      }
      if (active.has(current)) fail("CYCLIC_INPUT");
      active.add(current);
      const keys = Reflect.ownKeys(current);
      size += keys.length;
      for (const key of keys) {
        if (typeof key !== "string" || FORBIDDEN_KEYS.has(key)) fail();
        size += inspectString(key);
        visit(ownValue(current, key), depth + 1);
      }
      active.delete(current);
    }
    if (size > MAX_INPUT_SIZE) fail("INPUT_TOO_LARGE");
  }

  visit(value, 0);
}

function containsString(value: unknown, target: string): boolean {
  if (typeof value === "string") return value === target;
  if (value === null || typeof value !== "object") return false;
  return Reflect.ownKeys(value).some((key) =>
    typeof key === "string"
      ? containsString(ownValue(value, key), target)
      : false,
  );
}

function validateProfile(
  profile: ClaudeCodeProtocolProfile,
): ClaudeCodeProtocolProfile {
  if (profile !== CLAUDE_CODE_2_1_195_PROFILE) fail();
  return profile;
}

function isCryptoProvider(value: unknown): value is Pick<Crypto, "subtle"> {
  if (!isRecord(value)) return false;
  const subtleDescriptor = Object.getOwnPropertyDescriptor(value, "subtle");
  if (
    subtleDescriptor === undefined ||
    !("value" in subtleDescriptor) ||
    !isRecord(subtleDescriptor.value)
  ) {
    return false;
  }
  const digestDescriptor = Object.getOwnPropertyDescriptor(
    subtleDescriptor.value,
    "digest",
  );
  return (
    digestDescriptor !== undefined &&
    "value" in digestDescriptor &&
    typeof digestDescriptor.value === "function"
  );
}

function validateCrypto(value: unknown): Pick<Crypto, "subtle"> | undefined {
  if (value === undefined) return undefined;
  if (!isCryptoProvider(value)) fail("CRYPTO_UNAVAILABLE");
  return value;
}

function validateInput(input: ClaudeCodeRequestInput): {
  readonly source: ClaudeCodeRequestInput;
  readonly clientRequestId: string;
  readonly crypto: Pick<Crypto, "subtle"> | undefined;
} {
  if (!isRecord(input)) fail();
  assertExactKeys(input, INPUT_KEYS);
  const graph: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(input)) {
    if (key !== "crypto" && typeof key === "string") {
      graph[key] = ownValue(input, key);
    }
  }
  inspectGraph(graph);
  const accessToken = ownValue(input, "accessToken");
  if (
    typeof accessToken !== "string" ||
    typeof ownValue(input, "model") !== "string" ||
    !Array.isArray(ownValue(input, "messages"))
  ) {
    fail();
  }
  for (const key of Reflect.ownKeys(input)) {
    if (
      typeof key === "string" &&
      key !== "accessToken" &&
      key !== "crypto" &&
      containsString(ownValue(input, key), accessToken)
    ) {
      fail();
    }
  }
  const clientRequestId = ownValue(input, "clientRequestId");
  if (typeof clientRequestId !== "string" || clientRequestId.length === 0)
    fail();
  const cryptoValue = Object.hasOwn(input, "crypto")
    ? validateCrypto(ownValue(input, "crypto"))
    : undefined;
  return { source: input, clientRequestId, crypto: cryptoValue };
}

function requestedCapabilities(
  input: ClaudeCodeRequestInput,
  supported: ClaudeCodeCapabilities,
  profile: ClaudeCodeProtocolProfile,
): ClaudeCodeCapabilities {
  const raw = input.capabilities;
  if (raw !== undefined) {
    if (!isRecord(raw)) fail("UNSUPPORTED_CAPABILITY");
    assertExactKeys(raw, new Set(CAPABILITY_KEYS));
  }
  const result: ClaudeCodeCapabilities = {
    contextHint: raw?.contextHint ?? profile.defaultCapabilities.contextHint,
    adaptiveThinking: raw?.adaptiveThinking ?? supported.adaptiveThinking,
    effort: raw?.effort ?? supported.effort,
    interleavedThinking:
      raw?.interleavedThinking ?? supported.interleavedThinking,
  };
  for (const key of CAPABILITY_KEYS) {
    if (typeof result[key] !== "boolean") fail("UNSUPPORTED_CAPABILITY");
    if (result[key] && !supported[key]) {
      throw new ClaudeCodeWireError("UNSUPPORTED_CAPABILITY", {
        capability: key,
      });
    }
  }
  return Object.freeze(result);
}

/**
 * Selects the text that seeds the billing fingerprint.
 *
 * The source is the FIRST USER MESSAGE, and nothing else. Upstream
 * `lib/mimicry/system-prompt.mjs:134,143` calls
 * `buildAnthropicBillingHeader(version, firstUserMessage, ...)`, which forwards
 * that message to `computeBillingCacheHash(firstUserMessage || "", version)`.
 * The system prompt never contributes.
 *
 * This is protocol-critical: seeding the fingerprint from system text instead
 * would emit a `cc_version` suffix that does not match the pinned wire profile,
 * silently breaking parity while every local test still looked plausible.
 * The committed goldens are the ground truth here — `outgoing-foreground.json`
 * pairs first user text `hello wire compat` with `cc_version=2.1.195.0f6`.
 */
function fingerprintText(input: ClaudeCodeRequestInput): string {
  for (const message of input.messages) {
    if (message.role !== "user") continue;
    if (typeof message.content === "string") return message.content;
    for (const block of message.content) {
      if (block.type === "text") return block.text;
    }
    // The first user message exists but carries no text block. Upstream's
    // `firstUserMessage || ""` fallback applies; later messages never substitute.
    return "";
  }
  return "";
}

function sanitizeError(error: unknown): never {
  if (error instanceof ClaudeCodeWireError) {
    const details = toSafeErrorDetails(error);
    const safeDetails = Object.fromEntries(
      Object.entries(details).filter(([key]) => key !== "code"),
    );
    throw new ClaudeCodeWireError(error.code, safeDetails);
  }
  throw new ClaudeCodeWireError("INVALID_INPUT");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value))
      deepFreeze(Reflect.get(value, key));
    Object.freeze(value);
  }
  return value;
}

function parseStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) fail();
  return value.map((entry) => {
    if (typeof entry !== "string") fail();
    return entry;
  });
}

function parseHeaders(value: unknown): readonly HeaderPair[] {
  if (!Array.isArray(value)) fail();
  return value.map((entry): HeaderPair => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string" ||
      typeof entry[1] !== "string"
    ) {
      fail();
    }
    return [entry[0], entry[1]];
  });
}

function parseCapabilities(value: unknown): ClaudeCodeCapabilities {
  if (!isRecord(value)) fail();
  assertExactKeys(value, new Set(CAPABILITY_KEYS));
  const result = Object.fromEntries(
    CAPABILITY_KEYS.map((key) => {
      const entry = ownValue(value, key);
      if (typeof entry !== "boolean") fail();
      return [key, entry];
    }),
  );
  if (
    typeof result["contextHint"] !== "boolean" ||
    typeof result["adaptiveThinking"] !== "boolean" ||
    typeof result["effort"] !== "boolean" ||
    typeof result["interleavedThinking"] !== "boolean"
  ) {
    fail();
  }
  return {
    contextHint: result["contextHint"],
    adaptiveThinking: result["adaptiveThinking"],
    effort: result["effort"],
    interleavedThinking: result["interleavedThinking"],
  };
}

function parseEvidence(value: unknown): RedactedRequestEvidence {
  if (!isRecord(value)) fail();
  assertExactKeys(value, EVIDENCE_KEYS);
  const modelFamily = ownValue(value, "modelFamily");
  if (
    modelFamily !== "haiku" &&
    modelFamily !== "sonnet" &&
    modelFamily !== "opus"
  ) {
    fail();
  }
  const bodySha256 = ownValue(value, "bodySha256");
  const bodyByteLength = ownValue(value, "bodyByteLength");
  const messageCount = ownValue(value, "messageCount");
  const systemBlockCount = ownValue(value, "systemBlockCount");
  if (
    ownValue(value, "profileId") !== CLAUDE_CODE_2_1_195_PROFILE.id ||
    ownValue(value, "url") !== CLAUDE_CODE_2_1_195_PROFILE.endpoint ||
    ownValue(value, "method") !== METHOD ||
    typeof bodySha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(bodySha256) ||
    typeof bodyByteLength !== "number" ||
    !Number.isSafeInteger(bodyByteLength) ||
    typeof messageCount !== "number" ||
    !Number.isSafeInteger(messageCount) ||
    typeof systemBlockCount !== "number" ||
    !Number.isSafeInteger(systemBlockCount)
  ) {
    fail();
  }
  return {
    profileId: CLAUDE_CODE_2_1_195_PROFILE.id,
    url: CLAUDE_CODE_2_1_195_PROFILE.endpoint,
    method: METHOD,
    modelFamily,
    logicalHeaderNames: parseStringArray(ownValue(value, "logicalHeaderNames")),
    betaFeatures: parseStringArray(ownValue(value, "betaFeatures")),
    bodySha256,
    bodyByteLength,
    messageCount,
    systemBlockCount,
    capabilityDecisions: parseCapabilities(
      ownValue(value, "capabilityDecisions"),
    ),
  };
}

function parseBody(value: string): UnknownRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail();
  }
  if (!isRecord(parsed)) fail();
  return parsed;
}

function parsedBodySessionId(body: UnknownRecord): string {
  const metadata = body["metadata"];
  if (!isRecord(metadata) || typeof metadata["user_id"] !== "string") fail();
  const identity = parseBody(metadata["user_id"]);
  const sessionId = identity["session_id"];
  if (typeof sessionId !== "string") fail();
  return sessionId;
}

function headerValue(headers: readonly HeaderPair[], name: string): string {
  const matches = headers.filter(([candidate]) => candidate === name);
  if (matches.length !== 1) fail();
  const match = matches[0];
  if (match === undefined) fail();
  return match[1];
}

function evidenceRequest(
  input: ClaudeCodeRequestInput,
  canonicalModelId: string,
): ClaudeCodeRequestInput {
  const request: {
    accessToken: string;
    model: string;
    maxTokens: number;
    messages: ClaudeCodeRequestInput["messages"];
    runtime: ClaudeCodeRequestInput["runtime"];
    system?: NonNullable<ClaudeCodeRequestInput["system"]>;
    tools?: NonNullable<ClaudeCodeRequestInput["tools"]>;
    capabilities?: NonNullable<ClaudeCodeRequestInput["capabilities"]>;
    thinking?: NonNullable<ClaudeCodeRequestInput["thinking"]>;
    effort?: NonNullable<ClaudeCodeRequestInput["effort"]>;
    metadata?: NonNullable<ClaudeCodeRequestInput["metadata"]>;
  } = {
    accessToken: input.accessToken,
    model: canonicalModelId,
    maxTokens: input.maxTokens,
    messages: input.messages,
    runtime: input.runtime,
  };
  if (input.system !== undefined) request.system = input.system;
  if (input.tools !== undefined) request.tools = input.tools;
  if (input.capabilities !== undefined)
    request.capabilities = input.capabilities;
  if (input.thinking !== undefined) request.thinking = input.thinking;
  if (input.effort !== undefined) request.effort = input.effort;
  if (input.metadata !== undefined) request.metadata = input.metadata;
  return request;
}

/**
 * Builds one canonical request for the pinned Claude Code wire profile.
 *
 * @param profile - The only accepted value is the exported
 * `CLAUDE_CODE_2_1_195_PROFILE` singleton. Any other object, even a
 * structurally identical clone, is rejected with `ClaudeCodeWireError` code
 * `INVALID_INPUT`. This deliberate fail-closed behaviour prevents callers from
 * substituting an unpinned protocol profile.
 */
export async function buildClaudeCodeRequest(
  input: ClaudeCodeRequestInput,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): Promise<BuiltClaudeCodeRequest> {
  try {
    const pinnedProfile = validateProfile(profile);
    const validated = validateInput(input);
    const identity = validateRuntimeIdentity(validated.source.runtime);
    const resolvedModel = resolveModel(validated.source.model, pinnedProfile);
    const capabilities = requestedCapabilities(
      validated.source,
      resolvedModel.capabilities,
      pinnedProfile,
    );
    const effectiveModel = Object.freeze({
      ...resolvedModel,
      capabilities,
    });
    const billing = await createBillingBlock(
      fingerprintText(validated.source),
      pinnedProfile.cliVersion,
      validated.crypto,
    );
    const metadata = buildCorrelatedMetadata(
      identity,
      validated.source.metadata,
    );
    const system = buildCanonicalSystem(
      validated.source.system,
      billing,
      identity,
    );
    const canonicalBody = buildCanonicalBody(
      evidenceRequest(validated.source, resolvedModel.id),
      effectiveModel,
      system,
      metadata,
      pinnedProfile,
    );
    const betas = composeBetas(
      {
        capabilities,
        effortRequested: validated.source.effort !== undefined,
        contextHintRequested: capabilities.contextHint,
      },
      pinnedProfile,
    );
    const headers = buildOrderedHeaders({
      accessToken: validated.source.accessToken,
      runtime: identity,
      clientRequestId: validated.clientRequestId,
      betaFeatures: betas,
      extraHeaders: [],
      profile: pinnedProfile,
    });
    const body = JSON.stringify(canonicalBody);
    const evidence = await buildRedactedEvidence(
      {
        profile: pinnedProfile,
        request: evidenceRequest(validated.source, resolvedModel.id),
        modelFamily: resolvedModel.family,
        logicalHeaders: headers,
        betaFeatures: betas,
        body,
      },
      validated.crypto,
    );
    return deepFreeze({
      url: pinnedProfile.endpoint,
      method: METHOD,
      headers,
      body,
      evidence,
    });
  } catch (error: unknown) {
    return sanitizeError(error);
  }
}

/**
 * Validates and clones a previously built request into a deeply frozen value.
 *
 * @param profile - The only accepted value is the exported
 * `CLAUDE_CODE_2_1_195_PROFILE` singleton. Any other object, even a
 * structurally identical clone, is rejected with `ClaudeCodeWireError` code
 * `INVALID_INPUT`. This deliberate fail-closed behaviour prevents callers from
 * substituting an unpinned protocol profile.
 */
export function parseBuiltClaudeCodeRequest(
  value: unknown,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): BuiltClaudeCodeRequest {
  try {
    const pinnedProfile = validateProfile(profile);
    inspectGraph(value);
    if (!isRecord(value)) fail();
    assertExactKeys(value, BUILT_KEYS);
    if (
      ownValue(value, "url") !== pinnedProfile.endpoint ||
      ownValue(value, "method") !== METHOD
    ) {
      fail();
    }
    const body = ownValue(value, "body");
    if (typeof body !== "string") fail();
    const parsedBody = parseBody(body);
    const headers = parseHeaders(ownValue(value, "headers"));
    const evidence = parseEvidence(ownValue(value, "evidence"));
    const sessionId = headerValue(headers, "x-claude-code-session-id");
    const expectedHeaders = buildOrderedHeaders({
      accessToken: headerValue(headers, "authorization").replace(
        /^Bearer /u,
        "",
      ),
      runtime: {
        sessionId,
        runtime: headerValue(headers, "x-stainless-runtime"),
        runtimeVersion: headerValue(headers, "x-stainless-runtime-version"),
        os: headerValue(headers, "x-stainless-os"),
        arch: headerValue(headers, "x-stainless-arch"),
      },
      clientRequestId: headerValue(headers, "x-client-request-id"),
      betaFeatures: evidence.betaFeatures,
      extraHeaders: [],
      profile: pinnedProfile,
    });
    if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) fail();
    if (
      evidence.logicalHeaderNames.length !== headers.length ||
      evidence.logicalHeaderNames.some(
        (name, index) => name !== headers[index]?.[0],
      ) ||
      parsedBodySessionId(parsedBody) !== sessionId ||
      headerValue(headers, "anthropic-beta") !==
        evidence.betaFeatures.join(",") ||
      evidence.bodyByteLength !== new TextEncoder().encode(body).byteLength ||
      evidence.messageCount !==
        (Array.isArray(parsedBody["messages"])
          ? parsedBody["messages"].length
          : -1) ||
      evidence.systemBlockCount !==
        (Array.isArray(parsedBody["system"])
          ? parsedBody["system"].length - 2
          : -1)
    ) {
      fail();
    }
    const result: BuiltClaudeCodeRequest = {
      url: pinnedProfile.endpoint,
      method: METHOD,
      headers,
      body,
      evidence,
    };
    if (sha256Hex(body) !== evidence.bodySha256) fail();
    return deepFreeze(result);
  } catch (error: unknown) {
    return sanitizeError(error);
  }
}
