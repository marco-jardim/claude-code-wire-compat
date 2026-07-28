<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Claude Code wire source-to-contract trace

> **Provenance**
>
> - Upstream repository: <https://github.com/marco-jardim/opencode-anthropic-fix>
> - Upstream commit: `466d500084b59651798bf38bf24d21f3cb850db6`
> - Upstream license: `GPL-3.0-or-later`
> - This work's license: `GPL-3.0-or-later`
> - Status: **MODIFIED derivative work**

This document is the normative trace from the pinned upstream implementation to the runtime-neutral package contract. Line references are inclusive and refer only to the pinned commit above.

> **Precedence.** Rows whose "Upstream file" names a `lib/` path trace to the plugin at the pinned commit. Rows that name a genuine-client symbol trace to the client build itself and take precedence, because the plugin is a reimplementation and has been found to diverge. Where the two disagree, the client wins and the row is rewritten to cite the client. Behaviour re-derived directly from the client is recorded per work package under `.com466-evidence/phase-7/`.

## Pinned profile

| Field           | Pinned value                                      |
| --------------- | ------------------------------------------------- |
| Claude Code CLI | `2.1.195`                                         |
| Anthropic SDK   | `0.94.0`                                          |
| Endpoint        | `https://api.anthropic.com/v1/messages?beta=true` |
| Profile id      | `claude-code-2.1.195-sdk-0.94.0`                  |

## Build configuration decision

The implementation plan names `tsconfig.build.json` in two staging lists, but that file was
deliberately not created. The root `tsconfig.json` is already the build configuration: the `build`
script runs `tsc -p tsconfig.json`. A second build configuration would fork the build and allow
emitted output to drift from what is typechecked.

## Headers

| Behavior                             | Upstream file             |   Lines | Rule (concise)                                                                                                                                                                                                                                                                          | Future package test                      |
| ------------------------------------ | ------------------------- | ------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Input merge                          | `lib/mimicry/headers.mjs` | 377-411 | Merge `Request` headers, then `requestInit.headers`; later values replace earlier values and `undefined` values are omitted.                                                                                                                                                            | `test/headers.test.ts`                   |
| Beta and provider inputs             | `lib/mimicry/headers.mjs` | 413-438 | Preserve incoming betas, derive request metadata/provider/fast mode, and pass all profile gates to beta construction.                                                                                                                                                                   | `test/betas.test.ts`                     |
| Authorization                        | `lib/mimicry/headers.mjs` | 440-444 | Prefer trimmed `ANTHROPIC_AUTH_TOKEN` over the supplied access token; emit Bearer authorization and the merged beta header. Runtime-neutral code must receive the selected token explicitly.                                                                                            | `test/headers.test.ts`                   |
| User agent and fixed profile headers | `lib/mimicry/headers.mjs` | 445-476 | Emit `claude-cli/<version> (external, cli)`, `anthropic-version: 2023-06-01`, `x-app`, Stainless platform fields, SDK `0.94.0`, retry default `0`, timeout `600`, and dangerous-browser-access `true`. Platform, runtime version, background mode, and CLI version are injected inputs. | `test/profile.test.ts`                   |
| Helper header                        | `lib/mimicry/headers.mjs` | 477-480 | Emit `x-stainless-helper` only when the helper classifier returns a nonempty value.                                                                                                                                                                                                     | `test/headers.test.ts`                   |
| Optional custom headers              | `lib/mimicry/headers.mjs` | 482-495 | Optional custom, container, remote-session, client-app, and additional-protection headers are conditional; ambient values must be injected rather than read by the core.                                                                                                                | `test/headers.test.ts`                   |
| Request id and stripping             | `lib/mimicry/headers.mjs` | 498-504 | Emit an injected per-request UUID as `x-client-request-id`; always remove `x-api-key` and `x-session-affinity`.                                                                                                                                                                         | `test/security/core-adversarial.test.ts` |

## Request headers

> **Plan errata E1:** the implementation plan §2.2 cites this file as
> `lib/mimicry/request-headers.mjs`. No such path exists at the pinned commit. The file is real
> but lives one directory up, at `lib/request-headers.mjs` (295 lines, pure constants and helpers
> with no imports). The cited line ranges 19-45 and 282-295 are correct for that path and are
> traced below. The plan's directory component is wrong; its line ranges are not.

| Behavior               | Upstream file             |   Lines | Rule (concise)                                                                                                                                                                                                                                                                                                                                                                                              | Future package test                    |
| ---------------------- | ------------------------- | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Pinned CLI version     | `lib/request-headers.mjs` |      19 | `FALLBACK_CLAUDE_CLI_VERSION = "2.1.195"`. The package pins this as a profile constant, never as a fallback resolved at runtime.                                                                                                                                                                                                                                                                            | `test/profile.test.ts`                 |
| Version discovery URL  | `lib/request-headers.mjs` |      20 | `CLAUDE_CODE_NPM_LATEST_URL` performs live version discovery upstream. The runtime-neutral core performs **no** network I/O, so this is deliberately NOT ported.                                                                                                                                                                                                                                            | `test/runtime/runtime-neutral.test.ts` |
| Build markers          | `lib/request-headers.mjs` |   26-27 | `CLAUDE_CODE_BUILD_TIME = "2026-06-26T01:00:56Z"` and `CLAUDE_CODE_GIT_SHA = "4603aa3f2ea164bd0974f82eb413ae7acc99a7ee"`, extracted from the 2.1.195 native binary. Pinned as profile constants only if a golden proves they reach the wire.                                                                                                                                                                | `test/profile.test.ts`                 |
| Pinned SDK version     | `lib/request-headers.mjs` |      37 | `ANTHROPIC_SDK_VERSION = "0.94.0"`, distinct from the CLI version, emitted as `x-stainless-package-version`.                                                                                                                                                                                                                                                                                                | `test/profile.test.ts`                 |
| CLI-to-SDK version map | `lib/request-headers.mjs` |   40-45 | `CLI_TO_SDK_VERSION` maps each CLI version to its bundled SDK version; the pinned pair `["2.1.195", "0.94.0"]` is at line 45. The package pins exactly one pair and does not port the historical map.                                                                                                                                                                                                       | `test/profile.test.ts`                 |
| Experimental beta set  | `lib/request-headers.mjs` | 173-185 | **Superseded** by "Beta registry and push order". `EXPERIMENTAL_BETA_FLAGS` is the plugin's flat opt-in registry; `context-hint-2026-04-09` is a member at line 185. The package models the client's 28-entry keyed `BETA_REGISTRY` instead and ports no flat list.                                                                                                                                         | `test/betas.test.ts`                   |
| Beta shortcut aliases  | `lib/request-headers.mjs` | 225-235 | **Superseded** by "Beta registry and push order". `BETA_SHORTCUTS` maps human aliases (`context-hint`, `hint`) to full flag names. The package does not port alias expansion.                                                                                                                                                                                                                               | `test/betas.test.ts`                   |
| Shortcut resolution    | `lib/request-headers.mjs` | 274-279 | **Superseded** by "Beta registry and push order". `resolveBetaShortcut` trims, lowercases for lookup, and returns the input unchanged on miss — i.e. it never fails closed on an unknown flag. The package does **not** reject unknown flags either: it accepts no caller-supplied beta list at all, so there is nothing to reject. Every emitted beta is derived from `BETA_REGISTRY` behind its own gate. | `test/betas.test.ts`                   |
| Extended user agent    | `lib/request-headers.mjs` | 288-295 | `buildExtendedUserAgent` returns `claude-cli/<version> (external, <entrypoint><sdkSuffix><clientAppSuffix>)`. Entrypoint and both optional suffixes are read from ambient environment upstream and MUST become injected inputs — see the table below.                                                                                                                                                       | `test/headers.test.ts`                 |

## Request helpers

| Behavior                   | Upstream file                     |   Lines | Rule (concise)                                                                                                                                                              | Future package test        |
| -------------------------- | --------------------------------- | ------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| First-user-text extraction | `lib/mimicry/request-helpers.mjs` | 164-182 | Select the first user message; return string content or its first text block, otherwise `""`. Do not search later user messages after a malformed/empty first user message. | `test/fingerprint.test.ts` |
| Metadata override          | `lib/mimicry/request-helpers.mjs` | 184-195 | A nonempty raw override replaces the generated `metadata.user_id`; expose this as an explicit package input rather than an environment read.                                | `test/metadata.test.ts`    |
| Extra metadata parsing     | `lib/mimicry/request-helpers.mjs` | 196-207 | Merge only a valid JSON object; ignore arrays, primitives, and invalid JSON. The package accepts the parsed object explicitly.                                              | `test/metadata.test.ts`    |
| Metadata envelope          | `lib/mimicry/request-helpers.mjs` | 209-216 | JSON-encode extra fields followed by `device_id`, `account_uuid`, and `session_id`, so the three required values win on key collisions.                                     | `test/metadata.test.ts`    |

## System prompt

