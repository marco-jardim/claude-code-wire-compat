// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeWireErrorCode,
} from "../../src/contracts.js";
import { ClaudeCodeWireError } from "../../src/contracts.js";
import {
  createBillingBlock,
  createBillingFingerprint,
} from "../../src/fingerprint.js";
import {
  buildRedactedEvidence,
  toSafeErrorDetails,
  type BuildRedactedEvidenceInput,
} from "../../src/redaction.js";
import { sha256Hex } from "../../src/sha256.js";

const PROFILE_ID = "claude-code-2.1.195-sdk-0.94.0";
const ENDPOINT = "https://api.anthropic.com/v1/messages?beta=true";
const MAX_INPUT_SIZE = 1_000_000;
const TOKEN = "sentinel-secret-token";
let freshImportSequence = 0;

interface RedactionModule {
  readonly buildRedactedEvidence: typeof buildRedactedEvidence;
  readonly toSafeErrorDetails: typeof toSafeErrorDetails;
}

interface FingerprintModule {
  readonly createBillingBlock: typeof createBillingBlock;
  readonly createBillingFingerprint: typeof createBillingFingerprint;
}

interface Sha256Module {
  readonly sha256Hex: typeof sha256Hex;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

async function freshModule(modulePath: string): Promise<unknown> {
  freshImportSequence += 1;
  return import(
    /* @vite-ignore */ `${modulePath}?mutation-test=${String(freshImportSequence)}`
  );
}

async function freshRedaction(): Promise<RedactionModule> {
  const loaded = await freshModule("../../src/redaction.js");
  if (
    !isRecord(loaded) ||
    typeof loaded["buildRedactedEvidence"] !== "function" ||
    typeof loaded["toSafeErrorDetails"] !== "function"
  ) {
    throw new TypeError("Invalid redaction module");
  }
  return {
    buildRedactedEvidence: loaded["buildRedactedEvidence"],
    toSafeErrorDetails: loaded["toSafeErrorDetails"],
  };
}

async function freshFingerprint(): Promise<FingerprintModule> {
  const loaded = await freshModule("../../src/fingerprint.js");
  if (
    !isRecord(loaded) ||
    typeof loaded["createBillingBlock"] !== "function" ||
    typeof loaded["createBillingFingerprint"] !== "function"
  ) {
    throw new TypeError("Invalid fingerprint module");
  }
  return {
    createBillingBlock: loaded["createBillingBlock"],
    createBillingFingerprint: loaded["createBillingFingerprint"],
  };
}

async function freshSha256(): Promise<Sha256Module> {
  const loaded = await freshModule("../../src/sha256.js");
  if (!isRecord(loaded) || typeof loaded["sha256Hex"] !== "function") {
    throw new TypeError("Invalid SHA-256 module");
  }
  return { sha256Hex: loaded["sha256Hex"] };
}

function profile(): ClaudeCodeProtocolProfile {
  return {
    id: PROFILE_ID,
    cliVersion: "2.1.195",
    sdkVersion: "0.94.0",
    endpoint: ENDPOINT,
    entrypoint: "cli",
    userAgent: "claude-cli/2.1.195 (external, sdk-cli)",
    buildTime: "2026-01-01T00:00:00.000Z",
    gitSha: "validation",
    attributionHeaderEnabled: false,
    provider: "anthropic",
    anthropicVersion: "2023-06-01",
    defaultCapabilities: {
      contextHint: true,
      adaptiveThinking: true,
      effort: true,
      interleavedThinking: true,
    },
    supportedModels: {},
    orderedBetas: [],
  };
}

function redactionInput(token = TOKEN): BuildRedactedEvidenceInput {
  return {
    profile: profile(),
    request: {
      accessToken: token,
      model: "claude-sonnet-4-5-20250929",
      maxTokens: 128,
      messages: [{ role: "user", content: "hello" }],
      system: [{ type: "text", text: "system" }],
      runtime: {
        sessionId: "session",
        deviceId: "device",
        accountUuid: "account",
        runtime: "node",
        runtimeVersion: "22.0.0",
        os: "Windows",
        arch: "x64",
      },
      metadata: { nestedCredential: token },
    },
    modelFamily: "sonnet",
    logicalHeaders: [
      ["content-type", "application/json"],
      ["authorization", `Bearer ${token}`],
      ["x-secret-bearing-value", token],
    ],
    betaFeatures: ["feature-a"],
    body: JSON.stringify({ prompt: token }),
  };
}

function addOwnValue(
  target: object,
  key: PropertyKey,
  value: unknown,
  enumerable = true,
): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable,
    writable: true,
    value,
  });
}

