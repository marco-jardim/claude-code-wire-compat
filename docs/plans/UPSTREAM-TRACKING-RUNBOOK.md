<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Upstream tracking runbook

How to port a new Claude Code release into this package.

This document assumes no prior familiarity with the repository. Follow the
steps in order. Every file path quoted in backticks below exists in the
repository today and is verified by `test/governance/runbook-citations.test.ts`;
names written with angle brackets, such as `claude-code-<version>.ts`, are
placeholders for the release being ported.

Vocabulary used throughout:

- **profile** — the frozen description of one upstream release: its user agent,
  header values, model catalogue, and token limits. One file per release under
  `src/profiles/`.
- **beta registry** — the ordered set of beta feature identifiers that release
  advertises, plus the slot layout it uses. One file per release under
  `src/profiles/`.
- **behaviour** — a difference in what the client _does_ rather than what it
  _declares_. Behaviour differences are expressed as flags in
  `src/profile-behaviors.ts`, never as version comparisons at call sites.

---

## Step 0 — acquire the artifact

The published parent package is a thin wrapper. It contains no binary. The
binary lives in the per-platform packages, so fetch one of those directly:

```
npm pack @anthropic-ai/claude-code-<platform>@<version>
```

`<platform>` is a target triple such as `win32-x64`, `darwin-arm64`, or
`linux-x64`. Any platform works for extraction purposes; the embedded
JavaScript is identical across them. Pick whichever downloads fastest.

Extract the tarball. Inside is a single large executable produced by the Bun
compiler. That executable embeds the entire application as one contiguous run
of printable text — the JavaScript bundle — surrounded by machine code and
compressed resources.

To carve the bundle out:

1. Read the executable as bytes.
2. Scan for maximal runs of printable ASCII (roughly byte values `0x09`,
   `0x0a`, `0x0d`, and `0x20`–`0x7e`).
3. Keep the single longest run. On recent releases it is tens of megabytes,
   while the next longest candidate is orders of magnitude smaller, so the
   winner is unambiguous.
4. Write that run to a `.js` file.

Do not hardcode byte offsets. The offset of the bundle, its length, and the
surrounding padding all change on every build — including rebuilds of the same
version number for a different platform. Rediscover the region every time.

The carved file is a multi-hundred-megabyte text file. Keep it outside the
repository working tree; it must never be committed.

## Step 1 — run the extractor

```
npm run extract:profile -- --dump <path-to-carved-js>
```

The extractor is `scripts/extract-upstream-profile.mjs`. It is a read-only
analyser: it parses the carved bundle and prints a report. It never writes to
`src/`.

The report has four sections.

**Registry entries with slot and null accounting.** Every beta identifier the
bundle declares, in declaration order, with the slot index it occupies. Empty
slots are reported explicitly as nulls rather than being silently collapsed,
because slot position is part of the wire contract — a beta that moved from
slot 3 to slot 4 is a wire change even though the identifier set is unchanged.
Check that the reported slot count matches the reported entry count plus the
null count before trusting anything downstream.

**Model catalogue.** Model identifiers together with the per-model fields the
bundle carries. Unrecognised fields are surfaced rather than dropped; an
unrecognised field is a signal that the upstream schema grew and that
`src/model-capabilities.ts` may need a corresponding field.

**Scalars.** Flat values lifted from the bundle header: version string, user
agent template, package version constants, and similar single-valued data.

**Unresolved markers.** Anything the extractor could not determine with
certainty is reported as `unresolved`. These are refusals, not failures.
An `unresolved` value means the heuristic that normally recovers that value did
not match with sufficient confidence, and the extractor declines to emit a
value it cannot justify. Resolve each one by hand against the carved bundle and
record how you resolved it in the analysis document from Step 3. **Never
substitute a guess, an interpolation from the previous release, or a value
copied from another platform's build.** A wrong scalar in a profile is worse
than a missing one: a missing one fails loudly at review, a wrong one ships.

Two limitations are known and documented in
`test/tooling/extract-upstream-profile.test.ts`:

- **`stainlessPackageVersion`** is declared as a standalone constant far from
  the header literal that consumes it. The extractor's header-anchored scan does
  not reach it, so it is normally reported as unresolved and must be recovered
  manually by searching the carved bundle for the constant's declaration.
