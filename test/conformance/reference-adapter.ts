// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync } from "node:fs";

import type {
  ClaudeCodeAccountFeatures,
  ClaudeCodeDispatchId,
  ClaudeCodeRequestInput,
  ClaudeCodeThreadInput,
  ClaudeCodeToolUsed,
  JsonValue,
  Message,
  SystemInput,
  ToolDefinition,
} from "../../src/contracts.js";

export type ReferenceFixtureName =
  | "outgoing-foreground.json"
  | "outgoing-canary-context-hint-off.json"
  | "outgoing-foreground-2.1.233.json"
  | "outgoing-canary-context-hint-off-2.1.233.json"
  | "outgoing-foreground-2.1.280.json"
  | "outgoing-canary-context-hint-off-2.1.280.json"
  | "outgoing-default-path-2.1.280.json"
  | "outgoing-foreground-2.1.329.json"
  | "outgoing-canary-context-hint-off-2.1.329.json"
  | "outgoing-default-path-2.1.329.json"
  | "outgoing-account-features-2.1.329.json";

/**
 * Beta identifiers the adapter reads back out of a reference fixture. The
 * fixture's beta list is the only place the 2.1.329 account-served features
 * (inline tools, a one-hour cache lifetime) are recorded, so the adapter
 * recovers those inputs from it rather than carrying a side table.
 */
const INLINE_TOOLS_BETA = "inline-tools-2026-09-15";
const EXTENDED_CACHE_TTL_BETA = "extended-cache-ttl-2025-04-11";

export interface ReferenceFixture {
  readonly url: string;
  readonly method: string;
  readonly headers: readonly (readonly [string, string])[];
  readonly body: Readonly<Record<string, JsonValue>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isHeaderPair(value: unknown): value is readonly [string, string] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string"
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function readReferenceFixture(name: ReferenceFixtureName): ReferenceFixture {
  const parsed: unknown = JSON.parse(
    readFileSync(
      new URL(`../fixtures/golden/${name}`, import.meta.url),
      "utf8",
    ),
  );
  if (
    !isRecord(parsed) ||
    typeof parsed["url"] !== "string" ||
    typeof parsed["method"] !== "string" ||
    !Array.isArray(parsed["headers"]) ||
    !parsed["headers"].every(isHeaderPair) ||
    !isRecord(parsed["body"]) ||
    !isJsonValue(parsed["body"])
  ) {
    throw new TypeError(`Malformed committed reference fixture: ${name}`);
  }
  return Object.freeze({
    url: parsed["url"],
    method: parsed["method"],
    headers: Object.freeze(
      parsed["headers"].map((pair) => Object.freeze(pair)),
    ),
    body: Object.freeze(parsed["body"]),
  });
}

/**
 * Header names compare case-insensitively: the 2.1.329 layout carries the
 * genuine client's mixed casing (`Authorization`, `X-Stainless-OS`), the
 * earlier layouts are all lower-case.
 */
function optionalHeader(
  fixture: ReferenceFixture,
  name: string,
): string | undefined {
  const wanted = name.toLowerCase();
  return fixture.headers.find(
    ([candidate]) => candidate.toLowerCase() === wanted,
  )?.[1];
}

function requiredHeader(fixture: ReferenceFixture, name: string): string {
  const value = optionalHeader(fixture, name);
  if (value === undefined)
    throw new TypeError(`Missing reference header: ${name}`);
  return value;
}

function requiredString(
  body: Readonly<Record<string, JsonValue>>,
  key: string,
): string {
  const value = body[key];
  if (typeof value !== "string")
    throw new TypeError(`Invalid reference body field: ${key}`);
  return value;
}

function requiredNumber(
  body: Readonly<Record<string, JsonValue>>,
  key: string,
): number {
  const value = body[key];
  if (typeof value !== "number")
    throw new TypeError(`Invalid reference body field: ${key}`);
  return value;
}

function isMessage(value: unknown): value is Message {
  if (
    !isRecord(value) ||
    (value["role"] !== "user" && value["role"] !== "assistant")
  ) {
    return false;
  }
  const content = value["content"];
  return (
    typeof content === "string" ||
    (Array.isArray(content) && content.every(isJsonValue))
  );
}

function isSystemInput(value: unknown): value is SystemInput {
  return (
    typeof value === "string" ||
    (isRecord(value) &&
      value["type"] === "text" &&
      typeof value["text"] === "string")
  );
}

function isAdvisorTool(value: unknown): value is ToolDefinition {
  return (
    isRecord(value) &&
    value["type"] === "advisor_20260301" &&
    value["name"] === "advisor" &&
    typeof value["model"] === "string" &&
    isJsonValue(value)
  );
}

function isToolDefinition(value: unknown): value is ToolDefinition {
  return (
    isAdvisorTool(value) ||
    (isRecord(value) &&
      typeof value["name"] === "string" &&
      (value["description"] === undefined ||
        typeof value["description"] === "string") &&
      isRecord(value["input_schema"]) &&
      isJsonValue(value["input_schema"]))
  );
}

function requiredRuntime(value: string): "node" | "bun" | "workerd" {
  if (value !== "node" && value !== "bun" && value !== "workerd") {
    throw new TypeError("Invalid reference runtime.");
  }
  return value;
}

function requiredOs(value: string): "Windows" | "Linux" | "macOS" {
  if (value !== "Windows" && value !== "Linux" && value !== "macOS") {
    throw new TypeError("Invalid reference operating system.");
  }
  return value;
}

function parseToolsUsed(
  value: string | undefined,
): readonly ClaudeCodeToolUsed[] {
  if (value === undefined) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new TypeError("Reference tools-used header is not an array.");
  }
  return parsed.map((entry): ClaudeCodeToolUsed => {
    if (!isRecord(entry) || typeof entry["name"] !== "string") {
      throw new TypeError("Reference tools-used entry is malformed.");
    }
    return {
      name: entry["name"],
      ...(entry["mcp"] === true ? { mcp: true } : {}),
      ...(typeof entry["url"] === "string" ? { url: entry["url"] } : {}),
    };
  });
}