async function expectWireRejection(
  operation: () => Promise<unknown>,
  code: ClaudeCodeWireErrorCode,
  safeDetails?: Readonly<Record<string, string | number | boolean>>,
): Promise<void> {
  let caught: unknown;
  try {
    await operation();
  } catch (error: unknown) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ClaudeCodeWireError);
  if (!(caught instanceof ClaudeCodeWireError)) {
    throw new TypeError("Expected ClaudeCodeWireError");
  }
  expect(caught.code).toBe(code);
  if (safeDetails !== undefined)
    expect(caught.safeDetails).toEqual(safeDetails);
}

function cryptoWithDigest(
  digest: SubtleCrypto["digest"],
): Pick<Crypto, "subtle"> {
  const subtle = new Proxy(globalThis.crypto.subtle, {
    get(target, property, receiver): unknown {
      return property === "digest"
        ? digest
        : Reflect.get(target, property, receiver);
    },
  });
  return { subtle };
}

function rejectingDigest(): Promise<ArrayBuffer> {
  return Promise.reject(new Error("digest failed"));
}

function shortDigest(): Promise<ArrayBuffer> {
  return Promise.resolve(new Uint8Array(31).buffer);
}

function nullPrototypeRecord(): object {
  const value: unknown = Object.setPrototypeOf({ safe: "value" }, null);
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Expected an object with a null prototype");
  }
  return value;
}

function measureGraph(value: unknown, completed = new Set<object>()): number {
  const encoder = new TextEncoder();
  if (typeof value === "string") return encoder.encode(value).byteLength;
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return 1;
  }
  if (typeof value !== "object") throw new TypeError("Unsupported test value");
  if (completed.has(value)) return 0;
  completed.add(value);
  const keys = Reflect.ownKeys(value);
  let size = keys.length;
  for (const key of keys) {
    if (typeof key !== "string") throw new TypeError("Unsupported test key");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor !== undefined &&
      descriptor.enumerable &&
      "value" in descriptor
    ) {
      size += encoder.encode(key).byteLength;
      size += measureGraph(descriptor.value, completed);
    }
  }
  return size;
}

function sizedInput(extraBytes: number): BuildRedactedEvidenceInput {
  const input = redactionInput();
  const shared = { marker: "shared-completed-node" };
  addOwnValue(input, "sharedOne", shared);
  addOwnValue(input, "sharedTwo", shared);
  addOwnValue(input, "undefinedValue", undefined);
  addOwnValue(input, "padding", "");
  const paddingLength = MAX_INPUT_SIZE - measureGraph(input) + extraBytes;
  expect(paddingLength).toBeGreaterThan(0);
  addOwnValue(input, "padding", "x".repeat(paddingLength));
  return input;
}

function depthInput(depth: number): BuildRedactedEvidenceInput {
  const input = redactionInput();
  let branch: object = {};
  for (let index = 1; index < depth; index += 1) branch = { next: branch };
  addOwnValue(input, "depthBoundary", branch);
  return input;
}

