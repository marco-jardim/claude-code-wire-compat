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

| Behavior               | Upstream file             |   Lines | Rule (concise)                                                                                                                                                                                                                                        | Future package test                    |
| ---------------------- | ------------------------- | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Pinned CLI version     | `lib/request-headers.mjs` |      19 | `FALLBACK_CLAUDE_CLI_VERSION = "2.1.195"`. The package pins this as a profile constant, never as a fallback resolved at runtime.                                                                                                                      | `test/profile.test.ts`                 |
| Version discovery URL  | `lib/request-headers.mjs` |      20 | `CLAUDE_CODE_NPM_LATEST_URL` performs live version discovery upstream. The runtime-neutral core performs **no** network I/O, so this is deliberately NOT ported.                                                                                      | `test/runtime/runtime-neutral.test.ts` |
| Build markers          | `lib/request-headers.mjs` |   26-27 | `CLAUDE_CODE_BUILD_TIME = "2026-06-26T01:00:56Z"` and `CLAUDE_CODE_GIT_SHA = "4603aa3f2ea164bd0974f82eb413ae7acc99a7ee"`, extracted from the 2.1.195 native binary. Pinned as profile constants only if a golden proves they reach the wire.          | `test/profile.test.ts`                 |
| Pinned SDK version     | `lib/request-headers.mjs` |      37 | `ANTHROPIC_SDK_VERSION = "0.94.0"`, distinct from the CLI version, emitted as `x-stainless-package-version`.                                                                                                                                          | `test/profile.test.ts`                 |
| CLI-to-SDK version map | `lib/request-headers.mjs` |   40-45 | `CLI_TO_SDK_VERSION` maps each CLI version to its bundled SDK version; the pinned pair `["2.1.195", "0.94.0"]` is at line 45. The package pins exactly one pair and does not port the historical map.                                                 | `test/profile.test.ts`                 |
| Experimental beta set  | `lib/request-headers.mjs` | 173-185 | `EXPERIMENTAL_BETA_FLAGS` is the opt-in experimental registry; `context-hint-2026-04-09` is a member at line 185.                                                                                                                                     | `test/betas.test.ts`                   |
| Beta shortcut aliases  | `lib/request-headers.mjs` | 225-235 | `BETA_SHORTCUTS` maps human aliases (`context-hint`, `hint`) to full flag names. The package accepts only full canonical flag names and does not port alias expansion.                                                                                | `test/betas.test.ts`                   |
| Shortcut resolution    | `lib/request-headers.mjs` | 274-279 | `resolveBetaShortcut` trims, lowercases for lookup, and returns the input unchanged on miss — i.e. it never fails closed on an unknown flag. The package rejects unknown flags instead.                                                               | `test/betas.test.ts`                   |
| Extended user agent    | `lib/request-headers.mjs` | 288-295 | `buildExtendedUserAgent` returns `claude-cli/<version> (external, <entrypoint><sdkSuffix><clientAppSuffix>)`. Entrypoint and both optional suffixes are read from ambient environment upstream and MUST become injected inputs — see the table below. | `test/headers.test.ts`                 |

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

