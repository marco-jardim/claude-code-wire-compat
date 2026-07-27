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

## Ported per-version wire analyses

Each Claude Code release may change the wire contract; these documents are the
historical record of that drift. See
[`docs/protocol/versions/README.md`](./protocol/versions/README.md) for the rule
that a new analysis is required whenever a new profile is added to
`src/profiles/`.

| Ported file                                              | Source path                            | Source lines | Modification                                 |
| -------------------------------------------------------- | -------------------------------------- | -----------: | -------------------------------------------- |
| `docs/protocol/versions/claude-code-2.1.119-analysis.md` | `docs/claude-code-2.1.119-analysis.md` |           77 | Ported verbatim; provenance header prepended |
| `docs/protocol/versions/claude-code-2.1.133-analysis.md` | `docs/claude-code-2.1.133-analysis.md` |          101 | Ported verbatim; provenance header prepended |
| `docs/protocol/versions/claude-code-2.1.143-analysis.md` | `docs/claude-code-2.1.143-analysis.md` |          452 | Ported verbatim; provenance header prepended |
| `docs/protocol/versions/claude-code-2.1.150-analysis.md` | `docs/claude-code-2.1.150-analysis.md` |          142 | Ported verbatim; provenance header prepended |
| `docs/protocol/versions/claude-code-2.1.159-analysis.md` | `docs/claude-code-2.1.159-analysis.md` |          155 | Ported verbatim; provenance header prepended |
| `docs/protocol/versions/claude-code-2.1.195-analysis.md` | `docs/claude-code-2.1.195-analysis.md` |          334 | Ported verbatim; provenance header prepended |

`docs/protocol/versions/README.md` is first-party material written for this
package and is therefore not listed as a ported file.

`Source lines` counts the **non-empty** lines of the source file at commit
`466d500`, which is the metric recorded in the COM-466 pre-flight inventory and
the one every count in this file was verified against. A raw newline count
(`wc -l`) is larger for every file because blank lines are excluded from this
metric.

## Intentionally not ported

The upstream `docs/` tree contains more than the protocol corpus. The documents
below were reviewed and **deliberately left behind**: none of them carries
protocol knowledge that a future maintainer would need to re-derive the wire
contract. Recording them here is what makes the port auditable — a reader can
distinguish an intentional exclusion from an oversight.

| Excluded path                             | Source lines | Category           | Reason                                                                                                                                      |
| ----------------------------------------- | -----------: | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/LATENCY_ANALYSIS_REPORT.md`         |          363 | plugin-operational | Measures latency of the upstream plugin's own runtime, not the wire contract.                                                               |
| `docs/EXPLORATION_COMPLETE.md`            |          307 | planning material  | Status report closing an exploration effort; supersedes nothing in the corpus.                                                              |
| `docs/EXPLORATION_EXECUTIVE_SUMMARY.md`   |          314 | planning material  | Management summary of that exploration; its protocol findings live in the ported corpus.                                                    |
| `docs/EXPLORATION_INDEX.md`               |          327 | planning material  | Index over upstream-only documents; every link would dangle in this repository.                                                             |
| `docs/EXPLORATION_SUMMARY.md`             |          345 | planning material  | Second summary of the same exploration effort; duplicates ported findings.                                                                  |
| `docs/fork-customizations.md`             |          148 | plugin-operational | Describes fork-specific plugin behaviour and configuration, not Claude Code's wire contract.                                                |
| `docs/future-improvements.md`             |          280 | planning material  | Backlog of proposed upstream plugin work; speculative rather than observed.                                                                 |
| `docs/agent-native-audit.md`              |          209 | plugin-operational | Audits the upstream plugin's agent-native surface, which this package does not implement.                                                   |
| `docs/plan-b-new-plugins-feasibility.md`  |          526 | planning material  | Feasibility study for alternative plugin architectures; contains no wire observation.                                                       |
| `docs/mimicry/strategy-decision-table.md` |           45 | plugin-operational | Encodes the plugin's account-selection strategy, an operational concern outside this package.                                               |
| `docs/plans/`                             |     20 files | planning material  | Whole planning tree: 13 files in `docs/plans/` plus 7 files under `docs/plans/qa/`; execution plans and QA reviews, not protocol knowledge. |

Counts were verified against commit `466d500` on 2026-07-27. **Correction to the
COM-466 plan:** for the planning tree the plan stated 14 files in `docs/plans/`
plus 7 under `docs/plans/qa/`; the verified count is **13** files directly in
`docs/plans/` (12 Markdown files plus `afcw-upstream-watcher.json`) plus **7**
files under `docs/plans/qa/`, for 20 files in total. The verified numbers are
what `test/docs/provenance.test.ts` pins.

## Known corpus drift

The port is pinned to commit `466d500`. The upstream extraction branch
(`refactor/extract-wire-compat`, at the time of the port `8f1d954`) has since
edited six documents that are part of this corpus or its exclusion list:

| Upstream document                               | Line delta since `466d500` |
| ----------------------------------------------- | -------------------------- |
| `docs/mimese-http-header-system-prompt.md`      | +21                        |
| `docs/anti-verbosity-and-cache-transparency.md` | +15                        |
| `docs/claude-code-2.1.143-analysis.md`          | +9                         |
| `docs/claude-code-2.1.150-analysis.md`          | +4                         |
| `docs/claude-code-2.1.159-analysis.md`          | +3                         |
| `docs/EXPLORATION_EXECUTIVE_SUMMARY.md`         | +3 (not ported)            |

That newer content is **not** included here, because `466d500` is the commit
that `NOTICE`, [`docs/source-trace.md`](./source-trace.md), and this file all
declare, and porting from an unmerged branch would break that single pinned
provenance chain. This is recorded as known drift for a future corpus refresh,
which must re-pin the commit in every provenance header, in `NOTICE`, and here.
