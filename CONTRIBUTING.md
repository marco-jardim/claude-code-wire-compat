# Contributing

Contributions are welcome through GitHub pull requests.

## Development certificate and license

By contributing, you certify the Developer Certificate of Origin 1.1 for your contribution. Use a signed-off commit (`git commit -s`) to record that certification. You license contributions under GPL-3.0-or-later, the same license as this project.

## Quality gates

Install with `npm ci`, then run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Do not commit credentials, generated evidence, coverage output, build output, or package tarballs.

Mutation testing runs nightly and on demand rather than on every pull request. Run it locally with `npm run test:mutation`; Stryker uses an incremental cache to make repeat runs fast.

`npm run drift:check` compares the pinned profile against a local checkout of the upstream source, so it is a local quality gate. When that checkout is absent, it deliberately exits nonzero with `SOURCE_UNAVAILABLE`; do not suppress or work around that result. CI instead runs the fixture-driven `test/drift` suite.

Keep public commit messages neutral and use Conventional Commits. Changes to the public API must include tests and documentation.
