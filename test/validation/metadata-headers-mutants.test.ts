// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";

import { ClaudeCodeWireError } from "../../src/contracts.js";
import type {
  ClaudeCodeRuntimeIdentity,
  SystemInput,
  TextBlock,
} from "../../src/contracts.js";
import { buildOrderedHeaders } from "../../src/headers.js";
import {
  buildCorrelatedMetadata,
  validateRuntimeIdentity,
} from "../../src/metadata.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
import { buildCanonicalSystem } from "../../src/system-prompt.js";

const identity = {
  sessionId: "session-123",
  deviceId: "device-456",
  accountUuid: "account-789",
  runtime: "node",
  runtimeVersion: "22.14.0",
  os: "Windows",
  arch: "x64",
} satisfies ClaudeCodeRuntimeIdentity;

const billingBlock = Object.freeze({
  type: "text",
  text: "Billing is enabled.",
}) satisfies TextBlock;

function expectWireError(
  action: () => unknown,
  code: ClaudeCodeWireError["code"],
): ClaudeCodeWireError {
  try {
    action();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ClaudeCodeWireError);
    if (!(error instanceof ClaudeCodeWireError)) throw error;
    expect(error.code).toBe(code);
    return error;
  }
  throw new Error(`Expected ClaudeCodeWireError with code ${code}`);
}

function headerInput(extraHeaders: unknown = []): unknown {
  return {
    accessToken: "token-secret",
    runtime: identity,
    clientRequestId: "request-abc",
    betaFeatures: ["beta-one", "beta-two"],
    extraHeaders,
    profile: CLAUDE_CODE_2_1_195_PROFILE,
  };
}

function isSystemInputArray(value: unknown): value is readonly SystemInput[] {
  return Array.isArray(value);
}

function systemInput(value: unknown): readonly SystemInput[] {
  if (!isSystemInputArray(value)) throw new TypeError("Expected an array");
  return value;
}

function nestedSystemInput(maximumDepth: number): readonly SystemInput[] {
  let extra: unknown = "leaf";
  for (let depth = maximumDepth; depth > 2; depth -= 1) {
    extra = { x: extra };
  }
  return systemInput([{ type: "text", text: "prompt", extra }]);
}

