<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

> **Provenance**
>
> - First-party analysis authored in this repository
> - License: `GPL-3.0-or-later`
> - Method: static extraction from the official npm artifacts, supplemented by
>   local TLS-intercepted captures of the genuine binary (`[LIVE]`)
>
> Scope: original reverse-engineering research performed for this package,
> comparing the official `2.1.329` release against the `2.1.280` baseline this
> package currently pins. Nothing in this document is reproduced from any
> external *repository of code*.
>
> **This document is not purely binary-derived.** Section 4 rests on live wire
> captures rather than on the bundle, and every such claim is tagged `[LIVE]`
> at the point of use. A `[LIVE]` observation must not be promoted to binary
> evidence by a later editor, and it is bounded by the caveat in §4.

# Claude Code 2.1.329 Analysis

- **Date**: 2026-11-19
- **Target**: `@anthropic-ai/claude-code-win32-x64@2.1.329`
- **Compared against**: `2.1.280` (the release this package pinned when this
  analysis was written)
- **Supersedes**: nothing.
- **Status**: ported in this branch (`port/claude-code-2.1.329`) and the
  package's default profile since release `0.8.0` (2026-11-20). The
  profile is `claude-code-2.1.329-sdk-0.128.0` and `2.1.280` stays exported for
  rollback. The decisions taken are in `MEMORY.md` (2026-11-19 entries) and
  what was deliberately left out is in `docs/source-trace.md` under "2.1.329 —
  recorded, not ported". The sections below are the evidence as it stood when
  this document was written, and are not rewritten. Section 13 records
  corrections to the 2.1.280 analysis that this work surfaced.

---

## 1. Artefacts and evidence classes

### 1.1 Hashes

Every offset in this document indexes **`cc-2.1.329.full.js`**, whose hash is
recorded below, unless the text says otherwise.

| Artefact                                                                          | Bytes       | SHA-256                                                            |
| --------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `package/claude.exe` (2.1.329)                                                    | 384,179,872 | `527162BB4578E3DC36319FA913A530D5DC1F752115A6A4FD139981702BF282D0` |
| `cc-2.1.329.full.js` (every run of 512 bytes or more, 4,571 runs)                 | 69,728,147  | `B6F239EB2DF8CAA2E73D2C187CA8B0F92C6A4757DBC95CA884243B5ABDE7479B` |
| `cc-2.1.329.modules.js` (runs of 4096 bytes or more carrying the banner, 1,725 runs) | 61,928,540  | `90B3851AA59D3EF1F3BE78FFF121FB1EB3A7AA41CE70D76D2520BACAD4A025E4` |
| `cc-2.1.329.js` (longest run)                                                     | 6,096,558   | `037754A66967EB1CB8AEBB1A816AFE80AF53F5906D2134D792919618E1F074CC` |
| `cc-2.1.280.full.js` (re-carve, 2,850 runs)                                       | 42,071,828  | `AF789806362FA979C528897A10F78F4F677E7225BE93E0F37292270DD7D12DEE` |
| `cc-2.1.280.modules.js` (re-carve, 1,100 runs)                                    | 36,152,611  | `4690D67AB579EF5C87F8AB13364676CCE3F64A1C1BA2BD8C25939C2E542B5B2D` |

Acquisition: `npm pack @anthropic-ai/claude-code-win32-x64@2.1.329`, plus the
same command for `2.1.280` for the re-carve. The 2.1.280 executable hash
`0E4195524B73EB77EFBDF3E2B36DE5322A29F0CA575DFD2D9B4F946B1D425469` and its
longest-run hash `BF94C1E5…385D` (4,015,347 bytes) reproduce the 2.1.280
analysis exactly.

### 1.2 The carving predicate

The predicate is the one in the 2.1.280 analysis §1.2. A byte is *printable*
when it is one of `0x09`, `0x0A`, `0x0D`, or lies in `0x20`–`0x7E`. Runs are
maximal printable runs, joined with `\n` in ascending start offset.

- `cc-2.1.329.js` — the single longest run.
- `cc-2.1.329.modules.js` — every run of **>= 4096** bytes that also carries the
  module banner.
- `cc-2.1.329.full.js` — every run of **>= 512** bytes.

**Finding: the module banner changed.** 2.1.280 modules start
`// @bun @bytecode` and then
`// Claude Code is a Beta product per Anthropic's Commercial Terms of Service.`
2.1.329 modules start `// @bun @bytecode` and then
`// (c) Anthropic PBC. All rights reserved. Use is subject to the Legal Agreements outlined here: https://code.claude.com/docs/en/legal-and-compliance.`
The `.modules.js` banner predicate must therefore use the new banner text.
Applying the old banner to 2.1.329 selects zero modules `[BIN]`.

**Reproducibility note.** Re-carving 2.1.280 with the documented predicate
reproduces the executable hash and the longest-run hash, but **not** the
`.full.js` and `.modules.js` byte counts or hashes recorded in the 2.1.280
analysis §1.1 (42,185,436 and 36,197,302 bytes there; 42,071,828 and
36,152,611 here). The extractor reports are the invariant that matters:

| Release  | `.full.js` and `.modules.js` report | SHA-256                                                            |
| -------- | ----------------------------------- | ------------------------------------------------------------------ |
| 2.1.280  | byte-identical, 16,050 bytes        | `A34171A84075E2417B0F651A145B6B00DD45B70812B55D10D017376759906EBC` |
| 2.1.329  | byte-identical, 23,308 bytes        | `F7F3F35EE60234044A99B3157D9C2CEF9BA400E84372864B6176CD2ECB98B8DA` |

The two dumps of each release produce the same report, which is the runbook's
cross-check that concatenation does not perturb the extractor's anchors. The
2.1.280 report size differs from the 16,733 bytes recorded in the 2.1.280
analysis §1.2. The extractor has changed since then; this is an observation,
not a defect.

### 1.3 Evidence classes used in this document

Every finding carries exactly one of these markers. A claim with no marker is a
definition or a cross-reference.

| Class     | Meaning                                                                               |
| --------- | ------------------------------------------------------------------------------------- |
| `[BIN]`   | Transcribed from `cc-2.1.329.full.js` (or its extractor report)                        |
| `[DER]`   | Derived by evaluating transcribed code under stated default conditions                |
| `[UNR]`   | Located but not resolved; the open question is stated explicitly                      |
| `[EXT-n]` | Published external material (none is used in the sections written so far)            |
| `[LIVE]`  | Observed in a local TLS-intercepted capture of the genuine binary (§4)                |

### 1.4 Build shape

2.1.329 is a Bun `// @bun @bytecode` multi-module build with **1,725** banner
modules (1,100 in 2.1.280) `[BIN]`. The executable is 62% larger: 384,179,872
bytes against 237,100,192.

---

## 2. Executive summary

The headline: 2.1.329 is **additive on the wire except for one retired beta, one
re-ordered beta and one value this package believed static**. Nothing here is a
port; each finding is tagged with its evidence class where it is detailed
(§4–§9).

### 2.1 What moves on the wire

1. **Client identity.** `User-Agent` becomes `claude-cli/2.1.329 (external, <entrypoint>)`,
   `X-Stainless-Package-Version` 0.112.1 → **0.128.0**, and
   `X-Stainless-Runtime-Version` v26.3.0 → **v26.12.1** `[BIN]` `[LIVE]` (§3.1, §4.1).
2. **`mid-conversation-system-2026-04-07` is no longer sent.** The header
   graduated (GA): slot 30 is now declared header-less, but the *condition*
   behind it is still evaluated, and the mid-conversation `role:"system"`
   message, the tool-changes beta and the clear-at beta still depend on it
   `[BIN]` `[LIVE]` (§3.2, §5.3).
3. **`cch` is not static on the genuine client.** The 5-hex value differs per
   request on both 2.1.280 and 2.1.329 while the JS writes only `cch=00000`
   `[LIVE]` `[BIN]` `[DER]` (§4.1). This contradicts a standing assumption of
   this package.
4. **Six new registry betas**, of which only `tool-provenance-2026-10-26` is
   default-on for an interactive OAuth subscriber `[DER]`; the other five never
   reach the default main request (§5.2).
5. **`thinking-token-count-2026-05-13` moves** from position 4 to after the
   per-request betas and before clear-at; **`context-1m` is no longer sent for
   natively-1M models** (both 5.5 models) `[LIVE]` `[BIN]` (§4.1, §5.4).
6. **Three new request headers**: `x-claude-1p-request-class: main`,
   `x-claude-code-prompt-id` (the prompt UUID) and `x-claude-code-sandy-plover`
   (a JSON array of tools used so far). Header names are capitalised on the wire
   and `Accept: application/json` is sent `[LIVE]` `[BIN]` (§6.1).
7. **Billing block** gains `cc_prompt_index=…; cc_turn_index=…;` after
   `cc_turn_origin` (which already existed in 2.1.280). Fingerprint algorithm,
   salt and positions are unchanged; its input is the first typed, non-meta
   prompt `[LIVE]` `[BIN]` (§6.2).
8. **Body changes**: `fallbacks` disappears from the captured request, `thread`
   (`{"type":"create"}`) appears, and the key order places `output_config`,
   `thread`, `diagnostics`, `stream` last `[LIVE]` (§4.1, §6.4).
9. **Request bodies are gzipped by default** (4096 characters and up, direct to
   `api.anthropic.com`, Bun runtime, no proxy, no custom CA) and padded with a
   newline plus 0–256 random spaces or tabs. The capture ran behind an
   intercepting proxy, which disables this, so it is not observed `[BIN]` `[DER]`
   (§6.6).
10. **Four new models** (`claude-haiku-5-5`, `claude-sonnet-5-5`,
    `claude-fable-5-2`, `claude-mythos-5-2`); the `sonnet`, `haiku` and `fable`
    aliases re-point to the 5.5 / 5.2 ids; `mid_conv_system` is removed from the
    seven models that carried it `[BIN]` (§3.3, §6.8).
11. **Tool surface**: a `DeferredToolPlaceholder` tool and an `advisor_20260301`
    server tool, both `defer_loading:true`, `eager_input_streaming`, MCP
    `ownership_metadata`; the live tool JSON grows 39,371 → 44,813 bytes
    `[LIVE]` `[BIN]` (§6.5).
12. **System prompt**: the shared static block opens with a new sentence (+20 B),
    and the live blocks grow (§6.3, §9.4).
13. **OAuth is changed, additively**: the default login scope string gains
    `user:privacy_consents:write`, more `/api/oauth/*` calls carry
    `User-Agent: claude-code/2.1.329`, axios OAuth calls refuse redirects; URLs,
    client id and request bodies are unchanged `[BIN]` (§7).
14. **Cache machinery grows but stays off by default**: `cache-keepalive`,
    `resumption`, idle compaction, after-idle tool-result clearing and a split
    TTL environment variable are all new; none is on by default `[BIN]` (§8).

### 2.2 What does not move

- Endpoint (`/v1/messages?beta=true`), the `count_tokens` path,
  `anthropic-version`, `x-app`, the retry-count and timeout header values and
  the `metadata.user_id` key set `[BIN]` `[LIVE]`.
- The fingerprint salt `59cf53e54c78`, character positions 4/7/20, SHA-256 and
  three hex characters; the live vectors agree with this package's algorithm
  (`hello` → `790` on 2.1.280, `e8c` on 2.1.329) `[LIVE]`.
- The identity strings, the system-block `cache_control` mapping, the
  `thinking` key order, `max_tokens` taken from the catalogue default and the
  default effort taken from the catalogue (`medium` for the 5.5 / 5.2 models)
  `[BIN]` `[LIVE]`.
- The OAuth core contract: URLs, client id, authorize parameter order, exchange
  body, refresh body and revoke call; credential storage locations `[BIN]` (§7).
- The `count_tokens` and Bedrock-unsupported beta sets, the redact-thinking
  add-then-remove behaviour, the cache-diagnosis emission, `tokenLimits` and the
  bash-first steering for the Opus 5.5 bundle `[BIN]` (§3.4, §5.6, §9).
- The 17-site order of the base beta pushes, apart from the single move noted
  above `[BIN]` (§5.4).

### 2.3 Decisions the maintainer must take

1. **`cch`.** The genuine client sends a per-request 5-hex value that this
   package cannot compute. Options: keep `00000` and record it as a known,
   detectable difference; add a host seam through which the caller supplies the
   value; or reverse the native code (outside this package's no-guessing rule).
   The analysts recommend the first two. Reversing the recorded static-`cch`
   assumption needs a dated `MEMORY.md` entry; this cycle adds one that flags the
   contradiction without reversing the "do not port the native hash" policy.
2. **Backport the pre-existing 2.1.280 omissions?** The 2.1.280 live capture
   already carries `x-claude-code-request-class`, the `cc_turn_origin` billing
   segment, generated `context_management`, `diagnostics`,
   `anthropic-dispatch-id`, the genuine body key order and header
   capitalisation, none of which this package emits. Fixing them for 2.1.280
   **moves its frozen digest** (`9a531ed0…ada90`). The alternative is to fix them
   for a 2.1.329 profile only.
3. **Account-served features.** `anthropic-dispatch-id`, `message-threads` with
   `thread:{"type":"create"}`, `inline-tools` and `advisor-tool` appear on the
   wire because of per-account remote flags, not code defaults. Decide whether
   to model them as opt-in caller inputs (recommended) or ignore them.
4. **Port strategy for `mid-conversation-system`.** Make the registry key
   optional and omit it from the 2.1.329 registry, plus a behaviour flag
   `midConversationSystemFromCatalogue` (true for 2.1.195, 2.1.233, 2.1.280;
   false from 2.1.329) so the condition keeps working without catalogue data
   (§5.3, §10).

> **Resolved 2026-11-19 by the maintainer.** (1) Both: `cch=00000` stays the
> default, and an optional host seam supplies the per-request value when the
> host has one. (2) Fix only in the 2.1.329 profile; every frozen digest
> (2.1.195, 2.1.233, 2.1.280) stays put. (3) Model the account-served features
> as opt-in caller inputs, off by default. (4) Port as recommended.

---

## 3. Extractor delta (`scripts/extract-upstream-profile.mjs`)

Source: the extractor report for 2.1.280 compared with the report for 2.1.329.
Both reports come from the `.full.js` carve. All findings in this section are
`[BIN]` unless marked otherwise.

### 3.1 Scalars

| Scalar                    | 2.1.280                                    | 2.1.329                                    |
| ------------------------- | ------------------------------------------ | ------------------------------------------ |
| `version`                 | `2.1.280`                                  | `2.1.329`                                  |
| `buildTime`               | `2026-09-21T20:40:17Z`                     | `2026-11-19T16:23:05Z`                     |
| `gitSha`                  | `80abbfe7d7232280011ff01a21ae3338f4c6e372` | `6a49dd29d929a6fe40c060bbccfeb5a7f037c958` |
| `anthropicVersion`        | unchanged                                  | unchanged                                  |
| `endpoint`                | unchanged                                  | unchanged                                  |
| `fingerprintSalt`         | `59cf53e54c78`                             | `59cf53e54c78` (unchanged)                 |
| `userAgent`               | resolved                                   | `unresolved` (the anchor is ambiguous)     |
| `stainlessPackageVersion` | `0.112.1`                                  | `unresolved` (the adjacency is missing)    |

`userAgent` and `stainlessPackageVersion` come back `unresolved` and were
resolved by hand. The SDK version is **`0.128.0`** (was `0.112.1`) `[BIN]` and
`[LIVE]` (§4.1: `X-Stainless-Package-Version: 0.128.0`).

### 3.2 Beta registry

The registry has **48 slots** (42 in 2.1.280). Null slots are at **39 and 43**
(were 34 and 37). **Slot 30 is unresolved.** The registry order is
`frozen-array` and null-filtered, as before.

The `Index` column is the position in the extractor's printed entry list, which
omits the null slots and the unresolved slot (45 entries printed). It is not the
raw slot number. `2.1.280` is the index in the 2.1.280 report.

| Index | 2.1.280 | `featureKey`                      | Header                                       |
| ----: | ------- | --------------------------------- | -------------------------------------------- |
|     0 | 0       | `claude_code`                     | `claude-code-20250219`                       |
|     1 | 1       | `oauth_auth`                      | `oauth-2025-04-20`                           |
|     2 | 2       | `interleaved_thinking`            | `interleaved-thinking-2025-05-14`            |
|     3 | 3       | `long_context`                    | `context-1m-2025-08-07`                      |
|     4 | 4       | `context_management`              | `context-management-2025-06-27`              |
|     5 | 5       | `structured_outputs`              | `structured-outputs-2025-12-15`              |
|     6 | 6       | `web_search`                      | `web-search-2025-03-05`                      |
|     7 | NEW     | `web_search_results_only`         | `web-search-results-only-2026-11-15`         |
|     8 | 7       | `tool_search`                     | `advanced-tool-use-2025-11-20`               |
|     9 | 8       | `tool_search`                     | `tool-search-tool-2025-10-19`                |
|    10 | 9       | `effort`                          | `effort-2025-11-24`                          |
|    11 | 10      | `task_budgets`                    | `task-budgets-2026-03-13`                    |
|    12 | 11      | `prompt_caching_scope`            | `prompt-caching-scope-2026-01-05`            |
|    13 | 12      | `prompt_caching_evict`            | `prompt-caching-evict-2026-05-12`            |
|    14 | NEW     | `cache_keepalive`                 | `cache-keepalive-2026-09-03`                 |
|    15 | 13      | `extended_cache_ttl`              | `extended-cache-ttl-2025-04-11`              |
|    16 | 14      | `speed`                           | `fast-mode-2026-02-01`                       |
|    17 | 15      | `redact_thinking`                 | `redact-thinking-2026-02-12`                 |
|    18 | 16      | `thinking_resumption`             | `thinking-resumption-2026-07-17`             |
|    19 | NEW     | `resumption`                      | `resumption-2026-10-08`                      |
|    20 | 17      | `thinking_token_count`            | `thinking-token-count-2026-05-13`            |
|    21 | 18      | `afk_mode`                        | `afk-mode-2026-01-31`                        |
|    22 | 19      | `advisor_tool`                    | `advisor-tool-2026-03-01`                    |
|    23 | 20      | `cache_diagnosis`                 | `cache-diagnosis-2026-04-07`                 |
|    24 | 21      | `context_hint`                    | `context-hint-2026-04-09`                    |
|    25 | 22      | `mcp_servers`                     | `mcp-servers-2025-12-04`                     |
|    26 | 23      | `files_api`                       | `files-api-2025-04-14`                       |
|    27 | 24      | `environments`                    | `environments-2025-11-01`                    |
|    28 | 25      | `ccr_byoc`                        | `ccr-byoc-2025-07-29`                        |
|    29 | NEW     | `ccr_tool_provenance`             | `tool-provenance-2026-10-26`                 |
|    30 | 27      | `per_message_effort`              | `per-turn-control-2026-07-01`                |
|    31 | 28      | `per_turn_timing`                 | `timing-2026-09-09`                          |
|    32 | 29      | `mid_conv_tool_change`            | `mid-conversation-tool-changes-2026-07-01`   |
|    33 | 30      | `inline_tools`                    | `inline-tools-2026-09-15`                    |
|    34 | 31      | `server_side_fallback`            | `server-side-fallback-2026-06-01`            |
|    35 | NEW     | `program_use_case_ids`            | `program-use-case-ids-2026-09-17`            |
|    36 | 32      | `server_side_fallback_category`   | `server-side-fallback-2026-07-01`            |
|    37 | 33      | `fallback_credit`                 | `fallback-credit-2026-06-01`                 |
|    38 | 34      | `auto_mode_classifier`            | `auto-mode-classifier-2026-07-16`            |
|    39 | NEW     | `claude_code_side_query`          | `claude-code-side-query-2026-09-29`          |
|    40 | 35      | `dangerous_tool_use`              | `dangerous-tool-use-2026-09-03`              |
|    41 | 36      | `thinking_display_updates`        | `thinking-display-updates-2026-08-18`        |
|    42 | 37      | `message_threads`                 | `message-threads-2026-08-12`                 |
|    43 | 38      | `mid_conversation_system_clear_at`| `mid-conversation-system-clear-at-2026-08-21`|
|    44 | 39      | `thinking_binding_controls`       | `thinking-binding-controls-2026-08-01`       |

**Six new entries**: `web-search-results-only-2026-11-15`,
`cache-keepalive-2026-09-03`, `resumption-2026-10-08`,
`tool-provenance-2026-10-26`, `program-use-case-ids-2026-09-17` and
`claude-code-side-query-2026-09-29`.

**Not resolved by the extractor**: 2.1.280 index 26,
`mid_conversation_system` → `mid-conversation-system-2026-04-07`, is absent from
the 2.1.329 entry list. Its status is resolved by hand: it is **not removed from the registry**. Raw slot
30 is `mid_conversation_system`, declared with the header-less constructor
`pl()` (`pl(e){return Object.freeze({name:e,header:null})}`), so the extractor
sees no header and leaves the slot unresolved `[BIN]`. The literal
`mid-conversation-system-2026-04-07` survives only as the standalone constant
`Zkt`, used to recognise the identifier inside server error messages and in the
`ANTHROPIC_BETAS` handling, which now logs that the beta "is generally
available; the header is not sent" `[BIN]`. The header **graduated (GA)**. The
slot stays in the ordered array, so composition code that tests for the marker
still works, but `FH(e)=e.filter(o=>o.header!==null).map(o=>o.header)` drops it
when the list is turned into wire strings (offset 7884848). The live capture
(§4.1) shows that the identifier is no longer sent `[LIVE]`. Detail and the
gating consequences are in §5.3.

The extractor's `auxiliarySets` meta lists three sets for 2.1.280 (all
`unresolved`) and fourteen for 2.1.329, several of them unrelated to betas
(environment-variable names, cancel reasons, device paths). They are not
analysed here.

