// SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

import { ClaudeCodeWireError } from "../../src/contracts.js";
import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
} from "../../src/contracts.js";
import {
  buildRedactedEvidence,
  toSafeErrorDetails,
} from "../../src/redaction.js";
import type { BuildRedactedEvidenceInput } from "../../src/redaction.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";

const ACCESS_TOKEN = "sentinel-token-redaction-4f21ab";
const HEADER_TOKEN = "sentinel-header-redaction-8c32de";
const BODY = "synthetic body";

function request(
  overrides: Partial<ClaudeCodeRequestInput> = {},
): ClaudeCodeRequestInput {
  return {
    accessToken: ACCESS_TOKEN,
    model: "claude-opus-4-8",
    maxTokens: 64,
    messages: [{ role: "user", content: "synthetic prompt" }],
    ...overrides,
  };
}

function input(
  overrides: Partial<BuildRedactedEvidenceInput> = {},
): BuildRedactedEvidenceInput {
  return {
    profile: CLAUDE_CODE_2_1_195_PROFILE,
    request: request(),
    modelFamily: "opus",
    logicalHeaders: [["authorization", `Bearer ${ACCESS_TOKEN}`]],
    betaFeatures: ["feature-2025-01-01"],
    body: BODY,
    ...overrides,
  };
}

function deterministicCrypto(
  bytes: Uint8Array = new Uint8Array(32),
): Pick<Crypto, "subtle"> {
  const provider = {
    subtle: {
      digest: (): Promise<ArrayBuffer> => Promise.resolve(bytes.buffer),
    },
  };
  return provider as unknown as Pick<Crypto, "subtle">;
}

function invalidInput(value: object): BuildRedactedEvidenceInput {
  // Intentional invalid-input fixture used to exercise the runtime boundary.
  return value as unknown as BuildRedactedEvidenceInput;
}

