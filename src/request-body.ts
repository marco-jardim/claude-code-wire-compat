// SPDX-License-Identifier: GPL-3.0-or-later

import { ClaudeCodeWireError } from "./contracts.js";
import type {
  CacheControlEphemeral,
  ClaudeCodeProtocolProfile,
  CitationsConfigParam,
  DocumentBlock,
  ImageBlock,
  JsonValue,
  Message,
  MessageContentBlock,
  RedactedThinkingBlock,
  SearchResultBlock,
  TextBlock,
  TextCitationParam,
  ThinkingBlock,
  ToolDefinition,
  ToolReferenceBlock,
  ToolResultBlock,
  ToolResultContentBlock,
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

function validatedJsonObject(
  value: unknown,
): Readonly<Record<string, JsonValue>> {
  const record = requireRecord(value);
  const entries: [string, JsonValue][] = [];
  for (const key of Object.keys(record)) {
    entries.push([key, validatedJson(record[key])]);
  }
  return Object.fromEntries(entries);
}

function validatedJson(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => validatedJson(item));
  return validatedJsonObject(value);
}

function requireNumber(value: unknown): number {
  if (typeof value !== "number") fail("INVALID_INPUT");
  return value;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail("INVALID_INPUT");
  return value;
}

function requireKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) fail("INVALID_INPUT");
  }
  for (const key of required) {
    if (!hasOwn(record, key)) fail("INVALID_INPUT");
  }
}

function nullable<T>(value: unknown, validate: (item: unknown) => T): T | null {
  return value === null ? null : validate(value);
}

function cacheControl(
  value: unknown,
  allowScope = false,
): CacheControlEphemeral {
  const record = requireRecord(value);
  requireKeys(record, allowScope ? ["type", "ttl", "scope"] : ["type", "ttl"], [
    "type",
  ]);
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") {
      if (item !== "ephemeral") fail("INVALID_INPUT");
      entries.push([key, item]);
    } else if (key === "ttl") {
      if (item !== "5m" && item !== "1h") fail("INVALID_INPUT");
      entries.push([key, item]);
    } else {
      if (item !== "global") fail("INVALID_INPUT");
      entries.push([key, item]);
    }
  }
  return Object.fromEntries(entries) as unknown as CacheControlEphemeral;
}

function citationsConfig(value: unknown): CitationsConfigParam {
  const record = requireRecord(value);
  requireKeys(record, ["enabled"], []);
  return Object.fromEntries(
    Object.keys(record).map((key) => [key, requireBoolean(record[key])]),
  );
}

function textCitation(value: unknown): TextCitationParam {
  const record = requireRecord(value);
  const type = record["type"];
  const common = ["cited_text", "type"];
  let strings: readonly string[];
  let numbers: readonly string[];
  let nullableStrings: readonly string[];
  if (type === "char_location") {
    strings = ["cited_text"];
    numbers = ["document_index", "end_char_index", "start_char_index"];
    nullableStrings = ["document_title"];
  } else if (type === "content_block_location") {
    strings = ["cited_text"];
    numbers = ["document_index", "end_block_index", "start_block_index"];
    nullableStrings = ["document_title"];
  } else if (type === "page_location") {
    strings = ["cited_text"];
    numbers = ["document_index", "end_page_number", "start_page_number"];
    nullableStrings = ["document_title"];
  } else if (type === "search_result_location") {
    strings = ["cited_text", "source"];
    numbers = ["end_block_index", "search_result_index", "start_block_index"];
    nullableStrings = ["title"];
  } else if (type === "web_search_result_location") {
    strings = ["cited_text", "encrypted_index", "url"];
    numbers = [];
    nullableStrings = ["title"];
  } else {
    return fail("INVALID_INPUT");
  }
  const allowed = [...common, ...strings, ...numbers, ...nullableStrings];
  requireKeys(record, allowed, allowed);
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") entries.push([key, type]);
    else if (numbers.includes(key)) entries.push([key, requireNumber(item)]);
    else if (nullableStrings.includes(key))
      entries.push([key, nullable(item, requireString)]);
    else entries.push([key, requireString(item)]);
  }
  return Object.fromEntries(entries) as unknown as TextCitationParam;
}

function textBlock(value: unknown): TextBlock {
  const record = requireRecord(value);
  requireKeys(
    record,
    ["text", "type", "cache_control", "citations"],
    ["text", "type"],
  );
  if (record["type"] !== "text") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "text") entries.push([key, requireString(item)]);
    else if (key === "type") entries.push([key, "text"]);
    else if (key === "cache_control")
      entries.push([key, nullable(item, (raw) => cacheControl(raw, true))]);
    else {
      if (item === null) entries.push([key, null]);
      else {
        if (!Array.isArray(item)) fail("INVALID_INPUT");
        entries.push([key, item.map((citation) => textCitation(citation))]);
      }
    }
  }
  return Object.fromEntries(entries) as unknown as TextBlock;
}

