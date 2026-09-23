<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Handover prompt — execute the Claude Code 2.1.280 port

Paste everything below the horizontal rule into a fresh session. It is written
to be read by a top-tier orchestrating agent that will delegate the work.

---

## Your mission

Execute, end to end, the port plan at
`D:\git\claude-code-wire-compat\docs\plans\2026-09-23-claude-code-2.1.280-port-plan.md`
(1,924 lines, 8 waves, 19 phases). It ports the Claude Code 2.1.280 wire
profile into this package so that a pinned caller — and, after an isolated
default switch, an unpinned caller — receives requests byte-indistinguishable
from the genuine 2.1.280 client, while the two existing frozen cross-runtime
digests do not move by a single byte.

The plan is the instruction set. This document is the operating manual: state,
rules, and everything the previous sessions learned the hard way.

## Environment

- **Working directory and repository root: `D:\git\claude-code-wire-compat`.**
  They are the same path. `git worktree list` shows exactly one entry; there is
  **no separate worktree** and no checkout outside the base directory. Every
  path in every dispatch must be absolute and must start with that prefix.
- Platform `win32`, shell `pwsh` 7. Not bash: `$env:VAR`, `Get-ChildItem`,
  `Get-FileHash -Algorithm SHA256`, `Stop-Process`. Use `$env:TEMP`, never
  `/tmp`.
- Sibling repositories, used only in Wave 7, each its own worktree:
  `D:\git\opencode-anthropic-fix` (`.mjs` + JSDoc, **no TypeScript**,
  vitest 4.0.18) and `D:\git\opencode-model-router` (TypeScript ESM, no build
  step, vitest). Wave 7 phases may run in parallel with each other because they
  are different worktrees.
- **Linear is not used in this project.** A repository-wide search for
  `linear.app`, `LIN-`, `.linear*` and issue-tracker usage found only a
  mathematical "linear in chunk size" in
  `docs/protocol/quick-reference.md:250`. There is no Linear MCP server
  connected. Do not attempt to update issues; if a Linear server is later
  connected and the repository starts referencing issue keys, revisit this.

## Repository state at handover

```
HEAD -> main
4674148 chore(profiles): add unverified 2.1.280 beta registry draft
37a81cf docs(protocol): analyse Claude Code 2.1.280 and plan the port
3c24a70 Merge pull request #19 from marco-jardim/release/0.5.0-main-sync   <- cycle base
```

Working tree: exactly one modified file, `test/pack/pack-policy.test.ts`.
Nothing else dirty, nothing untracked.

Four facts about that state you must absorb before Wave 0:

1. **`test/pack/pack-policy.test.ts` is fixed but uncommitted.** It is plan
   commit C0. npm 12 changed `npm pack --dry-run --json` from an array to a
   keyed object; the fix adds a module-level
   `firstPackResult(packOutput: string): PackResult | undefined` accepting both
   shapes, replaces both call sites, keeps the `expect(packResult).toBeDefined()`
   assertions and adds explicit `undefined` guards for narrowing. No
   suppressions. Verified green:
   `npx vitest run test/pack/pack-policy.test.ts` → 1 file / 2 tests.
2. **Commits C1 and C2 of the plan already landed, on `main`, not on a
   branch.** Plan Task 0.1.1 mandates creating `port/claude-code-2.1.280`
   before any commit. That did not happen. **Decide this in Wave 0 and record
   the decision:** either create the branch from the current HEAD and continue
   there (the two landed commits stay on `main`, which is acceptable because
   both are documentation and an inert draft), or move them with
   `git branch port/claude-code-2.1.280 && git reset --hard HEAD~2` on `main`
   before switching. Prefer the first; it is non-destructive. Whichever you
   choose, every later commit goes on the branch, and Appendix C's commit
   letters shift by two accordingly — update the plan's Appendix C in the same
   commit that records the decision.
3. **`src/profiles/beta-registry-2.1.280.ts` is committed but UNVERIFIED.** It
   was drafted prematurely, before the analysis document was finished. Phase
   1.1's entire purpose is to verify it line by line against
   `docs/protocol/versions/claude-code-2.1.280-analysis.md` and rewrite it
   where it disagrees. Treat it as a suspect artefact, not as done work. If
   more than three discrepancies appear, re-derive the whole file from the
   analysis document rather than patching it.
