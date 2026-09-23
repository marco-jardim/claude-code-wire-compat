# Claude Code 2.1.280 wire-profile port plan

**Goal:** Port the Claude Code 2.1.280 (SDK 0.112.1) wire profile into `D:\git\claude-code-wire-compat` so that a pinned caller — and, after the isolated default switch, an unpinned caller — receives requests that are byte-indistinguishable from the genuine 2.1.280 client, proven by golden fixtures, differential conformance, a third frozen cross-runtime digest and independently computed fingerprint vectors, while the two existing frozen digests (2.1.195, 2.1.233) do not move by a single byte. Land three documentation side tasks in `D:\git\opencode-anthropic-fix` and `D:\git\opencode-model-router`.

**Architecture:** Profiles are data (`D:\git\claude-code-wire-compat\src\profiles\*.ts`), behaviour is registry- and catalogue-driven mechanisms, and per-version identity comparisons live only in `D:\git\claude-code-wire-compat\src\profile-behaviors.ts`. The port therefore adds two data files (a 40-entry ordered beta registry with three auxiliary sets; scalars plus a 20-model catalogue), extends three data-driven mechanisms so they stay inert for the older registries and catalogues (capability derivation 6→8 strings; beta composition 17→22 push sites plus one removal; thinking display `"updates"` injected on the first-party path only), registers the profile through six seams plus the governance literals, freezes a third digest, switches `DEFAULT_PROFILE` in one isolated one-line commit, and completes the proof surface (fixtures, seal, matrix, reference adapter, differential, fingerprint). No `profile.id` comparison is added anywhere.

**Tech Stack:** TypeScript (strict, `exactOptionalPropertyTypes`), vitest 4, ESLint, Prettier, npm scripts, node 20/22/24 + bun + workerd for cross-runtime digests, pwsh 7 on win32. Siblings: `D:\git\opencode-anthropic-fix` (`.mjs` + JSDoc, vitest 4.0.18, no TypeScript) and `D:\git\opencode-model-router` (TypeScript ESM, no build step, vitest).

**Repos in scope:**

- `D:\git\claude-code-wire-compat` — primary; Waves 0–6.
- `D:\git\opencode-anthropic-fix` — side tasks 1 and 2; Wave 7, Phases 7.1 and 7.2.
- `D:\git\opencode-model-router` — side task 3; Wave 7, Phase 7.3.

**Evidence base (normative):** `D:\git\claude-code-wire-compat\docs\protocol\versions\claude-code-2.1.280-analysis.md` (2,385 lines, four adversarial reviews run, accepted). Every value in this plan's cross-check tables (Appendix D) is a convenience copy; on any discrepancy the analysis document wins and the plan is amended, never the other way round. The runbook's core rule applies verbatim: **"Never substitute a guess, an interpolation from the previous release, or a value copied from another platform's build."**

**Exit criteria:**

1. `CLAUDE_CODE_2_1_280_PROFILE` (mirroring the 2.1.233 export naming) is exported from `D:\git\claude-code-wire-compat\src\index.ts` and via the `./profiles/claude-code-2.1.280` subpath, accepted by identity in `D:\git\claude-code-wire-compat\src\build-request.ts`, parsed by `D:\git\claude-code-wire-compat\src\headers.ts`, pinned in `D:\git\claude-code-wire-compat\src\redaction.ts`, and is `DEFAULT_PROFILE`.
2. The 14-identifier `anthropic-beta` literal test for the `claude-opus-5-5` default path passes and is a golden fixture with a sealed byte hash.
3. `npm run test:pack` reports three profile digests; 2.1.195 = `6b9609b29463c890544845dd94acf560206b6f8165538faafd8886750037d277` and 2.1.233 = `4e06af42310d63549a4fa9af60ff0c9b13e95d7864624c6b7bf94d45ce9a3997` are unchanged; the 2.1.280 digest agrees across node/bun/workerd and is recorded in `D:\git\claude-code-wire-compat\scripts\verify-packed-consumers.mjs` and `D:\git\claude-code-wire-compat\AGENTS.md`.
4. `D:\git\claude-code-wire-compat\test\fingerprint-2.1.280.test.ts` carries known-answer vectors computed outside the package, calibrated against the known 2.1.233 vectors.
5. Every gate is green at every commit: `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`; at every wave end additionally `npm run test:coverage && npm run pack:check && npm run test:pack && npm run fixtures:check`.
6. `D:\git\claude-code-wire-compat\package.json` is `0.6.0` and `D:\git\claude-code-wire-compat\CHANGELOG.md` carries a dated `## [0.6.0]` heading with a Breaking section and the exact rollback instruction.
7. The three sibling side tasks are committed in their repositories with their test suites green.
8. The global adversarial `@heavy` review returns zero open findings.

---

## Execution directives

These directives override any local preference of the executing agent.

1. **Execute wave by wave without interruption.** Iterate Wave 0 → Wave 7 in order (subject to the parallelism map in Appendix B). Stop and ask the human ONLY for (a) a genuinely ambiguous requirement that cannot be resolved from the evidence in `D:\git\claude-code-wire-compat\docs\protocol\versions\claude-code-2.1.280-analysis.md`, or (b) a critical or blocking problem (missing runtime, a frozen digest moving with no explainable cause, a gate that cannot be made green without violating a hard rule). Everything else is decided by this plan; where the plan marks **RESOLVE FROM REPO**, the agent resolves it by reading the repository, not by asking.
2. **Commit often.** One Conventional Commit per concern, always `git commit -s`, never `git add -A`, always stage explicit full absolute paths (`git add "D:\git\claude-code-wire-compat\src\..."`). Data ports, canary updates and the default switch are always separate commits so each is independently revertable. Never amend a failed commit; fix and create a new one.
3. **Gate before you commit.** `GATE-COMMIT` — and `npm run test:pack` wherever a phase names it — runs to green _before_ `git add`. A commit is only ever created on an already-green tree. Because directive 2 forbids amending and the repository forbids force-push, a commit created before its gate is a permanently red commit in history and violates exit criterion 5 by construction.
4. **Maximise parallelism, orchestrate safely.** A file is written by at most one agent at a time, and is never read by any agent while another agent holds it for writing. Every phase carries a file-ownership table listing each file and its single owning task, and a parallel-safety note stating which tasks in that phase may run concurrently and which must serialise. Never run two writing tasks against the same worktree concurrently; different repositories are different worktrees and may proceed in parallel.
5. **No partial-delivery waves or phases.** A high-capability LLM agent executes the whole plan end to end; every wave delivers the definitive solution for its objective, never a scaffold, placeholder, `TODO`, temporary test or "stub first, complete later" step. A test that would be replaced by a later phase is forbidden — assert properties that remain true forever.
6. **Always use full absolute paths** when referring to any file, in dispatches, commit bodies, review briefs and step outputs.
7. **QA is adversarial, triaged, and tiered.** Every phase ends with an adversarial review executing a written brief. Findings are triaged by severity: a BLOCKER or MAJOR finding is fixed as a new `fix(<scope>)` commit by `[tier:medium]` and then re-reviewed, but the re-review reads ONLY the fix; a MINOR finding is fixed without re-review. "Zero open findings" in the exit criteria means zero open BLOCKER and MAJOR findings with every MINOR fixed — it is not an invitation to loop until the reviewer runs out of things to say. The review tier is set by what is actually at risk. `@heavy` adversarial review is mandatory for Phase 1.1, Phase 1.2, the merged Phase 3.2/3.3 review, Phase 5.1, Phase 5.3, Phase 5.4 and the global review: each of those turns on transcription fidelity against the evidence document, on frozen bytes, or on the independence of a second implementation. Every other phase review is a `[tier:medium]` checklist executing the same written brief, because its work is mechanical and its brief is a list of greps and counts. In all cases the orchestrator pre-gathers the phase diff, the gate output and the relevant analysis-document excerpts into the review dispatch, so the reviewer spends its budget on analysis rather than reconnaissance.

**Gate vocabulary used below** (all run from `D:\git\claude-code-wire-compat` unless a sibling repository is named):

- `GATE-COMMIT` = `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`
- `GATE-WAVE` = `GATE-COMMIT`, then `npm run test:coverage && npm run pack:check && npm run test:pack && npm run fixtures:check`

**Tooling traps that apply to every phase:**

- There is no `npm run format`; use `npx prettier --write <absolute paths>`. `D:\git\claude-code-wire-compat\docs\protocol\` is prettier-ignored; `D:\git\claude-code-wire-compat\docs\plans\` is NOT.
- vitest 4 has no `--reporter=basic`.
- ESLint bans `ReadonlyArray<T>` (use `readonly T[]`), the two-argument `expect(value, message)` form, and `toThrowError` (use `toThrow`). Put the diagnostic inside the asserted value when a readable failure is needed.
- `exactOptionalPropertyTypes` is on: build optional fields with conditional spreads, never `field: maybeUndefined`. An absent key and a key holding `undefined` are different bytes on the wire.
- Never suppress a type error (`as any`, `@ts-ignore`, `@ts-expect-error`). Type-level tests use vitest `expectTypeOf`.
- The executing shell may carry `$env:CI = 'true'`; `npm run fixtures:seal` refuses under a truthy `CI`. Clear it for that invocation only: `Remove-Item Env:CI -ErrorAction SilentlyContinue; npm run fixtures:seal`.
- pwsh, not bash: `$env:VAR`, `Get-ChildItem`, `Get-FileHash -Algorithm SHA256`, `Stop-Process`.

---

## Wave and phase map

| Wave | Phase | Objective                                                                                                                        | Runbook step                         |
| ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 0    | 0.1   | Commit the pack-policy fix, create the branch, record the green baseline                                                         | (pre-work)                           |
| 1    | 1.1   | Beta registry file (verify the untracked draft line by line)                                                                     | beta registry file                   |
| 1    | 1.2   | Catalogue/profile file                                                                                                           | catalogue/profile file               |
| 2    | 2.1   | Six registration seams + governance literals + source-trace row                                                                  | exports and registration             |
| 3    | 3.1   | Capabilities 6→8 (`D:\git\claude-code-wire-compat\src\contracts.ts`, `D:\git\claude-code-wire-compat\src\model-capabilities.ts`) | (mechanism, must precede the canary) |
| 3    | 3.2   | Four registry-driven push sites + `ComposeBetasInput` extension                                                                  | (mechanism, must precede the canary) |
| 3    | 3.3   | Thinking display updates trio + 14-identifier literal test                                                                       | (mechanism, must precede the canary) |
| 4    | 4.1   | Packed-consumer canary: third digest case, frozen                                                                                | packed-consumer canary               |
| 4    | 4.2   | `DEFAULT_PROFILE` switch — isolated one-line commit                                                                              | default switch                       |
| 5    | 5.1   | Golden fixtures + `manifest.models` + seal + baseline rows                                                                       | fixtures + seal                      |
| 5    | 5.2   | Profile matrix registration                                                                                                      | matrix registration                  |
| 5    | 5.3   | Reference adapter + differential                                                                                                 | adapter/differential                 |
| 5    | 5.4   | Fingerprint known-answer vectors (independent)                                                                                   | fingerprint vectors                  |
| 5    | 5.5   | Behaviour-flags audit (last, per runbook)                                                                                        | behaviour flags                      |
| 6    | 6.1   | README, AGENTS.md, runbook, MEMORY.md, versions index                                                                            | (docs)                               |
| 6    | 6.2   | Version bump 0.6.0 + CHANGELOG + package-policy version literal                                                                  | (release readiness)                  |
| 7    | 7.1   | `lean_prompt` documentation in `D:\git\opencode-anthropic-fix`                                                                   | side task 1                          |
| 7    | 7.2   | Cut Wave 4 (OIDC federation) from the OAuth parity plan                                                                          | side task 2                          |
| 7    | 7.3   | Per-turn effort documentation in `D:\git\opencode-model-router`                                                                  | side task 3                          |

**Why the mechanism wave (Wave 3) sits between registration and the canary.** The runbook lists registry → profile → registration → canary → default switch → fixtures → matrix → adapter/differential → fingerprint → behaviour flags. The three mechanism changes are not version-gated behaviour flags (nothing touches `D:\git\claude-code-wire-compat\src\profile-behaviors.ts`); they are data-driven mechanisms that are inert for the 2.1.195 and 2.1.233 registries and catalogues. They must be final before the canary so the 2.1.280 digest is computed exactly once on final bytes, and before fixtures so the sealed bytes are correct. Placing them after registration lets every mechanism test drive the real, registered 2.1.280 profile through the public `buildRequest` path instead of a test double. The benefit of registering before the mechanisms is narrower than it looks: guard-negative scenarios cannot use `buildRequest` at all, because `ACCEPTED_PROFILES` compares by object identity and rejects a modified profile copy, so those tests must drive `composeBetasWithAudit` directly. Only the positive adjacency and literal tests gain from registration-first. The cost — between the end of Wave 2 and the end of Wave 3 a pinned 2.1.280 request emits nine of the fourteen default-path betas plus `redact-thinking-2026-02-12` — is bounded: `DEFAULT_PROFILE` is untouched, nothing is released, no fixture exists yet, and no test asserts the intermediate list (directive 5).

---

## File Structure

### Primary repository — `D:\git\claude-code-wire-compat`

| Action                          | Path                                                                                                         | Phase    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Commit (already modified)       | `D:\git\claude-code-wire-compat\test\pack\pack-policy.test.ts`                                               | 0.1      |
| Create                          | `D:\git\claude-code-wire-compat\docs\plans\2026-09-23-claude-code-2.1.280-port-plan.md`                      | 0.1      |
| Create (verify untracked draft) | `D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.280.ts`                                       | 1.1      |
| Create                          | `D:\git\claude-code-wire-compat\src\profiles\claude-code-2.1.280.ts`                                         | 1.2      |
| Modify                          | `D:\git\claude-code-wire-compat\src\index.ts`                                                                | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\package.json` (exports)                                                      | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\src\betas.ts` (`PROFILE_BETA_REGISTRIES`)                                    | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\src\build-request.ts` (`ACCEPTED_PROFILES`)                                  | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\src\headers.ts` (`parseProfile`)                                             | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\src\redaction.ts` (`PINNED_PROFILE_IDS`)                                     | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\test\governance\package-policy.test.ts` (exports literal)                    | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\test\runtime\runtime-neutral.test.ts` (export list)                          | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\test\governance\provider-scope.test.ts` (`REFERENCE_IDENTIFIERS`)            | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\docs\source-trace.md` (profile row; divergences)                             | 2.1      |
| Modify                          | `D:\git\claude-code-wire-compat\src\contracts.ts` (`ClaudeCodeCapabilities`)                                 | 3.1      |
| Modify                          | `D:\git\claude-code-wire-compat\src\model-capabilities.ts` (`CATALOGUE_BACKED_CAPABILITIES`)                 | 3.1      |
| Modify                          | `D:\git\claude-code-wire-compat\src\betas.ts` (`ComposableBetaRegistry`, `ComposeBetasInput`, push sites)    | 3.2, 3.3 |
| Modify                          | `D:\git\claude-code-wire-compat\src\thinking.ts` (`ThinkingDisplay`, emission block)                         | 3.3      |
| Modify                          | `D:\git\claude-code-wire-compat\src\request-body.ts` (wiring of the shared predicate)                        | 3.3      |
| Modify                          | `D:\git\claude-code-wire-compat\scripts\verify-packed-consumers.mjs` (digest case)                           | 4.1      |
| Modify                          | `D:\git\claude-code-wire-compat\src\build-request.ts` (`DEFAULT_PROFILE`, one line)                          | 4.2      |
| Create                          | `D:\git\claude-code-wire-compat\test\fixtures\golden\<2.1.280 fixture files>` (names mirror the 2.1.233 set) | 5.1      |
| Modify                          | `D:\git\claude-code-wire-compat\test\fixtures\golden\manifest.json` (`manifest.models`, by hand)             | 5.1      |
| Modify                          | `D:\git\claude-code-wire-compat\docs\plans\baseline-2026-08-05.md` (rows + dated amendment)                  | 5.1      |
| Modify                          | `D:\git\claude-code-wire-compat\test\support\profile-matrix.ts`                                              | 5.2      |
| Modify                          | `D:\git\claude-code-wire-compat\test\conformance\reference-adapter.ts`                                       | 5.3      |
| Modify                          | `D:\git\claude-code-wire-compat\test\conformance\differential.test.ts`                                       | 5.3      |
| Create                          | `D:\git\claude-code-wire-compat\test\fingerprint-2.1.280.test.ts`                                            | 5.4      |
| Modify                          | `D:\git\claude-code-wire-compat\MEMORY.md` (append-only)                                                     | 5.5, 6.1 |
| Modify                          | `D:\git\claude-code-wire-compat\README.md`                                                                   | 6.1      |
| Modify                          | `D:\git\claude-code-wire-compat\AGENTS.md`                                                                   | 6.1      |
| Modify                          | `D:\git\claude-code-wire-compat\docs\plans\UPSTREAM-TRACKING-RUNBOOK.md`                                     | 6.1      |
| Modify                          | `D:\git\claude-code-wire-compat\docs\protocol\versions\README.md` (only if it carries a port-status column)  | 6.1      |
| Modify                          | `D:\git\claude-code-wire-compat\package.json` (version)                                                      | 6.2      |
| Modify                          | `D:\git\claude-code-wire-compat\CHANGELOG.md`                                                                | 6.2      |
| Modify                          | `D:\git\claude-code-wire-compat\test\governance\package-policy.test.ts` (version literal)                    | 6.2      |

### Test files created in the primary repository

| Path                                                                                                                                                         | Phase |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `D:\git\claude-code-wire-compat\test\validation\beta-registry-2.1.280.test.ts` (or the directory that holds the 2.1.233 registry test — mirror its location) | 1.1   |
| `D:\git\claude-code-wire-compat\test\validation\profile-2.1.280.test.ts` (same rule)                                                                         | 1.2   |
| `D:\git\claude-code-wire-compat\test\validation\registration-2.1.280.test.ts`                                                                                | 2.1   |
| `D:\git\claude-code-wire-compat\test\validation\capabilities-2.1.280.test.ts`                                                                                | 3.1   |
| `D:\git\claude-code-wire-compat\test\validation\betas-2.1.280-push-sites.test.ts`                                                                            | 3.2   |
| `D:\git\claude-code-wire-compat\test\validation\anthropic-beta-2.1.280-default-path.test.ts`                                                                 | 3.3   |
| `D:\git\claude-code-wire-compat\test\validation\thinking-display-updates-2.1.280.test.ts`                                                                    | 3.3   |
| `D:\git\claude-code-wire-compat\test\validation\default-profile-2.1.280.test.ts`                                                                             | 4.2   |
| `D:\git\claude-code-wire-compat\test\fingerprint-2.1.280.test.ts`                                                                                            | 5.4   |

Every file under `D:\git\claude-code-wire-compat\test\validation\` must import `../../src/index.js` at least once (`D:\git\claude-code-wire-compat\test\governance\public-path-coverage.test.ts`); deep imports are otherwise fine.

### Sibling repositories

| Action | Path                                                                                            | Phase |
| ------ | ----------------------------------------------------------------------------------------------- | ----- |
| Create | `D:\git\opencode-anthropic-fix\docs\lean-prompt-claude-code-2.1.280.md`                         | 7.1   |
| Modify | `D:\git\opencode-anthropic-fix\docs\mimese-http-header-system-prompt.md` (cross-reference only) | 7.1   |
| Modify | `D:\git\opencode-anthropic-fix\docs\plans\2026-09-22-oauth-2.1.280-parity-plan.md`              | 7.2   |
| Create | `D:\git\opencode-model-router\docs\PER_TURN_EFFORT.md`                                          | 7.3   |
| Modify | `D:\git\opencode-model-router\docs\CONFIG_REFERENCE.md` (cross-reference only)                  | 7.3   |

---

## Evidence map — how to locate each topic in the analysis document

Search `D:\git\claude-code-wire-compat\docs\protocol\versions\claude-code-2.1.280-analysis.md` for the literal in the right-hand column; do not rely on section numbers other than §7.6.2, which is confirmed.

| Topic                                                                     | Locate by searching for                                                                                                                                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beta registry (40 entries, two null slots, two internal non-beta members) | `thinking-binding-controls-2026-08-01` and `x-cc-internal-mid-conv-cache-promotion`                                                                                                                     |
| Third-party allowed / Bedrock unsupported / count-tokens sets             | `dangerous-tool-use-2026-09-03` (third-party list), `tool-search-tool-2025-10-19` (Bedrock list), `oauth-2025-04-20` (count-tokens list)                                                                |
| Profile scalars                                                           | `80abbfe7d7232280011ff01a21ae3338f4c6e372` and `2026-09-21T20:40:17Z`                                                                                                                                   |
| `cacheDiagnosisEnabled` flip and the 2.1.233 open question                | §7.6.2                                                                                                                                                                                                  |
| Catalogue (20 entries)                                                    | `claude-opus-5-5` and `opus_5_5_prompt_bundle`                                                                                                                                                          |
| Context-object rule                                                       | `supports_1m_suffix` and `native_1m_3p`                                                                                                                                                                 |
| Unmodelled catalogue keys                                                 | `effort_cost_index` and `advisor_rank`                                                                                                                                                                  |
| Push-site guards for the five new betas                                   | `per-turn-control-2026-07-01`, `mid-conversation-tool-changes-2026-07-01`, `mid-conversation-system-clear-at-2026-08-21`, `thinking-binding-controls-2026-08-01`, `thinking-display-updates-2026-08-18` |
| `redact-thinking` composed-then-spliced behaviour                         | `redact-thinking-2026-02-12`                                                                                                                                                                            |
| Thinking object construction incl. `display: "updates"`                   | `"updates"`                                                                                                                                                                                             |
| 14-identifier default-path literal                                        | `cache-diagnosis-2026-04-07`                                                                                                                                                                            |
| Fingerprint transcription                                                 | `59cf53e54c78` (byte 12542900 of the carved bundle)                                                                                                                                                     |
| Recorded-but-not-ported divergences                                       | `L7t`, `inline_tools`, `lean_prompt`, `clear_at`, `context_hint`                                                                                                                                        |

---

## Wave 0 — Baseline hygiene

### Phase 0.1 — Commit the pack-policy fix, create the working branch, record the green baseline

**File ownership**

| File                                                                                                                                      | Owning task |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\test\pack\pack-policy.test.ts`                                                                            | Task 0.1.2  |
| `D:\git\claude-code-wire-compat\docs\protocol\versions\claude-code-2.1.280-analysis.md` and its three registrations (only if uncommitted) | Task 0.1.3  |
| `D:\git\claude-code-wire-compat\docs\plans\2026-09-23-claude-code-2.1.280-port-plan.md`                                                   | Task 0.1.4  |

**Parallel-safety note:** Tasks 0.1.1 → 0.1.2 → 0.1.3 → 0.1.4 → 0.1.5 serialise (each commit builds on the previous one). No task in this phase may run concurrently with any other writing task in `D:\git\claude-code-wire-compat`.

#### Pre-flight check

