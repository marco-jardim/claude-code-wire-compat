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
