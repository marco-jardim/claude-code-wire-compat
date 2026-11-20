// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  ClaudeCodeWireError,
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  HeaderPair,
} from "../../src/index.js";
import { validateAccountFeatures } from "../../src/account-features.js";

/*
 * `accountFeatures` is the opt-in seam for features the genuine client enables
 * per account. Only `dispatchId` takes effect here: it adds the
 * `anthropic-dispatch-id` header, which sorts between
 * `anthropic-dangerous-direct-browser-access` and `anthropic-version` (live
 * capture `inter329-205`). Every member is validated on every profile.
 */

const HEADER = "anthropic-dispatch-id";

const BASE = {
  accessToken: "account-features-token-not-a-secret",
  model: "claude-opus-5-5",
  maxTokens: 128,
  messages: [{ role: "user", content: "hello" }],
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

function build(
  extra: Partial<ClaudeCodeRequestInput> = {},
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_329_PROFILE,
): Promise<BuiltClaudeCodeRequest> {
  return buildClaudeCodeRequest({ ...BASE, ...extra }, profile);
}

function valueOf(built: {
  readonly headers: readonly HeaderPair[];
}): string | undefined {
  return built.headers.find(([name]) => name === HEADER)?.[1];
}

async function failureCode(
  extra: Partial<ClaudeCodeRequestInput>,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_329_PROFILE,
): Promise<string | undefined> {
  try {
    await build(extra, profile);
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  return undefined;
}

describe("anthropic-dispatch-id on 2.1.329", () => {
  it("is absent by default", async () => {
    expect(valueOf(await build())).toBeUndefined();
    expect(valueOf(await build({ accountFeatures: {} }))).toBeUndefined();
  });

  it.each(["v2d", "v2s", "v2p"] as const)("emits %s", async (dispatchId) => {
    const built = await build({ accountFeatures: { dispatchId } });

    expect(valueOf(built)).toBe(dispatchId);
  });

  it("sorts between the browser-access and version headers", async () => {
    const built = await build({ accountFeatures: { dispatchId: "v2d" } });
    const names = built.headers.map(([name]) => name);
    const at = names.indexOf(HEADER);

    expect(names[at - 1]).toBe("anthropic-dangerous-direct-browser-access");
    expect(names[at + 1]).toBe("anthropic-version");
  });

  it("is omitted from count_tokens", async () => {
    const built = await buildClaudeCodeCountTokensRequest(
      {
        accessToken: BASE.accessToken,
        model: BASE.model,
        messages: BASE.messages,
        runtime: BASE.runtime,
        clientRequestId: BASE.clientRequestId,
      },
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    expect(valueOf(built)).toBeUndefined();
  });

  it("is reserved: a caller extra header with that name is refused", async () => {
    expect(await failureCode({ extraHeaders: [[HEADER, "v2d"]] })).toBe(
      "DUPLICATE_HEADER",
    );
    expect(
      await failureCode({
        accountFeatures: { dispatchId: "v2d" },
        extraHeaders: [["Anthropic-Dispatch-Id", "v2s"]],
      }),
    ).toBe("DUPLICATE_HEADER");
  });

  it("round-trips through parseBuiltClaudeCodeRequest", async () => {
    const built = await build({ accountFeatures: { dispatchId: "v2s" } });
    const parsed = parseBuiltClaudeCodeRequest(
      JSON.parse(JSON.stringify(built)) as unknown,
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    expect(parsed).toStrictEqual(built);
  });

  it("refuses a parsed request whose dispatch id was forged", async () => {
    const built = await build({ accountFeatures: { dispatchId: "v2s" } });
    const forged = {
      ...built,
      headers: built.headers.map(([name, value]) =>
        name === HEADER ? [name, "v9x"] : [name, value],
      ),
    };

    expect(() =>
      parseBuiltClaudeCodeRequest(forged, CLAUDE_CODE_2_1_329_PROFILE),
    ).toThrow(ClaudeCodeWireError);
  });

  it("does not touch the body", async () => {
    const plain = await build();
    const withId = await build({ accountFeatures: { dispatchId: "v2p" } });

    expect(withId.body).toBe(plain.body);
  });
});

describe("accountFeatures on earlier profiles", () => {
  it.each([
    ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
    ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ])("%s validates and ignores it", async (_name, profile) => {
    const plain = await build({}, profile);
    const withFeatures = await build(
      {
        accountFeatures: {
          dispatchId: "v2d",
          inlineTools: true,
          toolProvenance: true,
          thread: { type: "create" },
        },
      },
      profile,
    );

    expect(withFeatures).toStrictEqual(plain);
    expect(valueOf(withFeatures)).toBeUndefined();
    expect(
      await failureCode(
        { accountFeatures: { dispatchId: "v9" as never } },
        profile,
      ),
    ).toBe("INVALID_INPUT");
  });
});

describe("validateAccountFeatures", () => {
  it("returns a normalised frozen copy", () => {
    const result = validateAccountFeatures({
      thread: { type: "continue", previousMessageId: "msg_01AbC" },
      inlineTools: false,
      toolProvenance: true,
      dispatchId: "v2p",
    });

    expect(result).toStrictEqual({
      dispatchId: "v2p",
      inlineTools: false,
      toolProvenance: true,
      thread: { type: "continue", previousMessageId: "msg_01AbC" },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(
      validateAccountFeatures({ thread: { type: "create" } }),
    ).toStrictEqual({ thread: { type: "create" } });
  });

  it.each([
    ["non-record", "v2d"],
    ["array", []],
    ["null", null],
    ["unknown key", { dispatch: "v2d" }],
    ["bad dispatch id", { dispatchId: "v2x" }],
    ["numeric dispatch id", { dispatchId: 2 }],
    ["non-boolean inlineTools", { inlineTools: "yes" }],
    ["non-boolean toolProvenance", { toolProvenance: 1 }],
    ["thread not a record", { thread: "create" }],
    ["thread unknown type", { thread: { type: "fork" } }],
    ["thread without type", { thread: {} }],
    [
      "create with extra key",
      { thread: { type: "create", previousMessageId: "msg_1" } },
    ],
    ["continue without id", { thread: { type: "continue" } }],
    [
      "continue with null id",
      { thread: { type: "continue", previousMessageId: null } },
    ],
    [
      "continue with bad id",
      { thread: { type: "continue", previousMessageId: "req_1" } },
    ],
    [
      "continue with extra key",
      { thread: { type: "continue", previousMessageId: "msg_1", x: 1 } },
    ],
  ])("rejects %s", (_name, value) => {
    expect(() => validateAccountFeatures(value)).toThrow(ClaudeCodeWireError);
  });
});
