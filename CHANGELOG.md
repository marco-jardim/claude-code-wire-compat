# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-07-28

First stable release.

There is NO runtime code change relative to `0.1.0-rc.17`:
`git diff --stat 5c6881b d7e2901 -- src package.json` is empty, so `dist/` is
byte-identical to the `0.1.0-rc.17` build. Everything this release contains is
described in the release candidate entries below; they are not repeated here.
The packed content differs from `0.1.0-rc.17` by `README.md` and by the added
TypeScript sources described below — the executed code is unchanged, which
`npm run test:pack` confirms by an unchanged consumer digest.

### Added

- **The tarball now ships the TypeScript sources.** `src` is added to the
  `files` allowlist. The build emits 40 `.js.map` and `.d.ts.map` files that
  reference `../src/*.ts` and carry no `sourcesContent`, so every source map in
  the published package resolved to nothing in a consumer's debugger. Shipping
  the sources is also the coherent option for a GPL-3.0-or-later package whose
  `NOTICE` already offers corresponding source: the offer and the tarball now
  agree. Only `.ts` files are packed under `src/`, pinned exactly by
  `test/pack/pack-policy.test.ts`; the allowlist itself is pinned by
  `test/governance/release-policy.test.ts` and
  `test/governance/package-policy.test.ts`.
- The ported protocol-documentation corpus and `docs/ATTRIBUTION.md` are now in
  the repository. Neither is packed into the tarball.

### Changed

- `README.md` no longer describes the package as a bootstrap release candidate
  whose request-building behavior arrives later. That statement was false — the
  package builds and parses requests — and it was the text rendered on the
  npmjs.com package page.

## [0.1.0-rc.17] - 2026-07-28

### Added

- **Root `suppressIdentityBlock` (seam S8).** The canonical identity block was
  composed unconditionally, so a consumer switch whose meaning is "send neither
  canonical block" — `token_economy.lean_system_non_main` in the `opencode`
  plugin, which removed billing AND identity before it migrated to this package
  — was a silent no-op. `suppressIdentityBlock: true` omits the identity block
  entirely, which with `suppressBillingBlock` makes four canonical prefixes
  legitimate: `[billing, identity]`, `[identity]`, `[billing]` and `[]`. Only a
  boolean is accepted; anything else is `INVALID_INPUT`.
  `evidence.identityBlockSuppressed` is emitted only when the block was actually
  removed, mirroring `billingBlockSuppressed` exactly, so evidence stays
  byte-identical for every request that ignores the seam. Recorded in
  `docs/source-trace.md` as governance ledger L16.

  This is a DIFFERENT field from the L10 `cacheControl.suppressIdentityBlock`,
  which keeps the block and drops only its `cache_control` marker. The name
  collision is deliberate — symmetry with `suppressBillingBlock` at the root was
  judged worth more than a novel name — and the JSDoc of each field states what
  it does and names the other by its full path.

  The caller-block drop stays UNCONDITIONAL: a caller block byte-equal to the
  identity text is removed even when the canonical one was suppressed, matching
  the genuine client and keeping the parser's absence check below sound.

