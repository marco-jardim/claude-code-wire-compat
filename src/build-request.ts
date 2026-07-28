// SPDX-License-Identifier: GPL-3.0-or-later

import { composeBetas, composeBetasWithAudit } from "./betas.js";
import type {
  BuiltClaudeCodeCountTokensRequest,
  BuiltClaudeCodeRequest,
  ClaudeCodeBetaOverrides,
  ClaudeCodeCapabilities,
  ClaudeCodeCapabilityDecisions,
  ClaudeCodeExtraHeaderPolicy,
  ClaudeCodeProfileOverride,
  ClaudeCodeProtocolProfile,
  ClaudeCodeCountTokensInput,
  ClaudeCodeRequestInput,
  HeaderPair,
  RedactedRequestEvidence,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import {
  buildCountTokensBody,
  filterCountTokensBetas,
  TOKEN_COUNTING_BETA,
} from "./count-tokens.js";
import { createBillingBlock } from "./fingerprint.js";
import { buildOrderedHeaderPlan, buildOrderedHeaders } from "./headers.js";
import {
  buildCorrelatedMetadata,
  validateRuntimeIdentity,
} from "./metadata.js";
import { resolveModel } from "./models.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
import type { NormalizedRequestInput } from "./redaction.js";
import { buildRedactedEvidence, toSafeErrorDetails } from "./redaction.js";
import {
  buildCanonicalBody,
  canonicalCountTokensLists,
} from "./request-body.js";
import { sha256Hex } from "./sha256.js";
import { buildCanonicalSystem, IDENTITY_TEXT } from "./system-prompt.js";
import { isThinkingDisplayActive } from "./thinking.js";
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
  "cacheControl",
  "runtime",
  "capabilities",
  "profileOverride",
  "thinking",
  "effort",
  "metadata",
  "experimentalBodyFields",
  "contextManagement",
  "outputConfig",
  "speed",
  "serviceTier",
  "outputFormat",
  "toolChoice",
  "topP",
  "topK",
  "stopSequences",
  "stream",
  "temperature",
  "clientRequestId",
  "app",
  "stainlessRetryCount",
  "stainlessHelper",
  "claudeRemoteContainerId",
  "claudeRemoteSessionId",
  "clientApp",
  "anthropicAdditionalProtection",
  "additionalBetas",
  "suppressBetas",
  "suppressBillingBlock",
  "suppressIdentityBlock",
  "preserveThinkingBlockCacheControl",
  "betaOverrides",
  "metadataOverrides",
  "extraHeaders",
  "extraHeaderPolicy",
  "crypto",
]);
const BETA_OVERRIDE_KEYS = new Set(["use1MContext"]);
const METADATA_OVERRIDE_KEYS = new Set(["userId", "userIdFields"]);
const COUNT_TOKENS_INPUT_KEYS = new Set([
  "accessToken",
  "model",
  "messages",
  "tools",
  "runtime",
  "clientRequestId",
  "profileOverride",
  "crypto",
  "app",
  "stainlessRetryCount",
  "stainlessHelper",
  "claudeRemoteContainerId",
  "claudeRemoteSessionId",
  "clientApp",
  "anthropicAdditionalProtection",
  "extraHeaders",
]);
const BUILT_KEYS = new Set(["url", "method", "headers", "body", "evidence"]);
/**
 * The self-describing prefix of the canonical billing block's text.
 *
 * `buildBillingBlock` emits
 * `x-anthropic-billing-header: cc_version=<version>.<fingerprint>; ...`, whose
 * tail varies per request, so only this fixed head can anchor a structural
 * check. It is what lets the parser CONFIRM that a request which claims to
 * carry the billing block actually carries it.
 */
const BILLING_BLOCK_TEXT_PREFIX = "x-anthropic-billing-header: cc_version=";
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
  "droppedExtraHeaderNames",
  "suppressedBetaNames",
  "billingBlockSuppressed",
  "identityBlockSuppressed",
  "thinkingBlockCacheControlPreserved",
]);
const CAPABILITY_KEYS = [
  "thinking",
  "adaptiveThinking",
  "interleavedThinking",
  "effort",
  "maxEffort",
  "xhighEffort",
  "contextManagement",
  "temperature",
  "rejectsDisabledThinking",
] as const;
const CAPABILITY_KEY_SET = new Set(CAPABILITY_KEYS);
/** Adds the optional package-extension override keys carried by evidence. */
const CAPABILITY_DECISION_KEY_SET = new Set([
  ...CAPABILITY_KEYS,
  "use1MContext",
]);
const OVERRIDE_KEYS = new Set([
  "id",
  "cliVersion",
  "sdkVersion",
  "entrypoint",
  "userAgent",
  "buildTime",
  "gitSha",
  "attributionHeaderEnabled",
  "contextHintEnabled",
  "betaPolicy",
  "supportedModels",
]);
const MODEL_KEYS = new Set([
  "family",
  "context",
  "capabilities",
  "defaultEffort",
]);
const BETA_POLICY_KEYS = new Set([
  "oauthAuthenticated",
  "experimentalBetasEnabled",
  "oneMillionContextEnabled",
  "interleavedThinkingEnabled",
  "interactive",
  "thinkingSummariesShown",
  "thinkingTokenCountEnabled",
  "narrationSummariesEnabled",
  "structuredOutputsEnabled",
  "afkModeEnabled",
  "cacheDiagnosisEnabled",
]);

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

function present<T>(value: T | undefined): T {
  if (value === undefined) fail();
  return value;
}

function assertExactKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) fail("INVALID_INPUT");
  }
}