describe("metadata mutation boundaries", () => {
  it("enforces every correlation key after a fresh module initialization", async () => {
    vi.resetModules();
    const metadataModule = await import("../../src/metadata.js");
    const contractsModule = await import("../../src/contracts.js");

    for (const key of ["user_id", "device_id", "account_uuid", "session_id"]) {
      try {
        metadataModule.buildCorrelatedMetadata(identity, { [key]: "wrong" });
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(contractsModule.ClaudeCodeWireError);
        if (!(error instanceof contractsModule.ClaudeCodeWireError))
          throw error;
        expect(error.code).toBe("INVALID_INPUT");
        continue;
      }
      throw new Error(`Expected INVALID_INPUT for ${key}`);
    }
  });

  it("builds the exact user_id-only metadata object when none is supplied", () => {
    expect(buildCorrelatedMetadata(identity)).toStrictEqual({
      user_id:
        '{"device_id":"device-456","account_uuid":"account-789","session_id":"session-123"}',
    });
  });

  it("serializes the exact correlated user id with stable key order", () => {
    const metadata = buildCorrelatedMetadata(identity, {
      device_id: identity.deviceId,
      account_uuid: identity.accountUuid,
      session_id: identity.sessionId,
      user_id:
        '{"device_id":"device-456","account_uuid":"account-789","session_id":"session-123"}',
      custom: true,
    });

    expect(metadata).toStrictEqual({
      user_id:
        '{"device_id":"device-456","account_uuid":"account-789","session_id":"session-123"}',
      device_id: "device-456",
      account_uuid: "account-789",
      session_id: "session-123",
      custom: true,
    });
    expect(Object.keys(metadata)).toStrictEqual([
      "user_id",
      "device_id",
      "account_uuid",
      "session_id",
      "custom",
    ]);
  });

  it.each([
    ["user_id", "wrong"],
    ["device_id", "wrong"],
    ["account_uuid", "wrong"],
    ["session_id", "wrong"],
  ])("rejects a mismatched %s correlation value", (key, value) => {
    const error = expectWireError(
      () => buildCorrelatedMetadata(identity, { [key]: value }),
      "INVALID_INPUT",
    );
    expect(error.safeDetails).toStrictEqual({ field: key });
  });

  it.each(["node", "bun", "workerd"])(
    "accepts the supported %s runtime boundary",
    (runtime) => {
      expect(validateRuntimeIdentity({ ...identity, runtime }).runtime).toBe(
        runtime,
      );
    },
  );

  it("rejects an unsupported runtime with a specific field diagnostic", () => {
    const error = expectWireError(
      () => validateRuntimeIdentity({ ...identity, runtime: "deno" }),
      "INVALID_IDENTITY",
    );
    expect(error.safeDetails).toStrictEqual({ field: "runtime" });
  });

  it.each(["Windows", "Linux", "macOS"])(
    "accepts the supported %s operating system boundary",
    (os) => {
      expect(validateRuntimeIdentity({ ...identity, os }).os).toBe(os);
    },
  );

  it("rejects an unsupported operating system with a specific field diagnostic", () => {
    const error = expectWireError(
      () => validateRuntimeIdentity({ ...identity, os: "FreeBSD" }),
      "INVALID_IDENTITY",
    );
    expect(error.safeDetails).toStrictEqual({ field: "os" });
  });

  it.each([
    ["os", { ...identity, os: "" }],
    ["arch", { ...identity, arch: "" }],
  ])("identifies an invalid %s field exactly", (field, candidate) => {
    const error = expectWireError(
      () => validateRuntimeIdentity(candidate),
      "INVALID_IDENTITY",
    );
    expect(error.safeDetails).toStrictEqual({ field });
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["unit separator", "bad\u001fvalue"],
    ["delete", "bad\u007fvalue"],
  ])("rejects %s identity text", (_label, sessionId) => {
    const error = expectWireError(
      () => validateRuntimeIdentity({ ...identity, sessionId }),
      "INVALID_IDENTITY",
    );
    expect(error.safeDetails).toStrictEqual({ field: "sessionId" });
  });

  it("accepts identity text at 8192 code units and rejects 8193", () => {
    expect(
      validateRuntimeIdentity({ ...identity, runtimeVersion: "v".repeat(8192) })
        .runtimeVersion,
    ).toHaveLength(8192);
    const error = expectWireError(
      () =>
        validateRuntimeIdentity({
          ...identity,
          runtimeVersion: "v".repeat(8193),
        }),
      "INVALID_IDENTITY",
    );
    expect(error.safeDetails).toStrictEqual({ field: "runtimeVersion" });
  });

  it.each([
    ["trailing high surrogate", "bad\ud800"],
    ["maximum high surrogate", "bad\udbff"],
    ["high surrogate followed by ASCII", "bad\ud800a"],
    [
      "high surrogate followed above the low-surrogate range",
      "bad\ud800\ue000",
    ],
    ["minimum low surrogate", "bad\udc00"],
    ["maximum low surrogate", "bad\udfff"],
  ])("rejects %s in identity text", (_label, sessionId) => {
    const error = expectWireError(
      () => validateRuntimeIdentity({ ...identity, sessionId }),
      "INVALID_UNICODE",
    );
    expect(error.safeDetails).toStrictEqual({ field: "sessionId" });
  });

  it.each(["\ud800\udc00", "\udbff\udfff"])(
    "accepts a valid surrogate pair %s",
    (sessionId) => {
      expect(
        validateRuntimeIdentity({ ...identity, sessionId }).sessionId,
      ).toBe(sessionId);
    },
  );

  it("accepts a BMP code unit immediately above the surrogate range", () => {
    expect(
      validateRuntimeIdentity({ ...identity, sessionId: "\ue000" }).sessionId,
    ).toBe("\ue000");
  });

  it("reports a missing identity data property as INVALID_IDENTITY", () => {
    const missingRuntime = {
      sessionId: identity.sessionId,
      deviceId: identity.deviceId,
      accountUuid: identity.accountUuid,
      runtimeVersion: identity.runtimeVersion,
      os: identity.os,
      arch: identity.arch,
    };
    const error = expectWireError(
      () => validateRuntimeIdentity(missingRuntime),
      "INVALID_IDENTITY",
    );
    expect(error.safeDetails).toStrictEqual({ field: "runtime" });
  });

  it("does not invoke identity accessors", () => {
    let getterInvoked = false;
    const accessorIdentity = { ...identity };
    Object.defineProperty(accessorIdentity, "runtime", {
      get() {
        getterInvoked = true;
        return "node";
      },
      enumerable: true,
    });

    const error = expectWireError(
      () => validateRuntimeIdentity(accessorIdentity),
      "INVALID_IDENTITY",
    );
    expect(error.safeDetails).toStrictEqual({ field: "runtime" });
    expect(getterInvoked).toBe(false);
  });

  it("accepts metadata keys and values at 8192 and rejects 8193", () => {
    const keyAtLimit = "k".repeat(8192);
    const valueAtLimit = "v".repeat(8192);
    expect(
      buildCorrelatedMetadata(identity, { [keyAtLimit]: true }),
    ).toHaveProperty(keyAtLimit, true);
    expect(
      buildCorrelatedMetadata(identity, { custom: valueAtLimit }).custom,
    ).toBe(valueAtLimit);

    expectWireError(
      () => buildCorrelatedMetadata(identity, { ["k".repeat(8193)]: true }),
      "INPUT_TOO_LARGE",
    );
    expectWireError(
      () => buildCorrelatedMetadata(identity, { custom: "v".repeat(8193) }),
      "INPUT_TOO_LARGE",
    );
  });
});

