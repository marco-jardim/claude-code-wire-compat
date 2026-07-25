// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync } from "node:fs";

import type {
  ClaudeCodeRequestInput,
  JsonValue,
  Message,
  SystemInput,
  ToolDefinition,
} from "../../src/contracts.js";

export type ReferenceFixtureName =
  "outgoing-foreground.json" | "outgoing-canary-context-hint-off.json";

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

function requiredHeader(fixture: ReferenceFixture, name: string): string {
  const value = fixture.headers.find(([candidate]) => candidate === name)?.[1];
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

function isToolDefinition(value: unknown): value is ToolDefinition {
  return (
    isRecord(value) &&
    typeof value["name"] === "string" &&
    (value["description"] === undefined ||
      typeof value["description"] === "string") &&
    isRecord(value["input_schema"]) &&
    isJsonValue(value["input_schema"])
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
      effort !== "max"
    ) {
      throw new TypeError("Reference body has malformed effort configuration.");
    }
    input = { ...input, effort };
  }
  return input;
}
