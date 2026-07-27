# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0-rc.10] - Unreleased

This release rebuilds the request model against the genuine client's own
predicates rather than against a reimplementation of them. Several `0.1.0-rc.9`
decisions are reversed below; where they are, the reversal is the corrected one.

### Removed

- `UNSUPPORTED_MODEL` and the hand-written alias table. The genuine client never
  rejects a model identifier: it lowercases the string, runs an ordered
  `includes()` chain to classify it, and sends the caller's string on the wire.
  Rejecting `claude-sonnet-4-5-20250929` and silently rewriting `opus-4.5` onto
  `claude-opus-4-5` were both divergences, and the rewrite put a different
  identifier on the wire than the caller asked for.
- `contextHint` from `ClaudeCodeCapabilities`. It was never a model capability
  upstream — the client gates it on host state and a feature flag, never on the
  model — and nothing read the per-model value.
- `defaultCapabilities` from the protocol profile, replaced by
  `contextHintEnabled` and `betaPolicy`.
- `orderedBetas` from the profile and from `profileOverride`. A flat ordered
  array cannot express the client's beta selection, which is emergent from
  seventeen guarded pushes. Protocol drift is now detected by checking upstream's
  beta identifiers against the 28-entry registry instead of against an ordering.

### Changed

- The model identifier reaches the wire verbatim, minus any `[1m]`/`[2m]`
  marker, exactly as the client sends it. Classification into a known identifier
  still happens, but only to resolve capabilities.
- `ClaudeCodeCapabilities` carries nine booleans instead of four:
  `thinking`, `adaptiveThinking`, `interleavedThinking`, `effort`, `maxEffort`,
  `xhighEffort`, `contextManagement`, `temperature` and
  `rejectsDisabledThinking`. Each is a port of one client predicate, cited by
  name and byte offset in the source.
- **`claude-opus-4-5` is effort-capable again**, reversing `0.1.0-rc.9`. That
  release read catalogue membership as the whole rule. It is only one of four
  tests in the client's predicate, and the fallback returns true on the
  first-party provider, so the model reaches effort support without a catalogue
  grant. The predicates governing effort and temperature use different exclusion
  lists, and `claude-opus-4-5` appears in one but not the other.
- **The model family union regains `mythos` and gains `unknown`**, reversing
  `0.1.0-rc.9`. `claude-mythos-5` has no catalogue entry but is recognised by the
  client's classifier and named in six of its predicates.
- `temperature` is now model-gated. The client emits it only when extended
  thinking is inactive _and_ the model is on an allowlist, so Opus 4.7, Opus 4.8,
  Fable 5 and Mythos 5 never receive it. A caller value supplied outside that
  window is discarded rather than rejected, matching the client.
- Extended thinking now resolves the way the client resolves it. Whether a
  request becomes `adaptive` or `enabled` is decided by the model's capability,
  not by the caller's `type`; a caller asking for `enabled` on an
  adaptive-capable model gets `adaptive` and their `budgetTokens` is discarded.
  Budgets are clamped to `max_tokens - 1`.
- `thinking` accepts `disabled` and an optional `display` of `summarized` or
  `omitted`. `budgetTokens` is now optional on `enabled`.
- `tool_choice` of type `tool` is demoted to `auto` while extended thinking is
  active.
- Beta identifiers are emitted in the client's push order, which is emergent and
  must not be sorted. `claude-code-20250219` is no longer sent for Haiku models,
  and `web-search-2025-03-05` is no longer sent at all, because the client
  pushes it only on Vertex and Foundry.
- `extended-cache-ttl-2025-04-11` is now conditional on a one-hour cache TTL.

### Added

- `buildClaudeCodeCountTokensRequest`, targeting
  `/v1/messages/count_tokens?beta=true`. Its beta set is the intersection of the
  request beta set with the four the client's transport permits, and the
  transport's own `token-counting-2024-11-01` is appended to the header. It
  applies the same input canonicalisation and the same fail-closed guarantees as
  the messages endpoint.