- **`preserveThinkingBlockCacheControl` (seam S9).** `thinking` and
  `redacted_thinking` blocks were pinned to a strict allowlist — `signature`,
  `thinking`, `type` and `data`, `type` — so a request carrying `cache_control`
  on a reasoning block was rejected outright with `INVALID_INPUT`. The consumer
  had no legal way out, and this is a PRODUCTION failure rather than a test
  artefact: the Anthropic API answers a mutated reasoning block with

  > `400 ... thinking or redacted_thinking blocks in the latest assistant`
  > `message cannot be modified. These blocks must remain as they were in the`
  > `original response.`

  so `delete block.cache_control` before the call is itself the modification
  that triggers the 400. `preserveThinkingBlockCacheControl: true` accepts the
  key and copies it to the body VERBATIM — caller key order intact, no TTL
  applied, no breakpoint placed. Only a boolean is accepted; anything else is
  `INVALID_INPUT`.

  The allowlist grows by `cache_control` and by NOTHING else: an unknown key on
  a reasoning block is still `INVALID_INPUT` with the seam active. The value
  passes the same `cache_control` validator every other block uses —
  `{ type: "ephemeral" }` with an optional `ttl` — so a malformed marker still
  fails closed; the `scope` key that `text` blocks tolerate for legacy reasons
  is deliberately NOT accepted, the API never returning it on a reasoning block.
  The marker takes no part in this package's cache-control machinery:
  `applySystemCacheControl` is untouched and `applyMessageCacheControl` already
  exempts reasoning blocks from both the strip and the breakpoint pass.

  `evidence.thinkingBlockCacheControlPreserved` is emitted only when the seam
  was active AND at least one emitted block actually carried a marker — opting
  in without using it records nothing — mirroring `billingBlockSuppressed`
  exactly, so evidence stays byte-identical for every request that ignores the
  seam. `parseBuiltClaudeCodeRequest` CONFIRMS that claim against the body
  before it checks byte length or digest, so a forgery that is byte-length
  preserving and evidence-self-consistent is refused by the structural check
  rather than incidentally by arithmetic. Recorded in `docs/source-trace.md` as
  governance ledger L17.

### Changed

- **`parseBuiltClaudeCodeRequest` no longer INFERS the canonical prefix from the
  identity block's position; it READS the length from evidence and VERIFIES it
  structurally.** With two independent seams an empty prefix is
  indistinguishable from a caller-only array, so position inference is no longer
  decidable: the rc.16 discriminator would have hit its unconditional failure
  path on every request built with both seams active. The parser now takes
  `evidence.billingBlockSuppressed` and `evidence.identityBlockSuppressed` as
  the claimed prefix length and confirms every block that claim implies —
  billing by its fixed `x-anthropic-billing-header: cc_version=` head (the tail
  is per-request), identity by the byte-exact identity text. This is strictly
  stronger than what it replaces, which never inspected the billing slot at all:
  an envelope built with `suppressBillingBlock` whose evidence hid that fact was
  previously accepted.

  Verification is **asymmetric, deliberately**. A claim that identity was
  suppressed is refuted by finding the identity text ANYWHERE in the array,
  which is sound because `buildCanonicalSystem` drops caller blocks equal to it
  unconditionally and merges runs with `\n`, so the text cannot legitimately
  survive. There is no mirror check for billing: a caller block may legitimately
  begin with the billing header text, so its presence proves nothing.

  The match is on TEXT, never on `cache_control` — the L10 seam can legitimately
  emit the identity block with no marker — and the assertion remains an
  EQUALITY.

- **`emittedSystemBlockCount` is computed from both seams instead of a
  constant.** `CANONICAL_SYSTEM_BLOCKS` and `CANONICAL_SYSTEM_BLOCKS_WITHOUT_BILLING`
  were removed: a constant cannot express the empty prefix the two seams produce
  together. The build path now subtracts one slot per canonical block that
  actually survived.

## [0.1.0-rc.16] - 2026-07-28

### Added

- **`suppressBillingBlock` (seam S7).** The canonical billing block at `system[0]`
  was composed unconditionally, so a consumer switch whose meaning is "do not
  send the billing block" — `CLAUDE_CODE_ATTRIBUTION_HEADER=0` in
  `opencode-anthropic-fix` — was a silent no-op. `suppressBillingBlock: true`
  emits `[identity]` as the canonical prefix instead of `[billing, identity]`.
  Only a boolean is accepted; anything else is `INVALID_INPUT`.
  `evidence.billingBlockSuppressed` is emitted only when the block was actually
  removed, so evidence stays byte-identical for every request that ignores the
  seam. Suppressing the block changes what Anthropic sees for attribution
  purposes: that is a deliberate consumer decision, and the package does not
  guard it. Recorded in `docs/source-trace.md` as governance ledger L15.

### Changed

