<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

> **Provenance**
>
> - First-party analysis authored in this repository
> - License: `GPL-3.0-or-later`
> - Method: static extraction from the official npm artifacts, supplemented by
>   four named external sources
>
> Scope: original reverse-engineering research performed for this package,
> comparing the official `2.1.280` release against the `2.1.233` baseline this
> package currently pins. Nothing in this document is reproduced from any
> external *repository of code*.
>
> **This document is not purely binary-derived.** Four claims rest on published
> material rather than on the bundle, and each is tagged `[EXT-n]` inline at
> every point of use. They are enumerated in §2.3 and must not be promoted to
> binary evidence by a later editor.

# Claude Code 2.1.280 Analysis

- **Date**: 2026-09-22
- **Target**: `@anthropic-ai/claude-code-win32-x64@2.1.280`
- **Compared against**: `2.1.233` (the release this package pins today)
- **Supersedes**: nothing. This document replaces an earlier draft of itself in
  full; that draft's §5.3, §6, §14.2 and §14.3 were wrong and are corrected
  here with the evidence that overturned them (§6.5, §7.6, §9.4).

---

## 1. Artefacts and evidence classes

### 1.1 Hashes

Every offset in this document indexes **`cc-2.1.280.full.js`**, whose hash is
recorded below. No other artefact is used as an offset base.

| Artefact                | Bytes       | SHA-256                                                            |
| ----------------------- | ----------- | ------------------------------------------------------------------ |
| `package/claude.exe`    | 237,100,192 | `0E4195524B73EB77EFBDF3E2B36DE5322A29F0CA575DFD2D9B4F946B1D425469` |
| `cc-2.1.280.full.js`    | 42,185,436  | `D30FDCE179B3E8AAAF21C9F7DABC8AF2020E023A956940F187413B338236DFD1` |
| `cc-2.1.280.modules.js` | 36,197,302  | `9189F743B1F3979D4AB1A2A454C66D1EB873B89F054CA422F0A333FF9DE82960` |
| `cc-2.1.280.js`         | 4,015,347   | `BF94C1E5DC9843AB3ED66DD120C620A27F2AF49920D42478D02184574E0A385D` |

The tarball was obtained with `npm pack @anthropic-ai/claude-code-win32-x64@2.1.280`.

### 1.2 The carving predicate, byte-exact

A byte is *printable* when it is one of `0x09`, `0x0A`, `0x0D`, or lies in the
closed range `0x20`–`0x7E`. Every other byte, including every byte `>= 0x80`,
terminates a run.

- `cc-2.1.280.js` — the single longest maximal printable run.
- `cc-2.1.280.modules.js` — every maximal printable run of **>= 4096** bytes
  that also contains the Claude Code banner, concatenated in ascending start
  offset, separated by one `\n`.
- `cc-2.1.280.full.js` — every maximal printable run of **>= 512** bytes,
  concatenated in ascending start offset, separated by one `\n`.

The two multi-run dumps produce a **byte-identical** 16,733-byte extractor
report, which is the evidence that the concatenation does not perturb the
extractor's anchors (§1.4).

### 1.3 Evidence classes used in this document

Every claim below carries exactly one of these markers. A claim with no marker
is a definition or a cross-reference, never a finding.

| Class    | Meaning                                                                             |
| -------- | ----------------------------------------------------------------------------------- |
| `[BIN]`  | Transcribed from `cc-2.1.280.full.js` at the stated offset                          |
| `[DER]`  | Derived by evaluating transcribed code under stated default conditions              |
| `[UNR]`  | Located but not resolved; the open question is stated explicitly                    |
| `[EXT-n]`| Published external material; source listed in §2.3                                  |

`[DER]` is the class that most deserves scepticism: it is arithmetic over
`[BIN]` facts, and every `[DER]` claim here states the assumptions it evaluates
under so a reader can re-evaluate them under different ones.

### 1.4 Cross-module identifier resolution, and the collisions it survives

2.1.280 is a Bun `// @bun @bytecode` build of roughly 1,100 NUL-separated ES
modules, each ending `export{…};`. Bun preserves minified export names across
chunk boundaries, so an identifier defined in one module is legitimately
resolvable from another **only when the consuming module carries an
`import{…}` naming it**. Byte 6818613 shows exactly such an import:

```js
import{…,Me,Nn,sc,al,RI,uen,mD,ja,ms,hS}from"B:/~BUN/root/chunk-xf9y73zk.js"
```

and `ms`, `hS` and `Me` are re-imported from that same chunk at bytes 7656183,
7688562, 7726500 and 8119820. Where this document resolves an identifier across
modules, it says so.

Name collisions in a concatenated dump are real, not theoretical. Every one of
these was encountered and discarded during this analysis `[BIN]`:

| Name   | Correct site | Collisions discarded                                                            |
| ------ | ------------ | ------------------------------------------------------------------------------- |
| `qbr`  | 6280270      | 13922760 — a `Set` of grep flags `["-e","--regexp","-f",…]`                     |
| `Jf`   | 4301744      | 5300454 — a uid stat helper                                                     |
| `ms`   | 5966825      | 4894214 (zod registry), 5014395 (IPv6 helper)                                   |
| `oQt`  | 7004809      | 11620619 — a shell-command helper                                               |
| `kdr`  | 13492668     | 11328331 — `r("pewter_owl_brief")`                                              |
| `hw`   | 7024554      | 5920970 (string truncation), 8885249 (protobuf timestamp), 26897107 (lifecycle) |
| `yw`   | 7024973      | 5925179 (unicode strip), 9983707 (path helper)                                  |
| `HPr`  | 4387982      | 14273247 — a memory-context gate                                                |
| `Sxe`  | 13504644     | 31324537 — a cache-eviction predicate                                           |
| `yS`   | 5967151      | five unrelated sites (bignum, layout, changelog, protobuf)                      |
| `ac`   | 13603721     | fourteen unrelated assignments (HMAC, spinner frames, form-data, React)         |
| `Rx`   | model resolver inside `Tue` (§7.2) | unrelated prefix-mismatch behaviour value in the thinking block (§6.3) |
| `Ce`   | 4418342 — SDK constant `Ce = "oauth-2025-04-20"` | 4364829 — function `Ce()` returning `!launchOptions.isInteractive()` |
| `Ov`   | OAuth scope string `Ov = "user:inference"` (§8.4) | display-mode result of `Gxt` in the thinking block (§6) |
| `Js`   | OAuth grant-type constant `"refresh_token"` (§8.2) | unrelated binding elsewhere |
| `Nn`   | 5966201 — `function Nn(){return Me()==="firstParty"}`, in `chunk-xf9y73zk.js` (§7.6.2) | 4616378 — `function Nn(){return 0}` in a path-manipulation module, never imported under that name |
| `gTe`  | 13564660 — the beta/effort pusher called at 13602839 (§7.6.1) | 23188997 — `function gTe(){return jt().isDisabled}` in the MCP module, used at 23206703, 32238096, 40338259 |
| `Lm`   | 5960505 — the capability resolver (§13.4) | a `baseUnset` at 5257313, an error-suffix formatter at 19015550, a remote-policy walker at 28843640, an ssh-arg scanner at 33079532, an activity merger at 39592614 |
| `_xt`  | 5960552 — the catalogue capability lookup (§13.4) | 13440500 — a PreCompact-hook blocker |
| `mD`   | 5966698 — the provider-class predicate (§13.4) | 28366526 — an OAuth client-metadata helper |
| `sc`   | 5966389 — the provider resolver (§13.4) | a structured-output parser at 4521908, an ajv OR-combiner at 9547936, a completion matcher at 21092492, a git rev-list helper at 23947961, an OIDC authorization-params builder at 28365750, an integer clamp at 30507260, a truncator at 33115262 |
| `$_`   | 7823336 — the effort-capability predicate (§7.6) | a trust-dialog walker at 7165033, a platform check at 9231441, a highlight.js keyword expander at 16826378, a zod schema builder at 34243536 |
| `tl`   | 6917885 — `var tl=null`, assigned at 7140575 (§13.4) | at least seventeen unrelated bindings, including `function tl` at 5272066, 8654912, 10205970, 16289639, 17369329, 18865401, 20209229, 20714946, 22122397, 24043594, 25418717, 27527120, 30463266, 37044718, 37512830, 37709666, 38742208, 39599134 |
| `op`   | 7140575 — the `tl` registration setter, declared at 6917902 (§13.4) | a timeout race at 4264006, a marketplace parser at 5231445, the OTel propagation API at 6172336, a JAVA_TOOL_OPTIONS builder at 9168733, a memory-resync interval at 9877956 |
| `Yb`   | 10064748 — the advisor-tool remote gate (§7.6) | a suffix scanner at 7362930, a transcript lister at 19162223, a case-insensitive compare at 29307844, a file-path summariser at 34312416 |
| `ppr`  | 13572447 — `Fg()&&FOe()&&Nn()`, the cache-diagnosis gate (§7.6.2) | 10952109 — `function ppr(e,n){return e?.[n]??[]}` |
| `qM`   | 7016133 — `a.CLAUDE_CODE_DISABLE_1M_CONTEXT` (§13.2) | 31897455 — a zod date-format predicate |
| `Sw`   | 7025785 — the mid-conversation-system predicate (§13.3) | a path matcher at 9991153, a control-message filter at 26898198, a Chrome-path resolver at 34118688 |
| `Y5`   | 7029105 — the per-model beta resolver (§7.3) | 8821000 — a protobuf mapper |
| `qy`   | 13592595 — `Ee.length>0`, the `betas`-key gate (§7.6) | a semver prerelease helper at 6135984, a placeholder at 9768584, an id validator at 14552647, an ANSI code at 17373884, a system-reminder string at 26894242 |
| `ve`   | 13580256 — the `isAgenticQuery` boolean in the request builder (§7.1) | the `ve` in the afk-mode gate (§13.2), a separate binding that is **not** resolved; §14 item 6 records why `afkModeEnabled` is retained rather than asserted |
| `c`    | 24833559 — `x("tengu_hazel_osprey",!1)` in `chunk-p1m27ycm.js` (§9.2) | a single-letter binding reused across most modules in the dump; only the context-hint chunk's is meant |

A reader re-deriving any claim here must confirm the offset, not the name.

---

## 2. Executive summary

### 2.1 What actually moves on the wire

1. **The beta registry grows from 31 to 40 entries** (§4). Nine are added, none
   removed. Insertion is **not** append-only: one entry lands at position 17
   and three at positions 29–31, so pre-existing slots shift non-uniformly.
2. **The catalogue grows from 17 to 20 models** (§5), adding `claude-opus-5-5`,
   `claude-fable-5-1` and `claude-mythos-5-1`.
3. **Three beta headers this package cannot currently emit are sent by the
   genuine 2.1.280 client on its default first-party path** (§7.6). This is the
   single most consequential finding in the release and it changes what a
   correct port must contain.
4. **`thinking.display: "updates"` is NOT sent on an OAuth session** (§6.4).
   `thinking.block_binding` is NOT sent under default settings at all (§6.3).
   An earlier draft of this document asserted the opposite for both; §6.5
   records why that was wrong.
5. Transport is unchanged: endpoint, `anthropic-version`, the fingerprint salt,
   the Stainless header set and the `cache_control` shapes are all identical to
   2.1.233 (§8).
6. **A server-side gate keyed on a client-version signal refuses
   `claude-opus-5-5` to older clients** `[EXT-1]` `[EXT-2]` (§9.1). This turns
   the default-profile switch from an optimisation into a correctness
   requirement.

### 2.2 What does not move

- 2.1.233 remains a **valid** pin. No 2.1.233 model declares `per_turn_effort`
  or `mid_conv_tool_change`, and `thinking-binding-controls-2026-08-01` did not
  exist, so none of the three newly-required push sites can fire for that
  profile (§7.6.3). The gap described in §7.6 is specific to 2.1.280.
- The `tool_choice` demotion is byte-for-byte the behaviour this package
  already implements (§6.6).
- The `redact_thinking` five-conjunct guard this package ports is confirmed
  correct against upstream's own composition (§7.5).

### 2.3 External sources

Only these four. Each is tagged at every point of use.

| Tag       | Source                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `[EXT-1]` | GitHub issue `1jehuang/jcode#1390`, filed 2026-09-22                                                    |
| `[EXT-2]` | GitHub issue `NousResearch/hermes-plugin-claude-subscription-directsdk#22`, filed 2026-09-22            |
| `[EXT-3]` | Anthropic's published Opus 5.5 release notes (`platform.claude.com`, "What's new in Opus 5.5")          |
| `[EXT-4]` | The upstream Claude Code changelog                                                                      |

No source outside this table contributed a claim. In particular, no external
*repository of code* was read, consistent with the provenance header.

---

## 3. Build shape, and the runbook rule it breaks

`[BIN]` 2.1.280 is `// @bun @bytecode`. The bundle is not one printable run: it
is roughly 1,100 NUL-separated ES modules, each carrying the Claude Code banner
and ending `export{…};`.

Measured: the **single longest** printable run is 4,015,347 bytes out of
36,151,512 relevant bytes — **11%**. The runbook's Step 0 rule ("retain the
single longest run") therefore silently discards 89% of the bundle for this
build, and the extractor report it yields is missing entries rather than
failing. `[DER]`

This is not a 2.1.280 quirk to work around once; it is a change in how upstream
ships. `docs/plans/UPSTREAM-TRACKING-RUNBOOK.md` Step 0 has been amended to
concatenate all runs above a threshold and to cross-check two thresholds, and
`MEMORY.md` carries a dated entry recording the decision.

**Consequence for this document**: concatenation is safe for the extractor
because the extractor is a regex/scanner, never a whole-program parse — proven
by the byte-identical report from two differently-thresholded dumps (§1.2). It
is *not* safe for identifier resolution by name, which is why §1.4 exists.

---

## 4. The beta registry

`[BIN]` Factory at byte 6277485:

```js
function N(e,s){return Object.freeze({name:e,header:s})}
```

`[BIN]` The authoritative ordered array, same module:

```js
oy=Object.freeze([ert,swe,SAt,RN,sGe,k7,rNn,$br,mZt,y0e,oNn,trt,_0e,nrt,wAt,vAt,
                  rrt,BR,qO,sNn,b0e,Ubr,EAt,Bbr,jbr,Wbr,jR,AN,w$,j_,W_,aD,Ty,xN,
                  kAt,Gbr,qk,hZt,Aoe,cD,V1,lD].filter((e)=>e!==null)),
di=new Map(oy.map((e)=>[e.header,e]));
function ort(e){return di.get(e)}
function Vbr(e){return di.get(e)??Object.freeze({name:e,header:e})}
function WR(e){return e.map((s)=>s.header)}
function srt(e){return e.toLowerCase().includes("afk-mode")}
```

42 slots, two explicit `null`s at indices 34 and 37, filtered to 40 entries.

**Declaration order is not array order.** `lD` is declared alongside `Aoe` and
`cD` but the array places it **last**, after `V1`. A transcription that follows
declaration order will get positions 38–40 wrong.

### 4.1 The forty entries, in array order

| #   | Alias  | Feature key                         | Header                                     |
| --- | ------ | ----------------------------------- | ------------------------------------------ |
| 1   | `ert`  | `claude_code`                       | `claude-code-20250219`                     |
| 2   | `swe`  | `oauth_auth`                        | `oauth-2025-04-20`                         |
| 3   | `SAt`  | `interleaved_thinking`              | `interleaved-thinking-2025-05-14`          |
| 4   | `RN`   | `long_context`                      | `context-1m-2025-08-07`                    |
| 5   | `sGe`  | `context_management`                | `context-management-2025-06-27`            |
| 6   | `k7`   | `structured_outputs`                | `structured-outputs-2025-12-15`            |
| 7   | `rNn`  | `web_search`                        | `web-search-2025-03-05`                    |
| 8   | `$br`  | `tool_search`                       | `advanced-tool-use-2025-11-20`             |
| 9   | `mZt`  | `tool_search`                       | `tool-search-tool-2025-10-19`              |
| 10  | `y0e`  | `effort`                            | `effort-2025-11-24`                        |
| 11  | `oNn`  | `task_budgets`                      | `task-budgets-2026-03-13`                  |
| 12  | `trt`  | `prompt_caching_scope`              | `prompt-caching-scope-2026-01-05`          |
| 13  | `_0e`  | `prompt_caching_evict`              | `prompt-caching-evict-2026-05-12`          |
| 14  | `nrt`  | `extended_cache_ttl`                | `extended-cache-ttl-2025-04-11`            |
| 15  | `wAt`  | `speed`                             | `fast-mode-2026-02-01`                     |
| 16  | `vAt`  | `redact_thinking`                   | `redact-thinking-2026-02-12`               |
| 17  | `rrt`  | `thinking_resumption`               | `thinking-resumption-2026-07-17` **NEW**   |
| 18  | `BR`   | `thinking_token_count`              | `thinking-token-count-2026-05-13`          |
| 19  | `qO`   | `afk_mode`                          | `afk-mode-2026-01-31`                      |
| 20  | `sNn`  | `advisor_tool`                      | `advisor-tool-2026-03-01`                  |
| 21  | `b0e`  | `cache_diagnosis`                   | `cache-diagnosis-2026-04-07`               |
| 22  | `Ubr`  | `context_hint`                      | `context-hint-2026-04-09`                  |
| 23  | `EAt`  | `mcp_servers`                       | `mcp-servers-2025-12-04`                   |
| 24  | `Bbr`  | `files_api`                         | `files-api-2025-04-14`                     |
| 25  | `jbr`  | `environments`                      | `environments-2025-11-01`                  |
| 26  | `Wbr`  | `ccr_byoc`                          | `ccr-byoc-2025-07-29`                      |
| 27  | `jR`   | `mid_conversation_system`           | `mid-conversation-system-2026-04-07`       |
| 28  | `AN`   | `per_message_effort`                | `per-turn-control-2026-07-01`              |
| 29  | `w$`   | `per_turn_timing`                   | `timing-2026-09-09` **NEW**                |
| 30  | `j_`   | `mid_conv_tool_change`              | `mid-conversation-tool-changes-2026-07-01` **NEW** |
| 31  | `W_`   | `inline_tools`                      | `inline-tools-2026-09-15` **NEW**          |
| 32  | `aD`   | `server_side_fallback`              | `server-side-fallback-2026-06-01`          |
| 33  | `Ty`   | `server_side_fallback_category`     | `server-side-fallback-2026-07-01`          |
| 34  | `xN`   | `fallback_credit`                   | `fallback-credit-2026-06-01`               |
| —   | `kAt`  | *(null slot, array index 34)*       | —                                          |
| 35  | `Gbr`  | `auto_mode_classifier`              | `auto-mode-classifier-2026-07-16`          |
| 36  | `qk`   | `dangerous_tool_use`                | `dangerous-tool-use-2026-09-03` **NEW**    |
| —   | `hZt`  | *(null slot, array index 37)*       | —                                          |
| 37  | `Aoe`  | `thinking_display_updates`          | `thinking-display-updates-2026-08-18` **NEW** |
| 38  | `cD`   | `message_threads`                   | `message-threads-2026-08-12` **NEW**       |
| 39  | `V1`   | `mid_conversation_system_clear_at`  | `mid-conversation-system-clear-at-2026-08-21` **NEW** |
| 40  | `lD`   | `thinking_binding_controls`         | `thinking-binding-controls-2026-08-01` **NEW** |

