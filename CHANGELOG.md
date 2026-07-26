# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0-rc.7] - Unreleased

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