1. Correct repository: `git -C "D:\git\claude-code-wire-compat" rev-parse --show-toplevel` prints `D:/git/claude-code-wire-compat`.
2. Expected dirty state and nothing else: `git -C "D:\git\claude-code-wire-compat" status --porcelain` lists exactly ` M test/pack/pack-policy.test.ts`, `?? src/profiles/beta-registry-2.1.280.ts`, and — only if not yet committed — the analysis document plus its registrations in `D:\git\claude-code-wire-compat\test\docs\provenance.test.ts`, `D:\git\claude-code-wire-compat\README.md`, `D:\git\claude-code-wire-compat\docs\protocol\versions\README.md`. Any other entry is a blocking problem (directive 1b).
3. Toolchain: `node --version` (20, 22 or 24), `npm --version`, `bun --version`; **RESOLVE FROM REPO:** read the header of `D:\git\claude-code-wire-compat\scripts\verify-packed-consumers.mjs` for how workerd is invoked and confirm it runs. A missing runtime is a blocking problem.
4. Dependencies installed: `npm ls --depth=0` from `D:\git\claude-code-wire-compat` reports no `missing`.
5. Expected baseline: `npx vitest run test/docs test/governance` → 17 files / 408 tests pass; `npx vitest run test/pack/pack-policy.test.ts` → 1 file / 2 tests pass; `npm run typecheck` and `npm run format:check` clean.
6. Version pins: `D:\git\claude-code-wire-compat\package.json` is `0.5.0`; the first heading in `D:\git\claude-code-wire-compat\CHANGELOG.md` is `## [0.5.0] - 2026-08-16`.
7. `$env:CI` value recorded (`$env:CI`) so the seal phase knows whether it must be cleared.
8. Five repository facts that later phases branch on. Resolve each by reading the repository and record the answer in the task output; do not ask the human.
   (i) Does `D:\git\claude-code-wire-compat\test\governance\profile-coverage.test.ts` enumerate profile ids from `ACCEPTED_PROFILES` (or any registered set) or from a hand-maintained list?
   (ii) Does `D:\git\claude-code-wire-compat\test\governance\source-trace-profiles.test.ts` enumerate registered profiles or a hand-maintained list?
   (iii) Does `npm run typecheck` (either tsconfig) include `test/**`, and is vitest typecheck mode enabled?
   (iv) Is the beta-composition audit included in anything hashed — the canary digest, a golden fixture, a differential derived field — and what does the `NARRATION_SUMMARIES` push site place in the audit when the resolved registry lacks that key?
   (v) Is the thinking-type resolution a function separate from the thinking emitter, callable before beta composition, or are they one function?

#### Task 0.1.1 (BASE-BRANCH) [tier:fast]: Create the working branch

**Files:** none.

**Why this matters:** Publishing goes through a PR to `main`; all port commits must sit on one branch so the PR review sees the whole cycle and so nothing lands on `main` mid-cycle.

- [ ] **Step 0.1.1.1:** `git -C "D:\git\claude-code-wire-compat" branch --show-current` — record the base branch name.
- [ ] **Step 0.1.1.2:** `git -C "D:\git\claude-code-wire-compat" switch -c port/claude-code-2.1.280`.
- [ ] **Step 0.1.1.3:** Record `git -C "D:\git\claude-code-wire-compat" rev-parse HEAD` as the cycle base SHA in the task output (used by every later review brief as the diff base).

#### Task 0.1.2 (BASE-PACKFIX) [tier:medium]: Commit the already-fixed pack-policy test

**Files:**

- Modify: none (the edit already exists on disk).
- Test: `D:\git\claude-code-wire-compat\test\pack\pack-policy.test.ts`

**Why this matters:** npm 12 changed `npm pack --json` from an array to a keyed object; the fix (`firstPackResult(packOutput: string): PackResult | undefined`, both call sites, retained `expect(packResult).toBeDefined()`, explicit `undefined` guards) is verified but uncommitted. It must be the first commit so every later gate run stands on a green pack test.

- [ ] **Step 0.1.2.1:** `git -C "D:\git\claude-code-wire-compat" diff -- test/pack/pack-policy.test.ts` — confirm the diff contains only the helper above the `describe` block and the two call-site replacements (former lines 95 and 148); nothing else.
- [ ] **Step 0.1.2.2:** `npx vitest run test/pack/pack-policy.test.ts` → 2 tests pass; `npm run typecheck`; `npm run lint`; `npm run format:check`.
- [ ] **Step 0.1.2.3:** `git add "D:\git\claude-code-wire-compat\test\pack\pack-policy.test.ts"`.
- [ ] **Step 0.1.2.4:** `git commit -s -m "test(pack): accept npm 12 keyed-object pack output in pack-policy"` with a body naming the helper and both former line numbers.

#### Task 0.1.3 (BASE-ANALYSIS) [tier:medium]: Commit the analysis document and its registrations if they are not yet committed

**Files:**

- Create/Modify (conditional): `D:\git\claude-code-wire-compat\docs\protocol\versions\claude-code-2.1.280-analysis.md`, `D:\git\claude-code-wire-compat\test\docs\provenance.test.ts`, `D:\git\claude-code-wire-compat\README.md`, `D:\git\claude-code-wire-compat\docs\protocol\versions\README.md`.

**Why this matters:** The provenance test requires the analysis document per profile before any code; the port cannot start from an uncommitted evidence base. If the analysis document is uncommitted, its provenance registration in `D:\git\claude-code-wire-compat\test\docs\provenance.test.ts`, the link in the root `D:\git\claude-code-wire-compat\README.md`, and the row in `D:\git\claude-code-wire-compat\docs\protocol\versions\README.md` must land in the SAME commit, or `npx vitest run test/docs` is red at that commit.

- [ ] **Step 0.1.3.1:** If pre-flight item 2 showed these four files as clean, skip this task and say so in the output.
- [ ] **Step 0.1.3.2:** Otherwise `npx vitest run test/docs test/governance` (17 files / 408 tests), `npm run format:check`, then `git add` the four absolute paths and `git commit -s -m "docs(protocol): add claude-code-2.1.280 analysis document"`.

#### Task 0.1.4 (BASE-PLAN) [tier:medium]: Commit this plan

**Files:**

- Create: `D:\git\claude-code-wire-compat\docs\plans\2026-09-23-claude-code-2.1.280-port-plan.md`

**Why this matters:** `D:\git\claude-code-wire-compat\docs\plans\` is Prettier-checked and `D:\git\claude-code-wire-compat\test\docs\links.test.ts` resolves every relative Markdown link in every document; the plan must itself pass the gates it imposes.

- [ ] **Step 0.1.4.1:** `npx prettier --write "D:\git\claude-code-wire-compat\docs\plans\2026-09-23-claude-code-2.1.280-port-plan.md"`.
- [ ] **Step 0.1.4.2:** `npx vitest run test/docs` — links and provenance green (the plan contains no relative Markdown links by design; paths are code spans).
- [ ] **Step 0.1.4.3:** `git add "D:\git\claude-code-wire-compat\docs\plans\2026-09-23-claude-code-2.1.280-port-plan.md"` and `git commit -s -m "docs(plans): add claude-code-2.1.280 port plan"`.

#### Task 0.1.5 (BASE-GATES) [tier:fast]: Record the full green baseline

**Files:** none.

**Why this matters:** Every later "expected baseline" pre-flight item compares against these numbers; the two frozen digests must be observed green before any port change.

- [ ] **Step 0.1.5.1:** Run `GATE-WAVE` from `D:\git\claude-code-wire-compat`; record file/test counts from `npm test`, the four coverage percentages from `npm run test:coverage`, and the two digests printed by `npm run test:pack` (must equal the frozen values in the preamble).
- [ ] **Step 0.1.5.2:** Store the record in the task output; the orchestrator carries it into every subsequent pre-flight.

#### New tests

None authored in this phase. The committed `D:\git\claude-code-wire-compat\test\pack\pack-policy.test.ts` already covers: legacy array shape (npm ≤ 11), npm-12 keyed-object shape, and the `undefined` result path (`expect(packResult).toBeDefined()` failing readably). Edge case verified by reading the helper: an empty JSON object yields `undefined`, not a throw.

#### Acceptance criteria

- Branch `port/claude-code-2.1.280` exists and carries commits C0 (pack fix), C1 (conditional, analysis), C2 (plan).
- `git status --porcelain` shows exactly `?? src/profiles/beta-registry-2.1.280.ts`.
- `GATE-WAVE` green; both frozen digests observed.

#### Definition of Done

- All steps checked; baseline record captured; QA review below returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `GATE-WAVE` (Task 0.1.5).

**Review brief:** Attack (1) whether the pack-policy diff contains anything beyond the described helper and call-site changes; (2) whether the helper silently accepts a malformed npm output (e.g. an object whose first value is not a pack result) and whether the retained `toBeDefined` assertion would still produce a readable failure; (3) whether the plan document contains any relative Markdown link, any non-absolute path, any `ReadonlyArray`, or any instruction that contradicts `D:\git\claude-code-wire-compat\AGENTS.md`; (4) whether the recorded baseline digests equal the frozen literals exactly. Dispatch contents: the two diffs, the `GATE-WAVE` output, the preamble of `D:\git\claude-code-wire-compat\AGENTS.md`.

---

## Wave 1 — Data port

### Phase 1.1 — Beta registry file `D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.280.ts`

**File ownership**

| File                                                                                                      | Owning task |
| --------------------------------------------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.280.ts`                                    | Task 1.1.2  |
| `D:\git\claude-code-wire-compat\test\validation\beta-registry-2.1.280.test.ts` (or the mirrored location) | Task 1.1.3  |

**Parallel-safety note:** Strictly serial: 1.1.1 → 1.1.2 → 1.1.3. Task 1.1.3 transcribes its expected literals from the analysis document, never from the registry file. Phase 1.2 serialises after this phase; no two writing tasks share this worktree.

#### Pre-flight check

1. Correct repository and branch: `git -C "D:\git\claude-code-wire-compat" branch --show-current` → `port/claude-code-2.1.280`.
2. Clean worktree except the known untracked draft: `git status --porcelain` → exactly `?? src/profiles/beta-registry-2.1.280.ts`.
3. Expected baseline: `GATE-COMMIT` green at HEAD; HEAD is at or after C2 and the worktree is clean.
4. Evidence present: `Select-String -Path "D:\git\claude-code-wire-compat\docs\protocol\versions\claude-code-2.1.280-analysis.md" -Pattern "thinking-binding-controls-2026-08-01" -SimpleMatch` returns at least one hit.
5. Shape reference read (fast tier): `D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.233.ts` — record its export names, the `deepFreeze` import path, the entry type name (`BetaRegistryEntry` per `D:\git\claude-code-wire-compat\src\betas.ts`), how the duplicated alias `tool_search` (entries 8 and 9) is keyed, and where the 2.1.233 registry test lives.
6. Draft size sanity: `(Get-Content "D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.280.ts").Count` is roughly 280.

#### Task 1.1.1 (REG-DIFF) [tier:fast]: Compare the untracked draft against the analysis document, entry by entry

**Files:** read-only.

**Why this matters:** The draft was written prematurely. Trusting it without a line-by-line comparison violates the core rule; the comparison must be recorded, not implied.

- [ ] **Step 1.1.1.1:** From the analysis document, list the 42-slot upstream literal: 40 alias/header pairs in array order, the two `null` slots at 0-based indices 34 and 37, and the two excluded non-beta members `x-cc-internal-mid-conv-cache-promotion` and `x-cc-internal-mid-conv-cache-promotion-ok`.
- [ ] **Step 1.1.1.2:** From the draft, list its entries in declaration order with their header strings.
- [ ] **Step 1.1.1.3:** Report every discrepancy in order, header spelling, alias spelling, key naming, missing or extra entry, and whether the nulls and internal members are documented in comments rather than transcribed.
- [ ] **Step 1.1.1.4:** Repeat for the three auxiliary sets (`THIRD_PARTY_ALLOWED_BETAS_2_1_280` 14 members, `BEDROCK_UNSUPPORTED_BETAS_2_1_280` 3, `COUNT_TOKENS_BETAS_2_1_280` 4) in upstream literal order.
- [ ] **Step 1.1.1.5:** Confirm `narration_summaries` is absent and record the fact.
- [ ] **Step 1.1.1.6:** Record the draft's key for entry 39 (`mid_conversation_system_clear_at`): the existing convention maps alias → uppercased alias (`mid_conversation_system` → `MID_CONVERSATION_SYSTEM`), so the expected key is `MID_CONVERSATION_SYSTEM_CLEAR_AT`; this plan's later phases refer to it as `MID_CONV_SYSTEM_CLEAR_AT` only as a label — **the registry file's key is authoritative and the `ComposableBetaRegistry` key in Phase 3.2 must match it character for character.**

#### Task 1.1.2 (REG-WRITE) [tier:medium]: Make the registry file definitive

**Files:**

- Create (from the verified draft, or re-derived from scratch — both acceptable): `D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.280.ts`

**Why this matters:** This file is the first data artefact of the port and the single input to five new push sites; an entry in the wrong slot or a misspelled header produces wrong bytes that no later gate can catch except the fixtures, which are derived from it.

- [ ] **Step 1.1.2.1:** Apply every discrepancy from Task 1.1.1; if more than three discrepancies exist, re-derive the whole file from the analysis document instead of patching.
- [ ] **Step 1.1.2.2:** Shape: mirror `D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.233.ts` exactly — same `deepFreeze` usage, same entry type, same export naming pattern (the registry constant name follows the 2.1.233 name with `2_1_280`), same file header comment style; the two null slots and the two internal non-beta members are documented in a comment block that quotes their upstream indices/names and states they are not transcribed.
- [ ] **Step 1.1.2.3:** Entry 17 `thinking_resumption` / `thinking-resumption-2026-07-17` sits between `redact_thinking` and `thinking_token_count`; entry 40 `thinking_binding_controls` is last even though declared earlier upstream — add a one-line comment stating array order is authoritative.
- [ ] **Step 1.1.2.4:** Export the three auxiliary sets as `readonly string[]` (never `ReadonlyArray<string>`), deep-frozen, in upstream literal order. Add a comment on the 14-member third-party set that it is unrelated to the 14-identifier default-path literal (same count, different thing).
- [ ] **Step 1.1.2.5:** `npx prettier --write "D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.280.ts"`; `npm run lint`; `npm run typecheck`. Note: the file is not yet imported anywhere; `npm run build` must still compile it if `tsconfig` includes `src/**` — confirm the build output contains `dist/profiles/beta-registry-2.1.280.js`.
- [ ] **Step 1.1.2.6:** `git add "D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.280.ts"`.

#### Task 1.1.3 (REG-TEST) [tier:medium]: Author the registry known-answer test

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\validation\beta-registry-2.1.280.test.ts` (place beside the 2.1.233 registry test if it lives elsewhere; if the directory is `test/validation/`, include a genuine `../../src/index.js` import).

**Why this matters:** A second, independent transcription of the header list from the analysis document into the test catches a transcription slip in either artefact. The test is permanent.

- [ ] **Step 1.1.3.1:** Transcribe the 40 header strings from the analysis document (not from the registry file, not from this plan) into a `readonly string[]` literal inside the test.
- [ ] **Step 1.1.3.2:** Author the tests listed under **New tests** below.
- [ ] **Step 1.1.3.3:** `npx vitest run <this file>`; `npm run lint`; `npm run typecheck`; `npm run format:check`.
- [ ] **Step 1.1.3.4:** `git add` the test file; together with Task 1.1.2's staged file: `git commit -s -m "feat(profiles): add claude-code-2.1.280 beta registry"` with a body listing the nine new entries and the excluded members.
- [ ] **Step 1.1.3.5:** Run `GATE-COMMIT`.

#### New tests

This file must import `../../src/index.js` at least once, or `D:\git\claude-code-wire-compat\test\governance\public-path-coverage.test.ts` fails; deep imports are otherwise fine.

`describe("claude-code-2.1.280 beta registry")` in `D:\git\claude-code-wire-compat\test\validation\beta-registry-2.1.280.test.ts`:

- `has exactly 40 entries` — count of the registry's own values equals 40.
- `lists headers in upstream array order` — the ordered header strings equal the transcribed literal (order-sensitive `toEqual`).
- `carries the nine entries new since 2.1.233 and no others` — set difference against the 2.1.233 registry's headers equals exactly the nine new headers; the reverse difference is empty (nothing removed).
- `does not contain the two null slots or the two internal non-beta members` — no entry has an empty/undefined header; `x-cc-internal-mid-conv-cache-promotion` and `x-cc-internal-mid-conv-cache-promotion-ok` are absent.
- `keeps narration_summaries absent` — no header equal to the 2.1.195 narration-summaries header string (read it from `D:\git\claude-code-wire-compat\src\beta-registry.ts`).
- `has no duplicate headers` — `new Set(headers).size === 40`.
- `is deeply frozen` — `Object.isFrozen` on the registry and on every entry; assignment in strict mode throws (assert with `toThrow`).
- `THIRD_PARTY_ALLOWED_BETAS_2_1_280 has the 14 members in upstream order` — exact ordered literal.
- `BEDROCK_UNSUPPORTED_BETAS_2_1_280 has the 3 members in upstream order` and `COUNT_TOKENS_BETAS_2_1_280 has the 4 members in upstream order`.
- `every auxiliary-set member is a registry header` — guards typos in the sets.
- Edge case: `entry 40 thinking_binding_controls is last` and `entry 17 thinking_resumption sits between redact_thinking and thinking_token_count` — index assertions on the ordered list.

#### Acceptance criteria

- Task 1.1.1's discrepancy report is recorded in the commit body (count and nature).
- `GATE-COMMIT` green; the two frozen digests untouched (`npm run test:pack` not required at this commit but must be green at wave end).
- The file matches the analysis document on all 40 entries, both nulls, both exclusions and the three sets.

#### Definition of Done

- Commit C3 present; QA review returned zero open findings; worktree clean.

#### Senior QA review (`@heavy`, adversarial)

**Gates run in this phase:** `GATE-COMMIT`.

**Review brief:** With the registry file, the test file and the analysis document's registry excerpt in the dispatch, attack: (1) any header string that differs by one character from the analysis document (dates are the usual failure: compare every `YYYY-MM-DD` suffix); (2) whether entry order matches the 42-slot literal after removing indices 34 and 37; (3) whether the key naming of entry 39 follows the file's own convention and whether any key would collide with a `ComposableBetaRegistry` key of a different meaning; (4) whether the test's literal was transcribed from the analysis document rather than copied from the registry file (it must not import the registry to build its expectation); (5) whether either internal `x-cc-internal-*` member leaked in as an entry or as a set member; (6) whether `ReadonlyArray` or a two-argument `expect` slipped in.

---

### Phase 1.2 — Catalogue/profile file `D:\git\claude-code-wire-compat\src\profiles\claude-code-2.1.280.ts`

**File ownership**

| File                                                                                                                              | Owning task |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\src\profiles\claude-code-2.1.280.ts`                                                              | Task 1.2.2  |
| `D:\git\claude-code-wire-compat\src\contracts.ts` (only if `defaultEffort` or `family` is a closed union missing a needed member) | Task 1.2.2  |
| `D:\git\claude-code-wire-compat\test\validation\profile-2.1.280.test.ts`                                                          | Task 1.2.3  |

**Parallel-safety note:** Strictly serial: 1.2.1 → 1.2.2 → 1.2.3, after Phase 1.1. Task 1.2.3 transcribes its expectations from the analysis document, never from the profile file. If Task 1.2.2 must touch `D:\git\claude-code-wire-compat\src\contracts.ts`, it is the sole writer of that file.

#### Pre-flight check