function imageBlock(value: unknown): ImageBlock {
  const record = requireRecord(value);
  requireKeys(record, ["source", "type", "cache_control"], ["source", "type"]);
  if (record["type"] !== "image") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") entries.push([key, "image"]);
    else if (key === "cache_control")
      entries.push([key, nullable(item, cacheControl)]);
    else entries.push([key, imageSource(item)]);
  }
  return Object.fromEntries(entries) as unknown as ImageBlock;
}

function imageSource(value: unknown): ImageBlock["source"] {
  const record = requireRecord(value);
  const type = record["type"];
  const allowed =
    type === "base64"
      ? ["data", "media_type", "type"]
      : type === "file"
        ? ["file_id", "type"]
        : type === "url"
          ? ["type", "url"]
          : fail("INVALID_INPUT");
  requireKeys(record, allowed, allowed);
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") entries.push([key, type]);
    else if (key === "media_type") {
      if (
        item !== "image/jpeg" &&
        item !== "image/png" &&
        item !== "image/gif" &&
        item !== "image/webp"
      )
        fail("INVALID_INPUT");
      entries.push([key, item]);
    } else entries.push([key, requireString(item)]);
  }
  return Object.fromEntries(entries) as unknown as ImageBlock["source"];
}

function documentBlock(value: unknown): DocumentBlock {
  const record = requireRecord(value);
  requireKeys(
    record,
    ["source", "type", "cache_control", "citations", "context", "title"],
    ["source", "type"],
  );
  if (record["type"] !== "document") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "source") entries.push([key, documentSource(item)]);
    else if (key === "type") entries.push([key, "document"]);
    else if (key === "cache_control")
      entries.push([key, nullable(item, cacheControl)]);
    else if (key === "citations")
      entries.push([key, nullable(item, citationsConfig)]);
    else entries.push([key, nullable(item, requireString)]);
  }
  return Object.fromEntries(entries) as unknown as DocumentBlock;
}

function documentSource(value: unknown): DocumentBlock["source"] {
  const record = requireRecord(value);
  const type = record["type"];
  let allowed: readonly string[];
  if (type === "base64" || type === "text")
    allowed = ["data", "media_type", "type"];
  else if (type === "content") allowed = ["content", "type"];
  else if (type === "url") allowed = ["type", "url"];
  else if (type === "file") allowed = ["file_id", "type"];
  else return fail("INVALID_INPUT");
  requireKeys(record, allowed, allowed);
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") entries.push([key, type]);
    else if (key === "media_type") {
      if (
        (type === "base64" && item !== "application/pdf") ||
        (type === "text" && item !== "text/plain")
      )
        fail("INVALID_INPUT");
      entries.push([key, item]);
    } else if (key === "content") {
      if (typeof item === "string") entries.push([key, item]);
      else {
        if (!Array.isArray(item)) fail("INVALID_INPUT");
        entries.push([
          key,
          item.map((block) => {
            const blockRecord = requireRecord(block);
            if (blockRecord["type"] === "text") return textBlock(blockRecord);
            if (blockRecord["type"] === "image") return imageBlock(blockRecord);
            return fail("INVALID_INPUT");
          }),
        ]);
      }
    } else entries.push([key, requireString(item)]);
  }
  return Object.fromEntries(entries) as unknown as DocumentBlock["source"];
}

function thinkingBlock(value: unknown): ThinkingBlock {
  const record = requireRecord(value);
  requireKeys(
    record,
    ["signature", "thinking", "type"],
    ["signature", "thinking", "type"],
  );
  if (record["type"] !== "thinking") fail("INVALID_INPUT");
  return Object.fromEntries(
    Object.keys(record).map((key) => [
      key,
      key === "type" ? "thinking" : requireString(record[key]),
    ]),
  ) as unknown as ThinkingBlock;
}

function redactedThinkingBlock(value: unknown): RedactedThinkingBlock {
  const record = requireRecord(value);
  requireKeys(record, ["data", "type"], ["data", "type"]);
  if (record["type"] !== "redacted_thinking") fail("INVALID_INPUT");
  return Object.fromEntries(
    Object.keys(record).map((key) => [
      key,
      key === "type" ? "redacted_thinking" : requireString(record[key]),
    ]),
  ) as unknown as RedactedThinkingBlock;
}

