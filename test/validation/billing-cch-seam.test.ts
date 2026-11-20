// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  ClaudeCodeWireError,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeRequestInput,
} from "../../src/index.js";

/*
 * The optional `cch` input replaces the five characters after `cch=` in the
 * billing block and nothing else. It is honoured by every profile, so it is
 * exercised against each pinned profile. Absent, the request must be
 * byte-identical to what the package emitted before the input existed.
 */

type PinnedProfile = NonNullable<Parameters<typeof buildClaudeCodeRequest>[1]>;

const PROFILES: readonly (readonly [string, PinnedProfile])[] = [
  ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
  ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
  ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ["2.1.329", CLAUDE_CODE_2_1_329_PROFILE],
];

const BASE = {
  accessToken: "cch-seam-token-not-a-secret",
  model: "claude-sonnet-4-5",
  maxTokens: 128,
  messages: [{ role: "user", content: "hello wire compat" }],
  system: ["synthetic system prompt"],
  runtime: {
    sessionId: "00000000-0000-4000-8000-000000000001",
    deviceId:
      "0000000000000000000000000000000000000000000000000000000000000002",
    accountUuid: "00000000-0000-4000-8000-000000000000",
    runtime: "node",
    runtimeVersion: "v24.15.0",
    os: "Windows",
    arch: "x64",
  },
  clientRequestId: "00000000-0000-4000-8000-000000000002",
} as const satisfies ClaudeCodeRequestInput;

function billingText(built: BuiltClaudeCodeRequest): string {
  const body = JSON.parse(built.body) as {
    system: readonly { readonly text: string }[];
  };
  const [first] = body.system;
  if (first === undefined) throw new Error("billing block missing");
  return first.text;
}

/** Positions at which two equal-length strings differ. */
function differingPositions(left: string, right: string): readonly number[] {
  expect({ leftLength: left.length }).toEqual({ leftLength: right.length });
  const positions: number[] = [];
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) positions.push(index);
  }
  return positions;
}

async function rejectionCode(
  input: Readonly<Record<string, unknown>>,
  profile: PinnedProfile,
): Promise<string> {
  try {
    await (Reflect.apply(buildClaudeCodeRequest, undefined, [
      input,
      profile,
    ]) as Promise<unknown>);
  } catch (error) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  return "no error";
}

describe.each(PROFILES)("cch seam under %s", (_name, profile) => {
  it("keeps the placeholder when absent", async () => {
    const built = await buildClaudeCodeRequest(BASE, profile);

    expect(billingText(built)).toContain(" cch=00000;");
  });

  it("is byte-identical to an explicit placeholder", async () => {
    const absent = await buildClaudeCodeRequest(BASE, profile);
    const explicit = await buildClaudeCodeRequest(
      { ...BASE, cch: "00000" },
      profile,
    );

    expect(explicit).toEqual(absent);
  });

  it("changes only the five billing characters", async () => {
    const absent = await buildClaudeCodeRequest(BASE, profile);
    const supplied = await buildClaudeCodeRequest(
      { ...BASE, cch: "abcde" },
      profile,
    );

    expect(billingText(supplied)).toContain(" cch=abcde;");
    expect(billingText(supplied).replace("cch=abcde;", "cch=00000;")).toBe(
      billingText(absent),
    );
    // Positions are over the whole serialised body: exactly the five
    // characters of the value, which are contiguous.
    const positions = differingPositions(absent.body, supplied.body);
    expect(positions).toHaveLength(5);
    const first = positions[0];
    if (first === undefined) throw new Error("no differing position");
    expect(positions).toEqual([
      first,
      first + 1,
      first + 2,
      first + 3,
      first + 4,
    ]);
    expect(supplied.headers).toEqual(absent.headers);
    // The evidence digest covers the body, so it moves with the five
    // characters; every other evidence field must not.
    expect({ ...supplied.evidence, bodySha256: "" }).toEqual({
      ...absent.evidence,
      bodySha256: "",
    });
    expect(supplied.evidence.bodySha256).not.toBe(absent.evidence.bodySha256);
    expect(supplied.url).toBe(absent.url);
  });

  it.each([
    ["upper-case hexadecimal", "ABCDE"],
    ["four characters", "abcd"],
    ["six characters", "abcdef"],
    ["non-hexadecimal", "abcdg"],
    ["empty", ""],
    ["a number", 1],
    ["null", null],
  ])("rejects %s", async (_label, value) => {
    expect(await rejectionCode({ ...BASE, cch: value }, profile)).toBe(
      "INVALID_INPUT",
    );
  });

  it("is ignored when the billing block is suppressed", async () => {
    const absent = await buildClaudeCodeRequest(
      { ...BASE, suppressBillingBlock: true },
      profile,
    );
    const supplied = await buildClaudeCodeRequest(
      { ...BASE, suppressBillingBlock: true, cch: "abcde" },
      profile,
    );

    expect(supplied).toEqual(absent);
    expect(supplied.body).not.toContain("cch=");
  });

  it("still validates the value when the billing block is suppressed", async () => {
    expect(
      await rejectionCode(
        { ...BASE, suppressBillingBlock: true, cch: "ABCDE" },
        profile,
      ),
    ).toBe("INVALID_INPUT");
  });
});
