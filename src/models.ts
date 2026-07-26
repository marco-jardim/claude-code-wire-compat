// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeModelFamily,
  ClaudeCodeProtocolProfile,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import {
  modelFamilyOf,
  normalizeModelId,
  stripModelMarkers,
} from "./model-identity.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

export interface ResolvedClaudeCodeModel {
  readonly id: string;
  readonly wireId: string;
  readonly family: ClaudeCodeModelFamily;
  readonly capabilities: ClaudeCodeCapabilities;
}

export function resolveModel(
  model: string,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): ResolvedClaudeCodeModel {
  if (typeof model !== "string" || model.length === 0) {
    throw new ClaudeCodeWireError("INVALID_INPUT", { model });
  }

  const wireId = stripModelMarkers(model);
  const id = normalizeModelId(model);
  const definition = Object.hasOwn(profile.supportedModels, id)
    ? profile.supportedModels[id]
    : undefined;
  // Interim: a later capability-predicate port will replace catalogue lookup.
  return Object.freeze({
    id,
    wireId,
    family: definition?.family ?? modelFamilyOf(id),
    capabilities: definition?.capabilities ?? profile.defaultCapabilities,
  });
}