### 4.2 How the slots shifted

Nine added, zero removed. The insertion pattern is **non-uniform** `[DER]`:

| 2.1.233 positions | 2.1.280 positions | Shift |
| ----------------- | ----------------- | ----- |
| 1–16              | 1–16              | 0     |
| 17–27             | 18–28             | +1    |
| 28–31             | 32–35             | +4    |

- **One insertion at position 17** (`rrt`), before the old position 17.
- **Three insertions at positions 29–31** (`w$`, `j_`, `W_`).
- **Five appended at positions 36–40** (`qk`, `Aoe`, `cD`, `V1`, `lD`).

Both `null` slots are inherited, not new. The package's 2.1.233 registry records
`NARRATION_SUMMARIES` as deliberately absent; which of `kAt`/`hZt` corresponds to
it is **not evidenced by the bundle** — the header string appears nowhere — so
this document asserts only that two slots are null. `[UNR]`

### 4.3 Two registry members that are not betas

`[BIN]` Byte 6279237, in the same factory chain but **excluded from `oy`**:

```js
gZt=N("mid_conv_cache_promotion_latch","x-cc-internal-mid-conv-cache-promotion")
zbr=N("mid_conv_cache_promotion_ok_latch","x-cc-internal-mid-conv-cache-promotion-ok")
```

Their header values are `x-cc-…` strings, not beta identifiers, and they do not
appear in the ordered array. A full-dump string search finds them only at that
declaration and in the module's `export{…}` list at byte 6627444. `[BIN]`

What they are is **not resolved**. `[UNR]` Byte 4385962 and the export list at
21638353 show a family of session latches including
`midConvCachePromotionRejected` and `markMidConvCachePromotionRejected`, which
is suggestive, but name similarity is not a reference and no call site was
found. This document therefore takes no position on whether they are ever sent,
and describes them consistently as **registry members whose consumer is
unresolved** — not as HTTP headers, not as response headers.

For the port the consequence is unambiguous regardless: they must not be
transcribed into the beta registry.

### 4.4 The three auxiliary sets — all resolved, by call site

The extractor reported these `unresolved` with the reason "a member is neither a
string literal nor a single property read". The cause is now known: one of them
contains a **conditional spread**. All three were resolved by locating their
consumers, not by resemblance to 2.1.233.

**Bedrock-unsupported** `[BIN]` byte 6280270, consumer byte 7029210:

```js
var qbr=new Set([SAt,RN,mZt]);
function Y5(e){return Hi((n)=>n.modelBetas,e,()=>{let n=Il(e);
  if(sc(e)==="bedrock")return n.filter((r)=>!qbr.has(r));return n})}
function lco(e){return Hi((n)=>n.bedrockExtraBodyParamsBetas,e,
  ()=>Il(e).filter((n)=>qbr.has(n)))}
```

Identified as Bedrock-unsupported **because `Y5` removes exactly these when the
provider is bedrock**, and `lco` re-homes them into Bedrock extra body params.
Membership is byte-identical to the 2.1.233 set.

**Count-tokens** `[BIN]` byte 6280282, consumers bytes 12304007, 12304164 and
12305087:

```js
var iNn=new Set([ert,SAt,sGe,swe]);
…betas: y.filter((he)=>iNn.has(he))  // inside beta.messages.countTokens({…})
```

Identified by the `countTokens` call it filters. Byte-identical to 2.1.233.

**Third-party allowlist** `[BIN]` byte 7029997:

```js
var Dg=new Set([ert,SAt,RN,sGe,k7,rNn,y0e,mZt,qO,qk,xN,jR,...BR?[BR]:[],lD]);
function DDn(e){if(iwe())return e;return e.filter((n)=>Dg.has(n))}
```

The `...BR?[BR]:[]` conditional spread is precisely the construct the extractor
declined to evaluate. In this build `BR` is non-null, so the set has **fourteen**
members `[DER]`:

`claude-code-20250219`, `interleaved-thinking-2025-05-14`,
`context-1m-2025-08-07`, `context-management-2025-06-27`,
`structured-outputs-2025-12-15`, `web-search-2025-03-05`, `effort-2025-11-24`,
`tool-search-tool-2025-10-19`, `afk-mode-2026-01-31`,
`dangerous-tool-use-2026-09-03`, `fallback-credit-2026-06-01`,
`mid-conversation-system-2026-04-07`, `thinking-token-count-2026-05-13`,
`thinking-binding-controls-2026-08-01`.

Delta against the 2.1.233 eleven-member set: **adds** `qk`, `BR`, `lD`; removes
nothing. It is also consumed at the tail of `cQt` (§7.3) to drop SDK-supplied
betas on third-party providers.

Alias-to-header mapping used above, all from the §4.1 table: `ert`, `swe`,
`SAt`, `RN`, `sGe`, `k7`, `rNn`, `y0e`, `mZt`, `qO`, `qk`, `xN`, `jR`, `BR`,
`lD`.

---

## 5. The model catalogue

`[BIN]` One contiguous cluster, bytes 5,941,320–5,955,961, twenty entries.
Per-entry start offsets:

| Model              | Offset  | Model              | Offset  |
| ------------------ | ------- | ------------------ | ------- |
| `claude-3-5-haiku` | 5941320 | `claude-opus-4-5`  | 5947622 |
| `claude-haiku-4-5` | 5941841 | `claude-opus-4-6`  | 5948282 |
| `claude-3-5-sonnet`| 5942491 | `claude-opus-4-7`  | 5948964 |
| `claude-3-7-sonnet`| 5942992 | `claude-opus-4-8`  | 5949773 |
| `claude-sonnet-4-0`| 5943492 | `claude-opus-5`    | 5950715 |
| `claude-sonnet-4-5`| 5944130 | `claude-opus-5-5`  | 5951703 |
| `claude-sonnet-4-6`| 5944838 | `claude-fable-5`   | 5952700 |
| `claude-sonnet-5`  | 5945555 | `claude-fable-5-1` | 5953668 |
| `claude-opus-4-0`  | 5946478 | `claude-mythos-5`  | 5954733 |
| `claude-opus-4-1`  | 5947043 | `claude-mythos-5-1`| 5955180 |

### 5.1 Observed keys and how many entries carry each

`[BIN]` Sixteen keys are observed across the twenty entries:

| Key                     | Entries | Modelled by this package |
| ----------------------- | ------- | ------------------------ |
| `id`                    | 20      | yes                      |
| `family`                | 20      | yes                      |
| `capabilities`          | 20      | yes (six strings only)   |
| `max_output_tokens`     | 20      | yes                      |
| `context`               | 17      | yes (partially — §5.3)   |
| `default_effort`        | 8       | yes                      |
| `display_name`          | 20      | no                       |
| `provider_ids`          | 20      | no                       |
| `pricing`               | 20      | no                       |
| `vertex_region_env_var` | 18      | no                       |
| `knowledge_cutoff`      | 17      | no                       |
| `eager_input_streaming` | 13      | no                       |
| `advisor_rank`          | 12      | no                       |
| `fallback_3p`           | 11      | no                       |
| `image_limits`          | 9       | no                       |
| `effort_cost_index`     | 6       | no                       |

**Ten keys are unmodelled.** Four of them — `eager_input_streaming`,
`vertex_region_env_var`, `fallback_3p`, and a `gateway` member inside
`provider_ids` — were not documented in any previous analysis in this
repository.

Note that `max_output_tokens` is the bundle's own key name; this package's
contract calls the corresponding field `maxOutputTokens`.

### 5.2 The table

`[BIN]` for every cell.

| Model               | mot default/upper | `default_effort` | `pricing`                      | `advisor_rank` | `effort_cost_index` low/med/high/xhigh/max |
| ------------------- | ----------------- | ---------------- | ------------------------------ | -------------- | ------------------------------------------ |
| `claude-3-5-haiku`  | 8192 / 8192       | —                | `haiku_35`                     | —              | —                                          |
| `claude-haiku-4-5`  | 32000 / 64000     | —                | `haiku_45`                     | 1              | —                                          |
| `claude-3-5-sonnet` | 8192 / 8192       | —                | `tier_3_15`                    | —              | —                                          |
| `claude-3-7-sonnet` | 32000 / 64000     | —                | `tier_3_15`                    | —              | —                                          |
| `claude-sonnet-4-0` | 32000 / 64000     | —                | `tier_3_15`                    | —              | —                                          |
| `claude-sonnet-4-5` | 32000 / 64000     | —                | `tier_3_15`                    | —              | —                                          |
| `claude-sonnet-4-6` | 32000 / 128000    | —                | `tier_3_15`                    | 2              | —                                          |
| `claude-sonnet-5`   | 64000 / 128000    | `high`           | `tier_2_10`                    | 3              | .47 / .74 / 1 / 2.41 / 5.59                |
| `claude-opus-4-0`   | 32000 / 32000     | —                | `tier_15_75`                   | —              | —                                          |
| `claude-opus-4-1`   | 32000 / 32000     | —                | `tier_15_75`                   | —              | —                                          |
| `claude-opus-4-5`   | 32000 / 64000     | —                | `tier_5_25`                    | —              | —                                          |
| `claude-opus-4-6`   | 64000 / 128000    | —                | `tier_5_25`                    | 3              | —                                          |
| `claude-opus-4-7`   | 64000 / 128000    | `xhigh`          | `tier_5_25`                    | 4              | —                                          |
| `claude-opus-4-8`   | 64000 / 128000    | `high`           | `tier_5_25`                    | 4              | .72 / .9 / 1 / 1.65 / 1.88                 |
| `claude-opus-5`     | 64000 / 128000    | `high`           | `tier_5_25`                    | 4              | .67 / .76 / 1 / 1.6 / 1.7                  |
| `claude-opus-5-5`   | 128000 / 128000   | `medium`         | `tier_4_20_cache_read_0_20`    | 4              | *(absent)*                                 |
| `claude-fable-5`    | 64000 / 128000    | `high`           | `tier_10_50`                   | 5              | .6 / .77 / 1 / 1.74 / 1.91                 |
| `claude-fable-5-1`  | 64000 / 128000    | `high`           | `tier_10_50_cache_read_0_25`   | 5              | .75 / .86 / 1 / 1.38 / 1.74                |
| `claude-mythos-5`   | 64000 / 128000    | —                | `tier_10_50`                   | 5              | —                                          |
| `claude-mythos-5-1` | 64000 / 128000    | `high`           | `tier_10_50_cache_read_0_25`   | 5              | .75 / .86 / 1 / 1.38 / 1.74                |

Facts a reader might be tempted to over-generalise, stated precisely `[DER]`:

- **Five** models have `default` equal to `upper`: `claude-3-5-haiku`,
  `claude-3-5-sonnet`, `claude-opus-4-0`, `claude-opus-4-1`, `claude-opus-5-5`.
  `claude-opus-5-5` is the only *1M-context* model with that property.
- **Four** models declare the `effort` capability but carry no
  `effort_cost_index`: `claude-sonnet-4-6`, `claude-opus-4-6`,
  `claude-opus-4-7`, `claude-opus-5-5`.
- **Two** models declare `effort` but no `default_effort` at all:
  `claude-sonnet-4-6`, `claude-opus-4-6`.
- Eight entries carry `default_effort`: six are `high`, one is `xhigh`
  (`claude-opus-4-7`), and one is `medium` (`claude-opus-5-5`, the only `medium`).
- `effort_cost_index` semantics are **not evidenced** by the bundle. `[UNR]`
  Whether it is a billing multiplier, a planning estimate, or a routing hint is
  not stated anywhere in the extracted code.

### 5.2.1 `family` values, verbatim

> **2026-09-23 — amendment.** §5.1 records that all twenty entries carry a
> `family` key and that this package models it, but no revision of this document
> tabulated the values. A profile module cannot be written without them, so the
> port would have had to take all twenty from the 2.1.233 module plus the model
> names — inference, which the runbook forbids. They are transcribed here from
> the bundle instead.

`[BIN]`

```
claude-3-5-haiku    haiku
claude-haiku-4-5    haiku
claude-3-5-sonnet   sonnet
claude-3-7-sonnet   sonnet
claude-sonnet-4-0   sonnet
claude-sonnet-4-5   sonnet
claude-sonnet-4-6   sonnet
claude-sonnet-5     sonnet
claude-opus-4-0     opus
claude-opus-4-1     opus
claude-opus-4-5     opus
claude-opus-4-6     opus
claude-opus-4-7     opus
claude-opus-4-8     opus
claude-opus-5       opus
claude-opus-5-5     opus
claude-fable-5      fable
claude-fable-5-1    fable
claude-mythos-5     mythos
claude-mythos-5-1   mythos
```

Five distinct values, and every model's family is the one its name implies —
which is exactly why it must be transcribed rather than inferred: a convention
that holds for twenty entries is not a rule the bundle states anywhere, and
`family` is a key upstream could repoint for a renamed model without changing
the name. The seventeen carried-over values agree with the 2.1.233 profile
module. `family` never reaches the wire in this package; it appears only in
redacted evidence (`src/contracts.ts`), which bounds the blast radius of an
error here but does not license a guess.

**Extraction method, so this is reproducible.** Read the carved dump
`cc-2.1.280.full.js` as latin1 in one string; find every occurrence of the
literal `id:"claude-`; delimit each catalogue entry by bounding its match with
the index of the *next* match. Bounding matters: an unbounded window bleeds
into the following entry and mis-reports `default_effort` for
`claude-mythos-5`, whose entry is the shortest of the twenty at 447 bytes. The
cluster bounds are given at the head of §5.

### 5.3 Context objects, verbatim

`[BIN]`

```
claude-3-5-haiku    (no context key)
claude-haiku-4-5    {window:200000,supports_1m_suffix:!0}
claude-3-5-sonnet   (no context key)
claude-3-7-sonnet   (no context key)
claude-sonnet-4-0   {window:200000,supports_1m_beta:!0,supports_1m_suffix:!0}
claude-sonnet-4-5   {window:200000,supports_1m_beta:!0,supports_1m_suffix:!0}
claude-sonnet-4-6   {window:200000,supports_1m_beta:!0,supports_1m_suffix:!0}
claude-sonnet-5     {window:1e6,native_1m:!0,native_1m_3p:{bedrock:!0,vertex:!0,foundry:!0},supports_1m_beta:!0}
claude-opus-4-0     {window:200000,supports_1m_suffix:!0}
claude-opus-4-1     {window:200000,supports_1m_suffix:!0}
claude-opus-4-5     {window:200000,supports_1m_suffix:!0}
claude-opus-4-6     {window:200000,supports_1m_beta:!0,supports_1m_suffix:!0}
claude-opus-4-7     {window:1e6,native_1m:!0,supports_1m_beta:!0,supports_1m_suffix:!0}
claude-opus-4-8     {window:1e6,native_1m:!0,supports_1m_beta:!0,supports_1m_suffix:!0}
claude-opus-5       {window:1e6,native_1m:!0,supports_1m_beta:!0,supports_1m_suffix:!0}
claude-opus-5-5     {window:1e6,native_1m:!0,supports_1m_beta:!0,supports_1m_suffix:!0}
claude-fable-5      {window:1e6,native_1m:!0,supports_1m_beta:!0}
claude-fable-5-1    {window:1e6,native_1m:!0,supports_1m_beta:!0}
claude-mythos-5     {window:1e6,native_1m:!0,supports_1m_beta:!0}
claude-mythos-5-1   {window:1e6,native_1m:!0,supports_1m_beta:!0}
```

Three entries carry **no** `context` key; four more carry only
`supports_1m_suffix`, which this package deliberately does not model. So a
faithful 2.1.280 profile emits a `context` object for **thirteen** of twenty
entries `[DER]`, exactly as the 2.1.233 profile emits ten of seventeen under the
same rule.

The rule: the package emits a `context` object if and only if the upstream entry declares `native_1m` or `supports_1m_beta`. Two upstream sub-keys are dropped silently and deliberately — `supports_1m_suffix`, which alone never produces a `context` object (so `claude-haiku-4-5`, `claude-opus-4-0`, `claude-opus-4-1` and `claude-opus-4-5` carry none), and `native_1m_3p` on `claude-sonnet-5`, which names bedrock/vertex/foundry and is out of scope for an anthropic-only package. Applying that rule yields 13 of 20 here and 10 of 17 for 2.1.233.

### 5.4 Capability arrays, complete and verbatim

`[BIN]`

```
claude-3-5-haiku    []
claude-haiku-4-5    ["context_management"]
claude-3-5-sonnet   []
claude-3-7-sonnet   []
claude-sonnet-4-0   ["context_management"]
claude-sonnet-4-5   ["context_management"]
claude-sonnet-4-6   ["effort","max_effort","adaptive_thinking","context_management"]
claude-sonnet-5     ["effort","max_effort","xhigh_effort","adaptive_thinking","mid_conv_system","context_management"]
claude-opus-4-0     ["context_management"]
claude-opus-4-1     ["context_management"]
claude-opus-4-5     ["context_management"]
claude-opus-4-6     ["effort","max_effort","adaptive_thinking","context_management"]
claude-opus-4-7     ["effort","max_effort","xhigh_effort","adaptive_thinking","context_management"]
claude-opus-4-8     ["effort","max_effort","xhigh_effort","adaptive_thinking","mid_conv_system",
                     "mid_conv_tool_change","context_management","fast_mode","lean_prompt"]
claude-opus-5       ["effort","max_effort","xhigh_effort","adaptive_thinking","mid_conv_system",
                     "mid_conv_tool_change","context_management","thinking_disabled_effort_cap",
                     "fast_mode","lean_prompt","refusal_fallback","opus_5_prompt_bundle"]
claude-opus-5-5     ["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking",
                     "mid_conv_system","mid_conv_tool_change","per_turn_effort","per_turn_timing",
                     "context_management","fast_mode","lean_prompt","refusal_fallback",
                     "opus_5_5_prompt_bundle"]
claude-fable-5      ["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking",
                     "mid_conv_system","mid_conv_tool_change","context_management","lean_prompt",
                     "fable_5_mitigations","refusal_fallback"]
claude-fable-5-1    ["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking",
                     "mid_conv_system","mid_conv_tool_change","per_turn_effort","per_turn_timing",
                     "context_management","lean_prompt","fable_5_mitigations","refusal_fallback",
                     "fable_5_1_prompt_bundle"]
claude-mythos-5     []
claude-mythos-5-1   ["effort","max_effort","xhigh_effort","adaptive_thinking","rejects_disabled_thinking",
                     "mid_conv_system","mid_conv_tool_change","per_turn_timing","context_management",
                     "lean_prompt","fable_5_mitigations","fable_5_1_prompt_bundle"]
```