| Behavior                     | Upstream file                   |   Lines | Rule (concise)                                                                                                                                                                                                                                                                                           | Future package test                      |
| ---------------------------- | ------------------------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Fingerprint constants        | `lib/mimicry/system-prompt.mjs` |     5-6 | Salt is `59cf53e54c78`; sampled character indices are `4`, `7`, and `20`.                                                                                                                                                                                                                                | `test/fingerprint.test.ts`               |
| Identity constants           | `lib/mimicry/system-prompt.mjs` |    8-14 | Use the interactive CLI identity by default; recognize the two Agent SDK identities and the dynamic-boundary sentinel when structuring blocks.                                                                                                                                                           | `test/system-prompt.test.ts`             |
| Fingerprint algorithm        | `lib/mimicry/system-prompt.mjs` |   86-97 | Hash salt + sampled characters (missing becomes `0`) + CLI version with SHA-256, encode lowercase hex, and take three characters.                                                                                                                                                                        | `test/fingerprint.test.ts`               |
| Anti-verbosity section       | genuine client `ytm`            |       — | Three-way selection. `claude-fable-5` and `claude-mythos-5` take the communicating-with-the-user section; `claude-3-*`, any Haiku or Sonnet, and Opus 4.0/4.1/4.5/4.6/4.7 take the text-output section; a raw `-eap` suffix, `claude-opus-4-8`, and every unrecognized identifier take the lean section. | `test/validation/anti-verbosity.test.ts` |
| Billing attribution gate     | `lib/mimicry/system-prompt.mjs` | 119-143 | Falsy attribution suppresses the full line; entrypoint defaults to `cli`; fingerprint is computed even for empty user text.                                                                                                                                                                              | `test/fingerprint.test.ts`               |
| Billing cch/provider gate    | `lib/mimicry/system-prompt.mjs` | 144-148 | Format `cc_version=<version>.<fingerprint>` and emit static `cch=00000;` except for `bedrock`, `anthropicAws`, and `mantle`.                                                                                                                                                                             | `test/system-prompt.test.ts`             |
| Billing workload             | `lib/mimicry/system-prompt.mjs` | 149-159 | Explicit workload overrides ambient workload, unsafe separator/whitespace characters become `_`, and workload is omitted under the same provider gate as cch.                                                                                                                                            | `test/security/core-adversarial.test.ts` |
| Boundary-mode split          | `lib/mimicry/system-prompt.mjs` | 403-480 | Remove duplicate billing/identity/sentinel blocks; in boundary mode order billing, identity, joined static, then joined dynamic text, with only static text globally cache-scoped.                                                                                                                       | `test/system-prompt.test.ts`             |
| Fallback split               | `lib/mimicry/system-prompt.mjs` | 481-495 | Without a usable boundary, order optional billing, identity, then joined remaining text; identity and remainder use internal `org` cache scope.                                                                                                                                                          | `test/system-prompt.test.ts`             |
| Sanitize and subagent prefix | `lib/mimicry/system-prompt.mjs` | 502-542 | Sanitize/compact each block; cache a bounded main-agent prefix and prepend it to later subagent prompts when available, except title generation.                                                                                                                                                         | `test/system-prompt.test.ts`             |
| Title and verbosity gates    | `lib/mimicry/system-prompt.mjs` | 544-576 | Replace title prompts with the compact title prompt; otherwise deduplicate unless compaction is off, and conditionally append Opus anti-verbosity/length blocks.                                                                                                                                         | `test/system-prompt.test.ts`             |
| Signature and lean gates     | `lib/mimicry/system-prompt.mjs` | 578-595 | Return sanitized blocks unchanged when signature mimicry is disabled; optionally omit billing and identity for configured non-main title/small roles.                                                                                                                                                    | `test/system-prompt.test.ts`             |
| Final system assembly        | `lib/mimicry/system-prompt.mjs` | 597-629 | Build billing and identity, resolve cache policy/boundary mode, split in deterministic logical order, then map internal scopes to wire `cache_control`.                                                                                                                                                  | `test/build-request.test.ts`             |

## Request body

| Behavior                       | Upstream file                  |   Lines | Rule (concise)                                                                                                                                                                                                                                                                                                                                                                                               | Future package test                         |
| ------------------------------ | ------------------------------ | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Transform input and output cap | `lib/mimicry/request-body.mjs` |   66-89 | Transform only a nonempty JSON string; when configured, resolve `max_tokens` before other body changes. Debug logging is not part of the runtime-neutral contract.                                                                                                                                                                                                                                           | `test/request-body.test.ts`                 |
| Body betas                     | `lib/mimicry/request-body.mjs` |  90-104 | For signed Bedrock requests, copy header betas to `anthropic_beta` except OAuth; always delete unsupported top-level `betas`. First-party betas remain header-only.                                                                                                                                                                                                                                          | `test/betas.test.ts`                        |
| Thinking normalization         | `lib/mimicry/request-body.mjs` | 105-112 | **Plugin behaviour, superseded** by "Thinking omission and model authority" below. The plugin normalizes an existing thinking block and injects `{type:"adaptive"}` when an adaptive model omits thinking. The package does **not** inject: a caller who omits thinking gets no thinking field on the wire.                                                                                                  | `test/validation/thinking-contract.test.ts` |
| Effort wire shape              | `lib/mimicry/request-body.mjs` | 114-145 | **Plugin behaviour the package deliberately does not reproduce.** The plugin moves adaptive-model top-level effort into `output_config.effort` without overriding an existing nested value, strips top-level effort otherwise, and defaults missing adaptive effort to `high`. The package performs the `output_config.effort` placement but never applies a default — see "Effort default is policy" below. | `test/model-capability-wire.test.ts`        |
| Temperature                    | `lib/mimicry/request-body.mjs` | 147-155 | **Plugin behaviour, superseded** by "Temperature model gate" below. The plugin omits temperature whenever adaptive or enabled thinking is active. That is only half the rule: the client also gates on the model.                                                                                                                                                                                            | `test/request-body.test.ts`                 |
| Context management body        | `lib/mimicry/request-body.mjs` | 157-173 | Only explicit token-economy opt-in on a non-Claude-3 thinking request injects `context_management.edits=[{type:"clear_thinking_20251015",keep:"all"}]`.                                                                                                                                                                                                                                                      | `test/request-body.test.ts`                 |
| Non-thinking temperature       | `lib/mimicry/request-body.mjs` | 174-177 | **Plugin behaviour, superseded** by "Temperature model gate" below; reproducing it verbatim is defect D2. The plugin sets `temperature: 1` whenever thinking is not active, with no model gate.                                                                                                                                                                                                              | `test/request-body.test.ts`                 |
| Model and fingerprint source   | `lib/mimicry/request-body.mjs` | 292-295 | Capture the transformed model locally and derive billing input from the first user message.                                                                                                                                                                                                                                                                                                                  | `test/fingerprint.test.ts`                  |
| Request-wide cache TTL         | `lib/mimicry/request-body.mjs` | 296-323 | Resolve one TTL from cache policy, request role, subagent status, and injected environment controls, then reuse it for system/tools/messages to preserve valid cache ordering.                                                                                                                                                                                                                               | `test/request-body.test.ts`                 |
| System assembly inputs         | `lib/mimicry/request-body.mjs` | 324-343 | Inject first-user text, model, role, cache policy, workload, and configured prompt gates into system-block construction.                                                                                                                                                                                                                                                                                     | `test/build-request.test.ts`                |
| Metadata insertion             | `lib/mimicry/request-body.mjs` | 380-393 | When mimicry is enabled, preserve current metadata but replace `user_id` with the generated metadata envelope from injected device/account/session inputs.                                                                                                                                                                                                                                                   | `test/metadata.test.ts`                     |
| Cache activation gates         | `lib/mimicry/request-body.mjs` | 395-424 | Add breakpoints only when signing and supported caching are enabled and the request is not title generation; use the request-wide resolved TTL.                                                                                                                                                                                                                                                              | `test/request-body.test.ts`                 |
| Tool breakpoint                | `lib/mimicry/request-body.mjs` | 425-441 | Strip incoming tool cache markers and, when stability policy permits, put one ephemeral marker with the resolved TTL on the last tool.                                                                                                                                                                                                                                                                       | `test/request-body.test.ts`                 |
| Thinking-block immutability    | `lib/mimicry/request-body.mjs` | 442-463 | Never mutate `thinking` or `redacted_thinking` blocks; remove incoming cache markers only from other message content blocks.                                                                                                                                                                                                                                                                                 | `test/redaction.test.ts`                    |
| User-message breakpoint        | `lib/mimicry/request-body.mjs` | 464-477 | Put one ephemeral cache marker with the resolved TTL on the final content block of the last nonempty user message.                                                                                                                                                                                                                                                                                           | `test/request-body.test.ts`                 |
| Tool-name mapping              | `lib/mimicry/request-body.mjs` | 479-502 | Map core OpenCode names to Claude Code casing: `bash/read/glob/grep/edit/write/webfetch/todowrite/skill/task/compress` become `Bash/Read/Glob/Grep/Edit/Write/WebFetch/TodoWrite/Skill/Task/Compress`.                                                                                                                                                                                                       | `test/request-body.test.ts`                 |
| Tool-use mapping               | `lib/mimicry/request-body.mjs` | 503-513 | Apply the same mapping to tool names inside message `tool_use` blocks.                                                                                                                                                                                                                                                                                                                                       | `test/request-body.test.ts`                 |
| Orphan repair                  | `lib/mimicry/request-body.mjs` | 643-653 | Repair unmatched assistant `tool_use` blocks throughout message history by supplying matching results.                                                                                                                                                                                                                                                                                                       | `test/request-body.test.ts`                 |
| Assistant-tail guard           | `lib/mimicry/request-body.mjs` | 654-677 | Never serialize an assistant-final conversation: append unavailable tool results for trailing tool uses, otherwise append user text `Continue.`.                                                                                                                                                                                                                                                             | `test/request-body.test.ts`                 |

## Client-derived behaviour

Rows in this section trace the genuine client rather than the plugin, so by the precedence note
above they take priority wherever they disagree with a `lib/` row. Each row names the plugin row it
supersedes, if any.

