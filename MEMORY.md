<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Decision memory

Append-only log of non-obvious maintenance decisions and their reasoning, so
future work does not re-litigate or accidentally reverse them. Newest entries
first. Keep entries dated, factual, and in consumer-neutral language.

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