Notes that matter for the port `[DER]`:

- `claude-mythos-5` keeps its **empty** capability array. This is a denial, not
  a transcription gap, and matches 2.1.233.
- `claude-fable-5`, `claude-fable-5-1` and `claude-mythos-5-1` carry **no** `fast_mode`.
- `claude-mythos-5-1` carries **no** `per_turn_effort` and **no**
  `refusal_fallback`.
- `mid_conv_tool_change` holders are exactly six: `opus-4-8`, `opus-5`,
  `opus-5-5`, `fable-5`, `fable-5-1`, `mythos-5-1`. There is no ambiguity about
  `opus-4-8`; it carries the string.
- `per_turn_effort` holders are exactly two: `opus-5-5`, `fable-5-1`.
- `per_turn_timing` holders are exactly three: `opus-5-5`, `fable-5-1`,
  `mythos-5-1`.
- `rejects_disabled_thinking` holders are exactly four: `opus-5-5`, `fable-5`,
  `fable-5-1`, `mythos-5-1`.

### 5.5 Capability deltas against 2.1.233, restricted to the six mapped strings

This package's `deriveCapabilitiesFromCatalogue` maps exactly six catalogue
strings: `effort`, `max_effort`, `xhigh_effort`, `adaptive_thinking`,
`context_management`, `rejects_disabled_thinking`. Restricted to those six,
**every one of the seventeen pre-existing models is unchanged** between 2.1.233
and 2.1.280 `[DER]`. The three new models resolve as:

| New model           | Mapped capabilities                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `claude-opus-5-5`   | `effort`, `max_effort`, `xhigh_effort`, `adaptive_thinking`, `context_management`, `rejects_disabled_thinking` |
| `claude-fable-5-1`  | same six                                                                                                  |
| `claude-mythos-5-1` | same six                                                                                                  |

**Three** pre-existing models gain `mid_conv_tool_change` — `claude-opus-4-8`,
`claude-opus-5` and `claude-fable-5` — and `claude-opus-5` also gains
`thinking_disabled_effort_cap`. Neither string is mapped by
`deriveCapabilitiesFromCatalogue`, so the package's *derived capability object*
is unaffected — but see §7.6, where `mid_conv_tool_change` turns out to drive a
beta header after all. "Unmapped by this package" must not be read as "no wire
effect in the genuine client".

> **2026-09-23 — correction.** This paragraph previously named only
> `claude-opus-5` and `claude-opus-4-8` as gaining `mid_conv_tool_change`,
> contradicting §5.4, which lists `claude-fable-5` among the six holders. The
> 2.1.233 profile module's `claude-fable-5` entry does not carry the string, so
> it is a genuine third gainer and §5.4 was right. Restated as three. The six
> holders decompose as three pre-existing models that gain it here plus the
> three models that are new in this release.

Note that these additions are **mid-array**, not appended. `claude-opus-4-8`
takes `mid_conv_tool_change` at position 6 of 9, immediately after
`mid_conv_system`; `claude-opus-5` takes it at the same relative position and
`thinking_disabled_effort_cap` after `context_management`. A cross-profile check
that models a capability delta as "previous array, then the new strings"
reproduces neither, so such a check must compare the carried-over strings in
relative order rather than reconstructing the array by concatenation `[DER]`.

### 5.6 The `aliases` block

`[BIN]`

| Family   | `default`           | `per_provider`                                                                                |
| -------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `opus`   | `claude-opus-5-5`   | bedrock/vertex/mantle/anthropic_aws → `claude-opus-5-5`; foundry → `claude-opus-4-6`; gateway → `claude-opus-4-7` |
| `sonnet` | `claude-sonnet-5`   | bedrock/vertex/foundry/mantle → `claude-sonnet-4-5`; anthropic_aws/gateway → `claude-sonnet-4-6` |
| `haiku`  | `claude-haiku-4-5`  | —                                                                                               |
| `fable`  | `claude-fable-5-1`  | gateway → `claude-fable-5`                                                                      |

These are routing identifiers, not wire model ids, and are out of scope for this
package (§12).

---

## 6. The thinking block

This is the section an earlier draft got wrong. It is rebuilt here from the
resolved gate chain.

### 6.1 The emission site, verbatim

`[BIN]` bytes 13603721–13604900, reformatted:

```js
pb = De(process.env.CLAUDE_CODE_DISABLE_THINKING),
Kg = r.type!=="disabled" && !pb,
ac = Kg && Fg() && iQt(_e),
Vg = !ac ? void 0 : (r.display==="highlights" && LPr()) ? "omitted" : r.display,
yc = void 0;

if (Kg && n_r(_e)) {
  if (IDn({runtimeOverride:ton(h.model), resolvedModel:_e, canonicalModel:xe}) === "adaptive")
    yc = {type:"adaptive", display:Vg};
  else {
    let hf = mlo(_e);
    if (r.type==="enabled" && r.budgetTokens!==void 0) hf = r.budgetTokens;
    hf = Math.max(1024, Math.min(Rv-1, hf));
    yc = {budget_tokens:hf, type:"enabled", display:Vg};
  }
} else if (r.type==="disabled" && Me()==="firstParty" && !pb && n_r(_e) && !lnt(_e))
  yc = {type:"disabled"};

let Xy;
if (lv) {
  if (!Fr.includes(lD)) Fr.push(lD);
  if ($ee(Mi, lD, $o==="bedrock"),
      Rx!==void 0 && (yc?.type==="adaptive" || yc?.type==="enabled") && !("thinking" in Mi))
    yc = {...yc, block_binding:{prefix_mismatch_behavior:Rx}}, Xy = Rx;
}

let Pv = r.type==="disabled" ? void 0 : r, Wx = Pv?.display, Ov = "none";
try { Ov = Gxt(Wx, Pv?.displayExplicit ?? MOt()) } catch(ji) { u(ji) }

let qu = () => { let ji = Fr.indexOf(vAt); if (ji!==-1) Fr.splice(ji,1) };
if (yc && Vg) qu();

switch (Ov) {
  case "thinking_and_connector_text": case "none": break;
  case "connector_text": {
    if ((yc?.type==="adaptive" || yc?.type==="enabled") && ac && Me()==="firstParty"
        && ms() && !X2() && !("thinking" in Mi) && !Jf(ht, Aoe)
        && !a.CLAUDE_CODE_SIMULATE_PROXY_USAGE) {
      if (yc = {...yc, display:"updates"}, !Fr.includes(Aoe)) Fr.push(Aoe);
      qu();
    }
    break;
  }
}
```

### 6.2 Every identifier in that block, resolved

`[BIN]` unless marked.

| Identifier  | Offset   | Definition / meaning                                                                              |
| ----------- | -------- | -------------------------------------------------------------------------------------------------- |
| `pb`        | 13603721 | `CLAUDE_CODE_DISABLE_THINKING` env                                                                  |
| `Kg`        | 13603721 | thinking requested and not disabled by env                                                          |
| `ac`        | 13603721 | `Kg && Fg() && iQt(model)`                                                                          |
| `Vg`        | 13603742 | resolved display value; `undefined` whenever `!ac`                                                  |
| `Fg()`      | 6622035  | `iwe() && !xoe()` — this package's `experimentalBetasEnabled`                                       |
| `iwe()`     | 6621824  | `Me()==="firstParty" \|\| RI(Me()) \|\| Me()==="foundry"`                                           |
| `xoe()`     | 6621896  | `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS \|\| KO()`; `KO()` is `kp("hipaa")`                         |
| `iQt(e)`    | 7024324  | interleaved-thinking predicate; catalogue-first, then on first-party `!canonical.includes("claude-3-")` |
| `mD(e)`     | 5966698  | `e==="firstParty" \|\| RI(e) \|\| e==="foundry" \|\| e==="mantle"`                                  |
| `ms()`      | 5966825  | `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL \|\| hS()`                                                 |
| `hS()`      | 5966698+ | `ANTHROPIC_BASE_URL` unset, or its host is `api.anthropic.com`                                      |
| `ja()`      | 5966778  | `Me()==="firstParty" && ms()`                                                                        |
| `yS(e)`     | 5967151  | `new URL(e).host === "api.anthropic.com"`                                                            |
| `X2()`      | 7292694  | `b7()===null && pc()`                                                                                |
| `b7()`      | 7295644  | `let{key:e}=m_();return e` — **returns the API key**                                                 |
| `pc()`      | —        | not transcribed `[UNR]`; inferred from use as "OAuth credentials present" (§6.4)                     |
| `bwt(e)`    | 10275122 | see §6.3                                                                                             |
| `t7()`      | 9707339  | `E().resolvedBaseUrlSnapshot`                                                                        |
| `_en()`     | 6652111  | reads `base_url` from `~/.claude/configs/<profile>.json`                                             |
| `Jf(e,t)`   | 4301744  | `e.rejected.has(t)` — **sticky rejection for the session**, not for the request                      |
| `Gxt(e,n)`  | 13492733 | display-mode resolver, §6.4                                                                          |
| `sQt()`     | 7020903  | `Ke().showThinkingSummaries ?? false`                                                                |
| `kdr()`     | 13492668 | `CLAUDE_CODE_THINKING_DISPLAY_UPDATES ?? true`                                                        |
| `MOt()`     | 4365144  | `host.launchOptions.thinkingDisplayExplicit()`                                                        |
| `hCt()`     | 13510163 | see §6.3                                                                                             |
| `gCt(e)`    | 13510163 | `"drop"→"drop_block"`, `"block"→"error"`, otherwise `undefined`                                       |
| `yCt(e)`    | 13510336 | `e!==void 0 \|\| ja()`                                                                               |
| `tH/dT/Sh`  | ~4387982 | push / read / sticky-reject a beta in the session latch set                                          |
| `Mi`        | —        | the caller's own request overrides `[UNR]`; `"thinking" in Mi` means the caller supplied one         |
| `lnt`, `n_r`, `IDn`, `mlo`, `ton`, `LPr`, `$ee`, `Rv` | — | not resolved `[UNR]`; none gates the two findings below |

### 6.3 `thinking.block_binding` is NOT emitted under default settings

`[BIN]` byte 13593798:

```js
let Rx, lv=!1;
try{
  let er = !(r.type==="disabled" && r.mechanical===!0)
         && !a.CLAUDE_CODE_SIMULATE_PROXY_USAGE
         && (!X2() || bwt());
  if (er && Fg()) { if (r.type!=="disabled") { if (Rx=hCt(), yCt(Rx)) tH(ht,lD) } lv = dT(ht,lD) }
  else if (er && !xoe()) { let Cr = sc(h.model);
    if ((Cr==="bedrock"||Cr==="mantle"||Cr==="vertex") && uz(Cr) && y(()=>ico(Cr,h.model))) {
      if (r.type!=="disabled") tH(ht,lD); lv = dT(ht,lD) } }
} catch(er){ u(er), Rx=void 0, lv=!1 }
if (!lv && !iwe()) Ee = Ee.filter((er)=>er!==lD);
```

`[BIN]` byte 13510163:

```js
function gCt(e){switch(e){case"drop":return"drop_block";case"block":return"error";default:return}}
var Ydr="tengu_polished_dewdrop";
function hCt(){ if(!ja())return; let e=a.CLAUDE_CODE_POLISHED_DEWDROP;
  if(e!==void 0)return gCt(e); return gCt(x(Ydr,"")) }
```

**The value set of `prefix_mismatch_behavior` is `{"drop_block", "error"}` and
comes from the binary, not from release notes.** `[BIN]`

Evaluating under default first-party settings — no `CLAUDE_CODE_POLISHED_DEWDROP`
env, remote flag `tengu_polished_dewdrop` empty `[DER]`:

1. `hCt()` → `ja()` true → no env → `gCt(x("tengu_polished_dewdrop",""))` →
   `gCt("")` → **`Rx === undefined`**.
2. `yCt(undefined)` = `undefined !== undefined || ja()` = **`true`**.
3. So `tH(ht, lD)` **is** called, and `lv = dT(ht, lD)` is **true**.
4. In §6.1, `if (lv)` pushes `lD` into the beta array, but the body field is
   additionally guarded by `Rx !== undefined`, which is false.

**Conclusion**: the beta header `thinking-binding-controls-2026-08-01` **is
sent**; the body field `thinking.block_binding` **is not**. The client opts into
the response-side `input_transformations` reporting `[EXT-3]` without changing
the server's drop behaviour.

The `er` precondition needs `(!X2() || bwt())`. On a pure OAuth session `X2()`
is true, so this rests on `bwt()`. `[BIN]` byte 10275122:

```js
function bwt(e=Me()){ if(e!=="firstParty"||!hS())return!1;
  if(a.ANTHROPIC_BASE_URL!==void 0||!pc()||!X2())return!0;
  let n=t7(), r=n===void 0?_en()??null:n; return r===null||yS(r) }
```

On a default install with no base-URL override and no profile config, `t7()` is
undefined and `_en()` is undefined, so `r` is `null` and `bwt()` returns
**true** `[DER]`. The conclusion holds on both branches of `X2()`.

### 6.4 `thinking.display: "updates"` IS emitted, and it strips `redact_thinking`

`[BIN]` byte 13492733:

```js
function Gxt(e,n){
  if(e==="summarized"||e==="highlights")return"thinking_and_connector_text";
  if(e==="omitted"&&!n)return"none";
  if(e!=="omitted"&&sQt())return"thinking_and_connector_text";
  return kdr()?"connector_text":"none" }
```

This reveals a **fourth** display value, `"highlights"`, alongside
`"summarized"`, `"omitted"` and the injected `"updates"`.

Evaluating under defaults — no explicit display, `showThinkingSummaries` false,
`CLAUDE_CODE_THINKING_DISPLAY_UPDATES` unset and therefore true `[DER]`:
`Gxt(undefined, false)` falls through to `kdr() ? "connector_text" : "none"` and
returns **`"connector_text"`**. The `"updates"` branch is reached.

The branch then requires `!X2()`, where `X2() = b7()===null && pc()` (§6.2).
`b7()` returns the API key (`[BIN]` byte 7295644, `function b7(){let{key:e}=m_();return e}`;
`m_` at byte 7297913 returns `{key, source}` where every populated `key` comes
from `ANTHROPIC_API_KEY` or `apiKeyHelper`, and the no-credential branch returns
`{key:null,source:"none"}`), so on an OAuth session `b7()===null` holds. The
conclusion therefore turns entirely on `pc()`.

`[BIN]` byte 7292489:

```js
function pc(e={}){
  if(!Hpo())return!1;
  if(kLn(e))return!1;
  let n=e.skipApiKeyHelper?void 0:Rvo.of(W().host);
  if(K_()==="profile-implicit"){
    let r=rn();
    if(rAt(r)&&Rxt()){if(n)cM(n);return!1}}
  if(n)fM(n);
  return!0}
```

Its gates:

| Identifier | Offset | Body |
| ---------- | ------ | ---- |
| `Hpo` | 6650461 | `function Hpo(){return K_()!==null}` |
| `K_` | 6649777 | returns `"profile-explicit"`, `"env-quad"`, `"profile-implicit"` or `null`; the `"profile-implicit"` arm requires an Anthropic profile directory, `e0()` non-null |
| `kLn` | 7292318 | `function kLn(e={}){return Boolean(mo()\|\|a.ANTHROPIC_UNIX_SOCKET\|\|Mn()\|\|Cc()\|\|a.ANTHROPIC_AUTH_TOKEN\|\|a.CLAUDE_CODE_OAUTH_TOKEN\|\|hD()\|\|(e.skipApiKeyHelper?!1:g_())\|\|!Nn())}` |
| `rn` | 7319803 | reads the stored OAuth record |
| `rAt` | 7334986 | `function rAt(e){return SN(e?.scopes)&&!!e?.accessToken}` |
| `Rxt` | 6650901 | `function Rxt(){return K_()==="profile-implicit"&&zGe()==="user_oauth"}` |
| `cM` | 7291662 | warns *"An Anthropic profile (~/.config/anthropic) is configured, but a claude.ai login exists — using the claude.ai login"* |

**`pc()` returns `false` on a Claude Code OAuth install, by either of two
independent routes** `[DER]`:

1. A plain install stores its credentials in the OS keychain or
   `~/.claude/.credentials.json` and has no `~/.config/anthropic` profile
   directory, so `e0()` is null, `K_()` is `null`, `Hpo()` is false, and the
   **first line** returns `!1`.
2. If such a profile directory does exist, `K_()` is `"profile-implicit"`,
   `rAt(rn())` holds (the stored record has scopes and an access token) and
   `Rxt()` holds, so the inner branch warns via `cM` and returns `!1`.

The conclusion does not depend on which route applies.

⇒ `X2()` is **false** ⇒ `!X2()` is **true**, and every remaining conjunct of the
`connector_text` branch holds under the §7.6 scenario: `yc.type==="adaptive"`,
`ac` (thinking active, `Fg()`, interleaved-capable model), `Me()==="firstParty"`,
`ms()`, no caller `thinking` in `Mi`, no sticky rejection of `Aoe`, and
`CLAUDE_CODE_SIMULATE_PROXY_USAGE` unset.

**Conclusion** `[DER]`, and it inverts the previous revision:

- `thinking.display: "updates"` **is** emitted in the body on this package's
  pinned OAuth path;
- `thinking-display-updates-2026-08-18` **is** pushed, at byte 13604689;
- `qu()` runs in the same branch and **splices `redact-thinking-2026-02-12` out**
  of the beta array. The genuine client composes that identifier from `kw`
  entry 5 and then removes it again before serialising.

