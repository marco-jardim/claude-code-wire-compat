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
  ClaudeCodeToolUsed,
  HeaderPair,
} from "../../src/index.js";
import {
  parseToolsUsedHeaderValue,
  serializeToolsUsed,
  validateToolsUsed,
} from "../../src/tools-used.js";

/*
 * The `x-claude-code-sandy-plover` header lists the tools the conversation has
 * used. On 2.1.329 it is always present (`[]` by default); the serialization is
 * `[` + JSON entries joined with `,` + `]`, each entry keyed `name`, then
 * `mcp:true` only when true, then `url`. Entry order is the caller's.
 */

const HEADER = "x-claude-code-sandy-plover";

const BASE = {
  accessToken: "tools-used-token-not-a-secret",
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

async function failureOf(
  attempt: () => unknown,
): Promise<{ code: string; safeDetails: unknown } | undefined> {
  try {
    await attempt();
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) {
      return { code: error.code, safeDetails: error.safeDetails };
    }
    throw error;
  }
  return undefined;
}

function named(length: number): ClaudeCodeToolUsed {
  return { name: "n".repeat(length) };
}

describe("sandy-plover value on 2.1.329", () => {
  it("is present and empty by default", async () => {
    expect(valueOf(await build())).toBe("[]");
    expect(valueOf(await build({ toolsUsed: [] }))).toBe("[]");
  });

  it("serializes entries in caller order with the genuine key order", async () => {
    const built = await build({
      toolsUsed: [
        { name: "Read" },
        { name: "mcp__server__tool", mcp: true },
        { name: "WebFetch", url: "https://example.com/a" },
        { url: "https://example.org/b", mcp: true, name: "Both" },
      ],
    });

    expect(valueOf(built)).toBe(
      '[{"name":"Read"},{"name":"mcp__server__tool","mcp":true},{"name":"WebFetch","url":"https://example.com/a"},{"name":"Both","mcp":true,"url":"https://example.org/b"}]',
    );
  });

  it("does not emit mcp when it is false", async () => {
    const built = await build({ toolsUsed: [{ name: "Read", mcp: false }] });

    expect(valueOf(built)).toBe('[{"name":"Read"}]');
  });

  it("escapes JSON-significant printable characters", async () => {
    const built = await build({ toolsUsed: [{ name: 'a"b\\c' }] });

    expect(valueOf(built)).toBe('[{"name":"a\\"b\\\\c"}]');
  });

  it("drops entries with an empty name or a name over 256 bytes, silently", async () => {
    const built = await build({
      toolsUsed: [{ name: "" }, { name: "kept" }, named(257), named(256)],
    });

    expect(valueOf(built)).toBe(
      `[{"name":"kept"},{"name":"${"n".repeat(256)}"}]`,
    );
  });

  it("places the header in the sorted list between the request-class headers and the client request id", async () => {
    const built = await build({ toolsUsed: [{ name: "Read" }] });
    const names = built.headers.map(([name]) => name);

    expect(names.slice(-3)).toStrictEqual([
      "x-claude-code-request-class",
      HEADER,
      "x-client-request-id",
    ]);
  });

  it("is absent from count_tokens", async () => {
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
});

describe("toolsUsed validation", () => {
  it.each([
    ["a non-array", "Read"],
    ["null", null],
    ["a record", { name: "Read" }],
  ])("rejects %s", async (_label, value) => {
    const failure = await failureOf(() =>
      Reflect.apply(buildClaudeCodeRequest, undefined, [
        { ...BASE, toolsUsed: value },
        CLAUDE_CODE_2_1_329_PROFILE,
      ]),
    );

    expect(failure?.code).toBe("INVALID_INPUT");
  });

  it.each([
    ["a non-record entry", ["Read"]],
    ["a null entry", [null]],
    ["an array entry", [["Read"]]],
    ["a missing name", [{ mcp: true }]],
    ["a non-string name", [{ name: 1 }]],
    ["an unknown key", [{ name: "Read", directory_entry: "x" }]],
    ["an unresolved flag", [{ name: "Read", unresolved: true }]],
    ["a non-boolean mcp", [{ name: "Read", mcp: "true" }]],
    ["a non-string url", [{ name: "Read", url: 1 }]],
    ["a non-ASCII name", [{ name: "caf\u00e9" }]],
    ["a non-ASCII url", [{ name: "Read", url: "https://example.com/\u00e9" }]],
  ])("rejects %s", async (_label, value) => {
    const failure = await failureOf(() =>
      Reflect.apply(buildClaudeCodeRequest, undefined, [
        { ...BASE, toolsUsed: value },
        CLAUDE_CODE_2_1_329_PROFILE,
      ]),
    );

    expect(failure?.code).toBe("INVALID_INPUT");
  });

  it("accepts 64 entries and rejects 65 with the item ceiling", async () => {
    const sixtyFour = Array.from({ length: 64 }, (_, index) => ({
      name: `t${String(index)}`,
    }));

    expect(valueOf(await build({ toolsUsed: sixtyFour }))).toBe(
      serializeToolsUsed(sixtyFour),
    );
    expect(
      await failureOf(() =>
        build({ toolsUsed: [...sixtyFour, { name: "x" }] }),
      ),
    ).toStrictEqual({
      code: "INVALID_INPUT",
      safeDetails: { maximumItems: 64 },
    });
  });

  it("accepts exactly 7168 serialized bytes and rejects one more", async () => {
    const filler = Array.from({ length: 26 }, () => named(256));

    const atLimit = [...filler, named(187)];
    expect(serializeToolsUsed(validateToolsUsed(atLimit)).length).toBe(7168);
    expect(valueOf(await build({ toolsUsed: atLimit }))).toBe(
      serializeToolsUsed(atLimit),
    );

    expect(
      await failureOf(() => build({ toolsUsed: [...filler, named(188)] })),
    ).toStrictEqual({
      code: "INVALID_INPUT",
      safeDetails: { maximumSize: 7168 },
    });
  });

  it.each([
    ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
    ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ])("validates on %s as well", async (_id, profile) => {
    expect(
      (
        await failureOf(() =>
          build(
            { toolsUsed: [{ name: "Read" }, { name: "x", mcp: 1 as never }] },
            profile,
          ),
        )
      )?.code,
    ).toBe("INVALID_INPUT");
  });
});

describe("toolsUsed is inert before 2.1.329", () => {
  it.each([
    ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
    ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ])("%s emits no header and the same bytes", async (_id, profile) => {
    const plain = await build({}, profile);
    const withTools = await build(
      { toolsUsed: [{ name: "Read" }, { name: "x", mcp: true }] },
      profile,
    );

    expect(valueOf(withTools)).toBeUndefined();
    expect(withTools).toStrictEqual(plain);
  });
});

describe("toolsUsed parse round-trip", () => {
  it("round-trips entries", async () => {
    const built = await build({
      toolsUsed: [
        { name: "Read" },
        { name: "mcp__server__tool", mcp: true, url: "https://example.com" },
      ],
    });

    expect(
      parseBuiltClaudeCodeRequest(built, CLAUDE_CODE_2_1_329_PROFILE),
    ).toStrictEqual(built);
  });

  it("round-trips the empty default", async () => {
    const built = await build();

    expect(
      parseBuiltClaudeCodeRequest(built, CLAUDE_CODE_2_1_329_PROFILE),
    ).toStrictEqual(built);
  });

  async function forgedWith(value: string): Promise<BuiltClaudeCodeRequest> {
    const built = await build({ toolsUsed: [{ name: "Read" }] });
    return {
      ...built,
      headers: built.headers.map(([name, current]): HeaderPair => [
        name,
        name === HEADER ? value : current,
      ]),
    };
  }

  it.each([
    ["malformed JSON", "[{"],
    ["a non-array", '{"name":"Read"}'],
    ["whitespace the serializer never emits", '[ {"name":"Read"} ]'],
    ["a reordered key order", '[{"mcp":true,"name":"Read"}]'],
    ["an unknown key", '[{"name":"Read","directory_entry":"x"}]'],
    ["a dropped entry", '[{"name":""}]'],
    ["an explicit false mcp", '[{"name":"Read","mcp":false}]'],
  ])("rejects %s in the header", async (_label, value) => {
    const failure = await failureOf(async () =>
      parseBuiltClaudeCodeRequest(
        await forgedWith(value),
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    );

    expect(failure?.code).toBe("INVALID_INPUT");
  });

  it("rejects a request that lacks the header", async () => {
    const built = await build();
    const headers = built.headers.filter(([name]) => name !== HEADER);
    const forged: BuiltClaudeCodeRequest = {
      ...built,
      headers,
      evidence: {
        ...built.evidence,
        logicalHeaderNames: headers.map(([name]) => name),
      },
    };

    expect(
      (
        await failureOf(() =>
          parseBuiltClaudeCodeRequest(forged, CLAUDE_CODE_2_1_329_PROFILE),
        )
      )?.code,
    ).toBe("INVALID_INPUT");
  });
});

describe("tools-used module", () => {
  it("serializes the empty list and parses a header value back", () => {
    expect(serializeToolsUsed([])).toBe("[]");
    expect(
      parseToolsUsedHeaderValue('[{"name":"a","mcp":true}]'),
    ).toStrictEqual([{ name: "a", mcp: true }]);
  });

  it.each([
    ["a DEL character in a name", [{ name: "a\u007fb" }]],
    ["a tab in a url", [{ name: "a", url: "x\ty" }]],
  ])("rejects %s", (_label, value) => {
    expect(() => validateToolsUsed(value)).toThrow(ClaudeCodeWireError);
  });

  it("freezes the normalised entries", () => {
    const entries = validateToolsUsed([{ name: "a", mcp: false }]);

    expect(Object.isFrozen(entries)).toBe(true);
    expect(entries).toStrictEqual([{ name: "a" }]);
  });
});
