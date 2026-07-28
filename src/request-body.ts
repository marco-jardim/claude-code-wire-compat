// SPDX-License-Identifier: GPL-3.0-or-later

import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
import { clampMaxTokens, resolveThinking } from "./thinking.js";
import type { ThinkingDisplay, ThinkingRequest } from "./thinking.js";

import { ClaudeCodeWireError } from "./contracts.js";
import type {
  CacheControlEphemeral,
  ClaudeCodeCacheControlInput,
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
import { deriveCapabilities } from "./model-capabilities.js";
import { stripModelMarkers } from "./model-identity.js";
import { IDENTITY_TEXT } from "./system-prompt.js";
import { classifySurrogateAt } from "./unicode.js";

const MAX_DEPTH = 100;
const MAX_ITEMS = 100_000;
const MAX_SIZE = 1_000_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MESSAGE_KEYS = new Set(["role", "content"]);
const CACHE_CONTROL_KEYS = new Set(["type", "ttl"]);
const LEGACY_TEXT_CACHE_CONTROL_KEYS = new Set(["type", "ttl", "scope"]);
const CITATIONS_CONFIG_KEYS = new Set(["enabled"]);
const TEXT_KEYS = new Set(["text", "type", "cache_control", "citations"]);
const TOOL_USE_KEYS = new Set([
  "id",
  "input",
  "name",
  "type",
  "cache_control",
  "caller",
]);
const TOOL_RESULT_KEYS = new Set([
  "tool_use_id",
  "type",
  "cache_control",
  "content",
  "is_error",
]);
const THINKING_BLOCK_KEYS = new Set(["signature", "thinking", "type"]);
const REDACTED_THINKING_BLOCK_KEYS = new Set(["data", "type"]);
/*
 * The `preserveThinkingBlockCacheControl` allowlists. They grow by exactly ONE
 * key over the strict sets above; every other key stays refused, so the seam
 * widens the contract by the single field the API itself round-trips and by
 * nothing else. See the seam's JSDoc on `ClaudeCodeRequestInput`.
 */
const THINKING_BLOCK_CACHE_CONTROL_KEYS = new Set([
  ...THINKING_BLOCK_KEYS,
  "cache_control",
]);
const REDACTED_THINKING_BLOCK_CACHE_CONTROL_KEYS = new Set([
  ...REDACTED_THINKING_BLOCK_KEYS,
  "cache_control",
]);
const IMAGE_BLOCK_KEYS = new Set(["source", "type", "cache_control"]);
const BASE64_IMAGE_SOURCE_KEYS = new Set(["data", "media_type", "type"]);
const FILE_IMAGE_SOURCE_KEYS = new Set(["file_id", "type"]);
const URL_IMAGE_SOURCE_KEYS = new Set(["type", "url"]);
const DOCUMENT_BLOCK_KEYS = new Set([
  "source",
  "type",
  "cache_control",
  "citations",
  "context",
  "title",
]);
const BASE64_PDF_SOURCE_KEYS = new Set(["data", "media_type", "type"]);
const CONTENT_BLOCK_SOURCE_KEYS = new Set(["content", "type"]);
const FILE_DOCUMENT_SOURCE_KEYS = new Set(["file_id", "type"]);
const PLAIN_TEXT_SOURCE_KEYS = new Set(["data", "media_type", "type"]);
const URL_PDF_SOURCE_KEYS = new Set(["type", "url"]);
const SEARCH_RESULT_KEYS = new Set([
  "content",
  "source",
  "title",
  "type",
  "cache_control",
  "citations",
]);
const TOOL_REFERENCE_KEYS = new Set(["tool_name", "type", "cache_control"]);
const DIRECT_CALLER_KEYS = new Set(["type"]);
const SERVER_TOOL_CALLER_KEYS = new Set(["tool_id", "type"]);
const CITATION_CHAR_KEYS = new Set([
  "cited_text",
  "document_index",
  "document_title",
  "end_char_index",
  "start_char_index",
  "type",
]);
const CITATION_CONTENT_BLOCK_KEYS = new Set([
  "cited_text",
  "document_index",
  "document_title",
  "end_block_index",
  "start_block_index",
  "type",
]);
const CITATION_PAGE_KEYS = new Set([
  "cited_text",
  "document_index",
  "document_title",
  "end_page_number",
  "start_page_number",
  "type",
]);
const CITATION_SEARCH_RESULT_KEYS = new Set([
  "cited_text",
  "end_block_index",
  "search_result_index",
  "source",
  "start_block_index",
  "title",
  "type",
]);
const CITATION_WEB_SEARCH_KEYS = new Set([
  "cited_text",
  "encrypted_index",
  "title",
  "type",
  "url",
]);
const CUSTOM_TOOL_KEYS = new Set([
  "input_schema",
  "name",
  "allowed_callers",
  "cache_control",
  "defer_loading",
  "description",
  "eager_input_streaming",
  "input_examples",
  "strict",
]);
const BASH_TOOL_KEYS = new Set([
  "name",
  "type",
  "allowed_callers",
  "cache_control",
  "defer_loading",
  "input_examples",
  "strict",
]);
const CODE_EXECUTION_TOOL_KEYS = new Set([
  "name",
  "type",
  "allowed_callers",
  "cache_control",
  "defer_loading",
  "strict",
]);
const COMPUTER_TOOL_KEYS = new Set([
  "display_height_px",
  "display_width_px",
  "name",
  "type",
  "allowed_callers",
  "cache_control",
  "defer_loading",
  "display_number",
  "input_examples",
  "strict",
]);
const COMPUTER_ZOOM_TOOL_KEYS = new Set([...COMPUTER_TOOL_KEYS, "enable_zoom"]);
const MEMORY_TOOL_KEYS = new Set([
  "name",
  "type",
  "allowed_callers",
  "cache_control",
  "defer_loading",
  "input_examples",
  "strict",
]);
const TEXT_EDITOR_TOOL_KEYS = new Set([
  "name",
  "type",
  "allowed_callers",
  "cache_control",
  "defer_loading",
  "input_examples",
  "strict",
]);
const TEXT_EDITOR_MAX_TOOL_KEYS = new Set([
  ...TEXT_EDITOR_TOOL_KEYS,
  "max_characters",
]);
const WEB_SEARCH_TOOL_KEYS = new Set([
  "name",
  "type",
  "allowed_callers",
  "allowed_domains",
  "blocked_domains",
  "cache_control",
  "defer_loading",
  "max_uses",
  "strict",
  "user_location",
]);
const USER_LOCATION_KEYS = new Set([
  "type",
  "city",
  "country",
  "region",
  "timezone",
]);
const WEB_FETCH_TOOL_KEYS = new Set([
  "name",
  "type",
  "allowed_callers",
  "allowed_domains",
  "blocked_domains",
  "cache_control",
  "citations",
  "defer_loading",
  "max_content_tokens",
  "max_uses",
  "strict",
]);
const WEB_FETCH_CACHE_TOOL_KEYS = new Set([
  ...WEB_FETCH_TOOL_KEYS,
  "use_cache",
]);
const ADVISOR_TOOL_KEYS = new Set([
  "model",
  "name",
  "type",
  "allowed_callers",
  "cache_control",
  "caching",
  "defer_loading",
  "max_uses",
  "strict",
]);
const TOOL_SEARCH_KEYS = new Set([
  "name",
  "type",
  "allowed_callers",
  "cache_control",
  "defer_loading",
  "strict",
]);
const MCP_TOOLSET_KEYS = new Set([
  "mcp_server_name",
  "type",
  "cache_control",
  "configs",
  "default_config",
]);
const MCP_TOOL_CONFIG_KEYS = new Set(["defer_loading", "enabled"]);
const CONTEXT_CONFIG_KEYS = new Set(["edits"]);
const CLEAR_THINKING_KEYS = new Set(["type", "keep"]);
const ALL_THINKING_KEYS = new Set(["type"]);
const TYPED_NUMBER_KEYS = new Set(["type", "value"]);
const CLEAR_TOOL_USES_KEYS = new Set([
  "type",
  "clear_at_least",
  "clear_tool_inputs",
  "exclude_tools",
  "keep",
  "trigger",
]);
const COMPACT_KEYS = new Set([
  "type",
  "instructions",
  "pause_after_compaction",
  "trigger",
]);
const OUTPUT_CONFIG_KEYS = new Set(["effort", "maxOutputTokens"]);
const CACHE_CONTROL_INPUT_KEYS = new Set([
  "enabled",
  "ttl",
  "systemBreakpoint",
  "toolBreakpoint",
  "messageBreakpoint",
  "suppressIdentityBlock",
]);
const JSON_OUTPUT_FORMAT_KEYS = new Set(["schema", "type"]);
const TOOL_CHOICE_PARALLEL_KEYS = new Set([
  "type",
  "disable_parallel_tool_use",
]);
const TOOL_CHOICE_NONE_KEYS = new Set(["type"]);
const TOOL_CHOICE_NAMED_KEYS = new Set([
  "name",
  "type",
  "disable_parallel_tool_use",
]);
const INPUT_KEYS = [
  "accessToken",
  "model",
  "maxTokens",
  "messages",
  "system",
  "tools",
  "cacheControl",
  "runtime",
  "capabilities",
  // Package extension: consumed by beta composition and evidence only. The
  // canonical body carries no trace of it.
  "betaOverrides",
  // Package extension: widens the thinking-block allowlist by `cache_control`
  // alone. The canonical body carries no trace of the FLAG; what it carries is
  // the caller's own `cache_control`, verbatim.
  "preserveThinkingBlockCacheControl",
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
] as const;
const INPUT_KEY_SET = new Set(INPUT_KEYS);

interface InspectionState {
  readonly active: WeakSet<object>;
  items: number;
  size: number;
}

type ModelResolution = Readonly<{
  id: string;
  wireId: string;
  capabilities: Readonly<{
    thinking: boolean;
    adaptiveThinking: boolean;
    interleavedThinking: boolean;
    effort: boolean;
    maxEffort: boolean;
    xhighEffort: boolean;
    contextManagement: boolean;
    temperature: boolean;
    rejectsDisabledThinking: boolean;
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

function inspectString(
  value: string,
  state: InspectionState,
  validateString?: (value: string) => void,
): void {
  state.size += value.length;
  if (state.size > MAX_SIZE) fail("INPUT_TOO_LARGE");
  validateString?.(value);

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

function inspect(
  value: unknown,
  depth: number,
  state: InspectionState,
  validateString?: (value: string) => void,
): void {
  if (depth > MAX_DEPTH) fail("INPUT_TOO_DEEP");
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    inspectString(value, state, validateString);
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
      inspect(value[index], depth + 1, state, validateString);
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
      inspectString(key, state, validateString);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) {
        fail("INVALID_INPUT");
      }
      inspect(descriptor.value, depth + 1, state, validateString);
    }
  }
  state.active.delete(value);
}

export function inspectJsonInputs(
  values: readonly unknown[],
  validateString?: (value: string) => void,
): void {
  const state: InspectionState = {
    active: new WeakSet(),
    items: 0,
    size: 0,
  };
  for (const value of values) inspect(value, 0, state, validateString);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) fail("INVALID_INPUT");
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

export function validatedJsonObject(
  value: unknown,
): Readonly<Record<string, JsonValue>> {
  const record = requireRecord(value);
  const entries: [string, JsonValue][] = [];
  for (const key of Object.keys(record)) {
    entries.push([key, validatedJson(record[key])]);
  }
  return Object.fromEntries(entries);
}

export function validatedJson(value: unknown): JsonValue {
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
  if (typeof value !== "number" || !Number.isFinite(value))
    fail("INVALID_INPUT");
  return value;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail("INVALID_INPUT");
  return value;
}

function requireKeys(
  record: Record<string, unknown>,
  required: readonly string[],
): void {
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
  assertExactKeys(
    record,
    allowScope ? LEGACY_TEXT_CACHE_CONTROL_KEYS : CACHE_CONTROL_KEYS,
  );
  requireKeys(record, ["type"]);
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

function cacheControlInput(value: unknown): ClaudeCodeCacheControlInput {
  const record = requireRecord(value);
  assertExactKeys(record, CACHE_CONTROL_INPUT_KEYS);
  const entries: [string, boolean | "5m" | "1h" | null][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "ttl") {
      if (item !== null && item !== "5m" && item !== "1h") {
        fail("INVALID_INPUT");
      }
      entries.push([key, item]);
    } else {
      entries.push([key, item === null ? null : requireBoolean(item)]);
    }
  }
  return Object.fromEntries(entries);
}

function breakpoint(input: ClaudeCodeCacheControlInput): CacheControlEphemeral {
  return input.ttl === undefined || input.ttl === null
    ? { type: "ephemeral" }
    : { type: "ephemeral", ttl: input.ttl };
}

function withoutCacheControl<T>(value: T): T {
  if (!isRecord(value)) fail("INVALID_INPUT");
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "cache_control"),
  ) as unknown as T;
}