### 3.3 Model catalogue

The extractor lists 23 model ids for 2.1.280 and 27 for 2.1.329. The four new
models are `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-fable-5-2` and
`claude-mythos-5-2`; all have `context.window` 1,000,000 with `native_1m` and
`supports_1m_beta` true, `default_effort` `medium`, and `max_output_tokens`
`{"default":128000,"upper":128000}`.

#### New models, full extracted objects

```json
{"advisor_rank":4,"capabilities":["effort","max_effort","xhigh_effort","adaptive_thinking","mid_conv_tool_change","context_management","rejects_disabled_thinking","per_turn_effort","lean_prompt","org_locked_thinking","haiku_5_5_early_stopping_guidance","total_tokens_reminder","tool_loaded_text"],"context":{"native_1m":true,"supports_1m_beta":true,"window":1000000},"default_effort":"medium","effort_cost_index":{"high":1,"low":0.38,"max":4.34,"medium":0.52,"xhigh":2.03},"family":"haiku","id":"claude-haiku-5-5","max_output_tokens":{"default":128000,"upper":128000},"pricing":"haiku_55"}
```

```json
{"advisor_rank":6,"capabilities":["effort","max_effort","xhigh_effort","adaptive_thinking","mid_conv_tool_change","context_management","rejects_disabled_thinking","per_turn_effort","per_turn_timing","lean_prompt","refusal_fallback","silent_turn_reminder","org_locked_thinking","tool_loaded_text"],"context":{"native_1m":true,"supports_1m_beta":true,"window":1000000},"default_effort":"medium","effort_cost_index":{"high":1,"low":0.49,"max":5.5,"medium":0.54,"xhigh":1.87},"family":"sonnet","id":"claude-sonnet-5-5","max_output_tokens":{"default":128000,"upper":128000},"pricing":"tier_2_10_cache_read_0_10"}
```

```json
{"advisor_rank":10,"capabilities":["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking","mid_conv_tool_change","per_turn_effort","per_turn_timing","context_management","fast_mode","vertex_fast_mode","lean_prompt","script_output_cost","refusal_fallback","org_locked_thinking","fable_5_2_prompt_bundle"],"context":{"native_1m":true,"supports_1m_beta":true,"window":1000000},"default_effort":"medium","family":"fable","id":"claude-fable-5-2","max_output_tokens":{"default":128000,"upper":128000},"pricing":"tier_8_40_cache_read_0_20"}
```

```json
{"advisor_rank":10,"capabilities":["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking","mid_conv_tool_change","per_turn_effort","per_turn_timing","context_management","fast_mode","vertex_fast_mode","lean_prompt","org_locked_thinking","fable_5_2_prompt_bundle"],"context":{"native_1m":true,"supports_1m_beta":true,"window":1000000},"default_effort":"medium","family":"mythos","id":"claude-mythos-5-2","max_output_tokens":{"default":128000,"upper":128000},"pricing":"tier_8_40_cache_read_0_20"}
```

#### Changes to existing models

Every existing model gains `tool_loaded_text`. Every existing model except
`claude-opus-5-5` also gains `total_tokens_reminder`. `claude-3-5-haiku`,
`claude-3-5-sonnet`, `claude-3-7-sonnet` and `claude-mythos-5` had an empty
`capabilities` array in 2.1.280 and now carry exactly those two entries.
Capabilities not otherwise mentioned are unchanged, and reorderings caused by
insertions are not listed.

| Model                                                                                                              | `advisor_rank`   | Capabilities removed  | Capabilities added                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | ---------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `claude-3-5-haiku`, `claude-haiku-4-5`, `claude-3-5-sonnet`, `claude-3-7-sonnet`                                   | unchanged        | none                  | `total_tokens_reminder`, `tool_loaded_text`                                             |
| `claude-sonnet-4-0`, `claude-sonnet-4-5`, `claude-sonnet-4-6`                                                      | unchanged        | none                  | `total_tokens_reminder`, `tool_loaded_text`                                             |
| `claude-opus-4-0`, `claude-opus-4-1`, `claude-opus-4-5`, `claude-opus-4-6`                                         | unchanged        | none                  | `total_tokens_reminder`, `tool_loaded_text`                                             |
| `claude-sonnet-5`                                                                                                  | 3 → 4            | `mid_conv_system`     | `total_tokens_reminder`, `tool_loaded_text`                                             |
| `claude-opus-4-7`                                                                                                  | 4 → 5            | none                  | `total_tokens_reminder`, `tool_loaded_text`                                             |
| `claude-opus-4-8`                                                                                                  | 4 → 5            | `mid_conv_system`     | `total_tokens_reminder`, `tool_loaded_text`, `send_user_file_input_whole`               |
| `claude-opus-5`                                                                                                    | 4 → 7            | `mid_conv_system`     | `total_tokens_reminder`, `tool_loaded_text`, `send_user_file_input_whole`               |
| `claude-opus-5-5`                                                                                                  | 4 → 7            | `mid_conv_system`     | `tool_loaded_text` (not `total_tokens_reminder`); also gains `effort_cost_index`         |
| `claude-fable-5`                                                                                                   | 5 → 8            | `mid_conv_system`     | `total_tokens_reminder`, `tool_loaded_text`                                             |
| `claude-fable-5-1`                                                                                                 | 5 → 9            | `mid_conv_system`     | `total_tokens_reminder`, `tool_loaded_text`                                             |
| `claude-mythos-5`                                                                                                  | 5 → 8            | none                  | `total_tokens_reminder`, `tool_loaded_text`                                             |
| `claude-mythos-5-1`                                                                                                | 5 → 9            | `mid_conv_system`     | `total_tokens_reminder`, `tool_loaded_text`                                             |

`mid_conv_system` is removed from **every model that carried it** in 2.1.280
(`claude-sonnet-5`, `claude-opus-4-8`, `claude-opus-5`, `claude-opus-5-5`,
`claude-fable-5`, `claude-fable-5-1`, `claude-mythos-5-1`), and none of the four
new models has it. This matches the removal of the
`mid-conversation-system-2026-04-07` beta from the registry list and from the
wire (§3.2, §4.1).

`claude-opus-5-5` gains an `effort_cost_index` that did not exist in 2.1.280:

| Effort   | Cost index |
| -------- | ---------: |
| `low`    |       0.48 |
| `medium` |       0.66 |
| `high`   |          1 |
| `xhigh`  |       1.66 |
| `max`    |       3.44 |

Of the four new models, `claude-haiku-5-5` and `claude-sonnet-5-5` carry an
`effort_cost_index` with the same key set (values in the objects above);
`claude-fable-5-2` and `claude-mythos-5-2` carry none.

### 3.4 `tokenLimits`

Unchanged between 2.1.280 and 2.1.329 `[BIN]`: the extractor diff reports no
`tokenLimits` line.

---

## 4. Live wire captures

All observations in this section are `[LIVE]`.

### 4.0 Method and caveat

Method: mitmproxy 12.2.2 as an HTTPS forward proxy (`HTTPS_PROXY`, with
`NODE_EXTRA_CA_CERTS` pointing at the mitmproxy CA). The Bun-compiled binary
honoured both. The genuine binaries were run as
`claude.exe -p "hello" --no-session-persistence` from the extracted npm
packages. The plugin capture is `opencode run "hello" -m anthropic/claude-sonnet-5-5`
through a reverse proxy, using OAuth and the 2.1.280 profile plus the plugin's
dynamic version override.

> **Caveat.** The genuine captures use the **`sdk-cli`** entrypoint (print mode)
> and **API-key** authentication (`x-api-key`), because the local OAuth session
> had expired. They are therefore **not** the interactive OAuth default path
> this package models. Differences that depend on authentication mode or on
> print mode are not conclusive (§4.2). Identifiers, keys, paths and permission
> rules were scrubbed from the captures before this section was written.

### 4.1 Genuine 2.1.280 against genuine 2.1.329

Same command, same machine, same model (`claude-opus-5-5`).

#### Headers

| Header                         | 2.1.280  | 2.1.329       |
| ------------------------------ | -------- | ------------- |
| `User-Agent`                   | `claude-cli/2.1.280 (external, sdk-cli)` | `claude-cli/2.1.329 (external, sdk-cli)` |
| `X-Stainless-Package-Version`  | `0.112.1`| `0.128.0`     |
| `X-Stainless-Runtime-Version`  | `v26.3.0`| `v26.12.1`    |

New request headers in 2.1.329, each absent in 2.1.280:

- `x-claude-1p-request-class: main`
- `x-claude-code-prompt-id: <uuid>`
- `x-claude-code-sandy-plover: []`

Present in both: `anthropic-dispatch-id: v2d` and
`x-claude-code-request-class: main`. Wire order of the 2.1.329 headers: `Accept`,
`Content-Type`, `User-Agent`, `X-Claude-Code-Session-Id`, the `X-Stainless-*`
group, `anthropic-beta`, `anthropic-dangerous-direct-browser-access`,
`anthropic-dispatch-id`, `anthropic-version`, `x-api-key`, `x-app`,
`x-claude-1p-request-class`, `x-claude-code-prompt-id`,
`x-claude-code-request-class`, `x-claude-code-sandy-plover`,
`x-client-request-id`, `Accept-Encoding`.

#### `anthropic-beta`, in wire order

| #  | 2.1.280                                      | 2.1.329                                      |
| -: | -------------------------------------------- | -------------------------------------------- |
| 1  | `claude-code-20250219`                       | `claude-code-20250219`                       |
| 2  | `context-1m-2025-08-07`                      | `interleaved-thinking-2025-05-14`            |
| 3  | `interleaved-thinking-2025-05-14`            | `context-management-2025-06-27`              |
| 4  | `thinking-token-count-2026-05-13`            | `prompt-caching-scope-2026-01-05`            |
| 5  | `context-management-2025-06-27`              | `per-turn-control-2026-07-01`                |
| 6  | `prompt-caching-scope-2026-01-05`            | `mid-conversation-tool-changes-2026-07-01`   |
| 7  | `mid-conversation-system-2026-04-07`         | `inline-tools-2026-09-15`                    |
| 8  | `per-turn-control-2026-07-01`                | `advisor-tool-2026-03-01`                    |
| 9  | `mid-conversation-tool-changes-2026-07-01`   | `thinking-token-count-2026-05-13`            |
| 10 | `advisor-tool-2026-03-01`                    | `advanced-tool-use-2025-11-20`               |
| 11 | `advanced-tool-use-2025-11-20`               | `mid-conversation-system-clear-at-2026-08-21`|
| 12 | `mid-conversation-system-clear-at-2026-08-21`| `effort-2025-11-24`                          |
| 13 | `effort-2025-11-24`                          | `dangerous-tool-use-2026-09-03`              |
| 14 | `server-side-fallback-2026-07-01`            | `thinking-binding-controls-2026-08-01`       |
| 15 | `fallback-credit-2026-06-01`                 | `afk-mode-2026-01-31`                        |
| 16 | `dangerous-tool-use-2026-09-03`              | `cache-diagnosis-2026-04-07`                 |
| 17 | `thinking-binding-controls-2026-08-01`       | `message-threads-2026-08-12`                 |
| 18 | `afk-mode-2026-01-31`                        |                                              |
| 19 | `cache-diagnosis-2026-04-07`                 |                                              |

Delta:

- **Removed**: `context-1m-2025-08-07`, `mid-conversation-system-2026-04-07`,
  `server-side-fallback-2026-07-01`, `fallback-credit-2026-06-01`.
- **Added**: `inline-tools-2026-09-15`, `message-threads-2026-08-12`.
- **Moved**: `thinking-token-count-2026-05-13` from position 4 to after
  `advisor-tool-2026-03-01`.

The same 17-entry list was sent for `claude-sonnet-5-5` on 2.1.329.

#### Body

Top-level key order:

- 2.1.280: `model, messages, system, tools, metadata, max_tokens, thinking, context_management, safeguards, fallbacks, output_config, diagnostics, stream`
- 2.1.329: `model, messages, system, tools, metadata, max_tokens, thinking, context_management, safeguards, output_config, thread, diagnostics, stream`

`fallbacks: "default"` is gone and `thread: {"type":"create"}` is new. The
scalar bodies are otherwise identical across the two versions:
`max_tokens` 128000, `thinking` `{"type":"adaptive","display":"omitted"}`,
`context_management` `{"edits":[{"type":"clear_thinking_20251015","keep":"all"}]}`,
`output_config` `{"effort":"medium"}`, `diagnostics` `{"previous_message_id":null}`,
`stream` true, and `metadata.user_id` carrying the keys `device_id`,
`account_uuid` and `session_id`. `safeguards` carries a `dangerous_tool_use`
entry in both.

#### System blocks and billing header

The billing block (`system[0]`) gained `cc_prompt_index=0; cc_turn_index=1;`
after `cc_turn_origin=sdk;`:

- 2.1.280: `x-anthropic-billing-header: cc_version=2.1.280.790; cc_entrypoint=sdk-cli; cch=f8d59; cc_prompt_id=<id>; cc_turn_origin=sdk;`
- 2.1.329: `x-anthropic-billing-header: cc_version=2.1.329.e8c; cc_entrypoint=sdk-cli; cch=ca29e; cc_prompt_id=<id>; cc_turn_origin=sdk; cc_prompt_index=0; cc_turn_index=1;`

Block sizes, in characters: the billing block grows from 156 to 192 and
`system[2]` from 1,603 to 2,025; `system[3]` is 4,135 on 2.1.280 and 5,179
(opus-5-5) or 4,912 (sonnet-5-5) on 2.1.329. `system[1]` is the 62-character
Agent SDK sentence in both, and `system[2]` carries
`cache_control {"type":"ephemeral","scope":"global"}` in both.

#### Findings

- **`cch` is not static on the wire.** On both versions the `cch=` value is a
  5-hex value that varies per request (`cch=f8d59` on 2.1.280; `cch=ca29e` and
  `cch=9f390` on 2.1.329), **not** the `cch=00000` literal present in the JS
  bundle. This contradicts the static-`cch` assumption of this package; it is
  an observation about the genuine client, not a defect of this package's
  documented model. Interpretation:
  - `[BIN]` The JS writes only the literal `cch=00000;` (gate: first party and
    the first-party base URL, or Vertex). No JS code rewrites it; searches for
    `cch=`, attestation and body rewrites in the fetch path found nothing.
  - `[BIN]` The only other `cch` code (`fyl`, offset 9858464) is used by the
    nested-call relay (offset 23416832). It re-encodes `cch=` as `cch\u003d` in
    forwarded bodies.
  - `[DER]` Assumption: something below JS rewrites the literal bytes
    `cch=00000` in the serialised body, in place and at the same length, and
    the relay escapes `cch=` so nested bodies are not rewritten twice. The most
    economical reading is native substitution by the Bun runtime over the
    serialised request body.
  - `[UNR]` The algorithm that produces the 5-hex value is not recoverable
    from the JS. (`Bun.hash.xxHash64` at offset 19089031 is a cache key, not
    this.)
  - `[LIVE]` The plugin sent `cch=00000` and was accepted (200), so the value
    is not enforced today, but the request is distinguishable from the genuine
    client.
- **The fingerprint algorithm and salt are unchanged.** The `cc_version`
  suffix matches this package's algorithm applied to the user's prompt text
  `hello`: 2.1.280 → `790`, 2.1.329 → `e8c`.
- **The mid-conversation system message is still sent.** In 2.1.329 the
  mid-conversation `role:"system"` message (SessionStart hook context) is still
  in `messages`, while the `mid-conversation-system-2026-04-07` beta is no
  longer sent.
