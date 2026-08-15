# Profile coupling map

Complete inventory of every place in the repository that references the
`2.1.195` upstream profile, classified by what the reference means for a future
multi-profile codebase. This is the authoritative input for the
architecture-generalization work: the "code coupling" list below is the set of
files that must stop assuming a single profile.

- **Captured at commit:** `6c2505607dc5fb65678c1cb776aa3b3eda92751e`
- **Method:** `rg -n "2\.1\.195|2_1_195"` over the whole tree (excluding
  `docs/plans/`, `node_modules/`, `coverage/`, `*.tgz`), plus targeted passes
  for `claude-code-2.1.195`, `CLAUDE_CODE_2_1_195_PROFILE`, `0.94.0`, partial
  patterns (`2.1.`, `claude-code-2`) to catch string concatenation, and a review
  of `package.json` exports and import paths.
- **Raw listing:** the complete, unfiltered `rg` output (275 occurrences across
  74 files) is reproduced verbatim in the [appendix](#appendix--raw-rg-listing).

## Classification

| Class         | Meaning                                                                                                                                           | Occurrences |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `DADO`        | The version value inside the profile data file itself — correct and expected                                                                      | 4           |
| `ACOPLAMENTO` | Code/test/script/config that assumes a single profile, references the profile by literal path/name, or would break when a second profile is added | 212         |
| `DOC`         | Prose/documentation                                                                                                                               | 59          |
| **Total**     |                                                                                                                                                   | **275**     |

No occurrences in `.github/`. No string-concatenation construction of the
profile name was found (the partial-pattern passes returned only the literal
occurrences already listed; the single partial-pattern hit
`src/beta-registry.ts:20` `"claude-code-20250219"` is a beta header name, not a
profile reference — false positive, excluded).

## DADO — profile data (correct, stays)

| File                                  | Lines          | Notes                                                                  |
| ------------------------------------- | -------------- | ---------------------------------------------------------------------- |
| `src/profiles/claude-code-2.1.195.ts` | 18, 19, 20, 24 | `id`, `cliVersion`, `sdkVersion`, `userAgent` — the profile's own data |

## ACOPLAMENTO — production code, scripts, packaging

These are the files the generalization wave must change. Every entry either
imports the profile singleton, compares against it by identity, or hardcodes
its name/path.

| File                       | Lines                                    | Coupling mechanism                                                                                                                                                     |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`             | 33–36                                    | `exports["./profiles/claude-code-2.1.195"]` — subpath export named after the profile; a second profile requires a new manual entry                                     |
| `src/index.ts`             | 62                                       | `export { CLAUDE_CODE_2_1_195_PROFILE }` — single named export                                                                                                         |
| `src/build-request.ts`     | 31, 969, 970, 984, 985, 1292, 1387, 1559 | Import + **line 319: identity rejection `profile !== CLAUDE_CODE_2_1_195_PROFILE` → fail** (the central fail-closed gate); JSDoc mentions at 858, 1380, 1552 are prose |
| `src/headers.ts`           | 9, 164, 167                              | Identity comparison against the singleton                                                                                                                              |
| `src/betas.ts`             | 13, 100, 107                             | Import + default parameter `= CLAUDE_CODE_2_1_195_PROFILE`                                                                                                             |
| `src/anti-verbosity.ts`    | 10, 182, 197                             | Import + default parameter                                                                                                                                             |
| `src/fingerprint.ts`       | 5, 79                                    | Import + direct destructuring of the singleton                                                                                                                         |
| `src/models.ts`            | 15                                       | Import                                                                                                                                                                 |
| `src/request-body.ts`      | 3                                        | Import                                                                                                                                                                 |
| `src/redaction.ts`         | 288                                      | `profileId !== "claude-code-2.1.195-sdk-0.94.0"` — **raw string literal**, does not even use the constant; most fragile site                                           |
| `scripts/verify-drift.mjs` | 20                                       | `"claude-code-2.1.195.ts"` in a hardcoded array of monitored files                                                                                                     |

## ACOPLAMENTO — test suites

Classified for the suite-parameterization work:

- `PARAMETRIZÁVEL` — the assertion would hold for any profile if it received
  the profile as a parameter;
- `ESPECÍFICA` — the assertion is about the concrete data of the 195 profile
  (golden values, known vectors) and must stay pinned to it;
- `MISTA` — file contains both kinds.

| File                                                   | Lines                          | Class          | Notes                                                                                                                       |
| ------------------------------------------------------ | ------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `test/betas.test.ts`                                   | 8, 16, 35, 37                  | PARAMETRIZÁVEL | `composeBetas` takes the profile as input                                                                                   |
| `test/conformance/differential.test.ts`                | 6, 42, 111                     | ESPECÍFICA     | Differential conformance against 195 fixtures                                                                               |
| `test/docs/provenance.test.ts`                         | 128–129                        | ESPECÍFICA     | Hardcoded path map to `versions/claude-code-2.1.195-analysis.md`                                                            |
| `test/drift/verify-drift.test.ts`                      | 32, 83, 105                    | ESPECÍFICA     | Exercises the drift script's hardcoded profile list                                                                         |
| `test/fingerprint.test.ts`                             | 32                             | ESPECÍFICA     | `const CLI_VERSION = "2.1.195"` — known-vector input                                                                        |
| `test/golden-fixtures.test.ts`                         | 8                              | ESPECÍFICA     | `PROFILE_ID` literal; golden fixtures are per-profile by nature                                                             |
| `test/headers.test.ts`                                 | 12, 70, 100                    | PARAMETRIZÁVEL | Profile passed as config to `buildHeaders`                                                                                  |
| `test/model-capability-regression.test.ts`             | 4, 11, 13, 17, 19, 23          | ESPECÍFICA     | Builds mutants by spreading concrete 195 model entries                                                                      |
| `test/model-capability-wire.test.ts`                   | 7, 83                          | PARAMETRIZÁVEL | Capability wire-identity logic is profile-generic                                                                           |
| `test/models.test.ts`                                  | 16, 46, 56, 325, 329, 332      | MISTA          | Iteration over `supportedModels` is generic; round-trip is bound to the imported symbol                                     |
| `test/profile.test.ts`                                 | 20 occurrences                 | MISTA          | See breakdown below — the file most in need of restructuring                                                                |
| `test/property/request-invariants.test.ts`             | 7, 239                         | PARAMETRIZÁVEL | Property-based invariants iterate `supportedModels`                                                                         |
| `test/redaction.test.ts`                               | 20, 104                        | PARAMETRIZÁVEL | Profile as input config                                                                                                     |
| `test/request-body.test.ts`                            | 12, 63, 107                    | ESPECÍFICA     | Indexes `supportedModels` by concrete 195 model ids                                                                         |
| `test/runtime/runtime-neutral.test.ts`                 | 45, 66, 104                    | ESPECÍFICA     | Hardcodes `"2.1.195"` in fingerprint material; line 66 asserts the exported **symbol name** as a string                     |
| `test/security/core-adversarial.test.ts`               | 18, 80                         | PARAMETRIZÁVEL | Profile as adversarial input config                                                                                         |
| `test/types/public-input-contract.test.ts`             | 6, 30, 62, 91                  | PARAMETRIZÁVEL | Type-contract tests pass the profile as an argument                                                                         |
| `test/governance/package-policy.test.ts`               | 82–84                          | ESPECÍFICA     | Re-asserts the literal `exports` block incl. the profile subpath                                                            |
| `test/governance/provider-scope.test.ts`               | 237, 260                       | ESPECÍFICA     | Reads `profiles/claude-code-2.1.195.ts` by literal path                                                                     |
| `test/validation/anti-verbosity.test.ts`               | 6, 18, 23, 25                  | ESPECÍFICA     | Concrete model indexing                                                                                                     |
| `test/validation/betas.test.ts`                        | 9, 33, 37, 52, 54              | PARAMETRIZÁVEL | `composeBetas` with profile parameter                                                                                       |
| `test/validation/build-request.test.ts`                | 16, 90, 95, 216, 421           | ESPECÍFICA     | Lines 90/95 build the billing line with `2.1.195` in the hash material — known vector                                       |
| `test/validation/build-request-mutants.test.ts`        | 5 occurrences (incl. 867)      | PARAMETRIZÁVEL | Mutation mechanics via profile spread are generic                                                                           |
| `test/validation/count-tokens.test.ts`                 | 9, 160                         | PARAMETRIZÁVEL | Generic `betaPolicy` spread                                                                                                 |
| `test/validation/experimental-body-fields.test.ts`     | 10, 14                         | ESPECÍFICA     | Concrete `MODEL_DEFINITION` from the 195 catalogue                                                                          |
| `test/validation/extra-header-policy.test.ts`          | 29, 124, 244                   | MISTA          | 124 profile-as-config (param); 244 asserts concrete `userAgent` (spec)                                                      |
| `test/validation/fingerprint.test.ts`                  | 7                              | ESPECÍFICA     | `CLI_VERSION = "2.1.195"`                                                                                                   |
| `test/validation/fingerprint-crypto.test.ts`           | 26, 68, 73, 90                 | ESPECÍFICA     | Cryptographic known vectors with `"2.1.195"` as literal hash input                                                          |
| `test/validation/header-mutants.test.ts`               | 6, 27                          | PARAMETRIZÁVEL | Profile as mutation-test config                                                                                             |
| `test/validation/headers.test.ts`                      | 7, 24, 82                      | PARAMETRIZÁVEL | Profile as config                                                                                                           |
| `test/validation/metadata-contract-expansion.test.ts`  | 8, 13, 50                      | ESPECÍFICA     | Concrete `MODEL_DEFINITION`                                                                                                 |
| `test/validation/metadata-headers-mutants.test.ts`     | 6 occurrences (incl. 320)      | ESPECÍFICA     | Hardcoded header value with profile version                                                                                 |
| `test/validation/model-identity.test.ts`               | 12, 101, 166                   | PARAMETRIZÁVEL | Iterates `supportedModels`                                                                                                  |
| `test/validation/model-wire-identity.test.ts`          | 8, 41                          | PARAMETRIZÁVEL | Iterates `supportedModels`                                                                                                  |
| `test/validation/profile-override.test.ts`             | 9 occurrences (incl. 113, 160) | MISTA          | Override/spread mechanics are generic; `userAgent` literals are specific. Closest existing pattern to multi-profile testing |
| `test/validation/redaction.test.ts`                    | 4 occurrences                  | MISTA          | `{...PROFILE, id:"wrong-profile"}` rejection pattern is reusable; base is the fixed constant                                |
| `test/validation/redaction-mutants.test.ts`            | 21, 94 + 6 more                | PARAMETRIZÁVEL | Mutation via spread                                                                                                         |
| `test/validation/request-body.test.ts`                 | 3 occurrences                  | ESPECÍFICA     | Concrete `MODEL_DEFINITION`                                                                                                 |
| `test/validation/request-body-mutants.test.ts`         | 8 occurrences                  | PARAMETRIZÁVEL | Mutation via spread                                                                                                         |
| `test/validation/tool-definitions.test.ts`             | 2 occurrences                  | ESPECÍFICA     | Concrete `MODEL_DEFINITION`                                                                                                 |
| `test/validation/top-level-contract-expansion.test.ts` | 5 occurrences                  | MISTA          | Default-param usage (param) + concrete `MODEL_DEFINITION` (spec)                                                            |
| `test/validation/unknown-nested-properties.test.ts`    | 2 occurrences                  | PARAMETRIZÁVEL | Profile as contract fixture                                                                                                 |

### `test/profile.test.ts` breakdown (20 occurrences)

The file is "the 195 profile's own test"; in a multi-profile world it becomes a
per-profile parameterized suite with the specific assertions moved to
per-profile expectation fixtures.

| Lines              | Class          | Notes                                                                         |
| ------------------ | -------------- | ----------------------------------------------------------------------------- |
| 5, 136, 138        | ESPECÍFICA     | Import + `toMatchObject` on the whole 195 object                              |
| 139, 140, 144      | ESPECÍFICA     | Literal `id`, `cliVersion`, `userAgent` golden values                         |
| 151, 156, 157      | ESPECÍFICA     | Concrete design values (`endpoint` `?beta=true`, `contextHintEnabled: false`) |
| 163                | ESPECÍFICA     | `Object.keys(supportedModels)` equals the fixed 14-model list                 |
| 181, 192, 196      | PARAMETRIZÁVEL | Generic per-model shape validation                                            |
| 206, 209, 216, 224 | PARAMETRIZÁVEL | Structural tests (freezing, JSON redaction)                                   |
| 218, 219           | ESPECÍFICA     | Re-asserts the literal id after mutation attempt                              |
| 225                | ESPECÍFICA     | `contextHintEnabled` concrete value                                           |

### Test-support data (fixtures)

| File                                                                                                                                   | Lines | Notes                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `test/fixtures/golden/outgoing-foreground.json`                                                                                        | 4, 23 | Golden wire capture — per-profile by nature; new profiles get **new** fixtures, these stay                |
| `test/fixtures/golden/outgoing-canary-context-hint-off.json`                                                                           | 4, 23 | Same                                                                                                      |
| `test/fixtures/golden/decision-context-hint-rejected.json`                                                                             | 4     | Same                                                                                                      |
| `test/drift/fixtures/{valid,golden-hash,cli-version,billing-prefix,endpoint,unknown-beta,header-name}/lib/request-headers.mjs.fixture` | 1, 3  | Synthetic upstream trees for the drift script tests (`FALLBACK_CLAUDE_CLI_VERSION`, `CLI_TO_SDK_VERSION`) |

## DOC — prose (no code impact)

| File                                                                            | Occurrences                     |
| ------------------------------------------------------------------------------- | ------------------------------- |
| `CHANGELOG.md`                                                                  | 2                               |
| `README.md`                                                                     | 2                               |
| `docs/ATTRIBUTION.md`                                                           | 1                               |
| `docs/protocol/beta-decision-table.md`                                          | 1                               |
| `docs/protocol/http-headers-and-system-prompt.md`                               | 20                              |
| `docs/protocol/reverse-engineering.md`                                          | 16                              |
| `docs/protocol/versions/README.md`                                              | 1                               |
| `docs/protocol/versions/claude-code-2.1.195-analysis.md`                        | 17                              |
| `docs/source-trace.md`                                                          | 9                               |
| JSDoc comments in `src/` (`build-request.ts:858,1380,1552`, `contracts.ts:623`) | counted under their files above |

## Definitive generalization list

Files that must be generalized so a second profile can exist (production
surface — the architecture wave):

1. `src/build-request.ts` — replace the line-319 single-instance identity gate
   with a registry of accepted profiles
2. `src/headers.ts` — same identity-comparison pattern
3. `src/redaction.ts` — replace the raw string literal at line 288
4. `src/betas.ts`, `src/anti-verbosity.ts` — default-parameter singletons
5. `src/fingerprint.ts` — destructures the singleton directly
6. `src/models.ts`, `src/request-body.ts`, `src/index.ts` — import/export
   surface (additive)
7. `package.json` — `exports` subpath per profile (additive)
8. `scripts/verify-drift.mjs` — hardcoded monitored-file list → `--profile`
   parameter
9. `test/governance/provider-scope.test.ts` — literal profile path → iterate
   all profiles
10. `test/governance/package-policy.test.ts` — exports assertion must cover
    every profile subpath

Test suites to parameterize (suite-parameterization wave input): every file
marked `PARAMETRIZÁVEL` or `MISTA` above. Files marked `ESPECÍFICA` stay pinned
to the 195 profile by design; new profiles receive their own equivalents
(fixtures, known vectors, analysis docs).

## Appendix — raw rg listing

Complete output of
`rg -n "2\.1\.195|2_1_195" --glob "!docs/plans/**" --glob "!node_modules/**" --glob "!coverage/**" --glob "!*.tgz"`
at the baseline commit (275 lines):

```
CHANGELOG.md:664:- Pinned `claude-code-2.1.195-sdk-0.94.0` protocol profile, exported from the
CHANGELOG.md:665:  `./profiles/claude-code-2.1.195` subpath, with context hint disabled by default and a fail-closed
package.json:33:    "./profiles/claude-code-2.1.195": {
package.json:34:      "types": "./dist/profiles/claude-code-2.1.195.d.ts",
package.json:35:      "import": "./dist/profiles/claude-code-2.1.195.js"
README.md:19:The only accepted `profile` value is the exported `CLAUDE_CODE_2_1_195_PROFILE` singleton. Any other object, even a structurally identical clone, is rejected with `ClaudeCodeWireError` code `INVALID_INPUT`. This deliberate fail-closed behaviour prevents callers from substituting an unpinned protocol profile.
README.md:70:- [Claude Code 2.1.195](./docs/protocol/versions/claude-code-2.1.195-analysis.md)
docs\source-trace.md:21:| Claude Code CLI | `2.1.195`                                         |
docs\source-trace.md:24:| Profile id      | `claude-code-2.1.195-sdk-0.94.0`                  |
docs\source-trace.md:55:| Pinned CLI version     | `lib/request-headers.mjs` |      19 | `FALLBACK_CLAUDE_CLI_VERSION = "2.1.195"`. The package pins this as a profile constant, never as a fallback resolved at runtime.                                                                                                                                                                                                                                                                            | `test/profile.test.ts`                 |
docs\source-trace.md:57:| Build markers          | `lib/request-headers.mjs` |   26-27 | `CLAUDE_CODE_BUILD_TIME = "2026-06-26T01:00:56Z"` and `CLAUDE_CODE_GIT_SHA = "4603aa3f2ea164bd0974f82eb413ae7acc99a7ee"`, extracted from the 2.1.195 native binary. Pinned as profile constants only if a golden proves they reach the wire.                                                                                                                                                                | `test/profile.test.ts`                 |
docs\source-trace.md:59:| CLI-to-SDK version map | `lib/request-headers.mjs` |   40-45 | `CLI_TO_SDK_VERSION` maps each CLI version to its bundled SDK version; the pinned pair `["2.1.195", "0.94.0"]` is at line 45. The package pins exactly one pair and does not port the historical map.                                                                                                                                                                                                       | `test/profile.test.ts`                 |
docs\source-trace.md:192:Verified known-answer vector: first user text `offline cch probe` with CLI version `2.1.195` yields fingerprint `7fe`. Therefore the exact billing line is:
docs\source-trace.md:194:`x-anthropic-billing-header: cc_version=2.1.195.7fe; cc_entrypoint=cli; cch=00000;`
docs\source-trace.md:226:`claude-cli/2.1.195 (external, cli)`. It is the default profile in `test/profile.test.ts`. This
docs\source-trace.md:912:  `src/profiles/claude-code-2.1.195.ts`; and every `https://` host anywhere in `src/` is
docs\ATTRIBUTION.md:86:| `docs/protocol/versions/claude-code-2.1.195-analysis.md` | `docs/claude-code-2.1.195-analysis.md` |          334 | Ported verbatim; provenance header prepended |
scripts\verify-drift.mjs:20:  "claude-code-2.1.195.ts",
docs\protocol\beta-decision-table.md:37:> `docs/claude-code-2.1.195-analysis.md` §5, especially lines 175 and 178, and the release matrix at
docs\protocol\http-headers-and-system-prompt.md:21:<!-- Last verified against: Claude Code 2.1.195 — DECOMPILED from the real
docs\protocol\http-headers-and-system-prompt.md:22:     linux-x64 native binary (@anthropic-ai/claude-code-linux-x64@2.1.195, Bun-
docs\protocol\http-headers-and-system-prompt.md:25:       VERSION    = "2.1.195"
docs\protocol\http-headers-and-system-prompt.md:30:     Diff vs 2.1.159 (see docs/claude-code-2.1.195-analysis.md for full detail):
docs\protocol\http-headers-and-system-prompt.md:75:## Binary-verified beta registry (2.1.195, 28 entries in `Udd`)
docs\protocol\http-headers-and-system-prompt.md:78:2.1.195 binary array `Udd` (the constructor/array were `rD(...)` in 2.1.159 — minifier
docs\protocol\http-headers-and-system-prompt.md:88:> ⚠ DEFAULT-SET drift (see `docs/claude-code-2.1.195-analysis.md` §5): real CC sends
docs\protocol\http-headers-and-system-prompt.md:106:| fallback_credit         | fallback-credit-2026-06-01 (NEW 2.1.195; opt-in — client refusal-fallback repricing middleware; NOT on a default turn; plugin keeps OFF)                                |
docs\protocol\http-headers-and-system-prompt.md:115:| server_side_fallback    | server-side-fallback-2026-06-01 (NEW 2.1.195; opt-in — only with a `fallbacks:[{model}]` body param; rejected on Batches; n/a Bedrock/Vertex/Foundry; plugin keeps OFF) |
docs\protocol\http-headers-and-system-prompt.md:128:| 2.1.195    | 0.94.0      | Registry 24→28: `+ server-side-fallback-2026-06-01`, `+ fallback-credit-2026-06-01` (both opt-in/gated, not default). CONFIRMED default-on for modern first-party models: `context-management-2025-06-27` (`n0d(model)`) + `effort-2025-11-24` (`Kw(model)`) — plugin under-sends both. CC re-adds `x-client-request-id:<uuid>` + conditional `x-cc-atis`. New optional `, workload/<n>` UA segment. | none                                                                          | **Token-call client axios→SDK fetch**: UA `anthropic-sdk-typescript/0.94.0 userOAuthProvider` + `anthropic-beta: oauth-2025-04-20` on token POST. Login flow/scopes/client_id byte-identical. |
docs\protocol\http-headers-and-system-prompt.md:463:  - ⚠ 2.1.195: CC's first-party fetch middleware (`Ukd`) sets `x-client-request-id`
docs\protocol\http-headers-and-system-prompt.md:467:    `docs/claude-code-2.1.195-analysis.md` §7.
docs\protocol\http-headers-and-system-prompt.md:472:Claude Code 2.1.195's SDK native-fetch OAuth-provider fingerprint
docs\protocol\http-headers-and-system-prompt.md:476:Headers sent by default (flag `true`, matching CC 2.1.195):
docs\protocol\http-headers-and-system-prompt.md:490:> ✅ **RE-CONVERGED — Claude Code 2.1.195 (see `docs/claude-code-2.1.195-analysis.md` §6).**
test\betas.test.ts:8:import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
test\betas.test.ts:16:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
test\betas.test.ts:35:    ...CLAUDE_CODE_2_1_195_PROFILE,
test\betas.test.ts:37:      ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
src\anti-verbosity.ts:10:import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
src\anti-verbosity.ts:182:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
src\anti-verbosity.ts:197:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
test\conformance\differential.test.ts:6:  CLAUDE_CODE_2_1_195_PROFILE,
test\conformance\differential.test.ts:42:  expect(built.evidence.profileId).toBe(CLAUDE_CODE_2_1_195_PROFILE.id);
test\conformance\differential.test.ts:111:      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
src\betas.ts:13:import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
src\betas.ts:100:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
src\betas.ts:107:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
docs\protocol\reverse-engineering.md:382:> ⚠ **UPDATE — Claude Code 2.1.195 (2026-06-29 analysis).** Upstream CC has **moved off
docs\protocol\reverse-engineering.md:383:> axios for OAuth.** The 2.1.195 native binary contains **no `axios/1.x.x` UA string**
docs\protocol\reverse-engineering.md:405:> `axios/1.13.6` therefore now reflect a _historical_ CC version, not 2.1.195. Migrating
docs\protocol\reverse-engineering.md:406:> is a behavioral change with 429 risk — see `docs/claude-code-2.1.195-analysis.md` §6
docs\protocol\reverse-engineering.md:647:| `server-side-fallback-2026-06-01`     | **NEW 2.1.195** — opt-in, only with a `fallbacks:[{model}]` body param  |
docs\protocol\reverse-engineering.md:648:| `fallback-credit-2026-06-01`          | **NEW 2.1.195** — client refusal-fallback repricing middleware (opt-in) |
docs\protocol\reverse-engineering.md:650:> **2.1.195 registry note:** the canonical in-binary registry (`Udd`) holds **28**
docs\protocol\reverse-engineering.md:656:> models (which the plugin omits) — see `docs/claude-code-2.1.195-analysis.md` §5.
src\build-request.ts:31:import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
src\build-request.ts:319:  if (profile !== CLAUDE_CODE_2_1_195_PROFILE) fail();
src\build-request.ts:858: * pairs first user text `hello wire compat` with `cc_version=2.1.195.0f6`.
src\build-request.ts:969:    ownValue(value, "profileId") !== CLAUDE_CODE_2_1_195_PROFILE.id ||
src\build-request.ts:970:    ownValue(value, "url") !== CLAUDE_CODE_2_1_195_PROFILE.endpoint ||
src\build-request.ts:984:    profileId: CLAUDE_CODE_2_1_195_PROFILE.id,
src\build-request.ts:985:    url: CLAUDE_CODE_2_1_195_PROFILE.endpoint,
src\build-request.ts:1292:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
src\build-request.ts:1380: * `CLAUDE_CODE_2_1_195_PROFILE` singleton. Any other object, even a
src\build-request.ts:1387:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
src\build-request.ts:1552: * `CLAUDE_CODE_2_1_195_PROFILE` singleton. Any other object, even a
src\build-request.ts:1559:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
test\docs\provenance.test.ts:128:    destination: "versions/claude-code-2.1.195-analysis.md",
test\docs\provenance.test.ts:129:    source: "docs/claude-code-2.1.195-analysis.md",
test\drift\verify-drift.test.ts:32:      "profile=claude-code-2.1.195-sdk-0.94.0 drift=none\n",
test\drift\verify-drift.test.ts:83:      expect(result.stdout).not.toContain("claude-code-2.1.195-sdk-0.94.0");
test\drift\verify-drift.test.ts:105:      "profile=claude-code-2.1.195-sdk-0.94.0 drift=none\n",
test\golden-fixtures.test.ts:8:const PROFILE_ID = "claude-code-2.1.195-sdk-0.94.0";
test\fingerprint.test.ts:32:const CLI_VERSION = "2.1.195";
src\fingerprint.ts:5:import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
src\fingerprint.ts:79:  const { entrypoint } = CLAUDE_CODE_2_1_195_PROFILE;
src\headers.ts:9:import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
src\headers.ts:164:  if (value !== CLAUDE_CODE_2_1_195_PROFILE) {
src\headers.ts:167:  return CLAUDE_CODE_2_1_195_PROFILE;
src\index.ts:62:export { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
test\governance\package-policy.test.ts:82:      "./profiles/claude-code-2.1.195": {
test\governance\package-policy.test.ts:83:        types: "./dist/profiles/claude-code-2.1.195.d.ts",
test\governance\package-policy.test.ts:84:        import: "./dist/profiles/claude-code-2.1.195.js",
docs\protocol\versions\README.md:23:| [claude-code-2.1.195-analysis.md](./claude-code-2.1.195-analysis.md) | `2.1.195`           |
docs\protocol\versions\claude-code-2.1.195-analysis.md:6:> - Source path: `docs/claude-code-2.1.195-analysis.md`
docs\protocol\versions\claude-code-2.1.195-analysis.md:19:# Claude Code 2.1.195 Analysis
docs\protocol\versions\claude-code-2.1.195-analysis.md:25:Latest published: 2.1.195
docs\protocol\versions\claude-code-2.1.195-analysis.md:27:> Extraction method: `npm pack @anthropic-ai/claude-code-linux-x64@2.1.195`, then
docs\protocol\versions\claude-code-2.1.195-analysis.md:38:| Field       | 2.1.159                                  | 2.1.195                                                                        |
docs\protocol\versions\claude-code-2.1.195-analysis.md:40:| Package     | @anthropic-ai/claude-code@2.1.159        | @anthropic-ai/claude-code@2.1.195                                              |
docs\protocol\versions\claude-code-2.1.195-analysis.md:41:| Version     | 2.1.159                                  | **2.1.195**                                                                    |
docs\protocol\versions\claude-code-2.1.195-analysis.md:56:(`@anthropic-ai/claude-code-{darwin,linux,win32}-{arch}[-musl|-android]@2.1.195`).
docs\protocol\versions\claude-code-2.1.195-analysis.md:86:   OAuth provider.** Real CC 2.1.195 sends token refresh/exchange with
docs\protocol\versions\claude-code-2.1.195-analysis.md:108:| Version / build markers       | Bump `2.1.159 → 2.1.195`, build time, git SHA (see §9).                                                                |
docs\protocol\versions\claude-code-2.1.195-analysis.md:206:  **In 2.1.195 it is confirmed default-on for modern first-party models.** (Verify
docs\protocol\versions\claude-code-2.1.195-analysis.md:208:  2.1.159 snippet is the same `n0d` path, so this gap likely predates 2.1.195.)
docs\protocol\versions\claude-code-2.1.195-analysis.md:310:| Header                                               | 2.1.195 behavior                                                                                                                                                                                                                    | Plugin                               | Verdict                                                                                                                          |
docs\protocol\versions\claude-code-2.1.195-analysis.md:312:| `User-Agent` (messages)                              | `claude-cli/2.1.195 (external, cli[, agent-sdk/…][, client-app/…][, workload/<n>])`. New optional `workload/<n>` segment (only when `wAn()` set; absent in normal interactive).                                                     | `claude-cli/2.1.159 (external, cli)` | **Version drift only** — bump to 2.1.195.                                                                                        |
docs\protocol\versions\claude-code-2.1.195-analysis.md:330:2.1.195 reads a much larger unified rate-limit response family than earlier
docs\protocol\versions\claude-code-2.1.195-analysis.md:394:- `lib/request-headers.mjs`: `FALLBACK_CLAUDE_CLI_VERSION → "2.1.195"`;
docs\protocol\versions\claude-code-2.1.195-analysis.md:397:  extend `CLI_TO_SDK_VERSION` rows `2.1.160`–`2.1.195` → `0.94.0`.
test\governance\provider-scope.test.ts:237:    const profile = read("profiles/claude-code-2.1.195.ts");
test\governance\provider-scope.test.ts:260:    expect(read("profiles/claude-code-2.1.195.ts").code).toContain(
test\fixtures\golden\outgoing-foreground.json:4:  "profileId": "claude-code-2.1.195-sdk-0.94.0",
test\fixtures\golden\outgoing-foreground.json:16:    ["user-agent", "claude-cli/2.1.195 (external, cli)"],
test\fixtures\golden\outgoing-foreground.json:35:        "text": "x-anthropic-billing-header: cc_version=2.1.195.0f6; cc_entrypoint=cli; cch=00000;"
test\model-capability-wire.test.ts:7:  CLAUDE_CODE_2_1_195_PROFILE,
test\model-capability-wire.test.ts:83:      CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-7"]
test\fixtures\golden\outgoing-canary-context-hint-off.json:4:  "profileId": "claude-code-2.1.195-sdk-0.94.0",
test\fixtures\golden\outgoing-canary-context-hint-off.json:16:    ["user-agent", "claude-cli/2.1.195 (external, cli)"],
test\fixtures\golden\outgoing-canary-context-hint-off.json:35:        "text": "x-anthropic-billing-header: cc_version=2.1.195.12f; cc_entrypoint=cli; cch=00000;"
test\headers.test.ts:12:import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
test\headers.test.ts:70:    profile: CLAUDE_CODE_2_1_195_PROFILE,
test\headers.test.ts:100:      CLAUDE_CODE_2_1_195_PROFILE.userAgent,
test\model-capability-regression.test.ts:4:import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
test\model-capability-regression.test.ts:11:      ...CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
test\model-capability-regression.test.ts:13:        ...CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-7"],
test\model-capability-regression.test.ts:17:        ...CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-5"],
test\model-capability-regression.test.ts:23:      ...CLAUDE_CODE_2_1_195_PROFILE,
test\profile.test.ts:5:import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
test\profile.test.ts:136:describe("CLAUDE_CODE_2_1_195_PROFILE", () => {
test\profile.test.ts:138:    expect(CLAUDE_CODE_2_1_195_PROFILE).toMatchObject({
test\profile.test.ts:139:      id: "claude-code-2.1.195-sdk-0.94.0",
test\profile.test.ts:140:      cliVersion: "2.1.195",
test\profile.test.ts:144:      userAgent: "claude-cli/2.1.195 (external, cli)",
test\profile.test.ts:151:    expect(CLAUDE_CODE_2_1_195_PROFILE.endpoint).toContain("?beta=true");
test\profile.test.ts:156:    expect(CLAUDE_CODE_2_1_195_PROFILE.contextHintEnabled).toBe(false);
test\profile.test.ts:157:    expect(CLAUDE_CODE_2_1_195_PROFILE).not.toHaveProperty(
test\profile.test.ts:163:    expect(Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels)).toEqual([
test\profile.test.ts:181:      const actual = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[modelId];
test\profile.test.ts:192:      Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels),
test\profile.test.ts:196:      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
test\profile.test.ts:206:    expect(Object.isFrozen(CLAUDE_CODE_2_1_195_PROFILE)).toBe(true);
test\profile.test.ts:209:      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
test\profile.test.ts:216:      Reflect.set(CLAUDE_CODE_2_1_195_PROFILE, "id", "mutated-profile"),
test\profile.test.ts:218:    expect(CLAUDE_CODE_2_1_195_PROFILE.id).toBe(
test\profile.test.ts:219:      "claude-code-2.1.195-sdk-0.94.0",
test\profile.test.ts:224:    expect(JSON.stringify(CLAUDE_CODE_2_1_195_PROFILE)).not.toContain("xxhash");
test\profile.test.ts:225:    expect(CLAUDE_CODE_2_1_195_PROFILE.contextHintEnabled).toBe(false);
test\fixtures\golden\decision-context-hint-rejected.json:4:  "profileId": "claude-code-2.1.195-sdk-0.94.0",
test\drift\fixtures\billing-prefix\lib\request-headers.mjs.fixture:1:const FALLBACK_CLAUDE_CLI_VERSION = "2.1.195";
test\drift\fixtures\billing-prefix\lib\request-headers.mjs.fixture:3:const CLI_TO_SDK_VERSION = new Map([["2.1.195", "0.94.0"]]);
test\models.test.ts:16:import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
test\models.test.ts:46:      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
test\models.test.ts:56:      Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels),
test\models.test.ts:325:    const before = JSON.stringify(CLAUDE_CODE_2_1_195_PROFILE);
test\models.test.ts:329:      CLAUDE_CODE_2_1_195_PROFILE,
test\models.test.ts:332:    expect(JSON.stringify(CLAUDE_CODE_2_1_195_PROFILE)).toBe(before);
test\redaction.test.ts:20:import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
test\redaction.test.ts:104:    profile: CLAUDE_CODE_2_1_195_PROFILE,
test\drift\fixtures\cli-version\lib\request-headers.mjs.fixture:3:const CLI_TO_SDK_VERSION = new Map([["2.1.195", "0.94.0"]]);
test\request-body.test.ts:12:import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
test\request-body.test.ts:63:  const modelProfile = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[model];
test\request-body.test.ts:107:        CLAUDE_CODE_2_1_195_PROFILE,
src\profiles\claude-code-2.1.195.ts:16:export const CLAUDE_CODE_2_1_195_PROFILE: ClaudeCodeProtocolProfile =
src\profiles\claude-code-2.1.195.ts:18:    id: "claude-code-2.1.195-sdk-0.94.0",
src\profiles\claude-code-2.1.195.ts:19:    cliVersion: "2.1.195",
src\profiles\claude-code-2.1.195.ts:24:    userAgent: "claude-cli/2.1.195 (external, cli)",
src\models.ts:15:import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
src\models.ts:26:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
src\request-body.ts:3:import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";
src\request-body.ts:1831:    (profile ?? CLAUDE_CODE_2_1_195_PROFILE).betaPolicy,
test\property\request-invariants.test.ts:7:  CLAUDE_CODE_2_1_195_PROFILE,
test\property\request-invariants.test.ts:239:      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
src\redaction.ts:288:  if (profileId !== "claude-code-2.1.195-sdk-0.94.0" || endpoint !== ENDPOINT) {
test\runtime\runtime-neutral.test.ts:45:  const payload = `59cf53e54c78${text[4] ?? "0"}${text[7] ?? "0"}${text[20] ?? "0"}2.1.195`;
test\runtime\runtime-neutral.test.ts:66:      "CLAUDE_CODE_2_1_195_PROFILE",
test\runtime\runtime-neutral.test.ts:104:      `cc_version=2.1.195.${fingerprint(messageText)}`,
test\drift\fixtures\valid\lib\request-headers.mjs.fixture:1:const FALLBACK_CLAUDE_CLI_VERSION = "2.1.195";
test\drift\fixtures\valid\lib\request-headers.mjs.fixture:3:const CLI_TO_SDK_VERSION = new Map([["2.1.195", "0.94.0"]]);
test\security\core-adversarial.test.ts:18:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\security\core-adversarial.test.ts:80:    profile: CLAUDE_CODE_2_1_195_PROFILE,
test\types\public-input-contract.test.ts:6:  CLAUDE_CODE_2_1_195_PROFILE,
test\types\public-input-contract.test.ts:30:    const result = buildClaudeCodeRequest(input, CLAUDE_CODE_2_1_195_PROFILE);
test\types\public-input-contract.test.ts:62:      CLAUDE_CODE_2_1_195_PROFILE,
test\types\public-input-contract.test.ts:91:      buildClaudeCodeRequest(input, CLAUDE_CODE_2_1_195_PROFILE),
test\drift\fixtures\header-name\lib\request-headers.mjs.fixture:1:const FALLBACK_CLAUDE_CLI_VERSION = "2.1.195";
test\drift\fixtures\header-name\lib\request-headers.mjs.fixture:3:const CLI_TO_SDK_VERSION = new Map([["2.1.195", "0.94.0"]]);
test\validation\anti-verbosity.test.ts:6:  CLAUDE_CODE_2_1_195_PROFILE,
test\validation\anti-verbosity.test.ts:18:  const entry = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[modelId];
test\validation\anti-verbosity.test.ts:23:    ...CLAUDE_CODE_2_1_195_PROFILE,
test\validation\anti-verbosity.test.ts:25:      ...CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
test\drift\fixtures\golden-hash\lib\request-headers.mjs.fixture:1:const FALLBACK_CLAUDE_CLI_VERSION = "2.1.195";
test\drift\fixtures\golden-hash\lib\request-headers.mjs.fixture:3:const CLI_TO_SDK_VERSION = new Map([["2.1.195", "0.94.0"]]);
test\validation\betas.test.ts:9:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\betas.test.ts:33:      ...CLAUDE_CODE_2_1_195_PROFILE,
test\validation\betas.test.ts:37:    expect(composeBetas(INPUT, CLAUDE_CODE_2_1_195_PROFILE)).not.toContain(
test\validation\betas.test.ts:52:      ...CLAUDE_CODE_2_1_195_PROFILE,
test\validation\betas.test.ts:54:        ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
test\drift\fixtures\unknown-beta\lib\request-headers.mjs.fixture:1:const FALLBACK_CLAUDE_CLI_VERSION = "2.1.195";
test\drift\fixtures\unknown-beta\lib\request-headers.mjs.fixture:3:const CLI_TO_SDK_VERSION = new Map([["2.1.195", "0.94.0"]]);
test\validation\build-request-mutants.test.ts:16:  CLAUDE_CODE_2_1_195_PROFILE,
test\validation\build-request-mutants.test.ts:751:    const clone = protocolProfile({ ...CLAUDE_CODE_2_1_195_PROFILE });
test\validation\build-request-mutants.test.ts:756:      buildClaudeCodeRequest(validInput(), CLAUDE_CODE_2_1_195_PROFILE),
test\validation\build-request-mutants.test.ts:867:      profileId: "claude-code-2.1.195-sdk-0.94.0",
test\validation\build-request-mutants.test.ts:900:    const clone = protocolProfile({ ...CLAUDE_CODE_2_1_195_PROFILE });
test\validation\build-request.test.ts:16:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\build-request.test.ts:90:  const material = `59cf53e54c78${firstUserText[4] ?? "0"}${firstUserText[7] ?? "0"}${firstUserText[20] ?? "0"}2.1.195`;
test\validation\build-request.test.ts:95:  return `x-anthropic-billing-header: cc_version=2.1.195.${fingerprint}; cc_entrypoint=cli; cch=00000;`;
test\validation\build-request.test.ts:216:        ...CLAUDE_CODE_2_1_195_PROFILE,
test\validation\build-request.test.ts:421:        ...CLAUDE_CODE_2_1_195_PROFILE,
test\drift\fixtures\endpoint\lib\request-headers.mjs.fixture:1:const FALLBACK_CLAUDE_CLI_VERSION = "2.1.195";
test\drift\fixtures\endpoint\lib\request-headers.mjs.fixture:3:const CLI_TO_SDK_VERSION = new Map([["2.1.195", "0.94.0"]]);
test\validation\count-tokens.test.ts:9:  CLAUDE_CODE_2_1_195_PROFILE,
test\validation\count-tokens.test.ts:160:          ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
test\validation\experimental-body-fields.test.ts:10:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\experimental-body-fields.test.ts:14:const MODEL_DEFINITION = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[MODEL_ID];
test\validation\extra-header-policy.test.ts:29:  CLAUDE_CODE_2_1_195_PROFILE,
test\validation\extra-header-policy.test.ts:124:  profile: CLAUDE_CODE_2_1_195_PROFILE,
test\validation\extra-header-policy.test.ts:244:      CLAUDE_CODE_2_1_195_PROFILE.userAgent,
test\validation\fingerprint.test.ts:7:const CLI_VERSION = "2.1.195";
test\validation\fingerprint-crypto.test.ts:26:      "2.1.195",
test\validation\fingerprint-crypto.test.ts:68:      "2.1.195",
test\validation\fingerprint-crypto.test.ts:73:        "2.1.195",
test\validation\fingerprint-crypto.test.ts:90:        "2.1.195",
test\validation\header-mutants.test.ts:6:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\header-mutants.test.ts:27:    profile: CLAUDE_CODE_2_1_195_PROFILE,
test\validation\headers.test.ts:7:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\headers.test.ts:24:    profile: CLAUDE_CODE_2_1_195_PROFILE,
test\validation\headers.test.ts:82:      withField("profile", { ...CLAUDE_CODE_2_1_195_PROFILE }),
test\validation\metadata-contract-expansion.test.ts:8:  CLAUDE_CODE_2_1_195_PROFILE,
test\validation\metadata-contract-expansion.test.ts:13:const MODEL_DEFINITION = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[MODEL_ID];
test\validation\metadata-contract-expansion.test.ts:50:      CLAUDE_CODE_2_1_195_PROFILE,
test\validation\metadata-headers-mutants.test.ts:16:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\metadata-headers-mutants.test.ts:56:    profile: CLAUDE_CODE_2_1_195_PROFILE,
test\validation\metadata-headers-mutants.test.ts:313:      ["user-agent", "claude-cli/2.1.195 (external, cli)"],
test\validation\metadata-headers-mutants.test.ts:635:      CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-8"];
test\validation\metadata-headers-mutants.test.ts:639:    expect(Object.isFrozen(CLAUDE_CODE_2_1_195_PROFILE)).toBe(true);
test\validation\metadata-headers-mutants.test.ts:640:    expect(Object.isFrozen(CLAUDE_CODE_2_1_195_PROFILE.supportedModels)).toBe(
test\validation\model-wire-identity.test.ts:8:  CLAUDE_CODE_2_1_195_PROFILE,
test\validation\model-wire-identity.test.ts:41:      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
test\validation\model-identity.test.ts:12:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\model-identity.test.ts:101:        CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
test\validation\model-identity.test.ts:166:      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
test\validation\profile-override.test.ts:6:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\profile-override.test.ts:35:  const catalogueEntry = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[modelId];
test\validation\profile-override.test.ts:113:      "claude-cli/2.1.195 (external, cli)",
test\validation\profile-override.test.ts:160:      userAgent: "claude-cli/2.1.195 (external, cli)",
test\validation\profile-override.test.ts:224:        supportedModels: CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
test\validation\profile-override.test.ts:324:          ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
test\validation\profile-override.test.ts:341:        Object.entries(CLAUDE_CODE_2_1_195_PROFILE.betaPolicy).filter(
test\validation\profile-override.test.ts:348:      { ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy, unexpected: true },
test\validation\profile-override.test.ts:352:      { ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy, afkModeEnabled: "false" },
test\validation\redaction-mutants.test.ts:21:const PROFILE_ID = "claude-code-2.1.195-sdk-0.94.0";
test\validation\redaction-mutants.test.ts:93:    cliVersion: "2.1.195",
test\validation\redaction-mutants.test.ts:97:    userAgent: "claude-cli/2.1.195 (external, sdk-cli)",
test\validation\redaction-mutants.test.ts:713:      fingerprint.createBillingFingerprint(text, "2.1.195"),
test\validation\redaction-mutants.test.ts:720:      const material = `59cf53e54c78${text[4] ?? "0"}${text[7] ?? "0"}${text[20] ?? "0"}2.1.195`;
test\validation\redaction-mutants.test.ts:730:      await expect(createBillingFingerprint(text, "2.1.195")).resolves.toBe(
test\validation\redaction-mutants.test.ts:740:      "2.1.195",
test\validation\redaction-mutants.test.ts:744:      text: "x-anthropic-billing-header: cc_version=2.1.195.0f6; cc_entrypoint=cli; cch=00000;",
test\validation\redaction.test.ts:15:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\redaction.test.ts:37:    profile: CLAUDE_CODE_2_1_195_PROFILE,
test\validation\redaction.test.ts:199:    { profile: { ...CLAUDE_CODE_2_1_195_PROFILE, id: "wrong-profile" } },
test\validation\redaction.test.ts:201:      profile: { ...CLAUDE_CODE_2_1_195_PROFILE, endpoint: "https://invalid" },
test\validation\request-body-mutants.test.ts:9:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\request-body-mutants.test.ts:497:      { ...CLAUDE_CODE_2_1_195_PROFILE, contextHintEnabled: true },
test\validation\request-body-mutants.test.ts:507:        CLAUDE_CODE_2_1_195_PROFILE,
test\validation\request-body-mutants.test.ts:519:        { ...CLAUDE_CODE_2_1_195_PROFILE, contextHintEnabled: true },
test\validation\request-body-mutants.test.ts:536:        CLAUDE_CODE_2_1_195_PROFILE,
test\validation\request-body-mutants.test.ts:545:      CLAUDE_CODE_2_1_195_PROFILE,
test\validation\request-body-mutants.test.ts:553:    const profile = { ...CLAUDE_CODE_2_1_195_PROFILE, cycle };
test\validation\request-body-mutants.test.ts:670:      ...CLAUDE_CODE_2_1_195_PROFILE,
test\validation\request-body.test.ts:6:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\request-body.test.ts:9:const MODEL_DEFINITION = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[MODEL_ID];
test\validation\request-body.test.ts:379:        { ...CLAUDE_CODE_2_1_195_PROFILE, contextHintEnabled: true },
test\validation\tool-definitions.test.ts:5:import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
test\validation\tool-definitions.test.ts:8:const MODEL_DEFINITION = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[MODEL_ID];
test\validation\top-level-contract-expansion.test.ts:15:  CLAUDE_CODE_2_1_195_PROFILE,
test\validation\top-level-contract-expansion.test.ts:20:const MODEL_DEFINITION = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[MODEL_ID];
test\validation\top-level-contract-expansion.test.ts:34:    ...CLAUDE_CODE_2_1_195_PROFILE,
test\validation\top-level-contract-expansion.test.ts:36:      ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
test\validation\top-level-contract-expansion.test.ts:44:  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
test\validation\unknown-nested-properties.test.ts:8:  CLAUDE_CODE_2_1_195_PROFILE,
test\validation\unknown-nested-properties.test.ts:36:    CLAUDE_CODE_2_1_195_PROFILE,
```
