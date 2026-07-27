// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Public entry point for the Claude Code wire compatibility package.
 *
 * Only the surfaces listed below are public. The Wave 2 implementation
 * Internal protocol modules remain private; only the documented builder and
 * parser are exported here.
 *
 * Importing this module has no side effects. It reads no environment, opens
 * no network connection, touches no clock or random source, and holds no
 * mutable module-level state.
 */

export type {
  AntiVerbosityPolicy,
  AntiVerbositySection,
  BuiltClaudeCodeCountTokensRequest,
  BuiltClaudeCodeRequest,
  ClaudeCodeBetaPolicy,
  ClaudeCodeCapabilities,
  ClaudeCodeCatalogueEntry,
  ClaudeCodeEffort,
  ClaudeCodeModelFamily,
  ClaudeCodeProtocolProfile,
  ClaudeCodeCountTokensInput,
  ClaudeCodeRequestInput,
  ClaudeCodeRuntimeIdentity,
  ClaudeCodeWireErrorCode,
  HeaderPair,
  JsonPrimitive,
  JsonValue,
  Message,
  MessageContent,
  RedactedRequestEvidence,
  SystemInput,
  TextBlock,
  ThinkingDisplay,
  ToolDefinition,
  ToolResultBlock,
  ToolUseBlock,
} from "./contracts.js";

export { ClaudeCodeWireError } from "./contracts.js";

export {
  DEFAULT_ANTI_VERBOSITY_POLICY,
  antiVerbosityText,
  selectAntiVerbositySection,
} from "./anti-verbosity.js";

export {
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "./build-request.js";

export { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
