# claude-code-wire-compat

Claude Wire Compat

An ESM-only, runtime-neutral TypeScript package for constructing a pinned Claude Code Messages wire contract.

> **Status:** stable. `buildClaudeCodeRequest` and `parseBuiltClaudeCodeRequest` build and read back the pinned wire contract. The package performs no I/O: credentials, transport, persistence, refresh coordination, and retries remain the consumer's responsibility.

## Package

```sh
npm install @tormentalabs/claude-code-wire-compat
```

The package targets Node.js 20 or newer and is designed to remain portable to Bun and standards-based worker runtimes. Consumers own credentials, transport, persistence, refresh coordination, retries, and deployment policy.

## Protocol profile

Two pinned profiles are exported:

- `CLAUDE_CODE_2_1_233_PROFILE` — Claude Code 2.1.233 with SDK 0.112.1. This is the profile used when `profile` is omitted.
- `CLAUDE_CODE_2_1_195_PROFILE` — the previous pin, Claude Code 2.1.195 with SDK 0.94.0.

Either can be selected explicitly by passing the singleton as the `profile` argument, from the package root or from its own subpath export:

```ts
import { CLAUDE_CODE_2_1_195_PROFILE } from "@tormentalabs/claude-code-wire-compat/profiles/claude-code-2.1.195";
import { CLAUDE_CODE_2_1_233_PROFILE } from "@tormentalabs/claude-code-wire-compat/profiles/claude-code-2.1.233";
```

The fail-closed rule is unchanged: only these exported singletons are accepted. Any other object, even a structurally identical clone, is rejected with `ClaudeCodeWireError` code `INVALID_INPUT`. This prevents callers from substituting an unpinned protocol profile.

## Endpoint URL and custom base URLs

`built.url` is the **pinned endpoint of the profile**, not a suggestion. It is literal-typed, so the type is part of the contract:

- `buildClaudeCodeRequest` → `"https://api.anthropic.com/v1/messages?beta=true"`
- `buildClaudeCodeCountTokensRequest` → `"https://api.anthropic.com/v1/messages/count_tokens?beta=true"`

A host that talks to a proxy, a gateway, or a regional endpoint **overrides the origin and nothing else**: replace protocol, hostname and port; keep the package's `pathname` and `search` verbatim. The `?beta=true` query and the `/v1/messages` path are wire contract — dropping either changes what the server does, and the golden fixtures no longer describe the request that was sent.

```ts
const built = await buildClaudeCodeRequest(input);

// Origin override. `pathname` and `search` come from the package, untouched.
const target = new URL(built.url);
const base = new URL(hostBaseUrl); // whatever the host resolved, e.g. from its own config
target.protocol = base.protocol;
target.hostname = base.hostname;
target.port = base.port;

await fetch(target, {
  method: built.method,
  headers: built.headers,
  body: built.body,
});
```

**The input will not gain a `baseUrl` field.** Three reasons, recorded so the request does not come back:

1. `BuiltClaudeCodeRequest["url"]` is a string literal type. Widening it to `string` to accommodate an arbitrary base is a breaking change at the type level for every consumer that pins the endpoint.
2. Speculative surface is not added to this package. A host that has a base URL already has a URL library; a package field would be a second way to do the same thing, with a validation and normalisation burden this package would then own.
3. The only real consumer case observed is an origin override, which the four lines above express exactly — including the case where the base URL carries a path prefix, which a naive `baseUrl + pathname` concatenation gets wrong.

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
- [Claude Code 2.1.233](./docs/protocol/versions/claude-code-2.1.233-analysis.md)
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
