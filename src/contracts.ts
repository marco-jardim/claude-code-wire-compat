// SPDX-License-Identifier: GPL-3.0-or-later

import type { ThinkingDisplay } from "./thinking.js";
export type { ThinkingDisplay } from "./thinking.js";

/** Model families used only in redacted evidence, never on the wire. */
export type ClaudeCodeModelFamily =
  "haiku" | "sonnet" | "opus" | "fable" | "mythos" | "unknown";

export type ClaudeCodeEffort = "low" | "medium" | "high" | "xhigh" | "max";

/** Identifies which branch of the client's anti-verbosity selector applies. */
export type AntiVerbositySection =
  "communicating-with-the-user" | "lean" | "text-output";

/**
 * Host state the package cannot observe, mirrored from the upstream gates so a
 * caller that does know it can reproduce the client exactly.
 */
export interface AntiVerbosityPolicy {
  /** Upstream `oqo.isBriefEnabled()`. */
  readonly briefModeEnabled: boolean;
  /** Upstream `Jxe()`, the pewter-owl tool flag. */
  readonly pewterOwlToolEnabled: boolean;
}

export interface ClaudeCodeCatalogueEntry {
  readonly family: ClaudeCodeModelFamily;
  readonly context?: Readonly<{
    readonly window: number;
    readonly native1m?: boolean;
    readonly supports1mBeta?: boolean;
  }>;
  /** Verbatim upstream capability keys; compared by the ported predicates. */
  readonly capabilities: readonly string[];
  readonly defaultEffort?: ClaudeCodeEffort;
}

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
  readonly effort?: ClaudeCodeEffort | null;
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
  readonly thinking: boolean;
  readonly adaptiveThinking: boolean;
  readonly interleavedThinking: boolean;
  readonly effort: boolean;
  readonly maxEffort: boolean;
  readonly xhighEffort: boolean;
  readonly contextManagement: boolean;
  readonly temperature: boolean;
  readonly rejectsDisabledThinking: boolean;
}

/** Host-state beta gates pinned for a default first-party environment. */
export interface ClaudeCodeBetaPolicy {
  readonly oauthAuthenticated: boolean;
  readonly experimentalBetasEnabled: boolean;
  readonly oneMillionContextEnabled: boolean;
  readonly interleavedThinkingEnabled: boolean;
  readonly interactive: boolean;
  readonly thinkingSummariesShown: boolean;
  readonly thinkingTokenCountEnabled: boolean;
  readonly narrationSummariesEnabled: boolean;
  readonly structuredOutputsEnabled: boolean;
  readonly afkModeEnabled: boolean;
  readonly cacheDiagnosisEnabled: boolean;
}

/**
 * Substitutes protocol-identity fields of the pinned profile.
 *
 * The destination (`endpoint`), `provider` and `anthropicVersion` are the
 * immutable security core and cannot be expressed here. Supplying any key
 * outside this contract fails with `INVALID_INPUT` rather than being ignored.
 *
 * Each supplied field REPLACES the pinned field wholesale. There is no deep
 * merge, because a merged model table or beta list would describe no real
 * client version.
 */