- **Tool definitions.** Tool definitions carry `eager_input_streaming`. A
  `DeferredToolPlaceholder` tool and an `advisor_20260301` server tool are sent
  with `defer_loading: true`. The same 16 tools are sent on both versions;
  their serialised size grows from 39,371 to 44,813 JSON bytes (opus-5-5).

### 4.2 Plugin (opencode + opencode-anthropic-fix, 2.1.280 profile) against genuine 2.1.329

The plugin capture is the `main` request of
`opencode run "hello" -m anthropic/claude-sonnet-5-5` with OAuth. The
comparison is against the genuine 2.1.329 `sdk-cli` / API-key capture for the
same model.

| Aspect | Plugin | Genuine 2.1.329 |
| ------ | ------ | --------------- |
| Version identity | `User-Agent: claude-cli/2.1.329 (external, cli)` and `cc_version=2.1.329.e8c` (from the plugin's startup version lookup), **with** `x-stainless-package-version: 0.112.1` and `x-stainless-runtime-version: v26.3.0` (2.1.280 values) | `claude-cli/2.1.329`, `0.128.0`, `v26.12.1`. The plugin's combination is never produced by a genuine build |
| Beta list | still includes `mid-conversation-system-2026-04-07` | no longer sent |
| `Accept` | `*/*` | `application/json` |
| Header name casing | lowercase `x-stainless-*` and `x-claude-code-session-id` | `X-Stainless-*` and `X-Claude-Code-Session-Id` |
| Host-leaked headers | `x-opencode-client`, `x-opencode-project`, `x-opencode-session`, `x-opencode-session-id`, `x-session-id` are present on the wire to `api.anthropic.com` | none |
| Body key order | `model, max_tokens, system, messages, tools, thinking, output_config, stream, metadata` | `model, messages, system, tools, metadata, max_tokens, …` |
| `cch` | `cch=00000` | a varying 5-hex value |
| Thinking and sizing | `thinking.display: "updates"`, `effort: "high"`, `max_tokens: 64000` | `display: "omitted"`, `effort: "medium"`, `max_tokens: 128000` |

#### Comparison limits

Authentication mode and entrypoint differ between the two sides, so
differences that depend on OAuth against an API key (for example
`oauth-2025-04-20`, the 1-hour cache TTL, `extended-cache-ttl-2025-04-11`) or on
print mode (`afk-mode`, and `dangerous-tool-use` / `safeguards` in auto
permission mode) are **not conclusive**. The findings above are limited to
differences that do not depend on either.

---

### 4.3 Genuine OAuth captures `[LIVE]`

> **Amendment 2026-11-19 (OAuth captures).** After the local OAuth session was
> renewed, three further genuine captures were taken: an interactive `cli`
> request, an auxiliary quota probe and a `-p` (`sdk-cli`) request, all as an
> OAuth subscriber on `claude-opus-5-5`, plus the `claude auth login --claudeai`
> exchange. They supersede the API-key caveat of §4.0 for everything below.
> Identifiers, tokens and local paths are scrubbed; every id is written
> `<uuid>`. Where this section contradicts §5.2 or §5.5 (`[DER]`), this section
> wins.

**Headers (interactive, wire order).** `Accept: application/json`, then
`Authorization` capitalised (it sits between `Accept` and `Content-Type`), then
`Content-Type`, `User-Agent`, `X-Claude-Code-Session-Id`, the `X-Stainless-*`
set (`Arch`, `Lang`, `OS`, `Package-Version` `0.128.0`, `Retry-Count`,
`Runtime`, `Runtime-Version` `v26.12.1`, `Timeout`), then the lowercase block:
`anthropic-beta`, `anthropic-dangerous-direct-browser-access`,
`anthropic-dispatch-id` (`v2d`), `anthropic-version`, `x-app`,
`x-claude-1p-request-class` (`main`), `x-claude-code-prompt-id`,
`x-claude-code-request-class` (`main`), `x-claude-code-sandy-plover` (`[]`
when no tool was used), `x-client-request-id`. The auxiliary quota probe
(haiku, `max_tokens: 1`) carries no `claude-code` beta, request class
`auxiliary`, 1p class `summary-extraction`, and neither `anthropic-dispatch-id`
nor a prompt id.

**Billing line, interactive.**
`x-anthropic-billing-header: cc_version=2.1.329.e8c; cc_entrypoint=cli; cch=<5 hex>; cc_prompt_id=<uuid>; cc_turn_origin=human; cc_prompt_index=1; cc_turn_index=1;`
The `-p` request carries `cc_turn_origin=sdk; cc_prompt_index=0; cc_turn_index=1;`
and `cc_entrypoint=sdk-cli`. `cch` is a per-request value in both, which is why
the maintainer decision of §2.3 keeps `cch=00000` as the default and adds an
optional seam.

**Default beta composition, interactive (20 identifiers, wire order).**
`claude-code`, `oauth`, `interleaved-thinking`, `context-management`,
`prompt-caching-scope`, `per-turn-control`, `mid-conversation-tool-changes`,
`inline-tools`, `advisor-tool`, `thinking-token-count`, `advanced-tool-use`,
`mid-conversation-system-clear-at`, `effort`, `dangerous-tool-use`,
`thinking-binding-controls`, `thinking-display-updates`, `afk-mode`,
`extended-cache-ttl`, `cache-diagnosis`, `message-threads`. The `-p` list is the
same without `thinking-display-updates`. The 1h cache TTL and
`extended-cache-ttl` are on by default; thinking is `adaptive` with display
`updates` (interactive) or `omitted` (`-p`).

**`tool-provenance-2026-10-26` is absent from both OAuth captures**, which
contradicts §5.2 and §5.5 (`[DER]`). The port therefore treats it as an
opt-in, account-served feature, off by default.

**Body order (both).** `model, messages, system, tools, metadata, max_tokens,
thinking, context_management, safeguards, output_config, thread, diagnostics,
stream`. `context_management` is generated
(`{"edits":[{"type":"clear_thinking_20251015","keep":"all"}]}`), `thread` is
`{"type":"create"}`, `diagnostics` is `{"previous_message_id":null}`,
`output_config` is `{"effort":"medium"}`. Source: view lines 158392-158394
(`@20154922`-`@20155417`); the call that assembles it is `NBn` at view line
158372 (`@20148818`).

**Inline-tools body coupling.** With `inline-tools-2026-09-15` on the wire, the
`-p` capture carries `role: "system"` entries in `messages` whose content holds
`tool_addition` blocks (the last one carrying the 1h cache marker), and the
`advisor` tool (`advisor_20260301`, deferred) is appended last in `tools`. The
header alone is therefore a half port of the feature; this package emits the
header only.

**OAuth login.** The authorize URL of `claude auth login --claudeai` requests
the scopes `org:create_api_key user:profile user:inference
user:sessions:claude_code user:mcp_servers user:file_upload user:plugins
user:privacy_consents:write org:desktop_config`. The token exchange is a JSON
POST made by `axios/1.15.2` (`Accept: application/json, text/plain, */*`,
`Content-Type: application/json`, no `anthropic-beta`), body keys
`grant_type, code, redirect_uri, client_id, code_verifier, state`. The follow-up
profile, roles and bootstrap requests use `User-Agent: claude-code/2.1.329`.

**Server-served capability.** `acceptsForcedToolChoice` reads a capability the
server supplies, not the static catalogue (view line 154029, `@19042742`), so a
forced-`tool_choice` refusal demotion cannot be modelled from the bundle.

#### 4.3.1 Per-turn effort control message `[BIN]`

The genuine client changes effort mid-conversation without rewriting the cached
prefix by inserting a `role: "system"` entry into `messages`. Transcribed from
the bundle:

- `tRt` (view lines 157741-157742, `@19965809`) walks the conversation and,
  where the effort for a turn differs from the effort in force, queues an
  `outputConfig` of `{ effort?, timing?: { type: "now", now } }`. If the next
  entry is already an `api_system` message it attaches the `outputConfig` to it
  (`{...z, outputConfig: A}`); otherwise it pushes `A5n(A)`.
- `A5n(e)` (view line 157748, `@19967585`) is
  `{...QEe(""), outputConfig: e}`: an `api_system` message with empty content.
- The wire mapping (view lines 158726-158727, `@20255444`) emits
  `{role: "system", content: <blocks or []>, output_config: <outputConfig>}`.
  For the empty statement `content` is `[]` (`Pn || []`); with tool additions it
  is the block list. `output_config` is omitted when there is no `outputConfig`.
- The `per-turn-control-2026-07-01` beta is registry key `per_message_effort`
  (`TV` at view line 109433). It is gated by the catalogue capability
  `per_turn_effort`, which 2.1.329 declares on `claude-haiku-5-5`,
  `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-fable-5-1`, `claude-fable-5-2`
  and `claude-mythos-5-2`.

Wire shape, for a one-statement conversation:

```
{"role":"system","content":[],"output_config":{"effort":"medium"}}
```

Library handling: `messages` validation accepts exactly this shape on 2.1.329
and passes it through verbatim (`role`, `content`, `output_config` in that
order; `output_config` limited to `effort` and a `timing` of
`{type: "now", now}`), refuses it on every other profile as before, and refuses
it on count-tokens. The type of `now` is not established by the bundle; the
package accepts a short string or a finite number.

Not transcribed in this pass: the normalizer `NK`, the date guard `V2e`, the
billing template and integer guard, the turn-position helper `Xno`, the
sandy-plover helpers `ka`/`yp`/`bao`/`_p`/`Aa`/`va`, and the per-request beta
table `CW`. They are required by later commits (C11, C13, C9, C18) and are
transcribed there.

## 5. Beta surface

Evidence here is `[BIN]` unless marked. Offsets index `cc-2.1.329.full.js`.

### 5.1 The registry: 48 raw slots

The ordered registry array `a1i` (offset 7883248) has **48 raw slots** (42 in
2.1.280). The extractor's printed list in §3.2 omits null slots and the
header-less slot, so this table uses the **raw slot number**. Of 48 slots, 45
carry a header (library registry: 40 − 1 + 6 = 45 entries).

| Slot  | Feature key(s)                                                                                        | Header(s)                                                                                                                                                 | vs 2.1.280                          |
| ----: | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 0–6   | `claude_code`, `oauth_auth`, `interleaved_thinking`, `long_context`, `context_management`, `structured_outputs`, `web_search` | as 2.1.280                                                                                                                                | same                                |
| 7     | `web_search_results_only`                                                                             | `web-search-results-only-2026-11-15`                                                                                                                      | NEW                                 |
| 8–13  | `tool_search` ×2, `effort`, `task_budgets`, `prompt_caching_scope`, `prompt_caching_evict`           | `advanced-tool-use-2025-11-20`, `tool-search-tool-2025-10-19`, `effort-2025-11-24`, `task-budgets-2026-03-13`, `prompt-caching-scope-2026-01-05`, `prompt-caching-evict-2026-05-12` | +1                                  |
| 14    | `cache_keepalive`                                                                                     | `cache-keepalive-2026-09-03`                                                                                                                              | NEW                                 |
| 15–18 | `extended_cache_ttl`, `speed`, `redact_thinking`, `thinking_resumption`                              | `extended-cache-ttl-2025-04-11`, `fast-mode-2026-02-01`, `redact-thinking-2026-02-12`, `thinking-resumption-2026-07-17`                                  | +2                                  |
| 19    | `resumption`                                                                                          | `resumption-2026-10-08`                                                                                                                                   | NEW                                 |
| 20–28 | `thinking_token_count`, `afk_mode`, `advisor_tool`, `cache_diagnosis`, `context_hint`, `mcp_servers`, `files_api`, `environments`, `ccr_byoc` | headers unchanged                                                                                                                       | +3                                  |
| 29    | `ccr_tool_provenance`                                                                                 | `tool-provenance-2026-10-26`                                                                                                                              | NEW                                 |
| 30    | `mid_conversation_system`                                                                             | **`null`** (`pl()`)                                                                                                                                       | was 26; header graduated            |
| 31–35 | `per_message_effort`, `per_turn_timing`, `mid_conv_tool_change`, `inline_tools`, `server_side_fallback` | `per-turn-control-2026-07-01`, `timing-2026-09-09`, `mid-conversation-tool-changes-2026-07-01`, `inline-tools-2026-09-15`, `server-side-fallback-2026-06-01` | +4                                  |
| 36    | `program_use_case_ids`                                                                                | `program-use-case-ids-2026-09-17`                                                                                                                         | NEW                                 |
| 37–38 | `server_side_fallback_category`, `fallback_credit`                                                    | `server-side-fallback-2026-07-01`, `fallback-credit-2026-06-01`                                                                                           | +5                                  |
| 39    | (null, `yBn`)                                                                                         | none                                                                                                                                                      | inherited null (was 34, `kAt`)      |
| 40    | `auto_mode_classifier`                                                                                | `auto-mode-classifier-2026-07-16`                                                                                                                         | +5                                  |
| 41    | `claude_code_side_query`                                                                              | `claude-code-side-query-2026-09-29`                                                                                                                       | NEW                                 |
| 42    | `dangerous_tool_use`                                                                                  | `dangerous-tool-use-2026-09-03`                                                                                                                           | +6                                  |
| 43    | (null, `ml`)                                                                                          | none                                                                                                                                                      | inherited null (was 37, `hZt`)      |
| 44–47 | `thinking_display_updates`, `message_threads`, `mid_conversation_system_clear_at`, `thinking_binding_controls` | unchanged                                                                                                                              | +6; binding-controls still last     |

The slot numbers here are raw positions, as in the §3.2 prose (nulls at 39 and
43, header-less slot 30); only the `Index` column of the §3.2 table is the
extractor's print order. The null slots have the same neighbours as in 2.1.280,
and `yBn` keeps a null-guarded consumer (`SPs`, offset 20393159) of the same
shape as the 2.1.280 `kAt` consumer.

**Non-beta members of the surrounding constants.** The two
`mid_conv_cache_promotion*` keys (`$kr`, `o1i`) are still declared outside the
array and are used only as conversation latch keys
(`ed(Gt,$kr)`, `Ah(Gt,o1i)`, offsets 20152618 and onward). They are never
headers, which resolves the 2.1.280 §4.3 `[UNR]` (see §13). New latch-only
members: `r1i` (`x-cc-internal-tool-provenance-server-url`) and
`i1i = pl("thinking_display")`. `summarize-connector-text` (NARRATION_SUMMARIES)
is still absent from the registry.

### 5.2 The six new betas

| Beta                                 | Emission gate                                                                                                                                                                                                                                      | Default verdict                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `tool-provenance-2026-10-26`         | Per-request table entry `{beta:z$,when:()=>kW()}` (offset 9417510). `kW()` = `B_s() && Dt("tengu_snappy_noodle", firstParty)`; client default true. Kept by the `Sdi` latch filter (offset 15687460), dropped late if not direct first party (offset 20143800). | **On for interactive OAuth subscribers** `[DER]`; off for API-key sessions `[LIVE]` |
| `claude-code-side-query-2026-09-29`  | Non-main requests: one-shot helpers, hook agents, title generation (`generate_session_title`), `artifact_comment_*`, resume cache warm, WebSearch nested request. Requires first party, experimental betas allowed, direct or Unix-socket base URL (offsets 20143800, 20149626, 20261667). | Never on the main request                                |
| `cache-keepalive-2026-09-03`         | `if(EM&&!za.includes(ND))za.push(ND)` (offset 20149626); `EM=jXt(…)` requires remote flag `tengu_sequential_cloud` (default false), 1h subscriber TTL, interactive OAuth subscriber, direct first party, policy `allow_cache_keepalive`. Main loop only. | Off (flag default false); account-served                 |
| `resumption-2026-10-08`              | `lRt()` = first party, experimental betas allowed, `tengu_peaceful_wigderson` default false; replaces `thinking-resumption` when active (offset 20147965).                                                                                       | Off                                                      |
| `program-use-case-ids-2026-09-17`    | `CLAUDE_CODE_PROGRAM_USE_CASE_ID` / stamp env, or `V$()` = `tengu_federated_possum` default false. Body field `program_use_case_id`.                                                                                                             | Off                                                      |
| `web-search-results-only-2026-11-15` | Only the WebSearch tool's nested request (`querySource:"web_search_tool"`), which needs `tengu_nifty_quasar`-derived `main_chars>=1`; default null → 0.                                                                                            | Never on the main request                                |

Notes on `tool-provenance`:

- `B_s()` requires first party, the first-party base URL, experimental betas
  allowed, **no API key or a Claude subscription OAuth** (`t$n()==="none"||Ot()`),
  no `CCR_SESSION_PROFILE`, not mid-login, and
  `(!CLAUDE_CODE_REMOTE || tengu_woven_kestrel)`.
- It applies to every request built from the shared beta list (main loop,
  subagents, compaction); not to the side-query helper, not to `count_tokens`.
- Body coupling: MCP tools (`mcp__*`) get
  `ownership_metadata:{verified:false,owner:"mcp",server_url?}`; built-in tools
  are unchanged (§6.5).
- `[UNR]` minor: `BZ` is true for an unset `ANTHROPIC_BASE_URL`; whether
  `kSe()` can be non-undefined was not traced.
- `[UNR]` no genuine OAuth capture exists, so default-on for OAuth rests on
  `[DER]` alone.

`cache-keepalive` is coupled to a response header (`anthropic-cache-keepalive`)
and the endpoint `/v1/messages/cache_touch` (§8.1).

### 5.3 `mid-conversation-system` graduated, and the condition is still live

Slot 30 is `mid_conversation_system`, declared with `pl()` and `header:null`;
the literal survives as constant `Zkt` (§3.2). Consequences, each `[BIN]`:

- **Header.** `FH(e)` drops header-null entries; the wire betas are
  `pit(tl)`, so the identifier is never sent (offsets 7884848, 20154922). The
  `ANTHROPIC_BETAS` handler logs that the beta is generally available and
  skips it (offset 9418025). `[LIVE]` confirms it absent.
- **Model check no longer reads the catalogue.** The chain
  `db → rw → sw` (offsets 9413801–9414628) is:

  ```js
  function rw(e,r){return!go("hipaa")&&sw(e,r)}
  function sw(e,r){if(s.CLAUDE_CODE_FORCE_MID_CONVERSATION_SYSTEM)return!0;
    let o=Mst(e,"mid_conversation_system");if(o!==void 0)return o;
    let g=_t(e);if(Hje(Tj(g),"claude-opus-4-8"))return!1;
    return PE(g,"mid_conv_system",e,r)??!0}
  ```

  `PE` (offset 6888000) returns an env override, a caller override or the
  catalogue answer; the catalogue lookup returns true or undefined, never
  false. With defaults, `sw` therefore means "the model is not older than
  `claude-opus-4-8`". `Hje` matches `claude-3-*` or any id before
  `claude-opus-4-8` in the ordering list `EA` (offset 9287599): `claude-3-*`,
  `opus-4-0`, `sonnet-4-0`, `opus-4-1`, `sonnet-4-5`, `haiku-4-5`, `opus-4-5`,
  `opus-4-6`, `sonnet-4-6`, `opus-4-7`. That list is identical to this package's
  fallback exclusion list in `src/model-capabilities.ts`. No 2.1.329 catalogue
  entry carries `mid_conv_system` (§3.3).
- **Tool-changes still depend on the marker.** The per-model table entry
  `{beta:fS,when:(e)=>db(e.model)}` (offset 9417510) still composes the marker
  into `Pn`. The tool-change gate `CRe` (offset 9414097) is unchanged from the
  2.1.280 `Tue`; `Q6a` / `PPn` / `z` drop tool-changes if the marker was
  latched as rejected (offset 15935856).
- **Clear-at still depends on the marker.** Offset 20112345:
  `let tr=!Vx(ie.querySource)&&!Ha&&Pn.includes(fS)&&Le(()=>KWe(So??ie.model));if(tr&&!Pn.includes(_4))Pn.push(_4);`.
  `KWe` → `tvs` (offset 20002472) requires first party and experimental
  betas; the scope flag `tengu_sleepy_snowflake` defaults to `"all"`, so clear-at
  is on by default. (A different function also named `KWe`, at offset 6921272,
  is credential storage and unrelated.)

In short, the library's three-way coupling (site 11 pushes the header, 11b and
11c key on "mid-conversation system active") survives upstream; only the header
push stops. Porting needs the registry key to be optional and the catalogue
branch of `supportsMidConversationSystem` to be skipped for 2.1.329, otherwise
all three headers are lost (§10).