function withBreakpoint<T>(value: T, marker: CacheControlEphemeral): T {
  if (!isRecord(value)) fail("INVALID_INPUT");
  return Object.fromEntries([
    ...Object.entries(value).filter(([key]) => key !== "cache_control"),
    ["cache_control", marker],
  ]) as unknown as T;
}

function applySystemCacheControl(
  value: readonly TextBlock[],
  input: ClaudeCodeCacheControlInput,
): readonly TextBlock[] {
  // The identity block sits at index 1 unless `suppressBillingBlock` removed
  // the billing block, which promotes it to index 0. Matching on the pinned
  // text keeps both layouts correct without threading the seam down here.
  const identityIndex = value.findIndex(
    (block) => block.text === IDENTITY_TEXT,
  );
  // Package extension: `suppressIdentityBlock` is the only way to emit the
  // identity block without a marker. Default (`undefined`/`false`) keeps the
  // unconditional overwrite the genuine client performs.
  const result = value.map((block, index) => {
    if (index !== identityIndex) return block;
    return input.suppressIdentityBlock === true
      ? withoutCacheControl(block)
      : withBreakpoint(block, breakpoint(input));
  });
  if (
    input.enabled === true &&
    input.systemBreakpoint === true &&
    result.length > identityIndex + 1
  ) {
    const index = result.length - 1;
    const block = result[index];
    if (block !== undefined)
      result[index] = withBreakpoint(block, breakpoint(input));
  }
  return result;
}