`bwt()` is unaffected: its second line is
`if(a.ANTHROPIC_BASE_URL!==void 0||!pc()||!X2())return!0`, and `!pc()` alone
returns early, so `lv` is still true and `thinking-binding-controls-2026-08-01`
is still emitted (§6.3, §13.5).

One consequence for §7.1: the OAuth beta's own gate is
`ft()||iwe()&&!zQt()&&pc()`, and the second disjunct is now false. It fires
through **`ft()`** — `[BIN]` byte 7334838, `function ft(){if(!Wc())return!1;return SN(rn()?.scopes)}`,
with `SN(e)=frn(e)` at byte 7257432 — not through `pc()` and not through
`zQt()`. `Wc` remains `[UNR]`; `oauth-2025-04-20` is nonetheless observed in the
literal because no other disjunct can supply it.

### 6.5 Why the earlier drafts were wrong

Two drafts were wrong here, in opposite directions, and both errors are recorded
rather than quietly overwritten.

The first draft asserted that both fields are "emitted on the default
first-party path with no caller opt-in", and simultaneously recommended porting
both behind flags defaulted off. Both halves were wrong for the same reason: the
nine gating identifiers had been located but not resolved, and the draft
generalised from the *shape* of the condition rather than from its value.

The second draft resolved `X2()`'s structure but not `pc()`'s body, and inferred
`pc()` true from the fact that the OAuth beta is sent — an invalid inference from
a disjunction, since `ft()` can carry that disjunction alone. It concluded that
`"updates"` is **not** emitted on OAuth. With `pc()` now transcribed, the
opposite holds, and with it a beta **removal** the package does not model at all.

The correct statements are the ones in §6.3 and §6.4: the binding-controls header
is sent while its body field is not, and the display field *is* injected, taking
`redact_thinking` off the wire with it.

### 6.6 `tool_choice` demotion, complete

`[BIN]` byte 13604689:

```js
let Xh = yc?.type==="enabled" || yc?.type==="adaptive" || (yc===void 0 && lnt(_e)),
    Jh = h.toolChoice;
if (Jh?.type==="tool" && Xh)
  t(`tool_choice {type:'tool', name:'${Jh.name}'} demoted to auto: extended thinking is active`),
  Jh = {type:"auto"};
```

Only `type === "tool"` is demoted; `type === "any"` is **not** handled here. This
matches this package's implementation exactly, including the omission. The
behaviour predates Opus 5.5 and is therefore not a mitigation *for* it, though
Opus 5.5 does reject both `any` and `tool` server-side `[EXT-3]`.

### 6.7 `thinking_disabled_effort_cap` clamps, it does not refuse

`[BIN]` byte 13604689, immediately after the above:

```js
let n_ = r.type==="disabled" && r.mechanical===!0;
if (yc?.type==="disabled" && (n_ || KIn(_e)) && typeof fi.effort==="string" && qIn(fi.effort)) {
  if (!zHe) zHe=!0, t(`output_config.effort '${fi.effort}' clamped to '${b2e}': thinking is ${n_?"mechanically ":""}disabled for this request, and this model rejects higher effort when thinking is disabled`);
  if (!n_ && Js(h.querySource)==="main" && Sa().once("effort_thinking_disabled_clamp"))
    i("tengu_effort_clamped_thinking_disabled",{from:c(fi.effort),to:c(b2e),query_source:As(h.querySource)});
  fi.effort = b2e }
```

with `[BIN]` byte 7825209:

```js
function KIn(e){let n=Ge(e);return Lm(n,"thinking_disabled_effort_cap",e)??n==="claude-opus-5"}
var b2e="high";
function qIn(e){return Pk(e)&&M(e)>M(b2e)}
```

The effect is a **clamp of `output_config.effort` to `"high"`**, with a warning
and a telemetry event — not a refusal. `M(e)` is an index into the effort ladder
`ld`; `Pk` is unresolved `[UNR]`.

Corroborating ordinal from a different structure `[BIN]` byte ~20160250:
`settings_vocabulary.effort_level = {low:1, medium:2, high:3, xhigh:4, max:5}`.

---

## 7. Beta composition

2.1.280 composes `anthropic-beta` from **two declarative tables** plus
imperative pushes in the request builder. This package models the same result as
seventeen ordered push sites in `src/betas.ts`; the mapping below is what makes
that port auditable.

### 7.1 `kw` — the per-model table, eleven entries

`[BIN]` byte 7027538:

```js
var kw=[
 {beta:ert, when:(e)=>!e.canonical.includes("haiku")},
 {beta:swe, when:()=>ft()||iwe()&&!zQt()&&pc()},
 {beta:RN,  when:(e)=>id(e.model)},
 {beta:SAt, when:(e)=>!a.DISABLE_INTERLEAVED_THINKING&&e.interleavedThinking},
 {beta:vAt, when:(e)=>e.firstPartyOnlyBetas&&e.interleavedThinking&&!Ce()&&!sQt()},
 ...BR?[{beta:BR, when:(e)=>e.interleavedThinking&&!e.experimentalBetasOff&&(e.provider==="firstParty"||(e.provider==="bedrock"||e.provider==="mantle")&&vw(e.model))}]:[],
 {beta:sGe, when:(e)=>{let n=a.USE_API_CONTEXT_MANAGEMENT&&!1,r=yw(e.model);return e.firstPartyCapabilityBetas&&(n||r)}},
 {beta:k7,  when:(e)=>{let n=x("tengu_tool_pear",!1);return e.firstPartyCapabilityBetas&&aQt(e.model)&&n}},
 {beta:rNn, when:(e)=>e.provider==="vertex"&&hw(e.canonical)||e.provider==="foundry"},
 {beta:trt, when:(e)=>e.firstPartyOnlyBetas},
 {beta:jR,  when:(e)=>kue(e.model)}
];
```

The eleven entries of `kw` map onto **ten** of this package's
`composeBetasWithAudit` push sites, **in the same relative order** `[DER]`.
Package site 7 is `NARRATION_SUMMARIES`, which has no counterpart in `kw`:
upstream removed that beta after 2.1.195, and the package keeps the site only
so it stays inert rather than shifting the sites after it. The one of the
eleven `kw` entries with no package site is `web_search` (`rNn`), which upstream
pushes only for vertex and foundry and this anthropic-only package deliberately
omits:

| `kw` | Beta                              | Package push site         |
| ---- | --------------------------------- | ------------------------- |
| 1    | `claude-code-20250219`            | `CLAUDE_CODE`             |
| 2    | `oauth-2025-04-20`                | `OAUTH_AUTH`              |
| 3    | `context-1m-2025-08-07`           | `LONG_CONTEXT`            |
| 4    | `interleaved-thinking-2025-05-14` | `INTERLEAVED_THINKING`    |
| 5    | `redact-thinking-2026-02-12`      | `REDACT_THINKING`         |
| 6    | `thinking-token-count-2026-05-13` | `THINKING_TOKEN_COUNT`    |
| 7    | `context-management-2025-06-27`   | `CONTEXT_MANAGEMENT`      |
| 8    | `structured-outputs-2025-12-15`   | `STRUCTURED_OUTPUTS`      |
| 9    | `web-search-2025-03-05`           | *(deliberately omitted)*  |
| 10   | `prompt-caching-scope-2026-01-05` | `PROMPT_CACHING_SCOPE`    |
| 11   | `mid-conversation-system-2026-04-07` | `MID_CONVERSATION_SYSTEM` |

Entry 9 confirms the package's omission of `web_search`: upstream pushes it only
for `vertex` (with a model list) and `foundry`. Entry 8's `x("tengu_tool_pear",false)`
corroborates `structuredOutputsEnabled: false`. Entry 7's environment branch is
dead-coded (`a.USE_API_CONTEXT_MANAGEMENT && !1`), so only `yw(model)` matters.

Supporting gates `[BIN]`:

- `yw(e)` byte 7024973 — `let n=Ge(e),r=Lm(n,"context_management",e); if(r===!1)return!1; let s=sc(e); if(s==="foundry")return!0; if(mD(s))return!n.includes("claude-3-"); return r||n==="claude-mythos-5"`.
  **On first-party this ignores the catalogue and returns true for every
  non-`claude-3-` model**, including `claude-mythos-5`, whose capability array is
  empty. This package derives `contextManagement` straight from the catalogue, so
  it would *not* send `context-management-2025-06-27` for `claude-mythos-5`.
  This is a **pre-existing divergence**, present against 2.1.233 too; it is not
  introduced by 2.1.280 and is recorded here because §5.4 makes it visible.
- `aQt(e)` byte 7025160 — `if(!mD(sc(e)))return!1; return!or(Ge(e),"claude-opus-4-1")`.
- `vw(e)` byte 7026246 — `return!or(Ge(e),"claude-opus-4-7")`.
- `hw(e)` byte 7024554 — an explicit model list for the vertex web-search branch.
- `kue(e)` byte 7025478 — `Hi((n)=>n.midConversationSystem,e,()=>Sw(e))`.

### 7.2 `Aw` — the per-request table, four entries

`[BIN]` byte ~7028420:

```js
Aw=[
 {beta:AN, when:(e)=>e.perTurnTiming||wRt(e.model,e.canonical)},
 {beta:w$, when:(e)=>e.perTurnTiming},
 {beta:j_, when:(e)=>oQt()&&Tue(e.model)},
 {beta:W_, when:(e)=>oQt()&&Tue(e.model)&&xDn()},
 ...[]
];
```

The trailing `...[]` is a build-time-elided conditional group.

Gates `[BIN]`:

```js
// 6917914
function wRt(e,n){ if(!Fg()||!mD(sc(e)))return!1;
  if(Lm(n,"per_turn_effort",e)===!1)return!1;
  if(_xt(n,"per_turn_effort",e)!==!0&&np?.(n,e)!==!0)return!1;
  return tl?.()!==!0 }
// 6918084
function PDn(e,n){ if(!Dn.CLAUDE_CODE_PER_TURN_TIMING||!Fg()||!mD(sc(e)))return!1;
  let r=fwr(n,"per_turn_timing"); return r===void 0?wRt(e,n):r&&tl?.()!==!0 }
// 7025546
function Tue(e){ if(!Fg()||!kue(e))return!1;
  if(a.CLAUDE_CODE_FORCE_MID_CONVERSATION_SYSTEM)return!0;
  let n=Ge(e); if(HPr(n))return!1;
  let r=Lm(n,"mid_conv_tool_change",e); if(r!==void 0)return r;
  return n==="claude-mythos-5"||fc(Rx(n))===void 0 }
// 7004809
function oQt(){return fN()}
// 7004655
function xDn(){ if(!fN())return!1; if(a.CCR_SESSION_PROFILE)return!1;
  if(a.CLAUDE_CODE_INLINE_TOOLS!==void 0)return a.CLAUDE_CODE_INLINE_TOOLS;
  return Vf(xA) }
// 6916815
function fN(){let e=el.reader; if(!e)return!0;
  try{return e("tengu_foamy_spring",!0)!==!1}catch{return!0}}
function Vf(e){let n=el.reader; if(!n)return!1;
  try{return n(e,!1)===!0}catch{return!1}}
// 4387982
function HPr(e){return n().host.requestLatches.toolChangeUnsupportedModels().has(e)}
```

`fN()` defaults **true**; `Vf(x)` defaults **false**. `HPr` is a session latch,
empty on a fresh session.

### 7.3 The pipeline

`[BIN]` bytes 7028578–7029210:

```js
function Il(e){return Hi((n)=>n.allModelBetas,e,()=>Cw(e))}
function Cw(e){let n=xoe(),
  r={model:e,canonical:Ge(e),provider:Me(),experimentalBetasOff:n,
     firstPartyOnlyBetas:Fg(),firstPartyCapabilityBetas:mD(sc(e))&&!n,
     interleavedThinking:iQt(e)},
  s=[];
  for(let h of kw)if(h.when(r))s.push(h.beta);
  let g=a.ANTHROPIC_BETAS;
  if(g)if(KO())t("ANTHROPIC_BETAS ignored: experimental betas are disabled by your organization's policy",{level:"debug"});
       else s.push(...g.split(",").map((h)=>h.trim()).filter((h)=>h&&!srt(h)).map(Vbr));
  return s}
function cQt(e,n){let r=[...Y5(e)];
  if(n?.isAgenticQuery&&!r.includes(ert))r.push(ert);
  let s=Ge(e),g={model:e,canonical:s,perTurnTiming:PDn(e,s)};
  for(let w of Aw)if(w.when(g)&&!r.includes(w.beta))r.push(w.beta);
  let h=mf(); if(!h||h.length===0)return r;
  let y=irt(h); if(!y)return t("SDK betas dropped: …",{level:"debug"}),r;
  let E=y.map(Vbr);
  if(!Fg())E=E.filter((w)=>{if(Dg.has(w))return!0;
    return t(`SDK beta '${w.header}' dropped on 3P`,{level:"debug"}),!1});
  return[...r,...E.filter((w)=>!r.includes(w))]}
```

The `ANTHROPIC_BETAS` environment variable is upstream's analogue of this
package's `additionalBetas` extension, minus anything whose header contains
`afk-mode` (`srt`, §4).

### 7.4 Imperative pushes in the request builder

The remaining betas are pushed by the request builder through the session latch
set, not by either table `[BIN]`:

| Beta                                | Site     | Gate                                                            |
| ----------------------------------- | -------- | --------------------------------------------------------------- |
| `fast-mode-2026-02-01` (`wAt`)      | 13593531 | `if(Gm)tH(ht,wAt)`; `vae=dT(ht,wAt)&&(!l7(querySource)\|\|Dc)`  |
| `cache-diagnosis-2026-04-07` (`b0e`)| 13593531 | `if(ppr())tH(ht,b0e); nv=dT(ht,b0e)`                            |
| `thinking-binding-controls` (`lD`)  | 13593798 | §6.3                                                             |
| `thinking-display-updates` (`Aoe`)  | 13604689 | §6.4                                                             |
| `thinking-resumption` (`rrt`)       | 13504644 | `if(Sxe(_e)&&!Fr.includes(rrt))Fr.push(rrt)`                    |
| `afk-mode-2026-01-31` (`qO`)        | ~13605600| `if(qO&&Nh&&o_r()&&ve&&!Fr.includes(qO))Fr.push(qO)`            |

with `[BIN]` byte 13504644:

```js
function Sxe(e){try{return Ma("tengu_thinking_block_resumption",!1)&&Fg()&&iQt(e)&&!MPr()}
  catch(n){f("query_thinking_block_resumption","header_gate_threw");u(n);return!1}}
```

and `o_r()` byte 7026246: `return Fg()||lQt()`, where
`lQt(){let e=Me();return e!=="firstParty"&&!RI(e)}`.

All three of `dangerous-tool-use-2026-09-03`, `message-threads-2026-08-12` and
`mid-conversation-system-clear-at-2026-08-21` now have located push sites; the
first two are in the run beginning at byte 13602150 and the third is at byte
13587696 (§9.3). Session-latch probe counters exist for the latter two
(`clearAtProbeFailures < 2`, `threadsProbeFailures < 2`, byte 4385962), which is
the retry machinery described in §7.7, not an emission condition.

### 7.5 `redact_thinking` is composed and then removed again

`kw` entry 5 gives `firstPartyOnlyBetas && interleavedThinking && !Ce() && !sQt()`,
which is a four-conjunct match for the first four conjuncts of this package's
guard `experimental && interleavedThinking && interactive && !thinkingSummariesShown`
`[DER]`. `Ce()` is `[BIN]` byte 4364829,
`function Ce(){return!n().host.launchOptions.isInteractive()}`, so `!Ce()` is
exactly the `interactive` position.

The package's fifth conjunct, `!thinkingDisplayActive`, is where the port and the
2.1.280 client part company. `qu` is `[BIN]` byte 13604500:

```js
let qu=()=>{let ji=Fr.indexOf(vAt);if(ji!==-1)Fr.splice(ji,1)};
if(yc&&Vg)qu();
```

and it is called a **second** time inside the `connector_text` branch at byte
13604689, immediately after the client writes `display:"updates"` onto the
thinking object itself.

Those are two different removals. The first keys off `Vg`, which is the value the
**caller** supplied (`Vg = !ac ? void 0 : r.display==="highlights"&&LPr() ? "omitted" : r.display`,
§6.1) — that is the one the package already models as `!thinkingDisplayActive`.
The second keys off the client's **own** injection, which no caller requested and
which the package therefore cannot currently detect.

**Consequence for the port** `[DER]`: on the §7.6 scenario the caller supplies no
display, so `Vg` is undefined and the first removal does not fire, but the second
one does. `redact-thinking-2026-02-12` is pushed by `kw` entry 5 and spliced out
again before serialisation. The package emits it; the genuine client does not.
This is a **removal behaviour**, not a data value, and §13 carries it as such.

### 7.6 The genuine client's default-path `anthropic-beta`, as one ordered literal

Everything in §7.1–§7.5 exists to support exactly one artefact: the complete,
ordered header the genuine client sends on a first request. Without it, "the
package emits the right betas" is unfalsifiable. Here it is.

**Scenario fixed for this derivation.** Model `claude-opus-5-5` (the
`aliases.opus.default`, §5.6); provider first-party; OAuth credentials, no
`ANTHROPIC_API_KEY`; interactive REPL, `querySource` beginning
`repl_main_thread`; thinking active and adaptive; the caller supplies no
`thinking.display`; cache TTL 5m; every remote flag at its shipped default;
no caller feature flags (`fastMode`, `serverClassifier`, `taskBudget`,
`outputFormat`, `serverRefusalFallback`, `evictCacheOnComplete` all unset);
first request of the session, so every sticky latch is empty.

`[DER]` under those assumptions, evaluating `Cw` → `cQt` → `Fr` → `Gd` → `Kl`
→ `WR(Kl)`:

```
claude-code-20250219,
oauth-2025-04-20,
interleaved-thinking-2025-05-14,
thinking-token-count-2026-05-13,
context-management-2025-06-27,
prompt-caching-scope-2026-01-05,
mid-conversation-system-2026-04-07,
per-turn-control-2026-07-01,
mid-conversation-tool-changes-2026-07-01,
mid-conversation-system-clear-at-2026-08-21,
effort-2025-11-24,
thinking-binding-controls-2026-08-01,
thinking-display-updates-2026-08-18,
cache-diagnosis-2026-04-07
```

**Fourteen identifiers**, and the body carries
`thinking: {type:"adaptive", display:"updates"}` (§6.4).