- **`parseBuiltClaudeCodeRequest` infers the canonical system prefix
  structurally.** The flag never reaches the wire, so the parser can no longer
  subtract a constant. It locates the byte-exact identity text — index 1 means a
  two-block prefix, index 0 means a one-block prefix, neither means the envelope
  was not produced by this package — matching on TEXT and never on
  `cache_control`, because `cacheControl.suppressIdentityBlock` can legitimately
  emit the identity block with no cache marker. The assertion remains an
  equality.

### Fixed

- **`evidence.systemBlockCount` counted the caller's blocks, not the emitted
  ones.** `buildCanonicalSystem` merges adjacent caller blocks that share a
  `cache_control` and drops any block equal to the identity text, so the emitted
  array was routinely shorter than the caller's while the parser asserted
  equality against it. Any request with two or more mergeable system blocks was
  rejected by `parseBuiltClaudeCodeRequest` with an opaque `INVALID_INPUT` and
  `safeDetails: {}` — a 403 in production with no diagnosable cause, since the
  parser's only consumer is a proxy validating envelopes from a Worker. Evidence
  now records the length of the array actually serialized.

## [0.1.0-rc.15] - 2026-07-28

### Fixed

Two defects found when the first real consumer pointed its production call site
at this package. Both are recorded in `docs/source-trace.md` under governance
ledger L13.

- **Line breaks and tabs are accepted in body content.** `inspectString` in
  `src/build-request.ts` rejected every code unit `<= 0x1F` and `0x7F`, which
  includes TAB (0x09), LF (0x0A) and CR (0x0D). That screen runs over the whole
  caller input graph, so ANY message or system block containing a newline was
  refused with `INVALID_UNICODE`, making the package unusable for real traffic —
  no genuine prompt is a single line. The defect survived 14 release candidates
  because all 1784 tests and every golden fixture used single-line text.

  TAB, LF and CR are now allowed in body content: message text, system blocks,
  tool names and descriptions. `JSON.stringify` escapes them, so no raw control
  character reaches the wire. Every other C0 control (0x00–0x08, 0x0B, 0x0C,
  0x0E–0x1F) and DEL (0x7F) are still rejected, and LONE SURROGATES are still
  rejected everywhere — `TextEncoder` silently replaces them with U+FFFD, which
  would corrupt both the body and the body hash recorded in evidence.

  Header validation did NOT change. `assertHeaderText` still rejects every
  control character, TAB, LF and CR included, because a bare LF in a header is
  request smuggling; `extraHeaders` is untouched. Metadata validation did NOT
  change either: `user_id` and metadata keys are identifiers that travel as JSON
  inside a header, not prose.

  Behaviour change for callers reading error codes: a header carrying CRLF used
  to fail as `INVALID_UNICODE`, caught by the input-graph screen, and now fails
  as `HEADER_INJECTION`, caught by the header assembler. The value is refused
  either way; the code now names the layer that actually owns the rule.

- **`cacheControl.suppressIdentityBlock` no longer destroys caller
  `cache_control`.** `applyToolCacheControl` and `applyMessageCacheControl`
  stripped every caller-supplied `cache_control` unconditionally and only then
  consulted `enabled` / `toolBreakpoint` / `messageBreakpoint` to decide whether
  to restore a breakpoint. Passing `cacheControl: { suppressIdentityBlock: true }`
  on its own therefore deleted the `cache_control` the caller had placed on its
  own tools and message blocks and restored nothing, so the seam could not serve
  the use case it was created for.

  The strip is now gated exactly like the re-add: it runs only when
  `enabled === true`. When caching IS enabled the caller's own breakpoints are
  still normalised away, because this package owns breakpoint placement in that
  mode.

  This is a behaviour change: a caller that passes `cacheControl` with `enabled`
  absent or `false` and relied on the strip now keeps its own `cache_control`.

## [0.1.0-rc.14] - 2026-07-28

### Fixed

