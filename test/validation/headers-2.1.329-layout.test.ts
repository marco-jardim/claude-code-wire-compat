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
import {
  GENUINE_HEADER_NAMES,
  GENUINE_RESERVED_NAMES,
} from "../../src/headers.js";

/*
 * The 2.1.329 header layout: names as the genuine client writes them, the
 * added headers, and one stable sort over every pair by UTF-16 code unit. The
 * expected name order below is the order of the live interactive capture
 * (transport headers excluded); `anthropic-dispatch-id` is account-served and
 * opt-in, so it is absent here. All ids are synthetic.
 */

const PROMPT_ID = "00000000-0000-4000-8000-000000000003";
const TOKEN = "layout-token-not-a-secret";

const BASE = {
  accessToken: TOKEN,
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

const LIVE_NAME_ORDER = [
  "Accept",
  "Authorization",
  "Content-Type",
  "User-Agent",
  "X-Claude-Code-Session-Id",
  "X-Stainless-Arch",
  "X-Stainless-Lang",
  "X-Stainless-OS",
  "X-Stainless-Package-Version",
  "X-Stainless-Retry-Count",
  "X-Stainless-Runtime",
  "X-Stainless-Runtime-Version",
  "X-Stainless-Timeout",
  "anthropic-beta",
  "anthropic-dangerous-direct-browser-access",
  "anthropic-version",
  "x-app",
  "x-claude-1p-request-class",
  "x-claude-code-prompt-id",
  "x-claude-code-request-class",
  "x-claude-code-sandy-plover",
  "x-client-request-id",
] as const;

const LEGACY_NAME_ORDER = [
  "anthropic-beta",
  "anthropic-dangerous-direct-browser-access",
  "anthropic-version",
  "authorization",
  "content-type",
  "user-agent",
  "x-app",
  "x-claude-code-session-id",
  "x-client-request-id",
  "x-stainless-arch",
  "x-stainless-lang",
  "x-stainless-os",
  "x-stainless-package-version",
  "x-stainless-retry-count",
  "x-stainless-runtime",
  "x-stainless-runtime-version",
  "x-stainless-timeout",
] as const;

function build(
  extra: Partial<ClaudeCodeRequestInput> = {},
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_329_PROFILE,
): Promise<BuiltClaudeCodeRequest> {
  return buildClaudeCodeRequest({ ...BASE, ...extra }, profile);
}

function names(built: { readonly headers: readonly HeaderPair[] }): string[] {
  return built.headers.map(([name]) => name);
}

function valueOf(
  built: { readonly headers: readonly HeaderPair[] },
  name: string,
): string | undefined {
  return built.headers.find(([candidate]) => candidate === name)?.[1];
}

async function codeOf(attempt: () => unknown): Promise<string> {
  try {
    await attempt();
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  return "NO_ERROR";
}

describe("2.1.329 header layout: names and order", () => {
  it("emits the live name order with a valid prompt id", async () => {
    const built = await build({ promptId: PROMPT_ID });

    expect(names(built)).toStrictEqual([...LIVE_NAME_ORDER]);
  });

  it("omits only the prompt-id header when there is no valid prompt id", async () => {
    const expected = LIVE_NAME_ORDER.filter(
      (name) => name !== "x-claude-code-prompt-id",
    );

    expect(names(await build())).toStrictEqual(expected);
    expect(names(await build({ promptId: "not-a-uuid" }))).toStrictEqual(
      expected,
    );
    expect(names(await build({ promptId: "" }))).toStrictEqual(expected);
  });

  it("emits the added headers with the genuine values", async () => {
    const built = await build({ promptId: PROMPT_ID });

    expect(valueOf(built, "Accept")).toBe("application/json");
    expect(valueOf(built, "x-claude-code-request-class")).toBe("main");
    expect(valueOf(built, "x-claude-1p-request-class")).toBe("main");
    expect(valueOf(built, "x-claude-code-prompt-id")).toBe(PROMPT_ID);
    expect(valueOf(built, "Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(valueOf(built, "Content-Type")).toBe("application/json");
    expect(valueOf(built, "User-Agent")).toBe(
      CLAUDE_CODE_2_1_329_PROFILE.userAgent,
    );
    expect(valueOf(built, "X-Stainless-Package-Version")).toBe(
      CLAUDE_CODE_2_1_329_PROFILE.sdkVersion,
    );
    expect(valueOf(built, "x-app")).toBe("cli");
    expect(valueOf(built, "X-Claude-Code-Session-Id")).toBe(
      BASE.runtime.sessionId,
    );
  });

  it("applies a profile override to the capitalised names", async () => {
    const built = await build({
      profileOverride: { userAgent: "override-agent/1.0", sdkVersion: "9.9.9" },
    });

    expect(valueOf(built, "User-Agent")).toBe("override-agent/1.0");
    expect(valueOf(built, "X-Stainless-Package-Version")).toBe("9.9.9");
    expect(built.headers.some(([name]) => name === "user-agent")).toBe(false);
  });

  it("keeps the genuine casing table frozen and reserved lowercase", () => {
    expect(Object.isFrozen(GENUINE_HEADER_NAMES)).toBe(true);
    expect(GENUINE_HEADER_NAMES.sessionId).toBe("X-Claude-Code-Session-Id");
    expect(GENUINE_HEADER_NAMES.stainlessHelper).toBe("x-stainless-helper");
    for (const name of [
      "accept",
      "anthropic-dispatch-id",
      "x-claude-1p-request-class",
      "x-claude-code-prompt-id",
      "x-claude-code-request-class",
      "x-claude-code-sandy-plover",
      "user-agent",
    ]) {
      expect(GENUINE_RESERVED_NAMES.has(name)).toBe(true);
    }
  });

  it("sorts caller extras into place by UTF-16 code unit", async () => {
    const built = await build({
      promptId: PROMPT_ID,
      extraHeaders: [
        ["x-zzz", "1"],
        ["Zeta", "2"],
        ["B-Extra", "3"],
        ["x-custom", "4"],
      ],
    });

    expect(names(built)).toStrictEqual([
      "Accept",
      "Authorization",
      "B-Extra",
      "Content-Type",
      "User-Agent",
      "X-Claude-Code-Session-Id",
      "X-Stainless-Arch",
      "X-Stainless-Lang",
      "X-Stainless-OS",
      "X-Stainless-Package-Version",
      "X-Stainless-Retry-Count",
      "X-Stainless-Runtime",
      "X-Stainless-Runtime-Version",
      "X-Stainless-Timeout",
      "Zeta",
      "anthropic-beta",
      "anthropic-dangerous-direct-browser-access",
      "anthropic-version",
      "x-app",
      "x-claude-1p-request-class",
      "x-claude-code-prompt-id",
      "x-claude-code-request-class",
      "x-claude-code-sandy-plover",
      "x-client-request-id",
      "x-custom",
      "x-zzz",
    ]);
    expect(valueOf(built, "B-Extra")).toBe("3");
  });

  it("places the dynamic headers by their lowercase names", async () => {
    const built = await build({
      stainlessHelper: "helper",
      clientApp: "app",
    });

    expect(names(built)).toStrictEqual(
      [...LIVE_NAME_ORDER, "x-client-app", "x-stainless-helper"]
        .filter((name) => name !== "x-claude-code-prompt-id")
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
    );
  });
});

describe("2.1.329 header layout: reserved names", () => {
  it.each([
    "Accept",
    "accept",
    "ACCEPT",
    "anthropic-dispatch-id",
    "x-claude-code-request-class",
    "X-Claude-1p-Request-Class",
    "x-claude-code-prompt-id",
    "x-claude-code-sandy-plover",
    "User-Agent",
  ])("rejects %s as an extra header on 2.1.329", async (name) => {
    expect(await codeOf(() => build({ extraHeaders: [[name, "value"]] }))).toBe(
      "DUPLICATE_HEADER",
    );
  });

  it("drops a reserved extra under dropConflicting and audits the lowercase name", async () => {
    const built = await build({
      extraHeaders: [
        ["Accept", "text/plain"],
        ["x-custom", "kept"],
      ],
      extraHeaderPolicy: "dropConflicting",
    });

    expect(valueOf(built, "Accept")).toBe("application/json");
    expect(valueOf(built, "x-custom")).toBe("kept");
    expect(built.evidence.droppedExtraHeaderNames).toStrictEqual(["accept"]);
  });

  it.each([
    ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
    ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ])("leaves the legacy reserved set unchanged on %s", async (_id, profile) => {
    const built = await build(
      {
        extraHeaders: [
          ["Accept", "text/plain"],
          ["anthropic-dispatch-id", "v2d"],
          ["x-claude-code-request-class", "other"],
        ],
      },
      profile,
    );

    expect(built.headers.slice(-3)).toStrictEqual([
      ["Accept", "text/plain"],
      ["anthropic-dispatch-id", "v2d"],
      ["x-claude-code-request-class", "other"],
    ]);
  });
});

describe("legacy layout is unchanged", () => {
  it.each([
    ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
    ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
  ])("%s keeps lowercase names in the original order", async (_id, profile) => {
    const built = await build({ promptId: PROMPT_ID }, profile);

    expect(names(built)).toStrictEqual([...LEGACY_NAME_ORDER]);
    expect(valueOf(built, "accept")).toBeUndefined();
  });
});

describe("2.1.329 header layout: count_tokens", () => {
  it("omits the request-class, prompt-id and tools-used headers", async () => {
    const built = await buildClaudeCodeCountTokensRequest(
      {
        accessToken: TOKEN,
        model: "claude-opus-5-5",
        messages: [{ role: "user", content: "hello" }],
        runtime: BASE.runtime,
        clientRequestId: BASE.clientRequestId,
      },
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    expect(names(built)).toStrictEqual([
      "Accept",
      "Authorization",
      "Content-Type",
      "User-Agent",
      "X-Claude-Code-Session-Id",
      "X-Stainless-Arch",
      "X-Stainless-Lang",
      "X-Stainless-OS",
      "X-Stainless-Package-Version",
      "X-Stainless-Retry-Count",
      "X-Stainless-Runtime",
      "X-Stainless-Runtime-Version",
      "X-Stainless-Timeout",
      "anthropic-beta",
      "anthropic-dangerous-direct-browser-access",
      "anthropic-version",
      "x-app",
      "x-client-request-id",
    ]);
    expect(valueOf(built, "Accept")).toBe("application/json");
  });
});

describe("2.1.329 header layout: parse", () => {
  it("round-trips a built request", async () => {
    const built = await build({ promptId: PROMPT_ID });

    expect(
      parseBuiltClaudeCodeRequest(built, CLAUDE_CODE_2_1_329_PROFILE),
    ).toStrictEqual(built);
  });

  it("round-trips a request without a prompt id and with extras and dynamic headers", async () => {
    const built = await build({
      stainlessHelper: "helper",
      extraHeaders: [
        ["Zeta", "2"],
        ["x-custom", "4"],
      ],
    });
    const parsed = parseBuiltClaudeCodeRequest(
      built,
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    expect(parsed).toStrictEqual(built);
    expect(valueOf(parsed, "x-claude-code-prompt-id")).toBeUndefined();
  });

  it("recovers the prompt id from the header", async () => {
    const built = await build({ promptId: PROMPT_ID });
    const forged: BuiltClaudeCodeRequest = {
      ...built,
      headers: built.headers.map(([name, value]): HeaderPair => [
        name,
        name === "x-claude-code-prompt-id"
          ? "00000000-0000-4000-8000-000000000004"
          : value,
      ]),
    };

    // The rebuilt list carries the header's own id, so the bytes still match.
    expect(
      parseBuiltClaudeCodeRequest(forged, CLAUDE_CODE_2_1_329_PROFILE).headers,
    ).toStrictEqual(forged.headers);
  });

  it("rejects a prompt-id header that is not a prompt id", async () => {
    const built = await build({ promptId: PROMPT_ID });
    const forged: BuiltClaudeCodeRequest = {
      ...built,
      headers: built.headers.map(([name, value]): HeaderPair => [
        name,
        name === "x-claude-code-prompt-id" ? "not-a-uuid" : value,
      ]),
    };

    expect(
      await codeOf(() =>
        parseBuiltClaudeCodeRequest(forged, CLAUDE_CODE_2_1_329_PROFILE),
      ),
    ).toBe("INVALID_INPUT");
  });

  it("rejects a header list that is not in sorted order", async () => {
    const built = await build({ promptId: PROMPT_ID });
    const reversed: BuiltClaudeCodeRequest = {
      ...built,
      headers: [...built.headers].reverse(),
      evidence: {
        ...built.evidence,
        logicalHeaderNames: [...built.evidence.logicalHeaderNames].reverse(),
      },
    };

    expect(
      await codeOf(() =>
        parseBuiltClaudeCodeRequest(reversed, CLAUDE_CODE_2_1_329_PROFILE),
      ),
    ).toBe("INVALID_INPUT");
  });

  it("rejects a re-cased user-agent", async () => {
    const built = await build();
    const headers = built.headers.map(([name, value]): HeaderPair => [
      name === "User-Agent" ? "user-agent" : name,
      value,
    ]);
    const forged: BuiltClaudeCodeRequest = {
      ...built,
      headers,
      evidence: {
        ...built.evidence,
        logicalHeaderNames: headers.map(([name]) => name),
      },
    };

    expect(
      await codeOf(() =>
        parseBuiltClaudeCodeRequest(forged, CLAUDE_CODE_2_1_329_PROFILE),
      ),
    ).toBe("INVALID_INPUT");
  });

  it("rejects a forged lowercase user-agent added beside the real one", async () => {
    const built = await build();
    const headers: HeaderPair[] = [
      ...built.headers,
      ["user-agent", "forged/1.0"],
    ];
    const forged: BuiltClaudeCodeRequest = {
      ...built,
      headers,
      evidence: {
        ...built.evidence,
        logicalHeaderNames: headers.map(([name]) => name),
      },
    };

    expect(
      await codeOf(() =>
        parseBuiltClaudeCodeRequest(forged, CLAUDE_CODE_2_1_329_PROFILE),
      ),
    ).toBe("INVALID_INPUT");
  });

  it("rejects a legacy-cased header list under the genuine profile", async () => {
    const legacy = await build({}, CLAUDE_CODE_2_1_280_PROFILE);
    const asLegacyRequest: BuiltClaudeCodeRequest = {
      ...legacy,
      url: CLAUDE_CODE_2_1_329_PROFILE.endpoint,
      evidence: {
        ...legacy.evidence,
        profileId: CLAUDE_CODE_2_1_329_PROFILE.id,
        url: CLAUDE_CODE_2_1_329_PROFILE.endpoint,
      },
    };

    expect(
      await codeOf(() =>
        parseBuiltClaudeCodeRequest(
          asLegacyRequest,
          CLAUDE_CODE_2_1_329_PROFILE,
        ),
      ),
    ).toBe("INVALID_INPUT");
  });

  it("still parses a legacy request exactly under a legacy profile", async () => {
    const built = await build({}, CLAUDE_CODE_2_1_280_PROFILE);

    expect(
      parseBuiltClaudeCodeRequest(built, CLAUDE_CODE_2_1_280_PROFILE),
    ).toStrictEqual(built);
  });
});