1. Correct repository/branch as in Phase 1.1; `git status --porcelain` clean apart from any Phase 1.1 files currently held by their owning task.
2. Expected baseline: `GATE-COMMIT` green at HEAD.
3. Evidence present: `Select-String ... -Pattern "opus_5_5_prompt_bundle" -SimpleMatch` hits in the analysis document.
4. Shape reference (fast tier): read `D:\git\claude-code-wire-compat\src\profiles\claude-code-2.1.233.ts` and record: export name pattern, `deepFreeze` usage, where `COUNT_TOKENS_ENDPOINT` is imported from, the catalogue container shape (array vs keyed object, and whether catalogue order is the container's iteration order), the `context` sub-object construction, and how `defaultEffort` is expressed.
5. Type reference (fast tier): read `D:\git\claude-code-wire-compat\src\contracts.ts:27-53` (`ClaudeCodeCatalogueEntry`) and `:1108-1136` (`ClaudeCodeProtocolProfile`) (pre-port line reference; locate by symbol); record whether `defaultEffort` is a closed union and whether it contains `"medium"`, and whether `family` admits `fable` and `mythos` (it must — both exist in 2.1.233).
6. Governance reference (fast tier): grep `D:\git\claude-code-wire-compat\test\governance\` for any allowlist of catalogue capability strings; record whether the new strings (`per_turn_effort`, `per_turn_timing`, `mid_conv_tool_change`, `thinking_disabled_effort_cap`, `fast_mode`, `lean_prompt`, `refusal_fallback`, `opus_5_prompt_bundle`, `opus_5_5_prompt_bundle`, `fable_5_mitigations`, `fable_5_1_prompt_bundle`, `mid_conv_system`) need registration there.

#### Task 1.2.1 (PROF-EXTRACT) [tier:fast]: Extract the scalar block, policy, catalogue and context rule from the analysis document

**Files:** read-only.

**Why this matters:** The implementer transcribes from an extracted, quoted excerpt of the evidence, so the transcription can be reviewed against the quote.

- [ ] **Step 1.2.1.1:** Quote the scalar values: `id`, `cliVersion`, `sdkVersion`, `endpoint`, `entrypoint`, `userAgent`, `buildTime`, `gitSha`, `attributionHeaderEnabled`, `provider`, `anthropicVersion`, `contextHintEnabled`.
- [ ] **Step 1.2.1.2:** Quote the eleven `betaPolicy` booleans and the §7.6.2 paragraph on `cacheDiagnosisEnabled`.
- [ ] **Step 1.2.1.3:** Quote the 20 catalogue entries with family, `max_output_tokens` default/upper, `default_effort`, capability arrays, and the `native_1m` / `supports_1m_beta` declarations.
- [ ] **Step 1.2.1.4:** Quote the context-object rule and the list of ten unmodelled keys; confirm the three dated identifiers (`claude-haiku-4-5-20251001`, `claude-opus-4-1-20250805`, `claude-opus-4-5-20251101`) are `provider_ids.first_party` values.
- [ ] **Step 1.2.1.5:** **RESOLVE FROM EVIDENCE:** whether the default path for `claude-opus-5-5` (default effort `medium`) emits `output_config.effort` and with which value. Record the answer or record that the document is silent — silence here is stop condition (a). It is checked and raised at the **Phase 4.1 pre-flight**, not before Phase 5.1: the body this governs is frozen into the cross-runtime digest at C10, well before the fixtures exist.

#### Task 1.2.2 (PROF-WRITE) [tier:medium]: Write the profile file

**Files:**

- Create: `D:\git\claude-code-wire-compat\src\profiles\claude-code-2.1.280.ts`
- Modify (conditional): `D:\git\claude-code-wire-compat\src\contracts.ts` — widen `defaultEffort` to admit `"medium"` only if pre-flight item 5 found a closed union lacking it; nothing else.

**Why this matters:** Scalars drive headers and the fingerprint; the catalogue drives capability derivation and therefore which betas fire. `contextHintEnabled: false` and `cacheDiagnosisEnabled: true` are the two behavioural deltas hidden in data.

- [ ] **Step 1.2.2.1:** Mirror the 2.1.233 file shape from pre-flight item 4. Export `CLAUDE_CODE_2_1_280_PROFILE` (name pattern mirrors `CLAUDE_CODE_2_1_233_PROFILE`).
- [ ] **Step 1.2.2.2:** Transcribe the scalars from Task 1.2.1's quote: id `claude-code-2.1.280-sdk-0.112.1`, cliVersion `2.1.280`, sdkVersion `0.112.1`, endpoint `https://api.anthropic.com/v1/messages?beta=true`, `countTokensEndpoint` from the imported `COUNT_TOKENS_ENDPOINT`, entrypoint `cli`, userAgent `claude-cli/2.1.280 (external, cli)`, buildTime `2026-09-21T20:40:17Z`, gitSha `80abbfe7d7232280011ff01a21ae3338f4c6e372`, attributionHeaderEnabled `true`, provider `anthropic`, anthropicVersion `2023-06-01`, contextHintEnabled `false`.
- [ ] **Step 1.2.2.3:** Transcribe `betaPolicy`: `oauthAuthenticated: true`, `experimentalBetasEnabled: true`, `oneMillionContextEnabled: true`, `interleavedThinkingEnabled: true`, `interactive: true`, `thinkingSummariesShown: false`, `thinkingTokenCountEnabled: true`, `narrationSummariesEnabled: false`, `structuredOutputsEnabled: false`, `afkModeEnabled: false`, `cacheDiagnosisEnabled: true`. Add a comment on `cacheDiagnosisEnabled` citing §7.6.2 and stating that 2.1.233 is deliberately left untouched (its digest must not move) and that whether 2.1.233 was wrong is an open question requiring the 2.1.233 binary.
- [ ] **Step 1.2.2.4:** Transcribe the 20 catalogue entries in catalogue order with `family`, `maxOutputTokens {default, upper}`, `defaultEffort` (only where declared: `claude-sonnet-5` high, `claude-opus-4-7` xhigh, `claude-opus-4-8` high, `claude-opus-5` high, `claude-opus-5-5` medium, `claude-fable-5` high, `claude-fable-5-1` high, `claude-mythos-5-1` high) and the verbatim capability arrays. Use conditional spreads for every optional field so that absent keys are absent, not `undefined`.
- [ ] **Step 1.2.2.5:** Apply the context rule: emit `context` only for the 13 entries listed in Appendix D.3 — `{window: 200000, supports1mBeta: true}` for `claude-sonnet-4-0`, `claude-sonnet-4-5`, `claude-sonnet-4-6`, `claude-opus-4-6`; `{window: 1000000, native1m: true, supports1mBeta: true}` for `claude-sonnet-5`, `claude-opus-4-7`, `claude-opus-4-8`, `claude-opus-5`, `claude-opus-5-5`, `claude-fable-5`, `claude-fable-5-1`, `claude-mythos-5`, `claude-mythos-5-1`; no `context` key at all for the other seven. Write `1000000` in the same numeric form the 2.1.233 file uses.
- [ ] **Step 1.2.2.6:** Add a header comment listing the ten unmodelled upstream keys and the three discarded dated identifiers, with a one-line reason each (Anthropic-only package; `provider_ids.first_party` values).
- [ ] **Step 1.2.2.7:** `claude-mythos-5` keeps `capabilities: []` (deliberate denial preserved from 2.1.233) — comment it.
- [ ] **Step 1.2.2.8:** `npx prettier --write` the file (and `D:\git\claude-code-wire-compat\src\contracts.ts` if touched); `npm run lint`; `npm run typecheck`; `npm run build`.
- [ ] **Step 1.2.2.9:** `git add` the file(s).

#### Task 1.2.3 (PROF-TEST) [tier:medium]: Author the profile known-answer test

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\validation\profile-2.1.280.test.ts`

**Why this matters:** The catalogue is 20 × (family, limits, effort, capabilities, context) = the largest transcription surface in the port; every cell needs an independent expectation.

- [ ] **Step 1.2.3.1:** Transcribe expectations from the analysis document (not from the profile file) into literals.
- [ ] **Step 1.2.3.2:** Author the tests under **New tests**.
- [ ] **Step 1.2.3.3:** `npx vitest run <file>`; then with Task 1.2.2's staged file: `git commit -s -m "feat(profiles): add claude-code-2.1.280 profile and 20-model catalogue"`; body lists the three new models and the two policy/scalar deltas.
- [ ] **Step 1.2.3.4:** Run `GATE-COMMIT`, then `GATE-WAVE` (end of Wave 1): confirm both frozen digests unchanged and coverage not below threshold.

#### New tests

`D:\git\claude-code-wire-compat\test\validation\profile-2.1.280.test.ts` must import `../../src/index.js` at least once, or `D:\git\claude-code-wire-compat\test\governance\public-path-coverage.test.ts` fails; deep imports are otherwise fine.

`describe("claude-code-2.1.280 profile")`:

- `carries the transcribed scalars` — every scalar equals its literal (id, cliVersion, sdkVersion, endpoint, entrypoint, userAgent, buildTime, gitSha, attributionHeaderEnabled, provider, anthropicVersion, contextHintEnabled false).
- `carries the transcribed beta policy` — the eleven booleans as an object literal, including `cacheDiagnosisEnabled: true`.
- `differs from 2.1.233 policy only in cacheDiagnosisEnabled` — object diff against `CLAUDE_CODE_2_1_233_PROFILE.betaPolicy` yields exactly that key.
- `has 20 catalogue entries in catalogue order` — ordered id list literal.
- `adds exactly claude-opus-5-5, claude-fable-5-1 and claude-mythos-5-1 versus 2.1.233` — set differences both ways.
- `carries the transcribed family, output limits and default effort per entry` — a table-driven `it.each` over the 20 rows.
- `carries the verbatim capability arrays per entry` — `it.each` with order-sensitive `toEqual`.
- `emits a context object for exactly 13 entries with the two declared shapes` — and `has no context key on the seven entries without 1M declarations` (assert with `Object.prototype.hasOwnProperty.call(entry, "context") === false`, not `toBeUndefined`).
- `contains none of the discarded dated identifiers` — none of the three strings appears anywhere in `JSON.stringify(profile)`.
- `contains none of the ten unmodelled keys` — none of `display_name`, `knowledge_cutoff`, `provider_ids`, `eager_input_streaming`, `vertex_region_env_var`, `fallback_3p`, `pricing`, `effort_cost_index`, `image_limits`, `advisor_rank` appears in the serialised profile.
- `is deeply frozen` — `Object.isFrozen` on profile, catalogue and each entry.
- `claude-mythos-5 keeps an empty capability array` — explicit edge case.
- `claude-opus-5-5 has default effort medium and 128000/128000 limits` — explicit edge case (only entry whose default equals its upper bound).

#### Acceptance criteria

- `GATE-WAVE` green; frozen digests unchanged; coverage ≥ thresholds.
- Profile compiles against `ClaudeCodeProtocolProfile` without any suppression; any `contracts.ts` widening is limited to the `defaultEffort` union and is explained in the commit body.

#### Definition of Done

- Commit C4 present; QA review returned zero open findings; Task 1.2.1.5's answer recorded.

#### Senior QA review (`@heavy`, adversarial)

**Gates run in this phase:** `GATE-COMMIT` per commit; `GATE-WAVE` at wave end.

**Review brief:** With the profile file, its test and the analysis document's catalogue excerpt in the dispatch, attack: (1) every numeric limit and effort cell against the quote — specifically `claude-opus-5-5` 128000/128000 medium and `claude-sonnet-4-6` 32000/128000; (2) capability-array order and spelling, in particular the `_prompt_bundle` and `fable_5_mitigations` strings and the presence of `rejects_disabled_thinking` on exactly `claude-opus-5-5`, `claude-fable-5`, `claude-fable-5-1`, `claude-mythos-5-1`; (3) whether any of the seven no-context entries has a `context` key holding `undefined`; (4) whether a dated identifier or unmodelled key leaked; (5) whether the `cacheDiagnosisEnabled` comment is honest about the 2.1.233 open question; (6) whether the test transcribes independently or imports the profile to build its own expectations.

---

## Wave 2 — Registration

### Phase 2.1 — Six seams, governance literals and source-trace row

**File ownership**

| File                                                                                                | Owning task                                   |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `D:\git\claude-code-wire-compat\src\index.ts`                                                       | Task 2.1.2                                    |
| `D:\git\claude-code-wire-compat\package.json` (exports block only)                                  | Task 2.1.2                                    |
| `D:\git\claude-code-wire-compat\src\betas.ts` (`PROFILE_BETA_REGISTRIES` only)                      | Task 2.1.2                                    |
| `D:\git\claude-code-wire-compat\src\build-request.ts` (`ACCEPTED_PROFILES` only)                    | Task 2.1.2                                    |
| `D:\git\claude-code-wire-compat\src\headers.ts` (`parseProfile`)                                    | Task 2.1.2                                    |
| `D:\git\claude-code-wire-compat\src\redaction.ts` (`PINNED_PROFILE_IDS`)                            | Task 2.1.2                                    |
| `D:\git\claude-code-wire-compat\test\governance\package-policy.test.ts` (exports literal)           | Task 2.1.3                                    |
| `D:\git\claude-code-wire-compat\test\runtime\runtime-neutral.test.ts`                               | Task 2.1.3                                    |
| `D:\git\claude-code-wire-compat\test\governance\provider-scope.test.ts`                             | Task 2.1.3                                    |
| `D:\git\claude-code-wire-compat\test\pack\pack-policy.test.ts` (only if it pins a packed-file list) | Task 2.1.3                                    |
| `D:\git\claude-code-wire-compat\docs\source-trace.md`                                               | Task 2.1.4 (row) and Task 2.1.6 (divergences) |
| `D:\git\claude-code-wire-compat\test\validation\registration-2.1.280.test.ts`                       | Task 2.1.5                                    |

**Parallel-safety note:** Task 2.1.1 (read-only) first. Tasks 2.1.2, 2.1.3, 2.1.4 and 2.1.5 own disjoint files and may run concurrently; all four must finish before the single registration commit. Task 2.1.6 runs after the registration commit (same file as 2.1.4, serialised). No Wave 3 task may start until this phase's QA is closed.

#### Pre-flight check

1. Correct repository/branch; `git status --porcelain` empty.
2. Expected baseline: `GATE-WAVE` green at HEAD (end of Wave 1 record); HEAD is at or after C4 and the worktree is clean.
3. Seam inventory (fast tier): quote the current text of `D:\git\claude-code-wire-compat\src\build-request.ts:339-342` (`ACCEPTED_PROFILES`) and `:354-355` (`DEFAULT_PROFILE`), `D:\git\claude-code-wire-compat\src\betas.ts:72-76` (`PROFILE_BETA_REGISTRIES`) and `:88-92` (`resolveBetaRegistry`) (pre-port line reference; locate by symbol), the `parseProfile` body in `D:\git\claude-code-wire-compat\src\headers.ts`, the `PINNED_PROFILE_IDS` literal in `D:\git\claude-code-wire-compat\src\redaction.ts`, the 2.1.233 lines of `D:\git\claude-code-wire-compat\src\index.ts`, and the `./profiles/claude-code-2.1.233` block of `D:\git\claude-code-wire-compat\package.json`.
4. Governance inventory (fast tier): quote the exports literal in `D:\git\claude-code-wire-compat\test\governance\package-policy.test.ts`, the sorted export list in `D:\git\claude-code-wire-compat\test\runtime\runtime-neutral.test.ts`, `REFERENCE_IDENTIFIERS` in `D:\git\claude-code-wire-compat\test\governance\provider-scope.test.ts`, any packed-file allowlist in `D:\git\claude-code-wire-compat\test\pack\pack-policy.test.ts` or consumed by `npm run pack:check`, and the 2.1.233 row of `D:\git\claude-code-wire-compat\docs\source-trace.md`.
5. **RESOLVE FROM REPO — what drives `D:\git\claude-code-wire-compat\test\governance\profile-coverage.test.ts`:** quote the expression it iterates (the profile matrix, the golden manifest, or `ACCEPTED_PROFILES`). The runbook order (fixtures before matrix) implies it is matrix- or manifest-driven; if instead it iterates `ACCEPTED_PROFILES`, apply the contingency in Task 2.1.7.
6. **RESOLVE FROM REPO — `D:\git\claude-code-wire-compat\test\governance\source-trace-profiles.test.ts`:** quote what it requires per profile (row columns, link to the analysis document).
7. Grep `D:\git\claude-code-wire-compat\test\` for any test that cross-checks `PROFILE_BETA_REGISTRIES` keys against `ACCEPTED_PROFILES`; record it (both are updated in the same commit, so it stays green).

#### Task 2.1.1 (SEAM-INVENTORY) [tier:fast]: Produce the exact edit list

**Files:** read-only.

**Why this matters:** Registration touches ten files; the edit list is the contract between the parallel tasks.

- [ ] **Step 2.1.1.1:** From pre-flight items 3–7, produce a per-file "insert after line / mirror this 2.1.233 fragment" list with the exact 2.1.233 fragment quoted.
- [ ] **Step 2.1.1.2:** List the export names that must be added to the runtime-neutral sorted list: the profile constant, the registry constant, `THIRD_PARTY_ALLOWED_BETAS_2_1_280`, `BEDROCK_UNSUPPORTED_BETAS_2_1_280`, `COUNT_TOKENS_BETAS_2_1_280` — include the registry constant only if the 2.1.233 registry constant is exported from `D:\git\claude-code-wire-compat\src\index.ts` (mirror).

#### Task 2.1.2 (SEAM-SRC) [tier:medium]: Edit the six source seams

**Files:**

- Modify: `D:\git\claude-code-wire-compat\src\index.ts`, `D:\git\claude-code-wire-compat\package.json`, `D:\git\claude-code-wire-compat\src\betas.ts`, `D:\git\claude-code-wire-compat\src\build-request.ts`, `D:\git\claude-code-wire-compat\src\headers.ts`, `D:\git\claude-code-wire-compat\src\redaction.ts`.

**Why this matters:** Acceptance is identity, not shape: forgetting one seam yields a profile that is exported but rejected, or accepted but unparseable from headers, or accepted but rejected as evidence.

- [ ] **Step 2.1.2.1:** `D:\git\claude-code-wire-compat\src\index.ts` — export the profile constant, the registry constant (mirror rule) and the three auxiliary sets, in the same position/style as the 2.1.233 lines.
- [ ] **Step 2.1.2.2:** `D:\git\claude-code-wire-compat\package.json` — add the `./profiles/claude-code-2.1.280` block mirroring the 2.1.233 block key for key (types/import/default conditions as they exist), pointing at `./dist/profiles/claude-code-2.1.280.d.ts` and `./dist/profiles/claude-code-2.1.280.js` (adjust only if the 2.1.233 block uses a different dist layout — mirror it exactly). Do not touch `version`.
- [ ] **Step 2.1.2.3:** `D:\git\claude-code-wire-compat\src\betas.ts:72-76` (pre-port line reference; locate by symbol) — add the 2.1.280 registry keyed by `CLAUDE_CODE_2_1_280_PROFILE.id` (mirror the 2.1.233 entry's keying expression). No other change to this file in this phase.
- [ ] **Step 2.1.2.4:** `D:\git\claude-code-wire-compat\src\build-request.ts:339-342` (pre-port line reference; locate by symbol) — add `CLAUDE_CODE_2_1_280_PROFILE` to `ACCEPTED_PROFILES`. **Leave `DEFAULT_PROFILE` (`:354-355`, pre-port line reference; locate by symbol) untouched.**
- [ ] **Step 2.1.2.5:** `D:\git\claude-code-wire-compat\src\headers.ts` — extend `parseProfile` to map `claude-code-2.1.280-sdk-0.112.1` to the singleton, mirroring the 2.1.233 branch. This is an id→singleton lookup, not a behaviour branch; confirm `D:\git\claude-code-wire-compat\test\governance\version-dispatch.test.ts` stays green.
- [ ] **Step 2.1.2.6:** `D:\git\claude-code-wire-compat\src\redaction.ts` — add the id string to `PINNED_PROFILE_IDS`.
- [ ] **Step 2.1.2.7:** `npx prettier --write` on the six files; `npm run lint`; `npm run typecheck`; `npm run build`; confirm `dist/profiles/claude-code-2.1.280.js` and `.d.ts` exist.

#### Task 2.1.3 (SEAM-GOV) [tier:medium]: Update the governance literals

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\governance\package-policy.test.ts` (exports literal only), `D:\git\claude-code-wire-compat\test\runtime\runtime-neutral.test.ts`, `D:\git\claude-code-wire-compat\test\governance\provider-scope.test.ts`, and `D:\git\claude-code-wire-compat\test\pack\pack-policy.test.ts` only if it pins a packed-file list.

**Why this matters:** These tests pin closed literals by design; they are the alarm, and the alarm is silenced by an explicit, reviewed update, never by loosening the assertion.

- [ ] **Step 2.1.3.1:** package-policy: add the new subpath block to the pinned `exports` literal, byte-identical to `D:\git\claude-code-wire-compat\package.json`.
- [ ] **Step 2.1.3.2:** runtime-neutral: insert the new names into the closed sorted list at their sorted positions.
- [ ] **Step 2.1.3.3:** provider-scope: add the three `*_BETAS_2_1_280` names to `REFERENCE_IDENTIFIERS`.
- [ ] **Step 2.1.3.4:** pack-policy / `pack:check` allowlist: add `dist/profiles/claude-code-2.1.280.js`, `.d.ts` (and any `.js.map`/`.d.ts.map` the 2.1.233 entries carry) if such a list exists.
- [ ] **Step 2.1.3.5:** `npx prettier --write` the touched tests.

#### Task 2.1.4 (SEAM-TRACE-ROW) [tier:medium]: Add the profile row to `D:\git\claude-code-wire-compat\docs\source-trace.md`

**Files:**

- Modify: `D:\git\claude-code-wire-compat\docs\source-trace.md`

**Why this matters:** `D:\git\claude-code-wire-compat\test\governance\source-trace-profiles.test.ts` fails without the row; it lands in the registration commit as a companion amendment. Settled by Wave 0 pre-flight fact (ii). If `source-trace-profiles.test.ts` enumerates registered profiles, the profile row is a companion guard amendment and must land in C5 with the registration, not in C6; C6 then carries only the narrative divergence entries. If the list is hand-maintained, the C5/C6 split as written stands.

- [ ] **Step 2.1.4.1:** Add the 2.1.280 row mirroring the 2.1.233 row's columns; reference the analysis document as a backtick path (`docs/protocol/versions/claude-code-2.1.280-analysis.md`) or, if the 2.1.233 row uses a relative Markdown link, use the identical relative form so `D:\git\claude-code-wire-compat\test\docs\links.test.ts` resolves it.
- [ ] **Step 2.1.4.2:** `npx prettier --write "D:\git\claude-code-wire-compat\docs\source-trace.md"`.

#### Task 2.1.5 (SEAM-TEST) [tier:medium]: Author the registration test

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\validation\registration-2.1.280.test.ts`

**Why this matters:** Proves identity acceptance across all seams. It asserts only the permanent property "the default is one of the accepted profiles". The governance default pin is created at C12 in Phase 4.2, not here: pinning the old default in Wave 2 is an intermediate assertion that directive 5 forbids. This test asserts profile scalars, export presence, identity membership in `ACCEPTED_PROFILES`, `parseProfile` acceptance and `PINNED_PROFILE_IDS` membership ONLY. It must never assert an `anthropic-beta` value or any part of the thinking object: those bytes are not final until the end of Wave 3, and asserting them here would be an intermediate assertion that directive 5 forbids.

- [ ] **Step 2.1.5.1:** Author the tests under **New tests**.
- [ ] **Step 2.1.5.2:** Do not assert the 2.1.280 beta list here (intermediate state; directive 5).

#### Task 2.1.6 (SEAM-TRACE-DIVERGENCES) [tier:medium]: Record the divergences not ported

**Files:**

- Modify: `D:\git\claude-code-wire-compat\docs\source-trace.md`

**Why this matters:** The upstream behaviours deliberately not modelled must be discoverable by the next porter, or they get "discovered" as bugs.

- [ ] **Step 2.1.6.1:** After the registration commit, add a "2.1.280 — recorded, not ported" subsection listing, each with one sentence of reason and the analysis-document search anchor: the served-capability / remote client-data path; the permissive uncatalogued-model fallback in the upstream mid-conversation-system predicate; the haiku agentic-query re-push of `claude-code-20250219`; the `L7t` secondary 1M-context push (needs a remote string absent by default, never fires); `inline_tools` content blocks; per-turn `outputConfig` on `api_system` messages; `lean_prompt`; `clear_at` body construction; `context_hint` body field (profile `contextHintEnabled` is `false`).
- [ ] **Step 2.1.6.2:** `npx prettier --write`; `npx vitest run test/docs test/governance`; `git add "D:\git\claude-code-wire-compat\docs\source-trace.md"`; `git commit -s -m "docs(source-trace): record claude-code-2.1.280 divergences not ported"`.

#### Task 2.1.7 (SEAM-COMMIT) [tier:medium]: Commit registration as one green commit

**Files:** all files staged by Tasks 2.1.2–2.1.5.

- [ ] **Step 2.1.7.1:** `GATE-COMMIT`. If `profile-coverage.test.ts` is red because it iterates `ACCEPTED_PROFILES` (pre-flight item 5 contingency): do not weaken the test. Instead build this commit as two temporary local commits — (i) seams + governance, (ii) the single default-path golden fixture of Phase 5.1 (Tasks 5.1.2–5.1.4 executed early for that one fixture, sealed between the two temporary commits because the seal refuses modified tracked files outside its targets) — then squash the two unpushed local commits into one with `git reset --soft HEAD~2` followed by a fresh `git commit -s`; the commit body states why. This is the only permitted local-history rewrite in the plan, it never touches pushed history, and it exists solely to honour "the tree is never red".
- [ ] **Step 2.1.7.2:** `git add` every touched absolute path explicitly; `git commit -s -m "feat(profiles): register claude-code-2.1.280 across export and acceptance seams"`; body lists the six seams and the governance literals updated.
- [ ] **Step 2.1.7.3:** `npm run test:pack` — both frozen digests unchanged (the script has no 2.1.280 case yet; that is Phase 4.1).
- [ ] **Step 2.1.7.4:** Run Task 2.1.6, then `GATE-WAVE` (end of Wave 2).

#### New tests

This file must import `../../src/index.js` at least once, or `D:\git\claude-code-wire-compat\test\governance\public-path-coverage.test.ts` fails; deep imports are otherwise fine.

`describe("claude-code-2.1.280 registration")` in `D:\git\claude-code-wire-compat\test\validation\registration-2.1.280.test.ts` (imports `../../src/index.js`):

- `is exported from the package root by identity` — the root export `CLAUDE_CODE_2_1_280_PROFILE` is the same object as the deep import from `../../src/profiles/claude-code-2.1.280.js` (`toBe`).
- `is accepted by buildRequest by identity` — a minimal pinned request builds without throwing; a structurally identical deep copy (`structuredClone`) is rejected (assert with `toThrow`).
- `parseProfile resolves the id to the singleton` — `toBe` identity.
- `redaction accepts the id as pinned evidence` — the redaction path that consults `PINNED_PROFILE_IDS` accepts `claude-code-2.1.280-sdk-0.112.1` and rejects `claude-code-2.1.280-sdk-0.112.2` (edge: near-miss id).
- `resolves the 2.1.280 registry, not the 2.1.195 fallback` — `resolveBetaRegistry` (deep import) for the id returns the 2.1.280 registry constant by identity, and for an unknown id returns the 2.1.195 `BETA_REGISTRY` (documents the fallback).
- `the default profile is an accepted profile` — permanent property.
- The governance default pin is created at C12 in Phase 4.2, not here: pinning the old default in Wave 2 is an intermediate assertion that directive 5 forbids.
- `subpath export resolves` — `import("@tormentalabs/claude-code-wire-compat/profiles/claude-code-2.1.280")` is exercised by `npm run pack:check`/`test:pack` rather than here if the existing 2.1.233 tests do it that way (mirror).

This test asserts profile scalars, export presence, identity membership in `ACCEPTED_PROFILES`, `parseProfile` acceptance and `PINNED_PROFILE_IDS` membership ONLY. It must never assert an `anthropic-beta` value or any part of the thinking object: those bytes are not final until the end of Wave 3, and asserting them here would be an intermediate assertion that directive 5 forbids.

#### Acceptance criteria

- `GATE-WAVE` green; both frozen digests unchanged; coverage ≥ thresholds.
- All six seams, the four governance literals and the source-trace row are in commit C5; divergences in C6.
- `D:\git\claude-code-wire-compat\test\governance\version-dispatch.test.ts` green (no new version branch in `src/`).

#### Definition of Done

- Commits C5 and C6 present; QA review returned zero open findings; worktree clean.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `GATE-COMMIT` per commit; `GATE-WAVE` at wave end; `npm run test:pack` explicitly.

**Review brief:** With `git diff <C4>..<C6>` in the dispatch, attack: (1) any seam missed — enumerate the six and check each hunk; (2) whether `parseProfile` or `ACCEPTED_PROFILES` compares by string where the convention is identity; (3) whether the exports literal in package-policy and `D:\git\claude-code-wire-compat\package.json` are byte-identical (key order included); (4) whether the runtime-neutral list is still sorted; (5) whether the contingency in Task 2.1.7.1 was used and, if so, whether the squashed commit is green and the body explains it; (6) whether any test in this phase asserts the intermediate 9-beta state (forbidden); (7) whether the source-trace divergence list is complete against the nine items in the plan and honest about `context_hint`.

---

## Wave 3 — Mechanisms

### Phase 3.1 — Capability derivation 6→8 strings

**File ownership**

| File                                                                                                                                  | Owning task |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\src\contracts.ts` (`ClaudeCodeCapabilities` at `:662-672`; pre-port line reference; locate by symbol) | Task 3.1.2  |
| `D:\git\claude-code-wire-compat\src\model-capabilities.ts` (`:346-353`, `:365-385`; pre-port line reference; locate by symbol)        | Task 3.1.2  |
| Every other file that constructs a `ClaudeCodeCapabilities` literal (from Task 3.1.1's list)                                          | Task 3.1.2  |
| `D:\git\claude-code-wire-compat\test\validation\capabilities-2.1.280.test.ts`                                                         | Task 3.1.3  |

**Parallel-safety note:** Strictly serial: 3.1.1 → 3.1.2 → 3.1.3. Phase 3.2 must not start until this phase's QA is closed (it depends on the two new booleans).

#### Pre-flight check

1. Correct repository/branch; `git status --porcelain` empty.
2. Expected baseline: `GATE-WAVE` green at HEAD (end of Wave 2); HEAD is at or after C6 and the worktree is clean.
3. Quote `D:\git\claude-code-wire-compat\src\model-capabilities.ts:346-353` (`CATALOGUE_BACKED_CAPABILITIES`, six mappings) and `:365-385` (`deriveCapabilitiesFromCatalogue`) (pre-port line reference; locate by symbol).
4. Quote `D:\git\claude-code-wire-compat\src\contracts.ts:662-672` (nine readonly booleans) (pre-port line reference; locate by symbol).
5. Verified precondition re-checked locally: grep both older catalogues (`D:\git\claude-code-wire-compat\src\profiles\claude-code-2.1.195.ts`, `D:\git\claude-code-wire-compat\src\profiles\claude-code-2.1.233.ts`) for `mid_conv_tool_change` and `per_turn_effort` — zero hits each.
6. `npm run test:pack` digests recorded before the change (both frozen values).

#### Task 3.1.1 (CAP-CONSTRUCTORS) [tier:fast]: Enumerate every `ClaudeCodeCapabilities` constructor

**Files:** read-only.

**Why this matters:** Two new required booleans break every object literal of that type; the list must be complete before editing so the commit compiles in one pass.

- [ ] **Step 3.1.1.1:** Grep `D:\git\claude-code-wire-compat\src\` and `D:\git\claude-code-wire-compat\test\` for `rejectsDisabledThinking` (the rarest of the nine keys) and list every file/line that builds the type — including `D:\git\claude-code-wire-compat\test\conformance\reference-adapter.ts` and `D:\git\claude-code-wire-compat\test\support\profile-matrix.ts` if they do.
- [ ] **Step 3.1.1.2:** Report the list with the surrounding literal quoted.

#### Task 3.1.2 (CAP-IMPL) [tier:medium]: Extend the contract and the derivation

**Files:**

- Modify: `D:\git\claude-code-wire-compat\src\contracts.ts`, `D:\git\claude-code-wire-compat\src\model-capabilities.ts`, plus every constructor site from Task 3.1.1.

**Why this matters:** Two of the five new push sites key off these booleans; deriving them from the catalogue (not from the version) keeps `D:\git\claude-code-wire-compat\src\profile-behaviors.ts` untouched.

- [ ] **Step 3.1.2.1:** `ClaudeCodeCapabilities` gains `readonly midConvToolChange: boolean` and `readonly perTurnEffort: boolean` (required, like the existing nine; document both with a one-line JSDoc naming the catalogue string).
- [ ] **Step 3.1.2.2:** `CATALOGUE_BACKED_CAPABILITIES` gains `midConvToolChange: "mid_conv_tool_change"` and `perTurnEffort: "per_turn_effort"` (eight mappings). Do **not** map `per_turn_timing` (its beta `timing-2026-09-09` is environment-gated off on the default path — record this in a comment).
- [ ] **Step 3.1.2.3:** `deriveCapabilitiesFromCatalogue` derives the two new booleans exactly as it derives the other six.
- [ ] **Step 3.1.2.4:** Update every constructor from Task 3.1.1 with explicit `false` values where the model has no such capability (never omit; never `undefined`).
- [ ] **Step 3.1.2.5:** `npx prettier --write` touched files; `npm run lint`; `npm run typecheck`; `npm run build`.

#### Task 3.1.3 (CAP-TEST) [tier:medium]: Author the capability derivation test

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\validation\capabilities-2.1.280.test.ts`

- [ ] **Step 3.1.3.1:** Author the tests under **New tests**.
- [ ] **Step 3.1.3.2:** `GATE-COMMIT`; `npm run test:pack` — both frozen digests unchanged.
- [ ] **Step 3.1.3.3:** `git add` all touched absolute paths; `git commit -s -m "feat(capabilities): derive mid_conv_tool_change and per_turn_effort from the catalogue"`.

#### New tests

`D:\git\claude-code-wire-compat\test\validation\capabilities-2.1.280.test.ts` must import `../../src/index.js` at least once, or `D:\git\claude-code-wire-compat\test\governance\public-path-coverage.test.ts` fails; deep imports are otherwise fine.

`describe("2.1.280 catalogue-backed capabilities")`:

- `pins the exact CATALOGUE_BACKED_CAPABILITIES map literal` — `toEqual` against a hand-written object literal naming every camelCase key and its exact snake_case catalogue string; not a count, not a key-set comparison, so a swapped or misspelled value fails.
- `derives perTurnEffort true for claude-opus-5-5 and claude-fable-5-1 only` — `it.each` over all 20 entries.
- `derives midConvToolChange true for claude-opus-4-8, claude-opus-5, claude-opus-5-5, claude-fable-5, claude-fable-5-1, claude-mythos-5-1 only`.
- `derives both false for every 2.1.195 and 2.1.233 catalogue entry` — loops over both older catalogues (digest-safety proof at the unit level).
- `does not derive anything from per_turn_timing` — `claude-mythos-5-1` has `per_turn_timing` yet `perTurnEffort === false`; no key of the derived object mentions timing.
- `keeps the existing six derivations unchanged` — `rejectsDisabledThinking` true for exactly `claude-opus-5-5`, `claude-fable-5`, `claude-fable-5-1`, `claude-mythos-5-1`; `xhighEffort` false for `claude-sonnet-4-6` and `claude-opus-4-6`.
- Edge: `claude-mythos-5 (empty capabilities) derives all eight false`.
- Type-level: `expectTypeOf<ClaudeCodeCapabilities>().toHaveProperty("perTurnEffort").toEqualTypeOf<boolean>()` and the same for `midConvToolChange`; plus an assertion that an object literal carrying only the nine pre-existing keys is no longer assignable to `ClaudeCodeCapabilities`, which proves the two additions are required and not optional.

Type-level assertions bite only if Wave 0 pre-flight fact (iii) shows that tsc compiles `test/**` or that vitest typecheck mode is on. If neither holds, DROP them rather than keep ceremony.

#### Acceptance criteria

- `GATE-COMMIT` green; frozen digests unchanged. Coverage is asserted at `GATE-WAVE`, not here; no step in this phase runs `npm run test:coverage`.

#### Definition of Done

- Commit C7 present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `GATE-COMMIT`; `npm run test:pack`.

**Review brief:** Attack: (1) any constructor site missed (search the diff for every file from Task 3.1.1); (2) whether making the booleans required breaks the sibling consumer seam `D:\git\opencode-anthropic-fix\lib\mimicry\wire-compat.mjs` if it constructs capabilities (report as a CHANGELOG **Breaking** item for Phase 6.2, not as a blocker; the `ThinkingDisplay` widening is likewise a public type change and must be listed there); (3) whether `per_turn_timing` was mapped by mistake; (4) whether either older catalogue could now derive `true` for a new boolean.

---

### Phase 3.2 — Four registry-driven push sites and the `ComposeBetasInput` extension

**File ownership**

| File                                                                                                  | Owning task |
| ----------------------------------------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\src\betas.ts`                                                         | Task 3.2.2  |
| `D:\git\claude-code-wire-compat\src\request-body.ts` (only the `ComposeBetasInput` construction site) | Task 3.2.2  |
| `D:\git\claude-code-wire-compat\test\validation\betas-2.1.280-push-sites.test.ts`                     | Task 3.2.3  |

**Parallel-safety note:** Strictly serial: 3.2.1 → 3.2.2 → 3.2.3. Phase 3.3 follows immediately and edits the same files; the single QA for both phases runs at the end of Phase 3.3.

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C7 and the worktree is clean.
2. `GATE-COMMIT` green at HEAD; frozen digests recorded.
3. Quote `D:\git\claude-code-wire-compat\src\betas.ts:53-70` (`ComposableBetaRegistry`, 17 keys, `NARRATION_SUMMARIES?` optional precedent), `:94-121` (`ComposeBetasInput`), `:129-132` (`ComposedBetas`), and the full `composeBetasWithAudit` body including the 17 push sites, the `additionalBetas` merge (`:273-277`) and the final `suppressBetas` filter (pre-port line reference; locate by symbol).
4. **RESOLVE FROM REPO:** how `composeBetasWithAudit` reaches the experimental-betas predicate (`experimentalBetasEnabled` on the profile's `betaPolicy`) and the resolved registry (via `resolveBetaRegistry(profile.id)` or a passed registry); quote the audit entry type so removals can be recorded in Phase 3.3.
5. Quote from the analysis document the guard for each of `per-turn-control-2026-07-01`, `mid-conversation-tool-changes-2026-07-01`, `mid-conversation-system-clear-at-2026-08-21`, `thinking-binding-controls-2026-08-01`, and whether "thinking active" (binding controls) and "thinking emitted as adaptive-or-enabled" (display updates, Phase 3.3) are the same upstream expression.
6. Locate the existing 2.1.233 default-path beta assertion test (grep `D:\git\claude-code-wire-compat\test\` for `mid-conversation-system-2026-04-07`) and record how it constructs the builder input for "OAuth, no API key, interactive REPL main thread, thinking adaptive, cache TTL 5m, first request" — this is the template for every scenario in Waves 3 and 5.

#### Task 3.2.1 (PUSH-DESIGN) [tier:heavy]: Fix the whole mechanism-seam design — input fields, the four new push-site guards, the thinking-display-updates trio and the `redact-thinking` removal

**Files:** read-only; output is a short design note carried into Task 3.2.2, Task 3.3.2 and MEMORY.md (Phase 6.1).

**Why this matters:** `ComposeBetasInput` today carries only `thinkingDisplayActive`; the new guards need a thinking-emission signal. Choosing one field now, shared by Phase 3.3, avoids two representations of the same fact. Landing the beta, the body field or the removal separately writes bytes no genuine client sends. One predicate computed once must feed all three. This one design fixes the whole mechanism seam: the `ComposeBetasInput` thinking signal field, the call order and its key-insertion-order invariant, the `ComposedBetas` override field, the `injectThinkingDisplayUpdates` predicate including its provider condition, the clear-at registry key spelling, the inert-audit shape, and the `suppressBetas` semantics. Deciding any of these twice is how the two halves drift apart.

- [ ] **Step 3.2.1.1:** Decide the field: proposed `emittedThinkingType?: "adaptive" | "enabled" | "disabled"` (absent = no thinking object emitted), with derived `thinkingActive = emittedThinkingType === "adaptive" || emittedThinkingType === "enabled"`. If pre-flight item 5 shows the two upstream predicates differ, model both signals with names mirroring the upstream distinction and say why. `display: "updates"` is injected on the FIRST-PARTY path only. State the provider condition explicitly in the design note, unless the Phase 3.2 pre-flight establishes that the experimental-betas predicate already implies first-party — in which case say so, with the evidence, in the design note.
- [ ] **Step 3.2.1.2:** Decide where the value is computed: the thinking-type resolution already performed for the body (in or near `D:\git\claude-code-wire-compat\src\thinking.ts:306-332` — pre-port line reference; locate by symbol) is the single source; `D:\git\claude-code-wire-compat\src\request-body.ts` passes it into `ComposeBetasInput` with a conditional spread. Confirm both functions are pure so call order can be arranged as: resolve thinking type → compose betas → emit thinking block (Phase 3.3 needs this order).
- [ ] **Step 3.2.1.3:** Purity guarantees value equality, NOT JSON key-insertion order. The resolved thinking type may be computed earlier in the call sequence, but the request-body object literal must continue to be assembled in its existing key order. Moving where the `thinking` key is inserted changes the serialised bytes for EVERY profile and moves both frozen digests.
- [ ] **Step 3.2.1.4:** Record the decision note (three to six sentences) in the task output.
- [ ] **Step 3.2.1.5:** Predicate `injectThinkingDisplayUpdates` (proposed name) = resolved registry has `THINKING_DISPLAY_UPDATES` `&&` emitted thinking type is adaptive or enabled `&&` experimental `&&` `!thinkingDisplayActive` (caller supplied no display).
- [ ] **Step 3.2.1.6:** Ownership: `composeBetasWithAudit` evaluates the predicate at site `12b` (after `THINKING_BINDING_CONTROLS`, before `SPEED`) and reports it on `ComposedBetas` via a new optional field (proposed `thinkingDisplayOverride?: "updates"`, set only when the site fired; conditional spread). The thinking emitter receives that value and emits `display: "updates"`; it never recomputes the predicate. Call order in `D:\git\claude-code-wire-compat\src\request-body.ts`: resolve thinking type → compose betas → emit thinking block (reorder if needed; both are pure — confirmed in Task 3.2.1.2).
- [ ] **Step 3.2.1.7:** Removal: when site `12b` fires, `redact-thinking-2026-02-12` is removed from the composed core list at the position the analysis document places the splice (Phase 3.3 pre-flight item 5) — in all cases after the push sequence and before the `additionalBetas` merge, so caller-supplied `additionalBetas` are honoured verbatim and `suppressBetas` stays last. The audit records the removal with a reason string.
- [ ] **Step 3.2.1.8:** Caller boundary: `ThinkingDisplay` becomes `"summarized" | "omitted" | "updates"`; the caller-facing input is typed `Exclude<ThinkingDisplay, "updates">` (proposed alias `CallerThinkingDisplay`, exported only if the input type is public); if Phase 3.3 pre-flight item 4 found runtime validation, a caller-supplied `"updates"` is rejected there with a clear error; if none exists, the type is the guard and MEMORY.md says so.
- [ ] **Step 3.2.1.9:** `suppressBetas` semantics for `thinking-display-updates-2026-08-18` mirror Phase 3.3 pre-flight item 6 exactly; record the chosen behaviour.
- [ ] **Step 3.2.1.10:** Bytes-equivalent alternative to consider and record: leave the public `ThinkingDisplay` as the caller-facing type and introduce a SEPARATE emitted-only union that includes `"updates"`. That removes the `Exclude<>` alias, the runtime-rejection branch and the MEMORY note, at the cost of two display types. Choose one, and record in the design note why.

#### Task 3.2.2 (PUSH-IMPL) [tier:medium]: Add the four optional keys, four push sites and the input field

**Files:**

- Modify: `D:\git\claude-code-wire-compat\src\betas.ts`, `D:\git\claude-code-wire-compat\src\request-body.ts`.

**Why this matters:** Position is byte-order; a site one slot off produces a header no genuine client sends. Optional keys keep the 2.1.195 (28-key) and 2.1.233 registries compiling.

- [ ] **Step 3.2.2.1:** `ComposableBetaRegistry` gains four optional keys — `PER_MESSAGE_EFFORT?`, `MID_CONV_TOOL_CHANGE?`, the clear-at key spelled exactly as the registry file spells it (Task 1.1.1.6), and `THINKING_BINDING_CONTROLS?` — each `KEY?: BetaRegistryEntry` following the `NARRATION_SUMMARIES?` precedent. (The fifth key, `THINKING_DISPLAY_UPDATES?`, is Phase 3.3.)
- [ ] **Step 3.2.2.2:** `ComposeBetasInput` gains the field(s) from Task 3.2.1 as optional properties; the construction site in `D:\git\claude-code-wire-compat\src\request-body.ts` supplies them via conditional spread.
- [ ] **Step 3.2.2.3:** Insert push sites, each inert when the resolved registry lacks the key (same pattern as `NARRATION_SUMMARIES`):
  - after site 11 `MID_CONVERSATION_SYSTEM` and before site 12 `EFFORT`: `PER_MESSAGE_EFFORT` — guard: experimental `&&` `capabilities.perTurnEffort`;
  - immediately after it: `MID_CONV_TOOL_CHANGE` — guard: `MID_CONVERSATION_SYSTEM` fired in this composition `&&` `capabilities.midConvToolChange`;
  - immediately after it: the clear-at site — guard: `MID_CONVERSATION_SYSTEM` fired `&&` experimental;
  - after site 12 `EFFORT` and before site 13 `SPEED`: `THINKING_BINDING_CONTROLS` — guard: thinking active `&&` experimental.
  - "Fired in this composition" means the site pushed in this call (track with a local boolean set at site 11), not "the registry has the key".
- [ ] **Step 3.2.2.4:** Renumber/annotate the site comments so the sequence reads 1–17 plus the inserted sites labelled by position (e.g. `11a`, `11b`, `11c`, `12a`); Phase 3.3 adds `12b`.
- [ ] **Step 3.2.2.5:** Audit entries follow the existing audit shape, and a site whose key is absent from the resolved registry must place in the audit EXACTLY what the `NARRATION_SUMMARIES` site places when its key is absent (Wave 0 pre-flight fact (iv)). If the audit is inside any hashed artefact, five new skipped entries would appear in every 2.1.233 and 2.1.195 composition and move both frozen digests.
- [ ] **Step 3.2.2.6:** `npx prettier --write`; `npm run lint`; `npm run typecheck`; `npm run build`.

#### Task 3.2.3 (PUSH-TEST) [tier:medium]: Author the push-site tests

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\validation\betas-2.1.280-push-sites.test.ts`

**Why this matters:** Asserts relative-order and guard properties that remain true after Phase 3.3 — no intermediate full-list literal (directive 5).

- [ ] **Step 3.2.3.1:** Author the tests under **New tests**; scenarios through `buildRequest` use the template from pre-flight item 6; guard-negative scenarios that need `experimentalBetasEnabled: false` drive `composeBetasWithAudit` directly (a modified profile copy is rejected by identity at `buildRequest`).
- [ ] **Step 3.2.3.2:** `GATE-COMMIT`; `npm run test:pack` — both frozen digests unchanged.
- [ ] **Step 3.2.3.3:** `git add` the three absolute paths; `git commit -s -m "feat(betas): add per-turn, tool-change, clear-at and thinking-binding push sites"`; body quotes the four guards and the positions.

#### New tests

`D:\git\claude-code-wire-compat\test\validation\betas-2.1.280-push-sites.test.ts` must import `../../src/index.js` at least once, or `D:\git\claude-code-wire-compat\test\governance\public-path-coverage.test.ts` fails; deep imports are otherwise fine. This file drives `composeBetasWithAudit` directly and is therefore the likeliest in the port to miss the public import.

`describe("2.1.280 push sites 11a-12a")`:

- `claude-opus-5-5 default path emits per-turn-control immediately after mid-conversation-system` — index adjacency.
- `then mid-conversation-tool-changes, then clear-at, all before effort` — ordered sub-sequence assertion on the header array.
- `thinking-binding-controls follows effort immediately` — adjacency.
- `per-turn-control is absent for claude-fable-5 (no per_turn_effort) and present for claude-fable-5-1`.
- `mid-conversation-tool-changes is absent when mid-conversation-system did not fire` — unit-level: synthetic capabilities with `midConvToolChange: true` but the mid-conv predicate false; assert absence and that the audit shows site 11 did not fire.
- `clear-at is absent when experimental is false even if mid-conversation-system fired` — unit-level.
- `per-turn-control-2026-07-01 is absent when experimental is false even though the catalogue declares the capability`
- `mid-conversation-tool-changes-2026-07-01 is absent when MID_CONVERSATION_SYSTEM fired but midConvToolChange is false`
- `thinking-binding-controls-2026-08-01 is absent when experimental is false though thinking is active`
- `thinking-binding-controls is absent when thinking is disabled or absent` — `emittedThinkingType` `"disabled"` and undefined.
- `all four sites are inert for 2.1.233 and 2.1.195` — the 2.1.233 default-path list from the existing test is byte-for-byte unchanged; a 2.1.195 default-path composition contains none of the four headers.
- `haiku on 2.1.280 emits none of the four and no claude-code beta` — `claude-haiku-4-5`: none of the four headers and `claude-code-20250219` absent (existing guard); the full haiku list is asserted only if the analysis document carries it (transcribe), otherwise only these absence properties.
  One negative per guard conjunct per site. Without these, an implementation that silently drops the `experimental` conjunct passes every other test in this plan including the 14-identifier literal.

That assertion is tautological: `PROFILE_BETA_REGISTRIES` already fails `npm run typecheck` if the 2.1.195 registry is not assignable to `ComposableBetaRegistry`.

Type-level assertions bite only if Wave 0 pre-flight fact (iii) shows that tsc compiles `test/**` or that vitest typecheck mode is on. If neither holds, DROP them rather than keep ceremony.

#### Acceptance criteria

- `GATE-COMMIT` green; frozen digests unchanged; each new site has a fires and a does-not-fire test. Coverage is asserted at `GATE-WAVE`, not here; no step in this phase runs `npm run test:coverage`.

#### Definition of Done

- Commit C8 present; design note from Task 3.2.1 recorded for Phase 6.1.
- C8 is green in isolation; the adversarial QA for this phase is performed once at the end of Phase 3.3, together with Phase 3.3's own review.
- C8 and C9 are NOT merged: they remain two separate commits.

#### Senior QA review (`@heavy`, adversarial)

**Deferred.** This phase's review is performed once at the end of Phase 3.3, covering Phases 3.2 and 3.3 together, because they are one seam. The brief below is carried forward and merged with Phase 3.3's brief.

**Gates run in this phase:** `GATE-COMMIT`; `npm run test:pack`.

**Review brief:** With the diff, the analysis-document guard quotes and the test file in the dispatch, attack: (1) position — count the sites in the diff and confirm each new site's neighbours; (2) whether "fired" is tracked as a local outcome or wrongly as registry presence; (3) whether the clear-at key spelling matches the registry file exactly (a mismatch is silently inert — the most dangerous failure in this phase); (4) whether any new key is non-optional; (5) whether the input field is built with a conditional spread; (6) whether any test asserts a full intermediate list; (7) whether a 2.1.233 composition could now change (walk each guard against the 2.1.233 registry's key set); (8) whether the AUDIT — not only the emitted beta list — is unchanged for 2.1.233 and 2.1.195.

---

### Phase 3.3 — Thinking display updates trio and the 14-identifier literal

**File ownership**

| File                                                                                                               | Owning task |
| ------------------------------------------------------------------------------------------------------------------ | ----------- |
| `D:\git\claude-code-wire-compat\src\betas.ts`                                                                      | Task 3.3.2  |
| `D:\git\claude-code-wire-compat\src\thinking.ts`                                                                   | Task 3.3.2  |
| `D:\git\claude-code-wire-compat\src\request-body.ts`                                                               | Task 3.3.2  |
| `D:\git\claude-code-wire-compat\src\contracts.ts` (only if the caller-facing thinking input type must be narrowed) | Task 3.3.2  |
| `D:\git\claude-code-wire-compat\test\validation\anthropic-beta-2.1.280-default-path.test.ts`                       | Task 3.3.3  |
| `D:\git\claude-code-wire-compat\test\validation\thinking-display-updates-2.1.280.test.ts`                          | Task 3.3.4  |

**Parallel-safety note:** Strictly serial: 3.3.1 → 3.3.2 → 3.3.3 → 3.3.4. All three surfaces land in one commit, created by the orchestrator once every task reports done.

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C8 and the worktree is clean.
2. `GATE-COMMIT` green at HEAD; frozen digests recorded.
3. Quote `D:\git\claude-code-wire-compat\src\thinking.ts:51` (`ThinkingDisplay`), `:306-332` (emission block), and `D:\git\claude-code-wire-compat\src\contracts.ts:3-4` (re-export) (pre-port line reference; locate by symbol).
4. **RESOLVE FROM REPO:** the caller-facing input type for `thinking.display` — is it typed by `ThinkingDisplay` directly? Is there runtime input validation anywhere on the builder path (grep for where `"summarized"` is validated)?
5. Quote from the analysis document: the thinking object construction (key order for `{type, display}` on the adaptive path and on the enabled path), the `thinking-display-updates-2026-08-18` guard, and the `redact-thinking-2026-02-12` composed-then-spliced text with its position relative to the push sequence.
6. **RESOLVE FROM REPO:** how existing coupled beta/body pairs behave under `suppressBetas` (e.g. suppress `effort-2025-11-24` — does `output_config.effort` still emit?). Record it; Phase 3.3 mirrors that semantics for `thinking-display-updates`.

#### Task 3.3.1 (TDU-DESIGN) [tier:medium]: Single predicate, three surfaces

The design for this phase is fixed by Task 3.2.1, which covers the whole mechanism seam. This phase implements that design; it decides nothing new. If implementation reveals the design is wrong, that is stop condition (b) — raise it, amend Task 3.2.1's design note, and re-run the affected steps; do not decide locally.

#### Task 3.3.2 (TDU-IMPL) [tier:medium]: Implement the trio

**Files:**

- Modify: `D:\git\claude-code-wire-compat\src\betas.ts`, `D:\git\claude-code-wire-compat\src\thinking.ts`, `D:\git\claude-code-wire-compat\src\request-body.ts`, conditionally `D:\git\claude-code-wire-compat\src\contracts.ts`.

- [ ] **Step 3.3.2.1:** `ComposableBetaRegistry` gains `THINKING_DISPLAY_UPDATES?: BetaRegistryEntry` (22 keys total).
- [ ] **Step 3.3.2.2:** Site `12b` and the removal per the design note; `ComposedBetas` gains the optional override field.
- [ ] **Step 3.3.2.3:** `ThinkingDisplay` gains `"updates"`; the emission block emits `display: "updates"` when the override is present, with the key order transcribed from the analysis document (adaptive path: `type` then `display`; enabled path: as transcribed — if the document does not carry the enabled-path key order, this is stop condition (a): raise it, do not guess).
- [ ] **Step 3.3.2.4:** Caller-facing narrowing and (if applicable) runtime rejection.
- [ ] **Step 3.3.2.5:** Purity guarantees value equality, NOT JSON key-insertion order. The resolved thinking type may be computed earlier in the call sequence, but the request-body object literal must continue to be assembled in its existing key order. Moving where the `thinking` key is inserted changes the serialised bytes for EVERY profile and moves both frozen digests.
- [ ] **Step 3.3.2.6:** `npx prettier --write`; `npm run lint`; `npm run typecheck`; `npm run build`; `npx vitest run test/governance/version-dispatch.test.ts` — no version branch introduced.

#### Task 3.3.3 (TDU-LITERAL) [tier:medium]: The 14-identifier `anthropic-beta` literal test — named deliverable

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\validation\anthropic-beta-2.1.280-default-path.test.ts`

**Why this matters:** This is the permanent regression test for the whole port: the exact default-path header of the genuine 2.1.280 client.

- [ ] **Step 3.3.3.1:** Scenario (map onto the builder input using the template from Phase 3.2 pre-flight item 6): model `claude-opus-5-5`; first-party; OAuth with no API key; interactive REPL main thread; thinking active and adaptive; no caller-supplied `thinking.display`; cache TTL 5m; every remote flag at its shipped default; no caller flags; first request; latches empty.
- [ ] **Step 3.3.3.2:** Test `emits the 14-identifier anthropic-beta literal on the claude-opus-5-5 default path` asserts the header value equals, in order and joined exactly as the builder joins it: `claude-code-20250219`, `oauth-2025-04-20`, `interleaved-thinking-2025-05-14`, `thinking-token-count-2026-05-13`, `context-management-2025-06-27`, `prompt-caching-scope-2026-01-05`, `mid-conversation-system-2026-04-07`, `per-turn-control-2026-07-01`, `mid-conversation-tool-changes-2026-07-01`, `mid-conversation-system-clear-at-2026-08-21`, `effort-2025-11-24`, `thinking-binding-controls-2026-08-01`, `thinking-display-updates-2026-08-18`, `cache-diagnosis-2026-04-07`. Transcribe the literal from the analysis document. The separator used to join the identifiers must ALSO be transcribed from `D:\git\claude-code-wire-compat\docs\protocol\versions\claude-code-2.1.280-analysis.md`, not read off the builder. Taking the separator from the builder makes the test half-derive its own expectation.
- [ ] **Step 3.3.3.3:** Test `carries thinking {type: "adaptive", display: "updates"} in that key order` — assert on the serialised body substring.
- [ ] **Step 3.3.3.4:** Test `does not carry redact-thinking-2026-02-12 anywhere in the header` and `the audit records redact-thinking as composed then removed`.
- [ ] **Step 3.3.3.5:** Test `does not carry context-1m-2025-08-07` (native-1M model; documents why the LONG_CONTEXT site is silent here).

#### Task 3.3.4 (TDU-EDGES) [tier:medium]: Edge-case tests for the trio

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\validation\thinking-display-updates-2.1.280.test.ts`

- [ ] **Step 3.3.4.1:** Author the tests under **New tests**.
- [ ] **Step 3.3.4.2:** `GATE-COMMIT`, then `GATE-WAVE` (end of Wave 3): both frozen digests unchanged.
- [ ] **Step 3.3.4.3:** `git add` all touched absolute paths from 3.3.2–3.3.4; `git commit -s -m "feat(thinking): inject display updates beta, body field and redact-thinking removal"`; body states the three surfaces and the predicate. The orchestrator creates this commit, because the files were authored across several tasks. The orchestrator stages the explicit absolute paths; no authoring task runs `git add` for a file it does not solely own.

#### New tests

This file must import `../../src/index.js` at least once, or `D:\git\claude-code-wire-compat\test\governance\public-path-coverage.test.ts` fails; deep imports are otherwise fine.

In `D:\git\claude-code-wire-compat\test\validation\thinking-display-updates-2.1.280.test.ts`:

- `caller-supplied display "summarized" suppresses the beta and the injection` — header lacks `thinking-display-updates-2026-08-18` and (existing guard) `redact-thinking-2026-02-12`; body carries `display: "summarized"`.
- `caller-supplied display "omitted" behaves the same`.
- `thinking disabled emits neither thinking-binding-controls nor thinking-display-updates nor a display field` — model that accepts disabled thinking.
- `thinking enabled with a budget still injects "updates"` — on a model that permits a manual budget; key order per the analysis document.
- `experimental false suppresses the beta and the body field together` — unit-level via `composeBetasWithAudit` plus the emitter receiving no override.
- `2.1.233 default path is byte-identical to before` — the existing 2.1.233 list, including `redact-thinking-2026-02-12`, and no `display` key in the thinking object.
- `the 2.1.233 request body key sequence is unchanged` — assert the ordered list of top-level body keys for a 2.1.233 request, so a key-order regression fails at unit level instead of surfacing as a moved digest in `GATE-WAVE`.
- `redact-thinking-2026-02-12 is RETAINED on 2.1.280 when site 12b does not fire` — two scenarios: caller supplies `display: "summarized"`, and separately thinking is disabled. Retention is otherwise proven only on 2.1.233.
- `2.1.195 never emits "updates"`.
- `additionalBetas containing redact-thinking survives the removal` — documents the package decision.
- `suppressBetas of thinking-display-updates follows the established coupled-pair semantics` — asserts whichever behaviour pre-flight item 6 established.
- Type-level: `expectTypeOf<CallerThinkingDisplay>().not.toEqualTypeOf<ThinkingDisplay>()` and `"updates"` is not assignable to the caller-facing input type.
- Edge: `a caller passing "updates" at runtime is rejected` — only if runtime validation exists.

Type-level assertions bite only if Wave 0 pre-flight fact (iii) shows that tsc compiles `test/**` or that vitest typecheck mode is on. If neither holds, DROP them rather than keep ceremony.

#### Acceptance criteria

- The 14-identifier test passes; `GATE-WAVE` green; frozen digests unchanged; coverage ≥ thresholds (removal path and override path both exercised).
- `D:\git\claude-code-wire-compat\test\governance\version-dispatch.test.ts` green.

#### Definition of Done

- Commit C9 present; design note recorded; QA review returned zero open findings.

#### Senior QA review (`@heavy`, adversarial)

**Gates run in this phase:** `GATE-COMMIT`; `GATE-WAVE`.

**This single review covers Phases 3.2 and 3.3. Its brief is the union of Phase 3.2's brief and the points below.**

**Review brief:** Attack: (1) whether the predicate is computed in more than one place; (2) whether the removal position could ever strip a caller-supplied `additionalBetas` entry or run after `suppressBetas`; (3) whether the 14-identifier literal in the test was transcribed from the analysis document or from the builder's output (the commit body must say); (4) whether `display: "updates"` can be emitted without the beta or vice versa under any input combination — enumerate: caller display present, thinking disabled, experimental false, registry lacking the key, `suppressBetas`, a third-party provider, and a JavaScript caller passing `display: "updates"` at runtime — with no runtime validation this would yield the body field without the beta; decide the behaviour and test it; (5) whether the `thinking` object key order matches the document on both adaptive and enabled paths; (6) whether `ThinkingDisplay` widening leaks `"updates"` into any public input type; (7) re-derive by hand why `context-1m-2025-08-07` is absent for `claude-opus-5-5` and confirm the existing site's logic, not a new branch, explains it.

**Carried forward from Phase 3.2** (with the Phase 3.2 diff, the analysis-document guard quotes and `D:\git\claude-code-wire-compat\test\validation\betas-2.1.280-push-sites.test.ts` in the same dispatch), attack: (8) position — count the sites in the diff and confirm each new site's neighbours; (9) whether "fired" is tracked as a local outcome or wrongly as registry presence; (10) whether the clear-at key spelling matches the registry file exactly (a mismatch is silently inert — the most dangerous failure in this phase); (11) whether any new key is non-optional; (12) whether the input field is built with a conditional spread; (13) whether any test asserts a full intermediate list; (14) whether a 2.1.233 composition could now change (walk each guard against the 2.1.233 registry's key set); (15) whether the AUDIT — not only the emitted beta list — is unchanged for 2.1.233 and 2.1.195.

