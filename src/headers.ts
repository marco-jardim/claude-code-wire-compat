// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeDispatchId,
  ClaudeCodeExtraHeaderPolicy,
  ClaudeCodeProtocolProfile,
  HeaderPair,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
import { CLAUDE_CODE_2_1_233_PROFILE } from "./profiles/claude-code-2.1.233.js";
import { CLAUDE_CODE_2_1_280_PROFILE } from "./profiles/claude-code-2.1.280.js";
import { CLAUDE_CODE_2_1_329_PROFILE } from "./profiles/claude-code-2.1.329.js";
import { PROMPT_ID_PATTERN } from "./fingerprint.js";
import { profileBehaviors } from "./profile-behaviors.js";
import type { ToolsUsedEntry } from "./tools-used.js";
import { serializeToolsUsed, validateToolsUsed } from "./tools-used.js";

const HEADER_NAMES = Object.freeze({
  anthropicBeta: "anthropic-beta",
  browserAccess: "anthropic-dangerous-direct-browser-access",
  anthropicVersion: "anthropic-version",
  authorization: "authorization",
  contentType: "content-type",
  userAgent: "user-agent",
  app: "x-app",
  sessionId: "x-claude-code-session-id",
  clientRequestId: "x-client-request-id",
  arch: "x-stainless-arch",
  lang: "x-stainless-lang",
  os: "x-stainless-os",
  packageVersion: "x-stainless-package-version",
  retryCount: "x-stainless-retry-count",
  runtime: "x-stainless-runtime",
  runtimeVersion: "x-stainless-runtime-version",
  timeout: "x-stainless-timeout",
  stainlessHelper: "x-stainless-helper",
  remoteContainerId: "x-claude-remote-container-id",
  remoteSessionId: "x-claude-remote-session-id",
  clientApp: "x-client-app",
  additionalProtection: "x-anthropic-additional-protection",
} as const);

/** The names a header layout owns, keyed by role. */
export type HeaderNameTable = {
  readonly [K in keyof typeof HEADER_NAMES]: string;
};

/** The genuine layout adds the names the legacy layout never emits. */
export type GenuineHeaderNameTable = HeaderNameTable & {
  readonly accept: string;
  readonly dispatchId: string;
  readonly requestClass1p: string;
  readonly requestClass: string;
  readonly promptId: string;
  readonly sandyPlover: string;
};

/**
 * Header names as the genuine 2.1.329 client writes them (live capture): the
 * HTTP-standard names and the `User-Agent`/`X-Claude-Code-Session-Id`/
 * `X-Stainless-*` set are capitalised, everything the Anthropic SDK and the
 * client add on top is lowercase. The dynamic headers keep their lowercase
 * names.
 *
 * The casing only survives on a case-preserving transport (for example Bun);
 * Node's undici lowercases every name before it reaches the wire. This table
 * records what the genuine client hands its transport; it does not change what
 * a lowercasing transport sends.
 */
export const GENUINE_HEADER_NAMES: GenuineHeaderNameTable = Object.freeze({
  ...HEADER_NAMES,
  accept: "Accept",
  authorization: "Authorization",
  contentType: "Content-Type",
  userAgent: "User-Agent",
  sessionId: "X-Claude-Code-Session-Id",
  arch: "X-Stainless-Arch",
  lang: "X-Stainless-Lang",
  os: "X-Stainless-OS",
  packageVersion: "X-Stainless-Package-Version",
  retryCount: "X-Stainless-Retry-Count",
  runtime: "X-Stainless-Runtime",
  runtimeVersion: "X-Stainless-Runtime-Version",
  timeout: "X-Stainless-Timeout",
  dispatchId: "anthropic-dispatch-id",
  requestClass1p: "x-claude-1p-request-class",
  requestClass: "x-claude-code-request-class",
  promptId: "x-claude-code-prompt-id",
  sandyPlover: "x-claude-code-sandy-plover",
});