- **`userAgent`** fails closed. When more than one candidate template matches,
  or when the single match is ambiguous, the extractor reports unresolved
  rather than picking one. This is deliberate: the user agent is the most
  load-bearing single string in the whole profile.

## Step 2 — diff against the committed data

Compare the report against the currently pinned release:

- `src/profiles/claude-code-<current>.ts` — the profile.
- `src/profiles/beta-registry-<current>.ts` — the beta registry.

At the time of writing, the pinned release files are
`src/profiles/claude-code-2.1.233.ts` and
`src/profiles/beta-registry-2.1.233.ts`, with
`src/profiles/claude-code-2.1.195.ts` retained as the previous pin.

Classify every delta into exactly one of two buckets. The classification
determines the entire shape of the work.

**Data deltas** — a changed user agent, a new or removed beta identifier, a
reordered slot, a new model, changed token limits. These are handled by adding
new profile files. No existing source file changes its logic; the new release
simply gets its own frozen description alongside the existing ones.

**Behaviour deltas** — the client sends a block it did not send before,
suppresses one it used to send, changes how it counts tokens, or changes
billing metadata semantics. These cannot be expressed as data. They require a
new flag in `src/profile-behaviors.ts`, consumed at the relevant seam. They must
not be expressed as a version string comparison anywhere else in `src/`;
`test/governance/version-dispatch.test.ts` enforces that every per-version
decision routes through the behaviour module.

If a delta looks like data but requires an `if` at a call site, it is a
behaviour delta. Reclassify it.

## Step 3 — write the per-version analysis document

Create `docs/protocol/versions/claude-code-<version>-analysis.md`.

The document records what changed on the wire, what evidence supports each
claim, and how every `unresolved` marker from Step 1 was resolved. It is the
audit trail: a reader must be able to reconstruct your conclusions from the
carved bundle without repeating your reasoning.

The document is first-party — authored here, not ported from another
repository — so it carries a first-party provenance header. Use
`docs/protocol/versions/claude-code-2.1.233-analysis.md` as the template and
match its header exactly.

Two registrations are required, and both are enforced:

1. Add the file to the first-party list in `test/docs/provenance.test.ts`.
   That test fails on any document under `docs/protocol/` that is neither
   listed as ported nor listed as first-party.
2. Add the link bullet to the protocol documentation section of `README.md`.
   `test/docs/links.test.ts` requires every file under `docs/protocol/` to be
   linked from the README, and separately requires every relative link in every
   Markdown file to resolve on disk.

`docs/protocol/versions/README.md` explains when a new analysis is required.

Note that `test/docs/provenance.test.ts` also requires an analysis document to
exist for every version declared in `src/profiles/`. Writing the analysis
before adding the profile keeps the suite green at every commit; doing it in
the other order does not.

## Step 4 — the gate checklist

Adding a profile touches a wide surface. Every row below is a gate that fails,
or a seam that silently goes stale, if it is skipped. Work the table top to
bottom.

