<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Decision memory

Append-only log of non-obvious maintenance decisions and their reasoning, so
future work does not re-litigate or accidentally reverse them. Newest entries
first. Keep entries dated, factual, and in consumer-neutral language.

## 2026-09-25 - P1.T1/D4 diagnostic review and provenance correction

The entry below overstated incident attribution and identifier coverage.
Synthetic probes proved local rejection of controls, but the original user's
offending input remains unknown. Raw TextEncoder replaces lone surrogates;
JSON.stringify escapes them, so a body-hash mismatch is not an automatic
consequence of JSON serialization. Model/tool identifiers are not prose and
require explicit screening after the generic body policy is relaxed.

D4 adds six primitive violation fields to the error sanitizer, not public
validator exports. Paths mask user-controlled subtrees even when a key matches
a schema word; only actual array indices become numbers. Root and truncated
paths remain valid, offset/length diagnostics are safe integers bounded by
1,000,000, and code units must match the closed reason. Legacy control errors
outside prose retain their codes and need not gain these additive details.
The reserved control-char reason permits only control code units; the unused
forbidden-key reason was removed. All surrogate classification still delegates
to the unchanged classifySurrogateAt implementation.

The input budget is not a wire-size limit: JSON escaping may expand one control
character to six bytes. Remote acceptance and the original failure trigger
remain UNVERIFIED; no authenticated probe was performed.

## 2026-09-25 — Body prose accepts every well-formed UTF-16 string (P1.T1)

Context: the graph screeners rejected C0 control characters except TAB/LF/CR,
plus DEL, in all body text; the system-field validator additionally rejected
the C1 range, so U+0085 passed in a message but failed in `system`. The rule
was a library-local defensive heuristic (see the comment that used to live
above `inspectString` in `src/build-request.ts`): no captured Claude Code
behaviour and no observed Anthropic API 400 ties the remote side to it. It
also produced a confirmed data-fidelity bug: the first real consumer's
sessions aborted locally with `INVALID_UNICODE` on legitimate tool output
carrying ESC (ANSI colour), NUL, FF or DEL, before any network call.

Decision (P1.T1): body prose — message text, `tool_result` content,
`tool_use` input values and keys, tool descriptions, `input_schema` text,
system text and stop sequences — accepts every well-formed UTF-16 string.
Only lone surrogates remain rejected, because `TextEncoder` silently replaces
them with U+FFFD and would desync the body hash. Headers, metadata
identifiers and runtime identity fields keep their strict rules; the
fingerprint's UTF-16 index sampling (4/7/20) is untouched. Wire bytes for
every previously accepted input are unchanged; no fixture was resealed.

Audit note: lanes whose strings land in headers were checked to have their
own validation independent of the graph walk (`src/headers.ts`,
`src/metadata.ts` including its nested-string pass, runtime identity), so the
relaxation exposes no identifier lane.

Whether the remote API rejects any scalar is UNVERIFIED. If a code point is
later shown to fail remotely, add a narrow rule citing that evidence rather
than reinstating blanket rejection; neutralizing ANSI/OSC for display is the
consumer's display-boundary job, not a validation rule.

## 2026-09-23 — The frozen packed-consumer digests are now enforced, not eyeballed

Context: `scripts/verify-packed-consumers.mjs` builds the same request from a
packed tarball under node, bun and workerd, and prints a SHA-256 digest per
profile. Its own block comment said each explicit case's digest "must not move
for any reason other than a change to that profile's own wire output" — but the
only assertion in the script was that the three runtimes agreed with **each
other**. A change that moved a profile's digest identically everywhere printed
the new value and exited 0. The two frozen literals lived in `AGENTS.md`,
`docs/source-trace.md` and three planning documents, and in no file the machine
reads, so the freeze was held by a human comparing 64-character hex strings.

Decision: the script now carries an `EXPECTED_DIGESTS` table and fails when a
pinned case moves. The `default` case is deliberately **not** pinned to a
literal — switching `DEFAULT_PROFILE` moves it on purpose — but to a case name
via `EXPECTED_DEFAULT_CASE`, so a default switch becomes a one-line change that
is still verified rather than an unobserved drift. A case present in
`CASE_NAMES` but absent from `EXPECTED_DIGESTS` is intentionally unpinned; that
is how a newly added profile behaves until its digest is first recorded.

When this fires, the fix is to find and revert the change that altered the wire
bytes. Editing a literal to match the new output defeats the entire point of
the gate and must never be done.

Related: the gate ran in no CI workflow at all. It now runs in the `bun` job of
`.github/workflows/ci.yml`, which is the only job that holds node, bun and the
miniflare/workerd toolchain together, and `test/governance/ci-policy.test.ts`
lists `npm run test:pack` among its required gates so the step cannot be quietly
removed.

## 2026-09-23 — `npm pack --json` has two output shapes; accept both, in one place