/**
 * Screens one string from the caller's input graph.
 *
 * TAB (0x09), LF (0x0A) and CR (0x0D) are ALLOWED. This function walks the
 * whole input graph, which is overwhelmingly BODY content — message text,
 * system blocks, tool descriptions — where a line break is ordinary prose that
 * `JSON.stringify` escapes on the way out. Rejecting them here made the package
 * unusable for real traffic: no genuine prompt is a single line.
 *
 * The strict rule those three characters used to be caught by is a HEADER rule,
 * and it still lives where it belongs and still applies in full:
 * `assertHeaderText` in `src/headers.ts` rejects every control character,
 * including these three, because a bare LF in a header is request smuggling.
 * `src/metadata.ts` is likewise unchanged: `user_id` and metadata keys are
 * identifiers that travel as JSON inside a header, not prose.
 *
 * Every other C0 control (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F) and DEL (0x7F)
 * stay rejected: they have no meaning in prompt text and are a reliable signal
 * of a corrupted or hostile input.
 *
 * LONE SURROGATES stay rejected in every context, deliberately. `TextEncoder`
 * silently replaces them with U+FFFD, so an unpaired surrogate would corrupt
 * the body — and the body hash recorded in evidence — with no error anywhere.
 */
function inspectString(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (
      (unit <= 0x1f && unit !== 0x09 && unit !== 0x0a && unit !== 0x0d) ||
      unit === 0x7f
    ) {
      fail("INVALID_UNICODE");
    }
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

function requireNonEmptyString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) fail();
  return value;
}

function parseCatalogueCapabilities(value: unknown): readonly string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return Object.freeze([...value]);
}

function parseCatalogueContext(value: unknown): Readonly<{
  readonly window: number;
  readonly native1m?: boolean;
  readonly supports1mBeta?: boolean;
}> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some(
      (key) =>
        typeof key !== "string" ||
        (key !== "window" && key !== "native1m" && key !== "supports1mBeta"),
    )
  ) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  const window: unknown = Reflect.get(value, "window");
  const native1m: unknown = Reflect.get(value, "native1m");
  const supports1mBeta: unknown = Reflect.get(value, "supports1mBeta");
  if (
    typeof window !== "number" ||
    !Number.isFinite(window) ||
    window <= 0 ||
    (native1m !== undefined && typeof native1m !== "boolean") ||
    (supports1mBeta !== undefined && typeof supports1mBeta !== "boolean")
  ) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return Object.freeze({
    window,
    ...(native1m === undefined ? {} : { native1m }),
    ...(supports1mBeta === undefined ? {} : { supports1mBeta }),
  });
}

function parseDefaultEffort(
  value: unknown,
): "low" | "medium" | "high" | "xhigh" | "max" {
  if (
    value !== "low" &&
    value !== "medium" &&
    value !== "high" &&
    value !== "xhigh" &&
    value !== "max"
  ) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

function parseBetaPolicy(
  value: unknown,
): ClaudeCodeProtocolProfile["betaPolicy"] {
  if (!isRecord(value)) fail();
  assertExactKeys(value, BETA_POLICY_KEYS);
  if (Reflect.ownKeys(value).length !== BETA_POLICY_KEYS.size) fail();
  return Object.freeze({
    oauthAuthenticated: parseBoolean(ownValue(value, "oauthAuthenticated")),
    experimentalBetasEnabled: parseBoolean(
      ownValue(value, "experimentalBetasEnabled"),
    ),
    oneMillionContextEnabled: parseBoolean(
      ownValue(value, "oneMillionContextEnabled"),
    ),
    interleavedThinkingEnabled: parseBoolean(
      ownValue(value, "interleavedThinkingEnabled"),
    ),
    interactive: parseBoolean(ownValue(value, "interactive")),
    thinkingSummariesShown: parseBoolean(
      ownValue(value, "thinkingSummariesShown"),
    ),
    thinkingTokenCountEnabled: parseBoolean(
      ownValue(value, "thinkingTokenCountEnabled"),
    ),
    narrationSummariesEnabled: parseBoolean(
      ownValue(value, "narrationSummariesEnabled"),
    ),
    structuredOutputsEnabled: parseBoolean(
      ownValue(value, "structuredOutputsEnabled"),
    ),
    afkModeEnabled: parseBoolean(ownValue(value, "afkModeEnabled")),
    cacheDiagnosisEnabled: parseBoolean(
      ownValue(value, "cacheDiagnosisEnabled"),
    ),
  });
}

function parseSupportedModels(
  value: unknown,
): ClaudeCodeProtocolProfile["supportedModels"] {
  if (!isRecord(value) || Reflect.ownKeys(value).length === 0) fail();
  const result: Record<
    string,
    ClaudeCodeProtocolProfile["supportedModels"][string]
  > = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || key.length === 0) fail();
    const model = ownValue(value, key);
    if (!isRecord(model)) fail();
    assertExactKeys(model, MODEL_KEYS);
    const family = ownValue(model, "family");
    if (
      family !== "haiku" &&
      family !== "sonnet" &&
      family !== "opus" &&
      family !== "fable" &&
      family !== "mythos" &&
      family !== "unknown"
    )
      fail();
    result[key] = Object.freeze({
      family,
      ...(Object.hasOwn(model, "context")
        ? { context: parseCatalogueContext(ownValue(model, "context")) }
        : {}),
      capabilities: parseCatalogueCapabilities(ownValue(model, "capabilities")),
      ...(Object.hasOwn(model, "defaultEffort")
        ? {
            defaultEffort: parseDefaultEffort(ownValue(model, "defaultEffort")),
          }
        : {}),
    });
  }
  return Object.freeze(result);
}