The identifiers by upstream alias, so the code quoted in §7.1–§7.4 can be read
against this list: `ert`, `swe`, `SAt`, `BR`, `sGe`, `trt`, `jR` (all from `kw`);
`AN`, `j_` (from `Aw`); `V1` (§9.3); `y0e`, `lD`, `Aoe`, `b0e` (request builder).

**One identifier is composed and then removed.** `kw` entry 5 pushes `vAt`
(`redact-thinking-2026-02-12`) and the `connector_text` branch splices it out
again at byte 13604689 (§7.5). It is in neither list below: not present on the
wire, and not absent for a gate reason.

Every identifier that is *absent* is absent for a transcribed reason, not an
unexamined one:

| Absent identifier                             | Decisive gate                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `context-1m-2025-08-07`                       | `id(e)` needs `/\[1m\]/i` in the raw model; the secondary push needs `L7t` (byte 7018222), which returns non-null only for `claude-sonnet-4-6` |
| `structured-outputs-2025-12-15`               | remote flag `tengu_tool_pear` defaults false                                                       |
| `web-search-2025-03-05`                       | `kw` entry 9 is vertex/foundry only                                                                |
| `advanced-tool-use-2025-11-20`, `tool-search-tool-2025-10-19` | no push site in `kw`, `Aw` or the request builder                                   |
| `timing-2026-09-09`                           | `PDn` (byte 6918084) requires env `CLAUDE_CODE_PER_TURN_TIMING`                                     |
| `inline-tools-2026-09-15`                     | `xDn` (byte 7004655) ends at `Vf(xA)`, remote flag defaults false                                   |
| `thinking-resumption-2026-07-17`              | `Sxe` (byte 13504644), flag `tengu_thinking_block_resumption` defaults false                        |
| `dangerous-tool-use-2026-09-03`               | the push `if(dT(ht,qk)&&!Fr.includes(qk))Fr.push(qk)` sits in the request-builder run beginning at byte 13602150; `dT(ht,qk)` is armed only by `qg`, which requires caller `serverClassifier===true` |
| `advisor-tool-2026-03-01`                     | pushed at byte 13580256 under `t7e()&&(Yb()\|\|h.advisorModel!==void 0)`. `t7e` (byte 10064647) is true on a default first-party install, but `Yb` (byte 10064748) is `x("tengu_sage_compass2",{}).enabled??!1`, which defaults false, and `advisorModel` is unset |
| `fast-mode-2026-02-01`                        | `vae` requires `dT(ht,wAt)`, armed only when the caller sets `fastMode`                             |
| `afk-mode-2026-01-31`                         | requires a non-default permission mode or remote flag `Tpr` (defaults false)                        |
| `extended-cache-ttl-2025-04-11`               | `yl==="1h"`; the scenario is 5m                                                                    |
| `prompt-caching-evict-2026-05-12`             | `mpr()` (declared immediately after `ppr` in the run at byte 13572447) needs flag `tengu_subagent_cache_evict` (false) **and** caller `evictCacheOnComplete` |
| `message-threads-2026-08-12`                  | the planner `mu` is `null` at byte 13594600, so `Bf` is null on the first request                    |
| `context-hint-2026-04-09`                     | the controller factory (byte 24835618) returns `{beta:Ubr,…}` only when `let n=c()` is true. `[BIN]` byte 24833559, in `chunk-p1m27ycm.js`: `function c(){return x("tengu_hazel_osprey",!1)}` — defaults **false**, so `buildRequestParams` returns `null` and nothing is pushed |
| `task-budgets-2026-03-13`, `server-side-fallback-2026-06-01`, `server-side-fallback-2026-07-01`, `fallback-credit-2026-06-01`, `auto-mode-classifier-2026-07-16` | each pushed from a helper that takes a caller-supplied argument (`rpr`, `opr`, `ixt`, `lxt`), all unset in the scenario |
| `mcp-servers-2025-12-04`, `files-api-2025-04-14`, `environments-2025-11-01`, `ccr-byoc-2025-07-29` | no push site located in `kw`, `Aw` or the request builder. These four are registry entries for surfaces outside the `/v1/messages` path (the MCP proxy, the Files API, environments, BYOC); the same class as `advanced-tool-use` and `tool-search-tool` above, and the package has never emitted them either |

**The two tables plus one account for the whole registry.** Fourteen present,
twenty-five absent, one composed-then-removed (`redact-thinking-2026-02-12`),
forty total — matching §4.1's forty entries exactly, with the two non-beta
members of §4.3 correctly outside the array and therefore outside all three
groups. This arithmetic is stated so a reader can check that no registry entry
was silently skipped; one earlier revision left five entries in no group at all,
and another counted thirteen because it had `clear_at` and
`thinking-display-updates` on the wrong side and `redact-thinking` on the wire.

**Why the order survives serialisation.** The chain's last three steps are
`[BIN]` at bytes 13606880–13608300:

```js
let Gd=hs?Fr.filter((ji)=>ji===swe):Fr;
…
nb=WR(Gd), Kl=DDn(Gd), ml=qy&&(!hs||Gd.length>0);
let vu={ …, ...ml&&{betas:WR(Kl)}, … };
```

`hs` is `a.CLAUDE_CODE_SIMULATE_PROXY_USAGE`, unset in the scenario, so `Gd` is
`Fr` itself. `qy` is `Ee.length>0` (`[BIN]` byte 13592595) and is true, so `ml`
is true and the `betas` key is present at all. `DDn` (byte 7029997) is
`if(iwe())return e;return e.filter((n)=>Dg.has(n))` — an identity on first-party
and an order-preserving `Array.prototype.filter` otherwise. `WR` is
`e.map((s)=>s.header)`. No step reorders.

`nb` is **not** a second wire header. Its only consumers are the rejection
handlers at bytes 13595075–13621656 (`RHe`, `AHe`, `PHe`, `VK`, `Uce`), each of
which asks `nb.includes(<beta>.header)` to decide which identifier to strip on a
retry (§7.7). `betas: WR(Kl)` is the sole beta output on the wire.

#### 7.6.1 What the package emits today, and the exact delta

Running this package's seventeen push sites against the same scenario with the
2.1.233 policy yields **nine** of the fourteen. Their relative order is
*identical* to the genuine client's — the existing port's emergent ordering is
correct where it has coverage. The nine are `claude-code-20250219`,
`oauth-2025-04-20`, `interleaved-thinking-2025-05-14`,
`thinking-token-count-2026-05-13`, `context-management-2025-06-27`,
`prompt-caching-scope-2026-01-05`, `mid-conversation-system-2026-04-07`,
`effort-2025-11-24`, and — once §7.6.2's data fix lands —
`cache-diagnosis-2026-04-07`. It *also* emits `redact-thinking-2026-02-12`,
which the genuine client composes and then removes again (§7.5), so the package
sends one identifier too many as well as five too few.

Five identifiers are missing, and the package has no key for any of them:

| Missing identifier                            | Why the package cannot emit it today                                  | Package site position |
| --------------------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| `per-turn-control-2026-07-01`                 | no composable key; no 2.1.233 model declared `per_turn_effort`          | new site between 11 (`MID_CONVERSATION_SYSTEM`) and 12 (`EFFORT`) |
| `mid-conversation-tool-changes-2026-07-01`    | no composable key                                                      | new site immediately after the above, still before 12 |
| `mid-conversation-system-clear-at-2026-08-21` | no composable key                                                      | new site immediately after the above, still before 12 |
| `thinking-binding-controls-2026-08-01`        | no composable key                                                      | new site between 12 (`EFFORT`) and 13 (`SPEED`) |
| `thinking-display-updates-2026-08-18`         | no composable key, and the package never injects `display: "updates"`  | new site immediately after the above, still before 13 |

One identifier is emitted that should not be, and one policy value is wrong:

| Item                         | Class     | Action                                                                                                                                                                            |
| ---------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redact-thinking-2026-02-12` | behaviour | must be **removed** from the composed set whenever the package injects `display: "updates"`, mirroring `qu()` (§7.5). The existing `!thinkingDisplayActive` guard covers only the caller-supplied case |
| `cache-diagnosis-2026-04-07` | data      | **site 17 already exists**; the pinned policy sets `cacheDiagnosisEnabled: false` and 2.1.280 requires `true` (§7.6.2) — a data fix, not a new site                                 |

So `ComposableBetaRegistry` goes from seventeen keys to **twenty-two**, and one
removal behaviour joins the existing composition.

The order of the first three is not a choice. `Aw` is `[AN, w$, j_, W_]` (§7.2)
and `cQt` iterates it with `for (let w of Aw)`, so `per-turn-control` (`AN`)
precedes `mid-conversation-tool-changes` (`j_`). `Aw` is evaluated inside
`cQt`, after every `kw` entry, and `[BIN]` byte 7029340 shows `cQt`'s body to
its closing brace: nothing is pushed after the `Aw` loop except SDK betas from
`mf()`, which is empty by default. `clear_at` (`V1`) is pushed into that same
array immediately after `cQt` returns, before the request builder runs at all
(§9.3). That is why all three land after `mid-conversation-system` (`kw` entry
11) and before `effort`.

The remaining positions are fixed by six offsets, each a *call* site, not a
definition:

| Push                                        | Call site `[BIN]` | Statement                                                            |
| ------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| `mid-conversation-system-clear-at` (`V1`)   | **13587696**      | `let Mo=…;if(Mo&&!Ee.includes(V1))Ee.push(V1)`                       |
| `effort-2025-11-24` (`y0e`), via `gTe`      | **13602839**      | `delete Mi.output_config,gTe(ao,fi,Mi,Fr,_e),TXt=eke(…)`             |
| `thinking-binding-controls` (`lD`)          | **13604233**      | `let Xy;if(lv){if(!Fr.includes(lD))Fr.push(lD);…}`                   |
| `thinking-display-updates` (`Aoe`)          | **13604689**      | `if(yc={...yc,display:"updates"},!Fr.includes(Aoe))Fr.push(Aoe);qu()` |
| `fast-mode-2026-02-01` (`wAt`)              | **13605400**      | `if(vae&&!Fr.includes(wAt))Fr.push(wAt)`                             |
| `cache-diagnosis-2026-04-07` (`b0e`)        | **13606358**      | `if(nv&&!Fr.includes(b0e))Fr.push(b0e)`                              |

13587696 < 13602839 < 13604233 < 13604689 < 13605400 < 13606358, so the emitted
order is `clear_at`, `effort`, `thinking-binding-controls`,
`thinking-display-updates`, the SPEED slot, and finally `cache-diagnosis` — the
last of those confirming that package site 17 remains the right home for it, and
that sites 13 through 17 keep their existing relative order (§7.4). `gTe`'s
*definition* is at byte 13564660 and orders nothing; an earlier revision cited
it as if it did. Note also that the `Fr.push(lD)` at 13604233 is gated on `lv`
**alone** — the `Rx !== void 0` test on the following line guards the request
*body* field, not the header (§6.3).

> **Superseded.** Two earlier revisions of this section were wrong. The first
> listed three missing identifiers, placed them "at the tail", and had
> `mid-conversation-tool-changes` before `per-turn-control`. The second corrected
> the ordering but still counted only four, because it read
> `mid-conversation-system-clear-at` and `thinking-display-updates` as absent —
> the former from a misread catch-block default (§9.3), the latter from an
> unevaluated `pc()` (§6.4). Both are emitted. The delta is five new keys, one
> removal behaviour, and one data fix.

#### 7.6.2 `cacheDiagnosisEnabled` is `true` for 2.1.280, and 2.1.233 is now an open question

`[BIN]` byte 13593572, in the request builder:

```js
if (ppr()) tH(ht, b0e);
nv = dT(ht, b0e);
```

`[BIN]` byte 13572447 declares `ppr` and, immediately after it in the same
declaration run, `mpr`:

```js
function ppr(){return Fg()&&FOe()&&Nn()}
function mpr(){if(!Fg()||!FOe())return!1;if(a.CLAUDE_CODE_SUBAGENT_CACHE_EVICT)return!0;return x("tengu_subagent_cache_evict",!1)}
```

An earlier revision cited byte 13572447 for `mpr` as well. The anchor belongs to
`ppr`; `mpr` is the next declaration in the same run. A second, unrelated
`function ppr(e,n){return e?.[n]??[]}` sits at byte 10952109 — see §1.4.

`[BIN]` byte 7027314: `function FOe(e=Me()){if(e==="anthropicAws")return a.ANTHROPIC_AWS_BASE_URL===void 0;return e==="firstParty"&&ms()}`.

`Nn` is not defined in the module that contains `ppr`; it is imported. Every
import statement in the dump that binds `Nn` — twenty-eight of them, including
those at bytes 11459305 and 11570317, which belong to two *different* consuming
modules — names the same source, `B:/~BUN/root/chunk-xf9y73zk.js`. (An earlier
revision read as though one module carried two `Nn` imports, which would be an
early `SyntaxError`; it does not.) That chunk is the one that supplies `Me`,
`ms`, `hS`, `ja`, `sc` and `mD` throughout this document (§1.4), and the sole
`Nn` definition in its module is `[BIN]` byte 5966201:
`function Nn(){return Me()==="firstParty"}`. The other candidate in the dump,
`function Nn(){return 0}` at byte 4616378, sits in a path-manipulation module in
a different chunk and is never imported under that name — a textbook instance of
the collision hazard §1.4 describes, resolved the way §1.4 requires: by the
import binding, not by proximity.

`[DER]` On a first-party install `Fg()`, `FOe()` and `Nn()` are all true, so
`ppr()` is true, `b0e` is latched, `nv` is true, and
`cache-diagnosis-2026-04-07` is pushed at byte 13593572's downstream site.
**The 2.1.280 profile must set `cacheDiagnosisEnabled: true`.**

**Open question, deliberately not resolved here.** The pinned 2.1.233 profile
sets `cacheDiagnosisEnabled: false`. If `ppr` had the same shape in 2.1.233,
that value is wrong and the 2.1.233 profile has been omitting a header the
genuine client sent. This document cannot settle it: it has no 2.1.233 binary,
and the runbook forbids inferring one release's value from another's. The
question is recorded so it is not lost; answering it requires acquiring
`@anthropic-ai/claude-code-win32-x64@2.1.233` and transcribing `ppr` from that
build. Until then the 2.1.233 profile is left exactly as it is, and its
packed-consumer digest must not move.

#### 7.6.3 Why an "optimistic send" model is *not* being adopted

§7.7 shows upstream sends some betas optimistically and latches them off on
rejection. This package composes statically and has no retry loop. The honest
consequence is that a static composition is faithful to the **first** request of
a session and diverges only after a server rejection that the package never
observes. That is an acceptable, documented boundary — the retry ladder belongs
to the host — and it is not a licence to omit a beta that the first request
carries.

#### 7.6.4 The three new push sites are inert for 2.1.233

`[DER]` Each of the three is inert for 2.1.233 for its own reason, and the
reasons are not interchangeable:

- `thinking-binding-controls-2026-08-01` is **absent from the 2.1.233 registry**,
  so the new site's registry lookup finds no entry and pushes nothing. This is
  the same mechanism that already keeps `NARRATION_SUMMARIES` inert for 2.1.233.
- `per-turn-control-2026-07-01` **is** in the 2.1.233 registry, so registry
  absence does not protect it. What does is the catalogue: no 2.1.233 entry
  declares `per_turn_effort`, and the new site's guard is a catalogue read.
- `mid-conversation-tool-changes-2026-07-01` is likewise in the 2.1.233 registry
  and likewise guarded by a catalogue read — but only because the port
  deliberately implements **step 2 of `Tue` and not step 3** (§13.3). Upstream's
  step 3 sends the beta for any model with *no* catalogue entry. Porting that
  would make the package emit this beta for every unrecognised model string,
  which is precisely the maximally-permissive predicate fallback the 2.1.233
  profile already rejected when it catalogued `claude-mythos-5` with an empty
  capability array. The omission is a recorded divergence, not an oversight, and
  it is what makes this bullet true.

The packed-consumer digest
`4e06af42310d63549a4fa9af60ff0c9b13e95d7864624c6b7bf94d45ce9a3997` must not move
— and it is the regression test for all three claims, not a hope.

This paragraph is about the three *new sites* only. It says nothing about
`cacheDiagnosisEnabled`, which is an existing site and an open question (§7.6.2).

### 7.7 The rejection ladder and the latch layer

`[BIN]` byte 13615045:

```js
Pce=(er)=>{
  let Cr = Ee.includes(W_) && !ew(er) && kX(er)!=="header_rejected" ? _ke(er) : void 0;
  if(Cr!==void 0){ … Ee=Ee.filter(fi=>fi!==W_); … return "retry:inline-tools-strip" }
  let Fr = Ee.includes(j_) && !ew(er) ? kX(er) : void 0;
  if(Fr!==void 0){ … Ee=Ee.filter(fi=>fi!==j_&&fi!==W_); … return "retry:tool-change-strip" }
  … }
```

Strictly ordered: stripping `mid_conv_tool_change` also strips `inline_tools`.

`[BIN]` byte 13621020, the binding-controls handler:

```js
VK=(er,Cr=!1)=>{ if(!lv||!nb.includes(lD.header))return null;
  let Fr=mke(er)||!iwe()&&Eat(er),
      $o=!iwe()&&(J8(er)||Cr&&er instanceof Rt&&er.status===400&&!PA(er)&&!K0(er));
  if(!Fr&&!$o)return null;
  return lv=!1,Rx=void 0,Ee=Ee.filter((bs)=>bs!==lD),Sh(ht,lD),
    t("[thinking] server rejected the thinking-binding-controls beta; dropping the header and the block_binding value for this conversation and retrying.") }
```

`[BIN]` byte 12624570, the error matchers:

```js
fke(e)  // 400 && /thinking\.(adaptive|enabled)\.display: Input should be /
pke(e)=fke(e)||Sy(e.message,Aoe)
mke(e)  // 400 && /thinking\.(adaptive|enabled)\.block_binding(\.prefix_mismatch_behavior)?: Extra inputs are not permitted/
Eat(e)  // 400 && e.message.includes(lD.header)
gke(e)  // the same shape for BR
```

`[BIN]` byte 4385962 and export list 21638353 — the latch family:
`markEffortUnsupported`, `markToolChangeUnsupportedModel`,
`markInternalModelFieldsRefused`, `markThirdPartyServerClassifierRefused`,
`midConvCachePromotionRejected`, `markMidConvCachePromotionRejected`,
`isThinkingHighlightsRefused`, `isThinkingResumptionRefused`,
`isToolChangeHeaderRefused`, `isSilentRefusalFallbackServerArmed`,
`latchRefusalFallbackModel`, plus bounded probe counters
`clearAtProbeFailures < 2` and `threadsProbeFailures < 2`.

### 7.8 Capability resolution has three layers, and an environment override

`[BIN]` byte 5960505:

```js
function Lm(e,t,n){return cen(t,e)??_xt(e,t,n)}
function _xt(e,t,n){if(O$().servedCapabilityLookup?.(t,[n,h(e)])===!0&&U(t))return!0;
  return fwr(e,t)?!0:void 0}