Context: npm 12 changed `npm pack --json` and `npm pack --dry-run --json` from
emitting an array of pack results to emitting an object keyed by package name.
Two gates parse that output — the published-tarball policy test and the
cross-runtime digest verifier — and both broke on a contributor machine running
npm 12 while remaining green in CI, which pins node 20/22/24 and their bundled
npm 10/10/11.

Decision: accept both shapes rather than pinning an npm major. The parser lives
once, in `scripts/lib/pack-json.mjs`, and both callers import it; two
independent copies of a parser for an external tool's output is exactly the pair
that drifts when the shape changes again. It also handles a third shape
defensively — a non-null object carrying its own `filename` is returned as-is,
before the keyed-object fallback — because a future npm emitting the single
result flat would otherwise be silently misread into the value of its first
property.

Consequence worth knowing: `tsconfig.eslint.json` gained `allowJs` and a
`scripts/lib/**/*.mjs` include so the TypeScript test file's import of that
JavaScript module resolves to the types its JSDoc declares. Without it, every
call through the import trips `no-unsafe-call` under typed linting. `checkJs`
stays off and `npm run typecheck` is unaffected — it uses `tsconfig.json` and
`tsconfig.types.json`, not that one. A hand-written `.d.mts` sidecar was tried
first and rejected: it matches neither glob in `eslint.config.js`, so it
inherits the type-checked preset with no parser project and crashes `eslint .`
outright.

The keyed-object branch and the `undefined` fallback are covered by
`test/pack/pack-json.test.ts` with literal inputs and no subprocess, because
neither branch runs on any CI machine.

## 2026-09-22 — Upstream binaries are no longer one bundle; carving must concatenate modules

Context: the runbook's Step 0 told the reader to scan the platform executable
for maximal printable-ASCII runs and keep **the single longest one**. That was
correct for every release this package has ported: 2.1.195 and 2.1.233 embed the
whole application as one contiguous multi-megabyte run, with the runner-up
orders of magnitude smaller.

2.1.280 broke that assumption. It is a `// @bun @bytecode` build whose
JavaScript is embedded as roughly 1,100 separate printable runs — each an ES
module carrying the Claude Code banner and ending in `export{…};`, separated by
`NUL`. The longest single run is 4,015,347 bytes out of 36,151,512 relevant
bytes. Applying the old rule recovers about 11% of the application, and none of
the model catalogue.

Decision: **Step 0 now concatenates every printable run at or above a threshold,
in ascending offset order, and requires a second carve at a different threshold
to produce a byte-identical extractor report.** For a single-bundle build the
new rule degenerates to the old one, so it is not a special case for one
release.

Why this is recorded rather than left as a runbook edit: the old rule failed
_silently_. It still produced a syntactically plausible `.js` file, the
extractor still exited 0, and the report was simply short of entries. A future
maintainer who finds the concatenation step verbose and "simplifies" it back to
the longest run would reintroduce a failure mode with no error message. The two
threshold carves are the guard, not decoration.

Concatenation is safe for `scripts/extract-upstream-profile.mjs` specifically
because it is a regex-and-scanner tool and never parses the dump as one
JavaScript program; duplicate declarations and repeated top-level `export{}`
statements across modules cannot produce a syntax error. That guarantee is
tool-specific and must not be generalised.

Accepted cost: a wider search space lets unrelated embedded data reach the
extractor. On 2.1.280 a second, non-CLI model list (the claude.ai application
list, whose entries carry `display_name` and `provider_ids`) contributed three
spurious dated identifiers to the `models` report. Extracted entries are
candidates to confirm against the bundle, never transcriptions to copy. The
detail is in `docs/protocol/versions/claude-code-2.1.280-analysis.md`.

## 2026-08-16 — The external drift verifier is retired; the plugin is no longer the protocol oracle

Context: `npm run drift:check` (`scripts/verify-drift.mjs`, plus the
fixture-driven `test/drift` suite) compared this package's pinned profile data
against a sibling checkout of the `opencode-anthropic-fix` plugin — seven checks
over cliVersion, sdkVersion, endpoint, beta registry, header names, billing
prefix and golden hashes. That worked while the plugin held an independent
transcription of the genuine client: two transcriptions disagreeing was real
evidence.

Decision: **the verifier, its suite, its synthetic fixtures and the `drift:check`
script are deleted.** The plugin has migrated onto this package. It is removing
`lib/request-headers.mjs` and the mimicry functions in `system-prompt.mjs` and
now imports header names, beta strings and version constants from here. Once a
consumer derives its values from this package, comparing the package against
that consumer asserts only that the package equals itself — a tautology that
reads as a green gate. The deletion is not merely tidying: with those plugin
modules gone the script's source-real mode could no longer read anything and
would exit 2 with `SOURCE_UNAVAILABLE` on every run, so the only surviving mode
was the synthetic-fixture one, which tests the verifier rather than the
protocol.