function parseDispatchId(
  value: string | undefined,
): ClaudeCodeDispatchId | undefined {
  if (value === undefined) return undefined;
  if (value !== "v2d" && value !== "v2s" && value !== "v2p") {
    throw new TypeError("Invalid reference dispatch identifier.");
  }
  return value;
}

function parseThread(value: unknown): ClaudeCodeThreadInput | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError("Reference thread is malformed.");
  if (value["type"] === "create") return { type: "create" };
  const previous = value["previous_message_id"];
  if (value["type"] === "continue" && typeof previous === "string") {
    return { type: "continue", previousMessageId: previous };
  }
  throw new TypeError("Reference thread is malformed.");
}

/**
 * The billing block carries the prompt-id, turn-origin and turn-position
 * segments the caller supplied. The prompt id is read from its header; the
 * origin and the position pair only exist in the billing text.
 */
function billingTail(system: readonly unknown[]): {
  readonly turnOrigin?: string;
  readonly turnPosition?: { promptIndex: number; turnIndex: number };
} {
  const billing: unknown = system[0];
  const text =
    isRecord(billing) && typeof billing["text"] === "string"
      ? billing["text"]
      : "";
  const origin = /; cc_turn_origin=([a-z_]+);/u.exec(text)?.[1];
  const position = /; cc_prompt_index=(\d+); cc_turn_index=(\d+);/u.exec(text);
  return {
    ...(origin === undefined ? {} : { turnOrigin: origin }),
    ...(position?.[1] === undefined || position[2] === undefined
      ? {}
      : {
          turnPosition: {
            promptIndex: Number(position[1]),
            turnIndex: Number(position[2]),
          },
        }),
  };
}

/**
 * Inputs the 2.1.329 wire records outside the fields the earlier fixtures
 * carry: the prompt-id, tools-used and dispatch headers, the billing tail, the
 * diagnostics and thread body fields, and the inline-tools and one-hour-cache
 * betas. Every one is absent from the earlier fixtures, so this adds nothing
 * to them.
 */