| Behavior                              | Upstream symbol                                                        | Byte offset | Rule (concise)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Package test                                |
| ------------------------------------- | ---------------------------------------------------------------------- | ----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Temperature model gate                | genuine client `LCn`                                                   |   227385451 | **Supersedes "Temperature" and "Non-thinking temperature".** Temperature is emitted **iff** thinking is inactive **AND** the model is on the `LCn` allowlist. `LCn` has **INVERTED polarity** relative to every other capability predicate: membership means temperature IS supported, so it must not be refactored into the shared exclusion-list shape. Consequence: `claude-opus-4-7`, `claude-opus-4-8`, `claude-fable-5` and `claude-mythos-5` never receive a `temperature` field, and a caller-supplied value on those models is **silently discarded, not rejected**.                                                                                                                                                                                                                                                                                         | `test/model-capability-wire.test.ts`        |
| Thinking omission and model authority | genuine client `Uot`                                                   |   227383245 | **Supersedes "Thinking normalization".** The package injects nothing: a caller who omits thinking gets no `thinking` field. WP-4 finding: the adaptive-versus-enabled choice belongs to the **model**, not the caller. A caller asking for `type:"enabled"` on an adaptive-capable model receives `{type:"adaptive"}` and their `budgetTokens` is discarded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `test/validation/thinking-contract.test.ts` |
| Effort default is policy              | genuine client catalogue `default_effort`                              |           — | **Qualifies "Effort wire shape".** Deferred decision D-2 was settled by evidence: `default_effort` is **policy, not protocol** — its only read site in the client is UI-adjacent. The package therefore **exposes** it as `ClaudeCodeCatalogueEntry.defaultEffort` and never applies it. Defect D11 records the shipped consequence: for an effort-capable model with no caller effort the client still pushes beta `effort-2025-11-24` with **no** `output_config.effort`.                                                                                                                                                                                                                                                                                                                                                                                           | `test/model-capability-wire.test.ts`        |
| Model identity passthrough            | genuine client `$_` (226639025) and `dp` (226644497)                   |           — | The client **never rejects** a model identifier: `$_` normalizes for capability lookup only, and unrecognized identifiers fall through to a date-suffix strip. `dp` removes `[1m]`/`[2m]` markers. The package therefore sends the caller's model string **verbatim** minus any marker, and uses the normalized id solely to derive capabilities. Ported in `src/model-identity.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `test/validation/model-identity.test.ts`    |
| Capability derivation                 | genuine client `Kw`, `Hke`, `Yte`, `Uot`, `QOt`, `RCn`, `LCn`, `U4e`   |           — | Nine predicates ported in `src/model-capabilities.ts` produce the nine booleans of `ClaudeCodeCapabilities`. Each one reduces, on first party, to its exclusion list alone; the upstream `W9`/`JB`/`ZO` overrides and fallbacks are elided because no first-party path reaches them. `LCn` is the single allowlist — see "Temperature model gate".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `test/model-capability-wire.test.ts`        |
| Count-tokens endpoint                 | `buildClaudeCodeCountTokensRequest`                                    |           — | `POST https://api.anthropic.com/v1/messages/count_tokens?beta=true`. Betas move **out of the body** and into the `anthropic-beta` header, filtered to the count-tokens subset, with `token-counting-2024-11-01` appended.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `test/validation/count-tokens.test.ts`      |
| Beta registry and push order          | genuine client `Udd`, ordered by `$9r` plus the request builder        |           — | **Supersedes "Experimental beta set", "Beta shortcut aliases" and "Shortcut resolution".** The client carries a 28-entry keyed registry, ported verbatim as `BETA_REGISTRY` in `src/beta-registry.ts`. There is no flat opt-in list and no alias table. Wire order is **emergent**, not declared: it falls out of `$9r` combined with the order in which the request builder pushes each gated flag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `test/betas.test.ts`                        |
| Max-tokens clamp                      | genuine client `qct` (238199436), `Fue` (229566641), `Xxe` (227378240) |           — | Defect D16. The client emits `Fi = Math.min(callerValue, qct(model))`, and `qct` is `Fue("CLAUDE_CODE_MAX_OUTPUT_TOKENS", <env>, Xxe(model).default, Xxe(model).upperLimit).effective`. `Fue` returns the default untouched when the environment variable is unset and only ever clamps the **environment** value against `upperLimit`, so for this package — which reads no environment — `qct` reduces to `Xxe(model).default`. An oversized `max_tokens` is therefore **silently capped, not rejected**, and the bound is the model **default**, never its upper limit. The same clamped `Fi` feeds the thinking budget via `Tr = Math.min(Fi - 1, Tr)`, so both call sites receive the capped value. `Vkd` and `bvi` are not modelled: `Vkd` reads a host config object absent on a default install, and `bvi` sits behind `_vi()`, which returns a hard `false`. | `test/validation/max-tokens-clamp.test.ts`  |

## Conformance

| Behavior                 | Upstream file                          |     Lines | Rule (concise)                                                                                                                                         | Future package test          |
| ------------------------ | -------------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Required request headers | `test/conformance/regression.test.mjs` | 1138-1159 | Conformance locks API version, Stainless language/runtime/retry fields, foreground app, Bearer authorization, and removal of `x-api-key`.              | `test/headers.test.ts`       |
| Browser/helper headers   | `test/conformance/regression.test.mjs` | 1161-1167 | Dangerous-browser-access is present and `x-stainless-helper-method` is absent.                                                                         | `test/headers.test.ts`       |
| Request id               | `test/conformance/regression.test.mjs` | 1169-1176 | Each request id has UUID text shape; generation is an injected dependency in the package.                                                              | `test/headers.test.ts`       |
| User agent               | `test/conformance/regression.test.mjs` | 1178-1184 | User agent starts with the `claude-cli/<semver> (external` family and must not contain `claude-code/`.                                                 | `test/profile.test.ts`       |
| OS mapping               | `test/conformance/regression.test.mjs` | 1186-1197 | Map Darwin, Windows, and Linux runtime platforms to `macOS`, `Windows`, and `Linux`.                                                                   | `test/headers.test.ts`       |
| System block order       | `test/conformance/regression.test.mjs` | 1200-1229 | Billing is first without cache control, identity is second with the resolved ephemeral TTL, and user system text follows; billing contains static cch. | `test/system-prompt.test.ts` |
| Fingerprint shape        | `test/conformance/regression.test.mjs` | 1231-1248 | Billing `cc_version` ends in exactly three lowercase hex characters and never substitutes a model id for that suffix.                                  | `test/fingerprint.test.ts`   |

## Golden test

| Behavior               | Upstream file                               |   Lines | Rule (concise)                                                                                                                             | Future package test            |
| ---------------------- | ------------------------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Golden loading         | `test/conformance/golden-outgoing.test.mjs` |   54-55 | Load the foreground outgoing fixture as JSON.                                                                                              | `test/golden-fixtures.test.ts` |
| Allowed nondeterminism | `test/conformance/golden-outgoing.test.mjs` |   57-63 | Normalize only metadata user id, Claude session id, and per-request id; every other header/body field remains literal and drift-sensitive. | `test/golden-fixtures.test.ts` |
| Foreground request     | `test/conformance/golden-outgoing.test.mjs` |  95-117 | Drive a signed foreground Messages POST with a fixed model, token limit, system text, and one user message, then consume the response.     | `test/build-request.test.ts`   |
| Capture shape          | `test/conformance/golden-outgoing.test.mjs` | 119-127 | Capture headers as a plain key/value object and parse the serialized JSON body.                                                            | `test/golden-fixtures.test.ts` |
| Structural comparison  | `test/conformance/golden-outgoing.test.mjs` | 130-159 | Recursively find differing paths and replace only the allowlisted nondeterministic leaves before comparison.                               | `test/golden-fixtures.test.ts` |
| Golden assertion       | `test/conformance/golden-outgoing.test.mjs` | 161-193 | Two equivalent requests may differ only at the three normalized paths; both normalized requests must equal the fixture.                    | `test/golden-fixtures.test.ts` |

> **Discrepancy:** the request URL at `test/conformance/golden-outgoing.test.mjs:106` omits the pinned profile's `?beta=true` query. The golden test therefore proves the request shape and path, but not that query parameter; `test/profile.test.ts` must lock the complete pinned endpoint.

## Golden fixture

| Behavior                 | Upstream file                                   |             Lines | Rule (concise)                                                                                                                                                                                                                                                                                                                                                                                               | Future package test            |
| ------------------------ | ----------------------------------------------- | ----------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Foreground wire snapshot | `test/fixtures/golden/outgoing-foreground.json` | whole file (1-66) | Structure only: a top-level `headers` object and `body` object; the body contains model/token settings, ordered system blocks, messages, and metadata. `temperature` is **conditional**, not unconditional: it appears in this fixture only because `claude-sonnet-4-5` is on the temperature allowlist — see "Temperature model gate" above. Generated identity/request fields are normalized placeholders. | `test/golden-fixtures.test.ts` |

### Fixture integrity

| Fixture                                                      | Model                 | SHA-256                                                            |
| ------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------ |
| `test/fixtures/golden/outgoing-foreground.json`              | `claude-sonnet-4-5`   | `62748f01fcc20ae48f40dc4b628a094db5e06cd809d64d0c9163c0e69b0a98ea` |
| `test/fixtures/golden/outgoing-canary-context-hint-off.json` | `claude-opus-4-8`     | `af9fa1a299ba9b3cf493e1e5b2e0bb8b935e1089c2679ead615fe87c459bf3db` |
| `test/fixtures/golden/decision-context-hint-rejected.json`   | n/a (decision record) | `6957d363e1e9512eb1a8d2c7170fa208b92e28460e7fb3b8576aa3814cdf4582` |

`test/fixtures/golden/manifest.json` is the machine-readable copy of these hashes and is the
**source of truth**. This table and the manifest **MUST** both be updated when any fixture is
regenerated.