describe("header mutation boundaries", () => {
  it("returns the exact canonical 17-pair logical header sequence", () => {
    expect(buildOrderedHeaders(headerInput())).toStrictEqual([
      ["anthropic-beta", "beta-one,beta-two"],
      ["anthropic-dangerous-direct-browser-access", "true"],
      ["anthropic-version", "2023-06-01"],
      ["authorization", "Bearer token-secret"],
      ["content-type", "application/json"],
      ["user-agent", "claude-cli/2.1.195 (external, cli)"],
      ["x-app", "cli"],
      ["x-claude-code-session-id", "session-123"],
      ["x-client-request-id", "request-abc"],
      ["x-stainless-arch", "x64"],
      ["x-stainless-lang", "js"],
      ["x-stainless-os", "Windows"],
      ["x-stainless-package-version", "0.94.0"],
      ["x-stainless-retry-count", "0"],
      ["x-stainless-runtime", "node"],
      ["x-stainless-runtime-version", "22.14.0"],
      ["x-stainless-timeout", "600"],
    ]);
  });

  it.each([
    "x-api-key",
    "cookie",
    "set-cookie",
    "proxy-authorization",
    "forwarded",
    "x-forwarded-for",
  ])("rejects forbidden header %s with its normalized diagnostic", (name) => {
    const error = expectWireError(
      () => buildOrderedHeaders(headerInput([[name.toUpperCase(), "value"]])),
      "FORBIDDEN_HEADER",
    );
    expect(error.safeDetails).toStrictEqual({ headerName: name });
  });

  it("redacts an access token embedded in a forbidden header name", () => {
    const error = expectWireError(
      () =>
        buildOrderedHeaders(
          headerInput([["proxy-token-secret-suffix", "value"]]),
        ),
      "FORBIDDEN_HEADER",
    );
    expect(error.safeDetails).toStrictEqual({ headerName: "[redacted]" });
  });

  it("rejects canonical duplicates case-insensitively", () => {
    const error = expectWireError(
      () => buildOrderedHeaders(headerInput([["Content-Type", "text/plain"]])),
      "DUPLICATE_HEADER",
    );
    expect(error.safeDetails).toStrictEqual({ headerName: "content-type" });
  });

  it("rejects duplicate custom headers with the normalized name", () => {
    const error = expectWireError(
      () =>
        buildOrderedHeaders(
          headerInput([
            ["X-Custom", "one"],
            ["x-custom", "two"],
          ]),
        ),
      "DUPLICATE_HEADER",
    );
    expect(error.safeDetails).toStrictEqual({ headerName: "x-custom" });
  });

  it("accepts a unique custom header without changing canonical output", () => {
    expect(
      buildOrderedHeaders(headerInput([["x-custom", "value"]])),
    ).toHaveLength(17);
  });

  it("rejects an empty required runtime string", () => {
    expectWireError(
      () =>
        buildOrderedHeaders({
          ...headerInput(),
          runtime: { ...identity, arch: "" },
        }),
      "INVALID_INPUT",
    );
  });

  it("rejects non-record input with a wire error", () => {
    expectWireError(() => buildOrderedHeaders(null), "INVALID_INPUT");
  });

  it.each(["\u001f", "\u007f", "\u009f"])(
    "rejects control code point %s in a header value",
    (value) => {
      expectWireError(
        () => buildOrderedHeaders(headerInput([["x-custom", value]])),
        "HEADER_INJECTION",
      );
    },
  );

  it.each(["\u00a0", "é", "😀"])(
    "accepts non-control Unicode %s in a header value",
    (value) => {
      expect(
        buildOrderedHeaders(headerInput([["x-custom", value]])),
      ).toHaveLength(17);
    },
  );
});