/**
 * Normalises tool `cache_control` when caching is enabled.
 *
 * The strip is gated on `enabled === true`, exactly like the re-add below it.
 * It used to be unconditional, which made any OTHER member of
 * `ClaudeCodeCacheControlInput` destructive: passing
 * `{ suppressIdentityBlock: true }` — the S3 seam on its own — deleted every
 * `cache_control` the caller had placed on its tools and restored nothing.
 *
 * When caching IS enabled the caller's own breakpoints are still normalised
 * away, because this package owns breakpoint placement in that mode and two
 * competing sets of breakpoints cannot both be honoured.
 */
function applyToolCacheControl(
  value: readonly ToolDefinition[],
  input: ClaudeCodeCacheControlInput,
): readonly ToolDefinition[] {
  if (input.enabled !== true) return value;
  const result = value.map((tool) => withoutCacheControl(tool));
  if (input.toolBreakpoint === true && result.length > 0) {
    const index = result.length - 1;
    const tool = result[index];
    if (tool !== undefined)
      result[index] = withBreakpoint(tool, breakpoint(input));
  }
  return result;
}

/**
 * Normalises message `cache_control` when caching is enabled.
 *
 * Gated on `enabled === true` for the same reason as `applyToolCacheControl`:
 * the strip used to run unconditionally, so a caller populating any other
 * member of `ClaudeCodeCacheControlInput` silently lost the `cache_control` it
 * had placed on its own message blocks.
 */
function applyMessageCacheControl(
  value: readonly Message[],
  input: ClaudeCodeCacheControlInput,
): readonly Message[] {
  if (input.enabled !== true) return value;
  const result = value.map((message): Message => ({
    role: message.role,
    content:
      typeof message.content === "string"
        ? message.content
        : message.content.map((block) =>
            block.type === "thinking" || block.type === "redacted_thinking"
              ? block
              : withoutCacheControl(block),
          ),
  }));
  if (input.messageBreakpoint !== true) return result;

  for (let index = result.length - 1; index >= 0; index -= 1) {
    const message = result[index];
    if (message?.role !== "user") continue;
    if (typeof message.content === "string" || message.content.length === 0) {
      return result;
    }
    const content: MessageContentBlock[] = [...message.content];
    const blockIndex = content.length - 1;
    const block = content[blockIndex];
    if (
      block !== undefined &&
      block.type !== "thinking" &&
      block.type !== "redacted_thinking"
    ) {
      content[blockIndex] = withBreakpoint(block, breakpoint(input));
      result[index] = { role: message.role, content };
    }
    return result;
  }
  return result;
}

function citationsConfig(value: unknown): CitationsConfigParam {
  const record = requireRecord(value);
  assertExactKeys(record, CITATIONS_CONFIG_KEYS);
  requireKeys(record, []);
  return Object.fromEntries(
    Object.keys(record).map((key) => [key, requireBoolean(record[key])]),
  );
}