describe("redaction mutation boundaries", () => {
  it("reports an invalid digest length with exact safe details", async () => {
    const input = redactionInput();
    const bodyByteLength = new TextEncoder().encode(input.body).byteLength;

    await expectWireRejection(
      () => buildRedactedEvidence(input, cryptoWithDigest(shortDigest)),
      "REDACTION_FAILURE",
      {
        bodyByteLength,
        messageCount: 1,
        systemBlockCount: 1,
      },
    );
  });

  it("emits exact ordered evidence while omitting credentials from every source", async () => {
    const redaction = await freshRedaction();
    const evidence = await redaction.buildRedactedEvidence(redactionInput());

    expect(Object.keys(evidence)).toEqual([
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
    expect(evidence).toMatchObject({
      profileId: PROFILE_ID,
      url: ENDPOINT,
      method: "POST",
      modelFamily: "sonnet",
      logicalHeaderNames: [
        "content-type",
        "authorization",
        "x-secret-bearing-value",
      ],
      betaFeatures: ["feature-a"],
      messageCount: 1,
      systemBlockCount: 1,
      capabilityDecisions: {
        contextHint: true,
        adaptiveThinking: true,
        effort: true,
        interleavedThinking: true,
      },
    });
    expect(JSON.stringify(evidence)).not.toContain(TOKEN);
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects the forbidden own key %s",
    async (key) => {
      const redaction = await freshRedaction();
      const input = redactionInput();
      addOwnValue(input, key, "value");
      await expectWireRejection(
        () => redaction.buildRedactedEvidence(input),
        "INVALID_INPUT",
      );
    },
  );

  it.each([
    ["\udbff\udc00", true],
    ["\udbff\udfff", true],
    ["\udbff\ue000", false],
    ["\udfff", false],
    ["\udbff", false],
  ] as const)("enforces UTF-16 boundary %j", async (body, accepted) => {
    const input = redactionInput();
    addOwnValue(input, "body", body);
    if (accepted) {
      const evidence = await buildRedactedEvidence(input);
      expect(evidence.bodyByteLength).toBe(4);
    } else {
      await expectWireRejection(
        () => buildRedactedEvidence(input),
        "INVALID_UNICODE",
      );
    }
  });

  it("accepts depth 100 and rejects depth 101 with exact safe details", async () => {
    await expect(buildRedactedEvidence(depthInput(100))).resolves.toMatchObject(
      {
        modelFamily: "sonnet",
      },
    );
    await expectWireRejection(
      () => buildRedactedEvidence(depthInput(101)),
      "INPUT_TOO_DEEP",
      { maximumDepth: 100 },
    );
  });

  it("accepts exactly 1,000,000 measured bytes and rejects one more", async () => {
    await expect(buildRedactedEvidence(sizedInput(0))).resolves.toMatchObject({
      modelFamily: "sonnet",
    });
    await expectWireRejection(
      () => buildRedactedEvidence(sizedInput(1)),
      "INPUT_TOO_LARGE",
      { maximumSize: MAX_INPUT_SIZE },
    );
  });

  it("rejects cycles, symbols, custom prototypes, accessors, and missing descriptors", async () => {
    const cyclic = redactionInput();
    addOwnValue(cyclic, "cycle", cyclic);
    await expectWireRejection(
      () => buildRedactedEvidence(cyclic),
      "CYCLIC_INPUT",
    );

    const symbolValue = redactionInput();
    addOwnValue(symbolValue, "symbolValue", Symbol("invalid"));
    await expectWireRejection(
      () => buildRedactedEvidence(symbolValue),
      "INVALID_INPUT",
    );

    const symbolKey = redactionInput();
    addOwnValue(symbolKey, Symbol("invalid"), "value");
    await expectWireRejection(
      () => buildRedactedEvidence(symbolKey),
      "INVALID_INPUT",
    );

    const customPrototype = redactionInput();
    addOwnValue(customPrototype, "date", new Date(0));
    await expectWireRejection(
      () => buildRedactedEvidence(customPrototype),
      "INVALID_INPUT",
    );

    const accessor = redactionInput();
    Object.defineProperty(accessor, "getter", {
      configurable: true,
      enumerable: true,
      get: () => "must-not-run",
    });
    await expectWireRejection(
      () => buildRedactedEvidence(accessor),
      "INVALID_INPUT",
    );

    const absentDescriptor = new Proxy(
      {},
      {
        ownKeys: () => ["missing"],
        getOwnPropertyDescriptor: () => undefined,
      },
    );
    const missing = redactionInput();
    addOwnValue(missing, "absentDescriptor", absentDescriptor);
    await expectWireRejection(
      () => buildRedactedEvidence(missing),
      "INVALID_INPUT",
    );
  });

  it("accepts null-prototype and ignores non-enumerable property values", async () => {
    const input = redactionInput();
    const nullPrototype = nullPrototypeRecord();
    addOwnValue(input, "nullPrototype", nullPrototype);
    addOwnValue(input, "hiddenInvalidValue", Symbol("ignored"), false);
    const evidence = await buildRedactedEvidence(input);
    expect(evidence.modelFamily).toBe("sonnet");
  });

  it("accepts a normal BMP boundary and rejects a low-surrogate pair", async () => {
    const bmp = redactionInput();
    addOwnValue(bmp, "body", "\ue000");
    await expect(buildRedactedEvidence(bmp)).resolves.toMatchObject({
      bodyByteLength: 3,
    });

    const lowPair = redactionInput();
    addOwnValue(lowPair, "body", "\udc00\udc00");
    await expectWireRejection(
      () => buildRedactedEvidence(lowPair),
      "INVALID_UNICODE",
    );
  });

  it("rejects callable non-object leaves before observing their prototype", async () => {
    const callable = new Proxy(() => undefined, {
      getPrototypeOf: () => {
        throw new Error("prototype must not be observed");
      },
    });
    const input = redactionInput();
    addOwnValue(input, "callable", callable);
    await expectWireRejection(
      () => buildRedactedEvidence(input),
      "INVALID_INPUT",
    );
  });

  it("rejects missing required own source properties as INVALID_INPUT", async () => {
    const input = redactionInput();
    expect(Reflect.deleteProperty(input, "profile")).toBe(true);
    await expectWireRejection(
      () => buildRedactedEvidence(input),
      "INVALID_INPUT",
    );
  });

  it("rejects malformed header tuples and non-string header members", async () => {
    for (const logicalHeaders of [
      [["only-name"]],
      [[7, "value"]],
      [["name", 7]],
    ]) {
      const input = redactionInput();
      addOwnValue(input, "logicalHeaders", logicalHeaders);
      await expectWireRejection(
        () => buildRedactedEvidence(input),
        "INVALID_INPUT",
      );
    }
  });

  it("rejects a credential appearing in a header name or beta feature", async () => {
    const headerName = redactionInput();
    addOwnValue(headerName, "logicalHeaders", [
      ["authorization", `Bearer ${TOKEN}`],
      [`x-${TOKEN}`, "safe"],
    ]);
    await expectWireRejection(
      () => buildRedactedEvidence(headerName),
      "INVALID_INPUT",
    );

    const beta = redactionInput();
    addOwnValue(beta, "betaFeatures", [`feature-${TOKEN}`]);
    await expectWireRejection(
      () => buildRedactedEvidence(beta),
      "INVALID_INPUT",
    );

    const separatorBoundary = redactionInput("unused-access-token");
    addOwnValue(separatorBoundary, "logicalHeaders", [
      ["authorization", "X token-after-one-character"],
    ]);
    addOwnValue(separatorBoundary, "betaFeatures", [
      "token-after-one-character",
    ]);
    await expectWireRejection(
      () => buildRedactedEvidence(separatorBoundary),
      "INVALID_INPUT",
    );
  });

  it("does not treat non-authorization header values as credentials", async () => {
    const input = redactionInput("access-token");
    addOwnValue(input, "logicalHeaders", [
      ["authorization", "Bearer access-token"],
      ["x-not-authorization", "X accidental-credential"],
    ]);
    addOwnValue(input, "betaFeatures", ["accidental-credential"]);
    await expect(buildRedactedEvidence(input)).resolves.toMatchObject({
      betaFeatures: ["accidental-credential"],
    });
  });

  it("distinguishes crypto validation and digest failures by exact code", async () => {
    const malformed: Pick<Crypto, "subtle"> = {
      subtle: globalThis.crypto.subtle,
    };
    addOwnValue(malformed, "subtle", null);
    await expectWireRejection(
      () => buildRedactedEvidence(redactionInput(), malformed),
      "CRYPTO_UNAVAILABLE",
    );

    const rejecting = cryptoWithDigest(rejectingDigest);
    await expectWireRejection(
      () => buildRedactedEvidence(redactionInput(), rejecting),
      "REDACTION_FAILURE",
      { bodyByteLength: 34, messageCount: 1, systemBlockCount: 1 },
    );

    const shortDigestProvider = cryptoWithDigest(shortDigest);
    await expectWireRejection(
      () => buildRedactedEvidence(redactionInput(), shortDigestProvider),
      "REDACTION_FAILURE",
      { bodyByteLength: 34, messageCount: 1, systemBlockCount: 1 },
    );
  });
});

describe("safe redaction error details", () => {
  const safeCodes: readonly ClaudeCodeWireErrorCode[] = [
    "INVALID_INPUT",
    "INVALID_IDENTITY",
    "UNSUPPORTED_MODEL",
    "UNSUPPORTED_CAPABILITY",
    "INVALID_THINKING",
    "INVALID_EFFORT",
    "FORBIDDEN_HEADER",
    "DUPLICATE_HEADER",
    "HEADER_INJECTION",
    "INVALID_UNICODE",
    "INPUT_TOO_DEEP",
    "INPUT_TOO_LARGE",
    "CYCLIC_INPUT",
    "CRYPTO_UNAVAILABLE",
    "REDACTION_FAILURE",
  ];

  it.each(safeCodes)("preserves the exact allow-listed code %s", (code) => {
    return freshRedaction().then((redaction) => {
      const details = redaction.toSafeErrorDetails(
        new ClaudeCodeWireError(code),
      );
      expect(details).toEqual({ code });
      expect(Object.keys(details)).toEqual(["code"]);
    });
  });

  it("returns exact ordered primitive-safe details and filters everything else", () => {
    const error = new ClaudeCodeWireError("REDACTION_FAILURE", {
      hasTools: false,
      maximumSize: 1_000_000,
      bodyByteLength: 34,
      hasSystem: true,
      messageCount: 1,
      maximumDepth: 100,
      systemBlockCount: 1,
      logicalHeaderCount: 3,
      betaFeatureCount: 1,
      ignoredString: TOKEN,
      ignoredInfinity: Number.POSITIVE_INFINITY,
    });
    const details = toSafeErrorDetails(error);
    expect(details).toEqual({
      code: "REDACTION_FAILURE",
      bodyByteLength: 34,
      messageCount: 1,
      systemBlockCount: 1,
      logicalHeaderCount: 3,
      betaFeatureCount: 1,
      maximumDepth: 100,
      maximumSize: 1_000_000,
      hasSystem: true,
      hasTools: false,
    });
    expect(Object.keys(details)).toEqual([
      "code",
      "bodyByteLength",
      "messageCount",
      "systemBlockCount",
      "logicalHeaderCount",
      "betaFeatureCount",
      "maximumDepth",
      "maximumSize",
      "hasSystem",
      "hasTools",
    ]);
    expect(JSON.stringify(details)).not.toContain(TOKEN);
  });

  it("rejects lookalikes and malformed error fields", () => {
    expect(
      toSafeErrorDetails({
        code: "REDACTION_FAILURE",
        safeDetails: { bodyByteLength: 34 },
      }),
    ).toEqual({});

    const invalidCode = new ClaudeCodeWireError("INVALID_INPUT");
    addOwnValue(invalidCode, "code", "NOT_ALLOW_LISTED");
    expect(toSafeErrorDetails(invalidCode)).toEqual({});

    const invalidDetails = new ClaudeCodeWireError("INVALID_INPUT");
    addOwnValue(invalidDetails, "safeDetails", "not-an-object");
    expect(toSafeErrorDetails(invalidDetails)).toEqual({
      code: "INVALID_INPUT",
    });
  });
});

describe("billing fingerprint mutation vectors", () => {
  it.each([
    ["hello wire compat", "0f6"],
    ["canary probe", "12f"],
    ["offline cch probe", "7fe"],
  ] as const)("matches the known answer for %s", async (text, expected) => {
    const fingerprint = await freshFingerprint();
    await expect(
      fingerprint.createBillingFingerprint(text, "2.1.195"),
    ).resolves.toBe(expected);
  });

  it.each(["", "a", "abcd", "abcde", "abcdefgh"])(
    "uses literal zero fallbacks at missing text indexes for %j",
    async (text) => {
      const material = `59cf53e54c78${text[4] ?? "0"}${text[7] ?? "0"}${text[20] ?? "0"}2.1.195`;
      const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(material),
      );
      const expected = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      )
        .join("")
        .slice(0, 3);
      await expect(createBillingFingerprint(text, "2.1.195")).resolves.toBe(
        expected,
      );
    },
  );

  it("emits the exact billing block without cache control", async () => {
    const fingerprint = await freshFingerprint();
    const block = await fingerprint.createBillingBlock(
      "hello wire compat",
      "2.1.195",
    );
    expect(block).toEqual({
      type: "text",
      text: "x-anthropic-billing-header: cc_version=2.1.195.0f6; cc_entrypoint=cli; cch=00000;",
    });
    expect(Object.keys(block)).toEqual(["type", "text"]);
    expect("cache_control" in block).toBe(false);
  });
});

describe("synchronous SHA-256 mutation vectors", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "a".repeat(55),
      "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318",
    ],
    [
      "a".repeat(56),
      "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a",
    ],
    [
      "a".repeat(64),
      "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
    ],
    [
      "The quick brown fox jumps over the lazy dog",
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    ],
  ])("matches a known SHA-256 vector", (value, expected) => {
    expect(sha256Hex(value)).toBe(expected);
    return freshSha256().then((sha256) => {
      expect(sha256.sha256Hex(value)).toBe(expected);
    });
  });
});