4. **Commit 4674148 already front-ran part of Phase 2.1.** Committing the draft
   alone turned `test/governance/provider-scope.test.ts` red with
   `unexplained: ["BEDROCK_UNSUPPORTED_BETAS_2_1_280"]`. That suite holds a
   `REFERENCE_IDENTIFIERS: ReadonlyMap<string,string>` (around line 49) in
   which every exported `*_BETAS` identifier needs a justification string, and
   a stale entry matching nothing in `src/` also fails. One entry was added,
   justified by the upstream call site rather than by resemblance to the
   2.1.233 set. **Phase 2.1 must not re-add it; it must add only the two
   remaining new `*_BETAS` exports** and verify the existing entry's wording.

Gate state at HEAD: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run format:check` all clean; `npm test` → 104 files / 2997 tests, zero
failures.

## Operating rules

These override any local preference. They are additive to the plan's own seven
execution directives, which you must read in full before Wave 0.

1. **Iterate continuously.** Run Wave 0 → Wave 7 without stopping. Stop and ask
   the human ONLY for (a) a genuinely ambiguous requirement that cannot be
   resolved from `docs/protocol/versions/claude-code-2.1.280-analysis.md`, or
   (b) a critical or blocking problem — a missing runtime, a frozen digest
   moving with no explainable cause, a gate that cannot go green without
   breaking a hard rule. Everything else you decide. Where the plan says
   **RESOLVE FROM REPO**, you resolve it by reading the repository, not by
   asking.
2. **Pre-flight before every phase.** Each phase carries a `#### Pre-flight
check`. Run every item. Fix everything you find. If the problem is one the
   plan explicitly defers to a later phase, do not fix it early — document it
   in the phase output and move on. A pre-flight that cannot pass is stop
   condition (b).
3. **Senior QA review after every phase, adversarial, `@heavy`.** QA is always
   a heavy-tier task; apply this rule without exception, including for phases
   whose plan heading says `@medium checklist`. Read that heading as the
   minimum, not the maximum: escalate to `@heavy` for the adversarial review
   itself. Fix every finding from the review before declaring the phase done.
   Severity triage per plan directive 7: BLOCKER and MAJOR findings become a
   `fix(<scope>)` commit and get a targeted re-review that reads only the fix;
   MINOR findings are fixed without re-review. "Zero open findings" means zero
   open BLOCKER and MAJOR with every MINOR fixed — it is not an invitation to
   loop until the reviewer runs out of things to say.
4. **Delegate everything through the model router; prefer atomic tasks.** You
   orchestrate; subagents execute. Read-only work (grep, read, count,
   git-info, existence checks) goes to `@fast`. Implementation, refactoring,
   test authoring, mechanical fixes go to `@medium`. Complex coding, the
   mechanism-seam design, and every QA review go to `@heavy`. One dispatch =
   one atomic deliverable; a dispatch that has to ask "what is in this file?"
   before starting was under-specified.
5. **Split the heavy lift from its verification.** Gather context with `@fast`
   and paste it into the heavy dispatch. Let `@heavy` do the design or the hard
   code. Then hand running the tests and collecting results to `@fast` or
   `@medium`. Never spend heavy tokens on "run the suite and report". Escalate
   back to `@heavy` only when a failure invalidates the approach, or when a
   lighter tier has failed twice on the same defect.
6. **When the router blocks you, take over.** The model router's acceptance
   gate and the lighter tiers misfire in known ways (see Troubleshooting). If a
   subagent returns prolix non-work, refuses with a delegation complaint, or is
   rejected on a process technicality while its substance is correct, **do the
   read or the implementation yourself**. You are a top-tier model; a blocked
   delegation is not a blocked task. Verify by hand and carry on. Do not
   re-dispatch the same prompt a third time.
7. **Never run the full suite when you do not need it.** During iteration
   inside a task, run only the files the change touches:
   `npx vitest run test/validation/betas-2.1.280-push-sites.test.ts`, or a
   directory such as `npx vitest run test/governance`. Run the plan's full
   `GATE-COMMIT` (`npm run lint && npm run typecheck && npm test &&
npm run build && npm run format:check`) once, immediately before each
   commit, and `GATE-WAVE` (adds `npm run test:coverage && npm run pack:check