That requirement was previously unenforced, and the table rotted: two of the three hashes above
were stale until this trace was corrected. `test/governance/source-trace-integrity.test.ts` now
enforces the invariant in both directions — every manifest fixture name and hash must appear in
this table, and every SHA-256 written in this table must be a value the manifest still carries, so
a hash cannot survive the removal of its fixture.

## Billing fingerprint

The exact formula is SHA-256 over the UTF-8 encoding of the concatenation:

1. the literal salt `59cf53e54c78`;
2. `firstUserMessage` characters at zero-based indices `4`, `7`, and `20`, in that order, with each missing character contributing the literal `0`; and
3. the CLI version.

Encode the digest as lowercase hexadecimal and take its first three characters. The salt and indices are fixed at `lib/mimicry/system-prompt.mjs:5-6`; character fallback, concatenation order, SHA-256, hex encoding, and truncation are implemented at `lib/mimicry/system-prompt.mjs:93-97`. Billing composition is at `lib/mimicry/system-prompt.mjs:134-159`, and the three-lowercase-hex conformance constraint is at `test/conformance/regression.test.mjs:1231-1248`.

Verified known-answer vector: first user text `offline cch probe` with CLI version `2.1.195` yields fingerprint `7fe`. Therefore the exact billing line is:

`x-anthropic-billing-header: cc_version=2.1.195.7fe; cc_entrypoint=cli; cch=00000;`

This vector is locked by `test/fingerprint.test.ts`; complete line composition is locked by `test/system-prompt.test.ts`.

## cch is static

`lib/mimicry/system-prompt.mjs:145-148` emits the static body-field marker `cch=00000;` for supported first-party providers, and `index.mjs:3141-3146` explicitly preserves that marker because mutating the first system block would invalidate prompt caching.

The `index.mjs:5569` comment claiming cch attestation was “RE-ENABLED” is **STALE**. Lines 5569-5572 describe the compiled Bun binary's separate attestation-header mechanism, not this request-body system field. `_xxh64Raw` is declared at `index.mjs:5575` and assigned at `index.mjs:5577`; repository search finds no executable read of it (the other textual occurrences are documentation examples). Therefore xxHash **MUST NOT** be ported. Lock this exclusion in `test/system-prompt.test.ts` and `test/security/core-adversarial.test.ts`.

## Environment-dependent inputs (must become injected inputs)

`buildAnthropicBillingHeader` reads ambient state at `lib/mimicry/system-prompt.mjs:134-159`. The runtime-neutral package must instead accept these explicit inputs:

| Upstream ambient/parameter                              | Injected contract    | Rule                                                                                          | Future package test                      |
| ------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `process.env.CLAUDE_CODE_ATTRIBUTION_HEADER`            | `attributionEnabled` | A falsy value suppresses the whole billing header.                                            | `test/system-prompt.test.ts`             |
| `process.env.CLAUDE_CODE_ENTRYPOINT`                    | `entrypoint`         | Default to `cli`.                                                                             | `test/profile.test.ts`                   |
| `process.env.CLAUDE_CODE_WORKLOAD` / `workloadOverride` | `workload`           | Explicit override wins; a nonempty permitted value appends `cc_workload=` after sanitization. | `test/security/core-adversarial.test.ts` |
| `provider` parameter                                    | `provider`           | `bedrock`, `anthropicAws`, and `mantle` suppress **both** cch and workload.                   | `test/build-request.test.ts`             |

`buildExtendedUserAgent` at `lib/request-headers.mjs:288-295` reads three further ambient values,
which the package must also receive explicitly:

| Upstream ambient                          | Injected contract   | Rule                                                                  | Future package test    |
| ----------------------------------------- | ------------------- | --------------------------------------------------------------------- | ---------------------- |
| `process.env.CLAUDE_CODE_ENTRYPOINT`      | `entrypoint`        | Same value as the billing entrypoint; default `cli`.                  | `test/headers.test.ts` |
| `process.env.CLAUDE_AGENT_SDK_VERSION`    | `agentSdkVersion`   | When present, appends `, agent-sdk/<version>` inside the parentheses. | `test/headers.test.ts` |
| `process.env.CLAUDE_AGENT_SDK_CLIENT_APP` | `agentSdkClientApp` | When present, appends `, client-app/<app>` inside the parentheses.    | `test/headers.test.ts` |

The pinned stable combination proven by a live HTTP 200 is: attribution enabled, entrypoint `cli`,
no workload, provider `anthropic`, and neither Agent SDK suffix — yielding exactly
`claude-cli/2.1.195 (external, cli)`. It is the default profile in `test/profile.test.ts`. This
document records that prior validation; generating this trace performs no network request.

> **Ledger L8.** Because plan §3.3's frozen `ClaudeCodeRequestInput` has no field for any of the
> seven ambient values above, Phase 1 must either (a) pin them all as profile constants at their
> proven values and reject any attempt to vary them, or (b) add explicit optional readonly inputs
> via a contracts commit plus a recorded additive design amendment, as §3.3 permits. The package
> must never consult `process` or any other ambient source. Option (a) is the default for v0.1.0:
> it is the minimum surface that reproduces the verified HTTP 200 request.

## Context hint

`context_hint` **MUST default to DISABLED**. When enabled, the upstream body transform pairs beta `context-hint-2026-04-09` with `context_hint: {enabled:true}` (`lib/mimicry/request-body.mjs:588-595`). A live request with that beta was rejected with HTTP 400: `Unexpected value(s) ... for the anthropic-beta header`. The same request with context hint disabled returned HTTP 200. Lock the disabled profile default in `test/profile.test.ts`, beta omission in `test/betas.test.ts`, and body omission in `test/request-body.test.ts`.

The header side is now fully traced, so the disabled default no longer rests on the live result
alone:

| Behavior              | Upstream file                          |     Lines | Rule (concise)                                                                                                                                                        | Future package test         |
| --------------------- | -------------------------------------- | --------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Flag registration     | `lib/request-headers.mjs`              |       185 | `context-hint-2026-04-09` is a member of the opt-in `EXPERIMENTAL_BETA_FLAGS` registry.                                                                               | `test/betas.test.ts`        |
| Beta emission         | `lib/mimicry/headers.mjs`              |   269-282 | The flag is pushed onto the beta list only behind the context-hint gate.                                                                                              | `test/betas.test.ts`        |
| Body pairing          | `lib/mimicry/request-body.mjs`         |   588-595 | When the beta header contains the flag and the body lacks `context_hint`, inject `context_hint: {enabled:true}`.                                                      | `test/request-body.test.ts` |
| Default-path omission | `index.test.mjs`                       | 3212-3226 | Upstream's request test asserts the flag is **not** sent on its tested default path, citing the partial server rollout from v2.1.110+.                                | `test/betas.test.ts`        |
| 400 latch-and-retry   | `index.mjs`                            | 3004-3005 | On rejection the flag is deleted from both the merged set and the beta latch state, then the request is retried without it.                                           | `test/betas.test.ts`        |
| Rejection contract    | `test/conformance/regression.test.mjs` |   500-541 | Locks the sequence: first request carries the flag, the server returns 400 `Unexpected value "context-hint-2026-04-09" in anthropic-beta header`, the retry omits it. | `test/betas.test.ts`        |

### Governance ledger L9 — context-hint default divergence

Upstream's own `context_hint` configuration option defaults to `true` (`lib/config.mjs:222`).
Upstream also implements a runtime latch: when the server rejects the beta with HTTP 400, it
deletes `context-hint-2026-04-09` from both the merged beta set and the latch state, then retries
without it (`index.mjs:3004-3005`). The complete 400-then-retry sequence is locked by
`test/conformance/regression.test.mjs:500-541`.

This package instead pins `ClaudeCodeProtocolProfile.contextHintEnabled` to `false` as a static
profile constant. Neither `defaultCapabilities` nor a `contextHint` capability exists: the former
was removed from `ClaudeCodeProtocolProfile`, and the latter was never part of
`ClaudeCodeCapabilities`, whose nine booleans are `thinking`, `adaptiveThinking`,
`interleavedThinking`, `effort`, `maxEffort`, `xhighEffort`, `contextManagement`, `temperature`
and `rejectsDisabledThinking`.

The runtime-neutral core performs no transport, so it cannot observe a 400 and cannot implement
the runtime latch. Retry and latching are the consumer's responsibility. Consumers opt in through
`profileOverride.contextHintEnabled` on `ClaudeCodeRequestInput`; there is no capability-level
opt-in.

**Consequence:** for plugin users on accounts where the beta **is** enabled, migrating the plugin
onto this package changes observable behavior: context hint stops being sent by default. The Wave
6 wire-parity review **MUST** address this divergence.

## Package extension seams

Everything else in this document is a **protocol fact**: a behaviour read out of the genuine client
and reproduced here. This section is the opposite, and the distinction matters, because a reader
mining this file for fidelity evidence must never mistake a consumer convenience for observed
Claude Code behaviour.

The six fields below are **consumer seams invented by this package**. No byte offset, upstream
file or live capture supports them, and none of them has an upstream counterpart to drift against.
They exist so a downstream consumer can express host state this package deliberately refuses to
observe, without forking the composer.

| Field                                | Kind          | Upstream counterpart                                                   | Default when omitted                            |
| ------------------------------------ | ------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `additionalBetas`                    | Consumer seam | **None.** Upstream derives the beta set from profile and model only.   | No entries appended; emitted request unchanged. |
| `suppressBetas`                      | Consumer seam | **None.** Upstream never removes a beta it just composed.              | No entries removed; emitted request unchanged.  |
| `betaOverrides.use1MContext`         | Consumer seam | Partial: replaces the `[1m]` model-marker gate, not the profile gate.  | The `[1m]` marker decides, as before.           |
| `cacheControl.suppressIdentityBlock` | Consumer seam | **None.** Upstream always marks the identity block.                    | Marker emitted exactly as before.               |
| `metadataOverrides`                  | Consumer seam | **None.** Upstream always derives `user_id` from the identity triple.  | Derived `user_id` emitted exactly as before.    |
| `extraHeaderPolicy`                  | Consumer seam | **None.** Upstream composes its own headers and merges no foreign map. | `strict`: collisions throw, exactly as before.  |

