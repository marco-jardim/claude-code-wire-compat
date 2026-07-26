// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeRequestInput,
  HeaderPair,
} from "../../src/contracts.js";
import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/build-request.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";

const TOKEN = "sentinel-token-build-9c31de";
const SESSION_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_REQUEST_ID = "00000000-0000-4000-8000-000000000002";

type RuntimeBuildInput = ClaudeCodeRequestInput & {
  readonly clientRequestId: string;
  readonly crypto?: unknown;
};

function validInput(): RuntimeBuildInput {
  return {
    accessToken: TOKEN,
    model: "claude-sonnet-4-5",
    maxTokens: 128,
    messages: [{ role: "user", content: "hello wire compat" }],
    system: ["synthetic system prompt"],
    runtime: {
      sessionId: SESSION_ID,
      deviceId:
        "0000000000000000000000000000000000000000000000000000000000000002",
      accountUuid: "00000000-0000-4000-8000-000000000000",
      runtime: "node",
      runtimeVersion: "v24.15.0",
      os: "Windows",
      arch: "x64",
    },
    clientRequestId: CLIENT_REQUEST_ID,
  };
}

function invalidInput(value: unknown): ClaudeCodeRequestInput {
  // Intentional invalid-input fixture used to exercise the runtime boundary.
  return value as ClaudeCodeRequestInput;
}

function inputWith(key: string, value: unknown): ClaudeCodeRequestInput {
  return invalidInput({ ...validInput(), [key]: value });
}

function expectBuildCode(
  input: ClaudeCodeRequestInput,
  code: string,
): Promise<void> {
  return expect(buildClaudeCodeRequest(input)).rejects.toThrow(
    expect.objectContaining({ code }),
  );
}

function bodyOf(built: BuiltClaudeCodeRequest): Record<string, unknown> {
  const parsed: unknown = JSON.parse(built.body);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Built body must be a record.");
  }
  return parsed as Record<string, unknown>;
}

function billingText(built: BuiltClaudeCodeRequest): string {
  const system = bodyOf(built)["system"];
  if (!Array.isArray(system)) throw new TypeError("System must be an array.");
  const billing: unknown = system[0];
  if (
    typeof billing !== "object" ||
    billing === null ||
    !("text" in billing) ||
    typeof billing.text !== "string"
  ) {
    throw new TypeError("Billing block must contain text.");
  }
  return billing.text;
}

function expectedBilling(firstUserText: string): string {
  const material = `59cf53e54c78${firstUserText[4] ?? "0"}${firstUserText[7] ?? "0"}${firstUserText[20] ?? "0"}2.1.195`;
  const fingerprint = createHash("sha256")
    .update(material)
    .digest("hex")
    .slice(0, 3);
  return `x-anthropic-billing-header: cc_version=2.1.195.${fingerprint}; cc_entrypoint=cli; cch=00000;`;
}

function cloneBuilt(
  built: BuiltClaudeCodeRequest,
  changes: Readonly<Record<string, unknown>>,
): unknown {
  return { ...built, ...changes };
}

function expectParseInvalid(value: unknown): void {
  expect(() => parseBuiltClaudeCodeRequest(value)).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
}