async function expectInvalid(value: BuildRedactedEvidenceInput): Promise<void> {
  await expect(
    buildRedactedEvidence(value, deterministicCrypto()),
  ).rejects.toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("redaction input validation", () => {
  it.each(["abc\ud800", "a\ud800b", "abc\udc00"])(
    "rejects malformed Unicode %j",
    async (body) => {
      await expect(
        buildRedactedEvidence(input({ body }), deterministicCrypto()),
      ).rejects.toThrow(expect.objectContaining({ code: "INVALID_UNICODE" }));
    },
  );

  it("rejects malformed Unicode in an object key", async () => {
    const malformed = input();
    Object.defineProperty(malformed, "\ud800x", {
      enumerable: true,
      value: true,
    });

    await expect(
      buildRedactedEvidence(malformed, deterministicCrypto()),
    ).rejects.toThrow(expect.objectContaining({ code: "INVALID_UNICODE" }));
  });

  it("accepts a valid Unicode surrogate pair", async () => {
    const evidence = await buildRedactedEvidence(
      input({ body: "safe-\ud83d\ude00" }),
      deterministicCrypto(),
    );
    expect(evidence.bodySha256).toBe("00".repeat(32));
  });

  it.each([Symbol("leaf"), 1n, (): void => undefined])(
    "rejects a non-object leaf",
    async (leaf) => {
      const malformed = input();
      Object.defineProperty(malformed, "leaf", {
        enumerable: true,
        value: leaf,
      });
      await expectInvalid(malformed);
    },
  );

  it("accepts a completed object when it is revisited", async () => {
    const shared = { safe: "value" };
    const malformed = input();
    Object.defineProperties(malformed, {
      first: { enumerable: true, value: shared },
      second: { enumerable: true, value: shared },
    });

    const evidence = await buildRedactedEvidence(
      malformed,
      deterministicCrypto(),
    );
    expect(evidence.bodySha256).toBe("00".repeat(32));
  });

  it("rejects a symbol own key", async () => {
    const malformed = input();
    Object.defineProperty(malformed, Symbol("unsafe"), {
      enumerable: true,
      value: true,
    });
    await expectInvalid(malformed);
  });

  it("rejects a property that disappears before descriptor lookup", async () => {
    const disappearing = new Proxy(
      {},
      {
        ownKeys: () => ["ghost"],
        getOwnPropertyDescriptor: () => undefined,
      },
    );
    const malformed = input();
    Object.defineProperty(malformed, "disappearing", {
      enumerable: true,
      value: disappearing,
    });
    await expectInvalid(malformed);
  });

  it("rejects accessor properties without reading the getter", async () => {
    const malformed = input();
    Object.defineProperty(malformed, "unsafe", {
      enumerable: true,
      get: () => ACCESS_TOKEN,
    });
    await expectInvalid(malformed);
  });

  it("converts unexpected traversal failures to REDACTION_FAILURE", async () => {
    const throwing = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error(ACCESS_TOKEN);
        },
      },
    );
    const malformed = input();
    Object.defineProperty(malformed, "throwing", {
      enumerable: true,
      value: throwing,
    });

    await expect(
      buildRedactedEvidence(malformed, deterministicCrypto()),
    ).rejects.toThrow(expect.objectContaining({ code: "REDACTION_FAILURE" }));
  });

  it("rejects objects with an unsupported prototype", async () => {
    const malformed = input();
    Object.defineProperty(malformed, "date", {
      enumerable: true,
      value: new Date(0),
    });
    await expectInvalid(malformed);
  });

  it("rejects a primitive profile at the evidence boundary", async () => {
    await expectInvalid(invalidInput({ ...input(), profile: null }));
  });

  it.each([
    { profile: { ...CLAUDE_CODE_2_1_195_PROFILE, id: "wrong-profile" } },
    {
      profile: { ...CLAUDE_CODE_2_1_195_PROFILE, endpoint: "https://invalid" },
    },
  ])("rejects a profile identity mismatch", async (overrides) => {
    await expectInvalid(
      input({ profile: overrides.profile as ClaudeCodeProtocolProfile }),
    );
  });

  it.each(["haiku", "sonnet"] as const)(
    "accepts the %s model family",
    async (modelFamily) => {
      const evidence = await buildRedactedEvidence(
        input({ modelFamily }),
        deterministicCrypto(),
      );
      expect(evidence.modelFamily).toBe(modelFamily);
    },
  );

  it("rejects an unknown model family", async () => {
    await expectInvalid(
      input({
        // Intentional invalid-input fixture used to exercise the runtime boundary.
        modelFamily: "unknown" as unknown as "opus",
      }),
    );
  });

  it.each([
    { logicalHeaders: "not-an-array" },
    { betaFeatures: "not-an-array" },
  ])("rejects non-array evidence collections", async (override) => {
    await expectInvalid(invalidInput({ ...input(), ...override }));
  });

  it.each([[], ["name"], ["name", "value", "extra"], "not-a-pair"])(
    "rejects a header that is not a two-element array",
    async (header) => {
      await expectInvalid(
        invalidInput({ ...input(), logicalHeaders: [header] }),
      );
    },
  );

  it.each([{ header: [1, "value"] }, { header: ["name", 1] }])(
    "rejects non-string header entries",
    async ({ header }) => {
      await expectInvalid(
        invalidInput({ ...input(), logicalHeaders: [header] }),
      );
    },
  );

  it("rejects a credential embedded in a header name", async () => {
    await expectInvalid(
      input({ logicalHeaders: [[`x-${ACCESS_TOKEN}`, "safe-value"]] }),
    );
  });

  it("rejects a credential embedded in a beta feature", async () => {
    await expectInvalid(input({ betaFeatures: [`feature-${ACCESS_TOKEN}`] }));
  });

  it("extracts an authorization credential without a separator", async () => {
    await expectInvalid(
      input({
        logicalHeaders: [
          ["authorization", HEADER_TOKEN],
          [`x-${HEADER_TOKEN}`, "safe-value"],
        ],
      }),
    );
  });

  it("extracts an authorization credential after a separator", async () => {
    await expectInvalid(
      input({
        logicalHeaders: [["authorization", `Bearer ${HEADER_TOKEN}`]],
        betaFeatures: [`feature-${HEADER_TOKEN}`],
      }),
    );
  });

  it("ignores empty credentials and preserves safe names exactly", async () => {
    const evidence = await buildRedactedEvidence(
      input({
        request: request({ accessToken: "" }),
        logicalHeaders: [["x-safe", "safe-value"]],
        betaFeatures: ["safe-feature"],
      }),
      deterministicCrypto(),
    );
    expect({
      logicalHeaderNames: evidence.logicalHeaderNames,
      betaFeatures: evidence.betaFeatures,
    }).toEqual({
      logicalHeaderNames: ["x-safe"],
      betaFeatures: ["safe-feature"],
    });
  });

  it("rejects a non-string body", async () => {
    await expectInvalid(
      invalidInput({ ...input(), body: { unsafe: ACCESS_TOKEN } }),
    );
  });
});

