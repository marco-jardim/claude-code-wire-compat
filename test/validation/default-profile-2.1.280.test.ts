// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { DEFAULT_PROFILE } from "../../src/build-request.js";
import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeRequestInput,
} from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
} from "../../src/index.js";

/*
 * Behavioural proof of the `DEFAULT_PROFILE` switch to 2.1.280: a caller who
 * passes no profile must receive exactly the 2.1.280 bytes, and a caller who
 * pins the previous singleton must still receive the 2.1.233 bytes.
 *
 * The input is the section 7.6 `claude-opus-5-5` scenario from
 * `anthropic-beta-2.1.280-default-path.test.ts`, which exercises all five new
 * 2.1.280 push sites and so maximises the byte difference between profiles.
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

/*
 * The 2.1.233 default-path `anthropic-beta` value for INPUT. Captured from the
 * 2.1.233-pinned build (read out of a deliberately failing assertion diff), not
 * derived independently: it is the rollback contract, so what it pins is that
 * the previous singleton's bytes do not move under the default switch.
 */
const PINNED_2_1_233_BETAS: readonly string[] = [
  "claude-code-20250219",
  "oauth-2025-04-20",
  "interleaved-thinking-2025-05-14",
  "redact-thinking-2026-02-12",
  "thinking-token-count-2026-05-13",
  "context-management-2025-06-27",
  "prompt-caching-scope-2026-01-05",
  "mid-conversation-system-2026-04-07",
  "effort-2025-11-24",
];

/** Returns the `anthropic-beta` header value, looked up case-insensitively. */
function betaHeader(built: BuiltClaudeCodeRequest): string {
  const value = built.headers.find(
    ([name]) => name.toLowerCase() === "anthropic-beta",
  )?.[1];
  expect(value).toBeDefined();
  if (value === undefined) throw new Error("anthropic-beta header missing");
  return value;
}

describe("DEFAULT_PROFILE is 2.1.280", () => {
  it("an unpinned request is byte-identical to a request pinned to CLAUDE_CODE_2_1_280_PROFILE", async () => {
    const unpinned = await buildClaudeCodeRequest(INPUT);
    const pinned = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    expect(unpinned.url).toBe(pinned.url);
    expect(unpinned.method).toBe(pinned.method);
    // Serialised as an ordered array: header order is part of the wire bytes.
    expect(JSON.stringify(unpinned.headers)).toBe(
      JSON.stringify(pinned.headers),
    );
    expect(unpinned.body).toBe(pinned.body);
  });

  it("an unpinned request is NOT byte-identical to a request pinned to CLAUDE_CODE_2_1_233_PROFILE", async () => {
    // This test is what makes the previous one non-vacuous: if every profile
    // produced identical bytes, "unpinned equals 2.1.280" would prove nothing.
    const unpinned = await buildClaudeCodeRequest(INPUT);
    const pinned233 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    const unpinnedHeaders = JSON.stringify(unpinned.headers);
    const pinned233Headers = JSON.stringify(pinned233.headers);
    expect(unpinnedHeaders).not.toBe(pinned233Headers);
    // Positive anchor: a 2.1.280-only beta is present unpinned, absent in 2.1.233.
    expect(betaHeader(unpinned)).toContain(
      "thinking-display-updates-2026-08-18",
    );
    expect(betaHeader(pinned233)).not.toContain(
      "thinking-display-updates-2026-08-18",
    );
  });

  it("pinning CLAUDE_CODE_2_1_233_PROFILE still yields the 2.1.233 default-path header", async () => {
    const pinned233 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    expect(betaHeader(pinned233)).toBe(PINNED_2_1_233_BETAS.join(","));
  });

  it("DEFAULT_PROFILE is a member of ACCEPTED_PROFILES by identity", async () => {
    // `ACCEPTED_PROFILES` is module-private in `src/build-request.ts`, so its
    // membership is proven behaviourally: the builder rejects any profile not
    // in that set by identity, so a DEFAULT_PROFILE-pinned build succeeding and
    // matching the unpinned bytes shows the default is an accepted singleton.
    expect(DEFAULT_PROFILE).toBe(CLAUDE_CODE_2_1_280_PROFILE);
    const unpinned = await buildClaudeCodeRequest(INPUT);
    const pinnedDefault = await buildClaudeCodeRequest(INPUT, DEFAULT_PROFILE);
    expect(unpinned.url).toBe(pinnedDefault.url);
    expect(unpinned.method).toBe(pinnedDefault.method);
    expect(JSON.stringify(unpinned.headers)).toBe(
      JSON.stringify(pinnedDefault.headers),
    );
    expect(unpinned.body).toBe(pinnedDefault.body);
  });
});
