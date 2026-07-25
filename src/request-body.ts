// SPDX-License-Identifier: GPL-3.0-or-later

import { ClaudeCodeWireError } from "./contracts.js";
import type {
  ClaudeCodeProtocolProfile,
  JsonValue,
  Message,
  TextBlock,
  ToolDefinition,
  ToolResultBlock,
  ToolUseBlock,
} from "./contracts.js";
import { classifySurrogateAt } from "./unicode.js";

const MAX_DEPTH = 100;
const MAX_ITEMS = 100_000;
const MAX_SIZE = 1_000_000;
const CONTEXT_HINT_BETA = "context-hint-2026-04-09";
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

interface InspectionState {
  readonly active: WeakSet<object>;
  items: number;
  size: number;
}

type ModelResolution = Readonly<{
  id: string;
  capabilities: Readonly<{
    contextHint: boolean;
    adaptiveThinking: boolean;
    effort: boolean;
  }>;
}>;

function fail(
  code: ConstructorParameters<typeof ClaudeCodeWireError>[0],
): never {
  throw new ClaudeCodeWireError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function inspectString(value: string, state: InspectionState): void {
  state.size += value.length;
  if (state.size > MAX_SIZE) fail("INPUT_TOO_LARGE");

  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (
      unit <= 0x08 ||
      unit === 0x0b ||
      unit === 0x0c ||
      (unit >= 0x0e && unit <= 0x1f) ||
      unit === 0x7f
    ) {
      fail("INVALID_INPUT");
    }
    const classification = classifySurrogateAt(value, index);
    if (classification === "loneSurrogate") fail("INVALID_UNICODE");
    if (classification === "surrogatePair") index += 1;
  }
}

function inspect(value: unknown, depth: number, state: InspectionState): void {
  if (depth > MAX_DEPTH) fail("INPUT_TOO_DEEP");
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    inspectString(value, state);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("INVALID_INPUT");
    return;
  }
  if (typeof value !== "object") fail("INVALID_INPUT");

  if (state.active.has(value)) fail("CYCLIC_INPUT");
  state.active.add(value);
  state.items += 1;
  if (state.items > MAX_ITEMS) fail("INPUT_TOO_LARGE");

  if (Array.isArray(value)) {
    state.size += value.length;
    if (state.size > MAX_SIZE) fail("INPUT_TOO_LARGE");
    for (let index = 0; index < value.length; index += 1) {
      if (!hasOwn(value, String(index))) fail("INVALID_INPUT");
      inspect(value[index], depth + 1, state);
    }
  } else {
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("INVALID_INPUT");
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || FORBIDDEN_KEYS.has(key)) {
        fail("INVALID_INPUT");
      }
      inspectString(key, state);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) {
        fail("INVALID_INPUT");
      }
      inspect(descriptor.value, depth + 1, state);
    }
  }
  state.active.delete(value);
}

function inspectInputs(values: readonly unknown[]): void {
  const state: InspectionState = {
    active: new WeakSet(),
    items: 0,
    size: 0,
  };
  for (const value of values) inspect(value, 0, state);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) fail("INVALID_INPUT");
  return value;
}

function requireString(value: unknown): string {
  if (typeof value !== "string") fail("INVALID_INPUT");
  return value;
}

function requirePositiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value <= 0) {
    fail("INVALID_INPUT");
  }
  return value;
}

function canonicalJsonObject(
  value: unknown,
): Readonly<Record<string, JsonValue>> {
  const record = requireRecord(value);
  const entries: [string, JsonValue][] = [];
  for (const key of Object.keys(record).sort()) {
    entries.push([key, canonicalJson(record[key])]);
  }
  return Object.fromEntries(entries);
}

function canonicalJson(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalJson(item));
  return canonicalJsonObject(value);
}

function cacheControl(value: unknown): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  if (record["type"] !== "ephemeral") fail("INVALID_INPUT");
  const result: Record<string, unknown> = { type: "ephemeral" };
  if (hasOwn(record, "ttl")) {
    if (record["ttl"] !== "5m" && record["ttl"] !== "1h") {
      fail("INVALID_INPUT");
    }
    result["ttl"] = record["ttl"];
  }
  if (hasOwn(record, "scope")) {
    if (record["scope"] !== "global") fail("INVALID_INPUT");
    result["scope"] = "global";
  }
  return result;
}

