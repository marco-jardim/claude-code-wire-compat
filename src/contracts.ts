// SPDX-License-Identifier: GPL-3.0-or-later

export type HeaderPair = readonly [name: string, value: string];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface CacheControlEphemeral {
  readonly type: "ephemeral";
  readonly ttl?: "5m" | "1h";
}

/** Pre-RC3 package compatibility extension; SDK-derived block types do not use it. */
export interface TextBlockCacheControl extends CacheControlEphemeral {
  readonly scope?: "global";
}

export interface CitationsConfigParam {
  readonly enabled?: boolean;
}

export interface CitationCharLocationParam {
  readonly cited_text: string;
  readonly document_index: number;
  readonly document_title: string | null;
  readonly end_char_index: number;
  readonly start_char_index: number;
  readonly type: "char_location";
}

export interface CitationContentBlockLocationParam {
  readonly cited_text: string;
  readonly document_index: number;
  readonly document_title: string | null;
  readonly end_block_index: number;
  readonly start_block_index: number;
  readonly type: "content_block_location";
}

export interface CitationPageLocationParam {
  readonly cited_text: string;
  readonly document_index: number;
  readonly document_title: string | null;
  readonly end_page_number: number;
  readonly start_page_number: number;
  readonly type: "page_location";
}

export interface CitationSearchResultLocationParam {
  readonly cited_text: string;
  readonly end_block_index: number;
  readonly search_result_index: number;
  readonly source: string;
  readonly start_block_index: number;
  readonly title: string | null;
  readonly type: "search_result_location";
}

export interface CitationWebSearchResultLocationParam {
  readonly cited_text: string;
  readonly encrypted_index: string;
  readonly title: string | null;
  readonly type: "web_search_result_location";
  readonly url: string;
}

export type TextCitationParam =
  | CitationCharLocationParam
  | CitationPageLocationParam
  | CitationContentBlockLocationParam
  | CitationWebSearchResultLocationParam
  | CitationSearchResultLocationParam;

export interface TextBlock {
  readonly text: string;
  readonly type: "text";
  readonly cache_control?: TextBlockCacheControl | null;
  readonly citations?: readonly TextCitationParam[] | null;
}

export interface Base64ImageSource {
  readonly data: string;
  readonly media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  readonly type: "base64";
}

export interface FileImageSource {
  readonly file_id: string;
  readonly type: "file";
}

export interface URLImageSource {
  readonly type: "url";
  readonly url: string;
}

export interface ImageBlock {
  readonly source: Base64ImageSource | URLImageSource | FileImageSource;
  readonly type: "image";
  readonly cache_control?: CacheControlEphemeral | null;
}

export interface Base64PDFSource {
  readonly data: string;
  readonly media_type: "application/pdf";
  readonly type: "base64";
}

export interface ContentBlockSource {
  readonly content: string | readonly (TextBlock | ImageBlock)[];
  readonly type: "content";
}

export interface FileDocumentSource {
  readonly file_id: string;
  readonly type: "file";
}

export interface PlainTextSource {
  readonly data: string;
  readonly media_type: "text/plain";
  readonly type: "text";
}

export interface URLPDFSource {
  readonly type: "url";
  readonly url: string;
}

export interface DocumentBlock {
  readonly source:
    | Base64PDFSource
    | PlainTextSource
    | ContentBlockSource
    | URLPDFSource
    | FileDocumentSource;
  readonly type: "document";
  readonly cache_control?: CacheControlEphemeral | null;
  readonly citations?: CitationsConfigParam | null;
  readonly context?: string | null;
  readonly title?: string | null;
}

export interface ThinkingBlock {
  readonly signature: string;
  readonly thinking: string;
  readonly type: "thinking";
}

export interface RedactedThinkingBlock {
  readonly data: string;
  readonly type: "redacted_thinking";
}

export interface SearchResultBlock {
  readonly content: readonly TextBlock[];
  readonly source: string;
  readonly title: string;
  readonly type: "search_result";
  readonly cache_control?: CacheControlEphemeral | null;
  readonly citations?: CitationsConfigParam;
}

export interface ToolReferenceBlock {
  readonly tool_name: string;
  readonly type: "tool_reference";
  readonly cache_control?: CacheControlEphemeral | null;
}

export interface DirectCaller {
  readonly type: "direct";
}

export interface ServerToolCaller {
  readonly tool_id: string;
  readonly type: "code_execution_20250825";
}

export interface ServerToolCaller20260120 {
  readonly tool_id: string;
  readonly type: "code_execution_20260120";
}