- `selectAntiVerbositySection` and `antiVerbosityText`, exposing the client's
  three-way anti-verbosity prompt selection. The prompt text is extracted
  byte-exactly from the client and is never injected into a request; callers
  assemble their own system prompt.
- `betaPolicy` on the profile: eleven booleans, each standing for one upstream
  gate that depends on host state this package cannot observe, each pinned to its
  default first-party value and overridable.
- The pinned catalogue now carries each entry's `context` object and
  `defaultEffort`. `defaultEffort` is exposed, never applied — the client reads
  it only in its model picker, not in its request builder.
- `xhigh` joins the effort union.

### Fixed

- The publish workflow passes the npm auth token to the publish step. Without it
  the token placeholder expanded empty and the registry answered `E404` on a
  scoped package rather than `E401`, which is what failed the `0.1.0-rc.8` and
  `0.1.0-rc.9` publishes.

## [0.1.0-rc.9] - 2026-07-26

### Fixed

- The pinned model table is now transcribed from the genuine client's own
  generated model catalogue instead of being derived from a public model
  index. Seven identifiers that the client does not carry were removed
  (`claude-opus-5`, `claude-sonnet-5`, `claude-mythos-5`, and the four dated
  snapshots `claude-opus-4-5-20251101`, `claude-opus-4-1-20250805`,
  `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`). Dated forms are
  provider identifiers, not aliases; carrying them as aliases rewrote a
  caller's model onto a different identifier.
- `claude-opus-4-5` no longer advertises the effort capability. The catalogue
  grants it only context management, so an effort request on that model now
  fails closed instead of emitting an unsupported beta.

### Added

- `claude-3-5-haiku`, `claude-3-5-sonnet` and `claude-3-7-sonnet` are
  supported again. They are genuine catalogue entries with an empty
  capability list, so all four capability flags are false.

### Changed

- The model family union no longer includes `mythos`. It is now `haiku`,
  `sonnet`, `opus` and `fable`.
- The pinned table is ordered to match the catalogue.

## [0.1.0-rc.8] - 2026-07-26

### Fixed

- The five `claude-3` entries added in `0.1.0-rc.7` are removed. They were wrong twice over. Their
  canonical keys were invented spellings rather than real wire identifiers, and because
  `resolveModel` rewrites the outgoing `model` field to the canonical key, a caller sending
  `claude-3-5-haiku-latest` would have had that field silently replaced with `claude-3-5-haiku`,
  discarding the snapshot it named. Independently of that, the pinned endpoint does not serve any
  `claude-3` identifier at all: those models are reachable only through gateway and cloud providers,
  each of which prefixes the identifier differently, and those endpoints are out of scope for this
  profile. `claude-3` identifiers therefore fail closed with `UNSUPPORTED_MODEL` again.
- The `claude-fable-5` aliases `claude-fable-5-experimental` and `fable_5-preview`, and the
  `claude-mythos-5` alias `mythos.5-preview`, are removed. No evidence establishes that they name the
  same model as the identifier they canonicalised onto, and canonicalisation would have rerouted them
  silently.

### Added

- Seven first-party model identifiers join the pinned allowlist, taking it from sixteen entries to
  eighteen: `claude-opus-5`, `claude-opus-4-5`, `claude-opus-4-5-20251101`,
  `claude-opus-4-1-20250805`, `claude-sonnet-5`, `claude-sonnet-4-5-20250929` and
  `claude-haiku-4-5-20251001`. The allowlist now covers every model the pinned endpoint advertises.
  Four of them declare `effort` without `adaptiveThinking`, a combination no earlier entry carried;
  the two upstream predicates are independent.
- Every canonical key is a real wire identifier and every alias is a non-wire spelling that
  canonicalises onto one. That invariant is now stated in the profile, because `resolveModel` rewrites
  the outgoing `model` field to the canonical key and an alias that names a distinct model would
  silently reroute the request.

