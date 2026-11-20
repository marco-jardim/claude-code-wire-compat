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

The pinned profiles are exported:

- `CLAUDE_CODE_2_1_329_PROFILE` — Claude Code 2.1.329 with SDK 0.128.0. This is the profile the request-building entry points use when `profile` is omitted.
- `CLAUDE_CODE_2_1_280_PROFILE` — the previous pin, Claude Code 2.1.280 with SDK 0.112.1.
- `CLAUDE_CODE_2_1_233_PROFILE` — Claude Code 2.1.233 with SDK 0.112.1.
- `CLAUDE_CODE_2_1_195_PROFILE` — the oldest pin, Claude Code 2.1.195 with SDK 0.94.0.

The model-query helpers (`modelCapability`, `isEligibleFor1MContext`) and the anti-verbosity helpers (`antiVerbosityText`, `selectAntiVerbositySection`) keep their own separately declared default and are not governed by that seam; a caller relying on them for a newer model must pass the profile explicitly.

Any of them can be selected explicitly by passing the singleton as the `profile` argument, from the package root or from its own subpath export:

```ts
import { CLAUDE_CODE_2_1_195_PROFILE } from "@tormentalabs/claude-code-wire-compat/profiles/claude-code-2.1.195";
import { CLAUDE_CODE_2_1_233_PROFILE } from "@tormentalabs/claude-code-wire-compat/profiles/claude-code-2.1.233";
import { CLAUDE_CODE_2_1_280_PROFILE } from "@tormentalabs/claude-code-wire-compat/profiles/claude-code-2.1.280";
import { CLAUDE_CODE_2_1_329_PROFILE } from "@tormentalabs/claude-code-wire-compat/profiles/claude-code-2.1.329";
```

Rollback: a consumer who wants the previous default's bytes must pass `CLAUDE_CODE_2_1_280_PROFILE` explicitly on every call to each entry point that reads the default seam — `buildClaudeCodeRequest`, `buildClaudeCodeCountTokensRequest`, and `parseBuiltClaudeCodeRequest`. Pinning the builders alone is not enough: `parseBuiltClaudeCodeRequest` recomputes the expected headers under the profile it is given, so a request built under the old default and parsed unpinned after upgrading is rejected with `ClaudeCodeWireError` code `INVALID_INPUT`.

The fail-closed rule is unchanged: only these exported singletons are accepted. Any other object, even a structurally identical clone, is rejected with `ClaudeCodeWireError` code `INVALID_INPUT`. This prevents callers from substituting an unpinned protocol profile.

## Inputs honoured by the 2.1.329 profile

Every input below is optional and is validated on **every** profile, so a malformed value fails the same way regardless of the pinned profile. Only the 2.1.329 profile acts on them (except `cch`, which every profile honours); the older profiles ignore the rest, which is why their bytes and frozen digests do not move. A host that omits all of them gets the modelled defaults.

- `cch` — five lowercase hex characters that replace the `cch=00000` placeholder in the billing block. The package only places the value; it does not compute it. Anything else is `INVALID_INPUT`. A host that hashes the request body builds twice: once without `cch` to obtain the body bytes, then again with the value it derived. Only the five placeholder characters differ between the two passes.
- `turnOrigin`, `turnPosition` — the `cc_turn_origin`, `cc_prompt_index` and `cc_turn_index` billing segments. A value outside the upstream format guard is dropped silently, as upstream does; a value of the wrong type is `INVALID_INPUT`.
- `toolsUsed` — the tools the conversation has used, serialised into the always-present `x-claude-code-sandy-plover` header (`[]` by default). At most 64 entries, names up to 256 bytes, a serialised size of at most 7168 bytes. The package rejects an over-size value instead of truncating it, because the upstream truncation sentinel is not transcribed. Ordering of built-in tools relative to the rest is the host's job.
- `previousMessageId` — the previous response's message id, or `null` for the first request, carried in the body's `diagnostics` object whenever the cache-diagnosis beta is composed.
- `accountFeatures` — opt-in switches for features the genuine client enables per account. `dispatchId` (`v2d`, `v2s` or `v2p`) adds the `anthropic-dispatch-id` header. `inlineTools` composes the inline-tools beta (header only; see below). `toolProvenance` composes the tool-provenance beta and is **off by default**. `thread` (`{type: "create"}` or `{type: "continue", previousMessageId}`) composes message-threads and the body's `thread`.
- `sideQuery`, `agenticQuery` — `sideQuery` composes the side-query beta (the host sets it on session-title requests). `agenticQuery` re-adds the `claude-code` beta for a model the per-model table excludes it from (the haiku models).
- Per-turn control messages — a `messages` entry of the shape `{role: "system", content: [], output_config: {effort?, timing?}}` is accepted as pass-through on 2.1.329, which is how the genuine client changes effort mid-conversation. Other profiles keep rejecting it. Exported as the type `ClaudeCodeControlMessage`.