**Pre-existing divergence, not this cycle's.** 2.1.280's `Sw` fell back to
"`claude-mythos-5` → true" and then to the provider default (2.1.280 offset
6989075); the 2.1.280 profile already disagrees with upstream for
`claude-mythos-5` (empty capability array). This is recorded in §13.

### 5.4 Composition pipeline

- **Per-model table `wW`**, 10 entries: claude-code, oauth, 1M, interleaved,
  redact, context-management, structured, web-search, prompt-caching-scope (gate
  now `eQ()` and adds the first-party base-URL check `la()`), and the `fS`
  marker. Versus 2.1.280's `kw`, the thinking-token-count entry is gone.
- **Per-request table `CW`**: `[TV, r5, mk, cb, z$, …[]]`. `z$` (tool-provenance)
  is new and last; the table grows from 4 to 5 entries.
- **`uwr`**: per-model list → `XM` (program-use-case) → `CW` → SDK betas.
- **Builder**: `XM` fallback → advisor → **thinking-token-count**
  (`if(Le(()=>y7t($t))&&un.thinking.supported&&!Pn.includes(Rj))Pn.push(Rj)`)
  → `Q6a`/`Sdi` → tool-search beta → latch filter → clear-at.
- **Per-attempt step `eUo`**: side-query and results-only → effort → task-budgets,
  structured, fallbacks, dangerous → binding-controls → display-updates (plus the
  `VM()` redact removal) → resumption → fast → afk → TTL → context-hint → evict →
  cache-diagnosis → keepalive → threads.
- **Final**: `BT` drops refused latches, `tl=Pyo(BT)` applies the third-party
  allowlist, `pit(tl)` produces the wire list.
- **Redact removal is unchanged** (offset 20147180): `VM` removes the composed
  `redact-thinking` identifier when display mode is `connector_text`; display
  mode `YYn` follows `CLAUDE_CODE_THINKING_DISPLAY_UPDATES ?? true`.
- **Cache-diagnosis** `r9n` (offset 20086149) has the same meaning as 2.1.280's
  `ppr`; `cacheDiagnosisEnabled` stays true.
- **`thinking-token-count` moves.** In 2.1.280 it was a per-model table entry
  (position 4 on the wire). In 2.1.329 that entry is gone and the builder pushes
  it after the per-request betas (tool-changes, tool-provenance) and before
  clear-at (`[LIVE]`: after `advisor-tool`, before `advanced-tool-use`).
- **`context-1m`** is now `cS(m) && !iO(m,{byItsOwnName:!0})` (offsets 9417000,
  9403344): it is not sent for natively-1M models. `[LIVE]` for both 5.5 models;
  `[UNR]` for what the new `!iO(…)` conjunct excludes beyond those.

The library's 22 push steps against 2.1.329:

| #     | Step                                                                | 2.1.329                                          |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------ |
| 1–5   | CLAUDE_CODE, OAUTH, LONG_CONTEXT, INTERLEAVED, REDACT               | unchanged (LONG_CONTEXT skips natively-1M models) |
| 6     | THINKING_TOKEN_COUNT                                                | **moved**: after 11b and tool-provenance, before 11c |
| 7–10  | NARRATION, CONTEXT_MANAGEMENT, STRUCTURED, PROMPT_CACHING_SCOPE      | unchanged (NARRATION inert)                      |
| 11    | MID_CONVERSATION_SYSTEM                                             | header not sent; condition stays live            |
| 11a   | PER_MESSAGE_EFFORT                                                  | unchanged                                        |
| 11b   | MID_CONV_TOOL_CHANGE                                                | unchanged                                        |
| new   | TOOL_PROVENANCE                                                     | between 11b and the moved step 6                 |
| 11c   | CLEAR_AT                                                            | unchanged                                        |
| 12–17 | EFFORT, binding-controls, display-updates (+removal), SPEED, AFK, TTL, CONTEXT_HINT, CACHE_DIAGNOSIS | unchanged |

### 5.5 `[DER]` default main request

Assumptions: `claude-opus-5-5` or `claude-sonnet-5-5`, first party, subscription
OAuth, interactive, adaptive thinking, no caller display override, first request,
shipped remote-flag defaults.

```
claude-code-20250219, oauth-2025-04-20, interleaved-thinking-2025-05-14,
context-management-2025-06-27, prompt-caching-scope-2026-01-05,
per-turn-control-2026-07-01, mid-conversation-tool-changes-2026-07-01,
tool-provenance-2026-10-26, thinking-token-count-2026-05-13,
mid-conversation-system-clear-at-2026-08-21, effort-2025-11-24,
thinking-binding-controls-2026-08-01, thinking-display-updates-2026-08-18,
[extended-cache-ttl-2025-04-11 when the TTL is 1h], cache-diagnosis-2026-04-07
```

That is 14 identifiers at a 5m TTL and 15 at 1h. Subscription OAuth users on
the main thread get a **1h TTL by default** (`ZHe` / `VSt`, offset 20075477, and
the same in 2.1.280), so `extended-cache-ttl-2025-04-11` normally follows
`thinking-display-updates` and the list has 15 entries `[DER]`. The 2.1.280
analysis's "5m" was a scenario assumption (§13). Account-served flags insert
`inline-tools` after `mid-conversation-tool-changes`, `advisor-tool` before
`thinking-token-count`, and `message-threads` last (§5.9).

### 5.6 Auxiliary sets

| Set                                          | 2.1.329                                                                                                           | vs 2.1.280                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Third-party allowlist `cw` (offset 9419770)  | 15 members, 14 with a header                                                                                      | −`mid-conversation-system`, +`thinking-display-updates-2026-08-18`; the old conditional member is now plain `Rj` |
| `count_tokens` set `bBn`                     | claude-code, interleaved, context-management, oauth                                                               | unchanged (4)                                                              |
| Bedrock-unsupported set `Bkr`                | interleaved, 1M, tool-search-tool                                                                                 | unchanged (3)                                                              |
| New set `rbs` (23 non-null members)          | oauth, advisor, afk, keepalive, side-query, 1M, context-hint, dangerous, fallback-credit, inline-tools, threads, clear-at, tool-changes, per-turn-control, timing, program-use-case, both fallbacks, structured, binding-controls, thinking-resumption, both tool-search betas | NEW. Skipped by the generic "refused → strip" filter (`ql`) and by the generic 400 handler. Reference data only |

### 5.7 Maturity matrix

Forty-five header-bearing betas. A *GA candidate* is one dated before 2025-11-19
and emitted unconditionally.

| Beta                                                    | Default-path emission                                                       | GA candidate |
| ------------------------------------------------------- | --------------------------------------------------------------------------- | ------------ |
| `claude-code-20250219`                                  | yes (not Haiku)                                                             | yes          |
| `oauth-2025-04-20`                                      | yes (OAuth)                                                                 | yes          |
| `interleaved-thinking-2025-05-14`                       | yes (capable models)                                                        | yes          |
| `context-1m-2025-08-07`                                 | conditional (`[1m]`; new `!iO(byItsOwnName)` conjunct `[UNR]`)              | no           |
| `context-management-2025-06-27`                         | yes (first party, not claude-3)                                             | yes          |
| `structured-outputs-2025-12-15`                         | no (`tengu_tool_pear` default false)                                        | no           |
| `web-search-2025-03-05`                                 | no (Vertex / Foundry only)                                                  | no           |
| `web-search-results-only-2026-11-15`                    | no                                                                          | no           |
| `advanced-tool-use` / `tool-search-tool`                | conditional (tool search active; separate push) `[UNR]` whether the 2.1.280 doc missed this push | no |
| `effort-2025-11-24`                                     | yes (model supports effort)                                                 | no (date)    |
| `task-budgets-2026-03-13`                               | no (caller `taskBudget`)                                                    | no           |
| `prompt-caching-scope-2026-01-05`                       | yes                                                                         | no           |
| `prompt-caching-evict-2026-05-12`                       | no                                                                          | no           |
| `cache-keepalive-2026-09-03`                            | no (`tengu_sequential_cloud`)                                               | no           |
| `extended-cache-ttl-2025-04-11`                         | conditional (1h; the subscriber default)                                    | no           |
| `fast-mode-2026-02-01`                                  | no (caller `fastMode`)                                                      | no           |
| `redact-thinking-2026-02-12`                            | composed then removed                                                       | no           |
| `thinking-resumption-2026-07-17`                        | no (flag)                                                                   | no           |
| `resumption-2026-10-08`                                 | no (`tengu_peaceful_wigderson`)                                             | no           |
| `thinking-token-count-2026-05-13`                       | yes (new position)                                                          | no           |
| `afk-mode-2026-01-31`                                   | no (auto mode)                                                              | no           |
| `advisor-tool-2026-03-01`                               | **off by code default** (`tengu_sage_compass2` defaults to `{enabled}` true only for AWS and Google Cloud providers); **served to the captured account** | no |
| `cache-diagnosis-2026-04-07`                            | yes                                                                         | no           |
| `context-hint-2026-04-09`                               | no `[UNR]` not re-traced                                                    | no           |
| `mcp-servers` / `files-api` / `environments` / `ccr-byoc` | not on the messages path                                                    | no           |
| `tool-provenance-2026-10-26`                            | yes (OAuth) `[DER]`                                                         | no           |
| `per-turn-control-2026-07-01`                           | yes (`per_turn_effort` capability)                                          | no           |
| `timing-2026-09-09`                                     | no (env `CLAUDE_CODE_PER_TURN_TIMING`)                                      | no           |
| `mid-conversation-tool-changes-2026-07-01`              | yes                                                                         | no           |
| `inline-tools-2026-09-15`                               | **off by code default** (`tengu_brisk_meadow` false); **served to the captured account** | no |
| `server-side-fallback` ×2, `fallback-credit`            | no (caller-driven; suppressed while threaded `[DER]`)                       | no           |
| `program-use-case-ids-2026-09-17`                       | no                                                                          | no           |
| `auto-mode-classifier-2026-07-16`                       | no `[UNR]`                                                                  | no           |
| `claude-code-side-query-2026-09-29`                     | no on main; yes on title and other side queries                             | no           |
| `dangerous-tool-use-2026-09-03`                         | no (caller `serverClassifier`; auto permission mode in `-p`)                | no           |
| `thinking-display-updates-2026-08-18`                   | yes (and removes redact)                                                    | no           |
| `message-threads-2026-08-12`                            | **off by code default** (`tengu_curious_tower` false); **served to the captured account** `[UNR]` partly | no |
| `mid-conversation-system-clear-at-2026-08-21`           | yes                                                                         | no           |
| `thinking-binding-controls-2026-08-01`                  | yes                                                                         | no           |

`mid-conversation-system-2026-04-07` is not in the matrix: its header is
retired (§5.3).

### 5.8 Removed and graduated strings

- **Dated strings added**: exactly the six new betas of §5.2.
- **Dated strings removed**: `compact-2026-01-12` existed only inside embedded
  Go-SDK documentation text (2.1.280 offset 41958469) and was never a Claude
  Code request beta. `1.63.0-alpha-2026-08-05` and a Go `Betas:` documentation
  line are likewise documentation text. **None of the removed dated strings was
  a request beta.**
- **Server-tool versions**: no standalone addition or removal.
  `clear_tool_uses_20250919` and `advisor_20260301` appear in log and
  documentation text; `web_search_20250305` is still used. No change in the
  `code_execution_`, `text_editor_`, `bash_`, `memory_`, `tool_search_tool_`,
  `computer_` or `web_fetch_` families.
- **Graduated**: only `mid-conversation-system-2026-04-07` (§5.3).

### 5.9 Reconciling §5 with the live capture (§4)

The `-p` API-key capture and the code-default list of §5.5 differ in exactly the
ways the gates predict:

- **`tool-provenance` is absent live** because `B_s()` requires no API key or a
  subscription OAuth; the capture used an API key (`Sdi` strips it,
  offset 15687460) `[LIVE]` `[BIN]`.
- **`inline-tools`, `advisor-tool` and `message-threads` are live but are not
  code defaults.** Each is an **account-served remote flag**
  (`tengu_brisk_meadow` at offset 9262414, `tengu_sage_compass2`,
  `tengu_curious_tower`). The verdicts are "off by code default; served to this
  account". A different account may not receive them.
- **`dangerous-tool-use` and `afk-mode` are live** because the capture ran in
  auto permission mode with `safeguards` in print mode; they are conditional on
  permission mode, not unconditional.
- **`advanced-tool-use` is live** because tool search was active.
- **`thinking-display-updates` is absent live** because print mode supplies
  `display:"omitted"` (§6.7).
- **`extended-cache-ttl` is absent live** because an API-key session does not get
  the subscriber 1h TTL (§8.3).
- **`context-1m` is absent live** for the natively-1M models (§5.4).
- **`server-side-fallback-2026-07-01` and `fallback-credit-2026-06-01` are gone
  live** and so is the body field `fallbacks`: both are suppressed for threaded
  requests (`R8r` requires `!e.threadedRequest`, offsets 19745970–19746524)
  `[DER]`.

The captured order matches the push order in the code, site by site
(per-model table at offset 9416745–9417751, per-request table with
`inline-tools` and `tool-provenance` at 9417510, advisor and
`thinking-token-count` at 20099939, `advanced-tool-use` at 20105773,
clear-at at 20112637, effort at 20144445, dangerous-tool-use at 20146113,
binding-controls at 20146871, afk-mode at 20149354, cache-diagnosis at 20149626,
message-threads at 20150366) `[BIN]` `[LIVE]`.

---

## 6. Headers, body and system prompt

Evidence classes as marked. `[LIVE]` rests on the §4.0 caveat (`-p`, API key).

### 6.1 Headers

**Wire order and capitalisation `[LIVE]`.** Headers are emitted sorted by name,
case-sensitively (capitals first), with the runtime appending `Accept-Encoding`
last: `Accept`, `Content-Type`, `User-Agent`, `X-Claude-Code-Session-Id`,
`X-Stainless-*`, `anthropic-beta`, `anthropic-dangerous-direct-browser-access`,
`anthropic-dispatch-id`, `anthropic-version`, `x-api-key`, `x-app`, the
`x-claude-*` family, `x-client-request-id`, `Accept-Encoding`. The order and the
capitalisation (`X-Claude-Code-Session-Id`, `X-Stainless-*`) are identical on
2.1.280. The SDK sends `Accept: application/json`. HTTP/1.1 makes the case
visible on the wire. This package's `src/headers.ts` emits lowercase names and no
`Accept`, and the plugin capture shows `Accept: */*`, lowercase names and a
different order: pre-existing divergences, not new in 2.1.329.

For OAuth, the SDK writes `{Authorization:`Bearer …`}` (offset 13665578)
`[DER]` so it sorts between `Accept` and `Content-Type`. `[UNR]` exact case and
slot of `Authorization` (no genuine OAuth capture).

**Unchanged values `[BIN]`.** `User-Agent: claude-cli/2.1.329 (external, <entrypoint>)`
(offsets 9540435–9541395), where the capture shows `sdk-cli` and interactive is
`cli`; the second `claude-cli/` occurrence is the gateway `/managed/settings`
check (offset 8749387), not `/v1/messages`. `X-Stainless-Package-Version`
0.128.0 (`var TL="0.128.0"`, offset 11000819) and, per the live capture,
`X-Stainless-Runtime-Version` v26.12.1 (was v26.3.0). `x-app: cli`, retry-count
0, timeout 600 (a server-supplied `api_timeout_ms` could change it, offset
13831581), `anthropic-version: 2023-06-01`, browser-access true,
`x-client-request-id` set by `XRt` (offset 20081083) and the fetch wrapper
(offset 13838518), `traceparent` only when tracing. The plugin sends 0.112.1 and
v26.3.0 with a 2.1.329 UA, a combination no genuine build produces.

**The `x-claude-*` / `anthropic-dispatch-id` family.**

| Header                                  | Gate                                                                                                                                                                                                    | Value                                                          | Status                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `x-claude-code-request-class`           | `Iso()`: no env override and `hs()` = first party plus default base URL (offsets 13732803, 6896341); same gate in 2.1.280                                                                              | `main`                                                         | `[LIVE]` both versions; pre-existing library omission |
| `x-claude-1p-request-class` (new)       | same gate; value constant `lgl` (offset 9306921)                                                                                                                                                        | `main`                                                         | `[LIVE]` 2.1.329                                 |
| `x-claude-code-prompt-id` (new)         | same gate plus a valid prompt id (offset 13818619)                                                                                                                                                      | the turn's prompt UUID (equals `cc_prompt_id`)                | `[LIVE]` 2.1.329                                 |
| `x-claude-code-sandy-plover` (new)      | fetch wrapper (offset 13839032) when `Uq()`: first party, `la()`, base-URL check (offset 11024242)                                                                                                       | JSON array of tools used so far, `[{"name":…,"mcp":true?,"url"?}]` (`yp`/`ka`, offsets 13706898–13708766); `[]` on the first request | `[LIVE]` 2.1.329; `[DER]` also for OAuth |
| `anthropic-dispatch-id`                 | `jvt.stamp()` (offsets 19925404–19925690) on direct first party outside the "slow" usage-limit phase; `gzt(Ew,mD)` (offset 20201389). Value `Bvt` (offset 19925104): `CLAUDE_CODE_DISPATCH_V2D ?? tengu_dreamy_frost` (default false) → `v2d`; auxiliary sources → none; `…V2S ?? tengu_cedar_lattice` → `v2s`; after a 5xx or connection error the retry uses `v2p`. Same in 2.1.280 | `v2d` | `[LIVE]` both versions = **account-served** |