/** Resolves the header name table of the layout a profile follows. */
export function headerNamesFor(
  profile: ClaudeCodeProtocolProfile,
): HeaderNameTable | GenuineHeaderNameTable {
  return profileBehaviors(profile).genuineHeaderLayout
    ? GENUINE_HEADER_NAMES
    : HEADER_NAMES;
}

/** The names a caller may never supply under the legacy layout. */
const CANONICAL_NAMES: ReadonlySet<string> = new Set(
  Object.values(HEADER_NAMES),
);

/**
 * The names a caller may never supply under the genuine layout, lowercased:
 * the whole table (so every capitalisation variant is refused), which includes
 * `anthropic-dispatch-id` whether or not the request carries it.
 */
export const GENUINE_RESERVED_NAMES: ReadonlySet<string> = new Set(
  Object.values(GENUINE_HEADER_NAMES).map((name) => name.toLowerCase()),
);

/** Compares two header names by UTF-16 code unit, as a plain `<` does. */
function compareNames(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

type RequestKind = "messages" | "count_tokens";

interface HeaderRuntime {
  readonly sessionId: string;
  readonly runtime: string;
  readonly runtimeVersion: string;
  readonly os: string;
  readonly arch: string;
}

interface ValidatedInput {
  readonly accessToken: string;
  readonly runtime: HeaderRuntime;
  readonly clientRequestId: string;
  readonly betaFeatures: readonly string[];
  readonly app: "cli" | "cli-bg";
  readonly stainlessRetryCount: number;
  readonly stainlessHelper?: string;
  readonly claudeRemoteContainerId?: string;
  readonly claudeRemoteSessionId?: string;
  readonly clientApp?: string;
  readonly anthropicAdditionalProtection?: string;
  readonly extraHeaders: readonly HeaderPair[];
  readonly extraHeaderPolicy: ClaudeCodeExtraHeaderPolicy;
  readonly profile: ClaudeCodeProtocolProfile;
  readonly requestKind: RequestKind;
  readonly promptId?: string;
  readonly toolsUsed: readonly ToolsUsedEntry[];
  readonly dispatchId?: ClaudeCodeDispatchId;
}

/** Reports the headers placed on the wire plus what the policy discarded. */
export interface OrderedHeaderPlan {
  readonly headers: readonly HeaderPair[];
  /**
   * Lists the lowercased names `dropConflicting` discarded, in caller order.
   *
   * Always empty under `strict`, which throws instead of dropping.
   */
  readonly droppedExtraHeaderNames: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 31 || (codePoint >= 127 && codePoint <= 159))
    ) {
      return true;
    }
  }
  return false;
}

function assertHeaderText(name: string, value: string): void {
  if (hasControlCharacter(name) || hasControlCharacter(value)) {
    throw new ClaudeCodeWireError("HEADER_INJECTION");
  }
}

function requiredString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

function parseRuntime(value: unknown): HeaderRuntime {
  if (!isRecord(value)) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return {
    sessionId: requiredString(value, "sessionId"),
    runtime: requiredString(value, "runtime"),
    runtimeVersion: requiredString(value, "runtimeVersion"),
    os: requiredString(value, "os"),
    arch: requiredString(value, "arch"),
  };
}

function parseBetaFeatures(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  const features: string[] = [];
  for (const feature of value) {
    if (typeof feature !== "string" || feature.length === 0) {
      throw new ClaudeCodeWireError("INVALID_INPUT");
    }
    features.push(feature);
  }
  return features;
}

function parseExtraHeaders(value: unknown): readonly HeaderPair[] {
  if (!Array.isArray(value)) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  const headers: HeaderPair[] = [];
  for (const candidate of value) {
    if (
      !Array.isArray(candidate) ||
      candidate.length !== 2 ||
      typeof candidate[0] !== "string" ||
      typeof candidate[1] !== "string"
    ) {
      throw new ClaudeCodeWireError("INVALID_INPUT");
    }
    headers.push([candidate[0], candidate[1]]);
  }
  return headers;
}