describe("system prompt mutation boundaries", () => {
  it("returns exact canonical blocks and exact cache-control objects", () => {
    const input = [
      "ordinary prompt",
      { type: "text", text: "cached", cache_control: { type: "ephemeral" } },
    ];

    expect(buildCanonicalSystem(input, billingBlock, identity)).toStrictEqual([
      { type: "text", text: "Billing is enabled." },
      {
        type: "text",
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
        cache_control: { type: "ephemeral", ttl: "1h" },
      },
      { type: "text", text: "ordinary prompt" },
      {
        type: "text",
        text: "cached",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("rejects a primitive cache_control with INVALID_INPUT", () => {
    expectWireError(
      () =>
        buildCanonicalSystem(
          systemInput([
            { type: "text", text: "prompt", cache_control: "ephemeral" },
          ]),
          billingBlock,
          identity,
        ),
      "INVALID_INPUT",
    );
  });

  it("rejects null cache_control with INVALID_INPUT", () => {
    expectWireError(
      () =>
        buildCanonicalSystem(
          systemInput([{ type: "text", text: "prompt", cache_control: null }]),
          billingBlock,
          identity,
        ),
      "INVALID_INPUT",
    );
  });

  it.each(["5m", "1h"])("preserves the accepted cache ttl %s", (ttl) => {
    const cacheControl =
      ttl === "5m"
        ? ({ type: "ephemeral", ttl } as const)
        : ({ type: "ephemeral", ttl } as const);
    expect(
      buildCanonicalSystem(
        [{ type: "text", text: "cached", cache_control: cacheControl }],
        billingBlock,
        identity,
      )[2],
    ).toStrictEqual({
      type: "text",
      text: "cached",
      cache_control: { type: "ephemeral", ttl },
    });
  });

  it.each(["\u0000", "\u0001", "\u000b", "\u001f", "\u007f", "\u009f"])(
    "rejects control code unit %s in prompt text",
    (text) => {
      expectWireError(
        () => buildCanonicalSystem([text], billingBlock, identity),
        "INVALID_UNICODE",
      );
    },
  );

  it.each(["\t", "\n", "\r", "\u00a0"])(
    "accepts permitted whitespace or Unicode %s",
    (text) => {
      expect(
        buildCanonicalSystem([text], billingBlock, identity)[2]?.text,
      ).toBe(text);
    },
  );

  it.each(["\ud800", "\udbff", "\ud800a", "\ud800\ue000", "\udc00", "\udfff"])(
    "rejects isolated surrogate %s",
    (text) => {
      expectWireError(
        () => buildCanonicalSystem([text], billingBlock, identity),
        "INVALID_UNICODE",
      );
    },
  );

  it.each(["\ud800\udc00", "\udbff\udfff"])(
    "accepts valid surrogate pair %s",
    (text) => {
      expect(
        buildCanonicalSystem([text], billingBlock, identity)[2]?.text,
      ).toBe(text);
    },
  );

  it("accepts a BMP code unit immediately above the surrogate range", () => {
    expect(
      buildCanonicalSystem(["\ue000"], billingBlock, identity)[2]?.text,
    ).toBe("\ue000");
  });

  it("accepts depth 64 and rejects depth 65", () => {
    expect(
      buildCanonicalSystem(nestedSystemInput(64), billingBlock, identity),
    ).toHaveLength(3);
    expectWireError(
      () => buildCanonicalSystem(nestedSystemInput(65), billingBlock, identity),
      "INPUT_TOO_DEEP",
    );
  });

  it("accepts total string size 1,000,000 and rejects 1,000,001", () => {
    const textAtLimit = "x".repeat(999_981);
    expect(
      buildCanonicalSystem(
        [{ type: "text", text: textAtLimit }],
        billingBlock,
        identity,
      )[2]?.text,
    ).toHaveLength(999_981);
    expectWireError(
      () =>
        buildCanonicalSystem(
          [{ type: "text", text: `${textAtLimit}x` }],
          billingBlock,
          identity,
        ),
      "INPUT_TOO_LARGE",
    );
  });

  it("applies the exact size boundary when the final input member is text", () => {
    const atLimit: unknown[] = [{ type: "text", text: "prompt" }];
    Object.defineProperty(atLimit, "tail", {
      value: "x".repeat(999_971),
      enumerable: true,
    });
    expect(
      buildCanonicalSystem(systemInput(atLimit), billingBlock, identity),
    ).toHaveLength(3);

    const overLimit: unknown[] = [{ type: "text", text: "prompt" }];
    Object.defineProperty(overLimit, "tail", {
      value: "x".repeat(999_972),
      enumerable: true,
    });
    expectWireError(
      () =>
        buildCanonicalSystem(systemInput(overLimit), billingBlock, identity),
      "INPUT_TOO_LARGE",
    );
  });

  it("counts property-key size at the exact input-size boundary", () => {
    const blockAtLimit: Record<PropertyKey, unknown> = {
      type: "text",
      text: "prompt",
    };
    blockAtLimit["k".repeat(999_975)] = true;
    expect(
      buildCanonicalSystem(systemInput([blockAtLimit]), billingBlock, identity),
    ).toHaveLength(3);

    const blockOverLimit: Record<PropertyKey, unknown> = {
      type: "text",
      text: "prompt",
    };
    blockOverLimit["k".repeat(999_976)] = true;
    expectWireError(
      () =>
        buildCanonicalSystem(
          systemInput([blockOverLimit]),
          billingBlock,
          identity,
        ),
      "INPUT_TOO_LARGE",
    );
  });

  it("accepts symbol-keyed extension data without treating the symbol as text", () => {
    const extension = Symbol("extension");
    const block: Record<PropertyKey, unknown> = {
      type: "text",
      text: "prompt",
      [extension]: "value",
    };
    expect(
      buildCanonicalSystem(systemInput([block]), billingBlock, identity)[2],
    ).toStrictEqual({ type: "text", text: "prompt" });
  });

  it("still enforces input size inside symbol-keyed extension data", () => {
    const extension = Symbol("extension");
    const block: Record<PropertyKey, unknown> = {
      type: "text",
      text: "prompt",
      [extension]: "x".repeat(1_000_000),
    };
    expectWireError(
      () => buildCanonicalSystem(systemInput([block]), billingBlock, identity),
      "INPUT_TOO_LARGE",
    );
  });
});

describe("profile deep immutability", () => {
  it("freezes nested model records, alias arrays, and alias elements", () => {
    const model =
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-8"];
    expect(model).toBeDefined();
    if (model === undefined) throw new TypeError("Expected pinned model");

    expect(Object.isFrozen(CLAUDE_CODE_2_1_195_PROFILE)).toBe(true);
    expect(Object.isFrozen(CLAUDE_CODE_2_1_195_PROFILE.supportedModels)).toBe(
      true,
    );
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.aliases)).toBe(true);
    expect(Object.isFrozen(model.aliases[0])).toBe(true);
    expect(Reflect.set(model.aliases, 0, "changed")).toBe(false);
    expect(model.aliases[0]).toBe("opus-4-8");
  });
});
