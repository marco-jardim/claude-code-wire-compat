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
at the baseline commit: 275 lines, reproduced verbatim in
[rg-2.1.195-baseline.txt](./rg-2.1.195-baseline.txt) (kept out of this
document so that matched lines containing relative Markdown links are not
scanned by the docs link checker).