function fwr(e,t){return fc(h(e))?.capabilities.includes(t)}
function cen(e,t){let n=a.CLAUDE_CODE_MODEL_CAPABILITIES; if(n===void 0)return;
  let r=h(t),i; for(let u of n.split(";")){let s=u.indexOf("=");
    if(s!==-1){let _=u.slice(0,s).trim(); if(_==="")continue;
      if(!(_.endsWith("*")?r.startsWith(_.slice(0,-1)):r===_))continue} …
```

Resolution order is: **environment override
(`CLAUDE_CODE_MODEL_CAPABILITIES`, syntax `model=cap,cap;prefix*=cap`) →
remote `servedCapabilityLookup` → the static catalogue.** A separate
provider-level override exists at byte 7020189 (`Eue`/`iw`, driven by paired
`modelEnvVar`/`capabilitiesEnvVar` entries).

This is out of scope for the package — it models the static catalogue, which is
the third layer — but it explains why a live client can disagree with the
catalogue, and it is the mechanism behind the `Lm(…)!==void 0` early returns in
§7.2's gates.

---

## 8. Transport and OAuth

### 8.1 Scalars

| Field                    | 2.1.233                                  | 2.1.280                                  |
| ------------------------ | ---------------------------------------- | ---------------------------------------- |
| Version                  | `2.1.233`                                | `2.1.280`                                |
| Build time               | `2026-08-14T17:21:48Z`                   | `2026-09-21T20:40:17Z`                   |
| Git SHA                  | `f8d57569aaf350fe25dc4dfa10cad59db8ea4d45` | `80abbfe7d7232280011ff01a21ae3338f4c6e372` |
| SDK / package version    | `0.112.1`                                | `0.112.1`                                |
| Endpoint                 | `/v1/messages?beta=true`                 | unchanged                                |
| `anthropic-version`      | `2023-06-01`                             | unchanged                                |
| Fingerprint salt         | `59cf53e54c78`                           | unchanged                                |

`[BIN]` `var ne="0.112.1"` at byte 4407908 is the **only** such declaration in
the dump, and it is consumed at byte 4408311 as
`"X-Stainless-Package-Version":ne`. The extractor's `unresolved` marker for
`stainlessPackageVersion` is resolved by that adjacency.

`[BIN]` The user-agent template, byte 4408100 region:

```
claude-cli/2.1.280 (external, ${CLAUDE_CODE_ENTRYPOINT ?? "cli"}[, agent-sdk/..][, client-app/..][, workload/..])
```

The extractor reports `userAgent` as `anchor-ambiguous` because the dump
contains more than one `claude-cli/` occurrence; the others are the same
template re-imported in consuming modules (§1.4) and a log-format string. The
template above is the sole *definition*. Its shape is identical to 2.1.233, so
the profile's pinned `userAgent` differs only in the version number.

### 8.2 OAuth constants

`[BIN]` byte 4655440:

```js
var a={BASE_API_URL:"https://api.anthropic.com",
  CONSOLE_AUTHORIZE_URL:"https://platform.claude.com/oauth/authorize",
  CLAUDE_AI_AUTHORIZE_URL:"https://claude.com/cai/oauth/authorize",
  CLAUDE_AI_ORIGIN:"https://claude.ai",
  TOKEN_URL:"https://platform.claude.com/v1/oauth/token",
  API_KEY_URL:"https://api.anthropic.com/api/oauth/claude_cli/create_api_key",
  ROLES_URL:…, MCP_PROXY_PATH:"/v1/toolbox/shttp/mcp/{server_id}", …}
```

`[BIN]` byte 4656690 — local development overrides
`CLAUDE_LOCAL_OAUTH_APPS_BASE` (default `http://localhost:4000`) and
`CLAUDE_LOCAL_OAUTH_CONSOLE_BASE` (default `http://localhost:3000`).

`[BIN]` byte 4657393 — the custom-endpoint allowlist:

```js
var Nve=["https://beacon.claude-ai.staging.ant.dev",
         "https://claude.fedstart.com","https://claude-staging.fedstart.com"];
// else: throw Error("CLAUDE_CODE_CUSTOM_OAUTH_URL is not an approved endpoint.")
```

`[BIN]` byte 4418342 — SDK constants:

```js
var qs="urn:ietf:params:oauth:grant-type:jwt-bearer", Js="refresh_token",
    vr="/v1/oauth/token", Ce="oauth-2025-04-20", Ks="oidc-federation-2026-04-01",
    zs=120, Qqe=30, Vs=5, Ws=1048576;
```

`Qqe = 30` is the token-expiry skew in seconds (`le() < a - Qqe`).

`[BIN]` byte 4429828 — the refresh body carries **no `scope`**:

```js
{grant_type:"refresh_token", refresh_token, client_id}
// headers: Content-Type: application/json
//          anthropic-beta: oauth-2025-04-20
//          User-Agent: anthropic-sdk-typescript/0.112.1 userOAuthProvider
```

`[BIN]` byte 4427476 — OIDC federation (non-interactive machine auth):

```js
{grant_type:qs, assertion, federation_rule_id, organization_id,
 service_account_id?, workspace_id?}
// assertion > 16384 bytes is rejected ("exceeds the 16 KiB assertion limit")
// anthropic-beta: oauth-2025-04-20,oidc-federation-2026-04-01
// User-Agent: anthropic-sdk-typescript/0.112.1 oidcFederationProvider
```

`Ws = 1048576` is a general response-size guard; the 16384 limit is the
assertion-specific one. They are unrelated.

`[BIN]` byte 4654950 — scopes:

```js
Ov="user:inference", $z="user:profile", mqe="user:plugins",
urn="user:projects:read", prn="user:projects:write", E="org:create_api_key",
c=[E,$z],                                              // console
r=[$z,Ov,"user:sessions:claude_code","user:mcp_servers","user:file_upload"],
function gqe(){let t=nn(),e=[...r]; if(t.PLUGINS_SCOPE_REGISTERED)e.push(mqe); return e}
Xpe=["user:design:read","user:design:write"];
n=[urn,prn];  // L$n(t) filters requested project scopes against n
FK=31536000;  // default expiresIn, one year
```

Headless login uses `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` with a **required**
`CLAUDE_CODE_OAUTH_SCOPES` (space-separated) and an optional
`CLAUDE_CODE_OAUTH_CLIENT_ID`; the storage marker is `storageV5`. `CLIENT_ID`
is unchanged at `9d1c250a-e61b-44d9-88ed-5944d1962f5e`.

**`/v1/oauth/revoke` appears nowhere in the bundle.** `[BIN]` The genuine client
does not revoke.

### 8.3 The SDK's OAuth beta append deduplicates

`[BIN]` byte 4541459:

```js
prepareRequest(e,{url:t,options:r}){ if(this._authState.tokenCache&&this.apiKey==null){
  let n=e.headers instanceof Headers?e.headers:new Headers(e.headers);
  for(let[o,a]of Object.entries(this._authState.extraHeaders))if(!n.has(o))n.set(o,a);
  if(!n.get("anthropic-beta")?.split(",").map((o)=>o.trim())?.includes(Ce))
    n.append("anthropic-beta",Ce);
  e.headers=n}}
```

Because `kw` entry 2 already pushes `oauth-2025-04-20`, this append is a no-op
on the normal OAuth path `[DER]`. There is no duplicate identifier and no
reordering, and this package's single `OAUTH_AUTH` push site is correct.

---

## 9. Findings that constrain the port

### 9.1 A server-side version gate

`[EXT-1]` reports the error
`Anthropic API error (400 Bad Request): Claude Code 2.1.257 does not support this model; version 2.1.280 or newer is required`
for `claude-opus-5-5`, and observes that in some paths the request silently
resolves to `claude-opus-5` instead of failing. `[EXT-2]` independently
reproduces the same message at 2.1.278.

Neither report identifies the header or field the server keys on, so this
document states only that a **client-version signal** is gated, not that it is
the user agent. `[EXT-1]` `[EXT-2]`

The consequence is unchanged by that caution: a consumer presenting 2.1.233
cannot address `claude-opus-5-5`. The default-profile switch is a correctness
requirement, not an optimisation.

### 9.2 `context_hint` remains off, and reveals an unmodelled body field

`[BIN]` byte 24835858:

```js
function G(e){
  if(!e.includeFirstPartyBetas)return null;
  if(!e.querySource.startsWith("repl_main_thread"))return null;
  let n=c(),o=!1,s=!1,d=!1;
  return {active:n, buildRequestParams(r){ if(s=!1,!n||o)return null; s=!0;
    let u=z6n(r,k).tokensSaved>=W6n, a=m();
    return {beta:Ubr,
            body: u?{context_hint:{enabled:!0, ...a>0&&{target_tokens_saved:a}}}:null}; },
    async onRequestError(r,u){…}};
}
```

Five gates, not two: `includeFirstPartyBetas`, a `repl_main_thread` query
source, the remote flag `c()`, a per-request `o` latch, and
`tokensSaved >= W6n`. The remote flag alone is enough to justify
`contextHintEnabled: false` in the profile `[DER]`; the `querySource` gate is
*not* a valid justification for a library whose purpose is to reproduce the
main-thread request.

The body field `context_hint: {enabled, target_tokens_saved?}` is not modelled
by this package.

### 9.3 `clear_at` is on the wire

`[BIN]` byte 13539366:

```js
function RRt(e,n){let r=[],s=[];
  return e.forEach((g,h)=>{ s.push(r.length);
    if(!n.dropBase.has(h))r.push(g);
    let y=n.clearAtAfter.get(h);
    if(y!==void 0)r.push({role:"system",content:y,clear_at:"next_user_message"}) }),
  s.push(r.length), {wire:r,wireIndexOf:s}}
```

The ephemeral portion becomes a separate `role: "system"` message carrying
`clear_at: "next_user_message"`, appended after the base; if the base is left
empty and has no `toolAdditions`, `toolRemovals` or `outputConfig`, it is
dropped entirely (`dropBase`).

The beta that licenses it is emitted on the default path. `[BIN]` byte
13587696, in the run that also binds `ao`:

```js
let Mo=!l7(h.querySource)&&!Vr&&Ee.includes(jR)&&y(()=>Mee(Ne??h.model));
if(Mo&&!Ee.includes(V1))Ee.push(V1);
```

All four conjuncts hold in §7.6's scenario. `l7` (byte 7004407) is true only for
`auto_mode` and `auto_mode_investigator`, so `!l7(querySource)` holds for a REPL
main-thread query; `Vr = Jf(ht, V1)` is false on a first request with an empty
latch set; `Ee.includes(jR)` holds because `mid-conversation-system` is composed
by `kw` entry 11; and `Mee` resolves as follows.

`[BIN]` byte 13520868: `function Mee(e){return oRt(e)!=="off"}`. `[BIN]` byte
13520906, `fur`, which `oRt` wraps:

```js
if(!Fg()||Me()!=="firstParty"||!hS())return"off";
if(fs().keptReminderRetired)return"off";
let r=sRt(K()),s=qt(e).toLowerCase(),g=r.get(s);
if(g!==void 0)return g;
if(!bwt())return r.set(s,"off"),"off";
let{scope:h,source:y}=uur(e),w=h==="threads"&&!Cy()?"off":h;…
```

On a first request the per-model map `r` is empty, so the memoised `g` is
`undefined`; `bwt()` is true (§13.5); and `uur` supplies the scope. `[BIN]` byte
13520185, `uur`'s tail:

```js
let h=x("tengu_sleepy_snowflake","all");
return{scope:h==="threads"||h==="all"?h:"off",source:"growthbook"}
```

The coded default of `tengu_sleepy_snowflake` is **`"all"`**, not `"off"`. With
`h === "all"` the `h==="threads"` test is false, so `w = "all"` and `Cy()` (byte
13519933, flag `tengu_curious_tower`, default false) is never reached. `Mee`
therefore returns true `[DER]`, `Mo` is true, and
`mid-conversation-system-clear-at-2026-08-21` is pushed into `Ee` — after `cQt`
has returned and before any request-builder push, which is exactly the position
§7.6.1 records.

> **Superseded.** An earlier revision concluded that this beta was absent
> because "the delivery state machine starts `"off"`". That `"off"` is `oRt`'s
> **catch-block fallback**, not the value the happy path produces. The mistake
> was reading an error handler as a default.

Rejection detector `[BIN]`:

```js
nNn=/^messages\.\d+(?:\.content\.\d+)?(?:\.clear_at:|: .*(?:turn-scoped system message|\(clear_at: |clear_at is only permitted))/
```

What `clear_at` does to billing or caching on the server is **not evidenced by
the bundle** `[UNR]`. This document therefore records only the wire shape, the
gate that emits the beta, and the client's own rejection handling.

### 9.4 A second model list exists, and it is why three dated ids leaked

`[BIN]` bytes ~20,153,963–20,192,969 contain a **second** model list with an
entirely different vocabulary:

```js
{id:"claude-haiku-4-5-20251001", name:"Haiku 4.5", short_name:"Haiku",
 description:"Fastest for quick answers", section:"main",
 capabilities:{compass:!0,gsuite_tools:!0,mm_images:!0,mm_pdf:!0,web_search:!0},
 thinking:{type:"none"}, auto_permission_mode:"unavailable", quick_select:!0,
 runtime:{max_input_tokens:200000,max_output_tokens:64000,
          capabilities:["compass","gsuite_tools","mm_images","mm_pdf","web_search"],
          image_limits:{max_width:1568,max_height:1568}, family:"haiku"},
 offered_on:["first_party","anthropic_aws","bedrock","vertex","foundry","mantle","gateway"]}
```

`section`, `short_name`, `quick_select`, `compass`, `gsuite_tools` and
`auto_permission_mode` are a **product surface** vocabulary; this is the Claude
app's model picker, not a wire catalogue. The same region carries
`settings_vocabulary` and `provider_alias_targets`.

**Why exactly three dated identifiers reach the extractor report** `[DER]`:
`extractModels` anchors on `MODEL_ID_ANCHOR = /(?:"id"|'id'|\bid)\s*:\s*["']claude-/gu`,
which matches `id:` in *both* lists, and admits an enclosing object that carries
any catalogue key — which `capabilities` satisfies. It then deduplicates by id,
keeping whichever record has more keys. Every app-list entry whose id is
**undated** collides with a wire-catalogue entry and is absorbed. Only the three
app entries whose ids are **dated** have no counterpart, so only those three
appear as extra rows: `claude-haiku-4-5-20251001`, `claude-opus-4-1-20250805`,
`claude-opus-4-5-20251101`. The report therefore contains 23 rows for a 20-entry
wire catalogue.

The same three strings also appear as `provider_ids.first_party` values inside
the wire catalogue (bytes 5941964, 5947162, 5947737), but the extractor cannot
have collected them from there: `first_party:` does not match the anchor.

**The port must discard exactly these three rows**, and must not treat the
second list as a wire source.

---

## 10. Response and observability headers

`[BIN]` Present in 2.1.280 and consumed by the client:

| Header                                | Consumer / meaning                                             |
| ------------------------------------- | -------------------------------------------------------------- |
| `anthropic-thinking-prefix-mismatch`  | reports a prefix-mismatch outcome for thinking blocks           |
| `x-cc-fallback-*`                     | the 2.1.233-era server-side fallback family (registry #32–#34)  |

`[BIN]` byte 7352429 — gateway hint headers, **opt-in only**:

```js
var rDn="x-claude-code-request-class", oDn="x-claude-code-agent-type";
function Olo(e,n){ if(e===void 0)return; if(e==="compact")return"compaction";
  let r=Js(e); if(r==="subagent"&&n.agentType==="subagent"&&n.workflowRunId)return"workflow";
  return r }
var Nb="agent:builtin:";
function Mlo(e,n){ if(e===void 0||!e.startsWith("agent:"))return;
  if(n.agentType==="teammate")return"teammate";
  if(e.startsWith(Nb))return e.slice(Nb.length)||void 0; … }
```

These are enabled by `CLAUDE_CODE_GATEWAY_HINT_HEADERS=1` `[EXT-4]` and are
therefore **off** on the default path. They are out of scope for the package.

---

## 11. Other wire surfaces observed but out of the request-builder seam

Recorded so a future maintainer does not rediscover them, with an explicit note
that none is being ported (§12).

### 11.1 `inline_tools` content blocks

`[BIN]` byte 7356747 — the allowed block-type set `ad` gains
`dD = ["connector_text","tool_addition","tool_reference","tool_removal"]`, and
the `uD` map carries `mid_conv_system: true`. Of those four strings,
`connector_text` is also a display mode (§6.4) and `tool_reference` is a nested
`tool.type` rather than a top-level block type; `tool_definition` is the other
nested `tool.type` and is not in `dD`. The genuinely new **top-level block
types** are therefore two: `tool_addition` and `tool_removal` `[DER]`.

`[BIN]` builder at byte 10347857:

```js
function pZr(e,n,r,s=[],g={}){let h=[
  ...e?[{type:"text",text:e}]:[],
  ...s.map(y=>({type:"tool_removal",tool:{type:"tool_reference",name:y}})),
  ...n.map(y=>{let w=o7e(g,y);
    return w===void 0
      ? {type:"tool_addition",tool:{type:"tool_reference",name:y}}
      : {type:"tool_addition",tool:{type:"tool_definition",definition:w}}})];
  …}
```

These ride in `role: "system"` messages; the scanner at byte 10212157 checks
`r.role==="system"` then `Zv(g,"type")==="tool_addition"`.

`[BIN]` the two sticky fallbacks, verbatim:

```
[inline-tools] tool_definition rejected (${n}) — falling back to declaring late tools in tools[] and showing them by reference, off for the rest of this conversation (carried through a compaction; /clear starts afresh)
[late-tool-additions] tool_addition rejected (${n}) — falling back to the ToolSearch announcement (or to inline tools where there is no ToolSearch), sticky-rejecting the beta until /clear or /compact
```

Causes: `header_rejected`, `unsupported_on_platform` for the first;
`header_rejected`, `block_type_unknown`, `model_unsupported` for the second.

Whether this preserves a server-side prompt cache is **not evidenced by the
bundle** `[UNR]`; the mechanism is visible, the billing consequence is not.

### 11.2 Per-turn effort and timing on `api_system` messages

`[BIN]` byte 13511180:

```js
function xee(e){return kCt(e,()=>{return})}
function Cee(e){return kCt(e,({timing:n,...r})=>Object.keys(r).length>0?r:void 0)}
function kCt(e,n){let r=[];
  for(let s of e){
    if(s.type!=="api_system"||s.outputConfig===void 0){r.push(s);continue}
    let{outputConfig:g,...h}=s, y=n(g);
    if(y!==void 0)r.push({...h,outputConfig:y});
    else if(h.message.content.length>0||(h.toolAdditions?.length??0)>0)r.push(h)}
  return r}
```

`xee` strips the whole `outputConfig` when `per_message_effort` is unavailable;
`Cee` strips only `timing` when `per_turn_timing` is unavailable. The existence
of these *downgrade transforms* is what proves that **`api_system` messages carry
their own `outputConfig` object** containing at least `effort` and `timing`.

The turn-state accumulator immediately above reads backwards from the last
assistant message:

```js
for(let y=e.length-1;y>=0;y--){let w=e[y];
  if(w.type==="assistant"&&!w.isApiErrorMessage)
    g=(w.perTurnEffort===void 0?w.effort:w.perTurnEffort)??g, h=w.perTurnTiming; … }
// returns {levels, times}
```

Only `claude-opus-5-5` and `claude-fable-5-1` declare `per_turn_effort`
(§5.4), so any worked example of mid-conversation effort variation must use one
of those two models.

### 11.3 `lean_prompt` selects which system prompt is sent

`[BIN]` byte 7850774:

```js
function te(e){let n=Ge(e),r=Lm(n,"lean_prompt",e);
  if(r!==void 0)return !r;
  if(Ide(e)||n==="claude-mythos-5")return !1;
  if(n.includes("claude-3-")||n.includes("haiku")||n.includes("sonnet")
     ||n==="claude-opus-4-0"||n==="claude-opus-4-1"||n==="claude-opus-4-5"
     ||n==="claude-opus-4-6"||n==="claude-opus-4-7")return !0;
  return !al()}
```

Note the **inverted return**: `te()` answers "send the full, verbose system
prompt". A model that *has* `lean_prompt` gets the *shorter* prompt. A remote
override exists: `x2(e)=Bq()?n.leanPromptCompiledOnly(e):n.leanPrompt(e)`.

Holders (§5.4): `opus-4-8`, `opus-5`, `opus-5-5`, `fable-5`, `fable-5-1`,
`mythos-5-1`.

The **text** of the two prompts was not extracted `[UNR]`. The semantic reading
of `te()` as "verbose" rests on the inverted return and the model list, not on a
transcribed prompt string. This is an input-token lever in the genuine client;
it is nonetheless out of scope for this package, which does not author system
prompts (§12).

---

## 12. Out of scope for this package

| Mechanism                                               | Why                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `inline_tools` blocks, `message_threads`, compaction     | conversation-state features above the request-builder seam           |
| `clear_at` system messages                               | requires a message-level contract the package does not own           |
| `api_system.outputConfig`                                | same — the package builds one request, not a turn ledger             |
| `lean_prompt` prompt selection                           | the host authors the system prompt                                   |
| The rejection ladder and latch layer                     | requires observing responses; the package is I/O-free (§7.6.2)       |
| `provider_ids`, `aliases`, `fallback_3p`                 | provider routing, not wire model ids                                 |
| Gateway hint headers                                     | opt-in, off by default                                               |
| `context_hint` body field                                | gated behind a remote flag that is off                               |
| The Claude app model list (§9.4)                         | a product surface, not a wire catalogue                              |
| `CLAUDE_CODE_MODEL_CAPABILITIES` and remote capability lookup | the package models the static catalogue, the third layer         |

These are recorded, not ported. Where a consumer needs one, the package's role
is to expose the catalogue evidence (for example `effort_cost_index`) rather
than to implement the behaviour.

---

## 13. The port

This table is the **index** of the port, not its whole text. Four entries
delegate to a subsection that carries the full guard — §13.2 for `betaPolicy`,
§13.3 for `MID_CONV_TOOL_CHANGE`, §13.4 for `PER_MESSAGE_EFFORT` and §13.5 for
`THINKING_BINDING_CONTROLS` — and §13.1 lists the work that must precede the
profile files. Where a guard appears both here and in a subsection, the
subsection is normative; an earlier revision claimed this table was exhaustive
while abbreviating guards, which is the one shape of error that lets a porter
implement a narrower predicate than the client's.

The behaviour rows are not independent. `THINKING_DISPLAY_UPDATES`, the
`thinking.display: "updates"` body field and the `redact_thinking` removal are
one change with three surfaces: the same branch at byte 13604689 pushes the
beta, rewrites the body and splices `vAt` out (§6.4, §7.5). A port that lands
any one of them without the other two writes bytes no genuine client sends.

| Item                                                           | Class     | Action                                                                 |
| -------------------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| Beta registry, 40 ordered entries (§4.1)                        | data      | new `src/profiles/beta-registry-2.1.280.ts`                             |
| `qbr` Bedrock-unsupported set (§4.4)                            | data      | export as `BEDROCK_UNSUPPORTED_BETAS_2_1_280`                           |
| `iNn` count-tokens set (§4.4)                                   | data      | export as `COUNT_TOKENS_BETAS_2_1_280`                                  |
| `Dg` third-party allowlist, 14 members (§4.4)                   | data      | export as `THIRD_PARTY_ALLOWED_BETAS_2_1_280`                           |
| Two non-beta registry members (§4.3)                            | —         | do **not** transcribe                                                   |
| Catalogue, 20 entries (§5.2–§5.4)                               | data      | new `src/profiles/claude-code-2.1.280.ts`                               |
| The three dated identifiers (§9.4)                              | —         | discard                                                                 |
| Ten unmodelled catalogue keys (§5.1)                            | —         | do not model                                                            |
| Scalars: version, build time, git SHA, user agent (§8.1)        | data      | profile fields                                                          |
| `contextHintEnabled: false` (§7.6, §9.2)                        | data      | unchanged from 2.1.233, and now **asserted**, not merely retained: `c()` is `x("tengu_hazel_osprey",!1)`, byte 24833559 |
| `cacheDiagnosisEnabled: true` (§7.6.2)                          | data      | **changed from 2.1.233.** `ppr()=Fg()&&FOe()&&Nn()` is true first-party |
| `betaPolicy`, remaining ten values (§13.2)                      | data      | per-value evidence in §13.2; nothing carried over on faith              |
| `PER_MESSAGE_EFFORT` push site (§7.6.1)                         | behaviour | **new composable key**, between sites 11 and 12. Guard: §13.4 |
| `MID_CONV_TOOL_CHANGE` push site (§7.6.1)                       | behaviour | **new composable key**, immediately after `PER_MESSAGE_EFFORT`, still before site 12. Guard: §13.3 |
| `MID_CONV_SYSTEM_CLEAR_AT` push site (§7.6.1, §9.3)             | behaviour | **new composable key**, immediately after `MID_CONV_TOOL_CHANGE`, still before site 12. Guard: `MID_CONVERSATION_SYSTEM` fired ∧ `experimentalBetasEnabled` ∧ first-party ∧ an interactive query source. Byte 13587696 |
| `THINKING_BINDING_CONTROLS` push site (§7.6.1)                  | behaviour | **new composable key**, between sites 12 and 13. Guard: §13.5 |
| `THINKING_DISPLAY_UPDATES` push site (§7.6.1, §6.4)             | behaviour | **new composable key**, immediately after `THINKING_BINDING_CONTROLS`, still before site 13. Guard: thinking emitted as `adaptive` or `enabled` ∧ `experimentalBetasEnabled` ∧ first-party ∧ caller supplied no `thinking.display`. Byte 13604689 |
| `L7t` secondary `context-1m` push (§7.6)                        | —         | **not** ported, and not a divergence: `L7t` (byte 7018222) needs a remote *string* `kelp_forest_sonnet` that is absent by default, so the push never fires for any model |
| Two new mapped capability strings (§7.6.1)                      | behaviour | extend `deriveCapabilitiesFromCatalogue` from six strings to eight: add `mid_conv_tool_change`, `per_turn_effort` |
| `thinking.display: "updates"` (§6.4)                            | behaviour | **emit** on the pinned first-party path, under the same guard as `THINKING_DISPLAY_UPDATES`. `ThinkingDisplay` gains `"updates"` as a third member — injected by the builder, not offered to callers, since a caller-supplied display suppresses the branch entirely |
| `thinking.block_binding` (§6.3)                                 | —         | do **not** emit; `Rx` is `undefined` unless `CLAUDE_CODE_POLISHED_DEWDROP` or the remote flag `tengu_polished_dewdrop` is set. The *beta* is still emitted (§13.5); only the body field is withheld |
| `"highlights"` as a fourth display value (§6.4)                 | —         | do not add to `ThinkingDisplay`. It *is* caller-reachable upstream (`Vg` passes `r.display==="highlights"` through, and §7.7 carries a server-refusal latch for it), so the reason is scope, not impossibility: this package models no retry, and a value whose only documented handling is a rejection ladder cannot be offered safely |
| `tool_choice` demotion (§6.6)                                   | —         | already correct, no change                                              |
| `redact_thinking` removal (§7.5)                                | behaviour | **changed.** The existing `!thinkingDisplayActive` guard reproduces upstream's *first* removal, which keys off a caller-supplied display. Upstream has a *second* removal keyed off its own `"updates"` injection (byte 13604689), and that is the one that fires on the pinned path. The package must drop `redact-thinking-2026-02-12` from the composed set whenever it injects `display: "updates"` |
| `context_management` first-party override (§7.1)                | —         | pre-existing divergence, recorded, **not** changed in this port         |
| `np` / served-capability path in `wRt` (§13.4)                  | —         | **new divergence, recorded not ported.** `gq` (byte 7846777) can return true for a model the static catalogue does not declare, via the remote client-data cache `nNn` (byte 7207706). A package with no remote read cannot reproduce it, and at defaults that cache is empty, so the emitted header is unaffected |
| `Sw` permissive fallback (§13.3)                                | —         | **new divergence, recorded not ported.** `Sw` (byte 7025785) ends `return mD(sc(e))`, so upstream grants `mid_conversation_system` to any model string it does not recognise. The package derives from the catalogue only, exactly as the 2.1.233 port chose when it catalogued `claude-mythos-5` with an empty capability array |
| Haiku's `isAgenticQuery` re-push (§7.1)                         | —         | **new divergence, recorded not ported.** `kw` entry 1 is `{beta:ert,when:(e)=>!e.canonical.includes("haiku")}` (byte 7027543), and `cQt` re-pushes `ert` when `isAgenticQuery` (byte 13580256, true for `repl_main_thread`, `agent:`, `sdk`, `hook_agent`). For a haiku model the identifier therefore appears *after* the `kw` run in agentic queries and not at all otherwise. The package's site 1 is unconditional and has no `querySource` input, so it cannot reproduce either the presence rule or the position |
| `DEFAULT_PROFILE` switch                                        | behaviour | required (§9.1); isolated one-line commit per the runbook               |

### 13.1 Prerequisites before the profile lands

1. Extend `ComposableBetaRegistry` from seventeen to **twenty-two** keys and add
   the five push sites in the positions given in §7.6.1. Do this **before** the
   registry file, so the new file type-checks against a registry that can hold
   it. The same change must carry the `redact_thinking` removal and the
   `thinking.display: "updates"` body field, because all three are one upstream
   branch (§13's preamble); landing the keys alone produces a header the client
   never sends.
2. Extend `deriveCapabilitiesFromCatalogue` to map `mid_conv_tool_change` and
   `per_turn_effort`. Verify that no 2.1.195 or 2.1.233 catalogue entry carries
   either string, so both existing profiles keep their current derived
   capabilities.
3. Compute the 2.1.280 fingerprint known-answer vectors **independently of this
   package**, per the runbook. The algorithm itself is now transcribed, so
   "unchanged" is a `[BIN]` claim rather than an expectation. `[BIN]` byte
   12542900:

   ```js
   import{createHash as $On}from"crypto";
   var HOn="59cf53e54c78";
   function BOn(e){let n=e.find((s)=>s.type==="user"&&!s.isMeta);if(!n)return"";let r=n.message.content;if(typeof r==="string")return r;if(Array.isArray(r)){let s=r.find((g)=>g.type==="text");if(s&&s.type==="text")return s.text}return""}
   function pSe(e,n){let s=[4,7,20].map((y)=>e[y]||"0").join(""),g=`${HOn}${s}${n}`;return $On("sha256").update(g).digest("hex").slice(0,3)}
   ```

   Salt `59cf53e54c78`, character positions `[4, 7, 20]`, the `|| "0"` fallback
   for a short string, the first non-meta user message's first text block as the
   input, SHA-256, and the first three hex characters — all identical to what
   this package implements. The vectors remain the test; they are no longer the
   only evidence.
4. Run `npm run test:pack` before switching `DEFAULT_PROFILE`, and confirm the
   2.1.195 and 2.1.233 digests are unmoved.
5. Assert the §7.6 literal. Add a test that builds the §7.6 scenario and
   compares the emitted `anthropic-beta` against the **fourteen**-identifier
   string, in order, as a single literal, and assert the emitted
   `thinking` object is `{type:"adaptive",display:"updates"}` in the same test.
   It must fail if any of the five new sites is placed wrongly, if
   `redact-thinking-2026-02-12` survives the removal, or if the display field is
   absent.

   Be precise about what that test proves. It makes the **package** falsifiable
   against **this document's** literal; it does not make the literal falsifiable
   against the genuine client, because no live traffic was captured (§14 item
   5). The literal is a `[DER]` over transcribed code, and the test pins the
   package to it so that a future revision of the derivation cannot drift away
   from the implementation silently. Confirming the literal against real traffic
   remains outstanding work, not something this test discharges.

### 13.2 `betaPolicy`, value by value

The eleven flags are **not** carried over from 2.1.233 on the strength of
resemblance. Each is listed with the 2.1.280 gate that decides it, and where the
gate is `[UNR]` the 2.1.233 value is *retained* rather than *asserted* — the
distinction matters, because retaining a value is a conservative default, while
asserting it is an interpolation the runbook forbids.

| Flag                         | 2.1.280 gate                                                  | Value | Basis   |
| ---------------------------- | ------------------------------------------------------------- | ----- | ------- |
| `oauthAuthenticated`         | `kw` 2: `ft()\|\|iwe()&&!zQt()&&pc()`. §6.4 establishes `pc()` is **false** on an OAuth session, so the second disjunct is false and the beta fires through `ft()` alone. `[BIN]` byte 7334838: `function ft(){if(!Wc())return!1;return SN(rn()?.scopes)}`, with `SN(e)=frn(e)` (byte 7257432) and `Wc` `[UNR]` | true | retained |
| `experimentalBetasEnabled`   | `Fg()=iwe()&&!xoe()` (byte 6622035)                           | true  | `[DER]` |
| `oneMillionContextEnabled`   | `id(e)` (byte 7016187) = `!qM()&&/\[1m\]/i.test(e)`; the flag models `!qM()`, and `[BIN]` byte 7016133 gives `function qM(){return a.CLAUDE_CODE_DISABLE_1M_CONTEXT}`, an env var unset by default | true  | `[BIN]` |
| `interleavedThinkingEnabled` | `kw` 4: `!a.DISABLE_INTERLEAVED_THINKING && interleavedThinking` | true  | `[DER]` |
| `interactive`                | `kw` 5's `!Ce()`; `Ce()` (byte 4364829) = `!launchOptions.isInteractive()` | true  | `[DER]` |
| `thinkingSummariesShown`     | `kw` 5's `!sQt()`; `sQt()` (byte 7020903) = `Ke().showThinkingSummaries??!1` | false | `[DER]` |
| `thinkingTokenCountEnabled`  | `kw` 6 exists and `BR` is non-null (byte 6278332)             | true  | `[DER]` |
| `narrationSummariesEnabled`  | no registry entry; the slot is `hZt=null` (byte 6279537)      | false | `[BIN]` |
| `structuredOutputsEnabled`   | `kw` 8's `x("tengu_tool_pear",!1)`                            | false | `[DER]` |
| `afkModeEnabled`             | requires a non-default permission mode or flag `Tpr` (default false); `Nh`, `ve`, `o_r`, `Sl` are `[UNR]` | false | retained |
| `cacheDiagnosisEnabled`      | `ppr()=Fg()&&FOe()&&Nn()` (§7.6.2)                            | **true** | `[DER]` |

Two notes on `oauthAuthenticated`. It moved from `[DER]` to *retained* in this
revision, not because new evidence weakened it but because an earlier revision
justified it with the wrong conjunct: it claimed the value "rests on `zQt()`
being false rather than on `pc()` being assumed", when `pc()` is a conjunct of
the very disjunct that `zQt()` belongs to. With `pc()` now transcribed as false
(§6.4), that disjunct cannot fire at all, and the whole gate reduces to `ft()`,
whose own gate `Wc` is `[UNR]`. Retaining `true` is nevertheless the
conservative choice rather than a guess, for a reason independent of `ft`: the
SDK appends `oauth-2025-04-20` unconditionally on a token-cache session (§8.3),
so the identifier reaches the wire either way. What `ft()` decides is its
*position* — composed at slot 2 by `kw`, or appended last by the SDK. The
package pins slot 2, which is what 2.1.195 and 2.1.233 also pinned and what the
fixtures for those profiles record. A porter who later resolves `Wc` should
re-check that position rather than the presence.

### 13.3 The `MID_CONV_TOOL_CHANGE` guard, in full

`Tue` (§7.2, byte 7025546) does not reduce to "the catalogue declares
`mid_conv_tool_change`". Its tail is:

```js
let r = Lm(n, "mid_conv_tool_change", e);
if (r !== void 0) return r;
return n === "claude-mythos-5" || fc(Rx(n)) === void 0;
```

and its head, from the same offset, is `if(!Fg()||!kue(e))return!1;`. The `Aw`
entry that calls it adds one more conjunct: `(e)=>oQt()&&Tue(e.model)`, where
`[BIN]` byte 7004809 gives `function oQt(){return fN()}` and `fN` (byte 6916815)
reads remote flag `tengu_foamy_spring`, which defaults **true**.

So the decision is, in order:

0. `oQt()` — remote flag `tengu_foamy_spring`, default true. A deployment that
   turns it off suppresses this beta entirely; the profile models the default.
1. `MID_CONVERSATION_SYSTEM` must have fired for this model (`kue(e)`), and
   `experimentalBetasEnabled` (`Fg()`) must hold. Otherwise false.
2. If the catalogue declares `mid_conv_tool_change`, that value decides —
   including a declared `false`.
3. Otherwise the beta is still sent when the id is `claude-mythos-5`, **or**
   when the model has no catalogue entry at all (`fc(Rx(n)) === void 0`).

Step 3 is the part a naive port drops. It is the same shape as the
`claude-mythos-5` special case already recorded as a divergence in §7.1, and it
means an uncatalogued model is treated permissively rather than denied. Note
that `Rx` here is a model resolver and has nothing to do with the
prefix-mismatch value also called `Rx` in §6.3 — see the collision table in
§1.4.

`kue(e)` is `Hi(n=>n.midConversationSystem, e, ()=>Sw(e))`, and `Sw` is now
transcribed. `[BIN]` byte 7025785:

```js
function Sw(e){
  if(kp("hipaa"))return!1;
  if(a.CLAUDE_CODE_FORCE_MID_CONVERSATION_SYSTEM)return!0;
  let n=Eue(e,"mid_conversation_system");if(n!==void 0)return n;
  let r=Ge(e);
  if(or(r,"claude-opus-4-8"))return!1;
  let s=Lm(r,"mid_conv_system",e);if(s!==void 0)return s;
  if(r==="claude-mythos-5")return!0;
  return mD(sc(e));
}
```

`[DER]` For `claude-opus-5-5` on a default install: not HIPAA, no force env, no
`Eue` override, `or(r,"claude-opus-4-8")` false (the entry is newer), and
`Lm(r,"mid_conv_system",e)` resolves through the catalogue to `true` — the
capability string is present (§5.4). So `Sw` is true, `kue` is true, and `Tue`'s
first line passes. The port takes `MID_CONVERSATION_SYSTEM` firing as its proxy
for `kue`, which is exactly what `Tue`'s first line does, and that proxy is now
justified rather than assumed.

Note the trailing `return mD(sc(e))`: an uncatalogued model reaching that line
gets `mid_conversation_system` on any first-party-class provider. The package
does not reproduce that fallback, for the same reason it does not reproduce
`Tue`'s step 3.

### 13.4 The `PER_MESSAGE_EFFORT` guard, in full

`[BIN]` byte 6917885, the whole module prologue including the two registration
slots the guard reads:

```js
var np=null;function eco(e){np=e}
var rp="tengu_sprightly_lagoon",tl=null;function op(e){tl=e}
function wRt(e,n){
  if(!Fg()||!mD(sc(e)))return!1;
  if(Lm(n,"per_turn_effort",e)===!1)return!1;
  if(_xt(n,"per_turn_effort",e)!==!0&&np?.(n,e)!==!0)return!1;
  return tl?.()!==!0
}
```

Four conjuncts, and the third and fourth need the capability resolver and the
registration slots to be read before they mean anything.

`[BIN]` byte 5960505, the three-layer resolver:

```js
function Lm(e,t,n){return cen(t,e)??_xt(e,t,n)}
function _xt(e,t,n){if(O$().servedCapabilityLookup?.(t,[n,h(e)])===!0&&U(t))return!0;return fwr(e,t)?!0:void 0}
function fwr(e,t){return fc(h(e))?.capabilities.includes(t)}
function cen(e,t){let n=a.CLAUDE_CODE_MODEL_CAPABILITIES;if(n===void 0)return;…}
```

So `_xt` **is** the catalogue read, through `fwr`, with a served-capability
remote layer above it; `Lm` is the `CLAUDE_CODE_MODEL_CAPABILITIES` env override
falling back to `_xt`. `fwr` returns `!0` or `void 0` and never `false`, which is
why the second conjunct's `===!1` can only fire from the env layer.

`[BIN]` byte 7140575, the registration that fills `tl`:

```js
op(()=>x(rp,!1));
```

`tl` is therefore **not** undefined at call time — it is a thunk over remote flag
`tengu_sprightly_lagoon`, whose coded default is `false`. `tl?.()` evaluates to
`false`, and `false !== true` is true, so the fourth conjunct passes. `np` is
filled at byte 7847403 by `eco(Y)` where `Y` checks the model against the current
session model; it is never reached for a catalogue holder, because `_xt` already
returned `!0` and `&&` short-circuits.

`[DER]` For `claude-opus-5-5` first-party: `Fg()` true, `mD(sc(e))` true
(byte 5966698 — `mD` accepts `firstParty`, `anthropicAws`, `anthropicGoogleCloud`,
`foundry`, `mantle`), `Lm(…)===!1` false, `_xt(…)!==!0` false, `tl?.()!==!0`
true. **`wRt` reduces to `Fg() ∧ mD(sc(model)) ∧ catalogue-declares-`per_turn_effort``.**

That is the guard to implement. An earlier revision abbreviated it to
"catalogue `per_turn_effort` ∧ `experimentalBetasEnabled`", silently dropping
`mD(sc(e))` and leaving `tl` unexamined; the conclusion was right and the
reasoning was not.

> **Superseded.** A prior revision argued `tl` was never assigned, on the ground
> that `tl?.()` on an *undeclared* binding throws `ReferenceError` and therefore
> `tl` must be a declared-but-unassigned `var`. The premise about the language is
> correct; the conclusion about this program is not. `op(()=>x(rp,!1))` at byte
> 7140575 assigns it. The emitted header is unchanged, because the flag defaults
> false, but the claim is now `[BIN]` on a flag default instead of `[DER]` on an
> absence.

### 13.5 The `THINKING_BINDING_CONTROLS` guard, in full

`[BIN]` byte 13593798:

```js
let Rx,lv=!1;
try{
  let er=!(r.type==="disabled"&&r.mechanical===!0)&&!a.CLAUDE_CODE_SIMULATE_PROXY_USAGE&&(!X2()||bwt());
  if(er&&Fg()){ if(r.type!=="disabled"){ if(Rx=hCt(),yCt(Rx))tH(ht,lD) } lv=dT(ht,lD) }
  else if(er&&!xoe()){ … bedrock/mantle/vertex branch … }
}catch(er){u(er),Rx=void 0,lv=!1}
if(!lv&&!iwe())Ee=Ee.filter((er)=>er!==lD);
```

with `[BIN]` byte 13510336 `function yCt(e){return e!==void 0||ja()}`, byte
13510163 `hCt()` returning `gCt(env CLAUDE_CODE_POLISHED_DEWDROP ?? remote
tengu_polished_dewdrop)` — `undefined` at defaults — byte 5966778
`function ja(){return Me()==="firstParty"&&ms()}`, and byte 10275122 `bwt()`,
which on a default OAuth install returns true because `t7()` (byte 9707339) and
`_en()` (byte 6652111) both yield nothing and the final test is `r===null`.

`[DER]` At defaults: `X2()` is true on OAuth (§6.4), so `er` reduces to
`bwt()`, which is true; `Fg()` is true; thinking is not disabled; `hCt()` is
`undefined`, and `yCt(undefined)` is therefore `ja()`, which is true. So `lD` is
latched and `lv` is true. **The guard is `thinking active ∧ Fg() ∧ ja() ∧
(¬X2() ∨ bwt())`**, which on the pinned first-party path collapses to *thinking
active ∧ experimental betas ∧ first-party*.

The body field `thinking.block_binding` is a **separate** decision: it needs
`Rx !== void 0` (§6.3), which requires the env var or the remote flag, so the
header ships and the field does not. An earlier revision gave this site's guard
as "thinking active ∧ `experimentalBetasEnabled`", omitting `ja()` and the
`X2()`/`bwt()` disjunction.

---

## 14. Method caveats

1. Every scalar, registry entry and catalogue value here comes from the
   **`win32-x64`** build. Bundles are not byte-identical across platforms
   (platform-tagged constants, build timestamps), so a value must not be mixed
   with another platform's build.
2. Two extractor `unresolved` markers were resolved manually:
   `stainlessPackageVersion` by the declaration/consumption adjacency at bytes
   4407908 and 4408311 (§8.1), and `userAgent` by identifying the sole
   definition among several re-imports (§8.1). The three auxiliary-set markers
   were resolved by call site (§4.4).
3. Identifier resolution across modules is justified per identifier by an
   `import{…}` in the consuming module (§1.4). Thirty-two name collisions were
   encountered and are tabulated there. A reader re-deriving any claim must
   confirm the **offset**, not the name.
4. `[DER]` claims evaluate transcribed code under **default settings**: a fresh
   first-party OAuth install, no `CLAUDE_CODE_*` overrides, remote flags at
   their coded defaults, and an empty session latch set. Every `[DER]` claim in
   §6 and §7.6 states which of those assumptions it depends on. A deployment
   that changes one of them changes the conclusion, and that is a property of
   the client, not an error here.
5. No live traffic was captured. `[BIN]` and `[DER]` claims are static; `[EXT-n]`
   claims are other people's observations, tagged as such.
6. The following identifiers were located but **not** resolved, and each is
   marked `[UNR]` at its point of use: `Pk`, `IDn`, `mlo`, `ton`, `LPr`, `$ee`,
   `xA`, `Wc`, `eh`, `gu`, `Nh`, `o_r`, `Sl`, `Vf`'s flag name, `HPr`'s
   population, and the consumer of the two cache-promotion registry members.

   **Two** of these gate a value in §13, and both dependencies are stated at the
   point of use rather than hidden here. `Nh`/`o_r`/`Sl` gate
   `afk-mode-2026-01-31`, so `afkModeEnabled` in §13.2 is *retained* at `false`
   rather than asserted. `Wc` gates `ft()`, which after §6.4 is the only live
   disjunct of `kw` entry 2, so `oauthAuthenticated` is *retained* at `true`;
   §13.2 records why that retention is conservative rather than a guess, and
   what a later resolution of `Wc` would actually change. Every other §13 value
   rests on a `[BIN]` transcription or on a `[DER]` over one.

   Identifiers that were on this list in earlier revisions and are not any more:
   `c` (context-hint), `qM` (1M context), `Sw` (mid-conversation system),
   `tl`/`np` (per-turn effort), `pc` (§6.4), `Mee` together with `fur` and `uur`
   (§9.3), the tail of `$_` and `KMn` (§13.4's effort predicate), `fN`, `bwt`,
   `hCt`/`gCt`, `mD`, `sc`, and `Y`/`gq`/`nNn`. `ft` itself is now transcribed
   (byte 7334838); only its inner `Wc` remains.

   A note on `ve`: an earlier revision listed it as `[UNR]` in the afk gate,
   while byte 13580256 binds a `ve` that is the `isAgenticQuery` boolean. Those
   are two different bindings, and §1.4 carries the collision. The afk-side `ve`
   is not separately resolved, which is why `afkModeEnabled` stays retained; the
   request-builder-side `ve` is transcribed and used in §7.1.

   An earlier revision claimed `$_`'s unread tail was "deliberately not
   load-bearing" because its head excludes `claude-opus-5-5` from the denial
   list. That was a fallacy: passing a denial list is not returning `true`, and
   the `effort` push needs `$_` to return `true`. The function is now
   transcribed in full (§13.4), and the `true` comes from
   `Lm(r,"effort",e)` reading the catalogue.

7. Identifiers that earlier revisions listed as unresolved are now resolved.
   Two of them inverted a conclusion this document had already published, so
   those are recorded first and in full; the rest follow.

   - `pc`, `m_`, `Tb`, `zQt` — the OAuth side of §6.4, now transcribed rather
     than inferred. `[BIN]` byte 7292489:

     ```js
     function pc(e={}){if(!Hpo())return!1;if(kLn(e))return!1;let n=e.skipApiKeyHelper?void 0:Rvo.of(W().host);if(K_()==="profile-implicit"){let r=rn();if(rAt(r)&&Rxt()){if(n)cM(n);return!1}}if(n)fM(n);return!0}
     function X2(){return b7()===null&&pc()}
     function Ont(){return K_()!=="env-quad"&&zGe()==="user_oauth"&&pc({skipApiKeyHelper:!0})}
     ```

     `[BIN]` byte 7297913, `m_`: every `key` it returns comes from
     `ANTHROPIC_API_KEY` or `apiKeyHelper`, and its no-credential branch returns
     `{key:null,source:"none"}`. `[BIN]` byte 7295683:
     `function Tb(){try{return b7()}catch{return null}}`, so `zQt()=Tb()!=null`
     is "an API key exists" and is false on OAuth.

     Two consequences, and the second **inverts** what an earlier revision
     published. First, `b7()===null` genuinely means "no API key": every `key`
     `m_` returns comes from `ANTHROPIC_API_KEY` or `apiKeyHelper`, so the
     alternative reading — that `m_` might return an OAuth token under `key` —
     is refuted by the transcription.

     Second, `pc()` itself is **false** on a plain OAuth install, by two
     independent routes set out in §6.4. `X2() = b7()===null && pc()` is
     therefore false, `!X2()` holds, the `connector_text` branch fires, and
     `thinking.display: "updates"` is emitted along with
     `thinking-display-updates-2026-08-18` and the removal of
     `redact-thinking-2026-02-12`. The earlier revision concluded the opposite —
     that `X2()` was true and the branch dead — on the strength of `Ont` showing
     `pc()` *reachable* on a `user_oauth` session. Reachability of a call site is
     not the return value of the function, and that inference is withdrawn.

     A still earlier draft supported the same wrong conclusion with a different
     invalid inference, from `kw` entry 2 — invalid because that gate is a
     *disjunction* (`ft()||iwe()&&!zQt()&&pc()`), so the OAuth beta firing never
     entailed `pc()`. It is now clear which disjunct carries it: `ft()` (byte
     7334838). Both inferences are withdrawn, and §13.2's `oauthAuthenticated`
     row is restated on `ft` rather than on `zQt`.

   - `Mee`, and through it `fur` (byte 13520906) and `uur` (byte 13520185) —
     the second **inversion**. The coded default of `tengu_sleepy_snowflake` is
     `"all"`, so `Mee` returns true and
     `mid-conversation-system-clear-at-2026-08-21` is emitted (§9.3). An earlier
     revision read `oRt`'s catch-block fallback `"off"` as the happy-path
     default and listed the identifier as absent.
   - `Nn` (byte 5966201, bound by import, §7.6.2) — changed
     `cacheDiagnosisEnabled` from `false` to `true`.
   - `tl` (byte 6917885 for the declaration, byte 7140575 for the assignment
     `op(()=>x(rp,!1))`) and `np` (byte 6917885, assigned at byte 7847403 by
     `eco(Y)`) — see §13.4. The emitted header is unchanged, but an earlier
     revision reached that conclusion by arguing `tl` was never assigned, which
     is false. It is assigned; the flag it reads defaults false. The
     `PER_MESSAGE_EFFORT` guard is correspondingly restated with all four of
     `wRt`'s conjuncts instead of two.
   - `Sw` (byte 7025785) — removed the `[UNR]` caveat from §13.3 and turned the
     `kue` proxy from an assumption into a derivation.
   - `qM` (byte 7016133) — `oneMillionContextEnabled` moved from `[DER]` over an
     `[UNR]` to `[BIN]`.
   - `c` (byte 24833559, `x("tengu_hazel_osprey",!1)`) — `contextHintEnabled`
     moved from *retained* to *asserted*.
   - `L7t` (byte 7018222) — needs a remote *string* `kelp_forest_sonnet`, absent
     by default, so the secondary `context-1m` push never fires and there is
     nothing to port. An earlier revision left this as an unrecorded divergence.
   - `t7e` / `Yb` (bytes 10064647, 10064748) — located the `advisor-tool`
     push site at byte 13580256 and showed it off by default, closing a registry
     entry that was previously in neither §7.6 table.
   - `nb` — its only consumers are the retry handlers at bytes 13595075–13621656
     (`RHe`, `AHe`, `PHe`, `VK`, `Uce`). It is the header snapshot the rejection
     ladder inspects, never a second wire header, which closes the last step of
     §7.6's ordering argument: `betas: WR(Kl)` is the sole beta output.
   - `qy` (byte 13592595, `Ee.length>0`) — with `hs` unset, `ml` is true, so the
     `betas` key is present at all. An earlier revision asserted the header was
     emitted without showing the gate that emits it.
   - `ft` (byte 7334838, `function ft(){if(!Wc())return!1;return SN(rn()?.scopes)}`,
     with `SN(e)=frn(e)` at byte 7257432) — identified the live disjunct of
     `kw` entry 2 once `pc()` was known false. Its inner `Wc` remains `[UNR]`,
     which is why §13.2's row is *retained* rather than *asserted*.
   - `$_` (byte 7823336, transcribed to its closing brace) and `KMn` (byte
     7015252, `Gr(...e)?.effort_levels?.map(…)`) — closed the one remaining gap
     under `effort-2025-11-24`. `$_` returns true for `claude-opus-5-5` because
     `Lm(r,"effort",e)` reads the catalogue, not because the model escapes the
     denial list. `KMn` also reveals an unmodelled served-catalogue field,
     `effort_levels`, empty at defaults.
   - `Y`, `gq` (byte 7846777) and `nNn` (byte 7207706) — resolved the `np`
     disjunct of `wRt`. `gq` consults the remote client-data cache, which is
     empty at defaults, so `np?.(n,e)` is false for a model the catalogue does
     not declare and §13.4's reduction holds. Recorded as a divergence in §13
     rather than silently dropped.
   - `fN` (byte 6916815) — `tengu_foamy_spring` defaults **true**, including
     when no flag reader is installed, which is what makes `oQt()` true and
     `mid-conversation-tool-changes-2026-07-01` reachable.
   - `bwt` (byte 10275122), with `t7` (byte 9707339) and `_en` (byte 6652111) —
     returns true on a default install, which is what keeps `lv` true once
     `X2()` is false, and so keeps `thinking-binding-controls-2026-08-01` in the
     header (§13.5).
   - `hCt` and `gCt` (byte 13510120) — `gCt("")` falls to `default: return`, so
     `Rx` is `undefined` at defaults and the `thinking.block_binding` body field
     is withheld while its beta is still sent. This is why §13 splits those two
     rows.
   - The `Fr.push(b0e)` call site (byte 13606358) — fixed the last position in
     §7.6's literal. An earlier revision cited byte 13593572 for it, which is
     `nv=dT(ht,b0e)`, a boolean computation that *precedes* the effort push; had
     that been the push, `cache-diagnosis-2026-04-07` would have preceded
     `effort-2025-11-24` on the wire and package site 17 would have been the
     wrong home for it.
