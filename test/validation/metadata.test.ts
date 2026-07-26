// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  ClaudeCodeWireError,
  type ClaudeCodeRuntimeIdentity,
  type JsonPrimitive,
} from "../../src/contracts.js";
import {
  buildCorrelatedMetadata,
  validateRuntimeIdentity,
} from "../../src/metadata.js";

const IDENTITY: ClaudeCodeRuntimeIdentity = {
  sessionId: "session-validation-synthetic",
  deviceId: "device-validation-synthetic",
  accountUuid: "account-validation-synthetic",
  runtime: "node",
  runtimeVersion: "22.0.0",
  os: "Windows",
  arch: "x64",
};

function identityWith(
  field: keyof ClaudeCodeRuntimeIdentity,
  value: unknown,
): object {
  return { ...IDENTITY, [field]: value };
}

function invalidMetadataValue(
  value: unknown,
): Readonly<Record<string, JsonPrimitive>> {
  // This cast deliberately passes an invalid-input fixture through the public type.
  return { invalid: value } as unknown as Readonly<
    Record<string, JsonPrimitive>
  >;
}

function expectWireError(
  action: () => unknown,
  code: ClaudeCodeWireError["code"],
  field?: string,
): void {
  let thrown: unknown;
  try {
    action();
  } catch (error: unknown) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(ClaudeCodeWireError);
  if (!(thrown instanceof ClaudeCodeWireError)) {
    throw new Error(`Expected ClaudeCodeWireError with code ${code}`);
  }
  expect(thrown.code).toBe(code);
  if (field !== undefined) expect(thrown.safeDetails["field"]).toBe(field);
}

