// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  ClaudeCodeWireErrorCode,
  HeaderPair,
} from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
  ClaudeCodeWireError,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

/**
 * `Reflect.get` is declared to return `any`. Narrowing it to `unknown` at the
 * single point of use keeps proxy traps free of unsafe returns.
 */
const reflectGet: (
  target: object,
  key: PropertyKey,
  receiver?: unknown,
) => unknown = Reflect.get;

const TOKEN = "mutation-token-4d30e8";
const SESSION_ID = "10000000-0000-4000-8000-000000000001";
const CLIENT_REQUEST_ID = "10000000-0000-4000-8000-000000000002";
let freshBuildRequestSequence = 0;

interface BuildRequestModule {
  readonly buildClaudeCodeRequest: typeof buildClaudeCodeRequest;
}

async function freshBuildRequestModule(): Promise<BuildRequestModule> {
  freshBuildRequestSequence += 1;
  const loaded: unknown = await import(
    /* @vite-ignore */ `../../src/build-request.js?mutation-test=${String(freshBuildRequestSequence)}`
  );
  if (
    !isRecord(loaded) ||
    typeof loaded["buildClaudeCodeRequest"] !== "function"
  ) {
    throw new TypeError("Invalid build-request module.");
  }
  return { buildClaudeCodeRequest: loaded["buildClaudeCodeRequest"] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deliberately shallow narrowing for values presented to the runtime boundary.
 * The production function, rather than this test helper, owns full validation.
 */
function requestInput(value: unknown): ClaudeCodeRequestInput {
  if (isRuntimeRequestInput(value)) return value;
  throw new TypeError("Unreachable fixture narrowing failure.");
}

function isRuntimeRequestInput(
  value: unknown,
): value is ClaudeCodeRequestInput {
  // Fixtures intentionally include malformed values. Full validation belongs
  // to the public runtime boundary exercised by these tests.
  return value === value;
}

function protocolProfile(value: unknown): ClaudeCodeProtocolProfile {
  if (!isRecord(value)) throw new TypeError("Fixture must be an object.");
  return value;
}

function validInput(): ClaudeCodeRequestInput {
  return requestInput({
    accessToken: TOKEN,
    model: "claude-sonnet-4-5",
    maxTokens: 128,
    messages: [{ role: "user", content: "mutation coverage" }],
    system: ["mutation system"],
    runtime: {
      sessionId: SESSION_ID,
      deviceId:
        "1000000000000000000000000000000000000000000000000000000000000001",
      accountUuid: "10000000-0000-4000-8000-000000000000",
      runtime: "node",
      runtimeVersion: "v24.15.0",
      os: "Windows",
      arch: "x64",
    },
    clientRequestId: CLIENT_REQUEST_ID,
  });
}

function withField(key: string, value: unknown): ClaudeCodeRequestInput {
  return requestInput({ ...validInput(), [key]: value });
}

async function expectBuildError(
  input: ClaudeCodeRequestInput,
  code: ClaudeCodeWireErrorCode,
  safeDetails: Readonly<Record<string, string | number | boolean>> = {},
): Promise<ClaudeCodeWireError> {
  try {
    await buildClaudeCodeRequest(input);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ClaudeCodeWireError);
    if (!(error instanceof ClaudeCodeWireError)) {
      throw new TypeError("Expected ClaudeCodeWireError.", { cause: error });
    }
    expect(error.code).toBe(code);
    expect(error.safeDetails).toEqual(safeDetails);
    return error;
  }
  throw new TypeError(`Expected ${code}.`);
}

function expectParseError(value: unknown): void {
  try {
    parseBuiltClaudeCodeRequest(value);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ClaudeCodeWireError);
    if (!(error instanceof ClaudeCodeWireError)) {
      throw new TypeError("Expected ClaudeCodeWireError.", { cause: error });
    }
    expect(error.code).toBe("INVALID_INPUT");
    expect(error.safeDetails).toEqual({});
    return;
  }
  throw new TypeError("Expected INVALID_INPUT.");
}

function bodyRecord(body: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed)) throw new TypeError("Body must be an object.");
  return parsed;
}

function graphSize(value: unknown): number {
  if (typeof value === "string")
    return new TextEncoder().encode(value).byteLength;
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return 1;
  }
  if (typeof value !== "object") {
    throw new TypeError("Unsupported graph-size fixture value.");
  }
  let size = Reflect.ownKeys(value).length;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new TypeError("Unsupported graph-size fixture key.");
    }
    size += new TextEncoder().encode(key).byteLength;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError("Unsupported graph-size fixture descriptor.");
    }
    size += graphSize(descriptor.value);
  }
  return size;
}