function textCitation(value: unknown): TextCitationParam {
  const record = requireRecord(value);
  const type = record["type"];
  let allowed: ReadonlySet<string>;
  let numbers: readonly string[];
  let nullableStrings: readonly string[];
  if (type === "char_location") {
    allowed = CITATION_CHAR_KEYS;
    numbers = ["document_index", "end_char_index", "start_char_index"];
    nullableStrings = ["document_title"];
  } else if (type === "content_block_location") {
    allowed = CITATION_CONTENT_BLOCK_KEYS;
    numbers = ["document_index", "end_block_index", "start_block_index"];
    nullableStrings = ["document_title"];
  } else if (type === "page_location") {
    allowed = CITATION_PAGE_KEYS;
    numbers = ["document_index", "end_page_number", "start_page_number"];
    nullableStrings = ["document_title"];
  } else if (type === "search_result_location") {
    allowed = CITATION_SEARCH_RESULT_KEYS;
    numbers = ["end_block_index", "search_result_index", "start_block_index"];
    nullableStrings = ["title"];
  } else if (type === "web_search_result_location") {
    allowed = CITATION_WEB_SEARCH_KEYS;
    numbers = [];
    nullableStrings = ["title"];
  } else {
    return fail("INVALID_INPUT");
  }
  assertExactKeys(record, allowed);
  requireKeys(record, [...allowed]);
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
  assertExactKeys(record, TEXT_KEYS);
  requireKeys(record, ["text", "type"]);
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
  assertExactKeys(record, IMAGE_BLOCK_KEYS);
  requireKeys(record, ["source", "type"]);
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
      ? BASE64_IMAGE_SOURCE_KEYS
      : type === "file"
        ? FILE_IMAGE_SOURCE_KEYS
        : type === "url"
          ? URL_IMAGE_SOURCE_KEYS
          : fail("INVALID_INPUT");
  assertExactKeys(record, allowed);
  requireKeys(record, [...allowed]);
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
  assertExactKeys(record, DOCUMENT_BLOCK_KEYS);
  requireKeys(record, ["source", "type"]);
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
  let allowed: ReadonlySet<string>;
  if (type === "base64") allowed = BASE64_PDF_SOURCE_KEYS;
  else if (type === "text") allowed = PLAIN_TEXT_SOURCE_KEYS;
  else if (type === "content") allowed = CONTENT_BLOCK_SOURCE_KEYS;
  else if (type === "url") allowed = URL_PDF_SOURCE_KEYS;
  else if (type === "file") allowed = FILE_DOCUMENT_SOURCE_KEYS;
  else return fail("INVALID_INPUT");
  assertExactKeys(record, allowed);
  requireKeys(record, [...allowed]);
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

/**
 * Validates a `thinking` block.
 *
 * @param preserveCacheControl - Opt-in from
 * `ClaudeCodeRequestInput.preserveThinkingBlockCacheControl`. When `true`,
 * `cache_control` becomes an accepted key and is copied to the body VERBATIM:
 * no TTL is applied, no breakpoint is placed, and `applyMessageCacheControl`
 * already leaves thinking blocks untouched. The value still passes the same
 * `cacheControl` validator every other block uses, so a malformed marker fails
 * closed. Default `false` reproduces the strict allowlist byte for byte.
 */
function thinkingBlock(
  value: unknown,
  preserveCacheControl: boolean,
): ThinkingBlock {
  const record = requireRecord(value);
  assertExactKeys(
    record,
    preserveCacheControl
      ? THINKING_BLOCK_CACHE_CONTROL_KEYS
      : THINKING_BLOCK_KEYS,
  );
  requireKeys(record, ["signature", "thinking", "type"]);
  if (record["type"] !== "thinking") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") entries.push([key, "thinking"]);
    else if (key === "cache_control")
      entries.push([key, nullable(item, cacheControl)]);
    else entries.push([key, requireString(item)]);
  }
  return Object.fromEntries(entries) as unknown as ThinkingBlock;
}

/** Validates a `redacted_thinking` block. See `thinkingBlock` for the seam. */
function redactedThinkingBlock(
  value: unknown,
  preserveCacheControl: boolean,
): RedactedThinkingBlock {
  const record = requireRecord(value);
  assertExactKeys(
    record,
    preserveCacheControl
      ? REDACTED_THINKING_BLOCK_CACHE_CONTROL_KEYS
      : REDACTED_THINKING_BLOCK_KEYS,
  );
  requireKeys(record, ["data", "type"]);
  if (record["type"] !== "redacted_thinking") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") entries.push([key, "redacted_thinking"]);
    else if (key === "cache_control")
      entries.push([key, nullable(item, cacheControl)]);
    else entries.push([key, requireString(item)]);
  }
  return Object.fromEntries(entries) as unknown as RedactedThinkingBlock;
}

function searchResultBlock(value: unknown): SearchResultBlock {
  const record = requireRecord(value);
  assertExactKeys(record, SEARCH_RESULT_KEYS);
  requireKeys(record, ["content", "source", "title", "type"]);
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
  assertExactKeys(record, TOOL_REFERENCE_KEYS);
  requireKeys(record, ["tool_name", "type"]);
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
  assertExactKeys(record, TOOL_USE_KEYS);
  requireKeys(record, ["id", "input", "name", "type"]);
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
    assertExactKeys(record, DIRECT_CALLER_KEYS);
    requireKeys(record, ["type"]);
    return { type };
  }
  if (type !== "code_execution_20250825" && type !== "code_execution_20260120")
    return fail("INVALID_INPUT");
  assertExactKeys(record, SERVER_TOOL_CALLER_KEYS);
  requireKeys(record, ["tool_id", "type"]);
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
  assertExactKeys(record, TOOL_RESULT_KEYS);
  requireKeys(record, ["tool_use_id", "type"]);
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

function messageContentBlock(
  value: unknown,
  preserveThinkingCacheControl: boolean,
): MessageContentBlock {
  const record = requireRecord(value);
  if (record["type"] === "text") return textBlock(record);
  if (record["type"] === "image") return imageBlock(record);
  if (record["type"] === "document") return documentBlock(record);
  if (record["type"] === "search_result") return searchResultBlock(record);
  if (record["type"] === "thinking")
    return thinkingBlock(record, preserveThinkingCacheControl);
  if (record["type"] === "redacted_thinking")
    return redactedThinkingBlock(record, preserveThinkingCacheControl);
  return fail("INVALID_INPUT");
}

function messages(
  value: unknown,
  preserveThinkingCacheControl: boolean,
): readonly Message[] {
  if (!Array.isArray(value)) fail("INVALID_INPUT");
  const useIds = new Set<string>();
  const resultIds: string[] = [];
  const result = value.map((item): Message => {
    const record = requireRecord(item);
    assertExactKeys(record, MESSAGE_KEYS);
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
      return messageContentBlock(blockRecord, preserveThinkingCacheControl);
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

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) fail("INVALID_INPUT");
  return value.map((item) => requireString(item));
}

function allowedCallers(value: unknown): readonly string[] {
  const callers = stringArray(value);
  for (const caller of callers) {
    if (
      caller !== "direct" &&
      caller !== "code_execution_20250825" &&
      caller !== "code_execution_20260120"
    ) {
      fail("INVALID_INPUT");
    }
  }
  return callers;
}

function inputExamples(
  value: unknown,
): readonly Readonly<Record<string, JsonValue>>[] {
  if (!Array.isArray(value)) fail("INVALID_INPUT");
  return value.map((example) => validatedJsonObject(example));
}

function toolInputSchema(value: unknown): Readonly<Record<string, JsonValue>> {
  const record = requireRecord(value);
  if (hasOwn(record, "type") && record["type"] !== "object")
    fail("INVALID_INPUT");
  const entries: [string, JsonValue][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") entries.push([key, "object"]);
    else if (key === "required")
      entries.push([key, nullable(item, stringArray)]);
    else entries.push([key, validatedJson(item)]);
  }
  return Object.fromEntries(entries);
}

function userLocation(value: unknown): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  assertExactKeys(record, USER_LOCATION_KEYS);
  requireKeys(record, ["type"]);
  if (record["type"] !== "approximate") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    entries.push([
      key,
      key === "type" ? "approximate" : nullable(record[key], requireString),
    ]);
  }
  return Object.fromEntries(entries);
}