Off by default and not seen live: `x-claude-code-agent-type`,
`x-claude-code-auxiliary-type`, `x-claude-code-managed-settings-checksum`,
`x-claude-code-wiggly-dove` (`tengu_wiggly_dove`) and
`anthropic-usage-limit: slow|extended` (slow phase only, offset 20201389).

### 6.2 Billing block and fingerprint

**Template `[BIN]`** (offsets 9855614–9857205): `cc_version=V.fp; cc_entrypoint=E;`
then, each conditional: `cch`, `cc_workload`, `cc_is_subagent`, `cc_prev_req`,
`cc_prompt_id`, `cc_turn_origin`, **new** `cc_prompt_index` / `cc_turn_index`
(gated on `xu(promptIndex,0)&&xu(turnIndex,1)`, first party and `la()`, offset
9856103), `cc_gateway`, `cc_project` / `cc_project_src`, `cc_prev_msg`,
`cc_prev_prompt_index` / `cc_prev_turn_index` (after compaction),
`cc_dispatch_entrypoint` (`CLAUDE_CODE_SESSION_KIND==="bg"`, offset 7880039).
`cc_entrypoint=${FB()??process.env.CLAUDE_CODE_ENTRYPOINT??"unknown"}`. The
opt-out is `RP()` = `CLAUDE_CODE_ATTRIBUTION_HEADER` (offset 9859252).

**Fingerprint unchanged `[BIN]`** (offsets 14143726–14144705): salt
`59cf53e54c78`, `[4,7,20].map((f)=>e[f]||"0")`, SHA-256, first 3 hex. The
**input is the first non-meta user message's first text block**: `F()` skips
`isMeta` messages. `[LIVE]`: typed `hello` hashes to `e8c` for both genuine
models and for the plugin (2.1.280: `790`), even though the genuine first wire
block is a ~170 kB CLAUDE.md reminder. This package hashes the first text block
of the first wire user message (`src/build-request.ts`), which diverges
whenever a host merges reminders into the first message.

**`cc_turn_origin`, `cc_prompt_index`, `cc_turn_index`.**

- `cc_turn_origin=sdk` appeared in both live captures, so it **existed in
  2.1.280**; this package never emits it. Value `PMa` (offset 17368120):
  `human` for typed interactive input, `sdk` for an SDK prompt source `[BIN]`.
- `cc_prompt_index` / `cc_turn_index` come from `Xno` (offsets 16051676–16052059):
  first turn `{promptIndex:(origin==="human"?1:0), turnIndex:1}`. `[LIVE]` `0;1`
  in `-p` confirms; interactive would be `1;1` `[DER]`.

**`cch`** is covered in §4.1: the JS writes `cch=00000`, the wire carries a
native-substituted 5-hex value. Its gate and position are unchanged; only the
value is not reproducible.

### 6.3 System prompt: blocks and identity

- **Identity is unchanged** (offset 14144948). `Xio` (offset 14145203) selects
  "You are a Claude agent, built on Anthropic's Claude Agent SDK." for
  non-interactive runs with no appended system prompt (`-p`, `[LIVE]`) and
  "You are Claude Code, Anthropic's official CLI for Claude." for interactive
  runs `[BIN]`.
- **Block mapping `$Cs`** (offsets 20256507–20256783). With the dynamic-boundary
  marker present: billing and identity blocks carry no `cache_control`; the
  static part carries `{"type":"ephemeral","scope":"global"}`; the dynamic part
  carries `{"type":"ephemeral"}` (an org-scope block emits no `scope` field);
  `ttl` follows the session TTL. This matches live blocks [0]–[3] `[LIVE]`.
- `__SYSTEM_PROMPT_STATIC_BREAKPOINT__` is inert by default. A caller-authored
  prompt without the boundary marker follows upstream's third branch (identity
  cached with org scope), which is consistent with this package.
- The SessionStart `role:"system"` message and the three-block first user
  message are host content. Mid-conversation system messages are still used
  without a beta header (§5.3).
- The opening sentence of the shared static block changed (§9.4).

### 6.4 Body

Key order `[BIN]` (offsets 20154922–20155417, 20202454) and `[LIVE]` on both
versions: `model, messages, system, tools?, tool_choice?, metadata, max_tokens,
thinking, temperature?, context_management?, program_use_case_id?, safeguards?,
context_hint?, cache_control(evict)?, fallbacks?, j7() tags?, …extra body or
data_flow?, output_config?, speed?, thread?, diagnostics?,
resumption? / fallback_credit_token?, stream`. This package emits
`model, max_tokens, system, messages, tools, thinking, temperature, output_config,
…, metadata` (`src/request-body.ts`): a pre-existing difference on both versions.

| Field                  | Gate and value                                                                                                                                                                                    | This package                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `max_tokens`           | `min(overrides, Vv.ceiling(catalogue max output))` (offset 20146113); 128000 for the new models and `claude-opus-5-5`                                                                              | same idea                                            |
| `thinking`             | adaptive `{type,display}`; enabled `{budget_tokens,type,display}` (offset 20146571)                                                                                                                  | key order matches (`src/thinking.ts`)                |
| `context_management`   | `NBn` (offset 19040893) → `{edits:[{type:"clear_thinking_20251015",keep:"all"}, toolClearing?]}` whenever thinking is on and the context-management beta is composed (offsets 20149068, 20155173) `[LIVE]` both versions | only when the caller passes it: **pre-existing gap** |
| `output_config`        | effort from the catalogue default (`medium` for the 5.5 models) `[LIVE]`                                                                                                                              | caller-driven                                        |
| `diagnostics`          | `{previous_message_id:<prev>\|null}` when cache-diagnosis is latched and the query is agentic (offset 20155417; `r9n` offset 20086149) `[LIVE]` both                                                  | not emitted: **pre-existing gap**                    |
| `thread`               | `{type:"create"}` when the message-threads planner returns a plan; `UP()` (offset 20001416) needs first party, no ZDR, `tengu_curious_tower` (default false, offset 20001700)                          | account-served; do not emit by default               |
| `fallbacks`            | suppressed for threaded requests: `R8r` requires `!e.threadedRequest` (offsets 19745970–19746524); 2.1.280 `[LIVE]` carried `"default"`                                                             | n/a                                                  |
| `data_flow`            | `w7o` (offset 16155332): remote flag default false and OAuth `Ot()`; absent live                                                                                                                  | n/a                                                  |
| `program_use_case_id`  | `gQ()` env or flag (offset 7934825); off                                                                                                                                                        | n/a                                                  |
| `j7()` tags            | gateway billing-group tags only (offset 18330965)                                                                                                                                              | n/a                                                  |
| `tool_choice`          | only `tool` is demoted; new trigger `!un.acceptsForcedToolChoice` (offset 20148242)                                                                                                              | library's `any` demotion remains a recorded difference |

### 6.5 Tools

- **`DeferredToolPlaceholder`.** `K6n` (offset 19924854):
  `{name:W1e, description:xuo, input_schema:{type:"object",properties:{}}, defer_loading:true}`.
  Flag `tengu_deferred_stub_tool` defaults **true**; the tool is inserted before
  the last tool whenever tool search is active (offset 20110422) `[BIN]` `[LIVE]`.
- **Advisor server tool** (offset 20120667):
  `{type:"advisor_20260301", name:"advisor", model:<advisor model>, defer_loading:true}`.
  The beta is pushed when `pAn() && (yM() || advisorModel)` (offsets
  15315165–15315415); `yM` is `tengu_sage_compass2`, default `{enabled:false}` on
  first party, so this is **account-served** (§5.9).
- **`ownership_metadata`** is MCP-only: `{verified:false,owner:"mcp",server_url?}`
  on MCP tool definitions, `tool_use` and `tool_result` (offsets 15686337–15688733);
  built-in tools are unchanged. It couples to the tool-provenance beta (§5.2).
- `eager_input_streaming` comes from the host tool schemas. The same 16 tools are
  sent on both versions and their serialised size grows from 39,371 to 44,813
  JSON bytes (§4.1).

### 6.6 Transport: gzip and padding

New in 2.1.329 `[BIN]`: request bodies of 4096 characters or more sent to
`api.anthropic.com` are **gzipped by default**. Gzip is off only for an explicit
env switch, a non-Bun runtime, a proxy, mTLS, a custom CA or a Unix socket
(offsets 13468726, 13469601–13470149). In 2.1.280 it also needed remote flags
(2.1.280 offsets 8309326–8309605). When gzip applies, the body is **padded with
`"\n"` plus 0–256 random spaces or tabs** (`ZSe`, offset 9751208–9751514,
applied at 13839593–13839834). The capture did not exercise it, because a
proxy or custom CA disables gzip `[DER]`. `[UNR]` whether `Content-Encoding` is
set exactly as expected, which needs a capture with no proxy (for example by
TLS key logging). Gzip is a host transport concern, but the padding is body
bytes.

### 6.7 `thinking.display`: `-p` against interactive

`-p` supplies `omitted`: `tUi` (offsets 9408851–9409113), then
`YYn("omitted",!explicit)` → `"none"` (offset 19830874). Interactive calls
`YYn(undefined)` → `QSs()` (`CLAUDE_CODE_THINKING_DISPLAY_UPDATES ?? true`) →
`"connector_text"` → `display:"updates"`, plus the `thinking-display-updates`
beta, with `redact-thinking` removed `[BIN]`. The live capture
(`display:"omitted"`) is therefore the print-mode value, not the interactive one;
the plugin's `display:"updates"` is the interactive value.

### 6.8 Models, aliases and the normalizer gap

Aliases `[BIN]` (offsets 6882738–6883553), 2.1.329 against 2.1.280:

| Alias    | 2.1.329              | 2.1.280              |
| -------- | -------------------- | -------------------- |
| `opus`   | `claude-opus-5-5`    | `claude-opus-5-5`    |
| `sonnet` | `claude-sonnet-5-5`  | `claude-sonnet-5`    |
| `haiku`  | `claude-haiku-5-5`   | `claude-haiku-4-5`   |
| `fable`  | `claude-fable-5-2`   | `claude-fable-5-1`   |

`best` is `opus`. New catalogue fields (offsets 6884868–6885809), not reported by
the extractor: `maximum_window`, `clamp_long_context_without_beta`,
`fallback_chain`, `picker`, `deprecation`, `min_cli_version`, `slogan`.

Default model selection (offsets 9371528–9372280, 9376481, 9391298): org-enforced →
org default → `ANTHROPIC_DEFAULT_MODEL` → tier default. For claude.ai OAuth: Opus
(`claude-opus-5-5`, with `[1m]` if opted in, offset 9391794) for Max always and
for Pro / Team / Enterprise unless Sonnet-only; otherwise Sonnet
(`claude-sonnet-5-5`, fallback key `sonnet46`, offset 9368180).

| Model              | Context    | Max output     | Notes                                                                                              |
| ------------------ | ---------- | -------------- | -------------------------------------------------------------------------------------------------- |
| `claude-haiku-5-5` | native 1M  | 128000 / 128000 | `per_turn_effort`, no `refusal_fallback`; the only Haiku allowed fast mode behind a custom base URL (`aO`, offset 9415383) |
| `claude-sonnet-5-5` | native 1M | 128000 / 128000 |                                                                                                    |
| `claude-fable-5-2` | native 1M  | 128000 / 128000 |                                                                                                    |
| `claude-mythos-5-2` | native 1M | 128000 / 128000 |                                                                                                    |

`claude-opus-5-5` loses `mid_conv_system`, moves `advisor_rank` 4 → 7 and gains an
`effort_cost_index` (§3.3). Wire ids are plain strings `[LIVE]`.

**The library normalizer gap.** `normalizeModelId` (`src/model-identity.ts`) has no
rung for the new ids. Upstream tests `claude-sonnet-5-5` before `claude-sonnet-5`
(offset 9388020) and has a `claude-haiku-5-5` rung (offset 9388263). A substring
match folds the longer ids into shorter ones under the 2.1.280 profile `[DER]`:

| Field                     | `claude-sonnet-5-5`                                  | `claude-haiku-5-5`                  |
| ------------------------- | ---------------------------------------------------- | ----------------------------------- |
| Read as                   | `claude-sonnet-5`                                    | unmatched                           |
| Catalogue                 | the Sonnet 5 entry                                   | the permissive fallback             |
| `isAdaptiveThinkingModel` | true (through the Sonnet 5 predicate)                | false                               |
| `rejectsDisabledThinking` | no (upstream yes)                                    | n/a                                 |
| `hasOneMillionContext`    | false                                                | false                               |
| `isEligibleFor1MContext`  | true (Sonnet 5 `supports1mBeta`)                     | false                               |
| `max_tokens` ceiling      | 64000                                                | 32000                               |
| Betas composed            | claude-code, oauth, interleaved, thinking-token-count, context-management, prompt-caching-scope, mid-conversation-system, clear-at, effort, thinking-binding, thinking-display-updates; no per-turn-control, tool-changes, inline-tools or context-1m | no claude-code; oauth, interleaved, redact, token-count, context-management, scope, mid-conversation-system, clear-at, effort |

`claude-fable-5-2` folds into `claude-fable-5` (64000 cap, no `fast_mode`) and
`claude-mythos-5-2` into `claude-mythos-5`, whose 2.1.280 catalogue capability
list is empty. The practical risks for the plugin are in §11.

---

## 7. Transport and OAuth

**Verdict: changed, additively.** The core contract (URLs, client id, authorize
parameters and their order, exchange body, refresh body, revoke) is unchanged.
The real 2.1.329 changes are: the default login scope set adds
`user:privacy_consents:write`; more `/api/oauth/*` calls carry
`User-Agent: claude-code/2.1.329`; OAuth axios calls refuse redirects; there are
new credential slots and sign-in flows; and the SDK moved 0.112.1 → 0.128.0
(only the SDK `user_oauth` path uses it). Evidence is `[BIN]`, citing offsets in
`cc-2.1.329.full.js` (`@280` below denotes the 2.1.280 carve). No genuine OAuth
capture exists (the local session had expired), so nothing here is `[LIVE]`
except the one corroboration at the end.

### 7.1 Endpoints, client id and grants

| Item                         | 2.1.280 → 2.1.329                                                                                                                                | Verdict       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| API base                     | `https://api.anthropic.com`                                                                                                                      | unchanged     |
| Console authorize            | `https://platform.claude.com/oauth/authorize`                                                                                                    | unchanged     |
| Claude.ai authorize          | `https://claude.com/cai/oauth/authorize`                                                                                                         | unchanged     |
| Claude.ai origin             | `https://claude.ai`                                                                                                                              | unchanged     |
| Token                        | `https://platform.claude.com/v1/oauth/token`                                                                                                     | unchanged     |
| Create API key               | `https://api.anthropic.com/api/oauth/claude_cli/create_api_key`                                                                                  | unchanged     |
| Roles                        | `https://api.anthropic.com/api/oauth/claude_cli/roles`                                                                                           | unchanged     |
| Manual redirect              | `https://platform.claude.com/oauth/code/callback`                                                                                                | unchanged     |
| Success pages                | console `…/buy_credits?returnUrl=/oauth/code/success%3Fapp%3Dclaude-code`; Claude.ai `…/oauth/code/success?app=claude-code`                      | unchanged     |
| Client id, design client id  | the production and design client ids                                                                                                             | unchanged     |
| MCP proxy                    | `https://mcp-proxy.anthropic.com`, path `/v1/mcp/{server_id}`                                                                                    | unchanged     |
| Client-metadata URL          | `https://claude.ai/oauth/claude-code-client-metadata`                                                                                            | unchanged     |
| Local bases                  | `localhost:8000` (API), `:4000` (apps), `:3000` (console)                                                                                        | unchanged     |
| Custom-URL allowlist         | `beacon.claude-ai.staging.ant.dev`, `claude.fedstart.com`, `claude-staging.fedstart.com`, same order; rejection message `CLAUDE_CODE_CUSTOM_OAUTH_URL is not an approved endpoint.` | unchanged |
| `expires_in` default         | 31536000                                                                                                                                         | unchanged     |
| `oauth` beta constant        | `oauth-2025-04-20` (`Yu` in 2.1.329)                                                                                                             | unchanged     |
| jwt-bearer grant / OIDC beta | `urn:ietf:params:oauth:grant-type:jwt-bearer`, `oidc-federation-2026-04-01`                                                                      | unchanged     |
| SDK version                  | `0.112.1` → `0.128.0` (offsets @280 4375371, 11000819)                                                                                           | changed       |
| SDK `userOAuthProvider` UA   | `anthropic-sdk-typescript/0.112.1 userOAuthProvider` → `…/0.128.0 userOAuthProvider` (offsets @280 4397316, 11011317)                            | changed       |
| `/api/oauth/org`             | not found → `POST ${BASE_API_URL}/api/oauth/org`, returns the organization uuid (offset 9216545)                                                 | new           |
| Device-code / introspection  | none (`device_code` appears only in a bundled msal library, offset 33266759)                                                                     | n/a           |

Anchors: config object offset 5761224 (@280 4622445); allowlist offset 5763452
(@280 4624678); custom-URL check offset 5763698; `expires_in` offset 5760376. The
SDK constants block (offset 7692000) is
`var mEl="urn:ietf:params:oauth:grant-type:jwt-bearer",hEl="refresh_token",sks="/v1/oauth/token",Hdn="oauth-2025-04-20",gEl="oidc-federation-2026-04-01",_El=120,Udn=30,yEl=5`;
2.1.280 is the same (offset @280 4385688). The OIDC jwt-bearer body in 2.1.329 is
`{grant_type, assertion, federation_rule_id, organization_id, [service_account_id],
[workspace_id]}` with `anthropic-beta: oauth-2025-04-20,oidc-federation-2026-04-01`
and UA `…/${TL} oidcFederationProvider` (offsets 11008798–11009328). The
`Set(["error","error_description","error_uri"])` is the SDK error-field
allowlist, not new.

### 7.2 Authorize, exchange, refresh, revoke

- **Authorize** (`Kgs`, offset 9219721; 2.1.280 `_Ln`, offset @280 7220921).
  Parameter order is identical: `code=true, client_id, response_type=code,
  redirect_uri, scope (space-joined), code_challenge, code_challenge_method=S256,
  state, [orgUUID], [login_hint], [login_method]`. A custom `oauthClient`
  replaces the client id and scopes; `inferenceOnly` selects `[user:inference]`;
  **new** in 2.1.329, `alsoRequestScope` → `[...cRs(), alsoRequestScope]` (only
  source: `settingsOnlyGrant.scope`). The redirect is the manual-redirect URL
  when manual, else `http://localhost:${port}/callback`.