### Governance ledger L10 — consumer seams are not protocol facts

**Claim.** `ClaudeCodeRequestInput.additionalBetas`, `ClaudeCodeRequestInput.betaOverrides` and
`ClaudeCodeCacheControlInput.suppressIdentityBlock` are extensions of THIS package. They are **not**
observed Claude Code behaviour and must not be cited as wire-fidelity evidence, ported upstream
reasoning, or grounds for changing any pinned default.

**Why they exist.** The runtime-neutral core observes no environment, so it cannot see the host
state upstream reads: the user's configured beta list, the per-request 1M-context decision, or a
cache mode that emits no marker. Without these seams a consumer must either fork beta composition
or drop user-visible features.

**Additivity is the contract.** Each seam is a no-op when omitted, and that is enforced, not
asserted: `test/validation/seam-additivity.test.ts` builds the same request with and without each
field and compares `body` byte for byte, plus `headers` and `evidence` in full. Any diff on the
omitted path is a breaking change, not a seam.

- `additionalBetas` is appended AFTER the upstream-derived set, so the canonical prefix keeps its
  emergent order (see "Beta registry and push order"). Entries duplicating an already-emitted
  identifier are dropped rather than reordering that prefix. Because `anthropic-beta` is one
  comma-joined field, entries are restricted to `/^[A-Za-z0-9][A-Za-z0-9._-]*$/`, ≤128 characters,
  ≤32 entries; the header grammar and the dedup/order invariants are fuzzed in
  `test/property/request-invariants.test.ts` and attacked in `test/security/seam-injection.test.ts`.
  Locked by `test/validation/additional-betas.test.ts`.
- `betaOverrides.use1MContext` replaces ONLY the `[1m]` model-marker gate. The profile gate
  `betaPolicy.oneMillionContextEnabled` still applies, so a consumer cannot force a beta the pinned
  profile declares unavailable. It is a top-level field rather than a tenth `ClaudeCodeCapabilities`
  key on purpose: capabilities are model-derived and cross-checked against `resolveModel()`, this
  gate is host state with no catalogue entry, and a tenth MANDATORY key in
  `evidence.capabilityDecisions` would change the evidence of every request and break additivity.
  The decision is recorded as an OPTIONAL `capabilityDecisions.use1MContext`, present only when the
  caller supplied it. Locked by `test/validation/beta-overrides-1m.test.ts`.
- `cacheControl.suppressIdentityBlock` is the only way to emit the identity block with no
  `cache_control`. Default `false` reproduces the unconditional marker — the hardcoded `1h` when
  `cacheControl` is absent, and the `applySystemCacheControl` overwrite when it is present. It never
  touches the billing block (index 0) or the canonical block count. Locked by
  `test/validation/suppress-identity-cache.test.ts`.

**Consequence.** These fields do not participate in drift detection, because there is no upstream
site to drift from. A future wire-parity review must treat them as this package's own surface: they
may be removed or renamed on their own schedule, and a live capture that lacks them is not evidence
of a defect.

### Governance ledger L11 — `metadataOverrides` is a package extension, not a relaxed guard

**Claim.** `ClaudeCodeRequestInput.metadataOverrides` is an extension of THIS package. It is **not**
observed Claude Code behaviour and must not be cited as wire-fidelity evidence. The genuine client
emits `metadata.user_id` as the JSON encoding of `{device_id, account_uuid, session_id}` and nothing
else; every value this seam can produce that differs from that encoding is this package's own
surface.

**Why it exists.** The correlation guard in `buildCorrelatedMetadata` rejects a supplied
`metadata.user_id` that diverges from the derived value with `INVALID_INPUT`. That guard is correct
and stays on by default: a silently decorrelated `user_id` is exactly the fingerprint break this
package exists to prevent. But a consumer host can legitimately carry identity state the
runtime-neutral core cannot observe, and without a seam the only options were forking metadata
composition or dropping the feature.

**Two mechanisms, one field, two members.** The consumer surveyed for this seam
(`opencode-anthropic-fix`) exposes two environment-driven behaviours that are structurally
different, so the seam carries two members rather than one:

- `metadataOverrides.userId` replaces the emitted `user_id` VERBATIM, for a host that carries an
  opaque identifier of its own. The package makes no correlation claim about the result.
- `metadataOverrides.userIdFields` keeps the derived object and adds members to it. The caller's
  members are written FIRST and the correlation triple LAST, so `device_id`, `account_uuid` and
  `session_id` always win. Supplying one of those three keys fails with `INVALID_INPUT` instead of
  being silently overwritten, because a discarded value that looks honoured is worse than a
  rejection.

The two members are **mutually exclusive**. They express opposite intents — abandon the derived
value versus extend it — so supplying both fails rather than resolving the ambiguity silently.

**Opt-in, never a default relaxation.** With the field omitted, the divergence guard behaves exactly
as before: `test/validation/metadata-overrides.test.ts` asserts the unchanged `INVALID_INPUT`
rejection on the no-seam path. When the seam IS supplied, the guard is not removed — it is
re-pointed: a supplied `metadata.user_id` must equal the seam-resolved value, and `device_id`,
`account_uuid` and `session_id` supplied at the `metadata` level remain pinned to the runtime
identity.

**Additivity.** The seam is a no-op when omitted, and that is enforced, not asserted:
`test/validation/seam-additivity.test.ts` covers `metadataOverrides` omitted versus `{}` and versus
`{userIdFields: {}}`, comparing `body` byte for byte plus `headers` and `evidence` in full. Evidence
gains no key: unlike `betaOverrides.use1MContext`, this seam records no decision in
`RedactedRequestEvidence`, so evidence for every request is unchanged.

**Known consequence.** A request built with `metadataOverrides.userId` is REJECTED by
`parseBuiltClaudeCodeRequest`. The parser proves that `metadata.user_id` is JSON carrying the same
`session_id` as the `x-claude-code-session-id` header; an opaque replacement makes that unprovable.
Relaxing the parser would weaken the invariant for every caller, so the parser stays strict and the
consequence is documented here and locked by a test. `metadataOverrides.userIdFields` round-trips
normally, because the correlation triple survives.

**Not a drift surface.** Like L10, this field has no upstream site to drift from. A live capture
that lacks it is not evidence of a defect.

### Governance ledger L12 — one defect fix and one package extension, deliberately separated

This entry covers two changes that shipped together and must **never** be conflated. One is a
correctness fix to header handling that would be right even with no consumer at all; the other is a
seam of this package's own invention.

#### Part A — the hop-by-hop and entity header denylist is a DEFECT FIX

**Claim.** `isForbiddenHeader` now also rejects `content-length`, `host`, `connection`,
`transfer-encoding`, `te`, `upgrade` and `keep-alive` in `extraHeaders`. This is a **bug fix**, not a
consumer convenience, and it is valid independently of any consumer.

**The defect.** Before this change none of those names was canonical or forbidden, so all of them
**passed through** to the wire. `content-length` is the dangerous one. This package does not forward
a caller's body: it **reconstructs the body canonically**, so its byte length is a function of the
canonicalised JSON, not of whatever the caller was holding. A consumer that maps an inbound
`Request`'s header map onto `extraHeaders` — the normal way to bridge a host request into this
package — therefore emits a `content-length` describing a **different byte string**. Nothing local
fails: no exception, no evidence anomaly, no failing test. The peer either truncates the body at the
declared length or waits for bytes that never arrive. A silent corruption with a plausible-looking
request is the worst possible failure mode, which is why this is classified as a defect rather than
hardening.

**The rest of the set.** `connection`, `transfer-encoding`, `te`, `upgrade` and `keep-alive` are
hop-by-hop headers under RFC 9110 §7.6.1: they govern a single connection and belong to the
transport, not to an application-level caller. `host` is derived from the pinned endpoint. Forwarding
any of them from an inbound request is meaningless at best and connection-breaking at worst.

**Blast radius.** This is the one part of the change that is **not** additive: a caller that used to
pass one of the seven names now gets `FORBIDDEN_HEADER` instead of a corrupt request. That trade is
deliberate. It converts a silent wire-level corruption into a loud, local, immediate rejection.

#### Part B — `extraHeaderPolicy` is a PACKAGE EXTENSION

**Claim.** `ClaudeCodeRequestInput.extraHeaderPolicy` is an extension of THIS package. It is **not**
observed Claude Code behaviour and must not be cited as wire-fidelity evidence. The genuine client
composes its own header set from profile and runtime state; it never merges a foreign header map, so
upstream has no policy to observe and nothing to drift against.

**Why it exists.** A consumer that receives a `Request` from a host and bridges it into this package
holds a heterogeneous header map it did not author. Under the pre-existing behaviour a single
inbound `anthropic-beta` — a header the host may attach for entirely unrelated reasons — aborts the
whole request with `DUPLICATE_HEADER`. The consumer's only recourses were to hand-maintain a copy of
this package's canonical name list, which guarantees drift, or to drop the header map entirely,
which loses legitimate custom headers.

**Two policies.**

- `strict` is the default and is the pre-existing behaviour **byte for byte**: `DUPLICATE_HEADER`
  for a canonical name, `FORBIDDEN_HEADER` for a denylisted one.