function mcpToolConfig(value: unknown): Readonly<Record<string, boolean>> {
  const record = requireRecord(value);
  assertExactKeys(record, MCP_TOOL_CONFIG_KEYS);
  requireKeys(record, []);
  return Object.fromEntries(
    Object.keys(record).map((key) => [key, requireBoolean(record[key])]),
  );
}

function mcpConfigs(
  value: unknown,
): Readonly<Record<string, Readonly<Record<string, boolean>>>> {
  const record = requireRecord(value);
  return Object.fromEntries(
    Object.keys(record).map((key) => [key, mcpToolConfig(record[key])]),
  );
}

interface BuiltInToolSpec {
  readonly name?: string;
  readonly allowed: ReadonlySet<string>;
  readonly required: readonly string[];
}

function builtInToolSpec(type: unknown): BuiltInToolSpec {
  if (type === "bash_20241022" || type === "bash_20250124") {
    return {
      name: "bash",
      allowed: BASH_TOOL_KEYS,
      required: ["name", "type"],
    };
  }
  if (
    type === "code_execution_20250522" ||
    type === "code_execution_20250825" ||
    type === "code_execution_20260120"
  ) {
    return {
      name: "code_execution",
      allowed: CODE_EXECUTION_TOOL_KEYS,
      required: ["name", "type"],
    };
  }
  if (
    type === "computer_20241022" ||
    type === "computer_20250124" ||
    type === "computer_20251124"
  ) {
    return {
      name: "computer",
      allowed:
        type === "computer_20251124"
          ? COMPUTER_ZOOM_TOOL_KEYS
          : COMPUTER_TOOL_KEYS,
      required: ["display_height_px", "display_width_px", "name", "type"],
    };
  }
  if (type === "memory_20250818") {
    return {
      name: "memory",
      allowed: MEMORY_TOOL_KEYS,
      required: ["name", "type"],
    };
  }
  if (
    type === "text_editor_20241022" ||
    type === "text_editor_20250124" ||
    type === "text_editor_20250429" ||
    type === "text_editor_20250728"
  ) {
    return {
      name:
        type === "text_editor_20241022" || type === "text_editor_20250124"
          ? "str_replace_editor"
          : "str_replace_based_edit_tool",
      allowed:
        type === "text_editor_20250728"
          ? TEXT_EDITOR_MAX_TOOL_KEYS
          : TEXT_EDITOR_TOOL_KEYS,
      required: ["name", "type"],
    };
  }
  if (type === "web_search_20250305" || type === "web_search_20260209") {
    return {
      name: "web_search",
      allowed: WEB_SEARCH_TOOL_KEYS,
      required: ["name", "type"],
    };
  }
  if (
    type === "web_fetch_20250910" ||
    type === "web_fetch_20260209" ||
    type === "web_fetch_20260309"
  ) {
    return {
      name: "web_fetch",
      allowed:
        type === "web_fetch_20260309"
          ? WEB_FETCH_CACHE_TOOL_KEYS
          : WEB_FETCH_TOOL_KEYS,
      required: ["name", "type"],
    };
  }
  if (type === "advisor_20260301") {
    return {
      name: "advisor",
      allowed: ADVISOR_TOOL_KEYS,
      required: ["model", "name", "type"],
    };
  }
  if (
    type === "tool_search_tool_bm25_20251119" ||
    type === "tool_search_tool_bm25"
  ) {
    return {
      name: "tool_search_tool_bm25",
      allowed: TOOL_SEARCH_KEYS,
      required: ["name", "type"],
    };
  }
  if (
    type === "tool_search_tool_regex_20251119" ||
    type === "tool_search_tool_regex"
  ) {
    return {
      name: "tool_search_tool_regex",
      allowed: TOOL_SEARCH_KEYS,
      required: ["name", "type"],
    };
  }
  if (type === "mcp_toolset") {
    return {
      allowed: MCP_TOOLSET_KEYS,
      required: ["mcp_server_name", "type"],
    };
  }
  return fail("INVALID_INPUT");
}

function customToolDefinition(record: Record<string, unknown>): ToolDefinition {
  assertExactKeys(record, CUSTOM_TOOL_KEYS);
  requireKeys(record, ["input_schema", "name"]);
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "input_schema") entries.push([key, toolInputSchema(item)]);
    else if (key === "name" || key === "description")
      entries.push([key, requireString(item)]);
    else if (key === "allowed_callers")
      entries.push([key, allowedCallers(item)]);
    else if (key === "cache_control")
      entries.push([key, nullable(item, (raw) => cacheControl(raw, true))]);
    else if (key === "defer_loading" || key === "strict")
      entries.push([key, requireBoolean(item)]);
    else if (key === "eager_input_streaming")
      entries.push([key, nullable(item, requireBoolean)]);
    else entries.push([key, inputExamples(item)]);
  }
  return Object.fromEntries(entries) as unknown as ToolDefinition;
}