function parseExtraHeaderPolicy(value: unknown): ClaudeCodeExtraHeaderPolicy {
  if (value !== "strict" && value !== "dropConflicting") {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

/**
 * Accepts a pinned profile by REFERENCE, never by shape, and returns the
 * singleton itself so nothing downstream can be handed a look-alike. Each
 * pinned profile widens the accepted set by exactly one object;
 * anything else, including a structural clone, still fails closed.
 */
function parseProfile(value: unknown): ClaudeCodeProtocolProfile {
  if (value === CLAUDE_CODE_2_1_195_PROFILE) return CLAUDE_CODE_2_1_195_PROFILE;
  if (value === CLAUDE_CODE_2_1_233_PROFILE) return CLAUDE_CODE_2_1_233_PROFILE;
  if (value === CLAUDE_CODE_2_1_280_PROFILE) return CLAUDE_CODE_2_1_280_PROFILE;
  if (value === CLAUDE_CODE_2_1_329_PROFILE) return CLAUDE_CODE_2_1_329_PROFILE;
  throw new ClaudeCodeWireError("INVALID_INPUT");
}

function parseApp(value: unknown): "cli" | "cli-bg" {
  if (value !== "cli" && value !== "cli-bg") {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

function parseRetryCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

function optionalHeaderString(
  input: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

function parseRequestKind(value: unknown): RequestKind {
  if (value === undefined) return "messages";
  if (value !== "messages" && value !== "count_tokens") {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

/**
 * The prompt id is only ever a string; its FORMAT is checked at emission
 * (`PROMPT_ID_PATTERN`), where a value upstream cannot vouch for is dropped
 * silently, so an empty or malformed string is not an error here.
 */
function parseOptionalPromptId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

/**
 * The dispatch id is a closed domain; unlike the prompt id there is no
 * upstream emission guard that silently drops a bad value, so a stray one is a
 * caller bug.
 */
function parseOptionalDispatchId(
  value: unknown,
): ClaudeCodeDispatchId | undefined {
  if (value === undefined) return undefined;
  if (value !== "v2d" && value !== "v2s" && value !== "v2p") {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return value;
}

function parseInput(input: unknown): ValidatedInput {
  if (!isRecord(input)) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  const promptId = parseOptionalPromptId(input["promptId"]);
  const dispatchId = parseOptionalDispatchId(input["dispatchId"]);
  const stainlessHelper = optionalHeaderString(input, "stainlessHelper");
  const claudeRemoteContainerId = optionalHeaderString(
    input,
    "claudeRemoteContainerId",
  );
  const claudeRemoteSessionId = optionalHeaderString(
    input,
    "claudeRemoteSessionId",
  );
  const clientApp = optionalHeaderString(input, "clientApp");
  const anthropicAdditionalProtection = optionalHeaderString(
    input,
    "anthropicAdditionalProtection",
  );
  return {
    accessToken: requiredString(input, "accessToken"),
    runtime: parseRuntime(input["runtime"]),
    clientRequestId: requiredString(input, "clientRequestId"),
    betaFeatures: parseBetaFeatures(input["betaFeatures"]),
    app: parseApp(input["app"] === undefined ? "cli" : input["app"]),
    stainlessRetryCount: parseRetryCount(
      input["stainlessRetryCount"] === undefined
        ? 0
        : input["stainlessRetryCount"],
    ),
    extraHeaders: parseExtraHeaders(input["extraHeaders"] ?? []),
    extraHeaderPolicy: parseExtraHeaderPolicy(
      input["extraHeaderPolicy"] ?? "strict",
    ),
    profile: parseProfile(input["profile"]),
    requestKind: parseRequestKind(input["requestKind"]),
    toolsUsed:
      input["toolsUsed"] === undefined
        ? []
        : validateToolsUsed(input["toolsUsed"]),
    ...(promptId === undefined ? {} : { promptId }),
    ...(dispatchId === undefined ? {} : { dispatchId }),
    ...(stainlessHelper === undefined ? {} : { stainlessHelper }),
    ...(claudeRemoteContainerId === undefined
      ? {}
      : { claudeRemoteContainerId }),
    ...(claudeRemoteSessionId === undefined ? {} : { claudeRemoteSessionId }),
    ...(clientApp === undefined ? {} : { clientApp }),
    ...(anthropicAdditionalProtection === undefined
      ? {}
      : { anthropicAdditionalProtection }),
  };
}

/**
 * Names a caller may never place on the wire through `extraHeaders`.
 *
 * Two disjoint reasons, both non-negotiable.
 *
 * CREDENTIAL AND ROUTING DISCLOSURE. `x-api-key`, `cookie`, `set-cookie`,
 * `proxy-*`, `forwarded` and `x-forwarded-*` carry authentication that would
 * contradict the OAuth bearer this package emits, or disclose the caller's
 * network topology upstream.
 *
 * HOP-BY-HOP AND ENTITY HEADERS (RFC 9110 section 7.6.1). `connection`,
 * `transfer-encoding`, `te`, `upgrade`, `keep-alive` and `host` govern a single
 * connection and belong to the transport, not to the caller. `content-length`
 * is the worst of them: this package RECONSTRUCTS the request body canonically,
 * so a length copied from an inbound request describes a different byte string.
 * A wrong `content-length` corrupts the request SILENTLY — no local error is
 * raised, the peer truncates or stalls. Blocking these is a defect fix, valid
 * independently of any consumer.
 */
const FORBIDDEN_HEADER_NAMES: ReadonlySet<string> = new Set([
  "x-api-key",
  "cookie",
  "set-cookie",
  "forwarded",
  "content-length",
  "host",
  "connection",
  "transfer-encoding",
  "te",
  "upgrade",
  "keep-alive",
]);

function isForbiddenHeader(name: string): boolean {
  return (
    FORBIDDEN_HEADER_NAMES.has(name) ||
    name.startsWith("proxy-") ||
    name.startsWith("x-forwarded-")
  );
}

function safeDiagnosticName(name: string, accessToken: string): string {
  return name.includes(accessToken) ? "[redacted]" : name;
}

interface ResolvedExtraHeaders {
  readonly kept: readonly HeaderPair[];
  readonly droppedNames: readonly string[];
}

/**
 * Applies the caller policy to the supplied extra headers.
 *
 * `strict` is the original behaviour, unchanged: the first conflict throws, and
 * nothing reaches the wire. `dropConflicting` discards the offending pair and
 * records its lowercased name, so a consumer forwarding a heterogeneous host
 * header map is not defeated by a single header this package owns.
 *
 * The relaxation covers OWNERSHIP conflicts only — a canonical name or a
 * denylisted name. Two guarantees survive in both policies:
 *
 * - Header syntax is validated FIRST and never relaxed. A control character in
 *   a name or a value raises `HEADER_INJECTION` whatever the policy says;
 *   smuggling is never silently tolerated.
 * - A caller that duplicates one of ITS OWN extra headers still gets
 *   `DUPLICATE_HEADER`. That collision is a caller bug, not an ownership
 *   conflict this package is entitled to resolve on the caller's behalf.
 */
function resolveExtraHeaders(
  extraHeaders: readonly HeaderPair[],
  accessToken: string,
  policy: ClaudeCodeExtraHeaderPolicy,
  canonicalNames: ReadonlySet<string>,
): ResolvedExtraHeaders {
  const seenExtras = new Set<string>();
  const kept: HeaderPair[] = [];
  const droppedNames: string[] = [];
  for (const [name, value] of extraHeaders) {
    assertHeaderText(name, value);
    const normalizedName = name.toLowerCase();
    const safeName = safeDiagnosticName(normalizedName, accessToken);
    const ownershipConflict = isForbiddenHeader(normalizedName)
      ? "FORBIDDEN_HEADER"
      : canonicalNames.has(normalizedName)
        ? "DUPLICATE_HEADER"
        : undefined;
    if (ownershipConflict !== undefined) {
      if (policy === "strict") {
        throw new ClaudeCodeWireError(ownershipConflict, {
          headerName: safeName,
        });
      }
      droppedNames.push(normalizedName);
      continue;
    }
    if (seenExtras.has(normalizedName)) {
      throw new ClaudeCodeWireError("DUPLICATE_HEADER", {
        headerName: safeName,
      });
    }
    seenExtras.add(normalizedName);
    kept.push([name, value]);
  }
  return { kept, droppedNames };
}

function freezePair(name: string, value: string): HeaderPair {
  const pair: HeaderPair = [name, value];
  return Object.freeze(pair);
}

function assertTokenIsolation(
  pairs: readonly HeaderPair[],
  accessToken: string,
): void {
  for (const [name, value] of pairs) {
    // Lowercased so the capitalised genuine `Authorization` is exempt too.
    if (
      name.toLowerCase() !== HEADER_NAMES.authorization &&
      value.includes(accessToken)
    ) {
      throw new ClaudeCodeWireError("INVALID_INPUT");
    }
  }
}

/**
 * The built-in pairs of the genuine layout, in no particular order (the caller
 * sorts). `count_tokens` requests carry neither the request-class pair, the
 * prompt id, the tools-used header nor the dispatch id.
 */
function genuineHeaderValues(
  validated: ValidatedInput,
  beta: string,
): (readonly [string, string])[] {
  const names = GENUINE_HEADER_NAMES;
  const values: (readonly [string, string])[] = [
    [names.accept, "application/json"],
    [names.authorization, `Bearer ${validated.accessToken}`],
    [names.contentType, "application/json"],
    [names.userAgent, validated.profile.userAgent],
    [names.sessionId, validated.runtime.sessionId],
    [names.arch, validated.runtime.arch],
    [names.lang, "js"],
    [names.os, validated.runtime.os],
    [names.packageVersion, validated.profile.sdkVersion],
    [names.retryCount, String(validated.stainlessRetryCount)],
    [names.runtime, validated.runtime.runtime],
    [names.runtimeVersion, validated.runtime.runtimeVersion],
    [names.timeout, "600"],
    [names.anthropicBeta, beta],
    [names.browserAccess, "true"],
    [names.anthropicVersion, validated.profile.anthropicVersion],
    [names.app, validated.app],
    [names.clientRequestId, validated.clientRequestId],
  ];
  if (validated.requestKind === "messages") {
    // Account-served: only on a caller's explicit opt-in, and never on
    // count-tokens. Sorts between the browser-access and version headers.
    if (
      validated.dispatchId !== undefined &&
      profileBehaviors(validated.profile).accountServedInputs
    ) {
      values.push([names.dispatchId, validated.dispatchId]);
    }
    values.push(
      [names.requestClass1p, "main"],
      [names.requestClass, "main"],
      [names.sandyPlover, serializeToolsUsed(validated.toolsUsed)],
    );
    if (
      validated.promptId !== undefined &&
      PROMPT_ID_PATTERN.test(validated.promptId)
    ) {
      values.push([names.promptId, validated.promptId]);
    }
  }
  return values;
}

/**
 * Builds the pinned canonical logical header list together with the audit of
 * whatever the extra-header policy discarded.
 *
 * Transport order is not guaranteed.
 */
export function buildOrderedHeaderPlan(input: unknown): OrderedHeaderPlan {
  const appendExtraHeaders =
    isRecord(input) &&
    (Object.hasOwn(input, "app") ||
      Object.hasOwn(input, "stainlessRetryCount") ||
      Object.hasOwn(input, "stainlessHelper") ||
      Object.hasOwn(input, "claudeRemoteContainerId") ||
      Object.hasOwn(input, "claudeRemoteSessionId") ||
      Object.hasOwn(input, "clientApp") ||
      Object.hasOwn(input, "anthropicAdditionalProtection"));
  const validated = parseInput(input);
  const layout = profileBehaviors(validated.profile).genuineHeaderLayout;
  const resolvedExtras = resolveExtraHeaders(
    validated.extraHeaders,
    validated.accessToken,
    validated.extraHeaderPolicy,
    layout ? GENUINE_RESERVED_NAMES : CANONICAL_NAMES,
  );

  const beta = validated.betaFeatures.join(",");
  const values: (readonly [string, string])[] = layout
    ? genuineHeaderValues(validated, beta)
    : [
        [HEADER_NAMES.anthropicBeta, beta],
        [HEADER_NAMES.browserAccess, "true"],
        [HEADER_NAMES.anthropicVersion, validated.profile.anthropicVersion],
        [HEADER_NAMES.authorization, `Bearer ${validated.accessToken}`],
        [HEADER_NAMES.contentType, "application/json"],
        [HEADER_NAMES.userAgent, validated.profile.userAgent],
        [HEADER_NAMES.app, validated.app],
        [HEADER_NAMES.sessionId, validated.runtime.sessionId],
        [HEADER_NAMES.clientRequestId, validated.clientRequestId],
        [HEADER_NAMES.arch, validated.runtime.arch],
        [HEADER_NAMES.lang, "js"],
        [HEADER_NAMES.os, validated.runtime.os],
        [HEADER_NAMES.packageVersion, validated.profile.sdkVersion],
        [HEADER_NAMES.retryCount, String(validated.stainlessRetryCount)],
        [HEADER_NAMES.runtime, validated.runtime.runtime],
        [HEADER_NAMES.runtimeVersion, validated.runtime.runtimeVersion],
        [HEADER_NAMES.timeout, "600"],
      ];

  const pairs: HeaderPair[] = [];
  for (const [name, value] of values) {
    assertHeaderText(name, value);
    pairs.push(freezePair(name, value));
  }
  const dynamicValues = [
    [HEADER_NAMES.stainlessHelper, validated.stainlessHelper],
    [HEADER_NAMES.remoteContainerId, validated.claudeRemoteContainerId],
    [HEADER_NAMES.remoteSessionId, validated.claudeRemoteSessionId],
    [HEADER_NAMES.clientApp, validated.clientApp],
    [
      HEADER_NAMES.additionalProtection,
      validated.anthropicAdditionalProtection,
    ],
  ] as const;
  for (const [name, value] of dynamicValues) {
    if (value === undefined) continue;
    assertHeaderText(name, value);
    pairs.push(freezePair(name, value));
  }
  if (appendExtraHeaders) {
    for (const [name, value] of resolvedExtras.kept) {
      pairs.push(freezePair(name, value));
    }
  }
  // The genuine client sorts every pair, caller extras included, by UTF-16
  // code unit. `Array.prototype.sort` is stable, so equal names keep their
  // insertion order. Never `localeCompare`: it is locale-dependent and orders
  // by collation, not by code unit.
  if (layout) pairs.sort(([left], [right]) => compareNames(left, right));
  assertTokenIsolation(pairs, validated.accessToken);
  return Object.freeze({
    headers: Object.freeze(pairs),
    droppedExtraHeaderNames: Object.freeze([...resolvedExtras.droppedNames]),
  });
}

/** Builds the pinned canonical logical header list. Transport order is not guaranteed. */
export function buildOrderedHeaders(input: unknown): readonly HeaderPair[] {
  return buildOrderedHeaderPlan(input).headers;
}
