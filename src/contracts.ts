// SPDX-License-Identifier: GPL-3.0-or-later

export type HeaderPair = readonly [name: string, value: string];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface TextBlock {
  readonly type: "text";
  readonly text: string;
  readonly cache_control?: {
    readonly type: "ephemeral";
    readonly ttl?: "5m" | "1h";
    readonly scope?: "global";
  };
}

export interface ToolUseBlock {
  readonly type: "tool_use";
  readonly id: string;
  readonly name: string;
  readonly input: Readonly<Record<string, JsonValue>>;
}

export interface ToolResultBlock {
  readonly type: "tool_result";
  readonly tool_use_id: string;
  readonly content: string | readonly TextBlock[];
  readonly is_error?: boolean;
}

export type MessageContent =
  string | readonly (TextBlock | ToolUseBlock | ToolResultBlock)[];
export interface Message {
  readonly role: "user" | "assistant";
  readonly content: MessageContent;
}
export type SystemInput = string | TextBlock;

export interface ToolDefinition {
  readonly name: string;
  readonly description?: string;
  readonly input_schema: Readonly<Record<string, JsonValue>>;
}

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
  readonly metadata?: Readonly<Record<string, JsonPrimitive>>;
  /** Supplies the `x-client-request-id` header. */
  readonly clientRequestId: string;
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