describe("metadata validation paths", () => {
  it.each([
    ["sessionId", 17],
    ["deviceId", null],
    ["accountUuid", undefined],
  ] as const)("rejects a non-string %s identity field", (field, value) => {
    expectWireError(
      () => validateRuntimeIdentity(identityWith(field, value)),
      "INVALID_IDENTITY",
      field,
    );
  });

  it.each([
    ["high surrogate before a non-low surrogate", `before\ud800xafter`],
    ["unpaired low surrogate", `before\udc00after`],
  ])("rejects invalid UTF-16 in an identity field: %s", (_label, value) => {
    expectWireError(
      () => validateRuntimeIdentity(identityWith("sessionId", value)),
      "INVALID_UNICODE",
      "sessionId",
    );
  });

  it.each([17, null, []])("rejects a non-record identity: %j", (identity) => {
    expectWireError(
      () => validateRuntimeIdentity(identity),
      "INVALID_IDENTITY",
    );
  });

  it("rejects symbol and forbidden own identity keys", () => {
    const withSymbol = { ...IDENTITY, [Symbol("invalid")]: "synthetic" };
    const withConstructor = Object.defineProperty(
      { ...IDENTITY },
      "constructor",
      { enumerable: true, value: "synthetic" },
    );

    for (const identity of [withSymbol, withConstructor]) {
      expectWireError(
        () => validateRuntimeIdentity(identity),
        "INVALID_IDENTITY",
      );
    }
  });

  it("treats an accessor identity property as missing without invoking it", () => {
    const identity = Object.defineProperty({ ...IDENTITY }, "sessionId", {
      enumerable: true,
      get: () => {
        throw new Error("identity getter must not execute");
      },
    });

    expectWireError(
      () => validateRuntimeIdentity(identity),
      "INVALID_IDENTITY",
      "sessionId",
    );
  });

  it.each([
    ["bun", "Linux"],
    ["workerd", "macOS"],
  ] as const)("accepts the supported %s runtime on %s", (runtime, os) => {
    expect(validateRuntimeIdentity({ ...IDENTITY, runtime, os })).toMatchObject(
      {
        runtime,
        os,
      },
    );
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects forbidden metadata key %s",
    (key) => {
      const supplied = Object.defineProperty({}, key, {
        enumerable: true,
        value: "synthetic",
      });

      expectWireError(
        () => buildCorrelatedMetadata(IDENTITY, supplied),
        "INVALID_INPUT",
      );
    },
  );

  it("rejects a symbol metadata key", () => {
    const supplied = { [Symbol("invalid")]: "synthetic" };

    expectWireError(
      () => buildCorrelatedMetadata(IDENTITY, supplied),
      "INVALID_INPUT",
    );
  });

  it("rejects invalid UTF-16 in a metadata key", () => {
    expectWireError(
      () =>
        buildCorrelatedMetadata(IDENTITY, {
          [`invalid\ud800x`]: "synthetic",
        }),
      "INVALID_UNICODE",
      "metadataKey",
    );
  });

  it("rejects an oversized metadata key", () => {
    expectWireError(
      () =>
        buildCorrelatedMetadata(IDENTITY, {
          ["k".repeat(8_193)]: "synthetic",
        }),
      "INPUT_TOO_LARGE",
      "metadataKey",
    );
  });

  it.each([
    ["empty", ""],
    ["control character", "invalid\u0000key"],
  ])("rejects a metadata key that is %s", (_label, key) => {
    expectWireError(
      () => buildCorrelatedMetadata(IDENTITY, { [key]: "synthetic" }),
      "INVALID_INPUT",
      "metadataKey",
    );
  });

  it("rejects invalid UTF-16 in a metadata string value", () => {
    expectWireError(
      () => buildCorrelatedMetadata(IDENTITY, { trace: `before\udc00after` }),
      "INVALID_UNICODE",
      "trace",
    );
  });

  it("rejects an oversized metadata string value", () => {
    expectWireError(
      () => buildCorrelatedMetadata(IDENTITY, { trace: "v".repeat(8_193) }),
      "INPUT_TOO_LARGE",
      "trace",
    );
  });

  it("rejects a control character in a metadata string value", () => {
    expectWireError(
      () => buildCorrelatedMetadata(IDENTITY, { trace: "invalid\u007fvalue" }),
      "INVALID_UNICODE",
      "trace",
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite metadata number %s",
    (value) => {
      expectWireError(
        () => buildCorrelatedMetadata(IDENTITY, { metric: value }),
        "INVALID_INPUT",
        "metric",
      );
    },
  );

  it("preserves finite numbers, booleans, null, and valid strings", () => {
    const metadata = buildCorrelatedMetadata(IDENTITY, {
      count: 17,
      enabled: true,
      absent: null,
      trace: "synthetic",
    });

    expect(metadata).toMatchObject({
      count: 17,
      enabled: true,
      absent: null,
      trace: "synthetic",
    });
  });

  it("rejects a non-plain object metadata value", () => {
    expectWireError(
      () =>
        buildCorrelatedMetadata(IDENTITY, invalidMetadataValue(new Date(0))),
      "INVALID_INPUT",
    );
  });

  it.each([
    ["symbol", Symbol("invalid")],
    ["undefined", undefined],
    ["bigint", 1n],
    ["function", () => "invalid"],
  ])("rejects an unsupported %s metadata value", (_label, value) => {
    expectWireError(
      () => buildCorrelatedMetadata(IDENTITY, invalidMetadataValue(value)),
      "INVALID_INPUT",
      "invalid",
    );
  });

  it.each([17, null, []])(
    "rejects non-record supplied metadata: %j",
    (value) => {
      // This cast deliberately passes an invalid-input fixture through the public type.
      const supplied = value as unknown as Readonly<
        Record<string, JsonPrimitive>
      >;

      expectWireError(
        () => buildCorrelatedMetadata(IDENTITY, supplied),
        "INVALID_INPUT",
        "metadata",
      );
    },
  );

  it("treats an accessor metadata value as unsupported without invoking it", () => {
    const supplied = Object.defineProperty({}, "trace", {
      enumerable: true,
      get: () => {
        throw new Error("metadata getter must not execute");
      },
    });

    expectWireError(
      () => buildCorrelatedMetadata(IDENTITY, supplied),
      "INVALID_INPUT",
      "trace",
    );
  });

  it("accepts matching correlation values and skips a duplicate user_id", () => {
    const userId = JSON.stringify({
      device_id: IDENTITY.deviceId,
      account_uuid: IDENTITY.accountUuid,
      session_id: IDENTITY.sessionId,
    });
    const metadata = buildCorrelatedMetadata(IDENTITY, {
      user_id: userId,
      device_id: IDENTITY.deviceId,
      account_uuid: IDENTITY.accountUuid,
      session_id: IDENTITY.sessionId,
      trace: "synthetic",
    });

    expect(metadata).toEqual({
      user_id: userId,
      device_id: IDENTITY.deviceId,
      account_uuid: IDENTITY.accountUuid,
      session_id: IDENTITY.sessionId,
      trace: "synthetic",
    });
    expect(
      Object.keys(metadata).filter((key) => key === "user_id"),
    ).toHaveLength(1);
  });

  it("rejects a supplied correlation value that conflicts with identity", () => {
    expectWireError(
      () =>
        buildCorrelatedMetadata(IDENTITY, {
          device_id: "conflicting-synthetic",
        }),
      "INVALID_INPUT",
      "device_id",
    );
  });
});