Two limits to know about. `inlineTools` is a header-only half port: the genuine client also inserts `role: "system"` messages carrying `tool_addition` blocks into the conversation, and this package does not model them. And header casing survives only on case-preserving transports: the 2.1.329 layout emits `Accept`, `Authorization`, `Content-Type`, `User-Agent`, the `X-Stainless-*` headers and `X-Claude-Code-Session-Id` with their genuine capitalisation and sorts every header by UTF-16 code unit, but Node's `fetch` lowercases header names on the way out, so only a transport that keeps case (Bun, for one) reproduces the capitalisation.

Profile data and queries added alongside:

- The 2.1.329 profile carries two optional, data-only fields: `runtimeVersion` (the `X-Stainless-Runtime-Version` the genuine client reports) and `oauthAuthorizeScopes` (the scopes of its authorize URL). The package neither reads `runtimeVersion` into a request (the caller still supplies `runtime.runtimeVersion`) nor builds an authorize URL; a host reads the fields.
- `modelCatalogueEntry(model, profile)` returns the catalogue entry the profile's own normalizer resolves `model` to, or `undefined`. It is folding-consistent: under a profile whose normalizer does not know `claude-sonnet-5-5`, that id resolves to the `claude-sonnet-5` entry, as the request builder does.

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

## Input limits

Local ceilings exist only as defensive bounds and never sit below what the Messages API accepts. A caller's input graph, the canonical body, the `system` field and the decoded body inside `parseBuiltClaudeCodeRequest` share one aggregate budget of 33,554,432 units (32 MiB, the API's 32 MB request limit in its larger binary reading); units are string lengths plus structural overhead, not serialized bytes. The canonical body also allows at most 3,355,443 objects and arrays. Graphs that carry the serialized body beside other material (redaction evidence, the built-request wrapper) get three times the budget. Nesting depth, header, identifier and metadata field limits are separate and unchanged. Exceeding a size budget raises `ClaudeCodeWireError` code `INPUT_TOO_LARGE` with `safeDetails.maximumSize` naming the budget that applied; exceeding the container ceiling raises the same code with `safeDetails.maximumItems`.

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
- [Divergence analysis](./docs/protocol/divergence-analysis.md) — ported
  analysis of system-prompt block construction, genuine client versus the
  earlier plugin. Package-level divergences are recorded in each version
  analysis's port table and in `MEMORY.md`.
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
  — the previous pin; its profile is still exported and selectable.
- [Claude Code 2.1.280](./docs/protocol/versions/claude-code-2.1.280-analysis.md)
  — the previous pin; its profile is still exported and selectable. Records the build-shape
  change that breaks the old carving rule, nine new betas, three new models,
  and the first wire-visible `thinking` sub-fields since 2.1.222.
- [Claude Code 2.1.329](./docs/protocol/versions/claude-code-2.1.329-analysis.md)
  — the release this package's default profile pins.

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