function validateProfileOverride(value: unknown): ClaudeCodeProfileOverride {
  if (!isRecord(value)) fail();
  assertExactKeys(value, OVERRIDE_KEYS);
  if (Reflect.ownKeys(value).length === 0) fail();

  const cliVersion = Object.hasOwn(value, "cliVersion")
    ? requireNonEmptyString(ownValue(value, "cliVersion"))
    : undefined;
  const userAgent = Object.hasOwn(value, "userAgent")
    ? requireNonEmptyString(ownValue(value, "userAgent"))
    : undefined;
  // `cc_version` in the billing header derives from `cliVersion` while the
  // user agent is separate. Overriding one alone would emit a self-inconsistent
  // client signature, precisely the fingerprint mismatch this package prevents.
  if (cliVersion !== undefined && !userAgent?.includes(cliVersion)) {
    fail();
  }

  const attributionHeaderEnabled = Object.hasOwn(
    value,
    "attributionHeaderEnabled",
  )
    ? ownValue(value, "attributionHeaderEnabled")
    : undefined;
  if (
    attributionHeaderEnabled !== undefined &&
    typeof attributionHeaderEnabled !== "boolean"
  ) {
    fail();
  }

  return Object.freeze({
    ...(Object.hasOwn(value, "id")
      ? { id: requireNonEmptyString(ownValue(value, "id")) }
      : {}),
    ...(cliVersion === undefined ? {} : { cliVersion }),
    ...(Object.hasOwn(value, "sdkVersion")
      ? { sdkVersion: requireNonEmptyString(ownValue(value, "sdkVersion")) }
      : {}),
    ...(Object.hasOwn(value, "entrypoint")
      ? { entrypoint: requireNonEmptyString(ownValue(value, "entrypoint")) }
      : {}),
    ...(userAgent === undefined ? {} : { userAgent }),
    ...(Object.hasOwn(value, "buildTime")
      ? { buildTime: requireNonEmptyString(ownValue(value, "buildTime")) }
      : {}),
    ...(Object.hasOwn(value, "gitSha")
      ? { gitSha: requireNonEmptyString(ownValue(value, "gitSha")) }
      : {}),
    ...(attributionHeaderEnabled === undefined
      ? {}
      : { attributionHeaderEnabled }),
    ...(Object.hasOwn(value, "contextHintEnabled")
      ? {
          contextHintEnabled: parseBoolean(
            ownValue(value, "contextHintEnabled"),
          ),
        }
      : {}),
    ...(Object.hasOwn(value, "betaPolicy")
      ? { betaPolicy: parseBetaPolicy(ownValue(value, "betaPolicy")) }
      : {}),
    ...(Object.hasOwn(value, "supportedModels")
      ? {
          supportedModels: parseSupportedModels(
            ownValue(value, "supportedModels"),
          ),
        }
      : {}),
  });
}

/**
 * Validates the package-extension beta overrides.
 *
 * An explicitly present key with an `undefined` value is rejected rather than
 * silently treated as absent, so the tri-state stays observable: the caller
 * either states a decision or omits the key.
 */
function validateBetaOverrides(value: unknown): ClaudeCodeBetaOverrides {
  if (!isRecord(value)) fail();
  assertExactKeys(value, BETA_OVERRIDE_KEYS);
  return Object.freeze({
    ...(Object.hasOwn(value, "use1MContext")
      ? { use1MContext: parseBoolean(ownValue(value, "use1MContext")) }
      : {}),
  });
}

/**
 * Validates the shape of the package-extension metadata overrides.
 *
 * Only the key set is decided here, exactly as `validateBetaOverrides` does.
 * Member values, and the mutual exclusion between them, are decided by
 * `buildCorrelatedMetadata`, which owns the correlation rules.
 */
function validateMetadataOverrides(value: unknown): void {
  if (!isRecord(value)) fail();
  assertExactKeys(value, METADATA_OVERRIDE_KEYS);
}

/**
 * Validates the package-extension extra-header policy.
 *
 * The two literals are the whole domain; anything else, including a casing
 * variant or a padded string, is a caller mistake rather than a silent fallback
 * to `strict`, because falling back would emit a request the caller did not ask
 * for.
 */
function validateExtraHeaderPolicy(
  value: unknown,
): ClaudeCodeExtraHeaderPolicy {
  if (value !== "strict" && value !== "dropConflicting") fail();
  return value;
}

/**
 * Validates the package-extension billing-block suppression flag.
 *
 * Only a boolean states a decision. A truthy string or `0` is a caller mistake
 * rather than a coercion target, because coercing would silently change what
 * Anthropic receives for attribution purposes.
 */
function validateSuppressBillingBlock(value: unknown): boolean {
  return parseBoolean(value);
}

/**
 * Validates the package-extension identity-block suppression flag.
 *
 * Same contract as `validateSuppressBillingBlock`: only a boolean states a
 * decision, because coercing a truthy string would silently drop a canonical
 * block the genuine client always sends.
 */
function validateSuppressIdentityBlock(value: unknown): boolean {
  return parseBoolean(value);
}

/**
 * Validates the package-extension thinking-block `cache_control` seam flag.
 *
 * Same contract as the suppression flags: only a boolean states a decision,
 * because coercing a truthy string would silently widen the thinking-block
 * allowlist this package pins against the genuine client.
 */
function validatePreserveThinkingBlockCacheControl(value: unknown): boolean {
  return parseBoolean(value);
}

function createEffectiveProfile(
  pinnedProfile: ClaudeCodeProtocolProfile,
  override: ClaudeCodeProfileOverride | undefined,
): ClaudeCodeProtocolProfile {
  if (override === undefined) return pinnedProfile;
  return deepFreeze({ ...pinnedProfile, ...override });
}