function builtInToolDefinition(
  record: Record<string, unknown>,
): ToolDefinition {
  const type = record["type"];
  const spec = builtInToolSpec(type);
  assertExactKeys(record, spec.allowed);
  requireKeys(record, spec.required);
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") entries.push([key, type]);
    else if (key === "name") {
      if (item !== spec.name) fail("INVALID_INPUT");
      entries.push([key, item]);
    } else if (key === "mcp_server_name" || key === "model")
      entries.push([key, requireString(item)]);
    else if (key === "allowed_callers")
      entries.push([key, allowedCallers(item)]);
    else if (key === "cache_control" || key === "caching")
      entries.push([key, nullable(item, cacheControl)]);
    else if (
      key === "defer_loading" ||
      key === "strict" ||
      key === "enable_zoom" ||
      key === "use_cache"
    )
      entries.push([key, requireBoolean(item)]);
    else if (key === "input_examples") entries.push([key, inputExamples(item)]);
    else if (key === "display_height_px" || key === "display_width_px")
      entries.push([key, requireNumber(item)]);
    else if (
      key === "display_number" ||
      key === "max_characters" ||
      key === "max_content_tokens" ||
      key === "max_uses"
    )
      entries.push([key, nullable(item, requireNumber)]);
    else if (key === "allowed_domains" || key === "blocked_domains")
      entries.push([key, nullable(item, stringArray)]);
    else if (key === "citations")
      entries.push([key, nullable(item, citationsConfig)]);
    else if (key === "user_location")
      entries.push([key, nullable(item, userLocation)]);
    else if (key === "configs") entries.push([key, nullable(item, mcpConfigs)]);
    else if (key === "default_config") entries.push([key, mcpToolConfig(item)]);
    else fail("INVALID_INPUT");
  }
  return Object.fromEntries(entries) as unknown as ToolDefinition;
}

function tools(value: unknown): readonly ToolDefinition[] {
  if (!Array.isArray(value)) fail("INVALID_INPUT");
  const names = new Set<string>();
  return value.map((item) => {
    const record = requireRecord(item);
    const result = hasOwn(record, "type")
      ? builtInToolDefinition(record)
      : customToolDefinition(record);
    if (hasOwn(record, "name")) {
      const name = requireString(record["name"]);
      if (names.has(name)) fail("INVALID_INPUT");
      names.add(name);
    }
    return result;
  });
}

function capabilityBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") fail("INVALID_INPUT");
  return value;
}

function modelResolution(value: unknown): ModelResolution {
  const record = requireRecord(value);
  const capabilityValue = record["capabilities"];
  // A catalogue-shaped capability array is accepted at this boundary, but it
  // never affects derivation: on first party every predicate depends only on
  // the normalized id. See the header of `model-capabilities.ts`. The elements
  // are still validated so that malformed input fails closed.
  if (Array.isArray(capabilityValue)) {
    for (const capability of capabilityValue) {
      if (typeof capability !== "string") fail("INVALID_INPUT");
    }
  }
  const capabilities = Array.isArray(capabilityValue)
    ? deriveCapabilities(String(record["id"]))
    : requireRecord(capabilityValue);
  const derived = deriveCapabilities(String(record["id"]));
  if (
    (capabilities.thinking !== undefined &&
      typeof capabilities.thinking !== "boolean") ||
    (capabilities.adaptiveThinking !== undefined &&
      typeof capabilities.adaptiveThinking !== "boolean") ||
    (capabilities.interleavedThinking !== undefined &&
      typeof capabilities.interleavedThinking !== "boolean") ||
    (capabilities.effort !== undefined &&
      typeof capabilities.effort !== "boolean") ||
    (capabilities.maxEffort !== undefined &&
      typeof capabilities.maxEffort !== "boolean") ||
    (capabilities.xhighEffort !== undefined &&
      typeof capabilities.xhighEffort !== "boolean") ||
    (capabilities.contextManagement !== undefined &&
      typeof capabilities.contextManagement !== "boolean") ||
    (capabilities.temperature !== undefined &&
      typeof capabilities.temperature !== "boolean") ||
    (capabilities.rejectsDisabledThinking !== undefined &&
      typeof capabilities.rejectsDisabledThinking !== "boolean")
  ) {
    fail("INVALID_INPUT");
  }
  return {
    id: requireString(record["id"]),
    wireId: requireString(record["wireId"]),
    capabilities: {
      thinking: capabilityBoolean(capabilities.thinking, derived.thinking),
      adaptiveThinking: capabilityBoolean(
        capabilities.adaptiveThinking,
        derived.adaptiveThinking,
      ),
      interleavedThinking: capabilityBoolean(
        capabilities.interleavedThinking,
        derived.interleavedThinking,
      ),
      effort: capabilityBoolean(capabilities.effort, derived.effort),
      maxEffort: capabilityBoolean(capabilities.maxEffort, derived.maxEffort),
      xhighEffort: capabilityBoolean(
        capabilities.xhighEffort,
        derived.xhighEffort,
      ),
      contextManagement: capabilityBoolean(
        capabilities.contextManagement,
        derived.contextManagement,
      ),
      temperature: capabilityBoolean(
        capabilities.temperature,
        derived.temperature,
      ),
      rejectsDisabledThinking: capabilityBoolean(
        capabilities.rejectsDisabledThinking,
        derived.rejectsDisabledThinking,
      ),
    },
  };
}

function metadata(value: unknown): Readonly<Record<string, JsonValue>> {
  const record = requireRecord(value);
  if (
    hasOwn(record, "user_id") &&
    record["user_id"] !== null &&
    typeof record["user_id"] !== "string"
  ) {
    fail("INVALID_INPUT");
  }
  // validatedJsonObject returns a record by construction.
  return validatedJsonObject(record);
}

function typedNumberObject(
  value: unknown,
  allowedTypes: readonly string[],
): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  assertExactKeys(record, TYPED_NUMBER_KEYS);
  requireKeys(record, ["type", "value"]);
  const type = record["type"];
  if (typeof type !== "string" || !allowedTypes.includes(type))
    fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    entries.push([key, key === "type" ? type : requireNumber(record[key])]);
  }
  return Object.fromEntries(entries);
}

function clearThinkingKeep(value: unknown): unknown {
  if (value === "all") return value;
  const record = requireRecord(value);
  if (record["type"] === "all") {
    assertExactKeys(record, ALL_THINKING_KEYS);
    requireKeys(record, ["type"]);
    return { type: "all" };
  }
  return typedNumberObject(record, ["thinking_turns"]);
}