Replacement oracle: **the transcription procedure in
`docs/plans/UPSTREAM-TRACKING-RUNBOOK.md`, run against a genuine Claude Code
binary**, which produces an analysis document under `docs/protocol/versions/`
before any profile module moves. What that procedure yields is pinned
mechanically by the sealed golden fixtures (`npm run fixtures:check`) and
replayed behaviourally by the differential suite. Upstream is the only thing
that can be drifted from, and only a fresh read of upstream can detect it.

This supersedes the "Drift verifier re-anchored to 2.1.233" entry below: the
default-profile and `CLI_TO_SDK_VERSION` reasoning recorded there is still true
of the source, and the part of it that mattered — read the CLI-to-SDK map, never
the standalone fallback constant — now lives in `docs/source-trace.md` where the
transcription procedure can use it. `test/governance/ci-policy.test.ts` carries
a guard so the circular gate cannot quietly return.

Not a version bump and not a re-seal: no `src/` module, no published surface, no
golden fixture and no wire byte changed. Repository infrastructure only.

## 2026-08-16 — Cache: placement is the package's, TTL policy and breakpoint heuristics are the host's

Context: a consumer's cache helper (`lib/mimicry/cache.mjs` in the
`opencode-anthropic-fix` plugin) was reviewed function by function to decide
what, if anything, should migrate into this package.

Decision: **nothing migrates.** The split is already correct, and it is
recorded here so the review is not repeated:

- `resolveCacheTtl` — **host policy.** It reads environment overrides and
  applies a role-scoped TTL. Both halves are host concerns: this package reads
  no environment, and the TTL choice is deployment policy rather than wire
  contract.
- `shouldPlaceToolBreakpoint` and `updateBoundaryStability` — **host
  heuristic.** They are a turn-to-turn stability optimisation: state carried
  ACROSS requests to decide whether a boundary has settled enough to be worth a
  cache breakpoint. This package is a pure function of one request and holds no
  mutable module state, so the heuristic cannot live here without changing what
  the package is. It is also a cost optimisation, not a compatibility
  requirement — a wrong answer costs money, not correctness.
- Canonical `cache_control` placement — **already here.** `src/request-body.ts`
  owns breakpoint placement for the emitted body; that is the part that has to
  match the genuine client byte for byte, and it does.

Consequence: a consumer keeps its cache heuristics and passes the result in
through the existing seams. No new input field was added for TTL or breakpoint
hints.

## 2026-08-16 — Endpoint URL: origin override by the host, no `baseUrl` input

Context: consumers that route through a proxy or a regional endpoint asked
whether the package should accept a base URL.

Decision: **`built.url` stays the profile's pinned, literal-typed endpoint, and
the input gains no `baseUrl` field.** A host with a custom base substitutes
protocol, hostname and port and preserves the package's `pathname` and
`search`. The contract and the four-line recipe are documented in the README
("Endpoint URL and custom base URLs").

Reasons, so the request does not come back:

1. `BuiltClaudeCodeRequest["url"]` is a string literal type. Widening it to
   `string` is a breaking change at the type level for every consumer that
   pins the endpoint — and the pin is a feature: `?beta=true` and the
   `/v1/messages` path are wire contract, not defaults.
2. Speculative surface is not added here. A base-URL field would duplicate what
   `URL` already does and would hand this package a validation and
   normalisation burden it does not need.
3. The only real consumer case observed is an origin override, which the
   documented recipe expresses exactly — including a base URL carrying a path
   prefix, which naive concatenation gets wrong.

## 2026-08-16 — Beta registries exported; the policy sets stay private

Context: consumers were transcribing beta header strings by hand — the
`opencode-anthropic-fix` plugin carries its own copy of
`prompt-caching-scope-2026-01-05` and of the beta shortcut strings — which
drifts silently the moment upstream moves.

Decision: **`BETA_REGISTRY` (28 entries), `BETA_REGISTRY_2_1_233` (31 entries)
and `TOKEN_COUNTING_BETA` are public.** They are protocol constants: the
package transcribed them from the genuine client, so it is the honest owner of
their spelling, and a consumer reading a header off the registry cannot drift
from the package that emits it. Reading a header is not emitting one —
composition, gating and push order stay inside the package.

**`THIRD_PARTY_ALLOWED_BETAS`, `BEDROCK_UNSUPPORTED_BETAS` and
`COUNT_TOKENS_BETAS` (and their `_2_1_233` counterparts) stay private.** They
are policy sets, not constants: no consumer reads them today, and exporting a
set on the theory that someone might is the speculative surface this package
refuses. Aliases and policy sets belong to the host.

`test/validation/beta-registry-surface.test.ts` pins entry shape, header
uniqueness, the deliberate `tool_search` feature-key reuse across
`ADVANCED_TOOL_USE` and `TOOL_SEARCH`, the 2.1.233 additions
(`PROMPT_CACHING_EVICT`, `PER_MESSAGE_EFFORT`,
`SERVER_SIDE_FALLBACK_CATEGORY`, `AUTO_MODE_CLASSIFIER`) and — the load-bearing
one — the NEGATIVE assertion that `NARRATION_SUMMARIES` is absent from the
2.1.233 registry. That absence is upstream's 2.1.222+ removal, not a
transcription gap, and re-adding it would emit a header the genuine client no
longer sends.