function cloneBuilt(
  built: BuiltClaudeCodeRequest,
  changes: Readonly<Record<string, unknown>>,
): unknown {
  return { ...built, ...changes };
}

function cloneEvidence(
  built: BuiltClaudeCodeRequest,
  changes: Readonly<Record<string, unknown>>,
): unknown {
  return cloneBuilt(built, { evidence: { ...built.evidence, ...changes } });
}

function coherentBodyVariant(
  built: BuiltClaudeCodeRequest,
  body: Readonly<Record<string, unknown>>,
  evidenceChanges: Readonly<Record<string, unknown>> = {},
): unknown {
  const encoded = JSON.stringify(body);
  return cloneBuilt(built, {
    body: encoded,
    evidence: {
      ...built.evidence,
      bodySha256: createHash("sha256").update(encoded, "utf8").digest("hex"),
      bodyByteLength: Buffer.byteLength(encoded, "utf8"),
      ...evidenceChanges,
    },
  });
}

describe("build-request surviving input-validation mutants", () => {
  it("accepts every mutation-sensitive public input and override key", async () => {
    const fresh = await freshBuildRequestModule();
    const supportedModel = "claude-fresh-override-opus";
    const input = requestInput({
      ...validInput(),
      model: supportedModel,
      outputFormat: {
        type: "json_schema",
        schema: { type: "object", properties: {} },
      },
      profileOverride: {
        id: "fresh-profile-id",
        cliVersion: "2.1.196",
        sdkVersion: "0.95.1",
        entrypoint: "cli",
        userAgent: "claude-cli/2.1.196 (external, cli)",
        buildTime: "2026-02-03T04:05:06.000Z",
        gitSha: "fresh-profile-sha",
        attributionHeaderEnabled: false,
        contextHintEnabled: false,
        supportedModels: {
          [supportedModel]: {
            family: "opus",
            capabilities: [
              "effort",
              "max_effort",
              "xhigh_effort",
              "adaptive_thinking",
              "context_management",
            ],
          },
        },
        orderedBetas: ["fresh-beta"],
      },
    });

    const built = await fresh.buildClaudeCodeRequest(input);
    expect(built.evidence.profileId).toBe("fresh-profile-id");
    expect(built.evidence.modelFamily).toBe("opus");
    expect(built.evidence.capabilityDecisions).toMatchObject({
      thinking: false,
      adaptiveThinking: false,
      effort: false,
    });
    expect(bodyRecord(built.body)["output_format"]).toEqual({
      type: "json_schema",
      schema: { type: "object", properties: {} },
    });
  });

  it.each([
    "contextManagement",
    "outputConfig",
    "speed",
    "serviceTier",
    "outputFormat",
    "toolChoice",
    "topP",
    "topK",
    "stopSequences",
    "stream",
    "temperature",
  ])("rejects explicitly undefined optional field %s", async (field) => {
    await expectBuildError(withField(field, undefined), "INVALID_INPUT");
  });
  it.each([
    ["NUL", "\u0000"],
    ["unit separator", "\u001f"],
    ["DEL", "\u007f"],
    ["trailing high surrogate", "\ud800"],
    ["top high surrogate followed by a non-low unit", "\udbff\ue000"],
    ["bottom low surrogate", "\udc00"],
    ["top low surrogate", "\udfff"],
  ])("rejects the exact invalid Unicode boundary %s", async (_name, text) => {
    await expectBuildError(
      withField("messages", [{ role: "user", content: `a${text}` }]),
      "INVALID_UNICODE",
    );
  });

  it.each(["\u0020", "\u007e", "\ud800\udc00", "\udbff\udfff"])(
    "accepts the exact valid Unicode boundary %j",
    async (text) => {
      const built = await buildClaudeCodeRequest(
        withField("messages", [{ role: "user", content: text }]),
      );
      expect(bodyRecord(built.body)["messages"]).toEqual([
        { role: "user", content: text },
      ]);
    },
  );

  it("does not inspect a string beyond its final UTF-16 code unit", async () => {
    const marker = "char-code-boundary-marker";
    // Spy WITHOUT mockImplementation: Vitest calls through to the real method,
    // so validation still behaves normally and no reference to the unbound
    // prototype method is needed.
    const spy = vi.spyOn(String.prototype, "charCodeAt");
    const inspectedIndexes = (): readonly number[] =>
      spy.mock.calls
        // Modules are strict mode, so the recorded receiver is a primitive.
        .filter((_call, callIndex) => spy.mock.instances[callIndex] === marker)
        .map(([index]) => index);
    try {
      await expect(
        buildClaudeCodeRequest(withField("clientRequestId", marker)),
      ).resolves.toMatchObject({ method: "POST" });
      expect(inspectedIndexes()).toContain(marker.length - 1);
      expect(inspectedIndexes()).not.toContain(marker.length);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it.each(["\ud800", "\ud800\u0020", "\udbff\ue000", "\udc00", "\udfff"])(
    "rejects transient invalid Unicode %j before later consumers see valid text",
    async (invalidText) => {
      let contentDescriptors = 0;
      const message = new Proxy(
        { role: "user", content: "valid later text" },
        {
          getOwnPropertyDescriptor: (target, key) => {
            const descriptor = Object.getOwnPropertyDescriptor(target, key);
            if (key !== "content" || descriptor === undefined)
              return descriptor;
            contentDescriptors += 1;
            return {
              configurable: true,
              enumerable: true,
              writable: true,
              value:
                contentDescriptors === 1 ? invalidText : "valid later text",
            };
          },
        },
      );
      await expectBuildError(
        withField("messages", [message]),
        "INVALID_UNICODE",
      );
      expect(contentDescriptors).toBe(1);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite number %s with the precise code",
    async (value) => {
      await expectBuildError(withField("maxTokens", value), "INVALID_INPUT");
    },
  );

  it("rejects a transient non-finite number before later consumers see 128", async () => {
    let maxTokenDescriptors = 0;
    const target = { ...validInput() };
    const input = new Proxy(target, {
      getOwnPropertyDescriptor: (candidate, key) => {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
        if (key !== "maxTokens" || descriptor === undefined) return descriptor;
        maxTokenDescriptors += 1;
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: maxTokenDescriptors === 1 ? Number.NaN : 128,
        };
      },
    });
    await expectBuildError(requestInput(input), "INVALID_INPUT");
    expect(maxTokenDescriptors).toBe(1);
  });

  it.each([undefined, 1n, Symbol("leaf"), () => undefined])(
    "rejects a non-JSON graph leaf %s",
    async (value) => {
      await expectBuildError(withField("metadata", { value }), "INVALID_INPUT");
    },
  );

  it("rejects top-level undefined metadata before it can be omitted", async () => {
    await expectBuildError(withField("metadata", undefined), "INVALID_INPUT");
  });

  it.each([new Date(0), new Map(), /value/u])(
    "rejects non-plain graph object %#",
    async (value) => {
      await expectBuildError(withField("metadata", value), "INVALID_INPUT");
    },
  );

  it("accepts a null-prototype graph and rejects forbidden own keys", async () => {
    const clean: unknown = Object.create(null);
    if (!isRecord(clean))
      throw new TypeError("Expected null-prototype record.");
    Object.defineProperty(clean, "safe", {
      configurable: true,
      enumerable: true,
      value: "value",
    });
    const built = await buildClaudeCodeRequest(withField("metadata", clean));
    expect(bodyRecord(built.body)["metadata"]).toBeDefined();

    for (const key of ["__proto__", "prototype", "constructor"]) {
      const poisoned: unknown = Object.create(null);
      if (!isRecord(poisoned))
        throw new TypeError("Expected null-prototype record.");
      Object.defineProperty(poisoned, key, {
        configurable: true,
        enumerable: true,
        value: "value",
      });
      await expectBuildError(withField("metadata", poisoned), "INVALID_INPUT");
    }
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects transient forbidden graph key %s at first inspection",
    async (key) => {
      const target: Record<string, unknown> = {};
      Object.defineProperty(target, key, {
        configurable: true,
        value: null,
      });
      let ownKeyCalls = 0;
      const metadata = new Proxy(target, {
        ownKeys: () => {
          ownKeyCalls += 1;
          return ownKeyCalls === 1 ? [key] : [];
        },
      });
      await expectBuildError(withField("metadata", metadata), "INVALID_INPUT");
      expect(ownKeyCalls).toBe(1);
    },
  );

  it("rejects a transient non-plain prototype at graph inspection", async () => {
    let prototypeCalls = 0;
    const metadata = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          prototypeCalls += 1;
          return prototypeCalls === 1 ? Date.prototype : Object.prototype;
        },
      },
    );
    await expectBuildError(withField("metadata", metadata), "INVALID_INPUT");
    expect(prototypeCalls).toBe(1);
  });

  it("accepts the empirical depth boundary and rejects the next level", async () => {
    let acceptedInput: Record<string, unknown> = {};
    for (let index = 0; index < 94; index += 1) {
      acceptedInput = { nested: acceptedInput };
    }
    const messagesWith = (input: Readonly<Record<string, unknown>>) => [
      {
        role: "user",
        content: [
          {
            type: "tool_use",
            id: "deep-tool-use",
            name: "deep_tool",
            input,
          },
        ],
      },
    ];
    await expect(
      buildClaudeCodeRequest(
        withField("messages", messagesWith(acceptedInput)),
      ),
    ).resolves.toMatchObject({ method: "POST" });

    await expectBuildError(
      withField("messages", messagesWith({ nested: acceptedInput })),
      "INPUT_TOO_DEEP",
      { maximumDepth: 100 },
    );
  });

  it("rejects an oversized string at the graph-inspection boundary", async () => {
    await expectBuildError(
      withField("messages", [{ role: "user", content: "x".repeat(1_000_001) }]),
      "INPUT_TOO_LARGE",
    );
  });

  it("accepts exactly the graph size limit before later consumers see small metadata", async () => {
    const candidate = { ...validInput(), metadata: { padding: "" } };
    const paddingLength = 1_000_000 - graphSize(candidate);
    expect(paddingLength).toBeGreaterThan(0);
    const oversizedDuringInspection = {
      padding: "x".repeat(paddingLength),
    };
    expect(
      graphSize({ ...validInput(), metadata: oversizedDuringInspection }),
    ).toBe(1_000_000);

    const target = { ...validInput(), metadata: { source: "small" } };
    let metadataDescriptors = 0;
    const input = new Proxy(target, {
      getOwnPropertyDescriptor: (value, key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (key !== "metadata" || descriptor === undefined) return descriptor;
        metadataDescriptors += 1;
        return {
          ...descriptor,
          value:
            metadataDescriptors === 1
              ? oversizedDuringInspection
              : target.metadata,
        };
      },
    });
    await expect(
      buildClaudeCodeRequest(requestInput(input)),
    ).resolves.toMatchObject({ method: "POST" });
  });

  it("rejects transient oversized messages before later consumers see a small value", async () => {
    let messageDescriptors = 0;
    const target = { ...validInput() };
    const laterMessages = target.messages;
    const input = new Proxy(target, {
      getOwnPropertyDescriptor: (candidate, key) => {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
        if (key !== "messages" || descriptor === undefined) return descriptor;
        messageDescriptors += 1;
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value:
            messageDescriptors === 1
              ? [{ role: "user", content: "x".repeat(1_000_001) }]
              : laterMessages,
        };
      },
    });
    await expectBuildError(requestInput(input), "INPUT_TOO_LARGE");
    expect(messageDescriptors).toBe(1);
  });

  it("counts an oversized property name toward the graph size", async () => {
    const metadata: Record<string, unknown> = {
      ["k".repeat(1_000_001)]: null,
    };
    await expectBuildError(withField("metadata", metadata), "INPUT_TOO_LARGE");
  });

  it("counts array keys and primitive entries toward the graph size", async () => {
    const items = Array.from({ length: 140_000 }, () => null);
    await expectBuildError(
      withField("messages", [
        {
          role: "user",
          content: [
            {
              type: "tool_use",
              id: "large-tool-use",
              name: "large_tool",
              input: { items },
            },
          ],
        },
      ]),
      "INPUT_TOO_LARGE",
    );
  });

  it("rejects a cycle but accepts repeated inactive references", async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    await expectBuildError(withField("metadata", cyclic), "CYCLIC_INPUT");

    const shared = { type: "text", text: "shared" };
    const built = await buildClaudeCodeRequest(
      withField("messages", [{ role: "user", content: [shared, shared] }]),
    );
    expect(built.method).toBe("POST");
  });

  it("rejects accessors and missing descriptors without invoking getters", async () => {
    let getterCalls = 0;
    const accessor = { ...validInput() };
    Object.defineProperty(accessor, "model", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "claude-sonnet-4-5";
      },
    });
    await expectBuildError(requestInput(accessor), "INVALID_INPUT");
    expect(getterCalls).toBe(0);

    const missingDescriptor = new Proxy(
      {},
      {
        ownKeys: () => ["accessToken"],
        getOwnPropertyDescriptor: () => undefined,
      },
    );
    await expectBuildError(requestInput(missingDescriptor), "INVALID_INPUT");
  });

  // Wrap each case so Vitest passes array values as one callback argument.
  it.each([[null], [[]], ["input"], [42], [true]])(
    "rejects non-record top-level input %j",
    async (value) => {
      await expectBuildError(requestInput(value), "INVALID_INPUT");
    },
  );

  it.each([
    ["accessToken", 7],
    ["model", 7],
    ["messages", {}],
    ["clientRequestId", 7],
    ["clientRequestId", ""],
  ])("rejects malformed required field %s=%j", async (key, value) => {
    await expectBuildError(withField(key, value), "INVALID_INPUT");
  });

  it("rejects a token copied into every non-exempt input area", async () => {
    for (const [key, value] of [
      ["model", TOKEN],
      ["messages", [{ role: "user", content: TOKEN }]],
      ["metadata", { nested: [false, { secret: TOKEN }] }],
    ] as const) {
      await expectBuildError(withField(key, value), "INVALID_INPUT");
    }

    const crypto = { subtle: { digest: cryptoDigest } };
    const built = await buildClaudeCodeRequest(withField("crypto", crypto));
    expect(built.headers).toContainEqual(["authorization", `Bearer ${TOKEN}`]);
  });

  it("ignores a symbol-keyed token encountered only during leak scanning", async () => {
    const marker = Symbol("late-visible-token");
    const target: Record<PropertyKey, unknown> = {};
    Object.defineProperty(target, marker, {
      configurable: true,
      value: TOKEN,
    });
    let ownKeyCalls = 0;
    const metadata = new Proxy(target, {
      ownKeys: () => {
        ownKeyCalls += 1;
        return ownKeyCalls === 2 ? [marker] : [];
      },
    });
    const built = await buildClaudeCodeRequest(withField("metadata", metadata));
    expect(built.method).toBe("POST");
    expect(ownKeyCalls).toBeGreaterThanOrEqual(3);
  });

  it("accepts transient null metadata during leak scanning", async () => {
    let metadataDescriptors = 0;
    const target = { ...validInput(), metadata: { source: "valid later" } };
    const input = new Proxy(target, {
      getOwnPropertyDescriptor: (candidate, key) => {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
        if (key !== "metadata" || descriptor === undefined) return descriptor;
        metadataDescriptors += 1;
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: metadataDescriptors <= 2 ? null : target.metadata,
        };
      },
    });
    const built = await buildClaudeCodeRequest(requestInput(input));
    expect(built.method).toBe("POST");
    expect(metadataDescriptors).toBe(2);
  });

  it.each([
    null,
    "crypto",
    {},
    { subtle: null },
    { subtle: {} },
    { subtle: { digest: "not callable" } },
  ])("rejects malformed crypto provider %#", async (crypto) => {
    await expectBuildError(withField("crypto", crypto), "CRYPTO_UNAVAILABLE");
  });

  it("rejects accessor descriptors throughout a crypto provider", async () => {
    const subtleAccessor = {};
    Object.defineProperty(subtleAccessor, "subtle", { get: () => ({}) });
    await expectBuildError(
      withField("crypto", subtleAccessor),
      "CRYPTO_UNAVAILABLE",
    );

    const digestAccessor = {};
    Object.defineProperty(digestAccessor, "digest", {
      get: () => cryptoDigest,
    });
    await expectBuildError(
      withField("crypto", { subtle: digestAccessor }),
      "CRYPTO_UNAVAILABLE",
    );
  });

  it("rejects a crypto provider whose invalid subtle descriptor later reads valid", async () => {
    const target = {};
    Object.defineProperty(target, "subtle", {
      configurable: true,
      value: null,
    });
    const crypto = new Proxy(target, {
      get: (_candidate, key) =>
        key === "subtle" ? { digest: cryptoDigest } : undefined,
    });
    await expectBuildError(withField("crypto", crypto), "CRYPTO_UNAVAILABLE");
  });

  it("rejects a crypto provider whose invalid digest descriptor later reads callable", async () => {
    const subtleTarget = {};
    Object.defineProperty(subtleTarget, "digest", {
      configurable: true,
      value: "not callable",
    });
    const subtle = new Proxy(subtleTarget, {
      get: (_candidate, key) => (key === "digest" ? cryptoDigest : undefined),
    });
    await expectBuildError(
      withField("crypto", { subtle }),
      "CRYPTO_UNAVAILABLE",
    );
  });

  it("does not graph-inspect the validated crypto provider", async () => {
    const subtle = Object.create({ inherited: true }) as object;
    Object.defineProperty(subtle, "digest", {
      configurable: true,
      enumerable: true,
      value: cryptoDigest,
    });
    const built = await buildClaudeCodeRequest(withField("crypto", { subtle }));
    expect(built.method).toBe("POST");
  });

  it("rejects an unpinned profile and accepts the exported singleton", async () => {
    const clone = protocolProfile({ ...CLAUDE_CODE_2_1_195_PROFILE });
    await expect(
      buildClaudeCodeRequest(validInput(), clone),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      buildClaudeCodeRequest(validInput(), CLAUDE_CODE_2_1_195_PROFILE),
    ).resolves.toMatchObject({
      url: "https://api.anthropic.com/v1/messages?beta=true",
      method: "POST",
    });
  });

  it.each([
    ["thinking", "yes"],
    ["adaptiveThinking", 1],
    ["effort", "yes"],
    ["interleavedThinking", []],
  ])("rejects non-boolean capability %s", async (key, value) => {
    await expectBuildError(
      withField("capabilities", { [key]: value }),
      "UNSUPPORTED_CAPABILITY",
    );
  });

  it("reports unsupported capability without leaking unsafe details", async () => {
    const error = await expectBuildError(
      requestInput({
        ...validInput(),
        model: "claude-haiku-4-5",
        capabilities: { adaptiveThinking: true },
      }),
      "UNSUPPORTED_CAPABILITY",
    );
    expect(Object.keys(error.safeDetails)).toEqual([]);
    expect(error.safeDetails).toEqual({});

    const supported = await buildClaudeCodeRequest(
      requestInput({
        ...validInput(),
        model: "claude-opus-4-8",
        capabilities: { adaptiveThinking: true },
      }),
    );
    expect(supported.evidence.capabilityDecisions.adaptiveThinking).toBe(true);
  });

  it("preserves present capabilities and metadata in evidence construction", async () => {
    const built = await buildClaudeCodeRequest(
      requestInput({
        ...validInput(),
        capabilities: {
          thinking: false,
          adaptiveThinking: false,
          effort: false,
          interleavedThinking: false,
        },
        metadata: { source: "mutation" },
      }),
    );
    expect(built.evidence.capabilityDecisions).toEqual({
      thinking: false,
      adaptiveThinking: false,
      effort: false,
      interleavedThinking: false,
      maxEffort: false,
      xhighEffort: false,
      contextManagement: false,
      temperature: false,
      rejectsDisabledThinking: false,
    });
    expect(bodyRecord(built.body)["metadata"]).toBeDefined();
  });
});

