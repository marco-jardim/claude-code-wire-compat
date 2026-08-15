<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Contributor operating guide

Guidance for automated contributors and new maintainers. This file collects
the operational knowledge needed to work on this repository without
rediscovering it: the canonical procedures, the traps, and where everything
lives.

Non-obvious maintenance decisions and their reasoning live in
[`MEMORY.md`](./MEMORY.md), an append-only dated log. Read it before
revisiting a dependency, tooling, or policy question — the answer may already
have been decided, and reversals should be deliberate, not accidental.

## What this package is

A pure, I/O-free TypeScript library that builds byte-faithful Claude Code
wire requests for a pinned upstream release ("profile"). Correctness is
defined as indistinguishability from the genuine client on the wire, proven
by golden fixtures, differential conformance, and cross-runtime digests —
never by assumption.

## The upstream-tracking task

Porting a new Claude Code release is the recurring maintenance task. The
canonical, step-by-step procedure is
[`docs/plans/UPSTREAM-TRACKING-RUNBOOK.md`](./docs/plans/UPSTREAM-TRACKING-RUNBOOK.md).
Read it first; do not improvise the order. Summary of its shape:

1. Acquire the platform binary (`npm pack @anthropic-ai/claude-code-<platform>@<version>`),
   carve the embedded JS bundle (largest printable run; offsets change every
   build).
2. Run `npm run extract:profile -- --dump <carved.js>` and treat every
   `unresolved` marker as a manual-extraction task, never a guess.
3. Write the first-party analysis doc in `docs/protocol/versions/` BEFORE any
   code (provenance test requires it per profile).
4. Work the gate checklist in the runbook top to bottom — ~30 files/tests
   fail or go silently stale when a profile is added.
5. Order of attack: analysis doc → beta registry → catalogue/profile →
   export/registration → packed-consumer canary → default switch (isolated
   one-line commit) → fixtures + seal → matrix registration → behaviour
   flags.

Freeze the target version for the whole cycle. Upstream publishes roughly
one version per day; re-targeting mid-cycle multiplies verification work.
New versions enter the next cycle.

## Architecture breadcrumbs

- **Profiles are data**: `src/profiles/claude-code-<v>.ts` (scalars +
  17-model catalogue) and `src/profiles/beta-registry-<v>.ts` (ordered beta
  registry). Extracted from the binary, never invented.
- **Behaviour is flags**: `src/profile-behaviors.ts` holds every per-version
  behaviour decision behind named flags with a single demarcated
  `profile.id` comparison. `test/governance/version-dispatch.test.ts` fails
  any version branch placed anywhere else in `src/`.
- **Default seam**: `DEFAULT_PROFILE` in `src/build-request.ts` — the single
  greppable point that decides what an unpinned caller gets. Switching it is
  always its own one-line commit.
- **Acceptance is identity, not shape**: `ACCEPTED_PROFILES`
  (`src/build-request.ts`) and `parseProfile` (`src/headers.ts`) compare by
  object identity against the exported singletons; `src/redaction.ts` keeps
  its own `PINNED_PROFILE_IDS` string set because it validates untrusted
  evidence.
- **Beta composition**: `src/betas.ts` resolves the registry per profile via
  `PROFILE_BETA_REGISTRIES` (keyed by profile id). The 17-step push order is
  emergent upstream behaviour and load-bearing — never reorder it. A beta
  absent from a profile's registry skips its step silently.
- **Fingerprint**: salt `59cf53e54c78` + characters 4/7/20 of the first user
  text + version string, SHA-256, first 3 hex chars. Known-answer vectors
  must be computed independently outside this package (a vector produced by
  the code under test only proves self-consistency). Known vectors:
  2.1.195 → `offline cch probe`=`7fe`, `hello wire compat`=`0f6`,
  `canary probe`=`12f`; 2.1.233 → `365`, `413`, `cea` for the same probes.

## Proof obligations (what "green" means)

- `npm run test:pack` — cross-runtime (node/bun/workerd) digests per profile
  from a packed tarball. The previous pin's digest must never move:
  2.1.195 = `6b9609b29463c890544845dd94acf560206b6f8165538faafd8886750037d277`,
  2.1.233 = `4e06af42310d63549a4fa9af60ff0c9b13e95d7864624c6b7bf94d45ce9a3997`.
- `npm run fixtures:check` — byte seal over `test/fixtures/golden/`.
- `test/conformance/differential.test.ts` — behavioural replay of fixtures
  through the builder. The seal guards echoed bytes; the differential guards
  derived fields. Both must fire on a mutation of a derived field.
- Coverage thresholds in `vitest.config.ts` sit just below the measured
  baseline (99.04/98.8/100/99.69) — a real drop fails the gate.
