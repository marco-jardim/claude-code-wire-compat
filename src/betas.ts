// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

export interface ComposeBetasInput {
  readonly capabilities: ClaudeCodeCapabilities;
  readonly effortRequested: boolean;
  readonly contextHintRequested?: boolean;
}

const ALWAYS_ENABLED_BETAS: ReadonlySet<string> = new Set([
  "oauth-2025-04-20",
  "claude-code-20250219",
  "prompt-caching-scope-2026-01-05",
  "extended-cache-ttl-2025-04-11",
  "context-management-2025-06-27",
  "web-search-2025-03-05",
  "advisor-tool-2026-03-01",
  "redact-thinking-2026-02-12",
  "thinking-token-count-2026-05-13",
]);

const INTERLEAVED_THINKING_BETA = "interleaved-thinking-2025-05-14";
const EFFORT_BETA = "effort-2025-11-24";
const CONTEXT_HINT_BETA = "context-hint-2026-04-09";

export function composeBetas(
  input: ComposeBetasInput,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): readonly string[] {
  if (typeof input.effortRequested !== "boolean") {
    throw new ClaudeCodeWireError("INVALID_EFFORT");
  }
  if (
    input.contextHintRequested !== undefined &&
    typeof input.contextHintRequested !== "boolean"
  ) {
    throw new ClaudeCodeWireError("UNSUPPORTED_CAPABILITY", {
      capability: "contextHint",
    });
  }

  if (input.effortRequested && !input.capabilities.effort) {
    throw new ClaudeCodeWireError("UNSUPPORTED_CAPABILITY", {
      capability: "effort",
    });
  }
  if (input.contextHintRequested === true && !input.capabilities.contextHint) {
    throw new ClaudeCodeWireError("UNSUPPORTED_CAPABILITY", {
      capability: "contextHint",
    });
  }

  const selected = new Set(ALWAYS_ENABLED_BETAS);
  if (input.capabilities.interleavedThinking) {
    selected.add(INTERLEAVED_THINKING_BETA);
  }
  if (input.effortRequested) {
    selected.add(EFFORT_BETA);
  }
  if (input.contextHintRequested === true) {
    selected.add(CONTEXT_HINT_BETA);
  }

  const ordered: string[] = [];
  const emitted = new Set<string>();
  for (const beta of profile.orderedBetas) {
    if (selected.has(beta) && !emitted.has(beta)) {
      ordered.push(beta);
      emitted.add(beta);
    }
  }
  return Object.freeze(ordered);
}
