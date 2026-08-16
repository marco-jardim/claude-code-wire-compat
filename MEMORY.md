<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Decision memory

Append-only log of non-obvious maintenance decisions and their reasoning, so
future work does not re-litigate or accidentally reverse them. Newest entries
first. Keep entries dated, factual, and in consumer-neutral language.

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