- **Exchange** (`cHi`, offset 9220448; 2.1.280 `M_r`, offset @280 7221614).
  Body `{grant_type:"authorization_code", code, redirect_uri, client_id,
  code_verifier, state}` plus `expires_in` if set. `state` is always sent. JSON
  body with the single header `Content-Type: application/json`; 30 s timeout;
  401 → "Authentication failed: Invalid authorization code"; otherwise
  `Token exchange failed (${status}): ${statusText}`.
- **Refresh** (`nae`, offset 9221471; 2.1.280 `yoe`, offset @280 7222591).
  Body `{grant_type:"refresh_token", refresh_token, client_id,
  scope: scopes.join(" ")}` plus `expires_in` if set. **`scope` is always sent**
  (default `ufn()` = the Claude.ai scopes plus `user:plugins`). Content-Type
  only; 30 s; the refresh token falls back to the old value; expiry is
  `Date.now()+expires_in*1000`. Identical in both versions.
- **Revoke** (`L_o`, offset 9224120). `POST ${TOKEN_URL}/revoke`, body
  `{token, token_type_hint, client_id}`, 5 s. New in 2.1.329: a 2xx counts as
  acknowledged only if it carries a `request-id` header.
- **Expiry skew.** Claude Code's own check is `now + 300000 >= expiresAt`
  (5 minutes; `WR`, offset 9226558; 2.1.280 `tD`, offset @280 7227049). The
  `30` in the SDK constants applies only to the SDK path.

**New axios hardening.** `jDe={maxRedirects:0, adapter:"http",
validateStatus:(e)=>e>=200&&e<300}` (offset 9187507) is spread into OAuth calls.
Profile, validate, roles, org and API-key requests now carry
`User-Agent: claude-code/2.1.329` (`Ai()`, offset 5440284); in 2.1.280 only
`create_api_key` did. Claude Code's axios UA is `axios/1.15.2` on both versions.

### 7.3 Two token paths: axios against the SDK `userOAuthProvider`

- **Genuine login, exchange, refresh and revoke are axios calls** on both
  versions: `User-Agent: axios/1.15.2`, the single explicit header
  `Content-Type: application/json`, no `anthropic-beta`, no SDK UA.
- **The SDK `user_oauth` credentials-file refresh path** is the only place the
  triple `oauth-2025-04-20` beta, `anthropic-sdk-typescript/<ver> userOAuthProvider`
  UA and the SDK version appear (offsets 11010999–11011317). It serves SDK
  `user_oauth` profiles, not Claude Code's `claudeAiOauth`.
- The 2.1.280 bundle contains an axios OAuth path
  (`dt.post(nn().TOKEN_URL, …)` with `dt.isAxiosError`, offsets @280 7222591 and
  @280 7231359), so a claim that 2.1.280 "has no axios OAuth path" is wrong. The
  plugin consequences are in §11.

### 7.4 Scopes

Base arrays are unchanged: Claude.ai
`[user:profile, user:inference, user:sessions:claude_code, user:mcp_servers,
user:file_upload]` and Console `[org:create_api_key, user:profile]`.

- **Authorize always sends the union** for both Console and Claude.ai logins:
  `cRs()` (2.1.280 `kCr()`) is the de-duplicated `[...console, ...claude.ai,
  user:plugins]` (offset 9220177, 5760957, 5513324).
- Default 2.1.280 string: `org:create_api_key user:profile user:inference
  user:sessions:claude_code user:mcp_servers user:file_upload user:plugins`.
- **Default 2.1.329 string: the same plus `user:privacy_consents:write`**
  (`CRo`, `PRIVACY_CONSENTS_SCOPE_REGISTERED:!0` in the production config).
- `user:plugins` is a normal default (`PLUGINS_SCOPE_REGISTERED:!0` in
  production on both versions; `!1` under `CLAUDE_CODE_CUSTOM_OAUTH_URL` or
  `CLAUDE_CODE_OAUTH_CLIENT_ID`).
- `user:projects:read` / `write` are **not** in the authorize scopes; they appear
  only in an allowed-extras filter.
- **New `org:desktop_config`** (`NGo`; `HYBRID_SETTINGS_SCOPE_REGISTERED:!0`). A
  hybrid-settings login requests only `[user:profile, org:desktop_config]`
  (offsets 47392874–47393671); the hybrid bootstrap endpoint is
  `${BASE_API_URL}/v1/desktop/orgs/${orgId}/claude_code/bootstrap` (offset
  47393423).
- `user:design:read` / `write` are unchanged. New `G2n=[user:profile,
  user:sessions:claude_code]` is used for cloud-sessions refresh (offset
  13320104).
- A custom OAuth URL or client id now clears all four scope-registered flags and
  records `SCOPES_CLEARED_BY` (offsets 5764279, 5764644); 2.1.280 cleared only
  plugins and projects.

### 7.5 Environment variables, bearer, credential storage

- **New env vars**: `CLAUDE_CODE_DISABLE_LAUNCHER_SIGN_IN`,
  `CLAUDE_CODE_HOST_AUTH_ASK_AT_START`, `CLAUDE_CODE_LAUNCHER_RUNS_API_KEY_HELPER`,
  `CLAUDE_CODE_RUNNER_MODEL_SOCKET`, `CLAUDE_CODE_SDK_HAS_SESSIONS_OAUTH_REFRESH`,
  `CLAUDE_CODE_SESSIONS_OAUTH_TOKEN`. None removed (registry offset 5894155).
