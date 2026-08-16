// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Public entry point for the Claude Code wire compatibility package.
 *
 * Only the surfaces listed below are public. Internal protocol modules remain
 * private; the documented builder, parser, anti-verbosity helpers, read-only
 * model queries and the transcribed beta registries are exported here, and
 * nothing else.
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
  ClaudeCodeBetaOverrides,
  ClaudeCodeBetaPolicy,
  ClaudeCodeCapabilities,
  ClaudeCodeCapabilityDecisions,
  ClaudeCodeCatalogueEntry,
  ClaudeCodeEffort,
  ClaudeCodeExtraHeaderPolicy,
  ClaudeCodeMetadataOverrides,
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

export { BETA_REGISTRY } from "./beta-registry.js";

export {
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "./build-request.js";

export { TOKEN_COUNTING_BETA } from "./count-tokens.js";

export {
  hasOneMillionContext,
  isAdaptiveThinkingModel,
  isClaude3Model,
  isEligibleFor1MContext,
  isFable5Model,
  isHaikuModel,
  isMythos5Model,
  isOpus46Model,
  isOpus47Model,
  isOpus48Model,
  isSonnet46Model,
  modelCapability,
  supportsStructuredOutputs,
  supportsWebSearch,
} from "./model-queries.js";

export { BETA_REGISTRY_2_1_233 } from "./profiles/beta-registry-2.1.233.js";
export { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
export { CLAUDE_CODE_2_1_233_PROFILE } from "./profiles/claude-code-2.1.233.js";