- `dropConflicting` discards the offending pair instead of throwing, and records its lowercased name
  in `evidence.droppedExtraHeaderNames`, in caller order. The consumer forwards the whole map and
  audits what fell, rather than guessing.

**What `dropConflicting` deliberately does NOT relax.**

- **Header syntax is never relaxed.** `assertHeaderText` runs FIRST, before any drop decision, in
  both policies. A control character in a name or a value raises `HEADER_INJECTION` regardless of
  policy. Header smuggling is never silently tolerated — a "drop the bad header" policy that
  swallowed an injection attempt would turn an attack into a no-op the caller never learns about.
- **A caller duplicating its OWN extra header still throws `DUPLICATE_HEADER`** in both policies.
  That collision is a caller bug, not a conflict with a header this package owns, and this package
  has no basis for choosing which of the caller's two values wins.

**Additivity, evidence included.** The seam is a no-op when omitted, enforced by
`test/validation/seam-additivity.test.ts`, which compares `body` byte for byte plus `headers` and
`evidence` in full. `droppedExtraHeaderNames` is emitted **only** under `dropConflicting`; under
`strict`, and for every request built before the seam existed, the key is **absent** rather than
present-and-empty, so existing evidence stays byte-identical. `parseBuiltClaudeCodeRequest` preserves
the key when present and never synthesises it, exactly like the optional
`capabilityDecisions.use1MContext`. Dropped names are credential-screened in `redaction.ts` on the
same terms as the header names that did reach the wire.

**Design decision: `extraHeaderPolicy` is absent from `src/request-body.ts` ON PURPOSE.** It is
**not** an oversight, and the asymmetry with `betaOverrides` is intentional. `betaOverrides` appears
in both `src/build-request.ts` and `src/request-body.ts` because it is carried on the normalized
request that feeds body composition and evidence. `extraHeaderPolicy` is a **header-layer** field: it
is consumed by `buildOrderedHeaderPlan` and by evidence assembly, and the canonical body carries no
trace of it. It therefore mirrors `extraHeaders`, which is likewise absent from `request-body.ts`.
Adding it to the body key set would imply the canonical body depends on it, which is false and would
invite a future reader to make it true.

**Not a drift surface.** Like L10 and L11, this field has no upstream site to drift from. Part A, by
contrast, is not a seam at all: it is the correct behaviour of `extraHeaders`, and a live capture is
irrelevant to it.

### Governance ledger L13 — two defect fixes found by the first real consumer

Neither item here is a seam. Both are **defects** in this package, found when the consumer
(`opencode-anthropic-fix`) pointed its production call site at the adapter for the first time and 33
of 135 failures were `INVALID_UNICODE` on legitimate user content.

#### Part A — a HEADER rule was applied to the BODY

**The defect.** `inspectString` in `src/build-request.ts` rejected every code unit `<= 0x1F` and
`0x7F`. That set includes TAB (0x09), LF (0x0A) and CR (0x0D). `inspectString` runs over the WHOLE
caller input graph, which is overwhelmingly body content, so **any** message or system block
containing a line break was refused with `INVALID_UNICODE`. No real prompt is a single line, so the
package was unusable for real traffic.

**Why it survived 14 release candidates.** Every one of the 1784 tests and all three golden fixtures
used single-line text. The rule was never wrong in any test, because no test ever contained a
newline. That is the real lesson of L13, and it is why the regression tests matter more than the
one-line fix: `test/validation/multiline-content.test.ts` now pins realistic multi-line prompts with
blank lines and tabs, on both the messages path and the count-tokens path.

**The rule now.**

- **BODY** (message content, system text, tool names and descriptions, values inside the body JSON):
  TAB, LF and CR are ALLOWED. `JSON.stringify` escapes them, so no raw control character reaches the
  wire — this is asserted, not assumed. Every other C0 control (0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F)
  and DEL (0x7F) stay rejected.
- **HEADERS**: **unchanged.** `assertHeaderText` in `src/headers.ts` still rejects every control
  character, TAB, LF and CR included, because a bare LF in a header is request smuggling. The
  `extraHeaders` path is untouched. What changed is only WHICH layer refuses a header carrying CRLF:
  the input-graph screen used to catch it first as `INVALID_UNICODE`, and now `assertHeaderText`
  catches it as `HEADER_INJECTION`. The refusal is the same; the code is more precise about why.
- **METADATA**: **unchanged.** `src/metadata.ts` stays strict. `user_id` and metadata keys are
  identifiers that travel as JSON inside a header, not prose.
- **LONE SURROGATES**: still rejected in every context, deliberately. `TextEncoder` silently
  replaces an unpaired surrogate with U+FFFD, which would corrupt the body — and the body hash
  recorded in evidence — with no error raised anywhere.

`src/system-prompt.ts` and `src/request-body.ts` already permitted TAB, LF and CR before this change;
they needed no edit. `src/redaction.ts` never carried a control-character rule. The duplication that
looked like five copies of one rule was in fact one over-broad copy and four correct ones.

**Existing tests that encoded the defect were CORRECTED, not deleted.**
`test/security/core-adversarial.test.ts` asserted that CRLF is rejected in every string-bearing
position, body included; it now asserts rejection for the positions that reach a header, an identity
field or a metadata identifier, and acceptance for body content. `test/security/seam-injection.test.ts`
and `test/validation/headers-contract-expansion.test.ts` had their expected error codes moved from
`INVALID_UNICODE` to the code of the layer that now refuses the value. In every case the input is
still refused; only the layer and the code changed.

**No golden fixture was added.** `test/fixtures/golden/` is capture-derived ground truth: its
`manifest.json` pins a `sourceCommit` and a SHA-256 per file, and each file records what the genuine
client was OBSERVED to send. No capture of the real client sending a multi-line prompt was available,
and hand-authoring one would manufacture wire evidence indistinguishable from a real capture. The
equivalent protection is a hand-written canonical-body assertion in
`test/validation/multiline-content.test.ts` ("golden-equivalent"), which pins the emitted body for a
fixed multi-line input and proves the evidence digest is self-consistent.

#### Part B — `suppressIdentityBlock` could not be used

**The defect.** In `src/request-body.ts`, `applyToolCacheControl` and `applyMessageCacheControl`
stripped every caller-supplied `cache_control` as their FIRST act, unconditionally, and only then
consulted `enabled` / `toolBreakpoint` / `messageBreakpoint` to decide whether to put a breakpoint
back. The call site invokes both whenever `cacheControl` is present at all.

Consequence: `cacheControl: { suppressIdentityBlock: true }` — the S3 seam on its own — deleted every
`cache_control` the caller had placed on its tools and message blocks and restored nothing. The seam
could not serve the use case it was created for (L10). Any other lone member of
`ClaudeCodeCacheControlInput` was equally destructive.

**The fix.** The strip is now gated exactly like the re-add: it runs only when `enabled === true`.
When caching IS enabled the caller's own breakpoints are still normalised away, because this package
owns breakpoint placement in that mode and two competing breakpoint sets cannot both be honoured.
`applySystemCacheControl` was not touched: caller system blocks arrive as plain strings and carry no
`cache_control` to lose.

The alternative — skipping both functions at the call site when `suppressIdentityBlock` is the only
populated field — was rejected. It would make behaviour depend on which OTHER fields happen to be
present, so adding a field to the input later would silently change the outcome. Gating each function
on its own flag is local and predictable.

**Behaviour change.** A caller that passes `cacheControl` with `enabled` absent or `false` and relies
on the strip now keeps its own `cache_control`. That is recorded in the CHANGELOG under `### Fixed`,
following the precedent set by the rc.14 hop-by-hop denylist. Locked by
`test/validation/cache-control-strip.test.ts`.

### Governance ledger L14 — `suppressBetas`, the removal counterpart of `additionalBetas`

**Claim.** `ClaudeCodeRequestInput.suppressBetas` is an extension of THIS package, exactly like the
L10 seams. It is **not** observed Claude Code behaviour: the genuine client never removes a beta it
just composed, because its composition inputs and its user configuration are the same host state.

**Why it exists.** This package composes `anthropic-beta` on its own, from the pinned profile and
the model capabilities, and until now that composition was write-only from the consumer's side.
`additionalBetas` could only ADD. The first real consumer (`opencode-anthropic-fix`) exposes user
switches whose entire meaning is removal, and each one silently became a no-op:

- `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` has to drop `context-management-2025-06-27`,
  `interleaved-thinking-2025-05-14` and `prompt-caching-scope-2026-01-05`.
- The round-robin account strategy has to drop `prompt-caching-scope-2026-01-05`, because a cache
  scope pinned across rotating accounts is worse than no scope at all.

Without this seam the consumer's only options were forking beta composition or shipping switches
that do nothing — a silent no-op is the worst of the three, because the user believes the switch
worked.

**Semantics.**

- The filter runs **LAST**: after the canonical composition and after the `additionalBetas` merge.
  Suppression therefore beats addition — an identifier named by both seams does **not** reach the
  wire. Composing then filtering (rather than gating composition) keeps the emergent canonical order
  of the survivors intact, which a gate-level change would not.
- An identifier that is not in the composed set is a **silent no-op, not an error**. The consumer
  cannot know which betas this package derives for a given model, so demanding precision would make
  the seam unusable: the same switch has to work across models whose capability-gated sets differ.
- Entry grammar is `validateAdditionalBetas` verbatim — `/^[A-Za-z0-9][A-Za-z0-9._-]*$/`, ≤128
  characters, ≤32 entries, `INVALID_INPUT` otherwise. One comma-joined header field, one grammar.