`extraHeaders` no longer forwards hop-by-hop or entity headers. `isForbiddenHeader`
now also rejects `content-length`, `host`, `connection`, `transfer-encoding`,
`te`, `upgrade` and `keep-alive` with `FORBIDDEN_HEADER`.

This is a defect fix, valid independently of any consumer. `content-length` used
to pass straight through. Because this package RECONSTRUCTS the request body
canonically, a `content-length` copied from an inbound request describes a
different byte string: the wire request is corrupted SILENTLY, with no local
exception and no evidence anomaly, and the peer truncates or stalls. The other
six are hop-by-hop headers under RFC 9110 section 7.6.1 (or, for `host`, derived
from the pinned endpoint) and belong to the transport, not to the caller.

This is the one non-additive part of the release: a caller that used to pass one
of the seven names now receives a loud, local `FORBIDDEN_HEADER` instead of a
corrupt request. Recorded in `docs/source-trace.md` under governance ledger L12,
Part A.

### Added

A fifth additive consumer seam. Like the four before it, it is an extension of
THIS package, not observed Claude Code behaviour, and is recorded as such in
`docs/source-trace.md` under governance ledger L12, Part B. It is a no-op when
omitted: `test/validation/seam-additivity.test.ts` builds the same request with
and without the field and compares `body` byte for byte, plus `headers` and
`evidence` in full.

- `ClaudeCodeRequestInput.extraHeaderPolicy` decides how a collision between
  `extraHeaders` and a header this package owns is resolved. `"strict"` is the
  default and reproduces the previous behaviour byte for byte: `DUPLICATE_HEADER`
  for a canonical name, `FORBIDDEN_HEADER` for a denylisted one.
  `"dropConflicting"` discards the offending pair instead of throwing and records
  its lowercased name in the new optional `evidence.droppedExtraHeaderNames`, in
  caller order, so a consumer bridging a heterogeneous host header map is not
  defeated by a single inbound `anthropic-beta` and can still audit the loss.

  Neither policy relaxes header syntax: `assertHeaderText` runs first, before any
  drop decision, so a control character in a name or a value raises
  `HEADER_INJECTION` under both. A caller that duplicates one of its OWN extra
  headers also keeps receiving `DUPLICATE_HEADER` under both, because that is a
  caller bug rather than a conflict with a header this package owns.

  `evidence.droppedExtraHeaderNames` is emitted ONLY under `"dropConflicting"`.
  Under `"strict"`, and for every request built before the seam existed, the key
  is ABSENT rather than present-and-empty, so existing evidence stays
  byte-identical. `parseBuiltClaudeCodeRequest` preserves the key when present
  and never synthesises it.

- `ClaudeCodeExtraHeaderPolicy` is exported from the package root.

## [0.1.0-rc.13] - 2026-07-28

### Added

A fourth additive consumer seam. Like the three before it, it is an extension of
THIS package, not observed Claude Code behaviour, and is recorded as such in
`docs/source-trace.md` under governance ledger L11. It is a no-op when omitted:
`test/validation/seam-additivity.test.ts` builds the same request with and
without the field and compares `body` byte for byte, plus `headers` and
`evidence` in full.

- `ClaudeCodeRequestInput.metadataOverrides` substitutes the `metadata.user_id`
  value the genuine client derives from host state. It carries two MUTUALLY
  EXCLUSIVE members, because the two consumer behaviours it covers are
  structurally different: `userId` replaces the emitted `user_id` verbatim, for
  a host carrying an opaque identifier of its own, while `userIdFields` keeps
  the derived JSON object and adds members to it. Caller members are written
  first and the correlation triple (`device_id`, `account_uuid`, `session_id`)
  last, so correlation always wins; supplying one of those three keys inside
  `userIdFields` fails with `INVALID_INPUT` instead of being silently
  overwritten. Supplying both members fails with `INVALID_INPUT`.

  The seam is opt-in and relaxes nothing by default. With the field omitted, a
  supplied `metadata.user_id` that diverges from the derived value keeps failing
  with `INVALID_INPUT`. With the field supplied, the guard is re-pointed rather
  than removed: a supplied `metadata.user_id` must equal the seam-resolved
  value, and `device_id`, `account_uuid` and `session_id` supplied at the
  `metadata` level stay pinned to the runtime identity. No evidence key is
  added, so `RedactedRequestEvidence` is unchanged for every request.

  Known consequence: a request built with `metadataOverrides.userId` is rejected
  by `parseBuiltClaudeCodeRequest`, which proves that `metadata.user_id` carries
  the same `session_id` as the `x-claude-code-session-id` header. An opaque
  replacement makes that unprovable, and the parser stays strict rather than
  weakening the invariant for every caller. `metadataOverrides.userIdFields`
  round-trips normally.