function contextManagementEdit(
  value: unknown,
): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  const type = record["type"];
  let allowed: ReadonlySet<string>;
  if (type === "clear_thinking_20251015") {
    allowed = CLEAR_THINKING_KEYS;
  } else if (type === "clear_tool_uses_20250919") {
    allowed = CLEAR_TOOL_USES_KEYS;
  } else if (type === "compact_20260112") {
    allowed = COMPACT_KEYS;
  } else {
    return fail("INVALID_INPUT");
  }
  assertExactKeys(record, allowed);
  requireKeys(record, ["type"]);
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "type") entries.push([key, type]);
    else if (type === "clear_thinking_20251015") {
      entries.push([key, clearThinkingKeep(item)]);
    } else if (type === "clear_tool_uses_20250919") {
      if (key === "clear_at_least")
        entries.push([
          key,
          nullable(item, (raw) => typedNumberObject(raw, ["input_tokens"])),
        ]);
      else if (key === "clear_tool_inputs")
        entries.push([
          key,
          nullable(item, (raw) =>
            typeof raw === "boolean" ? raw : stringArray(raw),
          ),
        ]);
      else if (key === "exclude_tools")
        entries.push([key, nullable(item, stringArray)]);
      else if (key === "keep")
        entries.push([key, typedNumberObject(item, ["tool_uses"])]);
      else
        entries.push([
          key,
          typedNumberObject(item, ["input_tokens", "tool_uses"]),
        ]);
    } else if (key === "instructions")
      entries.push([key, nullable(item, requireString)]);
    else if (key === "pause_after_compaction")
      entries.push([key, requireBoolean(item)]);
    else
      entries.push([
        key,
        nullable(item, (raw) => typedNumberObject(raw, ["input_tokens"])),
      ]);
  }
  return Object.fromEntries(entries);
}

function contextManagement(value: unknown): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  assertExactKeys(record, CONTEXT_CONFIG_KEYS);
  requireKeys(record, []);
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (!Array.isArray(item)) fail("INVALID_INPUT");
    entries.push([key, item.map((edit) => contextManagementEdit(edit))]);
  }
  return Object.fromEntries(entries);
}

function outputFormat(value: unknown): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  assertExactKeys(record, JSON_OUTPUT_FORMAT_KEYS);
  requireKeys(record, ["schema", "type"]);
  if (record["type"] !== "json_schema") fail("INVALID_INPUT");
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    entries.push([
      key,
      key === "type" ? "json_schema" : validatedJsonObject(record[key]),
    ]);
  }
  return Object.fromEntries(entries);
}

function toolChoice(value: unknown): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  const type = record["type"];
  const allowed =
    type === "none"
      ? TOOL_CHOICE_NONE_KEYS
      : type === "auto" || type === "any"
        ? TOOL_CHOICE_PARALLEL_KEYS
        : type === "tool"
          ? TOOL_CHOICE_NAMED_KEYS
          : fail("INVALID_INPUT");
  assertExactKeys(record, allowed);
  requireKeys(record, type === "tool" ? ["name", "type"] : ["type"]);
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    if (key === "type") entries.push([key, type]);
    else if (key === "name") entries.push([key, requireString(record[key])]);
    else entries.push([key, requireBoolean(record[key])]);
  }
  return Object.fromEntries(entries);
}

function betaEnabled(profile: ClaudeCodeProtocolProfile | undefined): boolean {
  return profile?.betaPolicy.experimentalBetasEnabled === true;
}

function outputConfig(
  value: unknown,
  profile: ClaudeCodeProtocolProfile | undefined,
  adapterEffort: unknown,
  adapterEffortActive: boolean,
): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  assertExactKeys(record, OUTPUT_CONFIG_KEYS);
  requireKeys(record, []);
  if (
    hasOwn(record, "effort") &&
    adapterEffort !== undefined &&
    record["effort"] !== adapterEffort
  ) {
    fail("INVALID_INPUT");
  }
  const entries: [string, unknown][] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (key === "effort") {
      if (
        item !== null &&
        item !== "low" &&
        item !== "medium" &&
        item !== "high" &&
        item !== "xhigh" &&
        item !== "max"
      ) {
        fail("INVALID_INPUT");
      }
      entries.push([key, item]);
    } else {
      if (!betaEnabled(profile)) fail("UNSUPPORTED_CAPABILITY");
      entries.push([
        "max_output_tokens",
        item === null ? null : requirePositiveInteger(item),
      ]);
    }
  }
  if (adapterEffortActive && !hasOwn(record, "effort")) {
    entries.push(["effort", adapterEffort]);
  }
  return Object.fromEntries(entries);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value))
      deepFreeze(Reflect.get(value, key));
    Object.freeze(value);
  }
  return value;
}

function contextHintEnabled(profile: unknown): boolean {
  return isRecord(profile) && profile["contextHintEnabled"] === true;
}

/**
 * Canonicalises the message and tool lists for the count-tokens endpoint.
 *
 * The count-tokens body shares no other field with the messages body, but it
 * MUST share these two canonicalisers. Reimplementing them would give the two
 * public entry points different fail-closed guarantees for the same caller
 * input, which is precisely the class of divergence this package exists to
 * prevent.
 */
export function canonicalCountTokensLists(
  rawMessages: unknown,
  rawTools: unknown,
): {
  readonly messages: readonly Message[];
  readonly tools: readonly ToolDefinition[];
} {
  return {
    // The count-tokens endpoint has no seam of its own, so thinking blocks stay
    // on the strict allowlist here.
    messages: messages(rawMessages, false),
    tools: rawTools === undefined ? Object.freeze([]) : tools(rawTools),
  };
}