- `evidence.suppressedBetaNames` records only the identifiers that were **actually present and
  removed**, in the order the composed set held them, never in caller order. The key is emitted only
  when at least one identifier was removed; when the seam is omitted, empty, or matches nothing, the
  key is **ABSENT** rather than present and empty. That is the `droppedExtraHeaderNames` precedent
  from rc.14, and it is what keeps evidence byte-identical for every request that ignores the seam.
  Suppressed names never reach the wire, but they do land in evidence, so they get the same
  credential screening as the features that did.

**NOT guarded, deliberately.** There is no protected-beta list. Suppressing `oauth-2025-04-20`
produces a request the API rejects with **401**; suppressing `claude-code-20250219` changes how the
request is classified upstream. This package composes the wire faithfully and refuses to be the
consumer's babysitter: a guard here would be a second, undocumented policy layer that silently
disagrees with the caller and could not be turned off. The consumer owns the switch semantics; this
seam owns only the mechanics.

**Additivity is the contract**, enforced the same way as L10:
`test/validation/seam-additivity.test.ts` builds the same request with and without `suppressBetas`
in its no-op forms (omitted vs `[]`, and omitted vs a list that matches nothing) and compares `body`
byte for byte plus `headers` and `evidence` in full. Locked by
`test/validation/suppress-betas.test.ts`.

**Still out of scope.** These seams do not open the door to multi-provider support. The package
models the wire of the official Claude Code client talking to `api.anthropic.com`; `provider`
remains pinned to `anthropic` and Bedrock, Vertex, Foundry and Mantle stay permanently out of
scope.

### Governance ledger L15 — `suppressBillingBlock`, and the parser's structural prefix discriminator

**Claim.** `ClaudeCodeRequestInput.suppressBillingBlock` is an extension of THIS package, exactly
like the L10 and L14 seams. It is **not** observed Claude Code behaviour: the genuine client always
emits the billing block.

**Why it exists.** Until now this package composed the canonical billing block at `system[0]`
unconditionally. The first real consumer (`opencode-anthropic-fix`) exposes
`CLAUDE_CODE_ATTRIBUTION_HEADER=0`, a user switch whose entire meaning is "do not send the billing
block". With no seam, that switch was a silent no-op — the worst outcome, because the user believes
it worked. This is the same failure mode L14 documents for the removal-shaped beta switches.

**Semantics.**

- Absent or `false`, the canonical prefix is `[billing, identity]` and every byte of the request is
  what it was before the seam existed. `true` emits `[identity]` alone.
- Only a boolean is accepted. `validateSuppressBillingBlock` rejects a truthy string or `0` with
  `INVALID_INPUT` rather than coercing, because coercion would silently change what Anthropic
  receives.
- `evidence.billingBlockSuppressed` is emitted **only when the block was actually removed**, never
  as `false`. That is the `droppedExtraHeaderNames` / `suppressedBetaNames` precedent from rc.14 and
  rc.15, and it keeps evidence byte-identical for every request that ignores the seam.
- `evidence.systemBlockCount` continues to count only the CALLER's emitted blocks. The canonical
  prefix subtracted is one slot per canonical block that actually survived — see L16, which removed
  the constants `CANONICAL_SYSTEM_BLOCKS` and `CANONICAL_SYSTEM_BLOCKS_WITHOUT_BILLING` in favour of
  symmetric arithmetic over both suppression seams.

**The parser discriminator changed from arithmetic to structural recognition — twice.**
`parseBuiltClaudeCodeRequest` receives only `{url, method, headers, body, evidence}`, so the INPUT
flag is never on the wire. rc.16 replaced the constant `CANONICAL_SYSTEM_BLOCKS` — ambiguous once a
one-block prefix became legitimate — with a POSITION probe over the byte-exact `IDENTITY_TEXT`: at
`system[1]` the prefix is 2, at `system[0]` the prefix is 1, at neither position the parser refuses.

**That position probe was superseded in rc.17 (L16) and no longer exists.** Two independent seams
make `[]` a legitimate prefix, and an empty prefix is indistinguishable from a caller-only array by
inspection alone, so the probe's failure path would have fired on every request built with both
seams. The prefix length is now READ from `evidence.billingBlockSuppressed` and
`evidence.identityBlockSuppressed` and then VERIFIED block by block. The rc.16 probe was also
weaker than it looked: it never inspected the billing slot at all, so an envelope built with
`suppressBillingBlock` whose evidence hid that fact was accepted.

What survives from rc.16 unchanged: the match is on **TEXT, never on `cache_control`**. The L10
`cacheControl.suppressIdentityBlock` seam can emit the identity block with no cache marker, so a
marker-based probe would misread a legitimate request as a forgery. The assertion also stays an
**EQUALITY** (`systemBlockCount === system.length - prefix`), not an inequality: an envelope whose
caller-block count merely "fits" is still a forgery.

Byte-length ordering matters when testing this. `bodyByteLength` is checked before the prefix
discriminator, so the negative test forges a **length-preserving** system array; a shorter forgery
would be rejected earlier and would prove nothing about the discriminator.

**The attribution consequence is the consumer's, and it is deliberate.** Suppressing the billing
block changes what Anthropic sees for attribution purposes. This package does not judge that: it
composes the wire faithfully and refuses to be the consumer's babysitter, exactly as L14 states for
suppressing `oauth-2025-04-20`. The consumer owns the switch semantics; this seam owns only the
mechanics. There is no guard, and a guard here would be a second, undocumented policy layer that
silently disagrees with the caller.

**Additivity is the contract**, enforced as in L10 and L14, and locked by
`test/validation/suppress-billing-block.test.ts`.

### Governance ledger L15 (A) — `evidence.systemBlockCount` counts EMITTED blocks

**Confirmed production defect, not a refactor.** `systemBlockCount` was the raw length of the
caller's `system` array, but `buildCanonicalSystem` **merges adjacent caller blocks that carry the
same `cache_control`** and drops any block equal to the identity text. The emitted array was
therefore routinely shorter than the caller's, while the parser asserted
`systemBlockCount === body.system.length - <canonical>`.

Consequence: any request with two or more mergeable caller system blocks was rejected by
`parseBuiltClaudeCodeRequest` with an opaque `INVALID_INPUT` and `safeDetails: {}`. The only
consumer of the parser is a proxy validating envelopes emitted by a Worker, so this would have
produced a 403 in production with no diagnosable cause.

The fix records `emittedSystemBlockCount` — the length of the array actually serialized — and the
build path subtracts the canonical prefix from that. Locked by the block-merging test committed
alongside the fix.

### Governance ledger L16 — root `suppressIdentityBlock`, and evidence-driven prefix verification

**Claim.** `ClaudeCodeRequestInput.suppressIdentityBlock` is an extension of THIS package, exactly
like the L10, L14 and L15 seams. It is **not** observed Claude Code behaviour: the genuine client
always emits the identity block.

**Why it exists.** The first real consumer's plugin exposes `token_economy.lean_system_non_main`, a
user switch that removed BOTH canonical blocks by simply not composing them. Migrating that call
site onto this package turned the switch into a silent no-op for the identity half — the same
failure mode L14 and L15 document. The approved criterion is explicit: **a user configuration
switch becoming a silent no-op is unacceptable; the package grows a seam.**

**It is a DIFFERENT field from `cacheControl.suppressIdentityBlock` (L10).** The L10 field keeps the
identity block and emits it WITHOUT its `cache_control` marker; this one removes the block. The name
collision was accepted deliberately: symmetry with `suppressBillingBlock` at the root was judged
worth more than inventing a distinct name. The mitigation is documentation, and it is mandatory —
the JSDoc of each field states what it does and names the other by its full path
(`cacheControl.suppressIdentityBlock` vs root `suppressIdentityBlock`).

**Semantics.**

- Absent or `false`, every byte of the request is what it was before the seam existed.
- Only a boolean is accepted; `validateSuppressIdentityBlock` refuses to coerce, as L15 does.
- With `suppressBillingBlock`, four canonical prefixes are legitimate: `[billing, identity]`,
  `[identity]`, `[billing]` and `[]`. With both active and no caller blocks the emitted body carries
  `"system":[]` — the key is present and the array empty, which round-trips through the parser.
- `evidence.identityBlockSuppressed` is emitted **only when the block was actually removed**, never
  as `false`, mirroring `billingBlockSuppressed`. It must also be added to `EVIDENCE_KEYS`:
  `parseEvidence` asserts exact keys, so an unregistered key makes every such envelope unparseable.
- The caller-block drop stays **unconditional**. A caller block byte-equal to the identity text is
  dropped even when the canonical one was suppressed — matching the genuine client, and a
  precondition for the absence check below.

**The parser now READS the prefix length from evidence and VERIFIES it, rather than inferring it.**
No probe over the array alone can separate the four states, because an empty canonical prefix looks
exactly like a caller-only array. `canonicalSystemPrefixLength` therefore takes both evidence flags
and confirms every canonical block those flags imply:

- billing by its fixed, self-describing head `x-anthropic-billing-header: cc_version=` — the tail
  carries a per-request fingerprint, so only the head can anchor a structural check;
- identity by the byte-exact `IDENTITY_TEXT`.

This is **strictly stronger** than the rc.16 position probe, which asserted only that identity sat
at one of two indices and never inspected the billing slot.

**Verification is asymmetric, and the asymmetry is the point.** A claim of identity suppression is
refuted by finding `IDENTITY_TEXT` **anywhere** in the emitted array: `buildCanonicalSystem` drops
caller blocks equal to it unconditionally, and merges runs with `\n`, so no legitimate suppressed
body can contain that exact text. Without this the forgery is undetectable — evidence claiming
suppression over a body that still carries the block passes both the positional check (skipped) and
the arithmetic (self-consistent). There is deliberately **no mirror check for billing**: a caller
block may legitimately begin with the billing header text, so its presence proves nothing and a
symmetric rule would reject honest requests.

