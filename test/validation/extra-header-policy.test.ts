// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Seam S5: the `extraHeaderPolicy` field and the hop-by-hop/entity denylist.
 *
 * Two independent additions are locked here.
 *
 * 1. The denylist fix. `content-length`, `host`, `connection`,
 *    `transfer-encoding`, `te`, `upgrade` and `keep-alive` used to PASS through
 *    `extraHeaders`. They are hop-by-hop headers (RFC 9110 section 7.6.1) or
 *    entity headers this package computes itself; a caller forwarding the
 *    `content-length` of an inbound request corrupts the outbound request
 *    silently, because the canonical body it reconstructs has a different size.
 *
 * 2. The policy field. `strict` is the pre-existing behaviour, byte for byte.
 *    `dropConflicting` trades the thrown error for a recorded drop, so a
 *    consumer can forward a heterogeneous host header map without a single
 *    `anthropic-beta` destroying the request — and still audit what fell.
 *
 * The one thing NEITHER policy relaxes is header injection.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  ClaudeCodeWireError,
  CLAUDE_CODE_2_1_195_PROFILE,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import { buildOrderedHeaders } from "../../src/headers.js";

const BASE: ClaudeCodeRequestInput = {
  accessToken: "extra-header-policy-token",
  model: "claude-sonnet-4-6",
  maxTokens: 2048,
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
  clientRequestId: "extra-header-policy-request-1",
};

/** The seven names added by the denylist fix, in the documented order. */
const HOP_BY_HOP_NAMES = [
  "content-length",
  "host",
  "connection",
  "transfer-encoding",
  "te",
  "upgrade",
  "keep-alive",
] as const;

/** The names the denylist already carried before the fix. */
const PRE_EXISTING_FORBIDDEN_NAMES = [
  "x-api-key",
  "cookie",
  "set-cookie",
  "forwarded",
  "proxy-authorization",
  "x-forwarded-for",
] as const;

type Extras = NonNullable<ClaudeCodeRequestInput["extraHeaders"]>;
type Policy = NonNullable<ClaudeCodeRequestInput["extraHeaderPolicy"]>;

function withExtras(
  extraHeaders: Extras,
  policy?: Policy,
): ClaudeCodeRequestInput {
  return {
    ...BASE,
    extraHeaders,
    ...(policy === undefined ? {} : { extraHeaderPolicy: policy }),
  };
}

