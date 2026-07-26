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
     * Capability provenance:
     *
     * Every value below was derived by executing upstream's own predicates
     * against each identifier, not by reading them. Because those predicates
     * are unanchored, a dated snapshot identifier always inherits the value of
     * the identifier it contains.
     *
     * - `adaptiveThinking` is true exactly for models accepted by upstream
     *   `isAdaptiveThinkingModel` (`lib/mimicry/models.mjs:107-115`): Opus
     *   4.6/4.7/4.8, Sonnet 4.6, Fable 5 and Mythos 5.
     * - `effort` is true exactly for models accepted by upstream
     *   `isEffortCapableModel` (`lib/mimicry/headers.mjs:138-142`); its five
     *   exclusions are Sonnet 4.5, Sonnet 4.0, Opus 4.0, Opus 4.1, and Haiku
     *   4.5 (`lib/mimicry/headers.mjs:26-32`). The two predicates are
     *   independent, so Opus 4.5, Opus 5 and Sonnet 5 are effort-capable
     *   without supporting adaptive thinking.
     * - `interleavedThinking` is true for all non-`claude-3-*` models
     *   (`lib/mimicry/headers.mjs:199-205`).
     * - Per-model `contextHint` is true for all non-`claude-3-*` models
     *   (`lib/mimicry/headers.mjs:269-283`), but the profile-level default is
     *   false because enabling it returned HTTP 400.
     *
     * Since no `claude-3-*` identifier remains in the table, both of the last
     * two are true for every entry. Their per-model form is retained because
     * it states the derivation rule, not merely the current result.
     *
     * DIVERGENCE: upstream recognises models with unanchored regex predicates
     * and has no finite table. This package deliberately pins an exhaustive
     * allowlist so unknown identifiers FAIL CLOSED with `UNSUPPORTED_MODEL`,
     * per plan section 3.3. The table covers exactly the first-party
     * `api.anthropic.com` surface. `claude-3-*` identifiers are deliberately
     * ABSENT because that endpoint does not serve them; they are reachable only
     * through gateway and cloud providers, each of which prefixes the
     * identifier differently, and those endpoints are out of scope for this
     * profile. Every canonical key is a real wire identifier and every alias is
     * a non-wire spelling that canonicalises onto one, because `resolveModel`
     * rewrites the outgoing `model` field to the canonical key.
     * `claude-opus-4-0` and `claude-sonnet-4-0` are retained although current
     * provider catalogues no longer advertise them, because removing an
     * identifier is a breaking change for existing callers. `claude-mythos-5`
     * is not advertised by any current provider catalogue and is carried solely
     * because upstream's predicates accept it.
     */
    supportedModels: {
      "claude-opus-5": {
        family: "opus",
        aliases: ["opus-5"],
        capabilities: capabilities(false, true),
      },
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
      "claude-opus-4-5": {
        family: "opus",
        aliases: ["opus-4-5", "claude-opus-4.5", "opus-4.5"],
        capabilities: capabilities(false, true),
      },
      "claude-opus-4-5-20251101": {
        family: "opus",
        aliases: [],
        capabilities: capabilities(false, true),
      },
      "claude-opus-4-1": {
        family: "opus",
        aliases: ["opus-4-1", "claude-opus-4.1", "opus-4.1"],
        capabilities: capabilities(false, false),
      },
      "claude-opus-4-1-20250805": {
        family: "opus",
        aliases: [],
        capabilities: capabilities(false, false),
      },
      "claude-opus-4-0": {
        family: "opus",
        aliases: ["opus-4-0", "claude-opus-4.0", "opus-4.0"],
        capabilities: capabilities(false, false),
      },
      "claude-sonnet-5": {
        family: "sonnet",
        aliases: ["sonnet-5"],
        capabilities: capabilities(false, true),
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
      "claude-sonnet-4-5-20250929": {
        family: "sonnet",
        aliases: [],
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
      "claude-haiku-4-5-20251001": {
        family: "haiku",
        aliases: [],
        capabilities: capabilities(false, false),
      },
      "claude-fable-5": {
        family: "fable",
        aliases: ["anthropic/claude-fable-5"],
        capabilities: capabilities(true, true),
      },
      "claude-mythos-5": {
        family: "mythos",
        aliases: [],
        capabilities: capabilities(true, true),
      },
    },
  });
