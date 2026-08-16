# Contributing

Contributions are welcome through GitHub pull requests.

## Development certificate and license

By contributing, you certify the Developer Certificate of Origin 1.1 for your contribution. Use a signed-off commit (`git commit -s`) to record that certification. You license contributions under GPL-3.0-or-later, the same license as this project.

## Quality gates

Install with `npm ci`, then run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Do not commit credentials, generated evidence, coverage output, build output, or package tarballs.

Test quality is enforced statically rather than through mutation testing. `npm run lint` includes the `@vitest/eslint-plugin` rule set, which rejects assertion-free tests, conditional or misplaced `expect` calls, focused or disabled tests, and duplicate test titles; `npm run test:coverage` enforces line, statement, function, and branch thresholds. This is a cheaper, faster, and less precise signal than the mutation testing it replaces: it does not detect a weak assertion that still runs against covered code, so data-table modules in particular need explicit per-value assertions rather than relying on coverage alone.

There is no automated check against an external copy of the upstream client, and adding one back is not an improvement: the only consumer project that carried a parallel transcription now imports its constants from this package, so a comparison against it is circular. Upstream drift is detected by re-running the transcription procedure in `docs/plans/UPSTREAM-TRACKING-RUNBOOK.md` against a genuine client binary, and the result is held in place by `npm run fixtures:check` over the sealed golden fixtures.

## Golden fixtures

`npm run fixtures:seal` is the only approved way to update golden fixture hashes. It recomputes the SHA-256 of every file in `test/fixtures/golden/` and rewrites both `test/fixtures/golden/manifest.json` and the `### Fixture integrity` table in `docs/source-trace.md` from those bytes. Never hand-edit either the manifest or the table: a hand-written hash asserts an integrity claim nothing verified, which is precisely the failure that left two of the three documented hashes stale before the check existed.

Regenerate a fixture, run `npm run fixtures:seal`, and commit the fixture together with the manifest and the trace. The command refuses to run when the working tree carries modified tracked files outside those two targets, or an untracked file inside `test/fixtures/golden/` — an uncommitted fixture would otherwise be sealed into a hash no commit carries.

CI runs `npm run fixtures:check` only. It verifies the recorded hashes against the files on disk in both directions and never writes; `fixtures:seal` must not be added to any workflow. `test/governance/ci-policy.test.ts` scans every workflow for the sealing command, and the script itself refuses to write with `refused=ci-environment` whenever `CI` is set to a truthy value, so sealing stays a reviewed local act.

Keep public commit messages neutral and use Conventional Commits. Changes to the public API must include tests and documentation.