function cryptoDigest(
  _algorithm: AlgorithmIdentifier,
  data: BufferSource,
): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(
    data instanceof ArrayBuffer ? data : data.buffer,
  );
  const digest = createHash("sha256").update(bytes).digest();
  return Promise.resolve(
    digest.buffer.slice(
      digest.byteOffset,
      digest.byteOffset + digest.byteLength,
    ),
  );
}

describe("build-request surviving parser mutants", () => {
  it("emits exact canonical top-level and evidence values", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    expect(Object.keys(built)).toEqual([
      "url",
      "method",
      "headers",
      "body",
      "evidence",
    ]);
    expect(built.url).toBe("https://api.anthropic.com/v1/messages?beta=true");
    expect(built.method).toBe("POST");
    expect(Object.keys(built.evidence)).toEqual([
      "profileId",
      "url",
      "method",
      "modelFamily",
      "logicalHeaderNames",
      "betaFeatures",
      "bodySha256",
      "bodyByteLength",
      "messageCount",
      "systemBlockCount",
      "capabilityDecisions",
    ]);
    expect(built.evidence).toMatchObject({
      profileId: "claude-code-2.1.195-sdk-0.94.0",
      url: "https://api.anthropic.com/v1/messages?beta=true",
      method: "POST",
      modelFamily: "sonnet",
      messageCount: 1,
      systemBlockCount: 1,
    });
    expect(built.evidence.logicalHeaderNames).toEqual(
      built.headers.map(([name]) => name),
    );
    expect(built.evidence.bodyByteLength).toBe(
      Buffer.byteLength(built.body, "utf8"),
    );
    expect(built.evidence.bodySha256).toBe(
      createHash("sha256").update(built.body, "utf8").digest("hex"),
    );
  });

  it("round-trips into an exact independent deeply frozen graph", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const parsed = parseBuiltClaudeCodeRequest(built);
    expect(parsed).toEqual(built);
    expect(parsed).not.toBe(built);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.headers)).toBe(true);
    expect(Object.isFrozen(parsed.headers[0])).toBe(true);
    expect(Object.isFrozen(parsed.evidence)).toBe(true);
    expect(Object.isFrozen(parsed.evidence.logicalHeaderNames)).toBe(true);
    expect(Object.isFrozen(parsed.evidence.capabilityDecisions)).toBe(true);
  });

  it("rejects an unpinned parser profile", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const clone = protocolProfile({ ...CLAUDE_CODE_2_1_195_PROFILE });
    expect(() => parseBuiltClaudeCodeRequest(built, clone)).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it.each([[null], [[]], ["built"], [1], [true]])(
    "rejects non-record built request %j",
    (value) => {
      expectParseError(value);
    },
  );

  it("rejects every unknown or forbidden top-level key", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseError({ ...built, unexpected: true });
    for (const key of ["__proto__", "prototype", "constructor"]) {
      const candidate = { ...built };
      Object.defineProperty(candidate, key, {
        configurable: true,
        enumerable: true,
        value: true,
      });
      expectParseError(candidate);
    }
  });

  it.each([
    ["url", "https://invalid.example/"],
    ["method", "GET"],
    ["body", 7],
  ])("rejects malformed top-level %s", async (key, value) => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseError(cloneBuilt(built, { [key]: value }));
  });

  it.each(["not json", "[]", "null", "1", '"string"'])(
    "rejects malformed or non-record body %j",
    async (body) => {
      const built = await buildClaudeCodeRequest(validInput());
      expectParseError(cloneBuilt(built, { body }));
    },
  );

  it.each([
    ["non-array", {}],
    ["non-array entry", [{}]],
    ["short entry", [["name"]]],
    ["long entry", [["name", "value", "extra"]]],
    ["non-string name", [[7, "value"]]],
    ["non-string value", [["name", 7]]],
  ])("rejects malformed headers: %s", async (_name, headers) => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseError(cloneBuilt(built, { headers }));
  });

  it("rejects an array-like header pair that would otherwise canonicalize", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const [name, value] = built.headers[0] ?? [];
    if (name === undefined || value === undefined) {
      throw new TypeError("Expected a canonical header.");
    }
    const headers: readonly unknown[] = [
      { 0: name, 1: value, length: 2 },
      ...built.headers.slice(1),
    ];
    expectParseError(cloneBuilt(built, { headers }));
  });

  it("rejects a canonical header pair carrying a third ignored item", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const headers = built.headers.map(([name, value], index) =>
      index === 0 ? [name, value, "ignored"] : [name, value],
    );
    expectParseError(cloneBuilt(built, { headers }));
  });

  it.each([0, 1] as const)(
    "rejects a transient non-string header member at index %i",
    async (memberIndex) => {
      const built = await buildClaudeCodeRequest(validInput());
      let reads = 0;
      const headers = built.headers.map(([name, value], index) => {
        if (index !== 0) return [name, value] as const;
        return new Proxy([name, value], {
          get: (target, key, receiver) => {
            if (key === String(memberIndex)) {
              reads += 1;
              if (reads === 1) return 7;
            }
            return reflectGet(target, key, receiver);
          },
        });
      });
      expectParseError(cloneBuilt(built, { headers }));
      expect(reads).toBe(1);
    },
  );

  it("rejects non-arrays even when a hidden map operation is canonical", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const canonicalMap = new Proxy(
      {},
      {
        get: (_target, key) =>
          key === "map" ? () => built.headers : undefined,
      },
    );
    expectParseError(cloneBuilt(built, { headers: canonicalMap }));

    const logicalNamesMap = new Proxy(
      {},
      {
        get: (_target, key) =>
          key === "map" ? () => built.evidence.logicalHeaderNames : undefined,
      },
    );
    expectParseError(
      cloneEvidence(built, { logicalHeaderNames: logicalNamesMap }),
    );
  });

  it("rejects absent, duplicate, reordered, and altered canonical headers", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const withoutSession = built.headers.filter(
      ([name]) => name !== "x-claude-code-session-id",
    );
    const duplicateSession: readonly HeaderPair[] = [
      ...built.headers,
      ["x-claude-code-session-id", SESSION_ID],
    ];
    const reordered = [...built.headers];
    const first = reordered[0];
    const second = reordered[1];
    if (first === undefined || second === undefined) {
      throw new TypeError("Expected canonical headers.");
    }
    reordered[0] = second;
    reordered[1] = first;
    for (const headers of [withoutSession, duplicateSession, reordered]) {
      expectParseError(cloneBuilt(built, { headers }));
    }
  });

  it("rejects a header list without the required timeout marker", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const headers = built.headers.filter(
      ([name]) => name !== "x-stainless-timeout",
    );
    expectParseError(cloneBuilt(built, { headers }));
  });

  it.each([
    ["profileId", "wrong-profile"],
    ["url", "https://invalid.example/"],
    ["method", "GET"],
    ["modelFamily", "invalid-family"],
    ["bodySha256", 7],
    ["bodySha256", `x${"0".repeat(64)}`],
    ["bodySha256", `${"0".repeat(64)}x`],
    ["bodySha256", "0".repeat(63)],
    ["bodySha256", "g".repeat(64)],
    ["bodyByteLength", "1"],
    ["bodyByteLength", Number.MAX_SAFE_INTEGER + 1],
    ["messageCount", "1"],
    ["messageCount", Number.MAX_SAFE_INTEGER + 1],
    ["systemBlockCount", "1"],
    ["systemBlockCount", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects malformed evidence %s=%j", async (key, value) => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseError(cloneEvidence(built, { [key]: value }));
  });

  it.each([
    ["logicalHeaderNames", {}],
    ["logicalHeaderNames", ["authorization", 7]],
    ["betaFeatures", {}],
    ["betaFeatures", [7]],
    ["capabilityDecisions", []],
    ["capabilityDecisions", { contextHint: true }],
    [
      "capabilityDecisions",
      {
        contextHint: true,
        adaptiveThinking: true,
        effort: true,
        interleavedThinking: true,
        extra: true,
      },
    ],
  ])("rejects malformed evidence collection %s", async (key, value) => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseError(cloneEvidence(built, { [key]: value }));
  });

  it.each(["contextHint", "adaptiveThinking", "effort", "interleavedThinking"])(
    "rejects non-boolean parsed capability %s",
    async (key) => {
      const built = await buildClaudeCodeRequest(validInput());
      expectParseError(
        cloneEvidence(built, {
          capabilityDecisions: {
            ...built.evidence.capabilityDecisions,
            [key]: "true",
          },
        }),
      );
    },
  );

  it("rejects unknown and forbidden evidence keys", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseError(cloneEvidence(built, { unexpected: true }));
    for (const key of ["__proto__", "prototype", "constructor"]) {
      const evidence = { ...built.evidence };
      Object.defineProperty(evidence, key, {
        configurable: true,
        enumerable: true,
        value: true,
      });
      expectParseError(cloneBuilt(built, { evidence }));
    }
  });

  it("rejects malformed body metadata and encoded identity", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const body = bodyRecord(built.body);
    for (const metadata of [null, [], {}, { user_id: 7 }]) {
      expectParseError(coherentBodyVariant(built, { ...body, metadata }));
    }
    for (const userId of ["not json", "[]", "null", '{"session_id":7}']) {
      expectParseError(
        coherentBodyVariant(built, {
          ...body,
          metadata: { user_id: userId },
        }),
      );
    }
  });

  it("rejects each independently inconsistent evidence measurement", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseError(
      cloneEvidence(built, {
        logicalHeaderNames: built.evidence.logicalHeaderNames.slice(1),
      }),
    );
    expectParseError(
      cloneEvidence(built, {
        logicalHeaderNames: built.evidence.logicalHeaderNames.map(
          (name, index) => (index === 0 ? "changed-name" : name),
        ),
      }),
    );
    expectParseError(
      cloneEvidence(built, {
        bodyByteLength: built.evidence.bodyByteLength + 1,
      }),
    );
    expectParseError(
      cloneEvidence(built, { messageCount: built.evidence.messageCount + 1 }),
    );
    expectParseError(
      cloneEvidence(built, {
        systemBlockCount: built.evidence.systemBlockCount + 1,
      }),
    );
    expectParseError(cloneEvidence(built, { bodySha256: "0".repeat(64) }));
  });

  it("rejects reordered headers even when evidence repeats that same order", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const headers = [...built.headers];
    const first = headers[0];
    const second = headers[1];
    if (first === undefined || second === undefined) {
      throw new TypeError("Expected at least two canonical headers.");
    }
    headers[0] = second;
    headers[1] = first;
    expectParseError(
      cloneBuilt(built, {
        headers,
        evidence: {
          ...built.evidence,
          logicalHeaderNames: headers.map(([name]) => name),
        },
      }),
    );
  });

  it("requires evidence to name every canonical header", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    expectParseError(
      cloneEvidence(built, {
        logicalHeaderNames: built.evidence.logicalHeaderNames.slice(0, -1),
      }),
    );
  });

  it("rejects a body/header session mismatch after all structural checks", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const body = bodyRecord(built.body);
    const metadata = body["metadata"];
    if (!isRecord(metadata) || typeof metadata["user_id"] !== "string") {
      throw new TypeError("Expected metadata identity.");
    }
    const identity = bodyRecord(metadata["user_id"]);
    expectParseError(
      coherentBodyVariant(built, {
        ...body,
        metadata: {
          ...metadata,
          user_id: JSON.stringify({
            ...identity,
            session_id: "different-session",
          }),
        },
      }),
    );
  });

  it("accepts internally consistent non-array messages and system sentinels", async () => {
    const built = await buildClaudeCodeRequest(validInput());
    const body = bodyRecord(built.body);
    const noMessages = coherentBodyVariant(
      built,
      { ...body, messages: null },
      { messageCount: -1 },
    );
    expect(parseBuiltClaudeCodeRequest(noMessages).evidence.messageCount).toBe(
      -1,
    );

    const noSystem = coherentBodyVariant(
      built,
      { ...body, system: null },
      { systemBlockCount: -1 },
    );
    expect(
      parseBuiltClaudeCodeRequest(noSystem).evidence.systemBlockCount,
    ).toBe(-1);
  });
});