**Reading evidence is not trusting evidence.** The flags select which blocks must be confirmed; they
never substitute for confirmation. Every negative case in
`test/validation/suppress-identity-block.test.ts` forges evidence that is **self-consistent** —
`systemBlockCount` adjusted to the length the forged prefix implies — so only the structural check
can reject it. Body forgeries stay **byte-length preserving**, because `bodyByteLength` is checked
before the prefix verification and a shorter forgery would be rejected earlier, proving nothing.

**Additivity is the contract**, enforced as in L10, L14 and L15, and locked by
`test/validation/suppress-identity-block.test.ts`.

### Governance ledger L17 — `preserveThinkingBlockCacheControl`, a seam forced by a real API 400

**Claim.** `ClaudeCodeRequestInput.preserveThinkingBlockCacheControl` is an extension of THIS
package, exactly like the L10, L14, L15 and L16 seams. It is **not** observed Claude Code behaviour,
and **no wire capture was taken for it**: the strict thinking-block allowlist remains what the
binary shows, and this seam is a documented, opt-in departure from it.

**Why it exists.** The package pinned `thinking` to `{signature, thinking, type}` and
`redacted_thinking` to `{data, type}` and applied `assertExactKeys`, so any request carrying
`cache_control` on a reasoning block died with `INVALID_INPUT`. Unlike every earlier seam, the
consumer could not work around it, because the workaround is itself an error. The Anthropic API
answers a mutated reasoning block with:

> `400 ... thinking or redacted_thinking blocks in the latest assistant message cannot be modified.`
> `These blocks must remain as they were in the original response.`

`delete block.cache_control` IS a modification and triggers that 400. So the consumer's choice was a
400 from the API or an `INVALID_INPUT` from this package — a production failure either way. The
approved criterion applies unchanged: **when the consumer loses a capability to this package's
validation, the resolution is a seam in the package, never a degraded consumer.**

**Semantics.**

- Absent or `false`, every byte of the request is what it was before the seam existed, and
  `cache_control` on a reasoning block is still `INVALID_INPUT`.
- Only a boolean is accepted; `validatePreserveThinkingBlockCacheControl` refuses to coerce, as L15
  and L16 do.
- The allowlist grows by `cache_control` and by **nothing else**. `assertExactKeys` is not relaxed;
  it is handed a second, one-key-wider set. An unknown key on a reasoning block is still
  `INVALID_INPUT` with the seam active.
- The value is validated by the **existing** `cache_control` validator, not a parallel one:
  `{ type: "ephemeral" }` with an optional `ttl` of `5m` or `1h`. The `scope` key that `text` blocks
  tolerate for legacy reasons is **not** accepted here — the API never returns it on a reasoning
  block, and a seam that exists to round-trip the API's own bytes must not accept bytes the API
  never emits.
- Copying is **verbatim**: the caller's key order survives, because the validator rebuilds the
  record over `Object.keys` rather than a canonical template. No TTL is applied to the marker and no
  breakpoint is moved onto or off a reasoning block. `applySystemCacheControl` is untouched, and
  `applyMessageCacheControl` already exempted reasoning blocks from both its strip and its
  breakpoint pass, so passthrough required no change there.
- `cache_control: null` is preserved as `null`, exactly as on every other block type that accepts
  the key.
- The count-tokens path takes no seam: `canonicalCountTokensLists` calls the message validator with
  the strict allowlist.

**Evidence records what the seam DID, not what it was allowed to do.**
`evidence.thinkingBlockCacheControlPreserved` is emitted **only when the seam was active AND at
least one emitted block actually carried a marker**. A request that opts in and never uses the key
produces evidence byte-identical to one that never opted in — the same discipline as
`billingBlockSuppressed`. It must also be added to `EVIDENCE_KEYS`: `parseEvidence` asserts exact
keys, so an unregistered key makes every such envelope unparseable, and it must be **rehydrated**
there too, or a legal envelope silently loses the key and fails its own round-trip equality.

**Reading evidence is not trusting evidence.** `parseBuiltClaudeCodeRequest` confirms the claim
structurally: it scans the emitted `messages` for a `thinking` or `redacted_thinking` block that
actually carries a `cache_control` key, and refuses the envelope when the claim is unbacked.
Presence of the KEY is the test, not truthiness, so a preserved `null` marker still backs the claim.
The check runs **before** the byte-length and digest comparisons, deliberately: the forgery in
`test/validation/preserve-thinking-cache-control.test.ts` leaves the body completely untouched, so
`bodyByteLength`, `bodySha256`, `messageCount` and `systemBlockCount` all still agree, and only the
structural confirmation can reject it. Placing the check after the arithmetic would have let the
arithmetic take credit for a rejection it did not perform.

**Corpus discipline.** Two defects survived fourteen release candidates because the test corpus was
entirely single-line. The reasoning text exercised by this seam therefore embeds `\n`, `\t` and
CRLF, and is asserted byte-exact after a full build/parse round trip.

**Additivity is the contract**, enforced as in L10, L14, L15 and L16, and locked by
`test/validation/preserve-thinking-cache-control.test.ts`.

### Governance ledger L18 — the changelog date rule is conditional on the manifest version

**Claim.** This entry records a correction to a GOVERNANCE GATE, not to the wire contract. No
runtime behaviour, no request byte and no exported type changes. It is filed here because the gate
it corrects is what the ledger's own release discipline rests on.

**The old rule.** `test/governance/release-policy.test.ts` asserted, unconditionally, that the top
`## [...]` heading of `CHANGELOG.md` carries no `YYYY-MM-DD` date. The stated intent is legitimate:
at commit time the release has not happened, so its date is not yet a fact, and asserting one would
be asserting a prediction.

**Why it was wrong.** The intent holds only for a PRERELEASE heading, which is transient and
superseded within days. A stable heading is permanent, and nothing in the workflow ever fills the
date in afterwards. That is not a hypothesis — it is observed: `0.1.0-rc.16` and `0.1.0-rc.17` were
both published to npm and both sat at `- Unreleased` in this changelog until `0.1.0` corrected them
retroactively from `gh release view` timestamps. The rule that forbade the date at commit time is
the same rule that left seventeen entries with no mechanism to acquire one. Worse, applied to a
stable release it inverts: it would have PASSED a permanently undated `## [0.1.0]` heading.

**The new rule.** The assertion is conditional on `package.json` version:

- version CONTAINS a hyphen (prerelease) → the top heading MUST NOT carry a date. Unchanged.
- version has NO hyphen (stable) → the top heading MUST carry a `\d{4}-\d{2}-\d{2}` date.

**This is strictly stronger, not weaker.** The prerelease branch is byte-for-byte the previous
behaviour. The stable branch adds an assertion where the gate previously had none: an undated stable
heading now fails. No case that failed before passes now.

`releaseCandidateHeading()`'s regex is deliberately untouched — it selects the first heading in the
file, whatever its version, and the version discrimination belongs in the assertion rather than in
the selector. Locked by `test/governance/release-policy.test.ts`.

### Governance ledger L19 — the tarball ships `src`, and the allowlist is pinned in three places

**Claim.** Like L18, this entry records a PACKAGING change, not a wire-contract change. No runtime
behaviour, no request byte and no exported type changes. `npm run test:pack` proves it: the node,
bun and workerd consumer digests are byte-identical before and after
(`6b9609b29463c890544845dd94acf560206b6f8165538faafd8886750037d277`).

**Why it exists.** The build emits 40 `.js.map` and `.d.ts.map` files. Each one references
`../src/*.ts` and none carries `sourcesContent`, so every source map in the published tarball
pointed at a file the tarball did not contain. A consumer stepping into this package in a debugger
resolved to nothing. The two coherent fixes are to inline `sourcesContent` or to ship the sources;
for a GPL-3.0-or-later package whose `NOTICE` already carries a written offer of corresponding
source, shipping the sources makes the offer and the artifact agree, so `src` was added to the
`files` allowlist immediately after `dist`.

**What is packed.** `src` ships SOURCES ONLY. `test/pack/pack-policy.test.ts` asserts against the
real `npm pack --dry-run` manifest that every packed path under `src/` ends in `.ts`, that
`src/index.ts` is present, and that no `.test.`/`.spec.` path appears anywhere in the tarball. The
`test/`, `scripts/`, `.github/` and `.com466-evidence/` prefixes remain forbidden; only `src` moved
out of that denylist, and it moved into an assertion that is narrower than the one it left.

**Three tests pin the allowlist and none was loosened.** All three still assert an EXACT set, now
`["dist", "src", "README.md", "LICENSE", "NOTICE", "CHANGELOG.md"]`:

- `test/governance/release-policy.test.ts` — `toEqual` on the ordered array.
- `test/governance/package-policy.test.ts` — `JSON.stringify` identity, so order is also pinned.
- `test/pack/pack-policy.test.ts` — set equality, plus the packed-path assertions above.

The directory-vs-file classification in `test/pack/pack-policy.test.ts` was generalised from a
hardcoded `entry === "dist"` to a `packedDirectories` set, because an allowlist entry naming a
directory must not be matched as an exact filename; without that, `src/index.ts` would have been
reported as an unexpected packed path while the literal name `src` was expected as a file.

## Header order is logical only

The package guarantees deterministic **logical** ordering through `readonly HeaderPair[]`, locked by `test/headers.test.ts` and `test/golden-fixtures.test.ts`. It explicitly does **not** guarantee on-wire field ordering: `Headers`, `fetch`, and undici may normalize, combine, or reorder fields, and no supported API guarantees wire order. Consumers may rely on pair sequence before transport, but must not treat observed socket order as part of this contract.