describe("redaction crypto validation", () => {
  it.each([null, 7])(
    "rejects a non-object crypto provider",
    async (provider) => {
      // Intentional invalid-input fixture used to exercise the runtime boundary.
      const invalidProvider = provider as unknown as Pick<Crypto, "subtle">;
      await expect(
        buildRedactedEvidence(input(), invalidProvider),
      ).rejects.toThrow(
        expect.objectContaining({ code: "CRYPTO_UNAVAILABLE" }),
      );
    },
  );

  it.each([null, 7, undefined])(
    "rejects a missing or invalid default crypto provider",
    async (provider) => {
      vi.stubGlobal("crypto", provider);
      await expect(buildRedactedEvidence(input())).rejects.toThrow(
        expect.objectContaining({ code: "CRYPTO_UNAVAILABLE" }),
      );
    },
  );

  it("rejects a crypto global whose getter throws", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      get: () => {
        throw new Error(ACCESS_TOKEN);
      },
    });
    try {
      await expect(buildRedactedEvidence(input())).rejects.toThrow(
        expect.objectContaining({ code: "CRYPTO_UNAVAILABLE" }),
      );
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(globalThis, "crypto");
      } else {
        Object.defineProperty(globalThis, "crypto", original);
      }
    }
  });

  it("rejects a crypto provider whose subtle lookup throws", async () => {
    const provider = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: () => undefined,
        get: () => {
          throw new Error(ACCESS_TOKEN);
        },
      },
    );
    // Intentional invalid-input fixture used to exercise the runtime boundary.
    const invalidProvider = provider as unknown as Pick<Crypto, "subtle">;
    await expect(
      buildRedactedEvidence(input(), invalidProvider),
    ).rejects.toThrow(expect.objectContaining({ code: "CRYPTO_UNAVAILABLE" }));
  });

  it("accepts a provider with inherited subtle crypto", async () => {
    const subtle = deterministicCrypto().subtle;
    const provider = Object.create({ subtle }) as object;
    // Deterministic provider fixture with an inherited Web Crypto surface.
    const inheritedProvider = provider as unknown as Pick<Crypto, "subtle">;
    const evidence = await buildRedactedEvidence(input(), inheritedProvider);
    expect(evidence.bodySha256).toBe("00".repeat(32));
  });

  it.each([null, 3])(
    "rejects a provider with an invalid subtle value",
    async (subtle) => {
      // Intentional invalid-input fixture used to exercise the runtime boundary.
      const provider = { subtle } as unknown as Pick<Crypto, "subtle">;
      await expect(buildRedactedEvidence(input(), provider)).rejects.toThrow(
        expect.objectContaining({ code: "CRYPTO_UNAVAILABLE" }),
      );
    },
  );

  it.each([
    {
      request: request({ system: [{ type: "text", text: "safe" }] }),
      count: 1,
    },
    { request: request(), count: 0 },
  ])(
    "reports digest failures without sensitive data",
    async ({ request, count }) => {
      const provider = {
        subtle: {
          digest: (): Promise<ArrayBuffer> =>
            Promise.reject(new Error(ACCESS_TOKEN)),
        },
      } as unknown as Pick<Crypto, "subtle">;

      const pending = buildRedactedEvidence(input({ request }), provider);
      await expect(pending).rejects.toThrow(
        expect.objectContaining({ code: "REDACTION_FAILURE" }),
      );
      await expect(pending).rejects.toMatchObject({
        safeDetails: { systemBlockCount: count },
      });
    },
  );

  it("rejects a digest whose byte length is not 32", async () => {
    const pending = buildRedactedEvidence(
      input(),
      deterministicCrypto(new Uint8Array(31)),
    );
    await expect(pending).rejects.toThrow(
      expect.objectContaining({ code: "REDACTION_FAILURE" }),
    );
    await expect(pending).rejects.toMatchObject({
      safeDetails: { systemBlockCount: 0 },
    });
  });
});

