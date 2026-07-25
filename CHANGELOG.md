# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0-rc.2] - Unreleased

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