## [0.1.0-rc.7] - 2026-07-26

### Added

- Seven model identifiers join the pinned allowlist, taking it from nine entries to sixteen:
  `claude-3-7-sonnet`, `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-haiku`, `claude-3-opus`,
  `claude-fable-5` and `claude-mythos-5`, together with fourteen aliases covering the dotted, dated
  and vendor-prefixed spellings observed in consumer code. The five `claude-3` entries declare every
  capability as unsupported, because upstream gates interleaved thinking and the context hint on a
  non-`claude-3` predicate; `claude-fable-5` and `claude-mythos-5` declare adaptive thinking and
  effort, matching the upstream predicates that accept them.
- `ClaudeCodeModelFamily` is now an exported type. It names the model family union and gains two
  members, `fable` and `mythos`. The family is evidence-only: it reaches
  `RedactedRequestEvidence.modelFamily` and never any header, body field or body hash.

### Changed

- The four declaration sites that repeated the inline `"haiku" | "sonnet" | "opus"` union now refer
  to `ClaudeCodeModelFamily`, and the three runtime validators that guard it accept the two new
  members.

### Fixed

- A model entry may now declare an empty `aliases` array. Non-empty was enforced, which made the
  pinned profile fail its own validation when a consumer passed `supportedModels` back through
  `profileOverride` — the documented way to widen the allowlist, because an override replaces the
  model map rather than merging into it. The non-empty rule still applies to `orderedBetas`.

## [0.1.0-rc.6] - 2026-07-26

### Fixed

- Restored the pinned cache marker on the Claude Code identity system block when a
  caller supplies `cacheControl`. The caller-directed placement introduced in
  `0.1.0-rc.5` removed that marker, which changed the static prefix cache boundary of
  every built request. The identity marker is protocol identity owned by this package
  and is now emitted unconditionally, independently of caller-directed breakpoints.

## [0.1.0-rc.5] - 2026-07-26

### Changed

- Consecutive caller system blocks with structurally equal `cache_control` values, including when
  both are absent, are now joined into one wire block, with their texts joined in order by a single
  newline. This mirrors the genuine Claude Code client, which emits one newline-joined caller block
  rather than one block per caller entry. Blocks whose `cache_control` differs remain separate.

### Added

- A new optional top-level `cacheControl` input object (`ClaudeCodeCacheControlInput`) lets the
  caller direct cache-breakpoint placement through `enabled`, `ttl`, `systemBreakpoint`,
  `toolBreakpoint`, and `messageBreakpoint`. Omission preserves existing behaviour. One TTL is
  shared across system, tools, and messages. Explicit `ttl: null` emits an ephemeral marker with no
  `ttl` member. Incoming non-thinking markers are stripped before placement, and the message
  breakpoint lands on the literal last block of the last user message, including when that block is
  a `tool_result`. Unknown keys are rejected with `INVALID_INPUT`.

## [0.1.0-rc.4] - 2026-07-26

### Added

- A fail-closed protocol profile override. The new optional `profileOverride` member on
  `ClaudeCodeRequestInput` accepts a `ClaudeCodeProfileOverride` whose eleven optional members
  (`id`, `cliVersion`, `sdkVersion`, `entrypoint`, `userAgent`, `buildTime`, `gitSha`,
  `attributionHeaderEnabled`, `defaultCapabilities`, `supportedModels`, `orderedBetas`) replace the
  pinned profile field by field. It lets a consumer ship an emergency protocol update for a new
  Claude Code release without waiting for a package release.

### Security

- The request destination is not overridable. `endpoint`, `provider` and `anthropicVersion` are
  absent from `ClaudeCodeProfileOverride` by construction, so supplying any of them is rejected with
  `INVALID_INPUT` rather than silently ignored. An override that changes `cliVersion` or `sdkVersion`
  without a matching `userAgent` is rejected, because a body and a user agent announcing different
  versions is a detectable client inconsistency.