&& npm run test:pack && npm run fixtures:check`) at each wave end. That
   satisfies both the plan and the economy rule.
8. **Parallelise aggressively but safely.** Fire independent read-only
   dispatches in a single message so they run concurrently. Run `lint`,
   `typecheck` and a targeted test file concurrently when nothing writes.
   **Never two writing tasks against the same worktree at once, and never read
   a file while another agent holds it for writing.** The plan's Appendix B and
   each phase's parallel-safety note were rewritten specifically to strip all
   same-worktree concurrency; do not reintroduce it. Cross-repository work
   (Wave 7) genuinely parallelises.
9. **Commit often.** One Conventional Commit per concern, always
   `git commit -s`, always `git add` with explicit absolute paths, never
   `git add -A`. Never amend a failed commit — fix forward with a new one.
   Gate before you commit, never after: a red commit cannot be removed from
   history under these rules.
10. **Always use full absolute paths** in dispatches, commit bodies, review
    briefs and outputs.

## The evidence hierarchy

`docs/protocol/versions/claude-code-2.1.280-analysis.md` (2,385 lines, four
adversarial `@heavy` reviews run against it, ~$16.5 of review spend) is
normative. The port plan's cross-check tables are convenience copies. **On any
discrepancy the analysis document wins and the plan is amended, never the other
way round.**

The runbook's core rule applies verbatim to every value you transcribe:
**"Never substitute a guess, an interpolation from the previous release, or a
value copied from another platform's build."**

The analysis document's section numbers are stable for §7.6.2 only; locate
other topics by searching for a distinctive literal. The plan's "Evidence map"
table gives the right search string per topic.

### If you need new evidence from the binary

The carved bundle and the probe tooling are still on disk in
`C:\Users\Marquinho\AppData\Local\Temp\opencode\cc-2.1.280\`:

| Artefact                                    | Bytes       | SHA-256                                                            |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `package\claude.exe`                        | 237,100,192 | `0E4195524B73EB77EFBDF3E2B36DE5322A29F0CA575DFD2D9B4F946B1D425469` |
| `cc-2.1.280.full.js` (canonical probe dump) | 42,185,436  | `D30FDCE179B3E8AAAF21C9F7DABC8AF2020E023A956940F187413B338236DFD1` |
| `cc-2.1.280.modules.js`                     | 36,197,302  | `9189F743B1F3979D4AB1A2A454C66D1EB873B89F054CA422F0A333FF9DE82960` |

Carving predicate: printable byte is `0x09`, `0x0A`, `0x0D`, or `0x20`–`0x7E`;
maximal runs; `full` uses threshold ≥512, `modules` ≥4096 with the banner;
concatenated in ascending offset, `\n`-separated. 2.1.280 is
`// @bun @bytecode` — roughly 1,100 NUL-separated modules, so the old
"largest single run" rule is silently wrong and the runbook has been amended.

Probe runners in that directory:

- `node ident.mjs cc-2.1.280.full.js <spec>.json > <out>.txt` — spec is a JSON
  array of `{label, re, flags, before, after, max}`.
- `node slice.mjs cc-2.1.280.full.js <a>-<b> [<a>-<b>...]` — raw byte ranges.
- `node final.mjs` — maps every `import{…}from"B:/~BUN/root/chunk-*.js"` to its
  consuming module; this is how cross-module minified identifiers are resolved.

Write probe specs with the `Write` tool and run them with `node`; PowerShell
mangles inline quotes. Read dumps with `latin1`. Minified names collide across
chunks — the analysis document's §1.4 table lists 32 known collisions; resolve
an identifier by the `import{…}` binding in the consuming module, never by name
alone.

## The numbers that must not move

```
2.1.195 digest 6b9609b29463c890544845dd94acf560206b6f8165538faafd8886750037d277
2.1.233 digest 4e06af42310d63549a4fa9af60ff0c9b13e95d7864624c6b7bf94d45ce9a3997
```

`npm run test:pack` prints them. If either moves, **stop** — that is stop
condition (b). Never "fix" it by editing the literal. The most likely causes,
in order: a JSON key-insertion-order change in `src/request-body.ts` (purity
guarantees value equality, not key order — the plan's Phase 3.2 design task
carries this invariant explicitly); a new composition-audit entry leaking into
a hashed artefact; a `ClaudeCodeCapabilities` field changing the derived
capabilities of an older catalogue.

Fingerprint: salt `59cf53e54c78`, characters 4/7/20 of the first non-meta user
message's first text block with a `"0"` fallback, plus the version string,
SHA-256, first 3 hex. Known vectors — 2.1.195: `offline cch probe`=`7fe`,
`hello wire compat`=`0f6`, `canary probe`=`12f`; 2.1.233: `365`, `413`, `cea`
for the same probes. The 2.1.280 vectors must be computed **outside** this
package (Phase 5.4), calibrated by reproducing the 2.1.233 vectors first with
the same external script.

## Troubleshooting — everything the previous sessions learned

