// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeCapabilities,
} from "../contracts.js";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(Reflect.get(value, key));
    }
    Object.freeze(value);
  }
  return value;
}

function capabilities(
  adaptiveThinking: boolean,
  effort: boolean,
): ClaudeCodeCapabilities {
  return {
    contextHint: true,
    adaptiveThinking,
    effort,
    interleavedThinking: true,
  };
}

export const CLAUDE_CODE_2_1_195_PROFILE: ClaudeCodeProtocolProfile =
  deepFreeze({
    id: "claude-code-2.1.195-sdk-0.94.0",
    cliVersion: "2.1.195",
    sdkVersion: "0.94.0",
    endpoint: "https://api.anthropic.com/v1/messages?beta=true",
    entrypoint: "cli",
    userAgent: "claude-cli/2.1.195 (external, cli)",
    buildTime: "2026-06-26T01:00:56Z",
    gitSha: "4603aa3f2ea164bd0974f82eb413ae7acc99a7ee",
    attributionHeaderEnabled: true,
    provider: "anthropic",
    anthropicVersion: "2023-06-01",
    defaultCapabilities: {
      contextHint: false,
      adaptiveThinking: true,
      effort: true,
      interleavedThinking: true,
    },
    /**
     * This is the full ordering vocabulary. Which subset is actually emitted
     * is decided per request in Wave 2 by capability gates;
     * `context-hint-2026-04-09` and `effort-2025-11-24` are conditional.
     */
    orderedBetas: [
      "oauth-2025-04-20",
      "claude-code-20250219",
      "interleaved-thinking-2025-05-14",
      "prompt-caching-scope-2026-01-05",
      "extended-cache-ttl-2025-04-11",
      "context-management-2025-06-27",
      "effort-2025-11-24",
      "web-search-2025-03-05",
      "advisor-tool-2026-03-01",
      "context-hint-2026-04-09",
      "redact-thinking-2026-02-12",
      "thinking-token-count-2026-05-13",
    ],
    /**
     * Capability provenance:
     *
     * - `adaptiveThinking` is true exactly for models accepted by upstream
     *   `isAdaptiveThinkingModel` (`lib/mimicry/models.mjs:107-115`): Opus
     *   4.6/4.7/4.8 and Sonnet 4.6.
     * - `effort` is true exactly for models accepted by upstream
     *   `isEffortCapableModel` (`lib/mimicry/headers.mjs:138-142`); its five
     *   exclusions are Sonnet 4.5, Sonnet 4.0, Opus 4.0, Opus 4.1, and Haiku
     *   4.5 (`lib/mimicry/headers.mjs:26-32`).
     * - `interleavedThinking` is true for all non-`claude-3-*` models
     *   (`lib/mimicry/headers.mjs:199-205`).
     * - Per-model `contextHint` is true for all non-`claude-3-*` models
     *   (`lib/mimicry/headers.mjs:269-283`), but the profile-level default is
     *   false because enabling it returned HTTP 400.
     *
     * DIVERGENCE: upstream recognises models with UNANCHORED REGEX PREDICATES
     * and has no finite table. This package deliberately pins an exhaustive
     * allowlist so unknown or future model IDs FAIL CLOSED with
     * `UNSUPPORTED_MODEL`, per plan §3.3. `claude-3-*`, `claude-fable-5`, and
     * `claude-mythos-5` are intentionally OUT OF SCOPE for v0.1.0.
     */
    supportedModels: {
      "claude-opus-4-8": {
        family: "opus",
        aliases: ["opus-4-8", "claude-opus-4.8", "opus-4.8"],
        capabilities: capabilities(true, true),
      },
      "claude-opus-4-7": {
        family: "opus",
        aliases: ["opus-4-7", "claude-opus-4.7", "opus-4.7"],
        capabilities: capabilities(true, true),
      },
      "claude-opus-4-6": {
        family: "opus",
        aliases: ["opus-4-6", "claude-opus-4.6", "opus-4.6"],
        capabilities: capabilities(true, true),
      },
      "claude-opus-4-1": {
        family: "opus",
        aliases: ["opus-4-1", "claude-opus-4.1", "opus-4.1"],
        capabilities: capabilities(false, false),
      },
      "claude-opus-4-0": {
        family: "opus",
        aliases: ["opus-4-0", "claude-opus-4.0", "opus-4.0"],
        capabilities: capabilities(false, false),
      },
      "claude-sonnet-4-6": {
        family: "sonnet",
        aliases: ["sonnet-4-6", "claude-sonnet-4.6", "sonnet-4.6"],
        capabilities: capabilities(true, true),
      },
      "claude-sonnet-4-5": {
        family: "sonnet",
        aliases: ["sonnet-4-5", "claude-sonnet-4.5", "sonnet-4.5"],
        capabilities: capabilities(false, false),
      },
      "claude-sonnet-4-0": {
        family: "sonnet",
        aliases: ["sonnet-4-0", "claude-sonnet-4.0", "sonnet-4.0"],
        capabilities: capabilities(false, false),
      },
      "claude-haiku-4-5": {
        family: "haiku",
        aliases: ["haiku-4-5", "claude-haiku-4.5", "haiku-4.5"],
        capabilities: capabilities(false, false),
      },
    },
  });