function textBlock(value: unknown): TextBlock {
  const record = requireRecord(value);
  if (record["type"] !== "text") fail("INVALID_INPUT");
  const base = {
    type: "text",
    text: requireString(record["text"]),
  } as const;
  if (hasOwn(record, "cache_control")) {
    return {
      ...base,
      cache_control: cacheControl(record["cache_control"]),
    } as TextBlock;
  }
  return base;
}

function toolUseBlock(value: unknown): ToolUseBlock {
  const record = requireRecord(value);
  if (record["type"] !== "tool_use") fail("INVALID_INPUT");
  const input = canonicalJsonObject(record["input"]);
  return {
    type: "tool_use",
    id: requireString(record["id"]),
    name: requireString(record["name"]),
    input,
  };
}

function toolResultBlock(value: unknown): ToolResultBlock {
  const record = requireRecord(value);
  if (record["type"] !== "tool_result") fail("INVALID_INPUT");
  const rawContent = record["content"];
  const content = Array.isArray(rawContent)
    ? rawContent.map((item) => textBlock(item))
    : requireString(rawContent);
  const result: {
    type: "tool_result";
    tool_use_id: string;
    content: string | readonly TextBlock[];
    is_error?: boolean;
  } = {
    type: "tool_result",
    tool_use_id: requireString(record["tool_use_id"]),
    content,
  };
  if (hasOwn(record, "is_error")) {
    if (typeof record["is_error"] !== "boolean") fail("INVALID_INPUT");
    result.is_error = record["is_error"];
  }
  return result;
}

function messages(value: unknown): readonly Message[] {
  if (!Array.isArray(value)) fail("INVALID_INPUT");
  const useIds = new Set<string>();
  const resultIds: string[] = [];
  const result = value.map((item): Message => {
    const record = requireRecord(item);
    const role = record["role"];
    if (role !== "user" && role !== "assistant") fail("INVALID_INPUT");
    const rawContent = record["content"];
    if (typeof rawContent === "string") return { role, content: rawContent };
    if (!Array.isArray(rawContent)) fail("INVALID_INPUT");
    const content = rawContent.map((block) => {
      const blockRecord = requireRecord(block);
      if (blockRecord["type"] === "text") return textBlock(blockRecord);
      if (blockRecord["type"] === "tool_use") {
        const parsed = toolUseBlock(blockRecord);
        if (useIds.has(parsed.id)) fail("INVALID_INPUT");
        useIds.add(parsed.id);
        return parsed;
      }
      if (blockRecord["type"] === "tool_result") {
        const parsed = toolResultBlock(blockRecord);
        resultIds.push(parsed.tool_use_id);
        return parsed;
      }
      return fail("INVALID_INPUT");
    });
    return { role, content };
  });
  for (const id of resultIds) {
    if (!useIds.has(id)) fail("INVALID_INPUT");
  }
  return result;
}

function system(value: unknown): readonly TextBlock[] {
  if (!Array.isArray(value)) fail("INVALID_INPUT");
  return value.map((item) =>
    typeof item === "string" ? { type: "text", text: item } : textBlock(item),
  );
}

function tools(value: unknown): readonly ToolDefinition[] {
  if (!Array.isArray(value)) fail("INVALID_INPUT");
  const names = new Set<string>();
  return value.map((item) => {
    const record = requireRecord(item);
    const name = requireString(record["name"]);
    if (names.has(name)) fail("INVALID_INPUT");
    names.add(name);
    const schema = canonicalJsonObject(record["input_schema"]);
    const result: ToolDefinition = hasOwn(record, "description")
      ? {
          name,
          description: requireString(record["description"]),
          input_schema: schema,
        }
      : { name, input_schema: schema };
    if (hasOwn(record, "cache_control")) {
      return {
        ...result,
        cache_control: cacheControl(record["cache_control"]),
      };
    }
    return result;
  });
}

