// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

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
 * `normalizeModelId` in `src/model-identity.ts` is a single ladder shared by
 * every profile. There is no per-profile dispatch in it, and
 * `test/governance/version-dispatch.test.ts` would fail the build if one were
 * added anywhere outside `src/profile-behaviors.ts`.
 *
 * The 2.1.280 port added five rungs to that ladder: `claude-fable-5-1`,
 * `claude-mythos-5-1`, `claude-opus-5-5`, `claude-opus-5` and
 * `claude-sonnet-5`. Because the ladder is shared, two of those rungs change
 * what an OLDER pinned profile resolves for ids that profile's own catalogue
 * never listed. The packed-consumer canary cannot see that: its probe model is
 * `claude-sonnet-4-5`, which no new rung touches.
 *
 * This file makes the affected behaviour observable so that it cannot drift
 * silently. It pins the current output; it does not claim that output matches
 * any genuine client (see the comments on each assertion).
 */

const runtime: ClaudeCodeRequestInput["runtime"] = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  deviceId: "22222222-2222-4222-8222-222222222222",
  accountUuid: "33333333-3333-4333-8333-333333333333",
  runtime: "node",
  runtimeVersion: "22.0.0",
  os: "Linux",
  arch: "x64",
};

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

describe("shared model-id normalizer ladder", () => {
  it("pins what claude-mythos-5-1 resolves to under the previous pin", async () => {
    const built = await buildClaudeCodeRequest(
      {
        accessToken: "shared-ladder-token",
        model: "claude-mythos-5-1",
        maxTokens: 1024,
        messages: [{ role: "user", content: "hello wire compat" }],
        runtime,
        clientRequestId: "shared-ladder-request-1",
        thinking: { type: "enabled" },
      },
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    const body = JSON.parse(built.body) as { thinking?: unknown };

    // The normalizer ladder is shared by every profile. Before the 2.1.280
    // port, `claude-mythos-5-1` collapsed onto `claude-mythos-5` and inherited
    // that model's deliberate empty-capability catalogue row; it now keeps its
    // own id. Whether this or the old behaviour matches the genuine 2.1.233
    // client cannot be settled without that release's binary: neither older
    // analysis document transcribes its normalizer. These values pin current
    // behaviour so a change is observable; they are not a conformance claim.
    expect(betaHeader(built)).toBe(
      "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,redact-thinking-2026-02-12,thinking-token-count-2026-05-13,context-management-2025-06-27,prompt-caching-scope-2026-01-05,mid-conversation-system-2026-04-07,effort-2025-11-24",
    );
    expect(body.thinking).toEqual({ type: "adaptive" });
  });

  it("does not re-push the claude-code identifier for a haiku model", async () => {
    const built = await buildClaudeCodeRequest(
      {
        accessToken: "shared-ladder-token",
        model: "claude-haiku-4-5",
        maxTokens: 1024,
        messages: [{ role: "user", content: "hello wire compat" }],
        runtime,
        clientRequestId: "shared-ladder-request-2",
      },
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const value = betaHeader(built);

    // `docs/protocol/versions/claude-code-2.1.280-analysis.md` records that the
    // genuine client re-pushes `claude-code-20250219` for haiku models on the
    // REPL main thread. This package deliberately does not model that re-push
    // (see `docs/source-trace.md`), so this test pins a known, recorded
    // divergence, not a desired behaviour.
    expect(value).not.toContain("claude-code-20250219");
    // Positive anchor: the negative assertion above cannot pass on an empty
    // header.
    expect(value).toContain("oauth-2025-04-20");
  });
});
