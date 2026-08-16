# Blockers and critical findings

Log of critical findings encountered during plan execution, with resolution
status. Per plan §0.1, critical findings are recorded here and escalated;
execution continues only when the resolution is unambiguous.

## 2026-08-15 — C1: capability equivalence has one divergent cell (RESOLVED INLINE)

**Phase:** Wave 1, Fase 1.1 pre-flight.

**Finding:** the plan assumed the 9 predicates of `src/model-capabilities.ts`
and `supportedModels[].capabilities` in the 2.1.195 profile agree on every
cell. They do not. Exactly one cell diverges:

| id              | capability | predicate (wire-authoritative in 2.1.195)  | catalogue        |
| --------------- | ---------- | ------------------------------------------ | ---------------- |
| claude-opus-4-5 | effort     | `true` (`supportsEffort` does not exclude) | absent (`false`) |

**Analysis:** this is not a port defect. The 2.1.195 binary derives
capabilities from predicate code, and the port's predicates are faithful to
it — `claude-opus-4-5` is excluded from `max_effort` but **not** from
`effort`. The catalogue `capabilities[]` arrays are faithful data carried
alongside, dormant in 2.1.195. Upstream 2.1.222+ switches derivation to the
catalogue, which makes `effort=false` for `claude-opus-4-5` on newer
versions. The divergence is an upstream behavioral difference between
derivation methods, not a latent incoherence this repo introduced.

**Resolution (behavior-preserving, unambiguous):**

1. The 2.1.195 profile must keep emitting `effort=true` for
   `claude-opus-4-5` — Wave 1 is wire-frozen and the golden fixtures /
   `test:pack` digests prove it.
2. `capability-equivalence.test.ts` pins equivalence for every cell
   **except** a demarcated `KNOWN_DIVERGENCES` table containing exactly this
   cell, asserted in both directions (predicate `true`, catalogue absent) so
   any drift on either side fails the suite.
3. The catalogue-driven derivation introduced by T1.1.2 carries the same
   demarcated exception for the 2.1.195 profile. Profiles ported from
   2.1.222+ (where the catalogue is authoritative) must NOT inherit the
   exception.

**Also recorded during the same pre-flight:**

- `thinking`, `interleavedThinking` and `temperature` have no catalogue
  representation at all (no `capabilities[]` string exists for them). They
  remain predicate/family-derived after the refactor; only `effort`,
  `max_effort`, `xhigh_effort`, `adaptive_thinking`, `context_management`
  and `rejects_disabled_thinking` are catalogue-backed.
- `supportsStructuredOutputs` / `supportsMidConversationSystem` are
  beta-only gates outside `ClaudeCodeCapabilities`, consumed by
  `src/betas.ts` (L150-161). `mid_conv_system` exists as a catalogue string;
  `structured_outputs` does not.
- Unknown ids (including `claude-mythos-5`, `""`, and any id that escapes
  normalization such as a literal `[1m]` suffix) fall through every
  exclusion list and resolve maximally permissive (`true` everywhere except
  `temperature`, whose allowlist returns `false`). This behavior is
  preserved by the refactor.

## 2026-08-15 — W2-F1: capability derivation was pinned to one profile (RESOLVED INLINE)

**Context:** preparation of the 2.1.233 catalogue.

**Finding:** capability derivation and output-token limits still read the
2.1.195 profile unconditionally. `deriveCapabilities` and
`modelOutputTokenLimits` consulted the profile singleton rather than the
profile they were being asked about, and the active profile stopped
propagating at two boundaries:

| Boundary                              | Symptom                                    |
| ------------------------------------- | ------------------------------------------ |
| `models.ts` → `model-capabilities.ts` | derivation fell back to the pinned profile |
| `request-body.ts` → `thinking.ts`     | limits resolved against the pinned profile |

**Analysis:** with a single registered profile the defect is invisible —
the only value the singleton can return is the correct one. A second
profile makes it wire-incorrect, and the failure is silent rather than
loud: `claude-opus-4-5` would inherit the 2.1.195 `effort` exception on a
profile where the catalogue is authoritative and says otherwise; models
introduced after 2.1.195 would lose `mid_conv_system` because the older
catalogue has no entry for them; `claude-mythos-5`, catalogued from
2.1.233 onward, would keep resolving through the unknown-id path to the
maximally permissive fallback. Each of those is a request the package
would build differently from the client it claims to mimic.

**Resolution (behavior-preserving):**

1. The active profile is threaded through every derivation site as an
   explicit parameter, defaulting to `2.1.195`. The default keeps every
   existing call site meaning exactly what it meant before.
2. 2.1.195 behavior is unchanged, and that is proved rather than
   asserted: the equivalence suites were not modified and the `test:pack`
   digests are identical across the change.
3. The change is a refinement of the behavior/data separation already
   recorded for C1 — the derivation code stays behavioral, the catalogue
   stays data, and the profile is now the parameter that binds them.
   Profiles added later inherit the seam and need no further work at
   these boundaries.

## 2026-08-15 — Non-blocking observations from the 2.1.233 data port

Recorded for future maintenance; neither blocks execution.

**O1 — drift fixture mirrors duplicate the golden manifest. RESOLVED
2026-08-16 by deletion.** The seven synthetic source trees under
`test/drift/fixtures/` each carried a copy of the golden manifest's
`fixtures` map, so sealing new fixtures meant hand-updating six mirrors.
The observation is moot: the external drift verifier they served was
retired along with its suite, because the consumer project it compared
against now imports its constants from this package and the comparison had
become circular. Sealing golden fixtures no longer touches anything outside
`test/fixtures/golden/` and `docs/source-trace.md`.

**O2 — four parameterised suites cover the second profile only partially.**
`build-request-mutants`, `model-wire-identity`, `model-identity`, and
`request-body-mutants` run only a slice of their cases under the profile
matrix; the bulk of their assertions are pinned to 2.1.195 vectors by the
coupling-map classification (version-specific known vectors, e.g. billing
fingerprints). The 2.1.233 profile is instead covered by its dedicated
catalogue, beta-registry, fixture, differential, and threading suites plus
the per-profile coverage floor. Version-specific vectors for 2.1.233
(fingerprint, billing block) arrive with the divergence-semantics work.