### Delegation

- `Task(subagent_type="medium")` refused four times in a row with "the Task
  tool is not available in this session and sub-delegation is prohibited",
  doing no work, when handed a structured seven-section prompt with an
  `[acceptance]` block. It appears to misread that format as an orchestration
  request. **Workaround that always worked:** open the prompt in plain
  language, e.g. "You are editing ONE file yourself, using the Read and Edit
  tools. There is nothing to delegate and no subagents to call — do the edits
  directly with Edit." Then give simple `--- EDIT n ---` blocks.
  `Task(subagent_type="general")` never exhibited the failure.
- The router's independent acceptance gate rejected several substantively
  correct results on process technicalities: no tool trace proving `Read`/`Edit`
  rather than `Write`; a command not on the allowlist (`node -e`, `echo ok`);
  an expected substring such as "clean" absent from the report text while the
  underlying command was green. **When this happens, verify the work by hand
  and accept it.** Re-dispatching burns tokens and usually reproduces the same
  rejection.
- Subagents run out of read budget mid-task and return partial inventories. Cap
  a read-only dispatch at what fits: ask for four to six precise excerpts, not
  an exhaustive survey. If one returns `NEED MORE`, split it rather than
  raising the cap blindly.
- Subagents do not inherit the environment. Every dispatch needs an
  `ENVIRONMENT` section naming `D:\git\claude-code-wire-compat`, `win32`,
  `pwsh`, and "do not ask permission to access files here".

### Tooling traps in this repository

- **There is no `npm run format`.** Use
  `npx prettier --write <absolute paths>`. `docs/protocol/` is
  prettier-ignored; `docs/plans/` is **not**.
- vitest 4 removed `--reporter=basic`.
- ESLint bans `ReadonlyArray<T>` (use `readonly T[]`), the two-argument
  `expect(value, message)` form, and `toThrowError` (use `toThrow`). Put the
  diagnostic inside the asserted value when you need a readable failure.
- `tsconfig` sets `exactOptionalPropertyTypes`. Build optional fields with
  conditional spreads, never `field: maybeUndefined`. An absent key and a key
  holding `undefined` are different bytes on the wire.
- Never suppress a type error. No `as any`, no `@ts-ignore`, no
  `@ts-expect-error` — the last is also the reason type-level non-assignability
  assertions must use vitest `expectTypeOf`.
- `npm run fixtures:seal` refuses when: any tracked file outside its two
  targets is modified; any untracked file sits inside the golden directory; or
  `CI` is truthy in the environment. The executing shell may carry
  `$env:CI = 'true'` — clear it for that one invocation:
  `Remove-Item Env:CI -ErrorAction SilentlyContinue; npm run fixtures:seal`.
- `manifest.models` inside the golden manifest is hand-maintained seal _input_.
  Edit it by hand when adding fixtures or the generated doc table renders
  `n/a`.
- On Windows, `Get-FileHash -Algorithm SHA256` matches the raw-byte hashing the
  tests use; the seal script detects and preserves per-file EOL.

### Governance tests that bite

- `test/docs/links.test.ts` resolves every relative Markdown link in every
  document, and separately requires every file under `docs/protocol/` to be
  linked from the root `README.md`. Prefer backtick code spans for file paths
  in new documents so you create no links to maintain.
- `test/docs/provenance.test.ts` requires every document under
  `docs/protocol/` to be registered as ported or first-party, and every profile
  version to have an analysis document. The 2.1.280 analysis document and its
  three registrations already landed together in commit 37a81cf — they had to,
  or `test/docs` is red.
- `test/governance/version-dispatch.test.ts` fails the build if a
  `profile.id ===` comparison appears anywhere in `src/` outside
  `src/profile-behaviors.ts`. **This port adds none.** Everything new is
  registry-driven or catalogue-driven and is inert for the older profiles by
  construction.
- `test/governance/public-path-coverage.test.ts` requires each
  non-allowlisted `test/validation/*.test.ts` to import `../../src/index.js` at
  least once. The plan reminds you in seven places; the likeliest miss is the
  Phase 3.2 file that drives `composeBetasWithAudit` directly.
- `test/governance/source-hygiene.test.ts` bans certain literals in `src/`
  (for example the name of the non-cryptographic hash rhyming with "xxHash").
  Paraphrase in code comments; documents are exempt.
- `test/governance/baseline-evidence.test.ts` enforces a bijection between
  `test/fixtures/golden/` and the hash table in
  `docs/plans/baseline-2026-08-05.md`. Every fixture addition needs a
  hand-written row plus a dated amendment blockquote there.