Note on the changelog: this release note is **not** in `CHANGELOG.md` yet.
`test/governance/release-policy.test.ts` requires the FIRST `## [version]`
heading to equal the manifest version, so an `Unreleased` or pre-written
`0.5.0` heading fails the gate. The entry lands in the same commit as the
version bump, by design.

Not a re-seal: additive read-only surface, no wire byte changes, golden
fixtures unchanged.

## 2026-08-16 — Model queries: a generic catalogue query plus named identity predicates

Context: consumers need to ask two different kinds of question about a model
id — "does the catalogue record capability X for it?" and "is it Opus 4.7?".
The obvious shortcut is to answer both from one mechanism.

Decision: **`src/model-queries.ts` ships both surfaces and keeps them
separate.**

- `modelCapability(model, capability, profile)` is the generic query. The
  catalogue is the source of truth: normalize the id, look the entry up in
  `profile.supportedModels`, ask whether the verbatim upstream capability
  string is present. It invents no mapping, so it answers for the capability
  strings this package does not model as a `ClaudeCodeCapabilities` field
  (`fast_mode`, `lean_prompt`, `mid_conv_system`, ...) as readily as for the
  six it does. Ids the profile does not catalogue answer `false`: absence of
  evidence is reported as absence.
- The named predicates (`isOpus47Model`, `isHaikuModel`, `isClaude3Model`,
  `isAdaptiveThinkingModel`, ...) are written over `normalizeModelId` and
  `modelFamilyOf`. **A family is not a catalogue capability** — it is an
  identity question — so no new family regex was introduced and the catalogue
  is not consulted. `isAdaptiveThinkingModel` in particular is the union of
  the named family predicates rather than a `adaptive_thinking` catalogue
  read: it gates the emitted `thinking` block shape, and an uncatalogued id
  must not inherit adaptive thinking from the deliberately permissive
  capability fallback documented in `model-capabilities.ts`.

Two deliberate consequences, recorded so they are not "fixed" later:

1. `hasOneMillionContext` is marker-only and does **not** read
   `context.native1m`. The catalogue field states the model's native window;
   the predicate states that the id itself demands 1M. `claude-opus-4-7` is
   natively 1M and still answers `false`. `isEligibleFor1MContext` is the one
   that consults the catalogue (`context.supports1mBeta`), falling back to the
   ported family set for uncatalogued ids.
2. `supportsStructuredOutputs` delegates to the predicate ported from the
   genuine client (`j4e` in `model-capabilities.ts`), not to a family-shaped
   heuristic. One name, one meaning, and the better-evidenced one wins.

Predicates return `false` for a non-string or empty id instead of throwing
`ClaudeCodeWireError("INVALID_INPUT")` as `resolveModel` does. Their upstream
counterparts are total functions on a falsy model, and a predicate that throws
cannot be used in the boolean position its callers put it in.

Not a version bump and not a re-seal: additive read-only surface, no wire byte
changes, golden fixtures unchanged.

## 2026-08-16 — Drift verifier re-anchored to 2.1.233; sdkVersion resolved via the CLI map

Context: `npm run drift:check` compares this package's profile data against an
external consumer project. That project advanced its
`FALLBACK_CLAUDE_CLI_VERSION` from `2.1.195` to `2.1.233`, so the check failed
on `cliVersion` against a source that had simply moved on.

Decision (a): **the default monitored profile is now
`claude-code-2.1.233-sdk-0.112.1`**, the version the live source actually
mirrors. `claude-code-2.1.195-sdk-0.94.0` stays monitored and reachable via
`--profile` rather than being dropped — the profile still ships, and it is
verifiable against a source pinned to that era.

Decision (b): **the `sdkVersion` assertion now resolves the source's SDK
version instead of comparing a constant.** It reads `CLI_TO_SDK_VERSION` for
the profile's CLI version and falls back to the standalone
`ANTHROPIC_SDK_VERSION` constant only when the map has no entry — exactly what
the source's own `getSdkVersion` does. The old comparison (constant ===
profile sdkVersion) reported false drift: upstream holds that constant at
`0.94.0` as the fallback for **unmapped** CLI versions while pairing `2.1.233`
with `0.112.1`. It only ever passed because the default profile happened to sit
in the fallback era, so it was reading a coincidence as a protocol fact. The
second assertion — that the literal `[cli, sdk]` pair appears in the source —
is unchanged, so the check still fails if upstream drops the pairing.

Not a version bump and not a re-seal: no `src/` module, published surface or
golden fixture changed. Only the verifier, its synthetic drift fixtures, its
test, and `docs/source-trace.md` (whose "monitoring covers 2.1.195 only" and
"2.1.233 module does not exist yet" claims were stale).

## 2026-08-15 — TypeScript 7.0.2 bump deferred (typescript-eslint hard-blocks)

