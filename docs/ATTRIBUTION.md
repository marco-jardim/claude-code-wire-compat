<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Attribution for ported documentation

The protocol documentation under `docs/protocol/` is **not original to this
package**. It is derived material, ported from the upstream project:

- Upstream repository: <https://github.com/marco-jardim/opencode-anthropic-fix>
- Upstream commit: `466d500` (`466d500084b59651798bf38bf24d21f3cb850db6`)
- Upstream license: `GPL-3.0-or-later`
- This work's license: `GPL-3.0-or-later`
- Status: **MODIFIED derivative work**

This file is the manifest of that port. Every document under `docs/protocol/`
is listed here, and every document listed here exists on disk; the
`test/docs/provenance.test.ts` policy fails the build if the two ever diverge.

## GPL-3.0 section 5(a) compliance

GPL-3.0 section 5(a) requires that a modified work carry prominent notices
stating that it was modified, and the date of the change. Accordingly:

- Every ported file begins with a provenance blockquote naming the upstream
  repository, the exact upstream path, the upstream commit, the license, and
  whether it was ported verbatim or with modifications.
- The port was performed on **2026-07-27**; the corresponding change is recorded
  in this repository's public git history.
- The complete corresponding source of this modified work is public at
  <https://github.com/marco-jardim/claude-code-wire-compat>; see `NOTICE` and
  `LICENSE`.

## Editorial policy for the port

Protocol **facts** are ported verbatim. The plan for this port permitted
rewriting upstream operational references into library-neutral language; that
option was **deliberately not exercised**, because every candidate reference in
the corpus (plugin environment-variable names, plugin tool-rename maps, upstream
file paths, upstream absolute paths of the analysed client build) is itself part
of the evidence chain for a protocol fact, and rewriting it would weaken or lose
that fact. Losing a protocol fact is a blocking defect; carrying an upstream
reference is not.

The consequence is explicit and is stated in the provenance header of every
ported file: the document bodies still describe the upstream OpenCode plugin,
its environment variables, and its file layout. **Nothing in `docs/protocol/` is
a statement about this package's API.** The normative mapping from these
findings to this package's contract is
[`docs/source-trace.md`](./source-trace.md).

The only modification applied to any ported file is the prepended provenance
header. No line of upstream body content was added, removed, reordered, or
reworded.

## Ported protocol corpus

| Ported file                                       | Source path                                     | Source lines | Modification                                 |
| ------------------------------------------------- | ----------------------------------------------- | -----------: | -------------------------------------------- |
| `docs/protocol/reverse-engineering.md`            | `docs/claude-code-reverse-engineering.md`       |         1891 | Ported verbatim; provenance header prepended |
| `docs/protocol/http-headers-and-system-prompt.md` | `docs/mimese-http-header-system-prompt.md`      |          866 | Ported verbatim; provenance header prepended |
| `docs/protocol/fingerprint-extraction.md`         | `docs/MIMESE_FINGERPRINT_EXTRACTION.md`         |          800 | Ported verbatim; provenance header prepended |
| `docs/protocol/message-flow.md`                   | `docs/MESSAGE_FLOW_DIAGRAM.md`                  |          491 | Ported verbatim; provenance header prepended |
| `docs/protocol/tool-use-examples.md`              | `docs/TOOL_USE_CODE_EXAMPLES.md`                |          479 | Ported verbatim; provenance header prepended |
| `docs/protocol/code-comparison-reference.md`      | `docs/CODE_COMPARISON_REFERENCE.md`             |          420 | Ported verbatim; provenance header prepended |
| `docs/protocol/divergence-analysis.md`            | `docs/DIVERGENCE_ANALYSIS.md`                   |          413 | Ported verbatim; provenance header prepended |
| `docs/protocol/quick-reference.md`                | `docs/QUICK_REFERENCE.md`                       |          209 | Ported verbatim; provenance header prepended |
| `docs/protocol/system-prompt-search-results.md`   | `docs/SEARCH_RESULTS_SUMMARY.md`                |          202 | Ported verbatim; provenance header prepended |
| `docs/protocol/divergence-executive-summary.md`   | `docs/EXECUTIVE_SUMMARY.md`                     |          182 | Ported verbatim; provenance header prepended |
| `docs/protocol/cache-transparency.md`             | `docs/anti-verbosity-and-cache-transparency.md` |          111 | Ported verbatim; provenance header prepended |
| `docs/protocol/beta-decision-table.md`            | `docs/mimicry/beta-decision-table.md`           |           72 | Ported verbatim; provenance header prepended |

`Source lines` counts the **non-empty** lines of the source file at commit
`466d500`, which is the metric recorded in the COM-466 pre-flight inventory and
the one every count in this file was verified against. A raw newline count
(`wc -l`) is larger for every file because blank lines are excluded from this
metric.