export interface ToolUseBlock {
  readonly id: string;
  readonly input: JsonValue;
  readonly name: string;
  readonly type: "tool_use";
  readonly cache_control?: CacheControlEphemeral | null;
  readonly caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export type ToolResultContentBlock =
  | TextBlock
  | ImageBlock
  | SearchResultBlock
  | DocumentBlock
  | ToolReferenceBlock;

export interface ToolResultBlock {
  readonly tool_use_id: string;
  readonly type: "tool_result";
  readonly cache_control?: CacheControlEphemeral | null;
  readonly content?: string | readonly ToolResultContentBlock[];
  readonly is_error?: boolean;
}

export type MessageContentBlock =
  | TextBlock
  | ImageBlock
  | DocumentBlock
  | SearchResultBlock
  | ThinkingBlock
  | RedactedThinkingBlock
  | ToolUseBlock
  | ToolResultBlock;

export type MessageContent = string | readonly MessageContentBlock[];
export interface Message {
  readonly role: "user" | "assistant";
  readonly content: MessageContent;
}
export type SystemInput = string | TextBlock;

export interface ToolInputSchema {
  readonly type: "object";
  readonly properties?: JsonValue | null;
  readonly required?: readonly string[] | null;
  readonly [key: string]: JsonValue | undefined;
}

export type ToolAllowedCaller =
  "direct" | "code_execution_20250825" | "code_execution_20260120";

export type ToolInputExample = Readonly<Record<string, JsonValue>>;

export interface CustomToolDefinition {
  readonly input_schema: ToolInputSchema;
  readonly name: string;
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly description?: string;
  readonly eager_input_streaming?: boolean | null;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
  readonly type?: never;
}

export interface ToolBash20241022 {
  readonly name: "bash";
  readonly type: "bash_20241022";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
}
export interface ToolBash20250124 {
  readonly name: "bash";
  readonly type: "bash_20250124";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
}

export interface CodeExecutionTool20250522 {
  readonly name: "code_execution";
  readonly type: "code_execution_20250522";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly strict?: boolean;
}
export interface CodeExecutionTool20250825 {
  readonly name: "code_execution";
  readonly type: "code_execution_20250825";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly strict?: boolean;
}
export interface CodeExecutionTool20260120 {
  readonly name: "code_execution";
  readonly type: "code_execution_20260120";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly strict?: boolean;
}

export interface ToolComputerUse20241022 {
  readonly display_height_px: number;
  readonly display_width_px: number;
  readonly name: "computer";
  readonly type: "computer_20241022";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly display_number?: number | null;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
}
export interface ToolComputerUse20250124 {
  readonly display_height_px: number;
  readonly display_width_px: number;
  readonly name: "computer";
  readonly type: "computer_20250124";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly display_number?: number | null;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
}
export interface ToolComputerUse20251124 {
  readonly display_height_px: number;
  readonly display_width_px: number;
  readonly name: "computer";
  readonly type: "computer_20251124";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly display_number?: number | null;
  readonly enable_zoom?: boolean;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
}

export interface MemoryTool20250818 {
  readonly name: "memory";
  readonly type: "memory_20250818";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
}

export interface ToolTextEditor20241022 {
  readonly name: "str_replace_editor";
  readonly type: "text_editor_20241022";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
}
export interface ToolTextEditor20250124 {
  readonly name: "str_replace_editor";
  readonly type: "text_editor_20250124";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
}
export interface ToolTextEditor20250429 {
  readonly name: "str_replace_based_edit_tool";
  readonly type: "text_editor_20250429";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly input_examples?: readonly ToolInputExample[];
  readonly strict?: boolean;
}
export interface ToolTextEditor20250728 {
  readonly name: "str_replace_based_edit_tool";
  readonly type: "text_editor_20250728";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly input_examples?: readonly ToolInputExample[];
  readonly max_characters?: number | null;
  readonly strict?: boolean;
}

export interface UserLocation {
  readonly type: "approximate";
  readonly city?: string | null;
  readonly country?: string | null;
  readonly region?: string | null;
  readonly timezone?: string | null;
}
export interface WebSearchTool20250305 {
  readonly name: "web_search";
  readonly type: "web_search_20250305";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly allowed_domains?: readonly string[] | null;
  readonly blocked_domains?: readonly string[] | null;
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly max_uses?: number | null;
  readonly strict?: boolean;
  readonly user_location?: UserLocation | null;
}
export interface WebSearchTool20260209 {
  readonly name: "web_search";
  readonly type: "web_search_20260209";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly allowed_domains?: readonly string[] | null;
  readonly blocked_domains?: readonly string[] | null;
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly max_uses?: number | null;
  readonly strict?: boolean;
  readonly user_location?: UserLocation | null;
}

export interface WebFetchTool20250910 {
  readonly name: "web_fetch";
  readonly type: "web_fetch_20250910";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly allowed_domains?: readonly string[] | null;
  readonly blocked_domains?: readonly string[] | null;
  readonly cache_control?: CacheControlEphemeral | null;
  readonly citations?: CitationsConfigParam | null;
  readonly defer_loading?: boolean;
  readonly max_content_tokens?: number | null;
  readonly max_uses?: number | null;
  readonly strict?: boolean;
}
export interface WebFetchTool20260209 {
  readonly name: "web_fetch";
  readonly type: "web_fetch_20260209";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly allowed_domains?: readonly string[] | null;
  readonly blocked_domains?: readonly string[] | null;
  readonly cache_control?: CacheControlEphemeral | null;
  readonly citations?: CitationsConfigParam | null;
  readonly defer_loading?: boolean;
  readonly max_content_tokens?: number | null;
  readonly max_uses?: number | null;
  readonly strict?: boolean;
}
export interface WebFetchTool20260309 {
  readonly name: "web_fetch";
  readonly type: "web_fetch_20260309";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly allowed_domains?: readonly string[] | null;
  readonly blocked_domains?: readonly string[] | null;
  readonly cache_control?: CacheControlEphemeral | null;
  readonly citations?: CitationsConfigParam | null;
  readonly defer_loading?: boolean;
  readonly max_content_tokens?: number | null;
  readonly max_uses?: number | null;
  readonly strict?: boolean;
  readonly use_cache?: boolean;
}

export interface AdvisorTool20260301 {
  readonly model: string;
  readonly name: "advisor";
  readonly type: "advisor_20260301";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly caching?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly max_uses?: number | null;
  readonly strict?: boolean;
}

export interface ToolSearchToolBm25_20251119 {
  readonly name: "tool_search_tool_bm25";
  readonly type: "tool_search_tool_bm25_20251119" | "tool_search_tool_bm25";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly strict?: boolean;
}
export interface ToolSearchToolRegex20251119 {
  readonly name: "tool_search_tool_regex";
  readonly type: "tool_search_tool_regex_20251119" | "tool_search_tool_regex";
  readonly allowed_callers?: readonly ToolAllowedCaller[];
  readonly cache_control?: CacheControlEphemeral | null;
  readonly defer_loading?: boolean;
  readonly strict?: boolean;
}

export interface MCPToolConfig {
  readonly defer_loading?: boolean;
  readonly enabled?: boolean;
}
export interface MCPToolDefaultConfig {
  readonly defer_loading?: boolean;
  readonly enabled?: boolean;
}
export interface MCPToolset {
  readonly mcp_server_name: string;
  readonly type: "mcp_toolset";
  readonly cache_control?: CacheControlEphemeral | null;
  readonly configs?: Readonly<Record<string, MCPToolConfig>> | null;
  readonly default_config?: MCPToolDefaultConfig;
}

export type ToolDefinition =
  | CustomToolDefinition
  | ToolBash20241022
  | ToolBash20250124
  | CodeExecutionTool20250522
  | CodeExecutionTool20250825
  | CodeExecutionTool20260120
  | ToolComputerUse20241022
  | ToolComputerUse20250124
  | ToolComputerUse20251124
  | MemoryTool20250818
  | ToolTextEditor20241022
  | ToolTextEditor20250124
  | ToolTextEditor20250429
  | ToolTextEditor20250728
  | WebSearchTool20250305
  | WebSearchTool20260209
  | WebFetchTool20250910
  | WebFetchTool20260209
  | WebFetchTool20260309
  | AdvisorTool20260301
  | ToolSearchToolBm25_20251119
  | ToolSearchToolRegex20251119
  | MCPToolset;

export interface AllThinkingTurns {
  readonly type: "all";
}
export interface ThinkingTurns {
  readonly type: "thinking_turns";
  readonly value: number;
}
export interface ClearThinking20251015Edit {
  readonly type: "clear_thinking_20251015";
  readonly keep?: ThinkingTurns | AllThinkingTurns | "all";
}
export interface InputTokensClearAtLeast {
  readonly type: "input_tokens";
  readonly value: number;
}
export interface InputTokensTrigger {
  readonly type: "input_tokens";
  readonly value: number;
}
export interface ToolUsesKeep {
  readonly type: "tool_uses";
  readonly value: number;
}
export interface ToolUsesTrigger {
  readonly type: "tool_uses";
  readonly value: number;
}
export interface ClearToolUses20250919Edit {
  readonly type: "clear_tool_uses_20250919";
  readonly clear_at_least?: InputTokensClearAtLeast | null;
  readonly clear_tool_inputs?: boolean | readonly string[] | null;
  readonly exclude_tools?: readonly string[] | null;
  readonly keep?: ToolUsesKeep;
  readonly trigger?: InputTokensTrigger | ToolUsesTrigger;
}
export interface Compact20260112Edit {
  readonly type: "compact_20260112";
  readonly instructions?: string | null;
  readonly pause_after_compaction?: boolean;
  readonly trigger?: InputTokensTrigger | null;
}
export interface ContextManagementConfig {
  readonly edits?: readonly (
    ClearToolUses20250919Edit | ClearThinking20251015Edit | Compact20260112Edit
  )[];
}

export interface JSONOutputFormat {
  readonly schema: Readonly<Record<string, JsonValue>>;
  readonly type: "json_schema";
}

export interface OutputConfigInput {
  readonly effort?: "low" | "medium" | "high" | "xhigh" | "max" | null;
  /** Beta-only: requires `task-budgets-2026-03-13`; absent from SDK 0.94.0. */
  readonly maxOutputTokens?: number | null;
}

export interface ToolChoiceAny {
  readonly type: "any";
  readonly disable_parallel_tool_use?: boolean;
}
export interface ToolChoiceAuto {
  readonly type: "auto";
  readonly disable_parallel_tool_use?: boolean;
}
export interface ToolChoiceNone {
  readonly type: "none";
}
export interface ToolChoiceTool {
  readonly name: string;
  readonly type: "tool";
  readonly disable_parallel_tool_use?: boolean;
}
export type ToolChoice =
  ToolChoiceAuto | ToolChoiceAny | ToolChoiceTool | ToolChoiceNone;

export interface ClaudeCodeCapabilities {
  readonly contextHint: boolean;
  readonly adaptiveThinking: boolean;
  readonly effort: boolean;
  readonly interleavedThinking: boolean;
}

export interface ClaudeCodeRuntimeIdentity {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly accountUuid: string;
  readonly runtime: "node" | "bun" | "workerd";
  readonly runtimeVersion: string;
  readonly os: "Windows" | "Linux" | "macOS";
  readonly arch: string;
}

export interface ClaudeCodeRequestInput {
  readonly accessToken: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly messages: readonly Message[];
  readonly system?: readonly SystemInput[];
  readonly tools?: readonly ToolDefinition[];
  readonly runtime: ClaudeCodeRuntimeIdentity;
  readonly capabilities?: Partial<ClaudeCodeCapabilities>;
  readonly thinking?: {
    readonly type: "enabled" | "adaptive";
    readonly budgetTokens?: number;
  };
  readonly effort?: "low" | "medium" | "high" | "max";
  /** Supplies validated JSON metadata values in caller insertion order. */
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly contextManagement?: ContextManagementConfig | null;
  readonly outputConfig?: OutputConfigInput;
  readonly speed?: "standard" | "fast" | null;
  readonly serviceTier?: "auto" | "standard_only";
  readonly outputFormat?: JSONOutputFormat | null;
  readonly toolChoice?: ToolChoice;
  readonly topP?: number;
  readonly topK?: number;
  readonly stopSequences?: readonly string[];
  readonly stream?: boolean;
  readonly temperature?: number;
  /** Supplies the `x-client-request-id` header. */
  readonly clientRequestId: string;
  /** Selects the foreground or background Claude Code entrypoint header. */
  readonly app?: "cli" | "cli-bg";
  /** Supplies the Stainless retry-count header. */
  readonly stainlessRetryCount?: number;
  /** Supplies the Stainless helper header. */
  readonly stainlessHelper?: string;
  /** Supplies the Claude remote-container identifier header. */
  readonly claudeRemoteContainerId?: string;
  /** Supplies the Claude remote-session identifier header. */
  readonly claudeRemoteSessionId?: string;
  /** Supplies the client-application header. */
  readonly clientApp?: string;
  /** Supplies the Anthropic additional-protection header. */
  readonly anthropicAdditionalProtection?: string;
  /** Appends validated non-canonical headers in caller order. */
  readonly extraHeaders?: readonly HeaderPair[];
  /** Injects the Web Crypto provider used to hash the request body. */
  readonly crypto?: Pick<Crypto, "subtle">;
}

export interface ClaudeCodeProtocolProfile {
  readonly id: "claude-code-2.1.195-sdk-0.94.0";
  readonly cliVersion: "2.1.195";
  readonly sdkVersion: "0.94.0";
  readonly endpoint: "https://api.anthropic.com/v1/messages?beta=true";
  /** Replaces upstream `CLAUDE_CODE_ENTRYPOINT`. */
  readonly entrypoint: "cli";
  /** Replaces upstream `buildExtendedUserAgent` (`lib/request-headers.mjs:288-295`). */
  readonly userAgent: `claude-cli/${string} (external, ${string})`;
  /** Replaces upstream `CLAUDE_CODE_BUILD_TIME`. */
  readonly buildTime: string;
  /** Replaces upstream `CLAUDE_CODE_GIT_SHA`. */
  readonly gitSha: string;
  /** Replaces upstream `CLAUDE_CODE_ATTRIBUTION_HEADER`. */
  readonly attributionHeaderEnabled: boolean;
  /**
   * Replaces the upstream `provider` parameter of
   * `buildAnthropicBillingHeader` (`lib/mimicry/system-prompt.mjs:134-159`),
   * where `bedrock`, `anthropicAws`, and `mantle` suppress the `cch` and
   * workload parts.
   */
  readonly provider: "anthropic";
  /** Pins the upstream `anthropic-version` request header. */
  readonly anthropicVersion: "2023-06-01";
  readonly defaultCapabilities: ClaudeCodeCapabilities;
  readonly supportedModels: Readonly<
    Record<
      string,
      Readonly<{
        family: "haiku" | "sonnet" | "opus";
        aliases: readonly string[];
        capabilities: ClaudeCodeCapabilities;
      }>
    >
  >;
  readonly orderedBetas: readonly string[];
}

export type ClaudeCodeWireErrorCode =
  | "INVALID_INPUT"
  | "INVALID_IDENTITY"
  | "UNSUPPORTED_MODEL"
  | "UNSUPPORTED_CAPABILITY"
  | "INVALID_THINKING"
  | "INVALID_EFFORT"
  | "FORBIDDEN_HEADER"
  | "DUPLICATE_HEADER"
  | "HEADER_INJECTION"
  | "INVALID_UNICODE"
  | "INPUT_TOO_DEEP"
  | "INPUT_TOO_LARGE"
  | "CYCLIC_INPUT"
  | "CRYPTO_UNAVAILABLE"
  | "REDACTION_FAILURE";

export interface RedactedRequestEvidence {
  readonly profileId: ClaudeCodeProtocolProfile["id"];
  readonly url: ClaudeCodeProtocolProfile["endpoint"];
  readonly method: "POST";
  readonly modelFamily: "haiku" | "sonnet" | "opus";
  readonly logicalHeaderNames: readonly string[];
  readonly betaFeatures: readonly string[];
  readonly bodySha256: string;
  readonly bodyByteLength: number;
  readonly messageCount: number;
  readonly systemBlockCount: number;
  readonly capabilityDecisions: Readonly<
    Record<keyof ClaudeCodeCapabilities, boolean>
  >;
}

export interface BuiltClaudeCodeRequest {
  readonly url: "https://api.anthropic.com/v1/messages?beta=true";
  readonly method: "POST";
  readonly headers: readonly HeaderPair[];
  readonly body: string;
  readonly evidence: RedactedRequestEvidence;
}

export class ClaudeCodeWireError extends Error {
  override readonly name = "ClaudeCodeWireError";
  readonly code: ClaudeCodeWireErrorCode;
  readonly safeDetails: Readonly<Record<string, string | number | boolean>>;

  constructor(
    code: ClaudeCodeWireErrorCode,
    safeDetails: Readonly<Record<string, string | number | boolean>> = {},
  ) {
    super(code);
    Object.setPrototypeOf(this, new.target.prototype);

    const entries: [string, string | number | boolean][] = [];
    for (const key of Reflect.ownKeys(safeDetails)) {
      if (
        typeof key !== "string" ||
        key === "__proto__" ||
        key === "prototype" ||
        key === "constructor"
      ) {
        throw new TypeError("safeDetails contains a forbidden key.");
      }
      const value = safeDetails[key];
      if (
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
      ) {
        throw new TypeError("safeDetails values must be primitive-safe.");
      }
      entries.push([key, value]);
    }

    this.code = code;
    this.safeDetails = Object.freeze(Object.fromEntries(entries));
  }

  toJSON(): {
    readonly name: "ClaudeCodeWireError";
    readonly code: ClaudeCodeWireErrorCode;
    readonly safeDetails: Readonly<Record<string, string | number | boolean>>;
  } {
    return {
      name: this.name,
      code: this.code,
      safeDetails: this.safeDetails,
    };
  }
}
