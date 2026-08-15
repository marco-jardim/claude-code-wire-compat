// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { DEFAULT_PROFILE } from "../../src/build-request.js";
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

/*
 * The profile argument is accepted by REFERENCE, never by shape. Every wire
 * guarantee this package makes -- sealed golden fixtures, packed consumer
 * digests -- is a statement about the exact frozen singleton, so an object
 * that merely looks like it must be refused.
 *
 * Fase 1.3 replaced the `profile !== CLAUDE_CODE_2_1_195_PROFILE` literal with
 * a module-level registry. This file pins the observable contract of that
 * change: which values are accepted, and the EXACT error code and message for
 * the ones that are not. A registry that accidentally grows a structural
 * fallback, or an error whose code changes, fails here.
 */

const BASE = {
  accessToken: "sentinel-token-profile-acceptance-4c71",
  model: "claude-opus-4-6",
  maxTokens: 1024,
  messages: [{ role: "user", content: "hi" }],
  runtime: {
    sessionId: "00000000-0000-4000-8000-000000000001",
    deviceId:
      "0000000000000000000000000000000000000000000000000000000000000002",
    accountUuid: "00000000-0000-4000-8000-000000000000",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "request",
} as const;

type ProfileArgument = Parameters<typeof buildClaudeCodeRequest>[1];

/** The exact rejection, pinned in full. */
const REJECTION = {
  name: "ClaudeCodeWireError",
  code: "INVALID_INPUT",
  message: "INVALID_INPUT",
};

function asProfile(value: unknown): ProfileArgument {
  return value as ProfileArgument;
}

describe("profile acceptance: the pinned singleton", () => {
  it("accepts the singleton passed explicitly", async () => {
    const result = await buildClaudeCodeRequest(
      BASE,
      CLAUDE_CODE_2_1_195_PROFILE,
    );

    expect(result.url).toBe("https://api.anthropic.com/v1/messages?beta=true");
    expect(result.evidence.profileId).toBe(CLAUDE_CODE_2_1_195_PROFILE.id);
  });

  it("accepts an omitted profile, which is the same singleton", async () => {
    // Deliberately the default seam, not a named version: the claim is that
    // omitting the argument selects the default, whatever the default is.
    const explicit = await buildClaudeCodeRequest(BASE, DEFAULT_PROFILE);
    const implicit = await buildClaudeCodeRequest(BASE);

    expect(implicit.body).toBe(explicit.body);
    expect(implicit.url).toBe(explicit.url);
  });

  /*
   * `undefined` is NOT a rejected value: it selects the default parameter, so
   * it behaves exactly like omitting the argument. Pinned because it reads
   * like an obvious rejection case and is not one -- anyone "fixing" that
   * would break every caller that passes an optional profile through.
   */
  it("treats an explicit undefined as the default, not as a rejection", async () => {
    const result = await buildClaudeCodeRequest(BASE, undefined);

    expect(result.evidence.profileId).toBe(DEFAULT_PROFILE.id);
  });
});

describe("profile acceptance: identity, not shape", () => {
  it("rejects a shallow clone of the pinned profile", async () => {
    const clone = { ...CLAUDE_CODE_2_1_195_PROFILE };

    // The clone is structurally indistinguishable...
    expect(clone).toEqual(CLAUDE_CODE_2_1_195_PROFILE);
    expect(clone.id).toBe(CLAUDE_CODE_2_1_195_PROFILE.id);
    // ...and still refused, because it is a different object.
    await expect(
      buildClaudeCodeRequest(BASE, asProfile(clone)),
    ).rejects.toMatchObject(REJECTION);
  });

  it("rejects a frozen clone: freezing does not confer identity", async () => {
    const frozen = Object.freeze({ ...CLAUDE_CODE_2_1_195_PROFILE });

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(CLAUDE_CODE_2_1_195_PROFILE)).toBe(true);
    await expect(
      buildClaudeCodeRequest(BASE, asProfile(frozen)),
    ).rejects.toMatchObject(REJECTION);
  });

  it("rejects a deep clone", async () => {
    const deep: unknown = structuredClone(CLAUDE_CODE_2_1_195_PROFILE);

    await expect(
      buildClaudeCodeRequest(BASE, asProfile(deep)),
    ).rejects.toMatchObject(REJECTION);
  });

  it("rejects a clone carrying an extra field", async () => {
    const widened = { ...CLAUDE_CODE_2_1_195_PROFILE, extra: true };

    await expect(
      buildClaudeCodeRequest(BASE, asProfile(widened)),
    ).rejects.toMatchObject(REJECTION);
  });

  it.each([
    ["null", null],
    ["an empty object", {}],
    ["a string", "claude-code-2.1.195-sdk-0.94.0"],
    ["a number", 1],
    ["an array", []],
    ["a bare id object", { id: "claude-code-2.1.195-sdk-0.94.0" }],
  ])("rejects %s", async (_name, value) => {
    await expect(
      buildClaudeCodeRequest(BASE, asProfile(value)),
    ).rejects.toMatchObject(REJECTION);
  });

  it("carries no details that could leak the rejected value", async () => {
    const clone = { ...CLAUDE_CODE_2_1_195_PROFILE };
    let thrown: unknown;

    try {
      await buildClaudeCodeRequest(BASE, asProfile(clone));
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toMatchObject(REJECTION);
    expect((thrown as { safeDetails: unknown }).safeDetails).toEqual({});
  });
});

describe("profile acceptance: every entry point uses the same registry", () => {
  it("rejects a clone in parseBuiltClaudeCodeRequest, before the value is read", () => {
    const clone = { ...CLAUDE_CODE_2_1_195_PROFILE };

    // The value argument is nonsense on purpose: the profile gate runs first,
    // so the rejection cannot be attributed to the value.
    expect(() =>
      parseBuiltClaudeCodeRequest("not a request", asProfile(clone)),
    ).toThrow(expect.objectContaining(REJECTION));
  });

  it("accepts the singleton in parseBuiltClaudeCodeRequest", async () => {
    const built = await buildClaudeCodeRequest(
      BASE,
      CLAUDE_CODE_2_1_195_PROFILE,
    );
    const roundTripped = parseBuiltClaudeCodeRequest(
      JSON.parse(JSON.stringify(built)),
      CLAUDE_CODE_2_1_195_PROFILE,
    );

    expect(roundTripped.url).toBe(built.url);
  });
});