describe("safe error detail validation", () => {
  it("returns no details for an unknown value", () => {
    expect(toSafeErrorDetails({ code: "INVALID_INPUT" })).toEqual({});
  });

  it("rejects an unknown error code", () => {
    // Intentional invalid-input fixture used to exercise the runtime boundary.
    const code = "UNSAFE_CODE" as unknown as "INVALID_INPUT";
    expect(toSafeErrorDetails(new ClaudeCodeWireError(code))).toEqual({});
  });

  it("rejects a non-string error code", () => {
    const error = new ClaudeCodeWireError("INVALID_INPUT");
    Object.defineProperty(error, "code", { configurable: true, value: 7 });
    expect(toSafeErrorDetails(error)).toEqual({});
  });

  it("rejects inaccessible error properties", () => {
    const error = new ClaudeCodeWireError("INVALID_INPUT");
    Object.defineProperty(error, "safeDetails", {
      configurable: true,
      get: () => ({ bodyByteLength: 10 }),
    });
    expect(toSafeErrorDetails(error)).toEqual({});
  });

  it.each([null, "unsafe"])(
    "rejects non-object safe details",
    (safeDetails) => {
      const error = new ClaudeCodeWireError("INVALID_INPUT");
      Object.defineProperty(error, "safeDetails", {
        configurable: true,
        value: safeDetails,
      });
      expect(toSafeErrorDetails(error)).toEqual({ code: "INVALID_INPUT" });
    },
  );

  it("copies only finite numeric and boolean allowlist details", () => {
    const error = new ClaudeCodeWireError("INVALID_INPUT", {
      bodyByteLength: 12,
      messageCount: Number.POSITIVE_INFINITY,
      systemBlockCount: "not-a-number",
      logicalHeaderCount: 2,
      betaFeatureCount: 3,
      maximumDepth: 100,
      maximumSize: 1_000_000,
      hasSystem: true,
      hasTools: "not-a-boolean",
      unsafe: ACCESS_TOKEN,
    });

    expect(toSafeErrorDetails(error)).toEqual({
      code: "INVALID_INPUT",
      bodyByteLength: 12,
      logicalHeaderCount: 2,
      betaFeatureCount: 3,
      maximumDepth: 100,
      maximumSize: 1_000_000,
      hasSystem: true,
    });
  });

  it("reads boolean details and ignores accessor allowlist entries", () => {
    const safeDetails = { hasTools: false, messageCount: 1 };
    Object.defineProperty(safeDetails, "bodyByteLength", {
      enumerable: true,
      get: () => 99,
    });
    const error = new ClaudeCodeWireError("REDACTION_FAILURE");
    Object.defineProperty(error, "safeDetails", {
      configurable: true,
      value: safeDetails,
    });

    expect(toSafeErrorDetails(error)).toEqual({
      code: "REDACTION_FAILURE",
      messageCount: 1,
      hasTools: false,
    });
  });
});
