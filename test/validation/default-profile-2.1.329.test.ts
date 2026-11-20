// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { DEFAULT_PROFILE } from "../../src/build-request.js";
import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeRequestInput,
} from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  ClaudeCodeWireError,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

/*
 * Behavioural proof of the `DEFAULT_PROFILE` switch to 2.1.329: a caller who
 * passes no profile must receive exactly the 2.1.329 bytes, and a caller who
 * pins the previous singleton must still receive the 2.1.280 bytes.
 *
 * The input is a `claude-opus-5-5` adaptive-thinking request. It exercises the
 * behaviours that separate the two profiles (header layout, beta composition,
 * body keys), so it maximises the byte difference between them.
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

/** Returns a header value, looked up case-insensitively. */
function headerValue(
  built: BuiltClaudeCodeRequest,
  name: string,
): string | undefined {
  return built.headers.find(([key]) => key.toLowerCase() === name)?.[1];
}

describe("DEFAULT_PROFILE is 2.1.329", () => {
  it("an unpinned request is byte-identical to a request pinned to CLAUDE_CODE_2_1_329_PROFILE", async () => {
    const unpinned = await buildClaudeCodeRequest(INPUT);
    const pinned = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    expect(unpinned.url).toBe(pinned.url);
    expect(unpinned.method).toBe(pinned.method);
    // Serialised as an ordered array: header order is part of the wire bytes.
    expect(JSON.stringify(unpinned.headers)).toBe(
      JSON.stringify(pinned.headers),
    );
    expect(unpinned.body).toBe(pinned.body);
    expect(unpinned.evidence).toEqual(pinned.evidence);
  });

  it("an unpinned request is NOT byte-identical to a request pinned to CLAUDE_CODE_2_1_280_PROFILE", async () => {
    // This is what makes the previous test non-vacuous: if every profile
    // produced identical bytes, "unpinned equals 2.1.329" would prove nothing.
    const unpinned = await buildClaudeCodeRequest(INPUT);
    const pinned280 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    expect(JSON.stringify(unpinned.headers)).not.toBe(
      JSON.stringify(pinned280.headers),
    );
    expect(unpinned.body).not.toBe(pinned280.body);
    // Positive anchors: 2.1.329-only properties unpinned, absent when pinned
    // to 2.1.280.
    expect(headerValue(unpinned, "user-agent")).toBe(
      "claude-cli/2.1.329 (external, cli)",
    );
    expect(headerValue(unpinned, "x-claude-code-sandy-plover")).toBe("[]");
    expect(headerValue(pinned280, "x-claude-code-sandy-plover")).toBe(
      undefined,
    );
    expect(unpinned.body).toContain("cc_version=2.1.329.");
    expect(pinned280.body).toContain("cc_version=2.1.280.");
  });

  it("pinning CLAUDE_CODE_2_1_280_PROFILE still yields the 2.1.280 bytes", async () => {
    // The rollback instruction for consumers. The byte-exact 2.1.280 request is
    // pinned elsewhere, by the sealed 2.1.280 golden fixtures and the frozen
    // 2.1.280 packed-consumer digest; this asserts the discriminating
    // properties that separate a 2.1.280 request from a 2.1.329 one.
    const pinned280 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    expect(pinned280.evidence.profileId).toBe(CLAUDE_CODE_2_1_280_PROFILE.id);
    expect(headerValue(pinned280, "user-agent")).toBe(
      "claude-cli/2.1.280 (external, cli)",
    );
    expect(headerValue(pinned280, "anthropic-beta")).toContain(
      "mid-conversation-system-2026-04-07",
    );
    const names = pinned280.headers.map(([name]) => name);
    expect(names).toContain("user-agent");
    expect(names).not.toContain("User-Agent");
    expect(JSON.parse(pinned280.body)).not.toHaveProperty("diagnostics");
  });

  /*
   * The parse half of the default switch. `parseBuiltClaudeCodeRequest`
   * recomputes the expected headers under the profile it is given, and that
   * profile defaults to DEFAULT_PROFILE. So a request built under the previous
   * default and persisted is REJECTED by an unpinned parse after the upgrade.
   * The remedy for a consumer holding persisted requests is to pass the
   * previous singleton explicitly on `parse` as well as on `build`.
   */
  it("an unpinned parse rejects a request built with CLAUDE_CODE_2_1_280_PROFILE", async () => {
    const built280 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    expect(() => parseBuiltClaudeCodeRequest(built280)).toThrow(
      ClaudeCodeWireError,
    );
    expect(() => parseBuiltClaudeCodeRequest(built280)).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("a parse pinned to CLAUDE_CODE_2_1_280_PROFILE round-trips a 2.1.280 request", async () => {
    // The other half of the rollback contract, and what makes the rejection
    // above meaningful rather than a claim that parsing is simply broken.
    const built280 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const parsed = parseBuiltClaudeCodeRequest(
      built280,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    expect(parsed.url).toBe(built280.url);
    expect(parsed.method).toBe(built280.method);
    expect(JSON.stringify(parsed.headers)).toBe(
      JSON.stringify(built280.headers),
    );
    expect(parsed.body).toBe(built280.body);
  });

  it("an unpinned parse round-trips an unpinned request", async () => {
    const built = await buildClaudeCodeRequest(INPUT);
    const parsed = parseBuiltClaudeCodeRequest(built);
    expect(JSON.stringify(parsed.headers)).toBe(JSON.stringify(built.headers));
    expect(parsed.body).toBe(built.body);
  });

  it("DEFAULT_PROFILE is a member of ACCEPTED_PROFILES by identity", async () => {
    // `ACCEPTED_PROFILES` is module-private in `src/build-request.ts`, so its
    // membership is proven behaviourally: the builder rejects any profile not
    // in that set by identity, so a DEFAULT_PROFILE-pinned build succeeding and
    // matching the unpinned bytes shows the default is an accepted singleton.
    expect(DEFAULT_PROFILE).toBe(CLAUDE_CODE_2_1_329_PROFILE);
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