- Per-commit gates: `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`.
  End-of-phase adds `test:coverage`, `pack:check`, `test:pack`,
  `npx vitest run test/drift`, `fixtures:check`.

## Troubleshooting / traps

Tooling:

- There is no `npm run format`; use `npx prettier --write <files>`.
  `docs/protocol/` is prettier-ignored (byte-faithful ported material).
- vitest 4 removed `--reporter=basic`.
- ESLint here bans `ReadonlyArray<T>` (use `readonly T[]`), the two-argument
  `expect(value, message)` form, and `toThrowError` (use `toThrow`). Put the
  diagnostic inside the asserted value when you need a readable failure.
- `tsconfig` uses `exactOptionalPropertyTypes`: build optional fields with
  conditional spreads, not `field: maybeUndefined`.
- On Windows, `Get-FileHash -Algorithm SHA256` matches the raw-byte hashing
  the tests use; the seal script detects and preserves per-file EOL.

Governance tests that bite (beyond the runbook checklist):

- `test/docs/links.test.ts` resolves every relative Markdown link in every
  doc — a broken link anywhere fails the suite. Prefer backtick code spans
  for file paths. Every file under `docs/protocol/` must also be linked from
  the root `README.md`.
- `test/docs/provenance.test.ts`: every doc under `docs/protocol/` must be
  registered as ported or first-party; every profile version must have an
  analysis doc.
- `test/governance/public-path-coverage.test.ts`: each non-allowlisted
  `test/validation/*.test.ts` must import `../../src/index.js` at least
  once; deep imports are otherwise fine.
- `test/governance/source-hygiene.test.ts` bans certain literals (for
  example the name of the non-cryptographic hash rhyming with "xxHash") in
  `src/` — paraphrase in code comments; docs are exempt.
- `test/governance/baseline-evidence.test.ts` enforces a bijection between
  `test/fixtures/golden/` and the hash table in
  `docs/plans/baseline-2026-08-05.md`. Any fixture addition needs a
  hand-written row plus a dated amendment blockquote there.
- `test/governance/package-policy.test.ts` pins the manifest version and the
  `exports` block as literals; `test/governance/release-policy.test.ts`
  requires the first `## [x]` CHANGELOG heading to equal
  `package.json.version` (dated for stable, undated for prerelease);
  `test/runtime/runtime-neutral.test.ts` pins the public export set as a
  closed sorted list.
- Six drift mirrors under `test/drift/fixtures/*/test/fixtures/golden/manifest.json`
  must track the real manifest after every seal; the `golden-hash` mirror is
  deliberately mismatched — do not "fix" it.
- `fixtures:seal` refuses on: modified tracked files outside its two
  targets, untracked files inside the golden directory, and any truthy `CI`
  env. `manifest.models` is hand-maintained seal _input_ — edit it by hand
  when adding fixtures, or the doc table renders `n/a`.

Binary extraction:

- The published parent npm package is a wrapper; binaries live in the
  per-platform packages. Bundles are not byte-identical across platforms
  (platform-tagged constants, build timestamps) — extract all scalars from
  one platform's build.
- The extractor fails closed by design: `stainlessPackageVersion` (constant
  declared far from its header literal) and an ambiguous `userAgent` come
  back `unresolved`; registry entries may carry identifier-valued headers
  (upstream declares `oauth_auth` that way).
- Betas' _emission conditions_ are not extractable from string diffs alone;
  most 2.1.233 additions (cache-evict, per-turn-effort, server-side
  fallback, auto-mode classifier) never emit in the main request path under
  defaults — see the analysis docs before modelling a new beta as emitted.

Process:

- Never run two writing tasks against the same worktree concurrently; stage
  explicit paths, never `git add -A`.
- Commits: Conventional Commits, `git commit -s`, one concern per commit.
  Data ports, canary updates, and default switches are always separate
  commits so each is independently revertable.
- The tree is never left red: if a change requires a companion test/guard
  amendment to stay green, they land in the same commit with the reason in
  the body.

## Release

1. Bump `package.json` and add the dated CHANGELOG heading in the same
   commit (`release-policy` enforces coherence). Breaking default-profile
   changes get a prominent consumer-facing Breaking section with the exact
   rollback instruction (pin the previous profile singleton).
2. PR to `main`; CI runs the full matrix (node 20/22/24, bun, workerd,
   quality).
3. Publishing is OIDC trusted publishing via
   `.github/workflows/publish.yml`, triggered by publishing a GitHub release
   (or manual `workflow_dispatch`). Do not set `NODE_AUTH_TOKEN`; classic
   tokens are disabled for this package. Prerelease versions (`-` in the
   version) go to the `beta` dist-tag, stable to `latest`.