- `test/governance/package-policy.test.ts` pins the manifest version and the
  `exports` block as literals. `test/governance/release-policy.test.ts`
  requires the first `## [x]` CHANGELOG heading to equal `package.json.version`
  (dated for stable). `test/runtime/runtime-neutral.test.ts` pins the public
  export set as a closed sorted list.
- `test/governance/provider-scope.test.ts` — see repository-state fact 4 above.

### Substantive traps specific to this port

- The five new `ComposableBetaRegistry` keys **must be optional**
  (`KEY?: BetaRegistryEntry`), following the existing `NARRATION_SUMMARIES?`
  precedent. The 2.1.195 registry (`src/beta-registry.ts`, 28 keys) and the
  2.1.233 registry lack most of them; making them required breaks compilation
  and moves the frozen digests. The push site is inert when the resolved
  registry has no entry, exactly as documented for `NARRATION_SUMMARIES`.
- The registry key for entry 39 is whatever
  `src/profiles/beta-registry-2.1.280.ts` actually declares. The convention is
  alias uppercased, so `mid_conversation_system_clear_at` →
  `MID_CONVERSATION_SYSTEM_CLEAR_AT`. The plan sometimes labels it
  `MID_CONV_SYSTEM_CLEAR_AT`. **The registry file is authoritative and the
  `ComposableBetaRegistry` key must match it character for character** — a
  mismatch makes the site silently inert, which no test catches except the
  14-identifier literal.
- `cacheDiagnosisEnabled` flips to `true` for 2.1.280 and 2.1.233 is
  deliberately left alone. Whether 2.1.233 was wrong is an open question that
  cannot be settled without acquiring the 2.1.233 binary; the plan says record
  it, not fix it.
- The default-path `anthropic-beta` literal is **fourteen** identifiers in a
  fixed order, and the body carries
  `thinking: {type: "adaptive", display: "updates"}`. The package emits nine of
  the fourteen today and additionally emits `redact-thinking-2026-02-12`, which
  the genuine client composes and then splices out. So the delta is five
  missing, one wrongly present, plus one data fix. Transcribe the literal and
  its join separator from the analysis document, never from the builder.
- Nothing in this port touches `src/profile-behaviors.ts`. Phase 5.5 exists to
  confirm that; finding that a version-gated flag _is_ required is stop
  condition (a), not a silent addition.

## Wave 0 must resolve five repository facts

The plan branches on them. Resolve by reading, record the answer, and take the
branch the plan specifies:

1. Does `test/governance/profile-coverage.test.ts` enumerate profile ids from
   the registered/accepted set, or from a hand-maintained list? This decides
   whether commit C5 needs a mechanism-inert golden fixture. The earlier "two
   temporary local commits squashed" device was **withdrawn** — it produced an
   intermediate-bytes fixture that the seal and the differential would then
   assert, turning later commits red.
2. Does `test/governance/source-trace-profiles.test.ts` enumerate registered
   profiles or a hand-maintained list? This decides whether the
   `docs/source-trace.md` profile row must land in C5 as a companion guard
   amendment rather than in C6.
3. Does `npm run typecheck` (either tsconfig) include `test/**`, and is vitest
   typecheck mode enabled? If neither, the `expectTypeOf` assertions prove
   nothing and should be dropped rather than kept as ceremony.
4. Is the composition audit included in anything hashed — the canary digest, a
   golden fixture, a differential derived field — and what does the
   `NARRATION_SUMMARIES` site place in the audit when its key is absent? Five
   new skipped entries in every older-profile composition would move the frozen
   digests.
5. Is the thinking-type resolution a function separate from the thinking
   emitter, callable before beta composition, or are they one function? This
   shapes the Phase 3.2 mechanism-seam design.

## What "done" looks like

The plan's eight exit criteria, in short: the 2.1.280 profile exported,
accepted, parsed, pinned and default; the 14-identifier literal asserted and
sealed as a fixture; three cross-runtime digests with the two older ones
unmoved; independently computed fingerprint vectors; every gate green at every
commit; `package.json` at `0.6.0` with a dated CHANGELOG heading carrying a
Breaking section and the exact rollback instruction (pin the previous profile
singleton); the three sibling documentation tasks committed with their suites
green; and the global adversarial `@heavy` review returning zero open BLOCKER
and MAJOR findings.

Start with the Wave 0 pre-flight. Report the branch decision and the five
resolved facts before touching any source file.
