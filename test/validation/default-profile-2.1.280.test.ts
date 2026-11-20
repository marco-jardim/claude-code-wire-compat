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
  ClaudeCodeWireError,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

/*
 * Behavioural proof of the rollback to 2.1.280. 2.1.280 was the default
 * profile before the switch to 2.1.329, so a consumer who upgrades and wants
 * the previous bytes pins `CLAUDE_CODE_2_1_280_PROFILE`; a consumer who is
 * still on 2.1.233 pins that singleton instead.
 *
 * Every case names its profile. None of them says anything about what an
 * unpinned caller receives: that is `default-profile-2.1.329.test.ts`, and the
 * identity pin on the default seam is in `registration-2.1.329.test.ts`. These
 * tests therefore hold whichever profile the default seam points at.
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

/** Returns a header value, looked up case-insensitively. */
function headerValue(
  built: BuiltClaudeCodeRequest,
  name: string,
): string | undefined {
  return built.headers.find(([key]) => key.toLowerCase() === name)?.[1];
}

/** Returns the `anthropic-beta` header value. */
function betaHeader(built: BuiltClaudeCodeRequest): string {
  const value = headerValue(built, "anthropic-beta");
  expect(value).toBeDefined();
  if (value === undefined) throw new Error("anthropic-beta header missing");
  return value;
}

describe("rollback to CLAUDE_CODE_2_1_280_PROFILE", () => {
  it("a pinned 2.1.280 request carries the 2.1.280 identity", async () => {
    const pinned = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_280_PROFILE,
    );

    expect(headerValue(pinned, "user-agent")).toBe(
      "claude-cli/2.1.280 (external, cli)",
    );
    expect(headerValue(pinned, "x-stainless-package-version")).toBe("0.112.1");
    expect(pinned.evidence.profileId).toBe(CLAUDE_CODE_2_1_280_PROFILE.id);
    expect(pinned.body).toContain("cc_version=2.1.280.");
  });

  it("a pinned 2.1.280 request keeps the 2.1.280 composition and header layout", async () => {
    const pinned = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const header = betaHeader(pinned);

    // Discriminating properties of 2.1.280 against 2.1.329: the retired
    // mid-conversation-system header is still composed, and the
    // thinking-token-count beta sits before the per-request table.
    expect(header).toContain("mid-conversation-system-2026-04-07");
    expect(header.indexOf("thinking-token-count-2026-05-13")).toBeLessThan(
      header.indexOf("context-management-2025-06-27"),
    );
    // The legacy layout: lowercase names, no `Accept`, no request-class
    // headers, no sandy-plover.
    const names = pinned.headers.map(([name]) => name);
    expect(names).toContain("user-agent");
    expect(names).not.toContain("Accept");
    expect(names).not.toContain("x-claude-code-sandy-plover");
    expect(JSON.parse(pinned.body)).not.toHaveProperty("diagnostics");
  });

  it("a request pinned to CLAUDE_CODE_2_1_280_PROFILE is NOT byte-identical to one pinned to CLAUDE_CODE_2_1_233_PROFILE", async () => {
    // This is what makes the rollback meaningful: if every profile produced
    // identical bytes, pinning one would prove nothing.
    const pinned280 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const pinned233 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    expect(JSON.stringify(pinned280.headers)).not.toBe(
      JSON.stringify(pinned233.headers),
    );
    // Positive anchor: a 2.1.280-only beta is present pinned to 2.1.280 and
    // absent pinned to 2.1.233.
    expect(betaHeader(pinned280)).toContain(
      "thinking-display-updates-2026-08-18",
    );
    expect(betaHeader(pinned233)).not.toContain(
      "thinking-display-updates-2026-08-18",
    );
  });

  it("pinning CLAUDE_CODE_2_1_233_PROFILE still yields the 2.1.233 default-path header", async () => {
    // The byte-exact 2.1.233 request is pinned elsewhere: by the sealed golden
    // fixture `outgoing-canary-context-hint-off-2.1.233.json` and by the frozen
    // 2.1.233 packed-consumer digest. The ordered beta list already has three
    // other copies in the suite, so this test deliberately asserts only the
    // rollback's DISCRIMINATING properties -- what separates a 2.1.233
    // composition from a 2.1.280 one -- instead of restating that list.
    const only280Betas: readonly string[] = [
      "per-turn-control-2026-07-01",
      "mid-conversation-tool-changes-2026-07-01",
      "mid-conversation-system-clear-at-2026-08-21",
      "thinking-binding-controls-2026-08-01",
      "thinking-display-updates-2026-08-18",
    ];
    const pinned233 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    const header = betaHeader(pinned233);
    // 2.1.280 composes `redact-thinking` and then splices it out, so its
    // presence is positive evidence the 2.1.233 composition produced this.
    expect(header).toContain("redact-thinking-2026-02-12");
    for (const beta of only280Betas) {
      expect(header).not.toContain(beta);
    }
    const body: unknown = JSON.parse(pinned233.body);
    expect(body).toHaveProperty("thinking");
    expect(body).toHaveProperty("thinking.type");
    expect(body).not.toHaveProperty("thinking.display");
  });

  /*
   * The parse half of the rollback. `parseBuiltClaudeCodeRequest` recomputes
   * the expected headers under the profile it is given, so a consumer who pins
   * a profile on `build` must pin the same profile on `parse`. A request built
   * under one profile is rejected by a parse under another.
   */
  it("a parse pinned to CLAUDE_CODE_2_1_280_PROFILE round-trips a 2.1.280 request", async () => {
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

  it("a parse pinned to CLAUDE_CODE_2_1_233_PROFILE rejects a 2.1.280 request", async () => {
    const built280 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    expect(() =>
      parseBuiltClaudeCodeRequest(built280, CLAUDE_CODE_2_1_233_PROFILE),
    ).toThrow(ClaudeCodeWireError);
    expect(() =>
      parseBuiltClaudeCodeRequest(built280, CLAUDE_CODE_2_1_233_PROFILE),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("a parse pinned to CLAUDE_CODE_2_1_233_PROFILE round-trips a 2.1.233 request", async () => {
    // The other half of the contract, and what makes the rejection above
    // meaningful rather than a claim that parsing is simply broken.
    const built233 = await buildClaudeCodeRequest(
      INPUT,
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    const parsed = parseBuiltClaudeCodeRequest(
      built233,
      CLAUDE_CODE_2_1_233_PROFILE,
    );
    expect(parsed.url).toBe(built233.url);
    expect(parsed.method).toBe(built233.method);
    expect(JSON.stringify(parsed.headers)).toBe(
      JSON.stringify(built233.headers),
    );
    expect(parsed.body).toBe(built233.body);
  });
});