---

## Wave 4 — Canary and default switch

### Phase 4.1 — Packed-consumer canary: freeze the third digest

**File ownership**

| File                                                                 | Owning task |
| -------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\scripts\verify-packed-consumers.mjs` | Task 4.1.2  |

**Parallel-safety note:** Strictly serial: 4.1.1 → 4.1.2 → 4.1.3. Phase 5.4 runs in its own slot after Phase 5.3. Its _independent_ vector computation is performed outside the repository worktree (in `$env:TEMP`) and may be done at any time; only the computation is off-worktree — never an edit to any file, tracked or untracked, inside `D:\git\claude-code-wire-compat`.

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C9 and the worktree is clean.
2. `GATE-WAVE` green at HEAD (end of Wave 3 record).
3. Runtimes available: node, bun, workerd (as invoked by the script) — re-verify.
4. Quote the 2.1.233 digest case in `D:\git\claude-code-wire-compat\scripts\verify-packed-consumers.mjs` (scenario inputs, profile import path, expected digest literal) and record whether any case builds an **unpinned** (default) request — if one exists, its digest will move in Phase 4.2 and must be handled there.
5. `npm run pack:check` green; `npm run build` produces `dist/profiles/claude-code-2.1.280.js`.
6. Task 1.2.1.5's answer on `output_config.effort` for `claude-opus-5-5` (default effort `medium`) is recorded and non-silent. If the analysis document is silent, this is stop condition (a) and must be raised HERE, before the digest is frozen: the body this governs is frozen into the cross-runtime digest at C10, well before Phase 5.1.

#### Task 4.1.1 (CANARY-READ) [tier:fast]: Understand the digest procedure

**Files:** read-only.

- [ ] **Step 4.1.1.1:** Quote how the script computes and compares digests, how it reports mismatches (so the observed digests can be captured), and how it consumes the packed tarball per runtime.

#### Task 4.1.2 (CANARY-CASE) [tier:medium]: Add the 2.1.280 case and freeze the digest

**Files:**

- Modify: `D:\git\claude-code-wire-compat\scripts\verify-packed-consumers.mjs`

**Why this matters:** The digest is the cross-runtime tripwire; it is frozen once, on final bytes.

- [ ] **Step 4.1.2.1:** Add a 2.1.280 case mirroring the 2.1.233 case exactly (same scenario inputs, only the profile import differs) so digests are comparable across profiles.
- [ ] **Step 4.1.2.2:** Run `npm run test:pack` once with an intentionally empty expected value only if the script requires one to run; capture the three observed digests for 2.1.280; confirm node, bun and workerd agree byte-for-byte. Disagreement is a blocking problem (directive 1b).
- [ ] **Step 4.1.2.3:** Record the agreed digest as the expected literal; re-run `npm run test:pack` — green; 2.1.195 and 2.1.233 literals untouched.
- [ ] **Step 4.1.2.4:** `npx prettier --write` the script if it is Prettier-checked; `GATE-COMMIT`; `npm run test:pack`; `npm run pack:check`.
- [ ] **Step 4.1.2.5:** `git add` it; `git commit -s -m "test(pack): freeze claude-code-2.1.280 cross-runtime digest"`; the body quotes the three runtime outputs.

#### Task 4.1.3 (CANARY-GATES) [tier:fast]: Run the gates

- [ ] **Step 4.1.3.1:** `GATE-COMMIT`; `npm run test:pack`; `npm run pack:check` — post-commit confirmation.

#### New tests

No vitest file; the script itself is the test. Assertions added by the case: (1) 2.1.280 digest equality across three runtimes; (2) the two frozen literals unchanged (already asserted by the existing cases). Edge case: the case must fail loudly if the subpath export `./profiles/claude-code-2.1.280` cannot be resolved by a packed consumer.

#### Acceptance criteria

- `npm run test:pack` green with three profile cases; frozen digests unchanged; the 2.1.280 digest recorded in the script and in the commit body.

#### Definition of Done

- Commit C10 present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `GATE-COMMIT`; `npm run test:pack`; `npm run pack:check`.

**Review brief:** Attack: (1) whether the 2.1.280 scenario differs from the 2.1.233 scenario in anything but the profile; (2) whether the observed digests were captured from all three runtimes — the review dispatch must contain the RAW output of `npm run test:pack` showing all three runtimes; a claim in a commit body that three runtimes agreed is not verifiable and is not accepted; (3) whether either frozen literal was touched; (4) whether an unpinned case exists (pre-flight item 4) and whether Phase 4.2 accounts for it.

---

### Phase 4.2 — `DEFAULT_PROFILE` switch: isolated one-line commit

**File ownership**

| File                                                                                           | Owning task |
| ---------------------------------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\src\build-request.ts` (the DEFAULT_PROFILE assignment only)    | Task 4.2.3  |
| Tests that derive expectations from the default (refactor before the switch)                   | Task 4.2.2  |
| `D:\git\claude-code-wire-compat\test\validation\registration-2.1.280.test.ts` (governance pin) | Task 4.2.3  |
| `D:\git\claude-code-wire-compat\test\validation\default-profile-2.1.280.test.ts`               | Task 4.2.4  |

