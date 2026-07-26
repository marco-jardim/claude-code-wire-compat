// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile, HeaderPair } from "./contracts.js";
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
  readonly profile: ClaudeCodeProtocolProfile;
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

function isForbiddenHeader(name: string): boolean {
  return (
    name === "x-api-key" ||
    name === "cookie" ||
    name === "set-cookie" ||
    name.startsWith("proxy-") ||
    name === "forwarded" ||
    name.startsWith("x-forwarded-")
  );
}

function safeDiagnosticName(name: string, accessToken: string): string {
  return name.includes(accessToken) ? "[redacted]" : name;
}

function validateExtraHeaders(
  extraHeaders: readonly HeaderPair[],
  accessToken: string,
): void {
  const seen = new Set(CANONICAL_NAMES);
  for (const [name, value] of extraHeaders) {
    assertHeaderText(name, value);
    const normalizedName = name.toLowerCase();
    const safeName = safeDiagnosticName(normalizedName, accessToken);
    if (isForbiddenHeader(normalizedName)) {
      throw new ClaudeCodeWireError("FORBIDDEN_HEADER", {
        headerName: safeName,
      });
    }
    if (seen.has(normalizedName)) {
      throw new ClaudeCodeWireError("DUPLICATE_HEADER", {
        headerName: safeName,
      });
    }
    seen.add(normalizedName);
  }
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

/** Builds the pinned canonical logical header list. Transport order is not guaranteed. */
export function buildOrderedHeaders(input: unknown): readonly HeaderPair[] {
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
  validateExtraHeaders(validated.extraHeaders, validated.accessToken);

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
    for (const [name, value] of validated.extraHeaders) {
      pairs.push(freezePair(name, value));
    }
  }
  assertTokenIsolation(pairs, validated.accessToken);
  return Object.freeze(pairs);
}