| Behavior                       | Upstream file                  |   Lines | Rule (concise)                                                                                                                                                                                         | Future package test          |
| ------------------------------ | ------------------------------ | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Transform input and output cap | `lib/mimicry/request-body.mjs` |   66-89 | Transform only a nonempty JSON string; when configured, resolve `max_tokens` before other body changes. Debug logging is not part of the runtime-neutral contract.                                     | `test/request-body.test.ts`  |
| Body betas                     | `lib/mimicry/request-body.mjs` |  90-104 | For signed Bedrock requests, copy header betas to `anthropic_beta` except OAuth; always delete unsupported top-level `betas`. First-party betas remain header-only.                                    | `test/betas.test.ts`         |
| Thinking normalization         | `lib/mimicry/request-body.mjs` | 105-112 | Normalize an existing thinking block and inject `{type:"adaptive"}` when an adaptive model omits thinking.                                                                                             | `test/request-body.test.ts`  |
| Effort wire shape              | `lib/mimicry/request-body.mjs` | 114-145 | Move adaptive-model top-level effort into `output_config.effort` without overriding an existing nested value; strip top-level effort otherwise; default missing adaptive effort to `high`.             | `test/models.test.ts`        |
| Temperature                    | `lib/mimicry/request-body.mjs` | 147-155 | Omit temperature whenever adaptive or enabled thinking is active.                                                                                                                                      | `test/request-body.test.ts`  |
| Context management body        | `lib/mimicry/request-body.mjs` | 157-173 | Only explicit token-economy opt-in on a non-Claude-3 thinking request injects `context_management.edits=[{type:"clear_thinking_20251015",keep:"all"}]`.                                                | `test/request-body.test.ts`  |
| Non-thinking temperature       | `lib/mimicry/request-body.mjs` | 174-177 | Set `temperature: 1` when thinking is not active.                                                                                                                                                      | `test/request-body.test.ts`  |
| Model and fingerprint source   | `lib/mimicry/request-body.mjs` | 292-295 | Capture the transformed model locally and derive billing input from the first user message.                                                                                                            | `test/fingerprint.test.ts`   |
| Request-wide cache TTL         | `lib/mimicry/request-body.mjs` | 296-323 | Resolve one TTL from cache policy, request role, subagent status, and injected environment controls, then reuse it for system/tools/messages to preserve valid cache ordering.                         | `test/request-body.test.ts`  |
| System assembly inputs         | `lib/mimicry/request-body.mjs` | 324-343 | Inject first-user text, model, role, cache policy, workload, and configured prompt gates into system-block construction.                                                                               | `test/build-request.test.ts` |
| Metadata insertion             | `lib/mimicry/request-body.mjs` | 380-393 | When mimicry is enabled, preserve current metadata but replace `user_id` with the generated metadata envelope from injected device/account/session inputs.                                             | `test/metadata.test.ts`      |
| Cache activation gates         | `lib/mimicry/request-body.mjs` | 395-424 | Add breakpoints only when signing and supported caching are enabled and the request is not title generation; use the request-wide resolved TTL.                                                        | `test/request-body.test.ts`  |
| Tool breakpoint                | `lib/mimicry/request-body.mjs` | 425-441 | Strip incoming tool cache markers and, when stability policy permits, put one ephemeral marker with the resolved TTL on the last tool.                                                                 | `test/request-body.test.ts`  |
| Thinking-block immutability    | `lib/mimicry/request-body.mjs` | 442-463 | Never mutate `thinking` or `redacted_thinking` blocks; remove incoming cache markers only from other message content blocks.                                                                           | `test/redaction.test.ts`     |
| User-message breakpoint        | `lib/mimicry/request-body.mjs` | 464-477 | Put one ephemeral cache marker with the resolved TTL on the final content block of the last nonempty user message.                                                                                     | `test/request-body.test.ts`  |
| Tool-name mapping              | `lib/mimicry/request-body.mjs` | 479-502 | Map core OpenCode names to Claude Code casing: `bash/read/glob/grep/edit/write/webfetch/todowrite/skill/task/compress` become `Bash/Read/Glob/Grep/Edit/Write/WebFetch/TodoWrite/Skill/Task/Compress`. | `test/request-body.test.ts`  |
| Tool-use mapping               | `lib/mimicry/request-body.mjs` | 503-513 | Apply the same mapping to tool names inside message `tool_use` blocks.                                                                                                                                 | `test/request-body.test.ts`  |
| Orphan repair                  | `lib/mimicry/request-body.mjs` | 643-653 | Repair unmatched assistant `tool_use` blocks throughout message history by supplying matching results.                                                                                                 | `test/request-body.test.ts`  |
| Assistant-tail guard           | `lib/mimicry/request-body.mjs` | 654-677 | Never serialize an assistant-final conversation: append unavailable tool results for trailing tool uses, otherwise append user text `Continue.`.                                                       | `test/request-body.test.ts`  |

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

| Behavior                 | Upstream file                                   |             Lines | Rule (concise)                                                                                                                                                                                                                     | Future package test            |
| ------------------------ | ----------------------------------------------- | ----------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Foreground wire snapshot | `test/fixtures/golden/outgoing-foreground.json` | whole file (1-49) | Structure only: a top-level `headers` object and `body` object; the body contains model/token settings, ordered system blocks, messages, temperature, and metadata. Generated identity/request fields are normalized placeholders. | `test/golden-fixtures.test.ts` |

### Fixture integrity

| Fixture                                                      | Model                 | SHA-256                                                            |
| ------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------ |
| `test/fixtures/golden/outgoing-foreground.json`              | `claude-sonnet-4-5`   | `8d6503cad96d1789dbdbf1c3b8a447dabf5d9a1181d69fbb5f153f23a885b7c9` |
| `test/fixtures/golden/outgoing-canary-context-hint-off.json` | `claude-opus-4-8`     | `7fb1a118ec075b0767c586eb2e2c9e332afe2ca1fb4f6f351361b091a90835da` |
| `test/fixtures/golden/decision-context-hint-rejected.json`   | n/a (decision record) | `6957d363e1e9512eb1a8d2c7170fa208b92e28460e7fb3b8576aa3814cdf4582` |

`test/fixtures/golden/manifest.json` is the machine-readable copy of these hashes. This table and
the manifest **MUST** both be updated when any fixture is regenerated.

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

This package instead pins `defaultCapabilities.contextHint = false` as a static profile constant.
The runtime-neutral core performs no transport, so it cannot observe a 400 and cannot implement
the runtime latch. Retry and latching are the consumer's responsibility. Consumers may opt in
through the `capabilities?: Partial<ClaudeCodeCapabilities>` field on
`ClaudeCodeRequestInput`.

**Consequence:** for plugin users on accounts where the beta **is** enabled, migrating the plugin
onto this package changes observable behavior: context hint stops being sent by default. The Wave
6 wire-parity review **MUST** address this divergence.

## Header order is logical only

The package guarantees deterministic **logical** ordering through `readonly HeaderPair[]`, locked by `test/headers.test.ts` and `test/golden-fixtures.test.ts`. It explicitly does **not** guarantee on-wire field ordering: `Headers`, `fetch`, and undici may normalize, combine, or reorder fields, and no supported API guarantees wire order. Consumers may rely on pair sequence before transport, but must not treat observed socket order as part of this contract.