Context: Dependabot proposed four dev-tooling bumps. Three landed (globals
17.11.0, @types/node 26.2.0, typescript-eslint 8.67.0). The fourth —
typescript 6.0.3 → 7.0.2 — was attempted and reverted.

Decision: **defer the TypeScript 7 major until typescript-eslint supports
it.** typescript-eslint 8.67.0 does not merely warn on TS 7.0: it throws at
module load ("typescript-eslint does not support TS 7.0"), so `eslint .`
exits 2 before linting anything. Its declared peer range is
`>=4.8.4 <6.1.0`, and upstream tracks TS support for **>= 7.1**, not 7.0
(typescript-eslint/typescript-eslint#10940).

Evidence gathered before reverting, so the next attempt starts informed:
under TS 7.0.2 both `typecheck` configs pass with zero code changes, `build`
passes, and the packed-consumer digests stay byte-identical across all three
runtimes — the compiler itself is a non-event for this codebase; the only
blocker is the linter's version guard.

Rejected alternatives: a side-by-side TS 6 install for the eslint API (adds
a permanent extra dependency for a temporary gap) and an override to silence
the peer range (useless — the block is a runtime check, not a peer-range
assertion).

Unblock condition: a typescript-eslint release that supports TS >= 7.1, then
bump typescript and typescript-eslint together. The Dependabot PR for
typescript 7.0.2 was closed with this rationale; Dependabot will re-propose
on the next TS release.

## 2026-08-15 — Dependabot triage: zeroed via overrides, not upgrades

Context: 8 open Dependabot alerts (2 high, 6 moderate), all
`scope: development`; the published package has zero runtime dependencies, so
none were consumer-facing. Root causes were exactly two transitive chains.

Decisions:

1. **`undici` patched with a _scoped_ override, not a global one.**
   `miniflare@4.20260722.0` pins `undici@7.28.0` (vulnerable range
   `>=7.0.0 <7.29.0`, 5 advisories incl. GHSA-4cwx-7wf7-3272). A second
   `undici@6.28.0` exists under `node-gyp` and is _not_ vulnerable; a global
   override would have forced it across a major. Hence
   `"overrides": { "miniflare": { "undici": "7.29.0" } }`.
2. **`miniflare` was deliberately not bumped.** The newest 4.x
   (`4.20260730.0`) still declares `undici@7.28.0`; the only alternative was
   `5.x-alpha` — a prerelease major, rejected for a security patch. Revisit
   when a stable miniflare ships undici `>=7.29.0`, then drop the override.
3. **`ip-address` patched with a global override** (`10.3.1`, same major;
   GHSA-mwp4-54f8-5fhr + 2 moderates). It sits seven levels below
   `license-checker-rseidelsohn@5.0.1`, which has no newer release; the
   parent `socks` declares `^10.1.1`, so the override is semver-honest.
4. **Overrides are exact pins (no `^`)**, matching the repository's pinned
   devDependency policy checked by `test/governance/package-policy.test.ts`
   (which, note, does not scan the `overrides` key — no test amendment was
   needed).
5. **Two additional `npm audit` highs not yet flagged by Dependabot were
   fixed in the same pass but as a separate lockfile-only commit**:
   `brace-expansion@5.0.9` (GHSA-rgw5-rvv9-x895, via eslint→minimatch) and
   `nanoid@3.3.18` (GHSA-2v37-7h3g-55p8, via vitest→vite→postcss). Both were
   inside existing `^` ranges, so `npm audit fix` moved only the lockfile;
   adding overrides for them would create pins with no safety gain.
6. **Proof standard applied:** `npm audit` at 0 vulnerabilities is not
   sufficient on its own — the full gate suite plus `npm run test:pack` was
   re-run, and the cross-runtime digests stayed byte-identical
   (`2.1.195 = 6b9609b2…0037d277`, `2.1.233 = default = 4e06af42…9a3997`).
   This matters because the workerd packed consumer executes on the patched
   undici, so a digest move would have signalled a behavioural regression.

Maintenance note: the two `overrides` entries are debt by design. When the
upstream parents absorb the patched versions, remove the overrides in the
same commit that bumps the parent, so stale pins do not mask future
resolutions.

Commits: `9b89d7f` (overrides), `21f1878` (lockfile-only audit fix), merged
via PR #15 (`2ba35a8`).

## 2026-09-23 — Phase 5.1 QA: three accepted findings on the 2.1.280 fixtures

Context: the adversarial QA review of Phase 5.1 (the claude-code-2.1.280
golden fixtures) surfaced three behaviours that look like defects but are
deliberate or inherited. They are recorded here so they are not "fixed" by
accident.

Decisions:

1. **The manifest assertion in `test/golden-fixtures.test.ts` stays
   one-directional.** It walks the names sealed in `manifest.fixtures` and
   asserts each is registered in the test's own filename list; it does not
   walk that filename list asserting each entry is sealed. So a fixture
   registered in the test but missing from the manifest passes `npm test`
   and is caught only by `npm run fixtures:check`, an end-of-wave gate rather
   than a per-commit one. The gap is kept on purpose: closing it would turn
   the first commit of every add-then-seal split red, and that split is
   itself forced by `scripts/seal-golden-fixtures.mjs`, which refuses to run
   while a fixture is untracked or merely staged. This is a known, accepted
   asymmetry; making the check bidirectional breaks the fixture-landing
   procedure.
2. **`outgoing-default-path-2.1.280.json` carries no `output_config`, and
   that is faithful within this package.** It is now the sealed canonical
   default-path evidence, even though the pinned catalogue declares a default
   effort of `medium` for `claude-opus-5-5`. Here the effort beta header is
   pushed from the model capability, while the body's `output_config.effort`
   is emitted only when the caller supplies an `effort` input, the emitted
   thinking type is adaptive, and no `outputConfig` was supplied; the
   fixture's input supplies no effort. What is not established is what the
   genuine client writes back to its request object on that path: the 2.1.280
   analysis document records the upstream statement that deletes
   `output_config` and then calls the beta/effort pusher, but transcribes only
   that pusher's header side. The behaviour is pre-existing and identical on
   2.1.233; it is an open documentation question, not a defect.
3. **The one-hour `cache_control` TTL in the sealed bodies does not
   contradict the derivation.** The 2.1.280 analysis document's
   fourteen-identifier default-path derivation assumes a five-minute cache
   TTL and on that basis excludes the extended-cache-ttl beta. The sealed
   fixture bodies still carry a one-hour TTL on their prompt blocks while
   omitting that beta, because this package hardcodes the one-hour TTL on
   those blocks and pushes the beta only from an explicit caller TTL input.
   The two 2.1.233 fixtures have the identical shape, so this is inherited
   modelling, not a 2.1.280 delta, and must not be mistaken for drift.

## 2026-09-23 — claude-code-2.1.280 behaviour-flag audit: no new flag

Context: the upstream-tracking runbook schedules the behaviour-flag audit as
the final step of a port, so that the porter deliberately asks whether any
delta genuinely requires a `profile.id` comparison instead of finding out
later that one was added by reflex. This entry records the answer for the
2.1.280 port so the next porter does not have to argue it again.

Decisions:

1. **`src/profile-behaviors.ts` gained no flag, and none was needed.** Every
   2.1.280 delta falls into a data category that is not version-gated.
   Registry data covers the new beta entries and the three auxiliary sets,
   each chosen per profile through a map keyed on profile id — a lookup, not
   a branch. Profile scalars and policy booleans, the cache-diagnosis flip
   among them, are read directly off the profile object. Catalogue strings
   cover the two new capabilities, which are mapped once in the
   catalogue-backed table and then derived per model, not per version. The
   new beta push sites each combine a test that the registry key is present
   with capability booleans, policy booleans, or a local flag noting that an
   earlier site fired. When a registry lacks the key, its site is silently
   inert — the same mechanism that already keeps the narration-summaries site
   inert on the newer profiles.
2. **Each existing flag was checked against the 2.1.280 bundle rather than
   assumed, and the strength of the evidence differs between them.**
   - The request-derived token ceiling is confirmed. The bundle's
     output-limit function lifts the upper limit to the caller's own
     `max_tokens` and reduces the default to fit beneath it, provided that
     value is at least 4096 — the threshold this package already implements.
   - The billing chaining segments are confirmed. The bundle's billing-block
     builder emits both `cc_prev_req` and `cc_prompt_id`, and their validation
     patterns match the patterns this package declares character for
     character.
   - The opus-4-5 effort exception being off was not positively located in
     the bundle. It rests on the module's modern default and is corroborated
     only indirectly, by the transcribed 2.1.280 catalogue giving that model
     no effort capability at all. This one is asserted, not verified; a later
     porter should re-check it first.

   The module's default deliberately sits on the modern side, so a profile
   ported from a newer client inherits current behaviour without an edit.
   Nothing in this audit suggests any flag needs a third frozen behaviour set.

3. **What mechanisms this port added, and why that wave ran between
   registration and the canary.** Capability derivation widened from six
   fields to eight. The beta push sequence grew from seventeen sites to
   twenty-two, plus a removal: the redact-thinking identifier is composed and
   then spliced back out when the display-updates site fires. The thinking
   display-updates injection is a single change that surfaces as a beta
   identifier, a body field, and that removal. The wave sat after
   registration and before the canary because these are data-driven
   mechanisms that stay inert for the older registries and catalogues: they
   had to be final before the canary froze a digest over them and before the
   fixtures sealed bytes derived from them. Registering first also let every
   mechanism test drive the real registered profile through the public
   builder rather than a test double. The cost of this ordering was bounded:
   between the end of the registration wave and the end of the mechanism wave,
   a pinned 2.1.280 request emitted an intermediate beta list. That was
   acceptable because the default profile was untouched, nothing was released,
   no fixture existed yet, and no test asserted the intermediate list.
4. **Billing segments the package does not model at all.** While checking
   the chaining segments, the bundle's billing-block builder was found able to
   emit a workload segment and a sub-agent segment as well. Both derive from
   the session or host rather than from the caller, which places them in the
   same class as the already-recorded omission of the context-hint
   token-saving field. They are known and deliberately unmodelled; the next
   porter should not mistake their absence for a regression.

## 2026-09-23 — corrections to the 2.1.280 behaviour-flag audit entry

Context: an adversarial review of the entry above found that one of its
supporting arguments does not support what it was cited for, and that two of
its summary sentences are true but incomplete in ways that would mislead a
reader who skims. `MEMORY.md` is append-only, so the corrections are recorded
here rather than by editing that entry.

Decisions:

1. **The opus-4-5 corroboration was mis-framed.** The entry above cited the
   2.1.280 catalogue giving `claude-opus-4-5` no effort capability as
   indirect corroboration that the opus-4-5 effort exception is off for that
   profile. That argument does not hold. The catalogue row for that model is
   byte-identical in the 2.1.195 and 2.1.280 catalogue files — same family,
   same lone `context_management` capability, same output-token limits — and
   on 2.1.195 the exception is on. The same omission therefore coexists with
   both values of the flag, so it cannot be evidence for either. What the
   omission actually is: the precondition that makes the flag consequential
   at all. If the catalogue listed the capability, the flag would have
   nothing to correct. What the flag really claims, per the demarcated
   exception block in `src/model-capabilities.ts`, is that upstream from
   2.1.222 onward derives a catalogued model's capabilities from the
   catalogue array, where the older client derived them from predicate code
   whose effort predicate does not exclude this model. So the genuine
   re-check target is whether upstream 2.1.280 derives a catalogued model's
   effort capability from the catalogue array or from a predicate exclusion
   list — or whether its predicate now excludes this model, which would make
   the flag moot. Re-reading the catalogue row answers nothing. The
   wire-visible stake, which the entry above did not state: the effort
   capability gates the effort push site in `src/betas.ts`, so this one
   unverified flag decides whether a 2.1.280 request naming
   `claude-opus-4-5` carries `effort-2025-11-24` in its beta header, and
   whether the body carries an `output_config` effort field. No 2.1.280
   golden fixture exercises that model today — the sealed set uses
   `claude-sonnet-4-5`, `claude-opus-4-8` and `claude-opus-5-5` — so the
   differential cannot upgrade the grade until such a fixture exists.
2. **The lead sentence of the flag discussion overstates.** The entry above
   opens its flag discussion by saying each existing flag was checked
   against the bundle rather than assumed, which a skimmer will read as all
   of them having been located. The accurate form is that two of the three
   were located in the bundle and the third was searched for and not found.
   The per-flag bullets that follow are correct; only the lead is too
   strong.
3. **The inertness claim is incomplete.** The entry above says a registry
   lacking a key leaves its push site silently inert, which is true but not
   the whole mechanism. The per-message-effort key is declared by the
   previous pin's registry, so registry absence does not keep that site
   inert there; what keeps it inert is the catalogue not declaring the
   matching capability string. Both mechanisms are load-bearing and they are
   not interchangeable — a reader who took the registry-absence sentence as
   universal would wrongly conclude every new push site is registry-inert on
   the older profiles. The comment on the composable registry type in
   `src/betas.ts` already makes this point in code.

## 2026-09-23 — claude-code-2.1.280: seven port decisions

Context: these are decisions taken during the 2.1.280 port that a later
reader would otherwise have to re-derive from the code or re-litigate from
scratch. Each is recorded here because it had a plausible alternative that
was considered and rejected.

Decisions:

1. **The cache-diagnosis policy flag was flipped for the new profile only.**
   The 2.1.280 profile sets `cacheDiagnosisEnabled` to `true`, because the
   analysis document's section on that gate resolves all three of its legs
   to true on a first-party install. The previous pin keeps `false`. Whether
   that earlier value was always wrong cannot be settled without the earlier
   release's binary, and inferring one release's value from another's is
   precisely what the tracking runbook forbids. The older profile was
   therefore deliberately left alone rather than "corrected" by analogy.
2. **The thinking-display type widening was proposed and then withdrawn.**
   An early design would have added the injected wire value to the exported
   `ThinkingDisplay` union. That was rejected. The exported type stays
   `"summarized" | "omitted"` and stays caller-facing. The injected value is
   typed as a bare string literal at internal seams only — an optional
   override field on the composed-betas result, and an optional trailing
   parameter of the thinking resolver — and neither seam is exported from
   `src/index.ts`. Widening the exported type would have silently changed
   the meaning of a name consumers may already switch on, and it would have
   invited someone to "fix" the request-body validator into accepting that
   value as caller input. Upstream never accepts it as caller input: the
   injection's own guard requires that the caller supplied no display at
   all. `src/request-body.ts` still rejects it with `INVALID_THINKING`.
3. **The redact-thinking removal runs before the caller-supplied beta
   merge.** The removal is the last statement inside the display-updates
   push site's own block, which puts it ahead of the `additionalBetas`
   merge. That ordering is load-bearing in the caller's favour: a caller who
   explicitly supplies the redact-thinking identifier still gets it on the
   wire, precisely because the canonical copy was already spliced out and
   the merge's "not already present" test therefore succeeds. Had the
   removal run after the merge, it would have eaten the caller's own entry.
4. **Suppressing a beta removes the header and nothing else.** For a coupled
   beta-and-body pair, `suppressBetas` is header-only by contract: the
   filter is subtractive over the composed identifier list and touches no
   body field. Suppressing the display-updates identifier removes the header
   but leaves the body's display value in place, and it does not bring
   redact-thinking back. This matches the pair that already existed:
   suppressing the effort identifier leaves the body's effort field
   untouched. A caller who wants neither half has the upstream-faithful
   lever instead — supply a display explicitly, which disarms the injection
   at its own guard.
5. **The per-turn timing capability string is deliberately not mapped.** It
   is a real capability string in the 2.1.280 catalogue and it has a
   registry entry, but its push site is gated on an environment variable
   this package does not read. Mapping it to a derived capability would
   create a capability the package can never act on, so the string is left
   unmapped, and the omission is recorded here rather than left to look like
   an oversight.
6. **Ten catalogue keys are read and discarded.** The ported catalogue
   models only what a request reads. These keys exist upstream and are
   knowable without I/O, but no request field derives from them, so carrying
   them would widen the package's surface with values nothing consumes:
   `display_name`, `knowledge_cutoff`, `provider_ids`,
   `eager_input_streaming`, `vertex_region_env_var`, `fallback_3p`,
   `pricing`, `effort_cost_index`, `image_limits` and `advisor_rank`.
   Separately, the context object is present only on the models that
   declare one; a model with no context key simply has none, and that
   absence is data, not a gap in the port.
7. **The beta composer takes one thinking signal, not two.** The new
   thinking push sites differ by exactly one further conjunct — whether the
   caller supplied a display. Giving the composer a single required
   `thinkingActive` boolean and letting the display site add that one extra
   test keeps the sites from drifting apart. Separate input fields would
   have allowed them to disagree in a case upstream has no analogue for,
   which is the kind of divergence that survives every test because nothing
   pins it.

## 2026-09-23 — claude-code-2.1.280: the shared model-id normalizer reaches the previous pin

Context: a global adversarial review of the 2.1.280 port found that the
behaviour-flag audit entry above understates the port's reach. The model-id
normalizer, `normalizeModelId` in `src/model-identity.ts`, is one ladder
shared by every profile, and the port added five rungs to it
(`claude-fable-5-1`, `claude-mythos-5-1`, `claude-opus-5-5`, `claude-opus-5`
and `claude-sonnet-5`). Two of those rungs change what the 2.1.233 pin
resolves for ids its own catalogue never listed.

Decisions:

1. **The behaviour-flag audit entry is corrected for one file.** That entry
   concluded that the port added no per-version behaviour flag and that every
   delta was data-driven. That holds for the beta registry, the model
   catalogue, the profile scalars and the push sites, and it does not hold for
   the model-id normalizer: its ladder carries no per-version gate, so the
   rungs added for 2.1.280 also change what `CLAUDE_CODE_2_1_233_PROFILE`
   resolves for `claude-fable-5-1` and `claude-mythos-5-1`, and for
   `claude-mythos-5-1` that changes the emitted request. Under the 2.1.233 pin
   that id previously collapsed onto `claude-mythos-5` and inherited that
   model's deliberate empty-capability catalogue row. It now keeps its own id,
   finds no catalogue row, and falls through to the permissive predicate path
   instead, which adds `context-management-2025-06-27`,
   `mid-conversation-system-2026-04-07` and `effort-2025-11-24` to the
   `anthropic-beta` header and turns the emitted thinking object from a
   budgeted one into an adaptive one. The packed-consumer digests cannot see
   this, because their probe model, `claude-sonnet-4-5`, is untouched by every
   new rung. `test/validation/shared-normalizer-ladder.test.ts` now pins the
   current header and thinking object so the behaviour cannot drift silently.
2. **The ladder was not gated behind a behaviour flag.** Gating would require
   asserting that the 2.1.233 client's own ladder lacked those rungs. Neither
   older analysis document transcribes that client's normalizer at all, so
   such an assertion would be an inference from silence — the cross-release
   inference the upstream-tracking runbook forbids. The affected ids are not
   in the 2.1.233 catalogue, so a caller pinning that profile and naming one is
   naming a model that release never shipped; the old answer and the new one
   are both guesses about something this repository cannot know. The
   deliberate choice is one shared ladder, transcribed from the one binary
   that was actually read, with the consequence recorded here and pinned by a
   test. Settling which answer the genuine 2.1.233 client gives needs that
   release's binary.
