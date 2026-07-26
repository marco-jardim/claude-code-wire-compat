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
  interleavedThinking = true,
  contextHint = true,
): ClaudeCodeCapabilities {
  return { contextHint, adaptiveThinking, effort, interleavedThinking };
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
     * This table is transcribed from the genuine client's generated model
     * catalogue: a schema-validated table of 14 models carrying an `id`, a
     * `family`, and a `capabilities` string array. Its capability vocabulary is
     * exactly `effort`, `max_effort`, `xhigh_effort`, `adaptive_thinking`,
     * `context_management`, `fast_mode`, `lean_prompt`, `mid_conv_system`,
     * `rejects_disabled_thinking`, and `fable_5_mitigations`.
     *
     * This package models only two catalogue capabilities directly: `effort`
     * maps to catalogue `effort` membership, and `adaptiveThinking` maps to
     * catalogue `adaptive_thinking` membership. `interleavedThinking` and
     * `contextHint` are not catalogue capabilities. Upstream gates both on the
     * model not being a `claude-3-*` model, so they are false for the three
     * `claude-3-*` entries and true for every other entry.
     *
     * Every canonical key is a real first-party wire identifier because the
     * genuine request builder emits the catalogue id directly after stripping
     * only a `[1m]`/`[2m]` suffix. Dated forms such as
     * `claude-3-5-haiku-20241022` are `provider_ids.first_party` values and are
     * therefore not aliases: adding them as aliases would rewrite a caller's
     * model string onto a different identifier. Every alias is a non-wire
     * spelling that canonicalises onto a real identifier. `claude-mythos-5` was
     * removed because it has no catalogue entry in this client version, even
     * though the client's display code recognises the string.
     *
     * Known divergences this package does not yet model are the per-model
     * `default_effort` field (`xhigh` for Opus 4.7, `high` for Opus 4.8 and
     * Fable 5), and the six catalogue capabilities beyond effort and adaptive
     * thinking.
     *
     * DIVERGENCE: this package deliberately pins the catalogue as an exhaustive
     * allowlist, so unknown identifiers FAIL CLOSED with `UNSUPPORTED_MODEL`,
     * per plan section 3.3. This is stricter than display and predicate code
     * elsewhere in the genuine client, which may recognise strings that are not
     * catalogue entries.
     */
    supportedModels: {
      "claude-3-5-haiku": {
        family: "haiku",
        aliases: [],
        capabilities: capabilities(false, false, false, false),
      },
      "claude-haiku-4-5": {
        family: "haiku",
        aliases: ["haiku-4-5", "claude-haiku-4.5", "haiku-4.5"],
        capabilities: capabilities(false, false),
      },
      "claude-3-5-sonnet": {
        family: "sonnet",
        aliases: [],
        capabilities: capabilities(false, false, false, false),
      },
      "claude-3-7-sonnet": {
        family: "sonnet",
        aliases: [],
        capabilities: capabilities(false, false, false, false),
      },
      "claude-sonnet-4-0": {
        family: "sonnet",
        aliases: ["sonnet-4-0", "claude-sonnet-4.0", "sonnet-4.0"],
        capabilities: capabilities(false, false),
      },
      "claude-sonnet-4-5": {
        family: "sonnet",
        aliases: ["sonnet-4-5", "claude-sonnet-4.5", "sonnet-4.5"],
        capabilities: capabilities(false, false),
      },
      "claude-sonnet-4-6": {
        family: "sonnet",
        aliases: ["sonnet-4-6", "claude-sonnet-4.6", "sonnet-4.6"],
        capabilities: capabilities(true, true),
      },
      "claude-opus-4-0": {
        family: "opus",
        aliases: ["opus-4-0", "claude-opus-4.0", "opus-4.0"],
        capabilities: capabilities(false, false),
      },
      "claude-opus-4-1": {
        family: "opus",
        aliases: ["opus-4-1", "claude-opus-4.1", "opus-4.1"],
        capabilities: capabilities(false, false),
      },
      "claude-opus-4-5": {
        family: "opus",
        aliases: ["opus-4-5", "claude-opus-4.5", "opus-4.5"],
        capabilities: capabilities(false, false),
      },
      "claude-opus-4-6": {
        family: "opus",
        aliases: ["opus-4-6", "claude-opus-4.6", "opus-4.6"],
        capabilities: capabilities(true, true),
      },
      "claude-opus-4-7": {
        family: "opus",
        aliases: ["opus-4-7", "claude-opus-4.7", "opus-4.7"],
        capabilities: capabilities(true, true),
      },
      "claude-opus-4-8": {
        family: "opus",
        aliases: ["opus-4-8", "claude-opus-4.8", "opus-4.8"],
        capabilities: capabilities(true, true),
      },
      "claude-fable-5": {
        family: "fable",
        aliases: ["anthropic/claude-fable-5"],
        capabilities: capabilities(true, true),
      },
    },
  });