function applyEffectiveProfileHeaders(
  headers: readonly HeaderPair[],
  profile: ClaudeCodeProtocolProfile,
): readonly HeaderPair[] {
  return Object.freeze(
    headers.map(([name, value]): HeaderPair => {
      if (name === "user-agent") {
        return Object.freeze([name, profile.userAgent]);
      }
      if (name === "x-stainless-package-version") {
        return Object.freeze([name, profile.sdkVersion]);
      }
      return Object.freeze([name, value]);
    }),
  );
}

function validateInput(input: ClaudeCodeRequestInput): {
  readonly source: ClaudeCodeRequestInput;
  readonly clientRequestId: string;
  readonly crypto: Pick<Crypto, "subtle"> | undefined;
  readonly profileOverride: ClaudeCodeProfileOverride | undefined;
  readonly betaOverrides: ClaudeCodeBetaOverrides | undefined;
  readonly extraHeaderPolicy: ClaudeCodeExtraHeaderPolicy | undefined;
  readonly suppressBillingBlock: boolean;
  readonly suppressIdentityBlock: boolean;
  readonly preserveThinkingBlockCacheControl: boolean;
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
  const profileOverride = Object.hasOwn(input, "profileOverride")
    ? validateProfileOverride(ownValue(input, "profileOverride"))
    : undefined;
  const betaOverrides = Object.hasOwn(input, "betaOverrides")
    ? validateBetaOverrides(ownValue(input, "betaOverrides"))
    : undefined;
  if (Object.hasOwn(input, "metadataOverrides")) {
    validateMetadataOverrides(ownValue(input, "metadataOverrides"));
  }
  const extraHeaderPolicy = Object.hasOwn(input, "extraHeaderPolicy")
    ? validateExtraHeaderPolicy(ownValue(input, "extraHeaderPolicy"))
    : undefined;
  const suppressBillingBlock = Object.hasOwn(input, "suppressBillingBlock")
    ? validateSuppressBillingBlock(ownValue(input, "suppressBillingBlock"))
    : false;
  const suppressIdentityBlock = Object.hasOwn(input, "suppressIdentityBlock")
    ? validateSuppressIdentityBlock(ownValue(input, "suppressIdentityBlock"))
    : false;
  const preserveThinkingBlockCacheControl = Object.hasOwn(
    input,
    "preserveThinkingBlockCacheControl",
  )
    ? validatePreserveThinkingBlockCacheControl(
        ownValue(input, "preserveThinkingBlockCacheControl"),
      )
    : false;
  return {
    source: input,
    clientRequestId,
    crypto: cryptoValue,
    profileOverride,
    betaOverrides,
    extraHeaderPolicy,
    suppressBillingBlock,
    suppressIdentityBlock,
    preserveThinkingBlockCacheControl,
  };
}

function validateCountTokensInput(input: ClaudeCodeCountTokensInput): {
  readonly source: ClaudeCodeCountTokensInput;
  readonly clientRequestId: string;
  readonly crypto: Pick<Crypto, "subtle"> | undefined;
  readonly profileOverride: ClaudeCodeProfileOverride | undefined;
} {
  if (!isRecord(input)) fail();
  assertExactKeys(input, COUNT_TOKENS_INPUT_KEYS);
  const graph: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(input)) {
    if (key !== "crypto" && typeof key === "string") {
      graph[key] = ownValue(input, key);
    }
  }
  inspectGraph(graph);
  const accessToken = ownValue(input, "accessToken");
  const tools = Object.hasOwn(input, "tools")
    ? ownValue(input, "tools")
    : undefined;
  if (
    typeof accessToken !== "string" ||
    typeof ownValue(input, "model") !== "string" ||
    !Array.isArray(ownValue(input, "messages")) ||
    (tools !== undefined && !Array.isArray(tools))
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
  if (typeof clientRequestId !== "string" || clientRequestId.length === 0) {
    fail();
  }
  const cryptoValue = Object.hasOwn(input, "crypto")
    ? validateCrypto(ownValue(input, "crypto"))
    : undefined;
  const profileOverride = Object.hasOwn(input, "profileOverride")
    ? validateProfileOverride(ownValue(input, "profileOverride"))
    : undefined;
  return {
    source: input,
    clientRequestId,
    crypto: cryptoValue,
    profileOverride,
  };
}