function accountServedInputs(
  fixture: ReferenceFixture,
  system: readonly unknown[],
): Partial<ClaudeCodeRequestInput> {
  const betas = (optionalHeader(fixture, "anthropic-beta") ?? "").split(",");
  const promptId = optionalHeader(fixture, "x-claude-code-prompt-id");
  const toolsUsed = parseToolsUsed(
    optionalHeader(fixture, "x-claude-code-sandy-plover"),
  );
  const dispatchId = parseDispatchId(
    optionalHeader(fixture, "anthropic-dispatch-id"),
  );
  const thread = parseThread(fixture.body["thread"]);
  const diagnostics = fixture.body["diagnostics"];
  const previousMessageId = isRecord(diagnostics)
    ? diagnostics["previous_message_id"]
    : undefined;
  const features: ClaudeCodeAccountFeatures = {
    ...(dispatchId === undefined ? {} : { dispatchId }),
    ...(betas.includes(INLINE_TOOLS_BETA) ? { inlineTools: true } : {}),
    ...(thread === undefined ? {} : { thread }),
  };
  return {
    ...(promptId === undefined ? {} : { promptId }),
    ...billingTail(system),
    ...(toolsUsed.length === 0 ? {} : { toolsUsed }),
    ...(typeof previousMessageId === "string" ? { previousMessageId } : {}),
    ...(Object.keys(features).length === 0
      ? {}
      : { accountFeatures: features }),
    ...(betas.includes(EXTENDED_CACHE_TTL_BETA)
      ? { cacheControl: { ttl: "1h" as const } }
      : {}),
    ...(fixture.body["stream"] === true ? { stream: true } : {}),
  };
}

export function referenceAdapter(name: ReferenceFixtureName): ReferenceFixture {
  return readReferenceFixture(name);
}

export function syntheticInput(
  fixture: ReferenceFixture,
): ClaudeCodeRequestInput {
  const messages = fixture.body["messages"];
  const system = fixture.body["system"];
  const metadata = fixture.body["metadata"];
  if (
    !Array.isArray(messages) ||
    !messages.every(isMessage) ||
    !Array.isArray(system) ||
    !isRecord(metadata) ||
    typeof metadata["user_id"] !== "string"
  ) {
    throw new TypeError("Reference body is missing messages or system blocks.");
  }
  const suppliedSystem = system.slice(2);
  if (!suppliedSystem.every(isSystemInput)) {
    throw new TypeError("Reference body has malformed supplied system blocks.");
  }
  const identity: unknown = JSON.parse(metadata["user_id"]);
  if (
    !isRecord(identity) ||
    typeof identity["session_id"] !== "string" ||
    typeof identity["device_id"] !== "string" ||
    typeof identity["account_uuid"] !== "string"
  ) {
    throw new TypeError(
      "Reference body has malformed runtime identity metadata.",
    );
  }
  let input: ClaudeCodeRequestInput & { readonly clientRequestId: string } = {
    accessToken: requiredHeader(fixture, "authorization").replace(
      /^Bearer /u,
      "",
    ),
    model: requiredString(fixture.body, "model"),
    maxTokens: requiredNumber(fixture.body, "max_tokens"),
    messages,
    system: suppliedSystem,
    runtime: {
      sessionId: identity["session_id"],
      deviceId: identity["device_id"],
      accountUuid: identity["account_uuid"],
      runtime: requiredRuntime(requiredHeader(fixture, "x-stainless-runtime")),
      runtimeVersion: requiredHeader(fixture, "x-stainless-runtime-version"),
      os: requiredOs(requiredHeader(fixture, "x-stainless-os")),
      arch: requiredHeader(fixture, "x-stainless-arch"),
    },
    clientRequestId: requiredHeader(fixture, "x-client-request-id"),
  };
  const tools = fixture.body["tools"];
  if (tools !== undefined) {
    if (!Array.isArray(tools) || !tools.every(isToolDefinition)) {
      throw new TypeError("Reference body has malformed tools.");
    }
    input = { ...input, tools };
  }
  const thinking = fixture.body["thinking"];
  if (isRecord(thinking)) {
    if (
      (thinking["type"] !== "enabled" && thinking["type"] !== "adaptive") ||
      (thinking["budget_tokens"] !== undefined &&
        typeof thinking["budget_tokens"] !== "number")
    ) {
      throw new TypeError(
        "Reference body has malformed thinking configuration.",
      );
    }
    input = {
      ...input,
      thinking: {
        type: thinking["type"],
        ...(typeof thinking["budget_tokens"] === "number"
          ? { budgetTokens: thinking["budget_tokens"] }
          : {}),
      },
    };
  }
  const outputConfig = fixture.body["output_config"];
  if (isRecord(outputConfig)) {
    const effort = outputConfig["effort"];
    if (
      effort !== "low" &&
      effort !== "medium" &&
      effort !== "high" &&
      effort !== "xhigh" &&
      effort !== "max"
    ) {
      throw new TypeError("Reference body has malformed effort configuration.");
    }
    input = { ...input, effort };
  }
  return { ...input, ...accountServedInputs(fixture, system) };
}
