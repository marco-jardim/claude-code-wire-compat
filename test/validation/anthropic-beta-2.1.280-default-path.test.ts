// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeRequestInput,
} from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_280_PROFILE,
} from "../../src/index.js";

/*
 * The genuine 2.1.280 client's default-path `anthropic-beta` header for
 * `claude-opus-5-5`, pinned as one literal.
 *
 * Every expectation in this file is transcribed from an independent source,
 * never from the builder's output: a value read off the code under test would
 * prove only that the code equals itself.
 */

/*
 * Source: `docs/protocol/versions/claude-code-2.1.280-analysis.md`, section
 * 7.6 ("The genuine client's default-path `anthropic-beta`, as one ordered
 * literal"), the fenced block preceding "Fourteen identifiers". Transcribed
 * character by character, in the document's order.
 */
const DEFAULT_PATH_BETAS: readonly string[] = [
  "claude-code-20250219",
  "oauth-2025-04-20",
  "interleaved-thinking-2025-05-14",
  "thinking-token-count-2026-05-13",
  "context-management-2025-06-27",
  "prompt-caching-scope-2026-01-05",
  "mid-conversation-system-2026-04-07",
  "per-turn-control-2026-07-01",
  "mid-conversation-tool-changes-2026-07-01",
  "mid-conversation-system-clear-at-2026-08-21",
  "effort-2025-11-24",
  "thinking-binding-controls-2026-08-01",
  "thinking-display-updates-2026-08-18",
  "cache-diagnosis-2026-04-07",
];

/*
 * Source: the recorded `anthropic-beta` value in
 * `test/fixtures/golden/outgoing-foreground.json`, which joins identifiers
 * with a bare comma and no space. The analysis document lists the identifiers
 * one per line (`betas: WR(Kl)` is an array) and does not state the join.
 */
const SEPARATOR = ",";

const EXPECTED_HEADER = DEFAULT_PATH_BETAS.join(SEPARATOR);

/*
 * The section 7.6 scenario: model `claude-opus-5-5`, adaptive thinking with no
 * caller-supplied `display`, no `speed`, no `additionalBetas` or
 * `suppressBetas`, cache TTL at its default. Everything else takes the
 * profile's shipped defaults; the exported singleton is passed unmodified.
 */
const INPUT: ClaudeCodeRequestInput = {
  accessToken: "default-path-token",
  model: "claude-opus-5-5",
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello wire compat" }],
  runtime: {
    sessionId: "11111111-1111-4111-8111-111111111111",
    deviceId: "22222222-2222-4222-8222-222222222222",
    accountUuid: "33333333-3333-4333-8333-333333333333",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "default-path-request-1",
  thinking: { type: "adaptive" },
};

const build = (): Promise<BuiltClaudeCodeRequest> =>
  buildClaudeCodeRequest(INPUT, CLAUDE_CODE_2_1_280_PROFILE);

/** Returns the header value, failing loudly if the header is absent. */
function betaHeader(built: BuiltClaudeCodeRequest): string {
  const entries = built.headers.filter(
    ([name]) => name.toLowerCase() === "anthropic-beta",
  );
  expect({ anthropicBetaEntries: entries.length }).toEqual({
    anthropicBetaEntries: 1,
  });
  const [entry] = entries;
  if (entry === undefined) throw new Error("anthropic-beta header missing");
  return entry[1];
}

describe("2.1.280 claude-opus-5-5 default path", () => {
  it("emits the fourteen-identifier anthropic-beta literal", async () => {
    const value = betaHeader(await build());
    expect(value.split(SEPARATOR)).toHaveLength(14);
    expect(value.split(SEPARATOR)).toEqual(DEFAULT_PATH_BETAS);
    expect(value).toBe(EXPECTED_HEADER);
  });

  it("carries thinking type then display in that key order", async () => {
    // Asserted on the serialised string, not a parsed object: `toEqual` on a
    // parsed object cannot see key order, and key order is what is at stake.
    // The body is plain `JSON.stringify` output, so there are no spaces.
    const { body } = await build();
    expect(body).toContain(
      '"thinking":{"type":"adaptive","display":"updates"}',
    );
  });

  it("does not carry redact-thinking anywhere in the header", async () => {
    // `redact-thinking-2026-02-12` IS composed earlier in the sequence and then
    // spliced out again by the site that injects `display: "updates"`
    // (analysis section 7.5), so its absence is a real behavioural outcome,
    // not a gate that never fired.
    const value = betaHeader(await build());
    expect(value).not.toContain("redact-thinking-2026-02-12");
  });

  it("does not carry the one-million-context beta", async () => {
    // `claude-opus-5-5` is natively a 1M-context model, so the beta that opts a
    // smaller model into the larger window is not requested. The existing
    // long-context push site in `src/betas.ts` is gated only on the profile
    // policy and on `use1MContextOverride ?? /\[1m\]/i.test(rawModel)`; the
    // model string carries no `[1m]` marker, so the site is silent. That is the
    // site's ordinary behaviour, not a branch added for this model.
    const value = betaHeader(await build());
    expect(value).not.toContain("context-1m-2025-08-07");
  });
});
