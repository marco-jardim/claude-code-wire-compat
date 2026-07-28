// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Consumer seam S4: `metadataOverrides`.
 *
 * Two structurally different consumer mechanisms are covered:
 *
 *  - `userId` replaces the derived `metadata.user_id` verbatim, for a host that
 *    carries an opaque identifier of its own.
 *  - `userIdFields` merges extra members INTO the derived `user_id` JSON object,
 *    with the correlation triple written last so it always wins.
 *
 * Both are opt-in. With the seam omitted, a divergent `metadata.user_id` keeps
 * failing with `INVALID_INPUT`, which is the correlation guard this package
 * exists to enforce.
 */

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeMetadataOverrides,
  ClaudeCodeRequestInput,
} from "../../src/index.js";
import {
  ClaudeCodeWireError,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import { buildCorrelatedMetadata } from "../../src/metadata.js";

const BASE: ClaudeCodeRequestInput = {
  accessToken: "metadata-overrides-token",
  model: "claude-sonnet-4-6",
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello wire compat" }],
  runtime: {
    sessionId: "11111111-1111-4111-8111-111111111111",
    deviceId: "22222222-2222-4222-8222-222222222222",
    accountUuid: "33333333-3333-4333-8333-333333333333",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "metadata-overrides-request-1",
};

const DERIVED_USER_ID = JSON.stringify({
  device_id: BASE.runtime.deviceId,
  account_uuid: BASE.runtime.accountUuid,
  session_id: BASE.runtime.sessionId,
});

function bodyMetadata(body: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body);
  const metadata = (parsed as { metadata?: unknown }).metadata;
  if (metadata === null || typeof metadata !== "object") {
    throw new Error("expected a metadata object in the body");
  }
  return metadata as Record<string, unknown>;
}

async function expectRejection(
  input: ClaudeCodeRequestInput,
  code: ClaudeCodeWireError["code"] = "INVALID_INPUT",
): Promise<void> {
  let thrown: unknown;
  try {
    await buildClaudeCodeRequest(input);
  } catch (error: unknown) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(ClaudeCodeWireError);
  if (!(thrown instanceof ClaudeCodeWireError)) {
    throw new Error(`Expected ClaudeCodeWireError with code ${code}`);
  }
  expect(thrown.code).toBe(code);
}

/** Passes an invalid-input fixture through the public type on purpose. */
function withOverrides(value: unknown): ClaudeCodeRequestInput {
  return { ...BASE, metadataOverrides: value } as ClaudeCodeRequestInput;
}

describe("metadataOverrides.userId seam", () => {
  it("emits the derived user_id when the seam is omitted", async () => {
    const built = await buildClaudeCodeRequest(BASE);

    expect(bodyMetadata(built.body)["user_id"]).toBe(DERIVED_USER_ID);
  });

  it("replaces the derived user_id verbatim", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      metadataOverrides: { userId: "host-supplied-opaque-user-id" },
    });

    expect(bodyMetadata(built.body)["user_id"]).toBe(
      "host-supplied-opaque-user-id",
    );
  });

  it("accepts a supplied metadata.user_id equal to the override", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      metadata: { user_id: "host-supplied-opaque-user-id", tier: "pro" },
      metadataOverrides: { userId: "host-supplied-opaque-user-id" },
    });
    const metadata = bodyMetadata(built.body);

    expect(metadata["user_id"]).toBe("host-supplied-opaque-user-id");
    expect(metadata["tier"]).toBe("pro");
  });

  it("still rejects a supplied metadata.user_id that diverges from the override", async () => {
    await expectRejection({
      ...BASE,
      metadata: { user_id: "some-other-identifier" },
      metadataOverrides: { userId: "host-supplied-opaque-user-id" },
    });
  });

  it("keeps the other correlation keys pinned to the runtime identity", async () => {
    await expectRejection({
      ...BASE,
      metadata: { session_id: "not-the-session" },
      metadataOverrides: { userId: "host-supplied-opaque-user-id" },
    });
  });
});

describe("metadataOverrides.userIdFields seam", () => {
  it("merges extra members into the user_id JSON object", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      metadataOverrides: { userIdFields: { org: "acme", seat: 7 } },
    });

    expect(bodyMetadata(built.body)["user_id"]).toBe(
      JSON.stringify({
        org: "acme",
        seat: 7,
        device_id: BASE.runtime.deviceId,
        account_uuid: BASE.runtime.accountUuid,
        session_id: BASE.runtime.sessionId,
      }),
    );
  });

  it("accepts a supplied metadata.user_id equal to the merged value", async () => {
    const merged = JSON.stringify({
      org: "acme",
      device_id: BASE.runtime.deviceId,
      account_uuid: BASE.runtime.accountUuid,
      session_id: BASE.runtime.sessionId,
    });
    const built = await buildClaudeCodeRequest({
      ...BASE,
      metadata: { user_id: merged },
      metadataOverrides: { userIdFields: { org: "acme" } },
    });

    expect(bodyMetadata(built.body)["user_id"]).toBe(merged);
  });

  it("rejects a supplied metadata.user_id that diverges from the merged value", async () => {
    await expectRejection({
      ...BASE,
      metadata: { user_id: DERIVED_USER_ID },
      metadataOverrides: { userIdFields: { org: "acme" } },
    });
  });

  it.each(["device_id", "account_uuid", "session_id"])(
    "rejects the correlation key %s instead of silently overwriting it",
    async (key) => {
      await expectRejection({
        ...BASE,
        metadataOverrides: { userIdFields: { [key]: "attacker-supplied" } },
      });
    },
  );

  it("survives a round trip through parseBuiltClaudeCodeRequest", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      metadataOverrides: { userIdFields: { org: "acme" } },
    });

    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });
});