| File                                                                    | What to update                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/protocol/versions/README.md`                                      | No change needed unless the criteria for requiring an analysis change.                                                                                                                                                                          |
| `src/profiles/beta-registry-<version>.ts`                               | New file. The beta identifier set and slot layout for the release.                                                                                                                                                                              |
| `src/profiles/claude-code-<version>.ts`                                 | New file. User agent, header values, model catalogue, token limits.                                                                                                                                                                             |
| `src/betas.ts`                                                          | Add the new registry to the `PROFILE_BETA_REGISTRIES` map, keyed by profile id.                                                                                                                                                                 |
| `src/build-request.ts`                                                  | Add the profile id to `ACCEPTED_PROFILES`. Leave `DEFAULT_PROFILE` alone at this stage; it is a separate commit.                                                                                                                                |
| `src/headers.ts`                                                        | Extend `parseProfile` so the new id is accepted from the wire-facing input.                                                                                                                                                                     |
| `src/redaction.ts`                                                      | Add the profile id to `PINNED_PROFILE_IDS` so redaction knows the id is a pinned constant and not user data.                                                                                                                                    |
| `src/index.ts`                                                          | Export the new profile constant.                                                                                                                                                                                                                |
| `package.json`                                                          | Add the `./profiles/claude-code-<version>` subpath export, pointing at the built `.d.ts` and `.js`.                                                                                                                                             |
| `test/governance/package-policy.test.ts`                                | The exports block is compared against a literal in this test. Update the literal to match `package.json` exactly.                                                                                                                               |
| `test/runtime/runtime-neutral.test.ts`                                  | The public export set is closed and asserted exhaustively. Add the new profile constant.                                                                                                                                                        |
| `test/support/profile-matrix.ts`                                        | Register the profile _and_ its beta registry. This is the fan-out point: many suites iterate this matrix, so a missing registration reads as a silently narrower test run rather than a failure.                                                |
| `test/governance/profile-coverage.test.ts`                              | Requires at least one golden fixture whose `profileId` is the new id. Adding the profile without a fixture fails here.                                                                                                                          |
| `test/governance/provider-scope.test.ts`                                | If the release introduces a new `*_BETAS` export, add it to `REFERENCE_IDENTIFIERS`. Profiles themselves are discovered automatically by the `profiles/claude-code-` filename prefix, so no registration is needed for the profile file itself. |
| `test/governance/source-trace-profiles.test.ts`                         | Requires a row for the profile in `docs/source-trace.md` and requires the analysis document from Step 3 to exist.                                                                                                                               |
| `docs/source-trace.md`                                                  | Add the profile row: which upstream artifact each committed value came from.                                                                                                                                                                    |
| `test/governance/version-dispatch.test.ts`                              | No edit if you followed Step 2. This test fails if any per-version branch landed outside `src/profile-behaviors.ts`.                                                                                                                            |
| `src/profile-behaviors.ts`                                              | Only for behaviour deltas. Add the flag and default it for existing profiles so their behaviour is unchanged.                                                                                                                                   |
| `scripts/verify-packed-consumers.mjs`                                   | Add the per-profile digest case. This script resolves the built subpath export from a packed tarball, so it is the canary that proves the export actually ships.                                                                                |
| `test/fixtures/golden/`                                                 | Add golden fixtures for the new profile id, then run `npm run fixtures:seal`.                                                                                                                                                                   |
| `test/fixtures/golden/manifest.json`                                    | Sealed by `scripts/seal-golden-fixtures.mjs`, except the `manifest.models` entries, which are hand-maintained and must be edited by hand.                                                                                                       |
| `docs/plans/baseline-2026-08-05.md`                                     | Add the evidence row for each new fixture. `test/governance/baseline-evidence.test.ts` enforces a bijection between fixtures and evidence rows, so an extra or missing row fails.                                                               |
| `test/drift/fixtures/billing-prefix/test/fixtures/golden/manifest.json` | Mirror of the real manifest. Update to match.                                                                                                                                                                                                   |
| `test/drift/fixtures/cli-version/test/fixtures/golden/manifest.json`    | Mirror of the real manifest. Update to match.                                                                                                                                                                                                   |
| `test/drift/fixtures/endpoint/test/fixtures/golden/manifest.json`       | Mirror of the real manifest. Update to match.                                                                                                                                                                                                   |
| `test/drift/fixtures/header-name/test/fixtures/golden/manifest.json`    | Mirror of the real manifest. Update to match.                                                                                                                                                                                                   |
| `test/drift/fixtures/unknown-beta/test/fixtures/golden/manifest.json`   | Mirror of the real manifest. Update to match.                                                                                                                                                                                                   |
| `test/drift/fixtures/valid/test/fixtures/golden/manifest.json`          | Mirror of the real manifest. Update to match.                                                                                                                                                                                                   |
| `test/drift/fixtures/golden-hash/test/fixtures/golden/manifest.json`    | **Deliberately left mismatched.** This is the negative fixture that proves the golden-hash drift detector fires. Do not "fix" it.                                                                                                               |
| `test/conformance/reference-adapter.ts`                                 | Teach the independent reference implementation about the new profile.                                                                                                                                                                           |
| `test/conformance/differential.test.ts`                                 | Extend the differential run to cover the new profile.                                                                                                                                                                                           |
| `src/fingerprint.ts`                                                    | No edit expected. The algorithm is stable; only the version input changes.                                                                                                                                                                      |
| `test/fingerprint-2.1.233.test.ts`                                      | Model for the new version's known-answer vectors. Add the equivalent file for the new release. See the note below on computing vectors.                                                                                                         |
| `scripts/verify-drift.mjs`                                              | Add the profile id to `MONITORED_PROFILES` **only if** an external drift source exists for that release. Monitoring a release with no source produces a permanently failing or permanently vacuous check.                                       |
| `CHANGELOG.md`                                                          | On release only.                                                                                                                                                                                                                                |
| `test/governance/release-policy.test.ts`                                | On release only, if the release policy assertions reference the version.                                                                                                                                                                        |

### Fingerprint known-answer vectors

The fingerprint is derived from the salt `59cf53e54c78`, characters 4, 7, and 20
of the first user text, and the version string, hashed with SHA-256 and taken as
the first three characters of the lowercase hex digest — `slice(0, 3)`.

Compute the expected vectors **independently, outside this package**, with a
separate tool. Do not generate them by calling this package's own
`src/fingerprint.ts` and pasting the result. A known-answer test that gets its
answers from the implementation under test asserts only that the code is
self-consistent, which it always is, including when it is wrong.

## Step 5 — order of attack

The order matters, because each step leaves the suite green and the next step
builds on a verified base.

1. **Analysis document.** Step 3. Nothing else depends on judgement calls that
   have not been written down yet.
2. **Beta registry.** `src/profiles/beta-registry-<version>.ts`. Smallest,
   most mechanical, easiest to review against the extractor report.
3. **Catalogue and profile.** `src/profiles/claude-code-<version>.ts`.
4. **Export and registration.** `src/index.ts`, `package.json`, `src/betas.ts`,
   `src/build-request.ts` (`ACCEPTED_PROFILES` only), `src/headers.ts`,
   `src/redaction.ts`, and the governance literals that mirror them.
5. **Packed-consumer canary.** Run `npm run test:pack`. This proves the new
   subpath export resolves from a packed tarball. Do this **before** any
   default switch. If the export is broken, you want to find out while the
   default still points at a known-good profile.
6. **Default switch.** Change `DEFAULT_PROFILE` in `src/build-request.ts` as an
   isolated, one-line commit with no other changes. This is the single commit
   that changes behaviour for every existing consumer who did not pin a
   profile, and it is the commit that gets reverted first if the release is
   bad. Keeping it alone makes that revert a one-line operation.
7. **Fixtures and seal.** Add golden fixtures, run `npm run fixtures:seal`,
   hand-edit `manifest.models`, add the evidence rows to
   `docs/plans/baseline-2026-08-05.md`, and update the drift mirror manifests.
8. **Matrix registration.** `test/support/profile-matrix.ts`. Doing this last
   means the broad fan-out suites light up against a profile that is already
   correct in isolation, so a failure here points at the matrix wiring rather
   than at the profile data.
9. **Semantics.** Behaviour deltas last: billing and token behaviours via flags
   in `src/profile-behaviors.ts`. These are the changes most likely to need
   iteration, so they land on a base where everything else is already proven.

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run format:check` before each commit.

## Why the extractor has no continuous integration step

`npm run extract:profile` is intentionally not wired into
`.github/workflows/ci.yml`.

The extractor's only meaningful input is the carved JavaScript bundle from
Step 0 — a multi-hundred-megabyte text file carved out of a platform-specific
binary that is not committed to this repository and cannot reasonably be
fetched or cached in a continuous integration run. A step invoking the
extractor would therefore have nothing to point it at, and would either fail
permanently or be given a stub input, at which point it asserts nothing.

The extractor's own correctness is already covered on every run.
`test/tooling/extract-upstream-profile.test.ts` exercises it against the
committed inputs under `test/tooling/fixtures/extract/`, which include
well-formed bundles, truncated bundles, missing anchors, null slots, unknown
model fields, and inputs crafted to trigger the ambiguous-user-agent refusal.
That suite runs as part of `npm test`, which continuous integration does run.

The gap this leaves is narrow and deliberate: continuous integration verifies
that the extractor behaves correctly on known inputs, and a human verifies that
its output on a new upstream bundle is correct. The second half is a judgement
task, which is exactly what Steps 1 through 3 exist to structure.
