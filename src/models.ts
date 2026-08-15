// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeModelFamily,
  ClaudeCodeProtocolProfile,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { deriveCapabilities } from "./model-capabilities.js";
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
  const entry = Object.hasOwn(profile.supportedModels, id)
    ? profile.supportedModels[id]
    : undefined;
  return Object.freeze({
    id,
    wireId,
    // The catalogue supplies the family here, and -- since T1.1.2 -- also
    // supplies the six catalogue-backed capabilities. Both now honour THIS
    // profile: `deriveCapabilities` takes the active profile, so a request
    // built against a non-pinned profile derives from that profile's
    // catalogue rather than from 2.1.195's. Ids with no catalogue entry fall
    // back to the ported predicates, which are pure functions of the
    // normalized id. See the header of `model-capabilities.ts`.
    family: entry?.family ?? modelFamilyOf(id),
    capabilities: deriveCapabilities(id, profile),
  });
}