function modelResolution(value: unknown): ModelResolution {
  const record = requireRecord(value);
  const capabilities = requireRecord(record["capabilities"]);
  if (
    typeof capabilities["contextHint"] !== "boolean" ||
    typeof capabilities["adaptiveThinking"] !== "boolean" ||
    typeof capabilities["effort"] !== "boolean"
  ) {
    fail("INVALID_INPUT");
  }
  return {
    id: requireString(record["id"]),
    capabilities: {
      contextHint: capabilities["contextHint"],
      adaptiveThinking: capabilities["adaptiveThinking"],
      effort: capabilities["effort"],
    },
  };
}

function metadata(value: unknown): Readonly<Record<string, JsonValue>> {
  const record = requireRecord(value);
  if (hasOwn(record, "user_id") && typeof record["user_id"] !== "string") {
    fail("INVALID_INPUT");
  }
  // canonicalJsonObject returns a record by construction.
  return canonicalJsonObject(record);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value))
      deepFreeze(Reflect.get(value, key));
    Object.freeze(value);
  }
  return value;
}

function contextHintEnabled(
  input: Record<string, unknown>,
  model: ModelResolution,
  profile: unknown,
): boolean {
  const requested = isRecord(input["capabilities"])
    ? input["capabilities"]["contextHint"] === true
    : false;
  if (!requested || !model.capabilities.contextHint || !isRecord(profile)) {
    return false;
  }
  const betas = profile["orderedBetas"];
  return Array.isArray(betas) && betas.includes(CONTEXT_HINT_BETA);
}

export function buildCanonicalBody(
  rawInput: unknown,
  rawResolvedModel: unknown,
  rawSystemBlocks: unknown,
  rawMetadata: unknown,
  profile?: ClaudeCodeProtocolProfile,
): Readonly<Record<string, unknown>> {
  inspectInputs([
    rawInput,
    rawResolvedModel,
    rawSystemBlocks,
    rawMetadata,
    ...(profile === undefined ? [] : [profile]),
  ]);

  const input = requireRecord(rawInput);
  const resolvedModel = modelResolution(rawResolvedModel);
  if (hasOwn(input, "model") && input["model"] !== resolvedModel.id) {
    fail("UNSUPPORTED_MODEL");
  }

  const result: Record<string, unknown> = {
    model: resolvedModel.id,
    max_tokens: requirePositiveInteger(input["maxTokens"]),
    system: system(rawSystemBlocks),
    messages: messages(input["messages"]),
  };

  if (hasOwn(input, "tools")) result["tools"] = tools(input["tools"]);

  let thinkingActive = false;
  if (hasOwn(input, "thinking")) {
    const rawThinking = requireRecord(input["thinking"]);
    const type = rawThinking["type"];
    if (type !== "enabled" && type !== "adaptive") fail("INVALID_THINKING");
    if (type === "adaptive" && !resolvedModel.capabilities.adaptiveThinking) {
      fail("INVALID_THINKING");
    }
    const thinking: Record<string, unknown> = { type };
    if (type === "enabled") {
      if (!hasOwn(rawThinking, "budgetTokens")) fail("INVALID_THINKING");
      thinking["budget_tokens"] = requirePositiveInteger(
        rawThinking["budgetTokens"],
      );
    } else if (hasOwn(rawThinking, "budgetTokens")) {
      fail("INVALID_THINKING");
    }
    result["thinking"] = thinking;
    thinkingActive = true;
  }

  if (!thinkingActive) result["temperature"] = 1;

  if (hasOwn(input, "effort")) {
    const effort = input["effort"];
    if (
      !resolvedModel.capabilities.effort ||
      (effort !== "low" &&
        effort !== "medium" &&
        effort !== "high" &&
        effort !== "max")
    ) {
      fail("INVALID_EFFORT");
    }
    if (
      isRecord(result["thinking"]) &&
      result["thinking"]["type"] === "adaptive"
    ) {
      result["output_config"] = { effort };
    }
  }

  if (contextHintEnabled(input, resolvedModel, profile)) {
    result["context_hint"] = { enabled: true };
  }
  result["metadata"] = metadata(rawMetadata);
  return deepFreeze(result);
}