export interface ClaudeCodeProfileOverride {
  readonly id?: string;
  readonly cliVersion?: string;
  readonly sdkVersion?: string;
  readonly entrypoint?: string;
  readonly userAgent?: string;
  readonly buildTime?: string;
  readonly gitSha?: string;
  readonly attributionHeaderEnabled?: boolean;
  readonly contextHintEnabled?: boolean;
  readonly betaPolicy?: ClaudeCodeBetaPolicy;
  readonly supportedModels?: ClaudeCodeProtocolProfile["supportedModels"];
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

/** Directs where the package places cache breakpoints. */
export interface ClaudeCodeCacheControlInput {
  readonly enabled?: boolean | null;
  readonly ttl?: "5m" | "1h" | null;
  readonly systemBreakpoint?: boolean | null;
  readonly toolBreakpoint?: boolean | null;
  readonly messageBreakpoint?: boolean | null;
  /**
   * Emits the canonical identity system block (index 1) WITHOUT a
   * `cache_control` marker.
   *
   * PACKAGE EXTENSION, not observed Claude Code behaviour: the genuine client
   * always marks that block. Defaults to `false`, which reproduces the
   * unconditional marker byte-for-byte.
   */
  readonly suppressIdentityBlock?: boolean | null;
}

/**
 * Per-request substitutes for beta gates the genuine client reads from host
 * state.
 *
 * PACKAGE EXTENSION, not observed Claude Code behaviour. Every member is a
 * tri-state: `true` forces the beta, `false` suppresses it, and omission keeps
 * the upstream-derived decision. Recorded in
 * `RedactedRequestEvidence.capabilityDecisions` only when supplied.
 */
export interface ClaudeCodeBetaOverrides {
  /**
   * Replaces the `[1m]` model-marker gate for `context-1m-2025-08-07`. The
   * profile gate `betaPolicy.oneMillionContextEnabled` still applies, so an
   * override cannot enable a beta the pinned profile declares unavailable.
   */
  readonly use1MContext?: boolean;
}

/**
 * Per-request substitutes for the `metadata.user_id` value the genuine client
 * derives from host state.
 *
 * PACKAGE EXTENSION, not observed Claude Code behaviour. The genuine client
 * always emits `user_id` as the JSON encoding of the runtime correlation
 * triple; this seam exists so a consumer can carry a host identifier the
 * runtime-neutral core cannot observe, without forking metadata composition.
 *
 * The two members are MUTUALLY EXCLUSIVE, because they express different
 * intents: `userId` abandons the derived value entirely, while `userIdFields`
 * keeps it and adds to it. Supplying both fails with `INVALID_INPUT` rather
 * than silently resolving the ambiguity.
 *
 * Omitting the field, or omitting both members, leaves the emitted request
 * byte-identical.
 */
export interface ClaudeCodeMetadataOverrides {
  /**
   * Replaces the derived `metadata.user_id` verbatim.
   *
   * The correlation guarantee is the caller's from here on: the package no
   * longer proves that `user_id` carries the session, device and account the
   * headers and the identity system block declare. A built request whose
   * `user_id` is not JSON carrying the session identifier is REJECTED by
   * `parseBuiltClaudeCodeRequest`, which keeps that correlation invariant.
   *
   * Must be a non-blank string of at most 8192 characters with no control
   * characters and no lone surrogates.
   */
  readonly userId?: string;
  /**
   * Adds members to the derived `metadata.user_id` JSON object.
   *
   * Caller members are written FIRST and the correlation triple
   * (`device_id`, `account_uuid`, `session_id`) LAST, so correlation always
   * wins. Supplying any of those three keys fails with `INVALID_INPUT` rather
   * than being silently overwritten.
   */
  readonly userIdFields?: Readonly<Record<string, JsonValue>>;
}

/**
 * Decides what happens when `extraHeaders` collides with a header this package
 * owns — a canonical name, or a name on the forbidden denylist.
 *
 * PACKAGE EXTENSION, not observed Claude Code behaviour. The genuine client
 * composes its own headers and never merges a foreign header map.
 *
 * - `strict` (the default) throws `DUPLICATE_HEADER` for a canonical name and
 *   `FORBIDDEN_HEADER` for a denylisted one. This is the behaviour that existed
 *   before the field, byte for byte.
 * - `dropConflicting` discards the offending pair instead of throwing and
 *   records its lowercased name in `evidence.droppedExtraHeaderNames`, so a
 *   consumer can forward a heterogeneous host header map without a single
 *   inbound `anthropic-beta` destroying the request, and still audit the loss.
 *
 * NEITHER policy relaxes header syntax: a control character in a name or a
 * value raises `HEADER_INJECTION` in both. Header smuggling is never silently
 * tolerated. A caller that duplicates one of its OWN extra headers also keeps
 * getting `DUPLICATE_HEADER` in both, because that collision is a caller bug
 * rather than a conflict with a header this package owns.
 */
export type ClaudeCodeExtraHeaderPolicy = "strict" | "dropConflicting";

export interface ClaudeCodeRequestInput {
  readonly accessToken: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly messages: readonly Message[];
  readonly system?: readonly SystemInput[];
  readonly tools?: readonly ToolDefinition[];
  readonly cacheControl?: ClaudeCodeCacheControlInput | null;
  readonly runtime: ClaudeCodeRuntimeIdentity;
  readonly capabilities?: Partial<ClaudeCodeCapabilities>;
  /** Substitutes protocol-identity fields of the pinned profile. */
  readonly profileOverride?: ClaudeCodeProfileOverride;
  readonly thinking?: {
    readonly type: "enabled" | "adaptive" | "disabled";
    readonly budgetTokens?: number;
    readonly display?: ThinkingDisplay;
  };
  readonly effort?: ClaudeCodeEffort;
  /** Supplies validated JSON metadata values in caller insertion order. */
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  /** Appends validated, collision-safe beta fields to the request body. */
  readonly experimentalBodyFields?: Readonly<Record<string, JsonValue>>;
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
  /**
   * Appends caller-supplied beta identifiers to the `anthropic-beta` header.
   *
   * PACKAGE EXTENSION, not observed Claude Code behaviour. The genuine client
   * derives its beta set entirely from the profile and the model; this seam
   * exists so a consumer can carry user-configured betas without forking the
   * composer. Entries are appended AFTER the derived canonical set, in caller
   * order, and an entry equal to an already-emitted identifier is dropped.
   *
   * Each entry must match `/^[A-Za-z0-9][A-Za-z0-9._-]*$/` and be at most 128
   * characters; at most 32 entries are accepted. Anything else fails with
   * `INVALID_INPUT`, because the header is a single comma-joined field.
   *
   * Omitting the field leaves the emitted request byte-identical.
   */
  readonly additionalBetas?: readonly string[];
  /**
   * Overrides beta-header gates that the genuine client resolves from host
   * state this package cannot observe.
   *
   * PACKAGE EXTENSION, not observed Claude Code behaviour. Omitting the field,
   * or omitting any member, leaves the emitted request byte-identical.
   */
  readonly betaOverrides?: ClaudeCodeBetaOverrides;
  /**
   * Overrides the `metadata.user_id` value the genuine client derives from
   * host state this package cannot observe.
   *
   * PACKAGE EXTENSION, not observed Claude Code behaviour. Opt-in: with the
   * field omitted, a supplied `metadata.user_id` that diverges from the
   * derived value keeps failing with `INVALID_INPUT`. Omitting the field, or
   * omitting both members, leaves the emitted request byte-identical.
   */
  readonly metadataOverrides?: ClaudeCodeMetadataOverrides;
  /** Appends validated non-canonical headers in caller order. */
  readonly extraHeaders?: readonly HeaderPair[];
  /**
   * Decides how a collision between `extraHeaders` and a header this package
   * owns is resolved. Defaults to `strict`, the pre-existing behaviour.
   *
   * PACKAGE EXTENSION, not observed Claude Code behaviour. Omitting the field,
   * or passing `"strict"`, leaves the emitted request byte-identical, evidence
   * included: `droppedExtraHeaderNames` is emitted only under
   * `"dropConflicting"`.
   */
  readonly extraHeaderPolicy?: ClaudeCodeExtraHeaderPolicy;
  /** Injects the Web Crypto provider used to hash the request body. */
  readonly crypto?: Pick<Crypto, "subtle">;
}

/**
 * Narrower than `ClaudeCodeRequestInput` by design. Upstream `P5e` derives the
 * beta set from the model alone, so there is deliberately no `capabilities`
 * field, and the count-tokens body carries no `system`, `metadata`, or
 * `maxTokens`.
 */
export type ClaudeCodeCountTokensInput = Pick<
  ClaudeCodeRequestInput,
  | "accessToken"
  | "model"
  | "messages"
  | "tools"
  | "runtime"
  | "clientRequestId"
  | "profileOverride"
  | "crypto"
  | "app"
  | "stainlessRetryCount"
  | "stainlessHelper"
  | "claudeRemoteContainerId"
  | "claudeRemoteSessionId"
  | "clientApp"
  | "anthropicAdditionalProtection"
  | "extraHeaders"
>;

export interface BuiltClaudeCodeCountTokensRequest extends Omit<
  BuiltClaudeCodeRequest,
  "url"
> {
  readonly url: "https://api.anthropic.com/v1/messages/count_tokens?beta=true";
}

export interface ClaudeCodeProtocolProfile {
  readonly countTokensEndpoint: "https://api.anthropic.com/v1/messages/count_tokens?beta=true";
  readonly id: string;
  readonly cliVersion: string;
  readonly sdkVersion: string;
  readonly endpoint: "https://api.anthropic.com/v1/messages?beta=true";
  /** Replaces upstream `CLAUDE_CODE_ENTRYPOINT`. */
  readonly entrypoint: string;
  /** Replaces upstream `buildExtendedUserAgent` (`lib/request-headers.mjs:288-295`). */
  readonly userAgent: string;
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
  readonly contextHintEnabled: boolean;
  readonly betaPolicy: ClaudeCodeBetaPolicy;
  readonly supportedModels: Readonly<Record<string, ClaudeCodeCatalogueEntry>>;
}

export type ClaudeCodeWireErrorCode =
  | "INVALID_INPUT"
  | "INVALID_IDENTITY"
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
  /** Reports the effective profile id, which differs when overridden. */
  readonly profileId: string;
  readonly url: ClaudeCodeProtocolProfile["endpoint"];
  readonly method: "POST";
  readonly modelFamily: ClaudeCodeModelFamily;
  readonly logicalHeaderNames: readonly string[];
  readonly betaFeatures: readonly string[];
  readonly bodySha256: string;
  readonly bodyByteLength: number;
  readonly messageCount: number;
  readonly systemBlockCount: number;
  readonly capabilityDecisions: ClaudeCodeCapabilityDecisions;
  /**
   * Audits the extra headers `extraHeaderPolicy: "dropConflicting"` discarded,
   * lowercased and in caller order.
   *
   * Emitted ONLY under that policy. Under `strict`, and for every request built
   * before the seam existed, the key is ABSENT rather than present and empty,
   * so existing evidence stays byte-identical.
   */
  readonly droppedExtraHeaderNames?: readonly string[];
}

/**
 * Records the nine model capability decisions, plus any package-extension beta
 * override the caller supplied.
 *
 * The override keys are OPTIONAL and are emitted only when the corresponding
 * member of `betaOverrides` is present, so evidence for a request that omits
 * `betaOverrides` is byte-identical to evidence produced before the seam
 * existed.
 */
export type ClaudeCodeCapabilityDecisions = Readonly<
  Record<keyof ClaudeCodeCapabilities, boolean>
> & {
  /** Mirrors `betaOverrides.use1MContext`; absent when it was not supplied. */
  readonly use1MContext?: boolean;
};

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