describe("buildClaudeCodeRequest input validation", () => {
  it("rejects an input property with a missing descriptor", async () => {
    const input = new Proxy(
      {},
      {
        ownKeys: () => ["accessToken"],
        getOwnPropertyDescriptor: () => undefined,
      },
    );
    await expectBuildCode(invalidInput(input), "INVALID_INPUT");
  });

  it("rejects an accessor property without reading it", async () => {
    const input = { ...validInput() } as Record<string, unknown>;
    Object.defineProperty(input, "model", {
      configurable: true,
      enumerable: true,
      get: () => {
        throw new Error("accessor must not execute");
      },
    });
    await expectBuildCode(invalidInput(input), "INVALID_INPUT");
  });

  it.each(["abc\ud800", "a\ud800b", "abc\udc00"])(
    "rejects invalid surrogate sequence %j",
    async (content) => {
      await expectBuildCode(
        inputWith("messages", [{ role: "user", content }]),
        "INVALID_UNICODE",
      );
    },
  );

  it("accepts a valid surrogate pair", async () => {
    const content = "abc\ud83d\ude00";
    const built = await buildClaudeCodeRequest(
      inputWith("messages", [{ role: "user", content }]),
    );
    expect(bodyOf(built)["messages"]).toEqual([{ role: "user", content }]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-finite graph number %s",
    async (maxTokens) => {
      await expectBuildCode(inputWith("maxTokens", maxTokens), "INVALID_INPUT");
    },
  );

  it("rejects a non-object graph leaf", async () => {
    await expectBuildCode(
      inputWith("maxTokens", Symbol("invalid")),
      "INVALID_INPUT",
    );
  });

  it("rejects a graph object with a non-plain prototype", async () => {
    await expectBuildCode(inputWith("metadata", new Date(0)), "INVALID_INPUT");
  });

  it.each([
    ["accessToken", 7],
    ["model", 7],
    ["messages", {}],
  ] as const)("rejects invalid required field %s", async (key, value) => {
    await expectBuildCode(inputWith(key, value), "INVALID_INPUT");
  });

  it("sanitizes an unexpected graph inspection error", async () => {
    const throwingRecord = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error("synthetic inspection failure");
        },
      },
    );
    await expectBuildCode(
      inputWith("metadata", throwingRecord),
      "INVALID_INPUT",
    );
  });

  it("rejects input deeper than the graph limit", async () => {
    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 102; index += 1) nested = { nested };
    await expectBuildCode(inputWith("metadata", nested), "INPUT_TOO_DEEP");
  });

  it("rejects input larger than the graph limit", async () => {
    await expectBuildCode(
      inputWith("messages", [{ role: "user", content: "x".repeat(1_000_001) }]),
      "INPUT_TOO_LARGE",
    );
  });

  it("rejects a cyclic input", async () => {
    const input = { ...validInput() } as Record<string, unknown>;
    input["metadata"] = input;
    await expectBuildCode(invalidInput(input), "CYCLIC_INPUT");
  });

  it("rejects a structurally equal but unpinned profile", async () => {
    await expect(
      buildClaudeCodeRequest(validInput(), {
        ...CLAUDE_CODE_2_1_195_PROFILE,
      }),
    ).rejects.toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("accepts an explicitly undefined crypto provider", async () => {
    const built = await buildClaudeCodeRequest(
      invalidInput({ ...validInput(), crypto: undefined }),
    );
    expect(bodyOf(built)["model"]).toBe("claude-sonnet-4-5");
  });

  it.each([null, "crypto"])("rejects non-record crypto %j", async (crypto) => {
    await expectBuildCode(inputWith("crypto", crypto), "CRYPTO_UNAVAILABLE");
  });

  it("rejects crypto whose subtle.digest is not a function", async () => {
    await expectBuildCode(
      inputWith("crypto", { subtle: { digest: "invalid" } }),
      "CRYPTO_UNAVAILABLE",
    );
  });

  // Wrap each case so Vitest passes array values as one callback argument.
  it.each([[null], [[]], ["request"]])(
    "rejects non-record input %j",
    async (input) => {
      await expectBuildCode(invalidInput(input), "INVALID_INPUT");
    },
  );

  it.each([undefined, ""])(
    "rejects clientRequestId %j",
    async (clientRequestId) => {
      const input = { ...validInput() } as Record<string, unknown>;
      if (clientRequestId === undefined) delete input["clientRequestId"];
      else input["clientRequestId"] = clientRequestId;
      await expectBuildCode(invalidInput(input), "INVALID_INPUT");
    },
  );

  it("passes an unrecognised model through", async () => {
    const built = await buildClaudeCodeRequest(
      inputWith("model", "claude-unsupported-synthetic"),
    );
    expect(JSON.parse(built.body)).toMatchObject({
      model: "claude-unsupported-synthetic",
    });
    expect(built.evidence.modelFamily).toBe("unknown");
  });

  it("rejects a non-record capabilities value", async () => {
    await expectBuildCode(
      inputWith("capabilities", []),
      "UNSUPPORTED_CAPABILITY",
    );
  });

  it("rejects an unknown capability key", async () => {
    await expectBuildCode(
      inputWith("capabilities", { synthetic: true }),
      "INVALID_INPUT",
    );
  });

  it("rejects a non-boolean capability value", async () => {
    await expectBuildCode(
      inputWith("capabilities", { contextHint: "yes" }),
      "UNSUPPORTED_CAPABILITY",
    );
  });

  it("rejects a capability that the resolved model does not support", async () => {
    const unsupported = Object.entries(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    ).flatMap(([model, definition]) =>
      Object.entries(definition.capabilities)
        .filter(([, supported]) => !supported)
        .map(([capability]) => ({ model, capability })),
    )[0];
    if (unsupported === undefined) {
      throw new TypeError(
        "Pinned profile must contain an unsupported capability.",
      );
    }
    await expectBuildCode(
      invalidInput({
        ...validInput(),
        model: unsupported.model,
        capabilities: { [unsupported.capability]: true },
      }),
      "UNSUPPORTED_CAPABILITY",
    );
  });

  it("covers present capabilities with absent system in the rebuilt input", async () => {
    const input = { ...validInput(), capabilities: { contextHint: false } };
    delete (input as { system?: unknown }).system;
    const built = await buildClaudeCodeRequest(input);
    expect(bodyOf(built)["system"]).toEqual([
      { type: "text", text: expectedBilling("hello wire compat") },
      {
        type: "text",
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
        cache_control: { type: "ephemeral", ttl: "1h" },
      },
    ]);
    expect(built.evidence.capabilityDecisions.contextHint).toBe(false);
  });
});

