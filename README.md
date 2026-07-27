# claude-code-wire-compat

Claude Wire Compat

An ESM-only, runtime-neutral TypeScript package for constructing a pinned Claude Code Messages wire contract.

> **Status:** bootstrap release candidate. Runtime request-building behavior is intentionally introduced in later releases.

## Package

```sh
npm install @tormentalabs/claude-code-wire-compat
```

The package targets Node.js 20 or newer and is designed to remain portable to Bun and standards-based worker runtimes. Consumers own credentials, transport, persistence, refresh coordination, retries, and deployment policy.

## Protocol profile

The only accepted `profile` value is the exported `CLAUDE_CODE_2_1_195_PROFILE` singleton. Any other object, even a structurally identical clone, is rejected with `ClaudeCodeWireError` code `INVALID_INPUT`. This deliberate fail-closed behaviour prevents callers from substituting an unpinned protocol profile.

## Protocol documentation

The wire contract this package pins was reverse engineered before it was
implemented. That research is preserved under [`docs/protocol/`](./docs/protocol)
so a future maintainer can re-derive the contract when Claude Code ships a new
version. It is ported verbatim from
[opencode-anthropic-fix](https://github.com/marco-jardim/opencode-anthropic-fix)
at commit `466d500` under GPL-3.0-or-later; every file carries a provenance
header and is listed in [docs/ATTRIBUTION.md](./docs/ATTRIBUTION.md).

**These documents describe the upstream plugin and Claude Code itself, not this
package's API.** The normative mapping from those findings to this package's
contract is [docs/source-trace.md](./docs/source-trace.md).

Protocol knowledge corpus:

- [Reverse engineering](./docs/protocol/reverse-engineering.md) — the full
  authentication and API reverse-engineering record.
- [HTTP headers and system prompt](./docs/protocol/http-headers-and-system-prompt.md)
  — header composition and system-prompt mimicry.
- [Fingerprint extraction](./docs/protocol/fingerprint-extraction.md) — how the
  client fingerprint and metadata are derived.
- [Message flow](./docs/protocol/message-flow.md) — end-to-end request and
  response flow.
- [Tool use examples](./docs/protocol/tool-use-examples.md) — tool_use and
  tool_result pairing in practice.
- [Code comparison reference](./docs/protocol/code-comparison-reference.md) —
  side-by-side comparison against the genuine client.
- [Divergence analysis](./docs/protocol/divergence-analysis.md) — every observed
  divergence from the genuine client.
- [Divergence executive summary](./docs/protocol/divergence-executive-summary.md)
  — the condensed version of that analysis.
- [Quick reference](./docs/protocol/quick-reference.md) — condensed lookup of
  headers, betas, and switches.
- [System-prompt search results](./docs/protocol/system-prompt-search-results.md)
  — where each system-prompt fragment was found in the analysed build.
- [Cache transparency](./docs/protocol/cache-transparency.md) — anti-verbosity
  and prompt-cache observability.
- [Beta decision table](./docs/protocol/beta-decision-table.md) — which beta
  identifiers are sent under which conditions.

Per-version wire analyses — [why they exist and when a new one is
required](./docs/protocol/versions/README.md):

- [Claude Code 2.1.119](./docs/protocol/versions/claude-code-2.1.119-analysis.md)
- [Claude Code 2.1.133](./docs/protocol/versions/claude-code-2.1.133-analysis.md)
- [Claude Code 2.1.143](./docs/protocol/versions/claude-code-2.1.143-analysis.md)
- [Claude Code 2.1.150](./docs/protocol/versions/claude-code-2.1.150-analysis.md)
- [Claude Code 2.1.159](./docs/protocol/versions/claude-code-2.1.159-analysis.md)
- [Claude Code 2.1.195](./docs/protocol/versions/claude-code-2.1.195-analysis.md)
  — the release this package's profile pins.

## Development

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Security

Do not include access tokens, account identifiers, session identifiers, or private prompts in bug reports. See [SECURITY.md](./SECURITY.md) for private disclosure instructions.

## License and provenance

SPDX-License-Identifier: GPL-3.0-or-later

This repository is a modified work derived from [opencode-anthropic-fix](https://github.com/marco-jardim/opencode-anthropic-fix) at upstream commit `466d500`. See [NOTICE](./NOTICE) for attribution and modification details. Corresponding source is available in this public repository.
