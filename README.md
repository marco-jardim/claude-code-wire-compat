# claude-code-wire-compat

Claude Wire Compat

An ESM-only, runtime-neutral TypeScript package for constructing a pinned Claude Code Messages wire contract.

> **Status:** bootstrap release candidate. Runtime request-building behavior is intentionally introduced in later releases.

## Package

```sh
npm install @tormentalabs/claude-code-wire-compat
```

The package targets Node.js 20 or newer and is designed to remain portable to Bun and standards-based worker runtimes. Consumers own credentials, transport, persistence, refresh coordination, retries, and deployment policy.

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