describe("billing fingerprint input selection", () => {
  it("uses a plain-string first user message", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    expect(billingText(built)).toBe(expectedBilling("hello wire compat"));
  });

  it("uses the first text block in the first user message", async () => {
    const text = "block fingerprint source";
    const built = await buildClaudeCodeRequest(
      inputWith("messages", [
        {
          role: "user",
          content: [
            { type: "text", text },
            { type: "text", text: "later text" },
          ],
        },
      ]),
    );
    expect(billingText(built)).toBe(expectedBilling(text));
  });

  it("skips a non-text block before the first text block", async () => {
    const text = "hello";
    const built = await buildClaudeCodeRequest(
      inputWith("messages", [
        {
          role: "user",
          content: [
            {
              type: "tool_use",
              id: "tool-use-synthetic",
              name: "synthetic_tool",
              input: {},
            },
            { type: "text", text },
          ],
        },
      ]),
    );
    expect(billingText(built)).toBe(expectedBilling(text));
  });

  it("skips a leading assistant message", async () => {
    const text = "user after assistant";
    const built = await buildClaudeCodeRequest(
      inputWith("messages", [
        { role: "assistant", content: "ignored assistant text" },
        { role: "user", content: text },
      ]),
    );
    expect(billingText(built)).toBe(expectedBilling(text));
  });

  it("uses the empty-string fallback when there is no user message", async () => {
    const built = await buildClaudeCodeRequest(
      inputWith("messages", [
        { role: "assistant", content: "no user message" },
      ]),
    );
    expect(billingText(built)).toBe(expectedBilling(""));
  });

  it("uses the empty-string fallback when the first user has no text block", async () => {
    const built = await buildClaudeCodeRequest(
      inputWith("messages", [
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool-use-synthetic",
              name: "synthetic_tool",
              input: {},
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-use-synthetic",
              content: "synthetic result",
            },
          ],
        },
      ]),
    );
    expect(billingText(built)).toBe(expectedBilling(""));
  });
});

describe("parseBuiltClaudeCodeRequest validation", () => {
  it("rejects non-record top-level values", () => {
    expectParseInvalid(null);
    expectParseInvalid([]);
  });

  it("rejects a structurally equal but unpinned profile", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    expect(() =>
      parseBuiltClaudeCodeRequest(built, {
        ...CLAUDE_CODE_2_1_195_PROFILE,
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("rejects a non-string body", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseInvalid(cloneBuilt(built, { body: 7 }));
  });

  it.each(["not json", "[]", "null"])("rejects body %j", async (body) => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseInvalid(cloneBuilt(built, { body }));
  });

  it("rejects a non-array headers value", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseInvalid(cloneBuilt(built, { headers: {} }));
  });

  it("accepts recognized evidence model families and rejects an invalid one", async () => {
    const built = await buildClaudeCodeRequest(validInput());

    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);

    for (const modelFamily of ["haiku", "sonnet", "opus", "fable"] as const) {
      expect(
        parseBuiltClaudeCodeRequest(
          cloneBuilt(built, {
            evidence: { ...built.evidence, modelFamily },
          }),
        ).evidence.modelFamily,
      ).toBe(modelFamily);
    }

    expectParseInvalid(
      cloneBuilt(built, {
        evidence: { ...built.evidence, modelFamily: "synthetic" },
      }),
    );
  });

  it.each([[{}], [["name"]], [["name", 7]]])(
    "rejects malformed header entry %j",
    async (entry) => {
      const built = await buildClaudeCodeRequest(validInput());
      expectParseInvalid(cloneBuilt(built, { headers: [entry] }));
    },
  );

  it("rejects missing and non-string metadata.user_id", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const body = bodyOf(built);
    expectParseInvalid(
      cloneBuilt(built, { body: JSON.stringify({ ...body, metadata: {} }) }),
    );
    expectParseInvalid(
      cloneBuilt(built, {
        body: JSON.stringify({ ...body, metadata: { user_id: 7 } }),
      }),
    );
  });

  it("rejects a non-string identity session_id", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const body = bodyOf(built);
    expectParseInvalid(
      cloneBuilt(built, {
        body: JSON.stringify({
          ...body,
          metadata: { user_id: JSON.stringify({ session_id: 7 }) },
        }),
      }),
    );
  });

  it("rejects zero or multiple session-id headers", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const withoutSession = built.headers.filter(
      ([name]) => name !== "x-claude-code-session-id",
    );
    const duplicateSession: readonly HeaderPair[] = [
      ...built.headers,
      ["x-claude-code-session-id", SESSION_ID],
    ];
    expectParseInvalid(cloneBuilt(built, { headers: withoutSession }));
    expectParseInvalid(cloneBuilt(built, { headers: duplicateSession }));
  });
});