describe("buildCorrelatedMetadata override defences", () => {
  /* `buildClaudeCodeRequest` rejects these shapes earlier, in `inspectGraph`
   * and in the input key check. The module keeps its own guards so the
   * correlation rules do not depend on a caller's validation order. */
  function overridesOf(value: unknown): ClaudeCodeMetadataOverrides {
    return value as ClaudeCodeMetadataOverrides;
  }

  function expectWireError(
    action: () => unknown,
    code: ClaudeCodeWireError["code"],
    field: string,
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
    expect(thrown.safeDetails["field"]).toBe(field);
  }

  it.each([null, "userId", [], 42])(
    "rejects a non-object overrides value",
    (value) => {
      expectWireError(
        () =>
          buildCorrelatedMetadata(BASE.runtime, undefined, overridesOf(value)),
        "INVALID_INPUT",
        "metadataOverrides",
      );
    },
  );

  it("rejects a lone surrogate in the override userId", () => {
    expectWireError(
      () =>
        buildCorrelatedMetadata(
          BASE.runtime,
          undefined,
          overridesOf({ userId: "user\uD800id" }),
        ),
      "INVALID_UNICODE",
      "userId",
    );
  });

  it("rejects a control character in the override userId", () => {
    expectWireError(
      () =>
        buildCorrelatedMetadata(
          BASE.runtime,
          undefined,
          overridesOf({ userId: "user\u0007id" }),
        ),
      "INVALID_UNICODE",
      "userId",
    );
  });

  it("keeps the derived user_id when both members are absent", () => {
    expect(buildCorrelatedMetadata(BASE.runtime, undefined, {})).toEqual({
      user_id: DERIVED_USER_ID,
    });
  });
});

describe("metadataOverrides correlation consequences", () => {
  it("keeps parseBuiltClaudeCodeRequest strict about an opaque user_id", async () => {
    // Documented consequence of the seam, NOT a defect: the parser proves that
    // `metadata.user_id` carries the session identifier the headers declare.
    // An opaque replacement makes that unprovable, so the parser refuses rather
    // than relaxing the invariant for every caller.
    const built = await buildClaudeCodeRequest({
      ...BASE,
      metadataOverrides: { userId: "host-supplied-opaque-user-id" },
    });

    expect(() => parseBuiltClaudeCodeRequest(built)).toThrow(
      ClaudeCodeWireError,
    );
  });

  it("keeps the identity headers and system block on the derived identity", async () => {
    const overridden = await buildClaudeCodeRequest({
      ...BASE,
      metadataOverrides: { userId: "host-supplied-opaque-user-id" },
    });
    const plain = await buildClaudeCodeRequest(BASE);

    expect(overridden.headers).toEqual(plain.headers);
  });
});

describe("metadataOverrides without the seam", () => {
  it("rejects a divergent metadata.user_id when no override is supplied", async () => {
    await expectRejection({
      ...BASE,
      metadata: { user_id: "host-supplied-opaque-user-id" },
    });
  });

  it("accepts the derived metadata.user_id when no override is supplied", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      metadata: { user_id: DERIVED_USER_ID },
    });

    expect(bodyMetadata(built.body)["user_id"]).toBe(DERIVED_USER_ID);
  });
});

describe("metadataOverrides adversarial input", () => {
  it("rejects both members supplied together", async () => {
    await expectRejection({
      ...BASE,
      metadataOverrides: {
        userId: "host-supplied-opaque-user-id",
        userIdFields: { org: "acme" },
      },
    });
  });

  it.each([
    ["unknown key", { unknown: true }],
    ["null", null],
    ["array", []],
    ["string", "userId"],
    ["undefined userId", { userId: undefined }],
    ["undefined userIdFields", { userIdFields: undefined }],
    ["non-string userId", { userId: 42 }],
    ["empty userId", { userId: "" }],
    ["whitespace userId", { userId: "   " }],
    ["non-object userIdFields", { userIdFields: "org" }],
    ["array userIdFields", { userIdFields: [] }],
    ["null userIdFields", { userIdFields: null }],
    ["prototype key", { userIdFields: { ["__proto__"]: "polluted" } }],
    ["undefined member value", { userIdFields: { org: undefined } }],
    ["non-finite member value", { userIdFields: { seat: Number.NaN } }],
  ] as const)("rejects %s", async (_label, overrides) => {
    await expectRejection(withOverrides(overrides));
  });

  it.each([
    ["control character in userId", { userId: "user\u0000id" }],
    ["lone surrogate in userId", { userId: "user\uD800id" }],
    [
      "control character in a member value",
      { userIdFields: { org: "a\u0007" } },
    ],
  ] as const)("rejects %s as invalid unicode", async (_label, overrides) => {
    await expectRejection(withOverrides(overrides), "INVALID_UNICODE");
  });

  it("rejects an oversized userId", async () => {
    await expectRejection(
      withOverrides({ userId: "u".repeat(8_193) }),
      "INPUT_TOO_LARGE",
    );
  });

  it("rejects an oversized userIdFields member value", async () => {
    await expectRejection(
      withOverrides({ userIdFields: { org: "o".repeat(8_193) } }),
      "INPUT_TOO_LARGE",
    );
  });

  it("does not let an override smuggle the access token", async () => {
    await expectRejection({
      ...BASE,
      metadataOverrides: { userId: BASE.accessToken },
    });
  });
});