## [0.1.0-rc.12] - 2026-07-27

### Added

Three additive consumer seams. All three are extensions of THIS package, not
observed Claude Code behaviour, and are recorded as such in
`docs/source-trace.md` under governance ledger L10. Every one of them is a no-op
when omitted: `test/validation/seam-additivity.test.ts` builds the same request
with and without each field and compares `body` byte for byte, plus `headers`
and `evidence` in full.

- `ClaudeCodeRequestInput.additionalBetas` appends caller-supplied beta
  identifiers to `anthropic-beta`, AFTER the upstream-derived set and in caller
  order. An entry equal to an already-emitted identifier is dropped rather than
  reordering the canonical prefix. Because the header is one comma-joined field,
  entries must match `/^[A-Za-z0-9][A-Za-z0-9._-]*$/`, be at most 128 characters,
  and number at most 32; anything else fails with `INVALID_INPUT`.

- `ClaudeCodeRequestInput.betaOverrides.use1MContext` decides the
  `context-1m-2025-08-07` beta per request: `true` forces it without the `[1m]`
  model marker, `false` suppresses it despite the marker. The profile gate
  `betaPolicy.oneMillionContextEnabled` still applies, so an override cannot
  enable a beta the pinned profile declares unavailable. The decision appears in
  `evidence.capabilityDecisions.use1MContext`, which is OPTIONAL and present only
  when the caller supplied the override.

- `ClaudeCodeRequestInput.cacheControl.suppressIdentityBlock` emits the canonical
  identity system block without a `cache_control` marker. It defaults to `false`,
  which reproduces the unconditional marker the genuine client always sends.

### Changed

- `RedactedRequestEvidence.capabilityDecisions` is now typed as
  `ClaudeCodeCapabilityDecisions`: the nine capability booleans stay mandatory,
  plus an optional `use1MContext` emitted only when the override was supplied.
  Evidence for a request that omits `betaOverrides` is unchanged.

- New public type exports: `ClaudeCodeBetaOverrides` and
  `ClaudeCodeCapabilityDecisions`.

## [0.1.0-rc.11] - 2026-07-27

### Changed

- `max_tokens` is now capped at the model's own default output limit before it
  reaches the wire (D16). The genuine client computes
  `Fi = Math.min(callerValue, qct(model))` and sends `Fi`; `qct` resolves to
  `Xxe(model).default` for any caller that reads no environment, which is every
  caller of this package. Asking for 100000 tokens on `claude-opus-4-8` now
  sends 64000, where previously the caller's value went out unchanged.

  The cap is silent, matching the client: an oversized request is lowered, never
  rejected. Requests at or below the model default are unaffected, so callers
  already sending sane values see no change.

  The bound is the model **default**, not its upper limit. Upstream only ever
  compares the `CLAUDE_CODE_MAX_OUTPUT_TOKENS` environment value against
  `upperLimit`, and this package reads no environment.

  This also moves the thinking budget, because upstream feeds the same clamped
  `Fi` into `Tr = Math.min(Fi - 1, Tr)`. On a non-adaptive model an enabled
  thinking request with no explicit budget now resolves against the capped
  ceiling rather than the caller's original number.

## [0.1.0-rc.10] - 2026-07-27

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