**Parallel-safety note:** Strictly serial: 4.2.1 → 4.2.2 → 4.2.3 → 4.2.4. Nothing else writes in the primary repository during Task 4.2.3.

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C10 and the worktree is clean.
2. `GATE-COMMIT` green; `npm run test:pack` green (three cases).
3. Quote the `DEFAULT_PROFILE` assignment in `D:\git\claude-code-wire-compat\src\build-request.ts:354-355` verbatim (pre-port line reference; locate by symbol).
4. Grep `D:\git\claude-code-wire-compat\test\` and `D:\git\claude-code-wire-compat\scripts\` for `DEFAULT_PROFILE`, `2.1.233` and `sdk-0.` and classify every hit: (a) derives its expectation from `DEFAULT_PROFILE` (no change needed), (b) hard-codes the 2.1.233 id as the default (must be refactored to (a) in Task 4.2.2, except the single labelled governance pin), (c) compares an unpinned request against a 2.1.233 fixture or digest (must be refactored to pin 2.1.233 explicitly in Task 4.2.2 — the fixture remains a 2.1.233 fixture).
5. Confirm from the Phase 4.1 pre-flight whether an unpinned canary case exists.
6. Search the whole suite for an EXISTING pin asserting that `DEFAULT_PROFILE` is the 2.1.233 profile. If one exists, C12 carries more than the one-line switch plus the new pin, and this plan must name the other file before the switch is made.

#### Task 4.2.1 (DEFAULT-INVENTORY) [tier:fast]: Classify every default-dependent test

**Files:** read-only.

- [ ] **Step 4.2.1.1:** Produce the (a)/(b)/(c) classification with file and line for each hit.

#### Task 4.2.2 (DEFAULT-PREP) [tier:medium]: Make tests default-agnostic where they should be

**Files:**

- Test: every (b)/(c) file from Task 4.2.1 except the governance pin.

**Why this matters:** The switch commit must be one line in `src/`. Tests that accidentally depend on the default are corrected _before_ the switch so their corrected form is reviewed on its own.

- [ ] **Step 4.2.2.1:** Rewrite (b) hits to assert against `DEFAULT_PROFILE` by identity or derived value; rewrite (c) hits to pin `CLAUDE_CODE_2_1_233_PROFILE` explicitly (they test 2.1.233 bytes, not "the default").
- [ ] **Step 4.2.2.2:** If an unpinned canary case exists, convert it to a pinned 2.1.233 case now (its digest is then stable), and note that unpinned behaviour is covered by Task 4.2.4's test.
- [ ] **Step 4.2.2.3:** `GATE-COMMIT`; `npm run test:pack`; `git add` explicit paths; `git commit -s -m "test: derive default-profile expectations from DEFAULT_PROFILE"` — skip this commit entirely if Task 4.2.1 found no (b)/(c) hits, and say so.

#### Task 4.2.3 (DEFAULT-SWITCH) [tier:medium]: The isolated one-line commit

**Files:**

- Modify: `D:\git\claude-code-wire-compat\src\build-request.ts` (the `DEFAULT_PROFILE` assignment; `:354-355`, pre-port line reference; locate by symbol).
- Test (only permitted companion hunk): the labelled governance pin newly created in `D:\git\claude-code-wire-compat\test\validation\registration-2.1.280.test.ts`.

**Why this matters:** `DEFAULT_PROFILE` is the single greppable seam deciding what an unpinned caller gets; the one-line commit makes the decision independently revertable.

- [ ] **Step 4.2.3.1:** Change `DEFAULT_PROFILE = CLAUDE_CODE_2_1_233_PROFILE` to `DEFAULT_PROFILE = CLAUDE_CODE_2_1_280_PROFILE` — one line.
- [ ] **Step 4.2.3.2:** Create the labelled governance pin in `D:\git\claude-code-wire-compat\test\validation\registration-2.1.280.test.ts` asserting that `DEFAULT_PROFILE` is `CLAUDE_CODE_2_1_280_PROFILE` by identity, with a comment naming Phase 4.2 as the only permitted place to change it. This pin is created here, at C12 — it is deliberately NOT created in Phase 2.1, because pinning the old default in Wave 2 is an intermediate assertion that directive 5 forbids. It is the only other hunk in this commit; the commit body states it.
- [ ] **Step 4.2.3.3:** `GATE-COMMIT`; `npm run test:pack`; `git add` the two absolute paths; `git commit -s -m "feat(build-request): default to claude-code-2.1.280"`; body carries the rollback instruction (pin `CLAUDE_CODE_2_1_233_PROFILE`).
- [ ] **Step 4.2.3.4:** `git show --stat HEAD` — confirm the `src/` change is exactly one line changed.

#### Task 4.2.4 (DEFAULT-TEST) [tier:medium]: Assert unpinned equals pinned-2.1.280

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\validation\default-profile-2.1.280.test.ts`

- [ ] **Step 4.2.4.1:** Tests under **New tests**; `GATE-COMMIT`, then `GATE-WAVE` (end of Wave 4).
- [ ] **Step 4.2.4.2:** `git add`; `git commit -s -m "test(build-request): prove unpinned requests equal pinned claude-code-2.1.280"`.

#### New tests

`D:\git\claude-code-wire-compat\test\validation\default-profile-2.1.280.test.ts` must import `../../src/index.js` at least once, or `D:\git\claude-code-wire-compat\test\governance\public-path-coverage.test.ts` fails; deep imports are otherwise fine.

- `an unpinned request is byte-identical to a request pinned to CLAUDE_CODE_2_1_280_PROFILE` — same scenario as the 14-identifier test, serialised headers and body compared as strings.
- A second test asserting the user agent and version-bearing headers would be redundant: byte-identity against the pinned 2.1.280 request already implies it.
- `pinning CLAUDE_CODE_2_1_233_PROFILE still yields the 2.1.233 default-path header` — rollback proof.
- Edge: `DEFAULT_PROFILE is a member of ACCEPTED_PROFILES by identity`.

#### Acceptance criteria

- The switch commit changes exactly one `src/` line; `GATE-WAVE` green; frozen digests unchanged; `npm run test:pack` green.

#### Definition of Done

- Commits C11 (optional prep), C12 (switch), C13 (test) present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `GATE-COMMIT` per commit; `GATE-WAVE`.

**Review brief:** Attack: (1) `git show <C12> --stat` — anything beyond the one `src/` line and the labelled pin is a finding; (2) whether any test refactor in C11 weakened an assertion (e.g. replaced a literal with a value read from the code under test where a literal was the point); (3) whether the rollback instruction in the commit body is exact; (4) whether README or other docs now contradict the default (to be fixed in Phase 6.1 — list them).

---

## Wave 5 — Proof surface

### Phase 5.1 — Golden fixtures, `manifest.models`, seal, baseline evidence rows

**File ownership**