async function failureCode(input: ClaudeCodeRequestInput): Promise<string> {
  try {
    await buildClaudeCodeRequest(input);
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  throw new Error("expected buildClaudeCodeRequest to reject");
}

function headerNames(
  headers: readonly (readonly [string, string])[],
): string[] {
  return headers.map(([name]) => name);
}

function headerValues(
  headers: readonly (readonly [string, string])[],
  name: string,
): string[] {
  return headers
    .filter(([candidate]) => candidate === name)
    .map(([, value]) => value);
}

const HEADER_INPUT_BASE = {
  accessToken: "ordered-header-token",
  runtime: {
    sessionId: "11111111-1111-4111-8111-111111111111",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "ordered-header-request-1",
  betaFeatures: ["oauth-2025-04-20"],
  app: "cli",
  stainlessRetryCount: 0,
  profile: CLAUDE_CODE_2_1_195_PROFILE,
} as const;

function orderedHeadersCode(
  extraHeaders: readonly (readonly [string, string])[],
  policy?: unknown,
): string {
  try {
    buildOrderedHeaders({
      ...HEADER_INPUT_BASE,
      extraHeaders,
      ...(policy === undefined ? {} : { extraHeaderPolicy: policy }),
    });
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  throw new Error("expected buildOrderedHeaders to throw");
}

describe("hop-by-hop and entity header denylist", () => {
  it.each(HOP_BY_HOP_NAMES)(
    "rejects %s with FORBIDDEN_HEADER under the default policy",
    async (name) => {
      expect(await failureCode(withExtras([[name, "1"]]))).toBe(
        "FORBIDDEN_HEADER",
      );
    },
  );

  it.each(HOP_BY_HOP_NAMES)(
    "rejects %s with FORBIDDEN_HEADER under an explicit strict policy",
    async (name) => {
      expect(await failureCode(withExtras([[name, "1"]], "strict"))).toBe(
        "FORBIDDEN_HEADER",
      );
    },
  );

  it("normalizes case before consulting the denylist", async () => {
    expect(await failureCode(withExtras([["Content-Length", "17"]]))).toBe(
      "FORBIDDEN_HEADER",
    );
    expect(
      await failureCode(withExtras([["Transfer-Encoding", "chunked"]])),
    ).toBe("FORBIDDEN_HEADER");
  });

  it.each(PRE_EXISTING_FORBIDDEN_NAMES)(
    "keeps rejecting the pre-existing forbidden name %s",
    async (name) => {
      expect(await failureCode(withExtras([[name, "1"]]))).toBe(
        "FORBIDDEN_HEADER",
      );
    },
  );
});

describe("extraHeaderPolicy strict", () => {
  it("is the default and leaves the built request identical", async () => {
    const extras: Extras = [["x-meu-header", "kept"]];
    const omitted = await buildClaudeCodeRequest(withExtras(extras));
    const explicit = await buildClaudeCodeRequest(withExtras(extras, "strict"));

    expect(explicit.body).toBe(omitted.body);
    expect(explicit.headers).toEqual(omitted.headers);
    expect(explicit.evidence).toEqual(omitted.evidence);
    expect(explicit).toEqual(omitted);
  });

  it("omits droppedExtraHeaderNames from evidence entirely", async () => {
    const omitted = await buildClaudeCodeRequest(
      withExtras([["x-meu-header", "kept"]]),
    );
    const explicit = await buildClaudeCodeRequest(
      withExtras([["x-meu-header", "kept"]], "strict"),
    );

    expect(Object.hasOwn(omitted.evidence, "droppedExtraHeaderNames")).toBe(
      false,
    );
    expect(Object.hasOwn(explicit.evidence, "droppedExtraHeaderNames")).toBe(
      false,
    );
    expect(JSON.parse(JSON.stringify(explicit.evidence))).toEqual(
      JSON.parse(JSON.stringify(omitted.evidence)),
    );
  });

  it("still throws DUPLICATE_HEADER for a canonical name", async () => {
    expect(
      await failureCode(withExtras([["anthropic-beta", "host"]], "strict")),
    ).toBe("DUPLICATE_HEADER");
    expect(await failureCode(withExtras([["user-agent", "host/1.0"]]))).toBe(
      "DUPLICATE_HEADER",
    );
  });
});

describe("extraHeaderPolicy dropConflicting", () => {
  it("drops a canonical collision and records it in evidence", async () => {
    const built = await buildClaudeCodeRequest(
      withExtras(
        [
          ["anthropic-beta", "host-supplied-beta"],
          ["user-agent", "host/1.0"],
          ["x-meu-header", "kept"],
        ],
        "dropConflicting",
      ),
    );

    expect(built.evidence.droppedExtraHeaderNames).toEqual([
      "anthropic-beta",
      "user-agent",
    ]);
    expect(headerValues(built.headers, "anthropic-beta")).toEqual([
      built.evidence.betaFeatures.join(","),
    ]);
    expect(headerValues(built.headers, "user-agent")).toEqual([
      CLAUDE_CODE_2_1_195_PROFILE.userAgent,
    ]);
    expect(headerValues(built.headers, "x-meu-header")).toEqual(["kept"]);
  });

  it("drops content-length, the case that motivated the seam", async () => {
    const built = await buildClaudeCodeRequest(
      withExtras(
        [
          ["content-length", "17"],
          ["x-meu-header", "kept"],
        ],
        "dropConflicting",
      ),
    );

    expect(built.evidence.droppedExtraHeaderNames).toEqual(["content-length"]);
    expect(headerNames(built.headers)).not.toContain("content-length");
    expect(headerValues(built.headers, "x-meu-header")).toEqual(["kept"]);
  });

  it("drops a pre-existing forbidden name such as x-api-key", async () => {
    const built = await buildClaudeCodeRequest(
      withExtras(
        [
          ["x-api-key", "sk-ant-should-not-reach-the-wire"],
          ["x-meu-header", "kept"],
        ],
        "dropConflicting",
      ),
    );

    expect(built.evidence.droppedExtraHeaderNames).toEqual(["x-api-key"]);
    expect(headerNames(built.headers)).not.toContain("x-api-key");
    expect(built.headers.every(([, value]) => !value.includes("sk-ant"))).toBe(
      true,
    );
  });

  it("keeps a legitimate custom header on the wire", async () => {
    const built = await buildClaudeCodeRequest(
      withExtras(
        [
          ["x-meu-header", "kept"],
          ["x-outro", "tambem-kept"],
        ],
        "dropConflicting",
      ),
    );

    expect(built.evidence.droppedExtraHeaderNames).toEqual([]);
    expect(built.headers.slice(-2)).toEqual([
      ["x-meu-header", "kept"],
      ["x-outro", "tambem-kept"],
    ]);
    expect(built.evidence.logicalHeaderNames).toEqual(
      headerNames(built.headers),
    );
  });

  it("records dropped names lowercased and in caller order", async () => {
    const built = await buildClaudeCodeRequest(
      withExtras(
        [
          ["X-Api-Key", "leak"],
          ["Content-Length", "17"],
          ["x-meu-header", "kept"],
          ["Anthropic-Beta", "host-supplied-beta"],
          ["Host", "example.invalid"],
        ],
        "dropConflicting",
      ),
    );

    expect(built.evidence.droppedExtraHeaderNames).toEqual([
      "x-api-key",
      "content-length",
      "anthropic-beta",
      "host",
    ]);
    expect(headerValues(built.headers, "x-meu-header")).toEqual(["kept"]);
  });

  it("emits an empty droppedExtraHeaderNames when nothing collided", async () => {
    const built = await buildClaudeCodeRequest(
      withExtras([["x-meu-header", "kept"]], "dropConflicting"),
    );

    expect(Object.hasOwn(built.evidence, "droppedExtraHeaderNames")).toBe(true);
    expect(built.evidence.droppedExtraHeaderNames).toEqual([]);
  });

  it("leaves the body and every canonical header untouched", async () => {
    const strict = await buildClaudeCodeRequest(
      withExtras([["x-meu-header", "kept"]], "strict"),
    );
    const dropping = await buildClaudeCodeRequest(
      withExtras(
        [
          ["anthropic-beta", "host-supplied-beta"],
          ["x-meu-header", "kept"],
        ],
        "dropConflicting",
      ),
    );

    expect(dropping.body).toBe(strict.body);
    expect(dropping.headers).toEqual(strict.headers);
    expect(dropping.evidence.bodySha256).toBe(strict.evidence.bodySha256);
  });

  it("still rejects a caller duplicating one of its own extra headers", async () => {
    expect(
      await failureCode(
        withExtras(
          [
            ["x-meu-header", "first"],
            ["x-meu-header", "second"],
          ],
          "dropConflicting",
        ),
      ),
    ).toBe("DUPLICATE_HEADER");
  });

  it("refuses to record a dropped name that carries the access token", async () => {
    expect(
      await failureCode(
        withExtras(
          [["x-forwarded-extra-header-policy-token", "1"]],
          "dropConflicting",
        ),
      ),
    ).toBe("INVALID_INPUT");
  });

  it("round-trips through parseBuiltClaudeCodeRequest", async () => {
    const built = await buildClaudeCodeRequest(
      withExtras(
        [
          ["content-length", "17"],
          ["x-meu-header", "kept"],
        ],
        "dropConflicting",
      ),
    );
    const parsed = parseBuiltClaudeCodeRequest(
      JSON.parse(JSON.stringify(built)) as unknown,
    );

    expect(parsed.evidence.droppedExtraHeaderNames).toEqual(["content-length"]);
    expect(parsed.headers).toEqual(built.headers);
    expect(parsed.body).toBe(built.body);
    expect(parsed.evidence).toEqual(built.evidence);
  });
});

describe("header injection is never relaxed", () => {
  const CONTROL_NAME = "x-injected\u0085name";
  const CONTROL_VALUE = "value\u0085injected";

  it.each(["strict", "dropConflicting"] as const)(
    "rejects a control character in the name under %s",
    async (policy) => {
      expect(await failureCode(withExtras([[CONTROL_NAME, "v"]], policy))).toBe(
        "HEADER_INJECTION",
      );
    },
  );

  it.each(["strict", "dropConflicting"] as const)(
    "rejects a control character in the value under %s",
    async (policy) => {
      expect(
        await failureCode(
          withExtras([["x-meu-header", CONTROL_VALUE]], policy),
        ),
      ).toBe("HEADER_INJECTION");
    },
  );

  it.each(["strict", "dropConflicting"] as const)(
    "rejects CRLF in the name under %s at the header layer",
    (policy) => {
      expect(
        orderedHeadersCode([["x-injected\r\nx-smuggled", "v"]], policy),
      ).toBe("HEADER_INJECTION");
    },
  );

  it.each(["strict", "dropConflicting"] as const)(
    "rejects CRLF in the value under %s at the header layer",
    (policy) => {
      expect(
        orderedHeadersCode([["x-meu-header", "v\r\nx-smuggled: 1"]], policy),
      ).toBe("HEADER_INJECTION");
    },
  );

  it("rejects CRLF before the policy is even consulted at the request layer", async () => {
    expect(
      await failureCode(
        withExtras([["x-meu-header", "v\r\nx-smuggled: 1"]], "dropConflicting"),
      ),
    ).toBe("INVALID_UNICODE");
  });

  it("rejects a forbidden name carrying CRLF instead of dropping it", () => {
    expect(
      orderedHeadersCode(
        [["content-length\r\nx-smuggled", "1"]],
        "dropConflicting",
      ),
    ).toBe("HEADER_INJECTION");
  });
});

describe("extraHeaderPolicy input validation", () => {
  const INVALID: readonly (readonly [string, unknown])[] = [
    ["drop", "drop"],
    ["empty string", ""],
    ["null", null],
    ["number", 5],
    ["true", true],
    ["array", ["dropConflicting"]],
    ["object", { policy: "dropConflicting" }],
    ["uppercase", "DROPCONFLICTING"],
    ["strict with whitespace", " strict"],
  ];

  it.each(INVALID)("rejects %s with INVALID_INPUT", async (_label, value) => {
    const input = {
      ...BASE,
      extraHeaders: [["x-meu-header", "kept"]],
      extraHeaderPolicy: value,
    } as unknown as ClaudeCodeRequestInput;
    expect(await failureCode(input)).toBe("INVALID_INPUT");
  });

  it.each(INVALID.filter(([, value]) => value !== null))(
    "rejects %s at the header layer too",
    (_label, value) => {
      expect(orderedHeadersCode([["x-meu-header", "kept"]], value)).toBe(
        "INVALID_INPUT",
      );
    },
  );

  it("treats a nullish policy as strict at the header layer", () => {
    // The two layers diverge on purpose: `buildClaudeCodeRequest` is the public
    // boundary and REJECTS `null` with INVALID_INPUT, so `buildOrderedHeaders`
    // assumes an already validated input and applies the same nullish default
    // it already applies to `extraHeaders`. Neither layer silently accepts a
    // bad policy from a caller.
    expect(
      orderedHeadersCode([["anthropic-beta", "host-supplied-beta"]], null),
    ).toBe("DUPLICATE_HEADER");
    expect(
      orderedHeadersCode([["anthropic-beta", "host-supplied-beta"]], undefined),
    ).toBe("DUPLICATE_HEADER");
  });

  it("rejects an explicitly undefined policy", async () => {
    const input = {
      ...BASE,
      extraHeaderPolicy: undefined,
    } as unknown as ClaudeCodeRequestInput;
    expect(await failureCode(input)).toBe("INVALID_INPUT");
  });
});