export function buildCanonicalBody(
  rawInput: unknown,
  rawResolvedModel: unknown,
  rawSystemBlocks: unknown,
  rawMetadata: unknown,
  profile?: ClaudeCodeProtocolProfile,
): Readonly<Record<string, unknown>> {
  inspectJsonInputs([
    rawInput,
    rawResolvedModel,
    rawSystemBlocks,
    rawMetadata,
    ...(profile === undefined ? [] : [profile]),
  ]);

  const input = requireRecord(rawInput);
  assertExactKeys(input, INPUT_KEY_SET);
  requireKeys(input, ["maxTokens", "messages"]);
  const resolvedModel = modelResolution(rawResolvedModel);
  if (
    hasOwn(input, "model") &&
    (typeof input["model"] !== "string" ||
      stripModelMarkers(input["model"]) !== resolvedModel.wireId)
  ) {
    fail("INVALID_INPUT");
  }

  const cacheOverride = hasOwn(input, "cacheControl")
    ? nullable(input["cacheControl"], cacheControlInput)
    : undefined;
  // Package extension. Only a boolean states a decision; omission is `false`,
  // which keeps the strict thinking-block allowlist and the emitted body
  // byte-identical.
  const preserveThinkingCacheControl =
    hasOwn(input, "preserveThinkingBlockCacheControl") &&
    requireBoolean(input["preserveThinkingBlockCacheControl"]);
  let systemBlocks = system(rawSystemBlocks);
  let messageList = messages(input["messages"], preserveThinkingCacheControl);
  let toolList = hasOwn(input, "tools") ? tools(input["tools"]) : undefined;
  if (cacheOverride !== undefined && cacheOverride !== null) {
    systemBlocks = applySystemCacheControl(systemBlocks, cacheOverride);
    messageList = applyMessageCacheControl(messageList, cacheOverride);
    if (toolList !== undefined) {
      toolList = applyToolCacheControl(toolList, cacheOverride);
    }
  }

  // D16. The genuine client never sends a `max_tokens` above the model's own
  // default output limit; a larger caller value is silently capped, not
  // rejected. The clamped result is reused for the thinking budget below,
  // because upstream feeds the same `Fi` into both.
  const maxTokens = clampMaxTokens(
    requirePositiveInteger(input["maxTokens"]),
    resolvedModel.id,
  );
  const result: Record<string, unknown> = {
    model: resolvedModel.wireId,
    max_tokens: maxTokens,
    system: systemBlocks,
    messages: messageList,
  };

  if (toolList !== undefined) result["tools"] = toolList;

  let thinkingRequest: ThinkingRequest | undefined;
  if (hasOwn(input, "thinking")) {
    const rawThinking = input["thinking"];
    if (!isRecord(rawThinking) || Array.isArray(rawThinking)) {
      fail("INVALID_THINKING");
    }
    for (const key of Reflect.ownKeys(rawThinking)) {
      if (key !== "type" && key !== "budgetTokens" && key !== "display") {
        fail("INVALID_THINKING");
      }
    }
    const type = rawThinking["type"];
    if (type !== "enabled" && type !== "adaptive" && type !== "disabled") {
      fail("INVALID_THINKING");
    }
    let budgetTokens: number | undefined;
    if (hasOwn(rawThinking, "budgetTokens")) {
      const raw = rawThinking["budgetTokens"];
      if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw <= 0) {
        fail("INVALID_THINKING");
      }
      budgetTokens = raw;
    }
    let display: ThinkingDisplay | undefined;
    if (hasOwn(rawThinking, "display")) {
      const raw = rawThinking["display"];
      if (raw !== "summarized" && raw !== "omitted") fail("INVALID_THINKING");
      // Upstream's schema attaches `display` to the enabled and adaptive
      // variants only; the disabled variant declares no such property.
      if (type === "disabled") fail("INVALID_THINKING");
      display = raw;
    }
    thinkingRequest = {
      type,
      ...(budgetTokens === undefined ? {} : { budgetTokens }),
      ...(display === undefined ? {} : { display }),
    };
  }

  const resolved = resolveThinking(
    thinkingRequest,
    resolvedModel.id,
    resolvedModel.capabilities,
    (profile ?? CLAUDE_CODE_2_1_195_PROFILE).betaPolicy,
    maxTokens,
  );
  if (resolved.emitted !== undefined) result["thinking"] = resolved.emitted;

  if (!resolved.requestActive && resolvedModel.capabilities.temperature) {
    result["temperature"] = hasOwn(input, "temperature")
      ? requireNumber(input["temperature"])
      : 1;
  }

  let adapterEffort: unknown;
  let adapterEffortActive = false;
  if (hasOwn(input, "effort")) {
    const effort = input["effort"];
    if (
      !resolvedModel.capabilities.effort ||
      (effort !== "low" &&
        effort !== "medium" &&
        effort !== "high" &&
        effort !== "xhigh" &&
        effort !== "max")
    ) {
      fail("INVALID_EFFORT");
    }
    if (
      (effort === "max" && !resolvedModel.capabilities.maxEffort) ||
      (effort === "xhigh" && !resolvedModel.capabilities.xhighEffort)
    ) {
      fail("INVALID_EFFORT");
    }
    adapterEffort = effort;
    if (
      isRecord(result["thinking"]) &&
      result["thinking"]["type"] === "adaptive"
    ) {
      adapterEffortActive = true;
      if (!hasOwn(input, "outputConfig")) {
        result["output_config"] = { effort };
      }
    }
  }

  for (const key of Object.keys(input)) {
    const item = input[key];
    if (key === "contextManagement")
      result["context_management"] = nullable(item, contextManagement);
    else if (key === "outputConfig")
      result["output_config"] = outputConfig(
        item,
        profile,
        adapterEffort,
        adapterEffortActive,
      );
    else if (key === "speed") {
      if (item !== null && item !== "standard" && item !== "fast")
        fail("INVALID_INPUT");
      if (item === "fast" && !betaEnabled(profile))
        fail("UNSUPPORTED_CAPABILITY");
      result["speed"] = item;
    } else if (key === "serviceTier") {
      if (item !== "auto" && item !== "standard_only") fail("INVALID_INPUT");
      result["service_tier"] = item;
    } else if (key === "outputFormat")
      result["output_format"] = nullable(item, outputFormat);
    else if (key === "toolChoice") {
      const validatedToolChoice = toolChoice(item);
      result["tool_choice"] =
        validatedToolChoice["type"] === "tool" &&
        resolved.extendedThinkingActive
          ? { type: "auto" }
          : validatedToolChoice;
    } else if (key === "topP") result["top_p"] = requireNumber(item);
    else if (key === "topK") result["top_k"] = requireNumber(item);
    else if (key === "stopSequences")
      result["stop_sequences"] = stringArray(item);
    else if (key === "stream") result["stream"] = requireBoolean(item);
  }

  if (contextHintEnabled(profile)) {
    result["context_hint"] = { enabled: true };
  }
  result["metadata"] = metadata(rawMetadata);
  if (hasOwn(input, "experimentalBodyFields")) {
    const experimentalBodyFields = validatedJsonObject(
      input["experimentalBodyFields"],
    );
    for (const key of Object.keys(experimentalBodyFields)) {
      if (hasOwn(result, key)) fail("INVALID_INPUT");
      result[key] = experimentalBodyFields[key];
    }
  }
  return deepFreeze(result);
}