| File                                                                                    | Owning task |
| --------------------------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\test\fixtures\golden\<2.1.280 fixture files>`           | Task 5.1.2  |
| `D:\git\claude-code-wire-compat\test\fixtures\golden\manifest.json` (`manifest.models`) | Task 5.1.3  |
| Seal output file(s) written by `npm run fixtures:seal`                                  | Task 5.1.4  |
| `D:\git\claude-code-wire-compat\docs\plans\baseline-2026-08-05.md`                      | Task 5.1.5  |

**Parallel-safety note:** Strictly serial, and no other task may hold any file in this worktree. `npm run fixtures:seal` refuses when any untracked file sits under `D:\git\claude-code-wire-compat\test\fixtures\golden\`, when any tracked file outside its two targets is modified, or when `CI` is truthy.

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C13 and the worktree is clean.
2. `GATE-WAVE` green at HEAD (end of Wave 4).
3. `$env:CI` recorded; the seal command for this phase is `Remove-Item Env:CI -ErrorAction SilentlyContinue; npm run fixtures:seal`.
4. **RESOLVE FROM REPO:** the fixture procedure in `D:\git\claude-code-wire-compat\docs\plans\UPSTREAM-TRACKING-RUNBOOK.md` (how fixtures are produced and named, what `manifest.models` holds per fixture), the seal script's two targets and its exact refusal checks (quote them), and the 2.1.233 fixture file list with their manifest entries.
5. Quote the 2.1.233 rows and the most recent dated amendment blockquote in `D:\git\claude-code-wire-compat\docs\plans\baseline-2026-08-05.md`.
6. Task 1.2.1.5's answer on `output_config.effort` for `claude-opus-5-5` is recorded (it was raised, if silent, at the Phase 4.1 pre-flight; re-confirm it here).
7. Read `D:\git\claude-code-wire-compat\test\conformance\differential.test.ts` and determine whether it discovers fixtures by directory and requires a per-profile entry in `D:\git\claude-code-wire-compat\test\conformance\reference-adapter.ts`. If it does, C14 is red until C16 unless the adapter entry lands in C14 as a companion guard amendment — decide which, and record it.

#### Task 5.1.1 (FIX-PROCEDURE) [tier:fast]: Extract the exact procedure

**Files:** read-only.

- [ ] **Step 5.1.1.1:** Produce the step list from pre-flight item 4 with the exact commands, the seal targets, and whether untracked files outside the golden directory block the seal.

#### Task 5.1.2 (FIX-CREATE) [tier:medium]: Create the 2.1.280 fixtures

**Files:**

- Create: 2.1.280 fixture files mirroring the 2.1.233 scenario set (same scenarios, version substituted in names) plus the `claude-opus-5-5` default-path scenario of Task 3.3.3.

**Why this matters:** The seal guards echoed bytes; each fixture's derived fields must be checked by hand against the analysis document so the fixture encodes the evidence, not merely the builder's current output.

- [ ] **Step 5.1.2.1:** Produce each fixture with the profile pinned to `CLAUDE_CODE_2_1_280_PROFILE`, following the runbook procedure. The default-path fixture uses the Phase 3.3 scenario VERBATIM — same model, same caller inputs, same thinking configuration — so that the sealed bytes and the 14-identifier literal test are proving the same request.
- [ ] **Step 5.1.2.2:** For every fixture, hand-verify against the analysis document: `anthropic-beta` header, `user-agent`, version-bearing headers, `thinking` object (type, display, key order), `output_config` presence/value, `tool_choice` demotion under active thinking (`D:\git\claude-code-wire-compat\src\request-body.ts:1903-1909` behaviour; pre-port line reference; locate by symbol), and the fingerprint header (cross-check with the Phase 5.4 independent one-liner for the fixture's first user text).
- [ ] **Step 5.1.2.3:** Record the per-fixture verification in the commit body (fixture name → checked fields).

#### Task 5.1.3 (FIX-MANIFEST) [tier:medium]: Hand-edit `manifest.models`

**Files:**

- Modify: `D:\git\claude-code-wire-compat\test\fixtures\golden\manifest.json`

- [ ] **Step 5.1.3.1:** Add each new fixture's entry to `manifest.models` by hand, mirroring the 2.1.233 entries (this is seal input; omission renders `n/a` in the doc table).
- [ ] **Step 5.1.3.2:** `git add` every new fixture file and the manifest (the seal refuses untracked files inside the golden directory).

#### Task 5.1.4 (FIX-SEAL) [tier:medium]: Seal

- [ ] **Step 5.1.4.1:** `git status --porcelain` shows only staged files inside the seal's targets (and, if tolerated, Phase 5.4's untracked test file).
- [ ] **Step 5.1.4.2:** `Remove-Item Env:CI -ErrorAction SilentlyContinue; npm run fixtures:seal`; then `npm run fixtures:check` green.
- [ ] **Step 5.1.4.3:** `git add` the seal output file(s).

#### Task 5.1.5 (FIX-BASELINE) [tier:medium]: Baseline evidence rows and amendment

**Files:**

- Modify: `D:\git\claude-code-wire-compat\docs\plans\baseline-2026-08-05.md`

**Why this matters:** `D:\git\claude-code-wire-compat\test\governance\baseline-evidence.test.ts` enforces a bijection between the golden directory and the hash table; this edit happens after the seal (the seal would refuse a modified tracked doc outside its targets) and in the same commit (the bijection would otherwise be broken in one of the two commits).

- [ ] **Step 5.1.5.1:** Add one hand-written row per new fixture with its SHA-256 (`Get-FileHash -Algorithm SHA256 <absolute path>` matches the raw-byte hashing the tests use), plus a dated amendment blockquote (date of the commit) mirroring the previous amendment's form.
- [ ] **Step 5.1.5.2:** `npx prettier --write "D:\git\claude-code-wire-compat\docs\plans\baseline-2026-08-05.md"`.
- [ ] **Step 5.1.5.3:** `GATE-COMMIT`; `npm run fixtures:check`; `git add "D:\git\claude-code-wire-compat\docs\plans\baseline-2026-08-05.md"`; `git commit -s -m "test(fixtures): add claude-code-2.1.280 golden fixtures and reseal"`.

#### New tests

No new vitest file; the fixtures are the tests. Assertions exercised: `npm run fixtures:check` (seal), `baseline-evidence.test.ts` (bijection), and — once Phases 5.2/5.3 land — `profile-coverage.test.ts` and the differential replay. Edge cases encoded as fixtures: the `claude-opus-5-5` default path (14 identifiers, `display: "updates"`, no `redact-thinking`); a caller-supplied `display` scenario if the 2.1.233 set has one (beta and injection suppressed); a haiku scenario if the 2.1.233 set has one (no `claude-code-20250219`).

#### Acceptance criteria

- `GATE-COMMIT` and `npm run fixtures:check` green; bijection holds; every fixture's derived fields hand-verified and recorded.

#### Definition of Done

- Commit C14 present; QA review returned zero open findings.

#### Senior QA review (`@heavy`, adversarial)

**Gates run in this phase:** `GATE-COMMIT`; `npm run fixtures:check`.

**Review brief:** With the default-path fixture bytes and the analysis-document literal in the dispatch, attack: (1) byte-level comparison of the `anthropic-beta` value and the `thinking` object; (2) whether `manifest.models` was edited by hand for every fixture; (3) whether the baseline rows' hashes equal `Get-FileHash` of the committed files; (4) whether the amendment blockquote is dated and mirrors the prior form; (5) whether the seal was run with `CI` cleared and whether any tracked file outside the targets was modified at seal time (read the commit's file list).

---

### Phase 5.2 — Profile matrix registration

**File ownership**

| File                                                            | Owning task |
| --------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\test\support\profile-matrix.ts` | Task 5.2.1  |

