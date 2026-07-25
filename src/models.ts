// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

export interface ResolvedClaudeCodeModel {
  readonly id: string;
  readonly family: "haiku" | "sonnet" | "opus";
  readonly capabilities: ClaudeCodeCapabilities;
}

export function resolveModel(
  model: string,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): ResolvedClaudeCodeModel {
  for (const [id, definition] of Object.entries(profile.supportedModels)) {
    if (model === id || definition.aliases.includes(model)) {
      return Object.freeze({
        id,
        family: definition.family,
        capabilities: definition.capabilities,
      });
    }
  }

  throw new ClaudeCodeWireError("UNSUPPORTED_MODEL", { model });
}
