<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Per-version wire analyses

Claude Code is a moving target. **Every Claude Code release may change the wire
contract** — request headers, beta identifiers, system-prompt composition, body
fields, tool naming, thinking configuration, and the server-side checks that
reject a request that does not match. A behaviour that is correct against one
release is not evidence about any other release.

The documents in this directory are the **historical record of that drift**.
Each one analyses a specific Claude Code version: what changed relative to the
previously analysed version, what the server started or stopped accepting, and
what a client must send to stay wire-compatible with that release.

| Analysis                                                             | Claude Code version |
| -------------------------------------------------------------------- | ------------------- |
| [claude-code-2.1.119-analysis.md](./claude-code-2.1.119-analysis.md) | `2.1.119`           |
| [claude-code-2.1.133-analysis.md](./claude-code-2.1.133-analysis.md) | `2.1.133`           |
| [claude-code-2.1.143-analysis.md](./claude-code-2.1.143-analysis.md) | `2.1.143`           |
| [claude-code-2.1.150-analysis.md](./claude-code-2.1.150-analysis.md) | `2.1.150`           |
| [claude-code-2.1.159-analysis.md](./claude-code-2.1.159-analysis.md) | `2.1.159`           |
| [claude-code-2.1.195-analysis.md](./claude-code-2.1.195-analysis.md) | `2.1.195`           |
| [claude-code-2.1.233-analysis.md](./claude-code-2.1.233-analysis.md) | `2.1.233`           |

These analyses come in two kinds, and each file's provenance header states which
it is:

- **Ported** — reproduced from the upstream project, carrying a provenance
  header that names the source repository, source path, source commit and
  licence, and declaring whether the port is verbatim. Every ported document is
  also listed in [../../ATTRIBUTION.md](../../ATTRIBUTION.md).
- **First-party** — researched and authored in this repository, carrying a
  provenance header that says so and names the analysis method instead of a
  source repository. Nothing in a first-party document is reproduced from an
  external project, so it has no attribution row.

## Adding a profile requires a new analysis

A profile in `src/profiles/` pins exactly one Claude Code release. Adding a new
profile without recording how that release differs from the previous one would
ship an unexplained wire contract that nobody can re-derive or audit later.

Therefore: **a new analysis document in this directory is REQUIRED whenever a
new profile is added to `src/profiles/`.** The profile-coverage guard in
`test/docs/provenance.test.ts` enforces it — the guard reads every profile id
declared under `src/profiles/`, extracts its Claude Code version, and fails the
build unless `claude-code-<version>-analysis.md` exists here.

If the new release is analysed upstream, port that document with the mandatory
provenance header and add its row to
[../../ATTRIBUTION.md](../../ATTRIBUTION.md). If it is analysed in this
repository instead, write the analysis here as first-party material and record
it in the first-party list of the provenance test rather than in the ported
corpus manifest.

The mapping from these findings to this package's own contract stays in
[../../source-trace.md](../../source-trace.md).
