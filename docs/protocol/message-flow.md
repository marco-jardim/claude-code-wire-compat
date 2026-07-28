<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

> **Provenance**
>
> - Source repository: <https://github.com/marco-jardim/opencode-anthropic-fix>
> - Source path: `docs/MESSAGE_FLOW_DIAGRAM.md`
> - Source commit: `466d500`
> - License: `GPL-3.0-or-later`
> - Ported verbatim
>
> Scope: this is upstream reverse-engineering research about Claude Code's
> wire behaviour and about the upstream plugin that implements it. The body
> below is reproduced without content edits, so it still refers to OpenCode,
> plugin files, plugin environment variables, and upstream absolute paths;
> those references describe the upstream project, not this package. The
> mapping from these findings to this package's contract is in
> [../source-trace.md](../source-trace.md).

# Message Flow Diagram

This document shows the complete flow of messages through the opencode-anthropic-fix plugin.

---

## High-Level Message Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OpenCode Editor                              │
│              (User types message and presses Enter)                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Plugin Hook: hook.fetch()                         │
│             (index.mjs lines 2299-3200+)                            │
│                                                                       │
│  1. Validate OAuth authentication                                    │
│  2. Select account (sticky/round-robin/hybrid)                       │
│  3. Refresh token if needed                                          │
│  4. Load configuration                                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Request Transformation Phase                            │
│                                                                       │
│  A. Parse request body (JSON)                                        │
│  B. Transform messages array                                         │
│  C. Add headers and system prompt                                    │
│  D. Compute beta flags                                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│            Message Array Transformation                               │
│            (transformRequestBody, lines 5900-6166)                   │
│                                                                       │
│  1. stripSlashCommandMessages()                                      │
│     └─ Remove /anthropic commands and responses                      │
│                                                                       │
│  2. Add mcp_ prefix to tool_use blocks                               │
│     └─ read_file → mcp_read_file                                     │
│                                                                       │
│  3. Guard: Ensure array doesn't end with assistant message           │
│     └─ If last message is assistant with tool_use:                   │
│        Synthesize tool_result responses for each tool_use            │
│     └─ Else if last message is assistant without tool_use:           │
│        Append "Continue." user message                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  HTTP Request to Anthropic API                       │
│             POST https://api.anthropic.com/v1/messages               │
│                      (with ?beta=true)                               │
│                                                                       │
│  Headers:                                                             │
│  ├─ Authorization: Bearer <oauth_token>                              │
│  ├─ anthropic-beta: <computed-beta-flags>                            │
│  ├─ User-Agent: claude-code/2.1.81                                   │
│  └─ Custom Claude Code headers                                       │
│                                                                       │
│  Body: { model, messages: [...], tools: [...] }                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Anthropic API Processes Request                     │
│                                                                       │
│  1. Parse messages                                                   │
│  2. Check tool_use/tool_result pairing                               │
│  3. Execute tools (if any tool_use blocks)                           │
│  4. Generate response (text + potential new tool_use blocks)         │
│  5. Return as Server-Sent Events (SSE) stream                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Response Stream Processing                        │
│              (transformResponse, lines 6381-6500+)                   │
│                                                                       │
│  For each SSE event:                                                 │
│  ├─ Parse JSON payload                                              │
│  ├─ Extract usage tokens (input, output, cache)                     │
│  ├─ Detect mid-stream errors (account-specific vs service-wide)     │
│  ├─ Strip mcp_ prefix from tool_use names (if present)              │
│  └─ Buffer and rewrite complete SSE lines                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SSE Event Processing Details                             │
│           (stripMcpPrefixFromSSE, lines 6309-6367)                   │
│                                                                       │
│  SSE Event Type: content_block_start                                 │
│  ┌──────────────────────────────────────────┐                        │
│  │ Input:  {"content_block":{"type":"tool  │                        │
│  │         _use","name":"mcp_read_file"}}   │                        │
│  │                                          │                        │
│  │ Process: Check if tool_use, strip mcp_  │                        │
│  │                                          │                        │
│  │ Output: {"content_block":{"type":"tool  │                        │
│  │         _use","name":"read_file"}}       │                        │
│  └──────────────────────────────────────────┘                        │
│                                                                       │
│  SSE Event Type: message_start                                       │
│  ┌──────────────────────────────────────────┐                        │
│  │ Input:  {"message":{"content":[{        │                        │
│  │         "type":"tool_use",               │                        │
│  │         "name":"mcp_bash"}]}}            │                        │
│  │                                          │                        │
│  │ Process: Strip mcp_ from all tool_use    │                        │
│  │         blocks in content array          │                        │
│  │                                          │                        │
│  │ Output: {"message":{"content":[{        │                        │
│  │         "type":"tool_use",               │                        │
│  │         "name":"bash"}]}}                │                        │
│  └──────────────────────────────────────────┘                        │
│                                                                       │
│  SSE Event Type: message_delta                                       │
│  ┌──────────────────────────────────────────┐                        │
│  │ Input:  {"type":"message_delta",         │                        │
│  │         "usage":{"input_tokens":100,     │                        │
│  │         "output_tokens":50}}             │                        │
│  │                                          │                        │
│  │ Process: Extract & accumulate tokens     │                        │
│  │                                          │                        │
│  │ Output: (same, not modified)             │                        │
│  └──────────────────────────────────────────┘                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Error Handling Decision Tree                        │
│                                                                       │
│                      Response Status?                                │
│                           │                                          │
│          ┌────────────────┼────────────────┐                         │
│          │                │                │                         │
│          ▼                ▼                ▼                         │
│        200              429/401/403        529/503                   │
│       (Success)        (Account Error)    (Service Error)            │
│          │                │                │                         │
│          │                │                │                         │
│    Return response  Mark account as   Exponential backoff            │
│    to client        failed, try next  (retry up to 2x)               │
│                     available account │                         │
│                                        ▼                         │
│                                   Max retries?                   │
│                                        │                         │
│                         ┌──────────────┼──────────────┐          │
│                         │              │              │          │
│                    No (retry)   Yes (return error)    │          │
│                         │              │              │          │
│                    Try next      Return error to   │          │
│                    account        client            │          │
│                                                     ▼         │
│                                              OpenCode shows    │
│                                              error toast       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Message Transformation Flow

```
INCOMING REQUEST BODY
│
├─ Raw: { model: "claude-3-5-sonnet", messages: [...], tools: [...] }
│
▼ transformRequestBody()
├─ Parse JSON
│
▼ stripSlashCommandMessages()
├─ Filter out /anthropic commands
├─ Filter out ▣ Anthropic responses
│
▼ Message by message
├─ For each message:
│  ├─ If role === "user":
│  │  ├─ Keep as-is (check for slash commands)
│  │
│  └─ If role === "assistant":
│     ├─ For each content block:
│     │  ├─ If type === "text":
│     │  │  └─ Keep as-is
│     │  │
│     │  ├─ If type === "tool_use":
│     │  │  └─ Add mcp_ prefix to name
│     │  │
│     │  └─ If type === "tool_result":
│     │     └─ Keep as-is (no prefix for results)
│
▼ Post-processing guard
├─ Check: Does array end with assistant message?
│  │
│  ├─ YES:
│  │  ├─ Check: Does it have tool_use blocks?
│  │  │
│  │  ├─ YES → Synthesize tool_result for each tool_use
│  │  │  └─ Push new user message with tool_results
│  │  │
│  │  └─ NO → Append "Continue." user message
│  │
│  └─ NO:
│     └─ No changes needed (array ends with user message)
│
▼ Return: JSON.stringify(transformed_messages)

TRANSFORMED REQUEST BODY
│
└─ Ready for Anthropic API
```

---

## Response Stream Processing Flow

```
RAW SSE STREAM FROM API
│
│ data: {"type":"content_block_start","content_block":{"type":"tool_use","name":"mcp_read_file"}}
│
│ data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
│
│ data: {"type":"message_start","message":{"content":[{"type":"tool_use","name":"mcp_bash"}]}}
│
│ data: {"type":"message_delta","usage":{"input_tokens":100,"output_tokens":50}}
│
│ data: {"type":"message_stop"}
│
▼

transformResponse() wraps reader.read()
│
├─ For each chunk:
│
├─ stripMcpPrefixFromSSE(chunk)
│  │
│  └─ regex replace: /^data:\s*(.+)$/gm
│     │
│     ├─ Parse JSON
│     │
│     ├─ stripMcpPrefixFromParsedEvent(parsed)
│     │  │
│     │  ├─ If content_block.type === "tool_use":
│     │  │  └─ Remove "mcp_" from name
│     │  │
│     │  ├─ If message.content contains tool_use:
│     │  │  └─ Remove "mcp_" from each tool_use.name
│     │  │
│     │  └─ If top-level content array:
│     │     └─ Remove "mcp_" from tool_use blocks
│     │
│     ├─ Re-stringify if modified
│     │
│     └─ Return modified data: line
│
├─ extractUsageFromSSEEvent(parsed, stats)
│  │
│  ├─ If type === "message_delta":
│  │  ├─ Extract input_tokens
│  │  ├─ Extract output_tokens
│  │  ├─ Extract cache_read_input_tokens
│  │  └─ Extract cache_creation_input_tokens
│  │
│  └─ Accumulate in stats object
│
├─ getMidStreamAccountError(parsed)
│  │
│  ├─ Check if parsed.error exists
│  │
│  ├─ Determine if account-specific (401, 403, 429) or service-wide
│  │
│  └─ Call onAccountError callback if account-specific
│
└─ Return transformed chunk to client

TRANSFORMED SSE STREAM
│
│ data: {"type":"content_block_start","content_block":{"type":"tool_use","name":"read_file"}}
│
│ data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
│
│ data: {"type":"message_start","message":{"content":[{"type":"tool_use","name":"bash"}]}}
│
│ data: {"type":"message_delta","usage":{"input_tokens":100,"output_tokens":50}}
│
│ data: {"type":"message_stop"}
│
└─ Passed to client (OpenCode editor)
```

---

## Account Selection & Retry Flow

```
FETCH INTERCEPTOR CALLED
│
│ async fetch(input, init)
│
▼
Account Selection
│
├─ pinnedAccount?
│  ├─ Check OPENCODE_ANTHROPIC_INITIAL_ACCOUNT env var
│  ├─ Check file_id to account mapping (auto-pinning)
│  └─ Set pinnedAccount if found
│
├─ classifyApiRequest()
│  └─ Determine if "background" or "foreground" request
│
├─ Set retry budgets based on class:
│  ├─ foreground: max 2 service retries, max 3 should-retries
│  └─ background: max 0 service retries, max 1 should-retry
│
▼
RETRY LOOP: for (let attempt = 0; attempt < maxAttempts; attempt++)
│
├─ (attempt === 0 and pinnedAccount exists?)
│  └─ Use pinnedAccount
│  else
│  └─ selectAccount() → returns next account based on strategy
│
├─ Skip if account marked failed in this request
│  └─ (prevent retry loop on same account)
│
▼
TOKEN REFRESH
│
├─ Is token expired?
│  │
│  ├─ YES:
│  │  ├─ acquireRefreshLock()
│  │  ├─ Call refreshToken(account)
│  │  │  │
│  │  │  ├─ Success?
│  │  │  │  ├─ Store new token
│  │  │  │  └─ Continue to API call
│  │  │  │
│  │  │  └─ Failure?
│  │  │     ├─ Check error type
│  │  │     ├─ If terminal (invalid_grant):
│  │  │     │  └─ Disable account, mark as failed
│  │  │     └─ If rate limit:
│  │  │        └─ Mark health penalty, continue
│  │  │
│  │  └─ releaseRefreshLock()
│  │
│  └─ NO:
│     └─ Use existing token
│
▼
TRANSFORM & SEND REQUEST
│
├─ transformRequestBody()
│  │
│  └─ Apply all message transformations (see previous diagram)
│
├─ Compute beta header
│
├─ Add signature headers
│
├─ fetch(requestInput, requestInit) → to Anthropic API
│
▼
HANDLE RESPONSE
│
├─ Check HTTP status
│
├─ 200 OK?
│  │
│  ├─ YES:
│  │  ├─ transformResponse() → process SSE stream
│  │  ├─ Mark account as healthy
│  │  ├─ Return response to client
│  │  └─ BREAK retry loop (success)
│  │
│  └─ NO → Check error type
│
├─ 401/403/429 (Account-specific)?
│  │
│  ├─ YES:
│  │  ├─ Mark account as failed
│  │  ├─ Disable account if terminal
│  │  ├─ CONTINUE to next iteration (try next account)
│  │  └─ Note: attempt-- so we don't waste account slot
│  │
│  └─ NO → Check next error type
│
├─ 529/503 (Service-wide)?
│  │
│  ├─ serviceWideRetryCount < maxServiceRetries?
│  │  │
│  │  ├─ YES:
│  │  │  ├─ Increment serviceWideRetryCount
│  │  │  ├─ Calculate exponential backoff
│  │  │  ├─ setTimeout(retry, backoffMs)
│  │  │  └─ CONTINUE to retry
│  │  │
│  │  └─ NO:
│  │     ├─ Return error to client
│  │     └─ BREAK retry loop (all retries exhausted)
│  │
│  └─ Other error?
│     ├─ Return error to client
│     └─ BREAK retry loop
│
└─ END fetch()
```

---

## Tool Use Pairing Protocol

```
CLIENT SENDS
│
├─ Message 1 (user): "Read /etc/passwd"
│
├─ Message 2 (assistant):
│  └─ content: [
│     {
│       type: "tool_use",
│       id: "tu_123",
│       name: "read_file",      ◄── Will become "mcp_read_file"
│       input: { path: "/etc/passwd" }
│     }
│  ]
│
▼ transformRequestBody()
│
├─ Add mcp_ prefix: name = "mcp_read_file"
│
▼ API Response
│
├─ Message 2 echoed back with tool_use
│
▼ Guard: Message ends with assistant + tool_use?
│
├─ YES → Synthesize tool_result
│  │
│  └─ Message 3 (user):
│     └─ content: [
│        {
│          type: "tool_result",
│          tool_use_id: "tu_123",
│          content: "[Result unavailable...]"
│        }
│     ]
│
└─ Array is now valid: user → assistant → user
```

---

## Error Recovery: Overflow & Trimming

```
OVERFLOW ERROR RECEIVED
│
│ { "error": { "type": "invalid_request_error",
│              "message": "prompt_too_long: ..." } }
│
▼ Parse error
│
├─ Extract max_tokens from error if provided
│
▼ Retry with recovery
│
├─ recoveryBody.max_tokens = Math.ceil(safeMaxTokens)
│
├─ IF max_tokens reduction didn't help:
│  │
│  └─ Trim message array:
│     │
│     ├─ Keep messages[0:2]  ← first 2 (context)
│     │
│     ├─ Insert marker message:
│     │  └─ "Earlier conversation was trimmed..."
│     │
│     ├─ Keep messages[-2:]  ← last 2 (recent work)
│     │  │
│     │  └─ If last message is assistant with tool_use:
│     │     └─ Synthesize tool_result messages for each tool_use
│     │
│     └─ Set messages = trimmed
│
├─ Mark request as trimmed
│
├─ Decrement attempt (preserve account slot)
│
└─ CONTINUE to retry with trimmed history
```

---

## Summary of Key Transformations

| Stage     | Location          | Transformation                          |
| --------- | ----------------- | --------------------------------------- |
| **In**    | Request body      | Strip `/anthropic` commands             |
| **In**    | Request body      | Add `mcp_` prefix to tool_use names     |
| **In**    | Request body      | Synthesize missing tool_result blocks   |
| **In**    | Request body      | Add system prompt & signature headers   |
| **Out**   | SSE stream        | Strip `mcp_` prefix from tool_use names |
| **Out**   | SSE stream        | Extract token usage stats               |
| **Out**   | SSE stream        | Detect mid-stream account errors        |
| **Retry** | Overflow handling | Reduce `max_tokens` or trim messages    |
| **Retry** | Account errors    | Mark account, try next account          |
| **Retry** | Service errors    | Exponential backoff (max 2x)            |
