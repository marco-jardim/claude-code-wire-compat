// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeExtraHeaderPolicy,
  ClaudeCodeProtocolProfile,
  HeaderPair,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

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

const CANONICAL_NAMES: ReadonlySet<string> = new Set(
  Object.values(HEADER_NAMES),
);

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

function parseProfile(value: unknown): ClaudeCodeProtocolProfile {
  if (value !== CLAUDE_CODE_2_1_195_PROFILE) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  return CLAUDE_CODE_2_1_195_PROFILE;
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

function parseInput(input: unknown): ValidatedInput {
  if (!isRecord(input)) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
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
      : CANONICAL_NAMES.has(normalizedName)
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
    if (name !== HEADER_NAMES.authorization && value.includes(accessToken)) {
      throw new ClaudeCodeWireError("INVALID_INPUT");
    }
  }
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
  const resolvedExtras = resolveExtraHeaders(
    validated.extraHeaders,
    validated.accessToken,
    validated.extraHeaderPolicy,
  );

  const beta = validated.betaFeatures.join(",");
  const values = [
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
  ] as const;

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