function requestedCapabilities(
  input: ClaudeCodeRequestInput,
  supported: ClaudeCodeCapabilities,
): ClaudeCodeCapabilities {
  const raw = input.capabilities;
  if (raw !== undefined) {
    if (!isRecord(raw)) fail("UNSUPPORTED_CAPABILITY");
    assertExactKeys(raw, CAPABILITY_KEY_SET);
  }
  const result: ClaudeCodeCapabilities = {
    thinking: raw?.thinking ?? supported.thinking,
    adaptiveThinking: raw?.adaptiveThinking ?? supported.adaptiveThinking,
    interleavedThinking:
      raw?.interleavedThinking ?? supported.interleavedThinking,
    effort: raw?.effort ?? supported.effort,
    maxEffort: raw?.maxEffort ?? supported.maxEffort,
    xhighEffort: raw?.xhighEffort ?? supported.xhighEffort,
    contextManagement: raw?.contextManagement ?? supported.contextManagement,
    temperature: raw?.temperature ?? supported.temperature,
    rejectsDisabledThinking:
      raw?.rejectsDisabledThinking ?? supported.rejectsDisabledThinking,
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

function parseCapabilityDecisions(
  value: unknown,
): ClaudeCodeCapabilityDecisions {
  if (!isRecord(value)) fail();
  // The nine capability keys are mandatory; the package-extension override keys
  // are optional and must survive the round-trip untouched, so they are allowed
  // here but never synthesized.
  assertExactKeys(value, CAPABILITY_DECISION_KEY_SET);
  // Read each key through a narrowing helper rather than building a record and
  // re-checking it afterwards. The re-check was unreachable -- every value was
  // already proven boolean -- which cost coverage and produced mutants that
  // could not be killed.
  const readBoolean = (key: string): boolean => {
    const entry = ownValue(value, key);
    if (typeof entry !== "boolean") fail();
    return entry;
  };
  return {
    ...(Object.hasOwn(value, "use1MContext")
      ? { use1MContext: readBoolean("use1MContext") }
      : {}),
    thinking: readBoolean("thinking"),
    adaptiveThinking: readBoolean("adaptiveThinking"),
    interleavedThinking: readBoolean("interleavedThinking"),
    effort: readBoolean("effort"),
    maxEffort: readBoolean("maxEffort"),
    xhighEffort: readBoolean("xhighEffort"),
    contextManagement: readBoolean("contextManagement"),
    temperature: readBoolean("temperature"),
    rejectsDisabledThinking: readBoolean("rejectsDisabledThinking"),
  };
}

function parseEvidence(value: unknown): RedactedRequestEvidence {
  if (!isRecord(value)) fail();
  assertExactKeys(value, EVIDENCE_KEYS);
  const modelFamily = ownValue(value, "modelFamily");
  if (
    modelFamily !== "haiku" &&
    modelFamily !== "sonnet" &&
    modelFamily !== "opus" &&
    modelFamily !== "fable" &&
    modelFamily !== "mythos" &&
    modelFamily !== "unknown"
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
    capabilityDecisions: parseCapabilityDecisions(
      ownValue(value, "capabilityDecisions"),
    ),
    // Optional package-extension audit: preserved verbatim when present and
    // never synthesized, exactly like the `use1MContext` decision key.
    ...(Object.hasOwn(value, "droppedExtraHeaderNames")
      ? {
          droppedExtraHeaderNames: parseStringArray(
            ownValue(value, "droppedExtraHeaderNames"),
          ),
        }
      : {}),
    ...(Object.hasOwn(value, "suppressedBetaNames")
      ? {
          suppressedBetaNames: parseStringArray(
            ownValue(value, "suppressedBetaNames"),
          ),
        }
      : {}),
    ...(Object.hasOwn(value, "billingBlockSuppressed")
      ? {
          billingBlockSuppressed: parseBoolean(
            ownValue(value, "billingBlockSuppressed"),
          ),
        }
      : {}),
    ...(Object.hasOwn(value, "identityBlockSuppressed")
      ? {
          identityBlockSuppressed: parseBoolean(
            ownValue(value, "identityBlockSuppressed"),
          ),
        }
      : {}),
    // Rehydrated here because `assertExactKeys` above already accepts the key:
    // omitting this branch would silently DROP it, and the round-trip equality
    // every seam test asserts would fail on an envelope that is entirely legal.
    ...(Object.hasOwn(value, "thinkingBlockCacheControlPreserved")
      ? {
          thinkingBlockCacheControlPreserved: parseBoolean(
            ownValue(value, "thinkingBlockCacheControlPreserved"),
          ),
        }
      : {}),
  };
}

/** Reads an own property of a value that is not asserted to be a record. */
function ownProperty(value: unknown, key: string): unknown {
  return isRecord(value) && Object.hasOwn(value, key)
    ? ownValue(value, key)
    : undefined;
}

/**
 * Reports whether the emitted `messages` carry a reasoning block that actually
 * kept a `cache_control` key.
 *
 * This is what makes `evidence.thinkingBlockCacheControlPreserved` a record of
 * what the seam DID rather than of what it was allowed to do, and it is the
 * check that refutes an envelope claiming the seam over a body carrying no such
 * block. Presence of the KEY is the test, not truthiness: `cache_control: null`
 * is a preserved marker too, exactly as it is on every other block type.
 */
function hasThinkingBlockCacheControl(messages: unknown): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some((message) => {
    const content = ownProperty(message, "content");
    return (
      Array.isArray(content) &&
      content.some((block) => {
        const type = ownProperty(block, "type");
        return (
          (type === "thinking" || type === "redacted_thinking") &&
          ownProperty(block, "cache_control") !== undefined
        );
      })
    );
  });
}

/** Reads a system block's `text` without asserting the block's shape. */
function systemBlockText(block: unknown): unknown {
  return ownProperty(block, "text");
}

/** Recognises the canonical billing block by its fixed, self-describing head. */
function isBillingBlockText(text: unknown): boolean {
  return typeof text === "string" && text.startsWith(BILLING_BLOCK_TEXT_PREFIX);
}

/**
 * VERIFIES how many canonical blocks the emitted `system` array carries.
 *
 * The root seams `suppressBillingBlock` and `suppressIdentityBlock` make four
 * prefixes legitimate — `[billing, identity]`, `[identity]`, `[billing]` and
 * `[]` — so no probe over the array alone can tell them apart: an empty prefix
 * is indistinguishable from a caller-only array. The prefix length is therefore
 * READ from the evidence flags, which the builder emits only when suppression
 * actually removed a block.
 *
 * Evidence is not trusted blindly. Each block the flags claim is present is
 * confirmed in place: billing by its `x-anthropic-billing-header: cc_version=`
 * head (its tail is per-request), identity by the byte-exact `IDENTITY_TEXT`;
 * a claim that identity was suppressed is confirmed by that text being absent
 * from the whole array. This is strictly stronger than the position probe it
 * replaces, which never checked the billing slot at all. Never `cache_control`:
 * the
 * `cacheControl.suppressIdentityBlock` seam can emit the identity block with no
 * marker, so a marker probe would misread a legitimate request.
 */
function canonicalSystemPrefixLength(
  system: readonly unknown[],
  billingSuppressed: boolean,
  identitySuppressed: boolean,
): number {
  let index = 0;
  if (!billingSuppressed) {
    if (!isBillingBlockText(systemBlockText(system[index]))) fail();
    index += 1;
  }
  if (identitySuppressed) {
    // The identity text cannot appear ANYWHERE in a body built with the seam
    // active: `buildCanonicalSystem` drops a caller block equal to it
    // unconditionally, and merging joins with `\n`, so no merged run can equal
    // it either. Absence is therefore checkable, which is what refutes a claim
    // of suppression made over a body that still carries the block.
    //
    // No mirror check exists for billing: a caller block may legitimately begin
    // with the billing header text, so its presence proves nothing.
    if (system.some((block) => systemBlockText(block) === IDENTITY_TEXT)) {
      fail();
    }
    return index;
  }
  if (systemBlockText(system[index]) !== IDENTITY_TEXT) fail();
  return index + 1;
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

function splitDynamicAndExtraHeaders(headers: readonly HeaderPair[]): {
  readonly stainlessHelper: string | undefined;
  readonly claudeRemoteContainerId: string | undefined;
  readonly claudeRemoteSessionId: string | undefined;
  readonly clientApp: string | undefined;
  readonly anthropicAdditionalProtection: string | undefined;
  readonly extraHeaders: readonly HeaderPair[];
} {
  const timeoutIndex = headers.findIndex(
    ([name]) => name === "x-stainless-timeout",
  );
  if (timeoutIndex < 0) fail();
  let cursor = timeoutIndex + 1;
  function consume(name: string): string | undefined {
    const pair = headers[cursor];
    if (pair?.[0] !== name) return undefined;
    cursor += 1;
    return pair[1];
  }
  return {
    stainlessHelper: consume("x-stainless-helper"),
    claudeRemoteContainerId: consume("x-claude-remote-container-id"),
    claudeRemoteSessionId: consume("x-claude-remote-session-id"),
    clientApp: consume("x-client-app"),
    anthropicAdditionalProtection: consume("x-anthropic-additional-protection"),
    extraHeaders: headers.slice(cursor),
  };
}

function evidenceRequest(
  input: ClaudeCodeRequestInput,
  callerModel: string,
): NormalizedRequestInput {
  const request: {
    accessToken: string;
    model: string;
    maxTokens: number;
    messages: ClaudeCodeRequestInput["messages"];
    runtime: ClaudeCodeRequestInput["runtime"];
    system?: NonNullable<ClaudeCodeRequestInput["system"]>;
    tools?: NonNullable<ClaudeCodeRequestInput["tools"]>;
    cacheControl?: Exclude<ClaudeCodeRequestInput["cacheControl"], undefined>;
    capabilities?: NonNullable<ClaudeCodeRequestInput["capabilities"]>;
    betaOverrides?: NonNullable<ClaudeCodeRequestInput["betaOverrides"]>;
    preserveThinkingBlockCacheControl?: NonNullable<
      ClaudeCodeRequestInput["preserveThinkingBlockCacheControl"]
    >;
    thinking?: NonNullable<ClaudeCodeRequestInput["thinking"]>;
    effort?: NonNullable<ClaudeCodeRequestInput["effort"]>;
    metadata?: NonNullable<ClaudeCodeRequestInput["metadata"]>;
    experimentalBodyFields?: NonNullable<
      ClaudeCodeRequestInput["experimentalBodyFields"]
    >;
    contextManagement?: Exclude<
      ClaudeCodeRequestInput["contextManagement"],
      undefined
    >;
    outputConfig?: Exclude<ClaudeCodeRequestInput["outputConfig"], undefined>;
    speed?: Exclude<ClaudeCodeRequestInput["speed"], undefined>;
    serviceTier?: Exclude<ClaudeCodeRequestInput["serviceTier"], undefined>;
    outputFormat?: Exclude<ClaudeCodeRequestInput["outputFormat"], undefined>;
    toolChoice?: Exclude<ClaudeCodeRequestInput["toolChoice"], undefined>;
    topP?: Exclude<ClaudeCodeRequestInput["topP"], undefined>;
    topK?: Exclude<ClaudeCodeRequestInput["topK"], undefined>;
    stopSequences?: Exclude<ClaudeCodeRequestInput["stopSequences"], undefined>;
    stream?: Exclude<ClaudeCodeRequestInput["stream"], undefined>;
    temperature?: Exclude<ClaudeCodeRequestInput["temperature"], undefined>;
  } = {
    accessToken: input.accessToken,
    model: callerModel,
    maxTokens: input.maxTokens,
    messages: input.messages,
    runtime: input.runtime,
  };
  if (input.system !== undefined) request.system = input.system;
  if (input.tools !== undefined) request.tools = input.tools;
  if (Object.hasOwn(input, "cacheControl"))
    request.cacheControl = present(input.cacheControl);
  if (input.capabilities !== undefined)
    request.capabilities = input.capabilities;
  if (input.betaOverrides !== undefined)
    request.betaOverrides = input.betaOverrides;
  // The body builder owns the thinking-block allowlist, so the seam flag has to
  // reach it. It is forwarded only when the caller stated it, keeping the
  // normalized request shape identical for every request that ignores the seam.
  if (input.preserveThinkingBlockCacheControl !== undefined)
    request.preserveThinkingBlockCacheControl =
      input.preserveThinkingBlockCacheControl;
  if (input.thinking !== undefined) request.thinking = input.thinking;
  if (input.effort !== undefined) request.effort = input.effort;
  if (input.metadata !== undefined) request.metadata = input.metadata;
  if (input.experimentalBodyFields !== undefined)
    request.experimentalBodyFields = input.experimentalBodyFields;
  if (Object.hasOwn(input, "contextManagement"))
    request.contextManagement = present(input.contextManagement);
  if (Object.hasOwn(input, "outputConfig"))
    request.outputConfig = present(input.outputConfig);
  if (Object.hasOwn(input, "speed")) request.speed = present(input.speed);
  if (Object.hasOwn(input, "serviceTier"))
    request.serviceTier = present(input.serviceTier);
  if (Object.hasOwn(input, "outputFormat"))
    request.outputFormat = present(input.outputFormat);
  if (Object.hasOwn(input, "toolChoice"))
    request.toolChoice = present(input.toolChoice);
  if (Object.hasOwn(input, "topP")) request.topP = present(input.topP);
  if (Object.hasOwn(input, "topK")) request.topK = present(input.topK);
  if (Object.hasOwn(input, "stopSequences"))
    request.stopSequences = present(input.stopSequences);
  if (Object.hasOwn(input, "stream")) request.stream = present(input.stream);
  if (Object.hasOwn(input, "temperature"))
    request.temperature = present(input.temperature);
  return request;
}

function countTokensEvidenceRequest(
  input: ClaudeCodeCountTokensInput,
  capabilities: ClaudeCodeCapabilities,
): NormalizedRequestInput {
  return {
    accessToken: input.accessToken,
    model: input.model,
    maxTokens: 1,
    messages: input.messages,
    ...(input.tools === undefined ? {} : { tools: input.tools }),
    runtime: input.runtime,
    capabilities,
  };
}

/** Builds a canonical Claude Code count-tokens request. */
export async function buildClaudeCodeCountTokensRequest(
  input: ClaudeCodeCountTokensInput,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): Promise<BuiltClaudeCodeCountTokensRequest> {
  try {
    const pinnedProfile = validateProfile(profile);
    const validated = validateCountTokensInput(input);
    const effectiveProfile = createEffectiveProfile(
      pinnedProfile,
      validated.profileOverride,
    );
    const identity = validateRuntimeIdentity(validated.source.runtime);
    const resolvedModel = resolveModel(
      validated.source.model,
      effectiveProfile,
    );
    const countTokensBetas = filterCountTokensBetas(
      composeBetas(
        {
          rawModel: validated.source.model,
          normalizedId: resolvedModel.id,
          capabilities: resolvedModel.capabilities,
          thinkingDisplayActive: false,
        },
        effectiveProfile,
      ),
    );
    const betas = Object.freeze([...countTokensBetas, TOKEN_COUNTING_BETA]);
    const headers = applyEffectiveProfileHeaders(
      buildOrderedHeaders({
        accessToken: validated.source.accessToken,
        runtime: identity,
        clientRequestId: validated.clientRequestId,
        betaFeatures: betas,
        app: validated.source.app ?? effectiveProfile.entrypoint,
        stainlessRetryCount: validated.source.stainlessRetryCount ?? 0,
        stainlessHelper: validated.source.stainlessHelper,
        claudeRemoteContainerId: validated.source.claudeRemoteContainerId,
        claudeRemoteSessionId: validated.source.claudeRemoteSessionId,
        clientApp: validated.source.clientApp,
        anthropicAdditionalProtection:
          validated.source.anthropicAdditionalProtection,
        extraHeaders: validated.source.extraHeaders ?? [],
        profile: pinnedProfile,
      }),
      effectiveProfile,
    );
    const canonical = canonicalCountTokensLists(
      validated.source.messages,
      validated.source.tools,
    );
    const body = JSON.stringify(
      buildCountTokensBody(
        resolvedModel.wireId,
        canonical.messages,
        canonical.tools,
      ),
    );
    const evidenceRequestInput = countTokensEvidenceRequest(
      validated.source,
      resolvedModel.capabilities,
    );
    const evidence = await buildRedactedEvidence(
      {
        profile: pinnedProfile,
        effectiveProfile,
        request: evidenceRequestInput,
        modelFamily: resolvedModel.family,
        logicalHeaders: headers,
        betaFeatures: betas,
        body,
      },
      validated.crypto,
    );
    return deepFreeze({
      url: effectiveProfile.countTokensEndpoint,
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
    const effectiveProfile = createEffectiveProfile(
      pinnedProfile,
      validated.profileOverride,
    );
    const identity = validateRuntimeIdentity(validated.source.runtime);
    const resolvedModel = resolveModel(
      validated.source.model,
      effectiveProfile,
    );
    const capabilities = requestedCapabilities(
      validated.source,
      resolvedModel.capabilities,
    );
    const effectiveModel = Object.freeze({
      ...resolvedModel,
      capabilities,
    });
    const billing = await createBillingBlock(
      fingerprintText(validated.source),
      effectiveProfile.cliVersion,
      validated.crypto,
    );
    const metadata = buildCorrelatedMetadata(
      identity,
      validated.source.metadata,
      validated.source.metadataOverrides,
    );
    const system = buildCanonicalSystem(
      validated.source.system,
      billing,
      identity,
      validated.suppressBillingBlock,
      validated.suppressIdentityBlock,
    );
    const canonicalBody = buildCanonicalBody(
      evidenceRequest(validated.source, validated.source.model),
      effectiveModel,
      system,
      metadata,
      effectiveProfile,
    );
    const composedBetas = composeBetasWithAudit(
      {
        rawModel: validated.source.model,
        normalizedId: resolvedModel.id,
        capabilities,
        thinkingDisplayActive: isThinkingDisplayActive(
          validated.source.thinking,
          capabilities,
          effectiveProfile.betaPolicy,
        ),
        ...(validated.source.cacheControl?.ttl === undefined
          ? {}
          : { cacheTtl: validated.source.cacheControl.ttl }),
        ...(validated.source.speed === undefined
          ? {}
          : { speed: validated.source.speed }),
        ...(validated.source.additionalBetas === undefined
          ? {}
          : { additionalBetas: validated.source.additionalBetas }),
        ...(validated.source.suppressBetas === undefined
          ? {}
          : { suppressBetas: validated.source.suppressBetas }),
        ...(validated.betaOverrides?.use1MContext === undefined
          ? {}
          : { use1MContextOverride: validated.betaOverrides.use1MContext }),
      },
      effectiveProfile,
    );
    const betas = composedBetas.betas;
    const headerPlan = buildOrderedHeaderPlan({
      accessToken: validated.source.accessToken,
      runtime: identity,
      clientRequestId: validated.clientRequestId,
      betaFeatures: betas,
      app: validated.source.app ?? effectiveProfile.entrypoint,
      stainlessRetryCount: validated.source.stainlessRetryCount ?? 0,
      stainlessHelper: validated.source.stainlessHelper,
      claudeRemoteContainerId: validated.source.claudeRemoteContainerId,
      claudeRemoteSessionId: validated.source.claudeRemoteSessionId,
      clientApp: validated.source.clientApp,
      anthropicAdditionalProtection:
        validated.source.anthropicAdditionalProtection,
      extraHeaders: validated.source.extraHeaders ?? [],
      extraHeaderPolicy: validated.extraHeaderPolicy ?? "strict",
      profile: pinnedProfile,
    });
    const headers = applyEffectiveProfileHeaders(
      headerPlan.headers,
      effectiveProfile,
    );
    const body = JSON.stringify(canonicalBody);
    const evidence = await buildRedactedEvidence(
      {
        profile: pinnedProfile,
        effectiveProfile,
        request: evidenceRequest(validated.source, validated.source.model),
        modelFamily: resolvedModel.family,
        logicalHeaders: headers,
        betaFeatures: betas,
        body,
        // The canonical system merges adjacent caller blocks and drops any
        // block equal to the identity text, so only the emitted count keeps
        // `systemBlockCount === body.system.length - <canonical>` true.
        // Symmetric arithmetic over the two suppression seams: each canonical
        // block that survived costs one slot. A single constant cannot express
        // the empty prefix both seams together produce.
        emittedSystemBlockCount:
          system.length -
          (validated.suppressBillingBlock ? 0 : 1) -
          (validated.suppressIdentityBlock ? 0 : 1),
        // Emitted only for the opted-in policy, so evidence for every other
        // request keeps the shape it had before the seam existed.
        ...(validated.extraHeaderPolicy === "dropConflicting"
          ? { droppedExtraHeaderNames: headerPlan.droppedExtraHeaderNames }
          : {}),
        // Emitted only when suppression actually removed something, so
        // evidence for every request that ignores the seam is unchanged.
        ...(composedBetas.suppressedBetaNames.length === 0
          ? {}
          : { suppressedBetaNames: composedBetas.suppressedBetaNames }),
        // Emitted only when the billing block was actually removed, so the
        // audit records the attribution decision without inventing a key for
        // every request that leaves the canonical prefix intact.
        ...(validated.suppressBillingBlock
          ? { billingBlockSuppressed: true }
          : {}),
        // Emitted only when the identity block was actually removed, on the
        // same terms as `billingBlockSuppressed`: the parser reads both flags
        // to know the length of the canonical prefix it must verify.
        ...(validated.suppressIdentityBlock
          ? { identityBlockSuppressed: true }
          : {}),
        // Emitted only when the seam was active AND a reasoning block actually
        // carried the marker. Opting in without using it records nothing, so
        // the audit states what happened on the wire rather than what the
        // caller was permitted to do.
        ...(validated.preserveThinkingBlockCacheControl &&
        hasThinkingBlockCacheControl(canonicalBody["messages"])
          ? { thinkingBlockCacheControlPreserved: true }
          : {}),
      },
      validated.crypto,
    );
    return deepFreeze({
      url: effectiveProfile.endpoint,
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
    // Reading evidence is not trusting evidence. A claim that the seam
    // preserved a marker is confirmed against the body, and it is confirmed
    // HERE — before the byte-length and digest checks — so that a forgery which
    // is byte-length preserving and evidence-self-consistent is refused by the
    // structural check rather than incidentally by arithmetic.
    if (
      evidence.thinkingBlockCacheControlPreserved === true &&
      !hasThinkingBlockCacheControl(parsedBody["messages"])
    ) {
      fail();
    }
    const sessionId = headerValue(headers, "x-claude-code-session-id");
    const additionalHeaders = splitDynamicAndExtraHeaders(headers);
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
      app: headerValue(headers, "x-app"),
      stainlessRetryCount: Number(
        headerValue(headers, "x-stainless-retry-count"),
      ),
      stainlessHelper: additionalHeaders.stainlessHelper,
      claudeRemoteContainerId: additionalHeaders.claudeRemoteContainerId,
      claudeRemoteSessionId: additionalHeaders.claudeRemoteSessionId,
      clientApp: additionalHeaders.clientApp,
      anthropicAdditionalProtection:
        additionalHeaders.anthropicAdditionalProtection,
      extraHeaders: additionalHeaders.extraHeaders,
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
          ? parsedBody["system"].length -
            canonicalSystemPrefixLength(
              parsedBody["system"],
              evidence.billingBlockSuppressed === true,
              evidence.identityBlockSuppressed === true,
            )
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