function searchResultBlock(value: unknown): SearchResultBlock {
  const record = requireRecord(value);
  requireKeys(
    record,
    ["content", "source", "title", "type", "cache_control", "citations"],
    ["content", "source", "title", "type"],
  );
  if (record["type"] !== "search_result") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "content") {
      if (!Array.isArray(item)) fail("INVALID_INPUT");
      entries.push([key, item.map((block) => textBlock(block))]);
    } else if (key === "source" || key === "title")
      entries.push([key, requireString(item)]);
    else if (key === "type") entries.push([key, "search_result"]);
    else if (key === "cache_control")
      entries.push([key, nullable(item, cacheControl)]);
    else entries.push([key, citationsConfig(item)]);
  }
  return Object.fromEntries(entries) as unknown as SearchResultBlock;
}

function toolReferenceBlock(value: unknown): ToolReferenceBlock {
  const record = requireRecord(value);
  requireKeys(
    record,
    ["tool_name", "type", "cache_control"],
    ["tool_name", "type"],
  );
  if (record["type"] !== "tool_reference") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "tool_name") entries.push([key, requireString(item)]);
    else if (key === "type") entries.push([key, "tool_reference"]);
    else entries.push([key, nullable(item, cacheControl)]);
  }
  return Object.fromEntries(entries) as unknown as ToolReferenceBlock;
}

function toolUseBlock(value: unknown): ToolUseBlock {
  const record = requireRecord(value);
  requireKeys(
    record,
    ["id", "input", "name", "type", "cache_control", "caller"],
    ["id", "input", "name", "type"],
  );
  if (record["type"] !== "tool_use") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "id" || key === "name")
      entries.push([key, requireString(item)]);
    else if (key === "input") entries.push([key, validatedJson(item)]);
    else if (key === "type") entries.push([key, "tool_use"]);
    else if (key === "cache_control")
      entries.push([key, nullable(item, cacheControl)]);
    else entries.push([key, toolCaller(item)]);
  }
  return Object.fromEntries(entries) as unknown as ToolUseBlock;
}

function toolCaller(value: unknown): ToolUseBlock["caller"] {
  const record = requireRecord(value);
  const type = record["type"];
  if (type === "direct") {
    requireKeys(record, ["type"], ["type"]);
    return { type };
  }
  if (type !== "code_execution_20250825" && type !== "code_execution_20260120")
    return fail("INVALID_INPUT");
  requireKeys(record, ["tool_id", "type"], ["tool_id", "type"]);
  return Object.fromEntries(
    Object.keys(record).map((key) => [
      key,
      key === "type" ? type : requireString(record[key]),
    ]),
  ) as unknown as NonNullable<ToolUseBlock["caller"]>;
}

function toolResultContentBlock(value: unknown): ToolResultContentBlock {
  const record = requireRecord(value);
  if (record["type"] === "text") return textBlock(record);
  if (record["type"] === "image") return imageBlock(record);
  if (record["type"] === "search_result") return searchResultBlock(record);
  if (record["type"] === "document") return documentBlock(record);
  if (record["type"] === "tool_reference") return toolReferenceBlock(record);
  return fail("INVALID_INPUT");
}

function toolResultBlock(value: unknown): ToolResultBlock {
  const record = requireRecord(value);
  requireKeys(
    record,
    ["tool_use_id", "type", "cache_control", "content", "is_error"],
    ["tool_use_id", "type"],
  );
  if (record["type"] !== "tool_result") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "tool_use_id") entries.push([key, requireString(item)]);
    else if (key === "type") entries.push([key, "tool_result"]);
    else if (key === "cache_control")
      entries.push([key, nullable(item, cacheControl)]);
    else if (key === "content") {
      if (typeof item === "string") entries.push([key, item]);
      else {
        if (!Array.isArray(item)) fail("INVALID_INPUT");
        entries.push([key, item.map((block) => toolResultContentBlock(block))]);
      }
    } else entries.push([key, requireBoolean(item)]);
  }
  return Object.fromEntries(entries) as unknown as ToolResultBlock;
}

function messageContentBlock(value: unknown): MessageContentBlock {
  const record = requireRecord(value);
  if (record["type"] === "text") return textBlock(record);
  if (record["type"] === "image") return imageBlock(record);
  if (record["type"] === "document") return documentBlock(record);
  if (record["type"] === "search_result") return searchResultBlock(record);
  if (record["type"] === "thinking") return thinkingBlock(record);
  if (record["type"] === "redacted_thinking")
    return redactedThinkingBlock(record);
  return fail("INVALID_INPUT");
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
      return messageContentBlock(blockRecord);
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
    const schema = validatedJsonObject(record["input_schema"]);
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
        cache_control: cacheControl(record["cache_control"], true),
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
  // validatedJsonObject returns a record by construction.
  return validatedJsonObject(record);
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