- **Unchanged**: `CLAUDE_CODE_OAUTH_TOKEN`, `_OAUTH_REFRESH_TOKEN`, `_OAUTH_SCOPES`,
  `_OAUTH_CLIENT_ID`, `_OAUTH_TOKEN_FILE_DESCRIPTOR`, `_OAUTH_401_WAIT_MS`,
  `_CUSTOM_OAUTH_URL`, `_DESIGN_OAUTH_CLIENT_ID`,
  `CLAUDE_LOCAL_OAUTH_{API,APPS,CONSOLE}_BASE`, `USE_LOCAL_OAUTH`,
  `USE_STAGING_OAUTH`. `CLAUDE_CODE_OAUTH_SCOPES` is split on whitespace verbatim
  (`K_()`, offset 9487340), and using a refresh token without it is a hard error
  ("CLAUDE_CODE_OAUTH_SCOPES is required when using
  CLAUDE_CODE_OAUTH_REFRESH_TOKEN.", offset 39839988).
- **Bearer on the main path.** A subscriber request uses
  `{apiKey:null, authToken:e.oauthAccessToken}` (`uyl`, offset 9858464), i.e.
  `Authorization: Bearer`. The registry entry `oauth_auth` is
  `k("oauth_auth", Yu)` at raw index 1 (offset 7881648), unchanged. `Yu` is also
  appended to model-list calls (offsets 19845940, 27300278) and the raw
  `oauth_token` provider path (offset 40236702). There is no new OAuth-specific
  request header on the main path.
- **Credential storage** is unchanged: `.credentials.json` and the keychain
  service `Claude Code${OAUTH_FILE_SUFFIX}-credentials${sha256(configDir)[:8]}`
  (offset 6902185). New store slots: `cloudSessionsOauth`,
  `cloudSessionsSignInEnded`, `hybridOauth`, `hybridGatewayAuth`,
  `hybridGatewayIdp` (logout cleanup, offset 35285272). New refresh-result
  fields: `subscriptionTypeSource`, `subscriptionTypeVerifiedAt`,
  `profileOriginStamped`, `tokenAccount` (offset 9223231).

`[LIVE]` corroboration: the plugin's main-request capture included
`GET https://api.anthropic.com/api/oauth/usage` with `anthropic-beta:
oauth-2025-04-20`, which returned 429. The genuine OAuth path could not be
captured because the local session had expired ("this login reached its time
limit and cannot be renewed").

---

## 8. Caching, keepalive, resumption and context management

All `[BIN]` unless marked; none of this is observed live. Offsets index
`cc-2.1.329.full.js`.

### 8.1 `cache-keepalive-2026-09-03` (new, off by default)

It is **not a body field and not a `max_tokens` warm-up**. Three parts:

1. **Beta on the main request**: `betas:EM?[...tU,ND.header]:tU` (offset 20123590).
2. **Server reply enables it.** The response header `anthropic-cache-keepalive`
   must be `active` (offset 17277232); otherwise the sender stops
   (`"response_not_active"`).
3. **Periodic touch while active.** `POST /v1/messages/cache_touch` (offsets
   17274121, 17282942) with body `{request_id}` (the id of the last main-thread
   reply), header `anthropic-beta: oauth-2025-04-20,cache-keepalive-2026-09-03`,
   `maxRetries:0`. It uses its own client (`source:"cache_touch"`), rebuilt every
   240 s, with a 10 s timeout.

**Configuration** comes from the remote flag `tengu_sequential_cloud` (offset
17274457): `touchIntervalSeconds` (10–120, default 30), `activityWindowMinutes`
(default 60), optional `inFlightWindowMinutes`, `resumeTouches` (default false).
A touch fires each interval only if one of `main_request`, `user_input`,
`work_start`, `work_end`, `awaiting_user_start`, `awaiting_user_end` happened in
the activity window. The record lapses at `recordRenewedAt >= EXt` with the
stream closed (offset 17286924); `[DER]` `EXt = Eae − rQe`, with `Eae` the 5-minute
constant, so about 290 s.

**Gates.** `HXt`: TTL is `1h`, reason `subscriber`, `DXt()` true, and neither
overage nor `isUsingOverage` (offset 17275429). `DXt`: no `CCR_SESSION_PROFILE`, no
`ANTHROPIC_UNIX_SOCKET`, `fb()`, `Ot()` (OAuth subscriber) and the policy
`allow_cache_keepalive`, which is **denied under HIPAA** (offset 10866507). The
flag default is false ("off for this chain: flag off", offsets 17275734, 17276228).
Main loop or prefix continuation only; the system and message TTL must agree
(offset 20122259). There is no dedicated env var;
`CLAUDE_CODE_MESSAGES_PROMPT_CACHE_TTL=5m` turns it off indirectly.

**Failures.** Three failures → refused for an hour; 400 or 403 → refused for the
login; three 404s → stop; 429 or 5xx → `retry-after` backoff (offsets
17284092, 17287441).

**Cost model.** While `active`, the client sets its local cache-life estimate to
5 minutes instead of 1 hour (offset 17277232). `[UNR]` how touches are billed.
Related and off: `resumeTouches` (offset 17284598) and
`tengu_cache_heartbeat_shadow` behind `tengu_dapper_dawn` (offset 17288782).

### 8.2 Prompt caching changes

- **System breakpoints.** `cache_control: Koe({scope: scopeRefused ? undefined :
  cacheScope, ttl})` (offset 20256783) with `scopeRefused:ed(Gt,o8e)` (offset
  20120667). **New:** `scope:"global"` is dropped once
  `prompt-caching-scope-2026-01-05` is latched off; 2.1.280 always sent it.
- **New static-breakpoint marker.** `__SYSTEM_PROMPT_STATIC_BREAKPOINT__` (offset
  14142967) splits the global static half into several global blocks; the dynamic
  tail then gets no marker (`cacheScope: T.length>1 ? null : "org"`, offsets
  14146971–14147056). `[UNR]` which genuine prompts contain the marker.
- **Message breakpoints** (`n5n`, offsets 19928798–19930457; 2.1.280 `dCt`): tail
  marker, trailing `api_system` message and fork-point pin unchanged. **New**
  shared-head marker (`sharedHeadBlocks`, `t5n`), suppressed when the request has
  a top-level `cache_control` (warning about each sibling paying to write its own
  copy of the head, offset 20254511). **New** parent-reply marker (`o5n`, offset
  19932263) only for auxiliary queries with keepalive on and `tengu_mellow_beacon`
  (default false).
- **`prompt-caching-evict` is unchanged**: top-level
  `cache_control:{type:"ephemeral",ttl?,evict_on_complete:!0}` only for subagents
  with `evictCacheOnComplete` (`CLAUDE_CODE_SUBAGENT_CACHE_EVICT` or
  `tengu_subagent_cache_evict`, default false; offset 20086394).
- **`cache-diagnosis` is unchanged**: response `diagnostics.cache_miss_reason`; the
  cache-break snapshot now also records `cacheKeepalive` (offset 20137093).
- **Mid-conversation cache-promotion latches are unchanged**
  (`x-cc-internal-mid-conv-cache-promotion` and `-ok`); a proxy rejection moves
  the marker back to the trailing message (offset 20170410). Never on the wire.

### 8.3 TTL selection

`ZHe` (offset 20075477) and the precedence `YGn` (offset 19290900) are unchanged:
`FORCE_PROMPT_CACHING_5M` → `CLAUDE_CODE_PROMPT_CACHE_TTL` /
`CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` → settings `promptCacheTtl` /
`subagentPromptCacheTtl` → agent frontmatter → `ENABLE_PROMPT_CACHING_1H` →
subscriber, not overage, allow-listed source → `{ttl:"1h",reason:"subscriber"}`.
The allowlist `VSt` is `["repl_main_thread*","sdk","auto_mode","memdir_relevance"]`.

New in 2.1.329:

- `{ttl:"5m",reason:"live_5m_cache"}` when a live 5-minute cache exists and
  `tengu_tidy_frost` (default false; offset 20076039).
- The overage check counts `extraUsageStatus` under `tengu_buzzing_kahn`.
- `resume_cache_warm` and `comparison_fork` are treated as `sdk`.
- **Split-TTL env var**: `CLAUDE_CODE_MESSAGES_PROMPT_CACHE_TTL==="5m"` keeps the
  system blocks at 1h and sets message markers to 5m (`_Y`, `Q_`, `tS`; offset
  20120160). The telemetry field is `promptCacheMessagesTtl` (offset 20248817).
- `extended-cache-ttl-2025-04-11` is still pushed when `Q_==="1h"&&fb()` (offset
  20149354).

**Subscriber main-thread TTL defaults to 1h**, in 2.1.280 as well. API-key
sessions (the live captures) do not get it (§5.9).

### 8.4 `resumption-2026-10-08` (new, off by default)

Gate `lRt()`: first party, `fb()`, `tengu_peaceful_wigderson` default false
(offset 19974031). It replaces `thinking-resumption` when active (offset
20147965). It resumes a paused or cut assistant turn: the server ends with
`stop_reason` in `{max_tokens, server_timeout, pause_turn with token}` and
`stop_details.resumption={type:"available",token}` (offset 19977491). The
follow-up carries `resumption:{type:"enabled",token}`; with threads that is
`{messages:[],thread:{type:"continue",previous_message_id}}`, otherwise a full
replay with completed partial blocks appended as an assistant message, reusing
the `container` if it has not expired (offset 19977987). At most three resumes
(offset 19973523); skipped if the last non-system message is an assistant
message; the stitched turn is accounted (`resumed_usage`, `paused_limit`); the
non-streaming path deletes `stop_details.resumption` / `resumption_token`
(offset 20083767). Token implication: partial output is not regenerated, and the
thread form sends only the continuation.

### 8.5 Context management

- **`NBn`** (offset 19040893) emits `{type:"clear_thinking_20251015",keep:"all"}`
  whenever thinking is on, unchanged from 2.1.280.
- **New tool-result clearing after idle** (offset 19106022):
  `{type:"clear_tool_uses_20250919", trigger:{type:"tool_uses",value:triggerToolUses+r},
  keep:{type:"tool_uses",value:keepToolUses+r}, clear_at_least:{type:"input_tokens",
  value:clearAtLeastTokens}, exclude_tools, clear_tool_inputs?}` with
  `SUe={minIdleSeconds:3900,keepToolUses:12,clearAtLeastTokens:20000,
  triggerToolUsesBelowCount:3,minTriggerToolUses:27}` (offsets 19099671,
  19093359). The flag `tengu_jiggly_blossom` defaults to `"off"` (offset
  19123670). A paired reminder says the chat resumed after a long pause and older
  tool results may show a short placeholder (offset 19095993). Since 65 minutes
  of idle exceeds the 1h TTL the cache is already cold, so the clearing costs no
  extra write.
- **`mid-conversation-system-clear-at`** is still pushed when mid-conversation is
  composed and `KWe(model)` holds (offset 20112637). `KWe` gained gates
  `CLAUDE_CODE_TETHER_LIVE`, `Ec()` and `yD()` ahead of `tengu_sleepy_snowflake`
  (default `"all"`, offset 20002985).
- **`mid_conv_system` removed from every model** (GA, header retired; offsets
  7883248, 9418280); support defaults to true excluding models older than
  `claude-opus-4-8` (offset 9414628). The `role:"system"` message mechanism,
  including clear-at, is unchanged (§5.3).
- **Auto-compact.** Threshold: window − min(maxOutputTokens, 20000) (offset
  19154734). Window precedence: env → settings → clientdata → experiment → model
  default (offset 19151353). New: `claude-sonnet-5` defaults to 500k on the
  `remote_cowork` and `local-agent` surfaces (offset 19150855). The compaction
  prompts are unchanged `[DER]` (identical gaps between anchors in both carves).
- **New idle compaction** (offsets 19288231–19290648). It compacts at
  `lastActivityAt + 0.9 × (expiresAt − lastActivityAt)` of a 1-hour cache record
  (`not_one_hour` otherwise). It needs context ≥ max(100k,
  `CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS` ?? 200k), a timer at most 60 s late, an
  attended session and usage not limited. The setting `idleCompaction` defaults
  true (offset 16518777). The message is "Compacted while idle, before the
  prompt cache expired".
- **Microcompact is unchanged.**

### 8.6 `total_tokens_reminder` and `resume_cache_warm`

- **`total_tokens_reminder`**: `<total_tokens>N tokens left</total_tokens>` in the
  system prompt, after each tool result and after each regular user prompt
  (offset 6752509). Padded countdown from 15,000,000 for capability holders;
  env `CLAUDE_CODE_TOTAL_TOKENS_REMINDER*`, flag `tengu_lapis_anchor` (offsets
  19573094–19575459). `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-fable-5-2`
  and `claude-mythos-5-2` lack the capability (§9.1).
- **`resume_cache_warm`** is a real `max_tokens=1` warm-up (`GV=1`,
  `querySource:"resume_cache_warm"`), remote-only (`CLAUDE_CODE_REMOTE`), flag
  `tengu_resume_cache_warm_config` default `enabled:!1`, entrypoints
  `["remote_cowork"]` (offsets 46415499–46421400); it pushes the side-query beta
  (offset 20150761). Upload-ahead pre-sending of the prefix while typing is at
  offset 46414311 `[UNR]`. `/loop` wake-ups scheduled before cache expiry
  (`cacheLeadMs`) already existed in 2.1.280.

---

## 9. Tooling, model capabilities, effort and prompt size

All `[BIN]` unless marked; offsets index `cc-2.1.329.full.js`.

### 9.1 Capabilities

| Capability                          | Change                                                                                                                                                                  | Request effect                                                                           | Default                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `total_tokens_reminder`             | 2.1.280: on for all (`padded-countdown`). 2.1.329: only holders (offset 19573605). Budget 15,000,000 (offset 19571690)                                                  | line in the system prompt (offset 19632080) plus a reminder after tool results / user prompts (offset 22091754) | off for Opus 5.5, Sonnet 5.5, Fable 5.2, Mythos 5.2 |
| `tool_loaded_text`                  | 2.1.280 always appended "Tool loaded." next to a `tool_result` with a `tool_reference`. 2.1.329 strips it when the mid-conversation path is on and the capability is absent (offsets 22878146, 22878389; gate 22861630) | text after the tool result                                                               | missing on Fable 5.2, Mythos 5.2                                         |
| `send_user_file_input_whole`        | new (offset 18992472)                                                                                                                                                   | `SendUserFile` loses `eager_input_streaming`                                             | Opus 4.8, Opus 5                                                         |
| `silent_turn_reminder`              | Sonnet 5.5 directly; text at offset 22074520 ("The user hasn't heard from you in a while…"); gate 22075135; mid-turn 22090154                                           | system-reminder                                                                          | holders                                                                  |
| `haiku_5_5_early_stopping_guidance` | new; `VT(...)&&Dt("tengu_idempotent_wolf",!0)` (offset 19593441); text 19590523–19593441                                                                                | ~2.8 KB system-prompt section (`heron_brook`)                                             | Haiku 5.5, on                                                            |
| `script_output_cost`                | new; `Dt("tengu_peaceful_kettle",!1)` (offset 18980658); code mode only (offset 18989107)                                                                               | tool description text                                                                    | off                                                                      |
| `vertex_fast_mode`                  | new; `fA={firstParty:"fast_mode",vertex:"vertex_fast_mode"}` (offset 9272740)                                                                                           | none on first party                                                                      | Fable 5.2, Mythos 5.2                                                    |
| `org_locked_thinking`               | new (offset 28484969); warning "Claude's earlier thinking was written while you were signed in to another organization…" (offset 28484304); the `credential_org` attachment renders nothing (offset 22944326) | none on the wire; the server ignores cross-org thinking `[DER]`                          | Haiku 5.5, Sonnet 5.5, Fable 5.2, Mythos 5.2; warning flag `tengu_lexical_glade` off |
| `opus_5_5_prompt_bundle`            | implied set `{silent_turn_reminder, quizzical_shore}` → `{silent_turn_reminder, original_games_guidance}` (2.1.280 offset 7808726; 2.1.329 offset 11063049)                | +~330 B "original games" section                                                         | Opus 5.5                                                                 |
| `fable_5_2_prompt_bundle`           | new (offsets 11062809, 11063049)                                                                                                                                        | "original games", "# Finishing work" (~1.6 KB), "# Memory, notes and feedback" (~1.75 KB), timed silent-turn reminder | Fable 5.2, Mythos 5.2 |

The capability vocabulary gains 17 strings and loses `lucky_cerf` (2.1.280
offset 5924406, 2.1.329 offset 6886870).

### 9.2 Tooling

- **Tool search** is on by default (`tst`, offset 11033534). The beta is sent only
  with deferred tools (offset 20105494): `advanced-tool-use-2025-11-20`, or
  `tool-search-tool-2025-10-19` when experimental betas are disabled (offset
  9415911). An experiment to omit the beta sits behind `tengu_vast_acorn`
  (default false, offset 19016765). Only `claude-3-*` is unsupported (offset
  11033837); their `tool_reference` blocks are rewritten to `<functions>` text
  (offset 19016218).
- **Per-request beta table** grows from 4 to 5 entries (2.1.280 offset 6991709;
  2.1.329 offset 9417510). The `inline-tools` and mid-conversation tool-change
  gating is unchanged.
- **tool-provenance**: MCP tools, MCP `tool_use` and `tool_result` get
  `ownership_metadata:{verified:false,owner:"mcp",server_url?}` (offsets 15688480,
  15688990); built-ins are untouched (offset 15686600).
- **web-search-results-only** is only the WebSearch tool's own side request
  (offsets 26192003, 20144172). **program-use-case-ids** adds the body
  `program_use_case_id` (offsets 7934825, 20154922) and is off.
- **side-query** labels non-main requests (title generation, artifact comments,
  WebSearch, insights, hook prompts, resume cache warm; offsets 9305270, 20144172,
  20261667, 20150761) with no model switch.
- **Forced tool choice**: a new demotion reason from the remote capability
  `forced_tool_choice` (offsets 19042742, 20148242).
- **Built-in tool schema changes**: new `OfferChromeSetup` (`reason?`); Agent
  `effort` (~370 B); Read `allow_large` (~270 B); WebFetch `offset` (~180 B); Bash
  `timeout` / `run_in_background` descriptions +~150 B; ReportFindings `severity`.
  The live Opus 5.5 tool JSON grows 39,371 → 44,813 bytes `[LIVE]`.

**Gate resolutions on a plain interactive CLI.** `h9()` (offset 11159973) is false
on a first-party CLI, so the user-privacy section follows `tengu_prancy_pebble`
(off, offset 18873468). `V$()` = `tengu_federated_possum`, default false (offset
9971256), so there is no `program_use_case_id` and no beta. `BZ` (offset 20090014)
is true for an API key and, for OAuth, true unless the cached base-URL check
failed. `yCs` (offset 20090280) is true on first party with the default base URL,
so title and side requests carry `claude-code-side-query-2026-09-29` (push at
offset 20144172). `kW()` needs "no API key" or claude.ai OAuth (`t$n()`, offset
9454197; `Ot()`, offset 9510749), which explains its absence in the `-p` API-key
capture; on OAuth `tengu_snappy_noodle` defaults true on first party `[DER]`.

### 9.3 Effort, thinking and output

- **`effort_cost_index`** is display only: a "~Nx" multiplier and a "Switch your
  default effort to {to}?" nudge (offsets 43702975, 43703244, 43703830). It never
  reaches the request.
- **Default effort**: `tengu_witty_wand` per-model override → org default → remote
  default → catalogue `default_effort` → `"high"` (offsets 11155471, 11156257);
  `max` / `xhigh` clamp to `high` where unsupported (offset 11153361). The
  catalogue default is `medium` for Opus 5.5, Haiku 5.5, Sonnet 5.5, Fable 5.2 and
  Mythos 5.2; `[LIVE]` confirms `medium`.
- **`max_tokens`**: `min(override, maxOutputTokens)` (offset 20146113); env or
  catalogue (offsets 19042205, 9406745). 128000 for the new models `[LIVE]`. After
  an API refusal the client caps lower for the session (offset 19962410).
- **Thinking**: adaptive `{type:"adaptive",display}`; `{type:"disabled"}` only for
  models that accept it (offset 20146571). All four new models carry
  `rejects_disabled_thinking`; the hard-coded list adds Opus 5 and Sonnet 5
  (offset 9410279); `thinking_disabled_effort_cap` still clamps to `high` (offset
  20148502).
- **Temperature** only when thinking is off and the model accepts it
  (`!Sz&&un.acceptsTemperature`, offset 20151020; the accept list is Opus 4.7 and
  earlier `[DER]`, offset 9414628).
- **Lean prompt**: the catalogue string decides, the name fallback is unchanged
  (offsets 11067422–11067675); Haiku 5.5 and Sonnet 5.5 are now lean. The flag is
  `tengu_velvet_tide` (offset 11067946).
- **Refusal fallback**: client-side retry on a fallback model (offset 13772366);
  new opt-out string `no_refusal_fallback` (offset 13773702); Sonnet 5.5 and
  Fable 5.2 gained `refusal_fallback`.
- **Per-turn effort holders**: Opus 5.5, Fable 5.1, Haiku 5.5, Sonnet 5.5,
  Fable 5.2, Mythos 5.2. **Per-turn timing**: Opus 5.5, Fable 5.1, Mythos 5.1,
  Sonnet 5.5, Fable 5.2, Mythos 5.2. **Fast mode**: Opus 4.8, Opus 5, Opus 5.5,
  Fable 5.2, Mythos 5.2.

### 9.4 System prompt: sizes and the opening sentence

Sections are assembled by name (2.1.329 offsets 19628328–19630625; 2.1.280 offset
12984157). The shared static sections are byte-identical except for the opening
sentence: 2.1.280 "You are an interactive agent that helps users with software
engineering tasks." (an alternative sat behind `tengu_ochre_wren`) → 2.1.329
always "You are an agent working with the user toward their goals, using your own
judgment along the way." (offset 19601212), +20 B.

| Item                                           | Size                                                    |
| ---------------------------------------------- | ------------------------------------------------------- |
| Full static prompt                             | ≈10.2 KB on both versions (+20 B)                       |
| Lean body (`# Harness`, offsets 19616335–19617184) | ≈1.25 KB on both                                    |
| "# Text output" section                        | ≈1.33 KB, unchanged (matches the plugin's anti-verbosity text byte for byte) |
| `user_privacy` (offset 19589279)               | ~430 B, off by default                                  |
| `llm_rnd_capabilities` (offset 19588408)       | ~550 B, Fable 5.2 and Mythos 5.2                        |
| Fable 5.2 identity paragraph                   | ~720 B; the Fable 5.1 paragraph is reworded (no longer "newest") |
| Haiku 5.5 early-stopping guidance              | ~2.8 KB                                                 |
| Fast-mode sentence (offset 19633021)           | rewritten, +~35 B                                       |
| `<total_tokens>` line (offset 19632080)        | removed for non-holders                                 |

Live (Opus 5.5, `-p`) `[LIVE]`: the shared block grows 1603 → 2025 characters and
the session block 4135 → 5179. `[UNR]` the +422 characters in the shared block are
not fully explained (a candidate is the pasted-content bullet `fIt`, `[DER]`).
The 2.1.280 session block opened with "Write code that reads like the surrounding
code…"; that sentence is gone in 2.1.329 `[DER]`.

### 9.5 New models

| Model               | Pricing key                 | Advisor rank |
| ------------------- | --------------------------- | -----------: |
| `claude-haiku-5-5`  | `haiku_55`                  | 4            |
| `claude-sonnet-5-5` | `tier_2_10_cache_read_0_10` | 6            |
| `claude-fable-5-2`  | `tier_8_40_cache_read_0_20` | 10           |
| `claude-mythos-5-2` | `tier_8_40_cache_read_0_20` | 10           |

The full objects are in §3.3; aliases and the library normalizer gap are in §6.8.

### 9.6 Bash-first steering (Opus 5.5 bundle): unchanged

Unchanged from 2.1.280 (2.1.280 offsets 7811327, 7811574). `thrifty_sonic` is
forced on (offsets 11065889, 11066162) and `cozy_teapot` defaults to `"relaxed"`
for Opus 5.5 (offset 11066406). It applies only in auto or bypass-permissions mode
(offsets 18955564, 7944903, 5729085): the Bash description loses the "Avoid using
this tool to run find, grep, cat…" paragraph (offsets 18966972, 18974332), the
auto-mode reminder gains bash-first text (offsets 22105687, 22972729) and the Bash
edit diff is on (offset 22689330). There is no effect for opencode.

---

## 10. Impact on this package

This section lists what a 2.1.329-faithful request needs from this package. It is
a work list for a later port, not a commitment. Classes: *data* (profile or
registry data), *behaviour* (a flag in `src/profile-behaviors.ts`), *opt-in*
(a caller input; the genuine value is account-served), *pre-existing* (already
true for the pinned 2.1.280 profile; fixing it for 2.1.280 moves its frozen
digest, §2.3 decision 2), *docs*.

### 10.1 What this library must change

| Change                                                                                                  | Where                                                | Class                                    | Evidence                    |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- | --------------------------- |
| Profile 2.1.329: build time, git SHA, UA `(external, cli)`, `sdkVersion` 0.128.0                        | new profile                                          | data                                     | `[BIN]` `[LIVE]`            |
| Runtime version v26.12.1                                                                                | profile note / host guidance                         | data                                     | `[LIVE]`                    |
| Catalogue: four new models, `claude-opus-5-5` changes, capability vocabulary                            | profile                                              | data                                     | `[BIN]`                     |
| Registry `beta-registry-2.1.329`: 45 header-bearing entries, slot 30 omitted                           | new registry                                         | data                                     | `[BIN]`                     |
| `THIRD_PARTY_ALLOWED_BETAS_2_1_329`: −mid-conversation-system, +thinking-display-updates               | new set                                              | data                                     | `[BIN]`                     |
| Stop emitting `mid-conversation-system`: make the registry key optional, omit it from the 2.1.329 registry; site 11 still computes "active" and pushes only if the key exists | `src/betas.ts`                       | behaviour                                | `[BIN]` `[LIVE]`            |
| Mid-conversation condition from upstream's ordering-list predicate: flag `midConversationSystemFromCatalogue` (true for 2.1.195, 2.1.233, 2.1.280; false for 2.1.329+) | `src/profile-behaviors.ts`, `src/model-capabilities.ts` | behaviour | `[BIN]` `[LIVE]` |
| Re-gate clear-at and tool-changes off "mid-conversation active" rather than the catalogue key           | `src/betas.ts`                                       | behaviour                                | `[BIN]` `[LIVE]`            |
| Move `thinking-token-count` after tool-changes and tool-provenance, before clear-at: flag `thinkingTokenCountAfterRequestTable` | `src/betas.ts` order                  | behaviour                                | `[BIN]` `[LIVE]`            |
| New `tool-provenance` site (OAuth subscribers only), optional registry key `TOOL_PROVENANCE`, guarded by `experimental && oauthAuthenticated && key present`; no new required `betaPolicy` field; `ownership_metadata` recorded as unmodelled body coupling | `src/betas.ts`   | behaviour                                | `[BIN]` `[DER]`; no OAuth capture |
| Drop `context-1m` for natively-1M models                                                                | `src/betas.ts` long-context site                     | behaviour                                | `[BIN]` `[LIVE]`            |
| Normalizer rungs for the new ids, before the shorter ids (`claude-sonnet-5-5` before `claude-sonnet-5`, `claude-haiku-5-5`, fable and mythos 5.2) | `src/model-identity.ts` | behaviour (fixes a fold-in)    | `[BIN]` `[DER]`             |
| Header `x-claude-code-request-class: main` (also on 2.1.280) and `x-claude-1p-request-class: main`     | `src/headers.ts`                                     | behaviour / pre-existing for 2.1.280     | `[BIN]` `[LIVE]`            |
| Header `x-claude-code-prompt-id`                                                                        | `src/headers.ts` plus contract                       | behaviour                                | `[BIN]` `[LIVE]`            |
| Header `x-claude-code-sandy-plover`                                                                     | `src/headers.ts` plus contract                       | behaviour                                | `[BIN]` `[LIVE]`            |
| Header `anthropic-dispatch-id: v2d`                                                                     | opt-in input                                         | account-served                           | `[BIN]` `[LIVE]`            |
| `Accept: application/json` and genuine header-name capitalisation and order                             | `src/headers.ts`                                     | pre-existing                             | `[LIVE]`                    |
| Billing `cc_turn_origin` (also on 2.1.280), `cc_prompt_index`, `cc_turn_index`                          | `src/fingerprint.ts`, `src/contracts.ts`             | behaviour / pre-existing for turn origin | `[BIN]` `[LIVE]`            |
| Fingerprint input = the first typed, non-meta prompt rather than the first wire text block              | `src/build-request.ts`                               | divergence                               | `[LIVE]` `[BIN]`            |
| Static `cch=00000`                                                                                      | `src/fingerprint.ts`                                 | **contradicted** (§2.3 decision 1)       | `[LIVE]` `[DER]`            |
| Body key order                                                                                          | `src/request-body.ts`                                | pre-existing                             | `[LIVE]` `[BIN]`            |
| Generate `context_management` when thinking is on and the beta is composed                              | `src/request-body.ts`                                | pre-existing                             | `[BIN]` `[LIVE]`            |
| `diagnostics:{previous_message_id}` with cache-diagnosis                                                | `src/request-body.ts` plus contract                  | pre-existing                             | `[BIN]` `[LIVE]`            |
| `thread`, `inline-tools`, `advisor-tool`                                                                | opt-in inputs                                        | account-served                           | `[BIN]` `[LIVE]`            |
| `tool_choice` demotion when the model refuses forced choice                                             | `src/request-body.ts`                                | behaviour                                | `[BIN]`                     |
| Default effort from the catalogue, `max_tokens` from catalogue                                          | caller-driven today                                  | docs / guidance                          | `[BIN]` `[LIVE]`            |
| Gzip and padding note                                                                                   | docs                                                 | transport                                | `[BIN]` `[DER]`             |

**Implementation notes on the beta changes:**

1. Making `MID_CONVERSATION_SYSTEM` optional works because a missing registry key
   makes its step do nothing, so older registries stay byte-identical. The cost is
   that the comment claiming the key is required changes and the registry-binding
   test needs a 2.1.329 row. Rejected: a `header: string|null` type (it ripples);
   keeping the old header behind a flag (it invents data).
2. The behaviour flag lets `supportsMidConversationSystem` use its existing
   predicate for 2.1.329, which equals upstream's ordering-list check; otherwise
   the catalogue branch returns false everywhere and all three headers are lost.
   The three-way split is allowed by `test/governance/version-dispatch.test.ts`.
   Rejected: re-adding `mid_conv_system` to the 2.1.329 catalogue data.
3. The `thinking-token-count` reorder needs a flag, not a second registry key for
   the same header (a registry rule forbids that).
4. Applying the mid-conversation flag to 2.1.280 would change the output for
   `claude-mythos-5`; record it as the pre-existing divergence of §5.3 and §13.

### 10.2 Safe to ignore

`web-search-results-only`, `cache-keepalive`, `resumption`,
`program-use-case-ids`, `claude-code-side-query` (main requests only), the `rbs`
set, the latch-only members, upstream's `ANTHROPIC_BETAS` GA filter, user
privacy, bash-first steering, `effort_cost_index` (display only), the
`total_tokens_reminder` line, `org_locked_thinking` and the new OAuth credential
slots, as long as this package keeps building only the default main request.
Track `claude-code-side-query` if a request-kind input (for title requests) is
ever added.

### 10.3 Guardrail

The frozen packed-consumer digests must not move: 2.1.195 =
`6b9609b29463c890544845dd94acf560206b6f8165538faafd8886750037d277`, 2.1.233 =
`4e06af42310d63549a4fa9af60ff0c9b13e95d7864624c6b7bf94d45ce9a3997` and 2.1.280 =
`9a531ed01ddd3440ce5b7f25c6caf5f045a9b4e78d885b5317508e21a22ada90`. Every
behaviour above must sit behind a profile flag or a new optional registry key so
the three existing profiles compose byte-identical requests, and any backport of
a *pre-existing* item to 2.1.280 is a separate, deliberate digest-moving change
(§2.3 decision 2). Add a before / after test that composes the 2.1.280 default
scenario.

---

## 11. Impact on the opencode plugin

The opencode plugin (`opencode-anthropic-fix`, a separate repository) currently
runs this package's 2.1.280 profile with a dynamic version override. Plugin paths
below are relative to that repository and are code spans, not links. Nothing in
this section changes this repository.

### 11.1 Findings

| # | Finding                                                                                                                                                                                                                                                                                 | Severity    | Evidence                                          | Plugin location                                                     |
| - | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| 1 | **Model-id folding, Mythos 5.2.** The 2.1.280 normalizer folds `claude-mythos-5-2` into `claude-mythos-5`, whose catalogue entry has no capabilities. The plugin injects adaptive thinking and effort `high`, while the library emits `{type:"enabled",budget_tokens}` and still passes `output_config.effort`. API acceptance of this shape is `[UNR]`; already true for plain Mythos 5 | **High**    | `[DER]` §6.8, `[BIN]`                             | `lib/mimicry/` (model predicates), `request-body.mjs`               |
| 2 | **Model-id folding, Sonnet 5.5.** Read as Sonnet 5 (64000 cap, `isEligibleFor1MContext` true); upstream rejects disabled thinking ("Thinking can't be turned off", offset 9410777), the library would send `{type:"disabled"}`: likely a 400 `[DER]`. The plugin's Sonnet 5.5 capture got 200 because it matched the Sonnet 5 betas, max_tokens 64000 equals that cap, effort `high` is the plugin default and the server tolerates the retired beta | **Medium**  | `[DER]` §6.8, `[LIVE]` §4.2                       | `lib/mimicry/`, `request-body.mjs:230-240`                          |
| 3 | **Model-id folding, Haiku 5.5.** Unmatched: non-adaptive to the plugin, top-level effort stripped, 32000 cap against 128000, excluded from tool deferral by the `/haiku/` test, and `claude-code-20250219` is withheld on Haiku. The default `haiku` alias now points here               | **Medium**  | `[DER]` §6.8, `[BIN]` (alias offsets 6882738–6883553) | `request-body.mjs:224-227,641,672`, `lib/mimicry/adapter-input.mjs:638` |
| 4 | **Model-id folding, Fable 5.2.** Read as Fable 5: 64000 cap, no `fast_mode`                                                                                                                                                                                                             | Low         | `[DER]`                                           | `lib/mimicry/`                                                      |
| 5 | **Effort default.** The plugin defaults effort to `high`; the 2.1.329 catalogue default is `medium` for every new model and the genuine capture sends `medium`. `max_tokens` is 64000 against 128000 genuine                                                                              | Medium      | `[LIVE]` §4.2, `[BIN]`                            | `request-body.mjs:230-240`                                          |
| 6 | **`mid-conversation-system` still sent.** Upstream no longer sends it. The server tolerates it today. The plugin's `BODY_COUPLED_BETAS` and its suppression latch read the 2.1.280 registry                                                                                              | Medium      | `[LIVE]` §4.2, `[BIN]` §5.3                       | `lib/mimicry/adapter-input.mjs:187-198`                             |
| 7 | **Inconsistent client identity.** UA `claude-cli/2.1.329`, `cc_version=2.1.329.e8c`, but `x-stainless-package-version: 0.112.1` and `x-stainless-runtime-version: v26.3.0` (genuine: 0.128.0, v26.12.1). No genuine build produces the combination                                       | Medium      | `[LIVE]` §4.2                                     | startup version override                                            |
| 8 | **Host-leaked headers.** `x-opencode-client`, `x-opencode-project`, `x-opencode-session`, `x-opencode-session-id` and `x-session-id` reach `api.anthropic.com`                                                                                                                         | **High** (fingerprint) | `[LIVE]` §4.2                          | host / fetch layer                                                  |
| 9 | **Wire shape.** `Accept: */*`, lowercase `x-stainless-*` and `x-claude-code-session-id`, different header order, body key order `model, max_tokens, system, messages, tools, thinking, output_config, stream, metadata`, `cch=00000`, `thinking.display:"updates"` (this last one is the genuine interactive value) | Pre-existing | `[LIVE]` §4.2, §6.1, §6.4                       | request builder                                                     |
| 10 | **OAuth token endpoints.** Exchange, refresh and revoke send `anthropic-beta: oauth-2025-04-20` and `User-Agent: anthropic-sdk-typescript/0.112.1 userOAuthProvider`; genuine sends only `Content-Type: application/json` and the axios UA `axios/1.15.2` (§7.3). The plugin's 2.1.280 contract claims there is no axios path, which the 2.1.280 bundle contradicts | Medium | `[BIN]` §7.3 | `lib/oauth.mjs:170-176`, `lib/config.mjs:443-451`, `docs/oauth-2.1.280-contract.md:379-388` |
| 11 | **Scope union.** The plugin's `user:plugins` is off by default, project scopes are opt-in in authorize and the console set differs; genuine always sends the union `org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload user:plugins` (+ `user:privacy_consents:write` for 2.1.329) and never sends project scopes | Medium | `[BIN]` §7.4 | `lib/oauth-scopes.mjs:36,43,80-93` |
| 12 | **Refresh and exchange bodies.** Genuine refresh always sends `scope` (space-joined, default the Claude.ai list plus `user:plugins`); the plugin omits it. The genuine exchange always sends `state`; the plugin sends it conditionally | Medium / low | `[BIN]` §7.2 | `lib/oauth.mjs:671-676`, `lib/oauth.mjs:508-515` |
| 13 | **Revoke URL.** Genuine is `${TOKEN_URL}/revoke` (`/v1/oauth/token/revoke`); the plugin uses `/v1/oauth/revoke`. Off by default | Low | `[BIN]` §7.2 | `lib/oauth.mjs:35` |
| 14 | **`scope:"global"` after the scope beta is latched off.** Upstream drops it (offset 20120667); the plugin always emits it in boundary mode, even after its account latch suppresses `prompt-caching-scope`, a possible 400 loop | Medium | `[BIN]` §8.2 | `lib/mimicry/system-prompt.mjs:319`, `lib/host/runtime.mjs:398-406` |
| 15 | **TTL env vars.** The plugin's resolver lacks `CLAUDE_CODE_PROMPT_CACHE_TTL`, `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`, the split `CLAUDE_CODE_MESSAGES_PROMPT_CACHE_TTL=5m`, `live_5m_cache` and the `memdir_relevance` source | Low | `[BIN]` §8.3 | `lib/mimicry/cache.mjs:9-21` |
| 16 | **Tool deferral without a ToolSearch tool.** The plugin defers tools without the genuine search tool and excludes Haiku by name, which now wrongly skips Haiku 5.5 | Divergence | `[BIN]` §9.2 | `request-body.mjs:633-680` |
| 17 | **Fast-mode list.** Eligibility is hard-coded; genuine holders are Opus 4.8, Opus 5, Opus 5.5, Fable 5.2, Mythos 5.2 (§9.3) | Divergence for Opus 4.6 / 4.7 | `[BIN]` | `request-body.mjs:711-712` |
| 18 | **`context-1m` for natively-1M models.** The plugin's adaptive-context path can add it for Sonnet 5.5; genuine 2.1.329 sends none for natively-1M models. The context-limit override covers only Opus 4.6, 4.7 and 4.8 | Medium | `[BIN]` §5.4, `[LIVE]` | `lib/host/runtime.mjs:5587`, `lib/host/runtime.mjs:2611-2617` |
| 19 | **Org-locked thinking against account rotation.** The new `org_locked_thinking` capability means earlier thinking written under another organization cannot be reused; rotating accounts mid-conversation interacts with this. The warning flag is off upstream | Low / medium | `[BIN]` §9.1 | `lib/rotation.mjs` |
| 20 | **Stale plugin docs and pins.** README says microcompact "injects clear_tool_uses / clear_thinking betas" (`README.md:92`, `lib/config.mjs:410`) while the code only tracks state and a toast (`lib/host/runtime.mjs:3156-3173`); `tengu_velvet_cascade` should be `tengu_velvet_tide`; `docs/lean-prompt-claude-code-2.1.280.md` §3; `0.112.1` and the SDK UA are pinned in `lib/oauth-constants.mjs:63,69`, `lib/oauth-constants.test.mjs:61,65`, `index.test.mjs:1808,3069`, `test/conformance/oauth-wire-parity.test.mjs:84,126,146`, `test/conformance/regression.test.mjs:373` and `docs/oauth-2.1.280-contract.md` | Docs | `[BIN]` | as listed |

The `cch`, header-name and body-order differences (finding 9) are also visible
to a server and are not fixable inside the plugin without a library change
(§2.3, §10).

### 11.2 Ranked opportunities: token economy, cache, performance

Class (a) is **wire-safe**: it makes the request closer to, or no more distinct
from, the genuine one. Class (b) is a **divergence** from the genuine client that
may be worthwhile but changes the wire fingerprint or behaviour. Ranking weighs
benefit against risk.

| #  | Opportunity                                                                                                                                                                                                                                           | Class                                              | Lands on                 | Risk                                                      |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------ | --------------------------------------------------------- |
| 1  | Fix model identification for the new ids: normalizer rungs before shorter ids, a 2.1.329 profile, and `isAdaptiveThinkingModel` widened; interim: do not send effort or adaptive thinking for ids the catalogue does not mark adaptive                 | (a)                                                | library and plugin       | low; `model-predicates-parity` tests change                |
| 2  | 2.1.329 profile port: 27-entry catalogue, remove the `mid-conversation-system` header while keeping clear-at and tool-changes gating (a per-profile flag; with the 2.1.329 catalogue `supportsMidConversationSystem` would return false everywhere); tool provenance only after a genuine OAuth capture | (a)                                  | library                  | the plugin's `BODY_COUPLED_BETAS` and suppression latch read the 2.1.280 registry |
| 3  | Drop `scope:"global"` once the scope beta is latched off                                                                                                                                                                                              | (a)                                                | plugin                   | low                                                       |
| 4  | Effort default from the catalogue instead of a hard-coded `high`                                                                                                                                                                                       | (a)                                                | plugin                   | low; `[LIVE]` confirms `medium`                           |
| 5  | Stop adding `context-1m` for natively-1M models                                                                                                                                                                                                        | (a)                                                | plugin                   | low                                                       |
| 6  | Account rotation aware of org-locked thinking                                                                                                                                                                                                          | (a)                                                | plugin                   | low                                                       |
| 7  | Honour `CLAUDE_CODE_MESSAGES_PROMPT_CACHE_TTL=5m` (system 1h, messages 5m) and add `CLAUDE_CODE_PROMPT_CACHE_TTL` / `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` to `resolveCacheTtl`                                                                       | (a) under the env                                  | plugin                   | ordering rule: 1h before 5m                               |
| 8  | Side-query beta on title requests (the library needs a request-kind input; the plugin already detects title requests at `lib/mimicry/system-prompt.mjs:405-413`)                                                                                       | (a) for titles only                                | library and plugin       | low                                                       |
| 9  | Rewrite history only when the cache is cold: gate `proactive_microcompact` and `ttl_thinking_strip` on "idle longer than the resolved TTL" (genuine clears after 65 min against a 1h TTL and compacts at 90% of the TTL); use the genuine placeholder `[Old tool result content cleared]` (`lib/token-economy/transforms.mjs:145`) | content-only change (b) low; sending the `clear_tool_uses_20250919` edit is (b) medium | plugin | keep `conservative` default; interacts with `willow_mode` (`lib/host/runtime.mjs:382-387`) |
| 10 | Idle compaction at 90% of a 1h record                                                                                                                                                                                                                  | shape (a), timing is behaviour                     | plugin and opencode hook | high effort                                               |
| 11 | Tool deferral without the ToolSearch tool; fix the `/haiku/` exclusion for Haiku 5.5                                                                                                                                                                   | (b)                                                | plugin                   | medium                                                    |
| 12 | Fast-mode eligibility from the catalogue                                                                                                                                                                                                               | (b) for Opus 4.6 / 4.7                             | plugin                   | low                                                       |
| 13 | Re-decide `claude-code-20250219` on Haiku (now hits the default `haiku` alias)                                                                                                                                                                         | (b), deliberate                                    | plugin                   | low                                                       |
| 14 | `max_tokens` 8000 against genuine 128000                                                                                                                                                                                                               | (b), existing; document only                       | plugin                   | none                                                      |
| 15 | `total_tokens_reminder`                                                                                                                                                                                                                                | (a), low value                                     | plugin                   | none                                                      |
| 16 | Fix stale plugin docs and pins (finding 20)                                                                                                                                                                                                            | docs                                               | plugin                   | none                                                      |

**Do not implement**: cache keepalive (`/v1/messages/cache_touch`) is flag-off,
subscriber-and-1h-only, policy-gated and would be a strong fingerprint (b, high
risk); likewise `resumption`, the shared-head and parent-reply markers, and
`resume_cache_warm` (b). **No action**: user privacy, program use case ids,
bash-first steering. **Open**: API acceptance of the Mythos 5.2 request shape;
tool provenance on a genuine OAuth capture; the +422 characters in the shared
system block.

---

## 12. Method caveats

- **The live captures were `-p` (`sdk-cli`) with API-key authentication**, not
  interactive OAuth. Everything that depends on authentication mode or on print
  mode (`oauth-2025-04-20`, `tool-provenance`, the subscriber 1h TTL and
  `extended-cache-ttl`, `thinking-display-updates`, `afk-mode`,
  `dangerous-tool-use` / `safeguards`, `cc_prompt_index` and `cc_turn_index`
  values, the system identity sentence) is `[DER]`, not observed (§4.0, §4.2).
- **Remote flags are per account.** `anthropic-dispatch-id`, `message-threads` and
  `thread`, `inline-tools` and `advisor-tool` appeared because of the captured
  account's remote flags. Another account may see a different set and a
  different order of insertion (§5.9).
- **Gzip was not exercised.** The capture ran behind an intercepting proxy,
  which disables the default request-body gzip, so `Content-Encoding` and the
  padding bytes are `[DER]` (§6.6).
- **The 2.1.280 re-carve hash mismatch** (§1.2): the `.full.js` and `.modules.js`
  hashes recorded in the 2.1.280 analysis are not reproducible with the
  documented predicate; the extractor reports are the invariant.
- **The method is a noisy string diff.** Binary comparison of two bundles shows
  every renamed minified identifier as a change, so conclusions rest on tracing
  the code at each anchor, not on the diff alone. A beta's *emission condition* is
  not extractable from strings; each default verdict in §5 was traced.
- **Open `[UNR]` items, consolidated:**
  1. The native algorithm that produces the per-request `cch` value (§4.1).
  2. Whether `anthropic-dispatch-id` and `thread` are served to OAuth accounts;
     the exact case and slot of `Authorization` (§6.1). Both need one genuine
     OAuth capture.
  3. Whether gzip sets `Content-Encoding` exactly as expected (§6.6).
  4. Whether the 1h TTL (`extended-cache-ttl`) is the interactive-subscriber
     default: the code says yes (§5.5, §8.3), no live capture.
  5. Tool provenance default-on for OAuth: `[DER]` only (§5.2).
  6. What the new `!iO(…, {byItsOwnName:true})` conjunct on `context-1m` excludes
     beyond natively-1M models (§5.4).
  7. Whether the 2.1.280 analysis missed the separate `advanced-tool-use` /
     `tool-search-tool` push (§5.7); `context-hint` and `auto-mode-classifier`
     emission not re-traced (§5.7); `message-threads` conditions on a first
     request.
  8. Whether `kSe()` can be non-undefined, which affects `BZ` (§5.2).
  9. Billing of `cache_touch` requests (§8.1); which genuine prompts contain
     `__SYSTEM_PROMPT_STATIC_BREAKPOINT__` (§8.2); upload-ahead pre-sending
     (§8.6).
  10. The extra +422 characters in the shared static system block (§9.4).
  11. API acceptance of the Mythos 5.2 request shape produced by the 2.1.280
      profile (§11.1).
  12. The extractor's `userAgent` anchor is ambiguous and
      `stainlessPackageVersion` is not adjacent in 2.1.329; both were resolved by
      hand (§3.1).

---

## 13. Corrections to the 2.1.280 analysis

The 2.1.329 work shows that the 2.1.280 analysis (`docs/protocol/versions/claude-code-2.1.280-analysis.md`)
got the following wrong or left them open. These are recorded here; the 2.1.280
document carries only a pointer to this section.

1. **`x-claude-code-request-class: main` was on by default in 2.1.280.** The
   2.1.280 `[LIVE]` capture carries it, with the same gate as in 2.1.329 (§6.1).
2. **`cc_turn_origin` existed in 2.1.280.** The 2.1.280 billing block in the live
   capture ends `cc_turn_origin=sdk;` (§4.1, §6.2).
3. **The subscriber main-thread TTL defaults to 1h**, in 2.1.280 as well. The
   2.1.280 analysis's "5m" was a scenario assumption (§5.5, §8.3).
4. **The `mid_conv_cache_promotion*` keys are latches, not headers.** This
   resolves the 2.1.280 §4.3 `[UNR]`: they are conversation latch keys and never
   appear on the wire (§5.1).
5. **`anthropic-dispatch-id` exists in 2.1.280** (value `v2d`, account-served),
   with the same gate and the same flags (§6.1).
6. **`diagnostics` and a generated `context_management` were sent by 2.1.280**
   (`diagnostics:{previous_message_id:null}` and
   `{"edits":[{"type":"clear_thinking_20251015","keep":"all"}]}`), as were the
   genuine body key order and header capitalisation; this package emits none of
   them (§6.4).
7. **The 2.1.280 `.full.js` and `.modules.js` hashes are not reproducible** with
   the documented predicate; the executable and longest-run hashes are (§1.2).
   The extractor report size also differs from the 16,733 bytes recorded there.
8. **`claude-mythos-5` diverges from upstream in the 2.1.280 profile.** In 2.1.280
   the mid-conversation check fell back to "`claude-mythos-5` → true" and then to
   the provider default, while the 2.1.280 profile's catalogue entry for
   `claude-mythos-5` has an empty capability array; the profile already disagrees
   with upstream for that model. Applying the 2.1.329 flag to 2.1.280 would change
   its output for that model (§5.3, §10.1).