**Parallel-safety note:** Serial after 5.1; 5.3 waits for 5.2. Phase 5.4 may run concurrently (disjoint files).

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C14 and the worktree is clean (or carries only Phase 5.4's uncommitted new file).
2. `GATE-COMMIT` green; `npm run fixtures:check` green.
3. Quote the 2.1.233 entry of `D:\git\claude-code-wire-compat\test\support\profile-matrix.ts` (fields, expected scalars, fixture references).
4. List every test that iterates the matrix (grep for the matrix export name) — these are the tests that will newly exercise 2.1.280.
5. Confirm `D:\git\claude-code-wire-compat\test\governance\profile-coverage.test.ts` will find ≥1 fixture with `profileId` `claude-code-2.1.280-sdk-0.112.1` (grep the golden manifest).

#### Task 5.2.1 (MATRIX-ADD) [tier:medium]: Add the 2.1.280 matrix entry

**Files:**

- Modify: `D:\git\claude-code-wire-compat\test\support\profile-matrix.ts`

**Why this matters:** The matrix is what turns "the profile exists" into "every parameterised test runs against it".

- [ ] **Step 5.2.1.1:** Add the entry mirroring 2.1.233 (profile singleton, id, version strings, fixture names, any expected header scalars), transcribing values from the analysis document.
- [ ] **Step 5.2.1.2:** `npm test` — every matrix-driven test now covers 2.1.280. Any failure is a genuine defect in an earlier phase: fix it in the owning file as a separate `fix(...)` commit with root cause in the body; two failed fix attempts on one defect escalate to `[tier:heavy]` (directive 7 spirit; Phase 2C of the operating guide).
- [ ] **Step 5.2.1.3:** `npx prettier --write`; `GATE-COMMIT`; `git add`; `git commit -s -m "test(matrix): register claude-code-2.1.280 in the profile matrix"`.

#### New tests

None authored; existing matrix-driven tests gain a 2.1.280 column. Expected newly-green assertions: profile-coverage (fixture present), any per-profile header/scalar test. Edge case to verify by reading the run output: the matrix-driven test count increased by the number of matrix-parameterised tests (record the delta).

#### Acceptance criteria

- `GATE-COMMIT` green; test count increased by the expected delta; no fix commit needed, or each fix commit has a root cause.

#### Definition of Done

- Commit C15 present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `GATE-COMMIT`.

**Review brief:** Attack: (1) whether the matrix entry values were transcribed from the analysis document rather than copied from the profile file; (2) whether any fix commit in this phase changed `src/` semantics for older profiles (re-run `npm run test:pack` and inspect); (3) whether any test was skipped or loosened to get green.

---

### Phase 5.3 — Reference adapter and differential conformance

**File ownership**

| File                                                                   | Owning task |
| ---------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\test\conformance\reference-adapter.ts` | Task 5.3.1  |
| `D:\git\claude-code-wire-compat\test\conformance\differential.test.ts` | Task 5.3.1  |

**Parallel-safety note:** Serial after 5.2. Phase 5.4 may run concurrently (disjoint files).

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C15 and the worktree is clean (except Phase 5.4's file).
2. `GATE-COMMIT` green.
3. Quote the 2.1.233 case in `D:\git\claude-code-wire-compat\test\conformance\reference-adapter.ts` and how `D:\git\claude-code-wire-compat\test\conformance\differential.test.ts` selects fixtures per profile and which derived fields it compares.
4. Confirm the adapter constructs `ClaudeCodeCapabilities` (if so, Phase 3.1 already updated it — verify the two new booleans are present).
5. `npm run fixtures:check` green.

#### Task 5.3.1 (DIFF-ADD) [tier:medium]: Add the 2.1.280 adapter case and differential coverage

**Files:**

- Modify: `D:\git\claude-code-wire-compat\test\conformance\reference-adapter.ts`, `D:\git\claude-code-wire-compat\test\conformance\differential.test.ts`.

**Why this matters:** The seal guards echoed bytes; the differential guards derived fields. Both must fire on a mutation of a derived field — that property is verified here, not assumed.

- [ ] **Step 5.3.1.1:** Add the 2.1.280 adapter case mirroring 2.1.233; extend the differential so every 2.1.280 fixture is replayed through the builder and its derived fields (betas, thinking object, output_config, headers) compared.
- [ ] **Step 5.3.1.2:** Mutation check (not committed): copy the default-path fixture to `$env:TEMP`, change one derived field (e.g. drop `thinking-display-updates-2026-08-18` from the header) and, pointing the differential at the copy via whatever mechanism the existing test offers — or, if none, by a temporary in-place edit — confirm the differential fails; then confirm `npm run fixtures:check` also fails on the in-place edit; restore with `git checkout -- <absolute path>`; confirm both green. Record both failure messages in the commit body.
- [ ] **Step 5.3.1.3:** `npx prettier --write`; `GATE-COMMIT`; `git add`; `git commit -s -m "test(conformance): add claude-code-2.1.280 reference adapter and differential cases"`.

#### New tests

Inside `D:\git\claude-code-wire-compat\test\conformance\differential.test.ts`, parameterised per 2.1.280 fixture:

- `replays <fixture> through the builder and matches every derived field`.
- `claude-opus-5-5 default path: header equals the 14-identifier literal and thinking carries display updates` — explicit named case.
- Edge cases: caller-display fixture (no injection), haiku fixture (no `claude-code-20250219`) — if those fixtures exist per Phase 5.1.

#### Acceptance criteria

- `GATE-COMMIT` green; the mutation check demonstrably failed both guards and is recorded.

#### Definition of Done

- Commit C16 present; QA review returned zero open findings.

#### Senior QA review (`@heavy`, adversarial)

**Gates run in this phase:** `GATE-COMMIT`; `npm run fixtures:check`.

**Review brief:** Attack: (1) whether the differential compares derived fields by value or merely echoes fixture bytes back (it must derive); (2) whether the mutation check evidence in the commit body is real (quote both failure messages); (3) whether the restored fixture is byte-identical (`git status` clean after the check).

---

### Phase 5.4 — Fingerprint known-answer vectors (independently computed)

**File ownership**

| File                                                              | Owning task |
| ----------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\test\fingerprint-2.1.280.test.ts` | Task 5.4.2  |

**Parallel-safety note:** May run concurrently with Phases 4.1–5.3 (disjoint files) subject to the seal constraint noted in Phase 5.1; commits only after C10 is in and never while Task 5.1.4 is sealing.

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C10 and the worktree is clean.
2. `GATE-COMMIT` green at HEAD.
3. Quote `D:\git\claude-code-wire-compat\test\fingerprint-2.1.233.test.ts` in full (structure to copy; how it obtains the fingerprint value — header name, builder call).
4. Quote the fingerprint transcription from the analysis document (byte 12542900): salt, index selection with `|| "0"` fallback, concatenation order, hash, truncation.
5. Node available for the independent one-liner; the one-liner must not import the package.

#### Task 5.4.1 (FP-CALIBRATE) [tier:fast]: Calibrate the independent computation on the 2.1.233 vectors

**Files:** none.

**Why this matters:** A vector produced by the code under test proves only self-consistency; the independent script is trusted only after it reproduces the known 2.1.233 answers.

- [ ] **Step 5.4.1.1:** Run, from any directory, for each probe: `node -e "const c=require('node:crypto');const t=process.argv[1];const v=process.argv[2];const s='59cf53e54c78'+(t[4]||'0')+(t[7]||'0')+(t[20]||'0')+v;console.log(c.createHash('sha256').update(s).digest('hex').slice(0,3))" "offline cch probe" "2.1.233"` and likewise for `"hello wire compat"` and `"canary probe"`.
- [ ] **Step 5.4.1.2:** Expected `365`, `413`, `cea`. If any differs, the one-liner's concatenation order or fallback does not match the transcription — correct the one-liner from the analysis document's transcription (pre-flight item 4) and re-run; never adjust the package. If it still cannot reproduce the known vectors, stop (directive 1b).
- [ ] **Step 5.4.1.3:** Compute the 2.1.280 vectors with version `2.1.280` for `offline cch probe`, `hello wire compat`, `canary probe`, plus one probe of ≥ 21 characters (e.g. `the quick brown fox jumps over the lazy dog`, exercising the non-fallback index 20), one probe shorter than 5 characters (all three fallbacks), and the empty string. Record all six. This plan deliberately does not carry the 2.1.280 answers.
- [ ] **Step 5.4.1.4:** The independent computation runs outside the repository, in `$env:TEMP`, using a standalone script that does not import this package. The test file `D:\git\claude-code-wire-compat\test\fingerprint-2.1.280.test.ts` is authored only after commit C16 exists, so it never sits untracked in the worktree during another phase's `npm test` or during the Phase 5.1 seal.

#### Task 5.4.2 (FP-TEST) [tier:medium]: Author the test

**Files:**

- Test: `D:\git\claude-code-wire-compat\test\fingerprint-2.1.280.test.ts`

- [ ] **Step 5.4.2.1:** Copy the structure of `D:\git\claude-code-wire-compat\test\fingerprint-2.1.233.test.ts`; substitute the profile and the six vectors; add a header comment stating the vectors were computed with the independent one-liner calibrated on the 2.1.233 known answers.
- [ ] **Step 5.4.2.2:** Tests: `matches the independently computed vector for <probe>` × 6; `differs from the 2.1.233 vector for the same probe` (version string participates); edge: `uses UTF-16 code-unit indexing` — a probe with a non-BMP character before index 4 must reproduce the one-liner's result for the same JavaScript string (compute it in Task 5.4.1 as a seventh vector); if the existing 2.1.233 test has no such case, include it here.
- [ ] **Step 5.4.2.3:** `npx prettier --write`; `GATE-COMMIT`; `git add`; `git commit -s -m "test(fingerprint): add independently computed claude-code-2.1.280 vectors"`; body lists the six/seven vectors and the calibration result.

#### New tests

As listed in Step 5.4.2.2. Edge cases named: fallback at index 20 (three original probes), non-fallback index 20 (long probe), all-fallback (short probe), empty string, non-BMP character before index 4.

#### Acceptance criteria

- Calibration reproduced `365`/`413`/`cea`; `GATE-COMMIT` green; vectors recorded for Phase 6.1 to copy into `D:\git\claude-code-wire-compat\AGENTS.md`.

#### Definition of Done

- Commit C17 present; QA review returned zero open findings.

#### Senior QA review (`@heavy`, adversarial)

**Gates run in this phase:** `GATE-COMMIT`.

**Review brief:** Attack: (1) whether the vectors in the test could have been produced by running the package (commit body must show the one-liner and the calibration output); (2) whether the one-liner's concatenation order matches the transcription; (3) whether the non-BMP probe's expectation was computed on the identical JavaScript string the test passes; (4) whether the test reads the fingerprint from the same header the 2.1.233 test reads.

---

### Phase 5.5 — Behaviour-flags audit (last, per runbook)

**File ownership**

| File                                                                | Owning task |
| ------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\MEMORY.md` (append one dated entry) | Task 5.5.1  |

**Parallel-safety note:** Serial after 5.3 and 5.4; Phase 6.1 also appends to `MEMORY.md` and must wait for this commit.

#### Pre-flight check

1. Correct repository/branch; `git status --porcelain` empty; C14–C17 present.
2. `GATE-WAVE` green (end of Wave 5 run happens in this phase's last step; `GATE-COMMIT` green now).
3. Quote every flag in `D:\git\claude-code-wire-compat\src\profile-behaviors.ts` and the single demarcated `profile.id` comparison.
4. `npx vitest run test/governance/version-dispatch.test.ts` green.
5. Grep `D:\git\claude-code-wire-compat\src\` for `2.1.280` — hits must be limited to the profile file, the registry file, `parseProfile`, `PINNED_PROFILE_IDS`, `PROFILE_BETA_REGISTRIES` keying and the exports.

#### Task 5.5.1 (FLAGS-AUDIT) [tier:heavy]: Confirm no version-gated flag is required and record why

**Files:**

- Modify: `D:\git\claude-code-wire-compat\MEMORY.md`

**Why this matters:** The runbook puts behaviour flags last so the porter checks whether any behaviour truly needs `profile.id` gating; for 2.1.280 every delta is expressed as data (`contextHintEnabled`, `cacheDiagnosisEnabled`, registry keys, catalogue strings). That conclusion must be written down or the next porter re-litigates it.

The expected outcome is that NO version-gated behaviour flag is required: every 2.1.280 delta in this port is data-driven or registry-driven. Finding that a flag IS required is stop condition (a) — raise it; do not silently add a branch to `D:\git\claude-code-wire-compat\src\profile-behaviors.ts`.

- [ ] **Step 5.5.1.1:** Walk every 2.1.280 delta in Appendix D and classify it as data-driven (registry key, catalogue string, profile scalar, policy boolean) or version-gated; expected result: zero version-gated.
- [ ] **Step 5.5.1.2:** Append a dated (2026-09-23 or the commit date) entry to `D:\git\claude-code-wire-compat\MEMORY.md`: "2.1.280 introduced no `profile-behaviors.ts` flag; every delta is data-driven; mechanisms added: capabilities 6→8, push sites 17→22 + redact removal, thinking display updates; mechanism wave was placed between registration and canary because …" (the rationale from the wave map).
- [ ] **Step 5.5.1.3:** `npx prettier --write "D:\git\claude-code-wire-compat\MEMORY.md"`; `GATE-COMMIT`; `git add`; `git commit -s -m "docs(memory): record claude-code-2.1.280 behaviour-flag audit"`.
- [ ] **Step 5.5.1.4:** Run `GATE-WAVE` (end of Wave 5): `test:coverage` ≥ thresholds, `pack:check`, `test:pack` (three cases; two frozen unchanged), `fixtures:check`.

#### New tests

None; `D:\git\claude-code-wire-compat\test\governance\version-dispatch.test.ts` is the guard and is re-run explicitly. Edge case checked by pre-flight item 5: no stray version literal in `src/`.

#### Acceptance criteria

- `GATE-WAVE` green; MEMORY.md entry present; zero version-gated deltas.

#### Definition of Done

- Commit C18 present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `GATE-WAVE`.

**Review brief:** Attack the classification: for each of the nine new registry entries and the two new capability strings, argue whether a genuine client could behave differently from the package under any input the package accepts, and whether that difference would need a version flag. Also attack whether the removed `redact-thinking` behaviour could affect 2.1.233 through `additionalBetas` interplay.

---

## Wave 6 — Documentation, governance and release readiness

### Phase 6.1 — README, AGENTS.md, runbook, MEMORY.md, versions index

**File ownership**

| File                                                                            | Owning task |
| ------------------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\README.md`                                      | Task 6.1.2  |
| `D:\git\claude-code-wire-compat\AGENTS.md`                                      | Task 6.1.2  |
| `D:\git\claude-code-wire-compat\docs\plans\UPSTREAM-TRACKING-RUNBOOK.md`        | Task 6.1.2  |
| `D:\git\claude-code-wire-compat\docs\protocol\versions\README.md` (conditional) | Task 6.1.2  |
| `D:\git\claude-code-wire-compat\MEMORY.md`                                      | Task 6.1.3  |

**Parallel-safety note:** 6.1.1 (read-only) first; 6.1.2 and 6.1.3 concurrently (disjoint files); one commit.

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C18 and the worktree is clean.
2. `GATE-WAVE` green (end of Wave 5 record).
3. Grep `D:\git\claude-code-wire-compat\README.md`, `D:\git\claude-code-wire-compat\AGENTS.md`, `D:\git\claude-code-wire-compat\docs\plans\UPSTREAM-TRACKING-RUNBOOK.md`, `D:\git\claude-code-wire-compat\docs\protocol\versions\README.md` for `2.1.233`, `17-model`, `17-step`, `default` — list every hit that is now stale.
4. Phase 4.2 QA's list of docs contradicting the default is at hand.
5. The 2.1.280 digest (C10) and vectors (C17) are at hand.

#### Task 6.1.1 (DOC-STALE) [tier:fast]: Produce the stale-statement list

- [ ] **Step 6.1.1.1:** For each hit from pre-flight item 3, quote the line and state the replacement.

#### Task 6.1.2 (DOC-UPDATE) [tier:medium]: Update the governance documents

**Files:** as in the ownership table.

- [ ] **Step 6.1.2.1:** `D:\git\claude-code-wire-compat\README.md` — supported profiles list gains 2.1.280; default statement says 2.1.280; rollback snippet pins `CLAUDE_CODE_2_1_233_PROFILE`; the analysis document remains linked (links test).
- [ ] **Step 6.1.2.2:** `D:\git\claude-code-wire-compat\AGENTS.md` — add the 2.1.280 digest to the frozen list; add the 2.1.280 known vectors (from C17); replace "17-model catalogue" with per-version wording (17 for 2.1.195/2.1.233, 20 for 2.1.280 — verify the 2.1.195 count with a fast read before writing it); replace "17-step push order" with "22-step push order (17 base sites plus five optional 2.1.280 sites, plus the redact-thinking removal); the order is emergent upstream behaviour and load-bearing — never reorder it"; note that `THINKING_DISPLAY_UPDATES` removes `REDACT_THINKING`.
- [ ] **Step 6.1.2.3:** `D:\git\claude-code-wire-compat\docs\plans\UPSTREAM-TRACKING-RUNBOOK.md` — add a dated amendment: mechanism changes that alter bytes for the new profile are landed between registration and the canary so the digest is computed once on final bytes; the seal must be run with `CI` cleared on machines that export it; the baseline doc is edited after the seal and committed with it.
- [ ] **Step 6.1.2.4:** `D:\git\claude-code-wire-compat\docs\protocol\versions\README.md` — only if it carries a port-status column, mark 2.1.280 as ported/default.
- [ ] **Step 6.1.2.5:** `npx prettier --write` on the touched Prettier-checked files (not `docs/protocol/`); `npx vitest run test/docs test/governance`.

#### Task 6.1.3 (DOC-MEMORY) [tier:medium]: Append the decision log entries

**Files:**

- Modify: `D:\git\claude-code-wire-compat\MEMORY.md`

- [ ] **Step 6.1.3.1:** Append dated entries: (1) `cacheDiagnosisEnabled` flipped to `true` for 2.1.280 per §7.6.2; 2.1.233 left as-is; whether 2.1.233 was wrong is open pending its binary; (2) `"updates"` is a wire-level `ThinkingDisplay` member never offered to callers (design note from Task 3.3.1); (3) `redact-thinking` removal is applied before the `additionalBetas` merge (Task 3.3.1.3); (4) `suppressBetas` semantics for coupled pairs as resolved in Phase 3.3; (5) `per_turn_timing` deliberately not mapped to a capability; (6) context-object rule (13 of 20) and the ten unmodelled keys; (7) the `ComposeBetasInput` thinking-emission field design (Task 3.2.1).
- [ ] **Step 6.1.3.2:** `npx prettier --write "D:\git\claude-code-wire-compat\MEMORY.md"`; `GATE-COMMIT`; `git add` the touched absolute paths from 6.1.2 and 6.1.3; `git commit -s -m "docs: update README, AGENTS, runbook and memory for claude-code-2.1.280"`.

#### New tests

None; `D:\git\claude-code-wire-compat\test\docs\links.test.ts` and `D:\git\claude-code-wire-compat\test\docs\provenance.test.ts` are the guards. Edge case: every relative link added resolves; every `docs/protocol/` file is still linked from `D:\git\claude-code-wire-compat\README.md`.

#### Acceptance criteria

- No stale statement from Task 6.1.1 remains; `GATE-COMMIT` green.

#### Definition of Done

- Commit C19 present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `GATE-COMMIT`.

**Review brief:** Attack: (1) whether AGENTS.md's digest and vectors are copied exactly from C10/C17 commit bodies; (2) whether any doc still says the default is 2.1.233 or "17-model"; (3) whether MEMORY.md entries are honest about the 2.1.233 open question and do not overclaim; (4) whether the runbook amendment contradicts the runbook's mandatory order.

---

### Phase 6.2 — Version bump 0.6.0, CHANGELOG, package-policy version literal

**File ownership**

| File                                                                                           | Owning task |
| ---------------------------------------------------------------------------------------------- | ----------- |
| `D:\git\claude-code-wire-compat\package.json` (version only)                                   | Task 6.2.1  |
| `D:\git\claude-code-wire-compat\CHANGELOG.md`                                                  | Task 6.2.1  |
| `D:\git\claude-code-wire-compat\test\governance\package-policy.test.ts` (version literal only) | Task 6.2.1  |

**Parallel-safety note:** Single task, single commit; nothing else writes in the primary repository.

#### Pre-flight check

1. Correct repository/branch; HEAD is at or after C19 and the worktree is clean.
2. `GATE-COMMIT` green.
3. Quote the current first heading of `D:\git\claude-code-wire-compat\CHANGELOG.md` (`## [0.5.0] - 2026-08-16`) and the most recent Breaking section's form (for the rollback snippet).
4. Quote the version literal in `D:\git\claude-code-wire-compat\test\governance\package-policy.test.ts` and the `release-policy` rule (dated heading for stable).
5. `package-lock.json` handling: **RESOLVE FROM REPO** whether the lockfile carries the package version (then `npm version 0.6.0 --no-git-tag-version` updates both) — mirror how 0.5.0 was bumped (`git log -p -1 -- D:\git\claude-code-wire-compat\package.json`).

#### Task 6.2.1 (REL-PREP) [tier:medium]: Make the tree release-ready

**Files:** as in the ownership table (plus `D:\git\claude-code-wire-compat\package-lock.json` if pre-flight item 5 says so).

**Why this matters:** `release-policy` requires the first `## [x]` heading to equal `package.json.version`; a breaking default-profile change requires a consumer-facing Breaking section with the exact rollback instruction. Publishing itself (GitHub release → OIDC workflow) is a human action outside this plan.

- [ ] **Step 6.2.1.1:** Bump to `0.6.0` (0.x semver: breaking default change → minor bump).
- [ ] **Step 6.2.1.2:** CHANGELOG `## [0.6.0] - <commit date>` with sections: **Breaking** — default profile is now `claude-code-2.1.280-sdk-0.112.1`; rollback: pin `CLAUDE_CODE_2_1_233_PROFILE` (exact snippet mirroring the prior Breaking section's form; package name `@tormentalabs/claude-code-wire-compat`); `ClaudeCodeCapabilities` gains two required booleans (`midConvToolChange`, `perTurnEffort`) — consumers constructing the type must supply them; `ThinkingDisplay` gains `"updates"` (wire-level; not accepted as caller input). **Added** — 2.1.280 profile, registry (40 entries, nine new), three auxiliary beta sets, five push sites, `redact-thinking` removal under display updates, 20-model catalogue with three new models, third frozen digest, fingerprint vectors. **Changed** — `cacheDiagnosisEnabled` true for 2.1.280 (2.1.233 unchanged). **Fixed** — pack-policy test accepts npm 12 output.
- [ ] **Step 6.2.1.3:** Update the version literal in package-policy.
- [ ] **Step 6.2.1.4:** `npx prettier --write` touched files; `GATE-COMMIT`; `git add` explicit paths; `git commit -s -m "chore(release): 0.6.0"`.
- [ ] **Step 6.2.1.5:** `GATE-WAVE` (end of Wave 6).

#### New tests

None; `release-policy` and `package-policy` are the guards. Edge case: the heading date format matches the 0.5.0 heading exactly.

#### Acceptance criteria

- `GATE-WAVE` green; frozen digests unchanged; Breaking section carries the exact rollback.

#### Definition of Done

- Commit C20 present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `GATE-WAVE`.

**Review brief:** Attack: (1) whether the CHANGELOG understates breakage (the required booleans, the type widening); (2) whether the rollback snippet compiles against the public API as exported; (3) whether the lockfile version is coherent; (4) whether anything in this commit is not release-prep.

---

## Wave 7 — Sibling repositories

All three phases may run concurrently with each other and with Waves 1–6 (different worktrees). Each is one commit in its own repository.

**Serialisation.** Any sibling-repository document that names a package identifier this port fixes — the capability property names (`perTurnEffort`, `midConvToolChange`), the `ComposeBetasInput` thinking-signal field name, or the caller-facing thinking display type name — must be written AFTER the phase that fixes that name: Phase 3.1 for the capability property names, the merged Task 3.2.1 design for the input field and the display type. A Wave 7 document naming a name that later changes is a documentation defect the gates cannot catch.

### Phase 7.1 — Document `lean_prompt` in `D:\git\opencode-anthropic-fix`

**File ownership**

| File                                                                                                      | Owning task |
| --------------------------------------------------------------------------------------------------------- | ----------- |
| `D:\git\opencode-anthropic-fix\docs\lean-prompt-claude-code-2.1.280.md`                                   | Task 7.1.2  |
| `D:\git\opencode-anthropic-fix\docs\mimese-http-header-system-prompt.md` (cross-reference paragraph only) | Task 7.1.2  |

**Parallel-safety note:** Single writer; 7.1.1 read-only first.

#### Pre-flight check

1. Correct repository: `git -C "D:\git\opencode-anthropic-fix" rev-parse --show-toplevel` → `D:/git/opencode-anthropic-fix`; `git status --porcelain` empty; record the branch.
2. Expected baseline: `npx vitest run` from `D:\git\opencode-anthropic-fix` green with coverage floors met (`lib/**` ≥ 85/75, `index.mjs` ≥ 56/52, `cli.mjs` ≥ 69/60).
3. Read the house style of an existing doc under `D:\git\opencode-anthropic-fix\docs\` and the heading structure of `D:\git\opencode-anthropic-fix\docs\mimese-http-header-system-prompt.md`.
4. Confirm `D:\git\opencode-anthropic-fix\test\conformance\package-dependency-policy.test.mjs` is unaffected (no code change, no new dependency).
5. Confirm no code file will be touched (documentation-only; therefore `D:\git\opencode-anthropic-fix\test\conformance\regression.test.mjs` needs no change — state this in the commit body, since "documentation is the contract" applies to wire changes and this is none).

#### Task 7.1.1 (LEAN-CONTEXT) [tier:fast]: Gather the doc's neighbours

- [ ] **Step 7.1.1.1:** Quote the section of `D:\git\opencode-anthropic-fix\docs\mimese-http-header-system-prompt.md` that describes system-prompt selection, to place the cross-reference.

#### Task 7.1.2 (LEAN-DOC) [tier:medium]: Write the document

**Files:** as in the ownership table.

**Why this matters:** This repository does system-prompt mimicry; a model that carries `lean_prompt` receives the shorter prompt, which is counter-intuitive from the name and out of seam for the wire-compat package.

- [ ] **Step 7.1.2.1:** Content, in that repository's style (`# Title`, `**Goal/Architecture/Tech Stack/Exit criteria**` where applicable): the upstream predicate's return is inverted relative to its name — the function answers "send the FULL, verbose system prompt", so a model that CARRIES `lean_prompt` receives the SHORTER prompt; holders in 2.1.280: `claude-opus-4-8`, `claude-opus-5`, `claude-opus-5-5`, `claude-fable-5`, `claude-fable-5-1`, `claude-mythos-5-1`; a remote feature gate can override it; **the actual prompt TEXT delta was NOT extracted and is unknown** (flag prominently); evidence pointer: `D:\git\claude-code-wire-compat\docs\protocol\versions\claude-code-2.1.280-analysis.md` (search `lean_prompt`); statement that the wire-compat package records this as not ported (`D:\git\claude-code-wire-compat\docs\source-trace.md`).
- [ ] **Step 7.1.2.2:** Add a one-paragraph cross-reference in `D:\git\opencode-anthropic-fix\docs\mimese-http-header-system-prompt.md` pointing at the new doc.
- [ ] **Step 7.1.2.3:** Run the repository's formatter/lint if one exists (**RESOLVE FROM REPO**: `D:\git\opencode-anthropic-fix\package.json` scripts); `npx vitest run` green with floors met.
- [ ] **Step 7.1.2.4:** `git add` both absolute paths; `git commit -s -m "docs: document lean_prompt inversion for claude code 2.1.280"`.

#### New tests

None (documentation). Edge case: if that repository has a docs link/consistency test, it must stay green — verified by the full run.

#### Acceptance criteria

- Doc exists, cross-referenced; test suite and coverage floors green; no code or dependency change.

#### Definition of Done

- Commit S1 present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `npx vitest run` in `D:\git\opencode-anthropic-fix`.

**Review brief:** Attack: (1) whether the doc overstates what was extracted (the text delta is unknown — any sentence implying otherwise is a finding); (2) whether the holder list matches the catalogue capability arrays in Appendix D exactly (six models); (3) whether the inversion is stated unambiguously; (4) whether any hard rule of that repository (docs-as-contract, seam policy) was tripped.

---

### Phase 7.2 — Cut Wave 4 (OIDC federation) from the OAuth 2.1.280 parity plan

**File ownership**

| File                                                                               | Owning task |
| ---------------------------------------------------------------------------------- | ----------- |
| `D:\git\opencode-anthropic-fix\docs\plans\2026-09-22-oauth-2.1.280-parity-plan.md` | Task 7.2.2  |

**Parallel-safety note:** Single writer; may run concurrently with Phase 7.1 (disjoint files) but the two commits serialise in the same worktree — never stage both at once.

#### Pre-flight check

1. Correct repository; `git status --porcelain` empty (after Phase 7.1's commit if it ran first).
2. Record the plan's current structure: 6 waves, 11 phases, 11 drift rows, 11 named commits, appendices A, B, C — verify by reading the headings (`Select-String -Pattern "^## Wave|^### Phase|^## Appendix"`).
3. Enumerate every phase, task, step, drift row, commit and appendix line that belongs to Wave 4, and every cross-reference elsewhere in the document to Wave 4 or to Waves 5–6 by number.
4. Confirm the repository's Prettier/format check applies to `docs/plans/` (**RESOLVE FROM REPO**).
5. Baseline `npx vitest run` green.

#### Task 7.2.1 (CUT-MAP) [tier:fast]: Build the renumbering map

- [ ] **Step 7.2.1.1:** Produce a table: old identifier → new identifier for every wave, phase, task, step, drift row and commit affected (Wave 5→4, Wave 6→5, and their phases/tasks/steps; drift rows and commits after the removed ones shift accordingly).

#### Task 7.2.2 (CUT-APPLY) [tier:medium]: Remove and renumber

**Files:**

- Modify: `D:\git\opencode-anthropic-fix\docs\plans\2026-09-22-oauth-2.1.280-parity-plan.md`

**Why this matters:** The user decided OIDC federation is out of scope; a plan with a dangling wave or inconsistent numbering misleads the executing agent.

- [ ] **Step 7.2.2.1:** Delete Wave 4 in full (its phases, tasks, steps, drift rows, commit entries, appendix lines).
- [ ] **Step 7.2.2.2:** Apply the renumbering map to headings, step labels, cross-references, the drift table, the commit sequence and appendices A, B, C.
- [ ] **Step 7.2.2.3:** Add a dated amendment note near the top: "2026-09-23 — Wave 4 (OIDC federation) removed as out of scope by decision; waves renumbered; counts now N waves / M phases / K drift rows / K commits" with the real counts computed after the edit (do not invent them).
- [ ] **Step 7.2.2.4:** Verify: `Select-String -Path <file> -Pattern "OIDC|federation|Wave 6"` returns only the amendment note; the sequence of wave/phase/commit numbers is contiguous.
- [ ] **Step 7.2.2.5:** Format check if applicable; `npx vitest run` green; `git add` the absolute path; `git commit -s -m "docs(plans): drop oidc federation wave from oauth 2.1.280 parity plan"`.

#### New tests

None. Edge cases verified by grep: no orphan cross-reference; no duplicate numbers; the amendment's counts equal the actual heading counts.

#### Acceptance criteria

- Zero references to the removed wave outside the amendment; numbering contiguous; suite green.

#### Definition of Done

- Commit S2 present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** repository format check (if any); `npx vitest run`.

**Review brief:** Attack: (1) every renumbered cross-reference — pick five at random and trace them; (2) whether any drift row or commit that belonged to Wave 4 survived under a new number; (3) whether the amendment's counts are real.

---

### Phase 7.3 — Document per-turn effort in `D:\git\opencode-model-router`

**File ownership**

| File                                                                                                      | Owning task |
| --------------------------------------------------------------------------------------------------------- | ----------- |
| `D:\git\opencode-model-router\docs\PER_TURN_EFFORT.md`                                                    | Task 7.3.2  |
| `D:\git\opencode-model-router\docs\CONFIG_REFERENCE.md` (cross-reference in the known-issue section only) | Task 7.3.2  |

**Parallel-safety note:** Single writer.

#### Pre-flight check

1. Correct repository: `git -C "D:\git\opencode-model-router" rev-parse --show-toplevel` → `D:/git/opencode-model-router`; `git status --porcelain` empty.
2. Baseline `npx vitest run` green (golden snapshots current; do not regenerate).
3. Quote the known-issue paragraph in `D:\git\opencode-model-router\docs\CONFIG_REFERENCE.md` about `buildAgentOptions` emitting `budget_tokens` and `reasoning_effort` / `reasoning_summary` without a provider gate, and the `anthropic` preset's `@medium` → `claude-opus-5-5` mapping in `D:\git\opencode-model-router\tiers.json`.
4. Confirm `D:\git\opencode-model-router\test\unit\docs-drift.test.ts` scope: README prompt-size figures and `tiers.json` top-level keys ↔ CONFIG_REFERENCE — a new doc and a cross-reference do not affect either.
5. Confirm there is no `AGENTS.md`, `CLAUDE.md` or `.opencode/` instruction Markdown to follow; Conventional Commits with lowercase subject apply.

#### Task 7.3.1 (PTE-CONTEXT) [tier:fast]: Gather the relevant source facts

- [ ] **Step 7.3.1.1:** Quote `D:\git\opencode-model-router\src\router\config.ts:41` (`EFFORT_LEVELS`) and `:81-105` (`TierConfig`), `D:\git\opencode-model-router\src\router\protocol.ts:149-154` (`isClaudeModel`) (pre-port line reference; locate by symbol), and the `buildAgentOptions` emission sites in `D:\git\opencode-model-router\src\router\agent-options.ts`.

#### Task 7.3.2 (PTE-DOC) [tier:medium]: Write the document

**Files:** as in the ownership table.

**Why this matters:** The router maps tiers to models and emits effort/thinking options; 2.1.280 introduces per-turn effort on the wire and a default model (`claude-opus-5-5`) that rejects what the router emits today.

- [ ] **Step 7.3.2.1:** Content: upstream `api_system` messages carry their own `outputConfig` object holding `effort` and `timing`, so effort can change mid-conversation without invalidating the prompt-cache prefix; `per_turn_effort` is declared by `claude-opus-5-5` and `claude-fable-5-1`; `per_turn_timing` by `claude-opus-5-5`, `claude-fable-5-1` and `claude-mythos-5-1`; `per-turn-control-2026-07-01` is emitted on the default path while `timing-2026-09-09` is environment-gated off; `claude-opus-5-5` rejects a manual thinking budget with HTTP 400 and rejects `tool_choice` values `any` and `tool`; the bundled `anthropic` preset points `@medium` at `claude-opus-5-5`, and `buildAgentOptions` emits `budget_tokens` and `reasoning_effort` / `reasoning_summary` without a provider gate (already a known issue in `D:\git\opencode-model-router\docs\CONFIG_REFERENCE.md`) — state the concrete consequence (HTTP 400 on the default `@medium` tier under that preset) and that a code change is out of scope for this documentation task and recommended as a follow-up; evidence pointer to the analysis document (search `per-turn-control-2026-07-01`).
- [ ] **Step 7.3.2.2:** Add a one-line cross-reference from the known-issue paragraph in `D:\git\opencode-model-router\docs\CONFIG_REFERENCE.md` to the new doc; do not alter any `tiers.json` key mention (docs-drift test).
- [ ] **Step 7.3.2.3:** `npx vitest run` green without `-u`; `git add` both absolute paths; `git commit -s -m "docs: document per-turn effort and timing for claude code 2.1.280"`.

#### New tests

None. Edge case: `docs-drift.test.ts` must remain green without regenerating snapshots — verified by running without `-u`.

#### Acceptance criteria

- Doc present and cross-referenced; suite green; no snapshot regeneration; no code change.

#### Definition of Done

- Commit S3 present; QA review returned zero open findings.

#### Senior QA review (`@medium` checklist, adversarial brief)

**Gates run in this phase:** `npx vitest run` in `D:\git\opencode-model-router`.

**Review brief:** Attack: (1) whether the doc's model lists match Appendix D exactly (`per_turn_effort`: two models; `per_turn_timing`: three); (2) whether the consequence for the `anthropic` preset is stated as fact only where the plan's evidence supports it (HTTP 400 on manual budget; `tool_choice` `any`/`tool` rejection) and as recommendation elsewhere; (3) whether the cross-reference could trip docs-drift.

---

## Global acceptance criteria

1. All exit criteria in the preamble are met.
2. `GATE-WAVE` green at the final commit of `D:\git\claude-code-wire-compat`; `npm run test:pack` shows 2.1.195 = `6b9609b29463c890544845dd94acf560206b6f8165538faafd8886750037d277`, 2.1.233 = `4e06af42310d63549a4fa9af60ff0c9b13e95d7864624c6b7bf94d45ce9a3997`, and the 2.1.280 digest identical in node, bun and workerd.
3. The 14-identifier literal test, the thinking-display-updates edge tests, the capability tests, the registry and profile known-answer tests, the registration test, the default-profile test, the differential cases and the fingerprint vectors all pass.
4. `D:\git\claude-code-wire-compat\test\governance\version-dispatch.test.ts` green: no `profile.id` comparison outside `D:\git\claude-code-wire-compat\src\profile-behaviors.ts`.
5. Every commit in Appendix C exists, in order, signed off, with its stated scope; `git log --oneline <base>..HEAD` contains, in order, the commits of Appendix C (conditional commits noted). Extra `fix(<scope>)` commits from QA triage are expected and do not violate this criterion.
6. Sibling repositories: S1, S2, S3 committed; their suites green with coverage floors met; no snapshots regenerated in `D:\git\opencode-model-router`.
7. No `ReadonlyArray`, no `as any`, no `@ts-ignore`, no `@ts-expect-error`, no two-argument `expect`, no `toThrowError`, no empty catch, no skipped test anywhere in the diff.

## Global definition of done

- Every phase's Definition of Done is met, every per-phase QA returned zero open findings, and the global QA below returned zero open findings.
- The worktrees of all three repositories are clean; the primary branch `port/claude-code-2.1.280` is ready for a PR to `main` (the PR itself and the GitHub release are human actions outside this plan).

## Global senior QA review (`@heavy`, adversarial)

**Dispatch contents:** `git log --oneline <base>..HEAD` and `git diff --stat <base>..HEAD` for the primary repository; the full diff of `D:\git\claude-code-wire-compat\src\betas.ts`, `D:\git\claude-code-wire-compat\src\thinking.ts`, `D:\git\claude-code-wire-compat\src\request-body.ts`, `D:\git\claude-code-wire-compat\src\model-capabilities.ts`, `D:\git\claude-code-wire-compat\src\contracts.ts`; the default-path fixture bytes; the `GATE-WAVE` outputs; the three sibling diffs; the analysis-document excerpts for the registry, catalogue, guards and thinking object.

**Review brief:** Attack the port end to end as if you were the genuine client's maintainer looking for a tell:

1. Byte tells — for the default-path scenario and for every fixture scenario, is there any header or body byte the genuine 2.1.280 client would not send (extra beta, wrong order, `display` present when the caller supplied one, `redact-thinking` surviving, `context-1m` present for a native-1M model, `output_config.effort` presence/value versus the analysis document)?
2. Older-profile safety — enumerate every changed line in `src/` and argue, per line, why a 2.1.233 and a 2.1.195 request cannot change; then confirm with the frozen digests.
3. Evidence fidelity — spot-check ten random registry headers, five catalogue rows and all eleven policy booleans against the analysis document.
4. Governance — is any closed literal (exports, runtime export list, `REFERENCE_IDENTIFIERS`, baseline table, `manifest.models`, package version, CHANGELOG heading) inconsistent with the code?
5. Process — is the default switch exactly one `src/` line; is the pack-policy fix the first commit; is every commit signed off and single-concern; was `git add -A` ever used (inspect for unintended files)?
6. Documentation honesty — do README, AGENTS.md, MEMORY.md, CHANGELOG and the sibling docs make any claim the evidence does not support (in particular the `lean_prompt` text delta and the 2.1.233 `cacheDiagnosisEnabled` question)?

Every finding is fixed as a new commit by `[tier:medium]` and re-reviewed until zero findings remain.

---

## Risks and mitigations

| Risk                                                                                                                                                                                               | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The two frozen cross-runtime digests move** (2.1.195 `6b9609b2…7277`, 2.1.233 `4e06af42…3997`). Any mechanism change that is not perfectly inert for the older registries/catalogues moves them. | Every new `ComposableBetaRegistry` key is optional and its push site is inert when the resolved registry lacks the key; the two new capability strings are absent from both older catalogues (verified in Phase 3.1 pre-flight and by a looping unit test); `display: "updates"` is emitted only when the `THINKING_DISPLAY_UPDATES` site fires; `npm run test:pack` is run at every phase of Waves 2–4 and at every wave end; the digest literals are never edited; a moved digest is a blocking problem (directive 1b), never a literal update.                                                                                                                                                                                                                                           |
| Transcription error in the registry or catalogue                                                                                                                                                   | Two independent transcriptions (source file and test literal) from the analysis document; per-phase adversarial review comparing against quoted excerpts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Clear-at key spelled differently in the registry file and in `ComposableBetaRegistry` (silently inert)                                                                                             | Task 1.1.1.6 records the key; Phase 3.2 QA checks character-for-character; the 14-identifier test fails if the site is inert.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| The seal refuses (CI env, untracked golden files, modified tracked files outside targets)                                                                                                          | Phase 5.1's serialised procedure: stage fixtures + manifest → clear `CI` → seal → then edit the baseline doc → one commit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `profile-coverage.test.ts` iterates `ACCEPTED_PROFILES` (contingency)                                                                                                                              | Settled by Wave 0 pre-flight fact (i). If hand-maintained, the list edit joins Phase 5.1 with the fixtures and this contingency does not arise. If derived from the registered set, C5 carries ONE mechanism-inert golden fixture — a model declaring neither `per_turn_effort` nor `mid_conv_tool_change`, no thinking, `MID_CONVERSATION_SYSTEM` not firing — whose bytes are provably final at C5 because every new guard is false from catalogue data alone; it is never resealed, and its baseline evidence row and `manifest.models` entry land in C5 too. The earlier "two temporary local commits squashed" device is WITHDRAWN: it produced an intermediate-bytes fixture that directive 5 forbids and that would turn C8 and C9 red through the seal and the differential replay. |
| Analysis document silent on `output_config.effort` for `claude-opus-5-5` or on the enabled-path thinking key order                                                                                 | Stop condition (a): the `output_config.effort` question is checked and raised at the **Phase 4.1 pre-flight** (item 6), because the body it governs is frozen into the digest at C10; the enabled-path thinking key order is raised in Phase 3.3. Never guess.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| bun or workerd unavailable on the executing machine                                                                                                                                                | Stop condition (b) at Wave 0 pre-flight.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Consumers constructing `ClaudeCodeCapabilities` break on the two new required booleans                                                                                                             | CHANGELOG Breaking entry with the field names (Phase 6.2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## Appendix A — Known pre-existing repository state and uncommitted work

- `D:\git\claude-code-wire-compat` at `package.json` `0.5.0`; `D:\git\claude-code-wire-compat\CHANGELOG.md` first heading `## [0.5.0] - 2026-08-16`.
- Existing profiles: `D:\git\claude-code-wire-compat\src\profiles\claude-code-2.1.195.ts`, `D:\git\claude-code-wire-compat\src\profiles\claude-code-2.1.233.ts`, `D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.233.ts`; 2.1.195 registry in `D:\git\claude-code-wire-compat\src\beta-registry.ts` (28 keys, no `PER_MESSAGE_EFFORT`).
- `D:\git\claude-code-wire-compat\src\build-request.ts:339-342` `ACCEPTED_PROFILES` = {2.1.195, 2.1.233}; `:354-355` `DEFAULT_PROFILE = CLAUDE_CODE_2_1_233_PROFILE` (pre-port line reference; locate by symbol).
- `D:\git\claude-code-wire-compat\src\betas.ts` 302 lines; `ComposableBetaRegistry :53-70` (17 keys; `NARRATION_SUMMARIES?` optional); `PROFILE_BETA_REGISTRIES :72-76`; `resolveBetaRegistry :88-92` (falls back to 2.1.195); `ComposeBetasInput :94-121`; `ComposedBetas :129-132`; 17 push sites; `additionalBetas` merge `:273-277`; `suppressBetas` last (pre-port line reference; locate by symbol).
- `D:\git\claude-code-wire-compat\src\model-capabilities.ts:346-353` six mappings; `:365-385` derivation. `D:\git\claude-code-wire-compat\src\contracts.ts:662-672` nine booleans; `:674-687` eleven policy booleans; `:27-53` catalogue entry; `:1108-1136` profile; `:3-4` `ThinkingDisplay` re-export. `D:\git\claude-code-wire-compat\src\thinking.ts:51` type; `:306-332` emission. `D:\git\claude-code-wire-compat\src\request-body.ts:1871-1878` `output_config.effort`; `:1903-1909` tool-choice demotion. (All line numbers in this bullet: pre-port line reference; locate by symbol.)
- **Uncommitted, verified:** `D:\git\claude-code-wire-compat\test\pack\pack-policy.test.ts` (npm-12 shape fix; 2 tests pass; typecheck and format clean) — becomes commit C0.
- **Untracked draft, not trusted until verified:** `D:\git\claude-code-wire-compat\src\profiles\beta-registry-2.1.280.ts` (~280 lines; 40 entries; nulls documented; internal members excluded; three auxiliary sets) — Phase 1.1.
- **Complete and accepted evidence:** `D:\git\claude-code-wire-compat\docs\protocol\versions\claude-code-2.1.280-analysis.md` (2,385 lines; four reviews; registered in `D:\git\claude-code-wire-compat\test\docs\provenance.test.ts`, `D:\git\claude-code-wire-compat\README.md`, `D:\git\claude-code-wire-compat\docs\protocol\versions\README.md`; `npx vitest run test/docs test/governance` → 17 files / 408 tests). Commit state verified in Wave 0.
- Frozen digests: 2.1.195 `6b9609b29463c890544845dd94acf560206b6f8165538faafd8886750037d277`; 2.1.233 `4e06af42310d63549a4fa9af60ff0c9b13e95d7864624c6b7bf94d45ce9a3997`.
- Known fingerprint vectors: 2.1.195 → `offline cch probe`=`7fe`, `hello wire compat`=`0f6`, `canary probe`=`12f`; 2.1.233 → `365`, `413`, `cea`.
- Coverage thresholds in `D:\git\claude-code-wire-compat\vitest.config.ts` sit just below 99.04 / 98.8 / 100 / 99.69.
- `D:\git\opencode-anthropic-fix`: `.mjs` + JSDoc only; single seam `D:\git\opencode-anthropic-fix\lib\mimicry\wire-compat.mjs`; vitest 4.0.18; coverage floors as stated; parity plan `D:\git\opencode-anthropic-fix\docs\plans\2026-09-22-oauth-2.1.280-parity-plan.md` (6 waves / 11 phases / 11 drift rows / 11 commits / appendices A–C).
- `D:\git\opencode-model-router`: TS ESM, no build; `D:\git\opencode-model-router\src\router\agent-options.ts` (147 lines), `D:\git\opencode-model-router\src\router\config.ts` (`EFFORT_LEVELS` :41, `TierConfig` :81-105), `D:\git\opencode-model-router\src\router\protocol.ts` (`isClaudeModel` :149-154) (pre-port line reference; locate by symbol), `D:\git\opencode-model-router\tiers.json`, `D:\git\opencode-model-router\docs\CONFIG_REFERENCE.md`, `D:\git\opencode-model-router\test\unit\docs-drift.test.ts`.

## Appendix B — Parallelism map

| Phase | May run concurrently with     | Must serialise after | Shared-file hazards                                                                                        |
| ----- | ----------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0.1   | 7.1–7.3 (different worktrees) | —                    | —                                                                                                          |
| 1.1   | 7.1–7.3 (different worktrees) | 0.1                  | none                                                                                                       |
| 1.2   | 7.1–7.3 (different worktrees) | 1.1                  | `contracts.ts` only if widened (no other Wave 1 writer)                                                    |
| 2.1   | 7.1–7.3 (different worktrees) | 1.1, 1.2             | internal tasks disjoint; 2.1.6 after the registration commit                                               |
| 3.1   | 7.1–7.3 (different worktrees) | 2.1                  | constructor sites may include `test/conformance/reference-adapter.ts` and `test/support/profile-matrix.ts` |
| 3.2   | 7.1–7.3 (different worktrees) | 3.1                  | `betas.ts`, `request-body.ts`                                                                              |
| 3.3   | 7.1–7.3 (different worktrees) | 3.2                  | `betas.ts`, `thinking.ts`, `request-body.ts`, `contracts.ts`                                               |
| 4.1   | 7.1–7.3 (different worktrees) | 3.3                  | —                                                                                                          |
| 4.2   | 7.1–7.3 (different worktrees) | 4.1                  | strictly serial internally                                                                                 |
| 5.1   | 7.1–7.3 (different worktrees) | 4.2                  | seal refusal conditions                                                                                    |
| 5.2   | 7.1–7.3 (different worktrees) | 5.1                  | —                                                                                                          |
| 5.3   | 7.1–7.3 (different worktrees) | 5.2                  | —                                                                                                          |
| 5.4   | 7.1–7.3 (different worktrees) | 5.3                  | must not touch `AGENTS.md` (6.1 owns it)                                                                   |
| 5.5   | 7.1–7.3 (different worktrees) | 5.3, 5.4             | `MEMORY.md` (6.1 waits)                                                                                    |
| 6.1   | 7.1–7.3 (different worktrees) | 5.5                  | `MEMORY.md`, `AGENTS.md`, `README.md`                                                                      |
| 6.2   | 7.1–7.3 (different worktrees) | 6.1                  | `package.json`                                                                                             |
| 7.1   | Waves 0–6, 7.3                | —                    | same worktree as 7.2: stage/commit one at a time                                                           |
| 7.2   | Waves 0–6, 7.3                | 7.1                  | same worktree as 7.1                                                                                       |
| 7.3   | everything                    | —                    | —                                                                                                          |

Concurrency in this plan means different git worktrees, never different tasks in one worktree. Two writing tasks in one worktree share an index, a `git status` and a gate run; directive 4 and the repository rule both forbid it, and every phase pre-flight requires a clean worktree, which an in-flight sibling task makes unsatisfiable.

Intra-phase parallel tasks are listed in each phase's parallel-safety note. QA reviews are serial per phase and block the next dependent phase.

## Appendix C — Ordered commit sequence (Conventional Commits, all `git commit -s`)

Primary repository `D:\git\claude-code-wire-compat`, branch `port/claude-code-2.1.280`:

| #   | Subject                                                                                                                                                         | Phase |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| C0  | `test(pack): accept npm 12 keyed-object pack output in pack-policy`                                                                                             | 0.1   |
| C1  | `docs(protocol): add claude-code-2.1.280 analysis document` (only if uncommitted)                                                                               | 0.1   |
| C2  | `docs(plans): add claude-code-2.1.280 port plan`                                                                                                                | 0.1   |
| C3  | `feat(profiles): add claude-code-2.1.280 beta registry`                                                                                                         | 1.1   |
| C4  | `feat(profiles): add claude-code-2.1.280 profile and 20-model catalogue`                                                                                        | 1.2   |
| C5  | `feat(profiles): register claude-code-2.1.280 across export and acceptance seams` (plus the `docs/source-trace.md` profile row if Wave 0 fact (ii) requires it) | 2.1   |
| C6  | `docs(source-trace): record claude-code-2.1.280 divergences not ported`                                                                                         | 2.1   |
| C7  | `feat(capabilities): derive mid_conv_tool_change and per_turn_effort from the catalogue`                                                                        | 3.1   |
| C8  | `feat(betas): add per-turn, tool-change, clear-at and thinking-binding push sites`                                                                              | 3.2   |
| C9  | `feat(thinking): inject display updates beta, body field and redact-thinking removal`                                                                           | 3.3   |
| C10 | `test(pack): freeze claude-code-2.1.280 cross-runtime digest`                                                                                                   | 4.1   |
| C11 | `test: derive default-profile expectations from DEFAULT_PROFILE` (only if needed)                                                                               | 4.2   |
| C12 | `feat(build-request): default to claude-code-2.1.280` — one `src/` line                                                                                         | 4.2   |
| C13 | `test(build-request): prove unpinned requests equal pinned claude-code-2.1.280`                                                                                 | 4.2   |
| C14 | `test(fixtures): add claude-code-2.1.280 golden fixtures and reseal`                                                                                            | 5.1   |
| C15 | `test(matrix): register claude-code-2.1.280 in the profile matrix`                                                                                              | 5.2   |
| C16 | `test(conformance): add claude-code-2.1.280 reference adapter and differential cases`                                                                           | 5.3   |
| C17 | `test(fingerprint): add independently computed claude-code-2.1.280 vectors`                                                                                     | 5.4   |
| C18 | `docs(memory): record claude-code-2.1.280 behaviour-flag audit`                                                                                                 | 5.5   |
| C19 | `docs: update README, AGENTS, runbook and memory for claude-code-2.1.280`                                                                                       | 6.1   |
| C20 | `chore(release): 0.6.0`                                                                                                                                         | 6.2   |

QA-driven fixes are inserted after the commit they correct as `fix(<scope>): …` or `test(<scope>): …` with the root cause in the body; they never amend.

Sibling repositories:

| #   | Repository                      | Subject                                                                 | Phase |
| --- | ------------------------------- | ----------------------------------------------------------------------- | ----- |
| S1  | `D:\git\opencode-anthropic-fix` | `docs: document lean_prompt inversion for claude code 2.1.280`          | 7.1   |
| S2  | `D:\git\opencode-anthropic-fix` | `docs(plans): drop oidc federation wave from oauth 2.1.280 parity plan` | 7.2   |
| S3  | `D:\git\opencode-model-router`  | `docs: document per-turn effort and timing for claude code 2.1.280`     | 7.3   |

## Appendix D — Evidence cross-check tables (non-normative copies; the analysis document wins)

### D.1 Beta registry — 40 entries in upstream array order

| #   | alias                              | header                                        | status              |
| --- | ---------------------------------- | --------------------------------------------- | ------------------- |
| 1   | `claude_code`                      | `claude-code-20250219`                        | existing            |
| 2   | `oauth_auth`                       | `oauth-2025-04-20`                            | existing            |
| 3   | `interleaved_thinking`             | `interleaved-thinking-2025-05-14`             | existing            |
| 4   | `long_context`                     | `context-1m-2025-08-07`                       | existing            |
| 5   | `context_management`               | `context-management-2025-06-27`               | existing            |
| 6   | `structured_outputs`               | `structured-outputs-2025-12-15`               | existing            |
| 7   | `web_search`                       | `web-search-2025-03-05`                       | existing            |
| 8   | `tool_search`                      | `advanced-tool-use-2025-11-20`                | existing            |
| 9   | `tool_search`                      | `tool-search-tool-2025-10-19`                 | existing            |
| 10  | `effort`                           | `effort-2025-11-24`                           | existing            |
| 11  | `task_budgets`                     | `task-budgets-2026-03-13`                     | existing            |
| 12  | `prompt_caching_scope`             | `prompt-caching-scope-2026-01-05`             | existing            |
| 13  | `prompt_caching_evict`             | `prompt-caching-evict-2026-05-12`             | existing            |
| 14  | `extended_cache_ttl`               | `extended-cache-ttl-2025-04-11`               | existing            |
| 15  | `speed`                            | `fast-mode-2026-02-01`                        | existing            |
| 16  | `redact_thinking`                  | `redact-thinking-2026-02-12`                  | existing            |
| 17  | `thinking_resumption`              | `thinking-resumption-2026-07-17`              | NEW (mid-registry)  |
| 18  | `thinking_token_count`             | `thinking-token-count-2026-05-13`             | existing            |
| 19  | `afk_mode`                         | `afk-mode-2026-01-31`                         | existing            |
| 20  | `advisor_tool`                     | `advisor-tool-2026-03-01`                     | existing            |
| 21  | `cache_diagnosis`                  | `cache-diagnosis-2026-04-07`                  | existing            |
| 22  | `context_hint`                     | `context-hint-2026-04-09`                     | existing            |
| 23  | `mcp_servers`                      | `mcp-servers-2025-12-04`                      | existing            |
| 24  | `files_api`                        | `files-api-2025-04-14`                        | existing            |
| 25  | `environments`                     | `environments-2025-11-01`                     | existing            |
| 26  | `ccr_byoc`                         | `ccr-byoc-2025-07-29`                         | existing            |
| 27  | `mid_conversation_system`          | `mid-conversation-system-2026-04-07`          | existing            |
| 28  | `per_message_effort`               | `per-turn-control-2026-07-01`                 | existing            |
| 29  | `per_turn_timing`                  | `timing-2026-09-09`                           | NEW                 |
| 30  | `mid_conv_tool_change`             | `mid-conversation-tool-changes-2026-07-01`    | NEW                 |
| 31  | `inline_tools`                     | `inline-tools-2026-09-15`                     | NEW                 |
| 32  | `server_side_fallback`             | `server-side-fallback-2026-06-01`             | existing            |
| 33  | `server_side_fallback_category`    | `server-side-fallback-2026-07-01`             | existing            |
| 34  | `fallback_credit`                  | `fallback-credit-2026-06-01`                  | existing            |
| 35  | `auto_mode_classifier`             | `auto-mode-classifier-2026-07-16`             | existing            |
| 36  | `dangerous_tool_use`               | `dangerous-tool-use-2026-09-03`               | NEW                 |
| 37  | `thinking_display_updates`         | `thinking-display-updates-2026-08-18`         | NEW                 |
| 38  | `message_threads`                  | `message-threads-2026-08-12`                  | NEW                 |
| 39  | `mid_conversation_system_clear_at` | `mid-conversation-system-clear-at-2026-08-21` | NEW                 |
| 40  | `thinking_binding_controls`        | `thinking-binding-controls-2026-08-01`        | NEW (last in array) |

Null slots at 0-based indices 34 and 37 of the 42-slot literal: documented, not transcribed. Not betas, not transcribed: `x-cc-internal-mid-conv-cache-promotion`, `x-cc-internal-mid-conv-cache-promotion-ok`. `narration_summaries` absent.

Auxiliary sets: `THIRD_PARTY_ALLOWED_BETAS_2_1_280` (14): `claude-code-20250219`, `interleaved-thinking-2025-05-14`, `context-1m-2025-08-07`, `context-management-2025-06-27`, `structured-outputs-2025-12-15`, `web-search-2025-03-05`, `effort-2025-11-24`, `tool-search-tool-2025-10-19`, `afk-mode-2026-01-31`, `dangerous-tool-use-2026-09-03`, `fallback-credit-2026-06-01`, `mid-conversation-system-2026-04-07`, `thinking-token-count-2026-05-13`, `thinking-binding-controls-2026-08-01`. `BEDROCK_UNSUPPORTED_BETAS_2_1_280` (3): `interleaved-thinking-2025-05-14`, `context-1m-2025-08-07`, `tool-search-tool-2025-10-19`. `COUNT_TOKENS_BETAS_2_1_280` (4): `claude-code-20250219`, `interleaved-thinking-2025-05-14`, `context-management-2025-06-27`, `oauth-2025-04-20`.

### D.2 Profile scalars and policy

id `claude-code-2.1.280-sdk-0.112.1`; cliVersion `2.1.280`; sdkVersion `0.112.1`; endpoint `https://api.anthropic.com/v1/messages?beta=true`; countTokensEndpoint from `COUNT_TOKENS_ENDPOINT`; entrypoint `cli`; userAgent `claude-cli/2.1.280 (external, cli)`; buildTime `2026-09-21T20:40:17Z`; gitSha `80abbfe7d7232280011ff01a21ae3338f4c6e372`; attributionHeaderEnabled `true`; provider `anthropic`; anthropicVersion `2023-06-01`; contextHintEnabled `false`.

betaPolicy: oauthAuthenticated `true`; experimentalBetasEnabled `true`; oneMillionContextEnabled `true`; interleavedThinkingEnabled `true`; interactive `true`; thinkingSummariesShown `false`; thinkingTokenCountEnabled `true`; narrationSummariesEnabled `false`; structuredOutputsEnabled `false`; afkModeEnabled `false`; cacheDiagnosisEnabled `true` (flip; §7.6.2).

### D.3 Catalogue — 20 entries

| id                  | family | default/upper | default effort | context   | capabilities                                                                                                                                                                                                                                                                |
| ------------------- | ------ | ------------- | -------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude-3-5-haiku`  | haiku  | 8192/8192     | —              | none      | `[]`                                                                                                                                                                                                                                                                        |
| `claude-haiku-4-5`  | haiku  | 32000/64000   | —              | none      | `["context_management"]`                                                                                                                                                                                                                                                    |
| `claude-3-5-sonnet` | sonnet | 8192/8192     | —              | none      | `[]`                                                                                                                                                                                                                                                                        |
| `claude-3-7-sonnet` | sonnet | 32000/64000   | —              | none      | `[]`                                                                                                                                                                                                                                                                        |
| `claude-sonnet-4-0` | sonnet | 32000/64000   | —              | 200k+beta | `["context_management"]`                                                                                                                                                                                                                                                    |
| `claude-sonnet-4-5` | sonnet | 32000/64000   | —              | 200k+beta | `["context_management"]`                                                                                                                                                                                                                                                    |
| `claude-sonnet-4-6` | sonnet | 32000/128000  | —              | 200k+beta | `["effort","max_effort","adaptive_thinking","context_management"]`                                                                                                                                                                                                          |
| `claude-sonnet-5`   | sonnet | 64000/128000  | high           | 1M native | `["effort","max_effort","xhigh_effort","adaptive_thinking","mid_conv_system","context_management"]`                                                                                                                                                                         |
| `claude-opus-4-0`   | opus   | 32000/32000   | —              | none      | `["context_management"]`                                                                                                                                                                                                                                                    |
| `claude-opus-4-1`   | opus   | 32000/32000   | —              | none      | `["context_management"]`                                                                                                                                                                                                                                                    |
| `claude-opus-4-5`   | opus   | 32000/64000   | —              | none      | `["context_management"]`                                                                                                                                                                                                                                                    |
| `claude-opus-4-6`   | opus   | 64000/128000  | —              | 200k+beta | `["effort","max_effort","adaptive_thinking","context_management"]`                                                                                                                                                                                                          |
| `claude-opus-4-7`   | opus   | 64000/128000  | xhigh          | 1M native | `["effort","max_effort","xhigh_effort","adaptive_thinking","context_management"]`                                                                                                                                                                                           |
| `claude-opus-4-8`   | opus   | 64000/128000  | high           | 1M native | `["effort","max_effort","xhigh_effort","adaptive_thinking","mid_conv_system","mid_conv_tool_change","context_management","fast_mode","lean_prompt"]`                                                                                                                        |
| `claude-opus-5`     | opus   | 64000/128000  | high           | 1M native | `["effort","max_effort","xhigh_effort","adaptive_thinking","mid_conv_system","mid_conv_tool_change","context_management","thinking_disabled_effort_cap","fast_mode","lean_prompt","refusal_fallback","opus_5_prompt_bundle"]`                                               |
| `claude-opus-5-5`   | opus   | 128000/128000 | medium         | 1M native | `["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking","mid_conv_system","mid_conv_tool_change","per_turn_effort","per_turn_timing","context_management","fast_mode","lean_prompt","refusal_fallback","opus_5_5_prompt_bundle"]`            |
| `claude-fable-5`    | fable  | 64000/128000  | high           | 1M native | `["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking","mid_conv_system","mid_conv_tool_change","context_management","lean_prompt","fable_5_mitigations","refusal_fallback"]`                                                               |
| `claude-fable-5-1`  | fable  | 64000/128000  | high           | 1M native | `["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking","mid_conv_system","mid_conv_tool_change","per_turn_effort","per_turn_timing","context_management","lean_prompt","fable_5_mitigations","refusal_fallback","fable_5_1_prompt_bundle"]` |
| `claude-mythos-5`   | mythos | 64000/128000  | —              | 1M native | `[]` (deliberate denial)                                                                                                                                                                                                                                                    |
| `claude-mythos-5-1` | mythos | 64000/128000  | high           | 1M native | `["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking","mid_conv_system","mid_conv_tool_change","per_turn_timing","context_management","lean_prompt","fable_5_mitigations","fable_5_1_prompt_bundle"]`                                      |

Context column: "200k+beta" = `{window: 200000, supports1mBeta: true}`; "1M native" = `{window: 1000000, native1m: true, supports1mBeta: true}`; "none" = no `context` key. New versus 2.1.233: `claude-opus-5-5`, `claude-fable-5-1`, `claude-mythos-5-1`. Discard: `claude-haiku-4-5-20251001`, `claude-opus-4-1-20250805`, `claude-opus-4-5-20251101`. Unmodelled keys: `display_name`, `knowledge_cutoff`, `provider_ids`, `eager_input_streaming`, `vertex_region_env_var`, `fallback_3p`, `pricing`, `effort_cost_index`, `image_limits`, `advisor_rank`.

### D.4 Push-site additions (positions relative to the existing 17)

| Site | Key (registry file spelling is authoritative)                                                                        | Position                                               | Guard                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 11a  | `PER_MESSAGE_EFFORT?`                                                                                                | after 11 `MID_CONVERSATION_SYSTEM`, before 12 `EFFORT` | experimental and `capabilities.perTurnEffort`                                                                                 |
| 11b  | `MID_CONV_TOOL_CHANGE?`                                                                                              | after 11a                                              | site 11 fired and `capabilities.midConvToolChange`                                                                            |
| 11c  | clear-at key (`MID_CONVERSATION_SYSTEM_CLEAR_AT` by convention; labelled `MID_CONV_SYSTEM_CLEAR_AT` in the dispatch) | after 11b, before 12                                   | site 11 fired and experimental                                                                                                |
| 12a  | `THINKING_BINDING_CONTROLS?`                                                                                         | after 12 `EFFORT`, before 13 `SPEED`                   | thinking active and experimental                                                                                              |
| 12b  | `THINKING_DISPLAY_UPDATES?`                                                                                          | after 12a, before 13                                   | thinking emitted adaptive-or-enabled, experimental, no caller `thinking.display`; when it fires, `REDACT_THINKING` is removed |

### D.5 The 14-identifier default-path literal (`claude-opus-5-5`)

`claude-code-20250219`, `oauth-2025-04-20`, `interleaved-thinking-2025-05-14`, `thinking-token-count-2026-05-13`, `context-management-2025-06-27`, `prompt-caching-scope-2026-01-05`, `mid-conversation-system-2026-04-07`, `per-turn-control-2026-07-01`, `mid-conversation-tool-changes-2026-07-01`, `mid-conversation-system-clear-at-2026-08-21`, `effort-2025-11-24`, `thinking-binding-controls-2026-08-01`, `thinking-display-updates-2026-08-18`, `cache-diagnosis-2026-04-07`; body `thinking: {type: "adaptive", display: "updates"}`; `redact-thinking-2026-02-12` composed then removed, present in neither.