### Changed

- `RedactedRequestEvidence.profileId` is now `string` rather than the pinned literal type, and
  reports the effective profile identifier, so evidence cannot attribute a request to the pinned
  profile when an override built it.

## [0.1.0-rc.3] - 2026-07-25

### Added

- Full beta message content block union: `thinking`, `redacted_thinking`, `image`,
  `document`, `search_result`, and nested `tool_reference` blocks, with the multimodal
  `tool_result` content union.
- Full beta tool definition union: `cache_control` and `defer_loading` on tool
  definitions, plus the built-in and server tool shapes that carry no ordinary
  `input_schema`.
- Top-level request fields `context_management`, `output_config`, `speed`,
  `service_tier`, `output_format`, `tool_choice`, `top_p`, `top_k`, `stop_sequences`,
  `stream`, and `temperature`.
- Validated header seam `extraHeaders` and the dynamic headers `x-app`,
  `x-stainless-retry-count`, `x-stainless-helper`, `x-claude-remote-container-id`,
  `x-claude-remote-session-id`, `x-client-app`, and
  `x-anthropic-additional-protection`.
- Validated body-level extension envelope `experimentalBodyFields`, so a caller can
  emit a newly shipped protocol field without waiting for a package release.

### Changed

- Request body JSON now preserves the caller's key insertion order. The previous
  recursive alphabetical sort rewrote the bytes of prior conversation turns, which is
  the prefix the upstream prompt cache is keyed on.
- The public metadata value type accepts nested JSON rather than only primitives.
- Unknown properties on nested request shapes are now rejected with `INVALID_INPUT`
  instead of being silently dropped, making the contract fail-closed at every level.

### Fixed

- Nested JSON metadata was rejected on the public build path even though the
  published type declared it as accepted.

## [0.1.0-rc.2] - 2026-07-25

### Fixed

- The public `ClaudeCodeRequestInput` type now declares the required `clientRequestId` field and
  optional `crypto` provider field. These fields were enforced at runtime but missing from the
  published type declarations, so TypeScript consumers could not construct a valid input without
  a type error.

## [0.1.0-rc.1] - 2026-07-25

First release candidate. Published as a GitHub prerelease only; this version is deliberately not
published to npm.

### Added

- GPL-3.0-or-later governance and upstream attribution.
- ESM-only TypeScript package, testing, linting, and build skeleton.
- Continuous integration and provenance-based publication workflow skeletons.
- Frozen public contract surface and typed `ClaudeCodeWireError` with safe, deny-by-default
  details.
- Pinned `claude-code-2.1.195-sdk-0.94.0` protocol profile, exported from the
  `./profiles/claude-code-2.1.195` subpath, with context hint disabled by default and a fail-closed
  supported-model table.
- Normalized public protocol golden fixtures containing no credentials, account identifiers, or
  private prompt text.
- Source-to-contract provenance trace at `docs/source-trace.md`.
- `buildClaudeCodeRequest` and `parseBuiltClaudeCodeRequest`, constructing a canonical Claude Code
  Messages request with deterministic byte output and an evidence digest.
- Canonical request body serialization, canonical system-block ordering, and ordered safe headers.
- Billing fingerprint derived from the first user message, with validated Web Crypto digests.
- Correlated request metadata, model resolution, and beta capability negotiation over the pinned
  allowlist.
- Deny-by-default redaction of error details, so no prompt text, credential, or account identifier
  can reach a thrown error.
- Offline protocol drift verifier (`npm run drift:check`) and a fixture-driven drift suite.
- Conformance, property, adversarial, and input-validation suites.
- Packed-tarball verification proving identical output digests across Node, Bun, and workerd.

### Security

- Rejects lone surrogates in all validated string inputs, so hashed bytes cannot diverge from
  transmitted bytes.
- Validates the shape and length of injected Web Crypto digest results, replacing silent wire
  corruption with a typed `CRYPTO_UNAVAILABLE` failure.
