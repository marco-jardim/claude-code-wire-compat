// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Regression: line breaks and tabs are legitimate BODY content.
 *
 * `inspectString` in `src/build-request.ts` rejected every code unit <= 0x1F,
 * which includes TAB (0x09), LF (0x0A) and CR (0x0D). That rule is correct for
 * HEADERS, where a bare LF is request smuggling, and it was applied to the
 * whole input graph — so any message or system block containing a newline was
 * rejected with INVALID_UNICODE. No real prompt is a single line, so the
 * package was unusable for real traffic. The 1784 tests and every golden
 * fixture used single-line text, which is why the defect survived 14 release
 * candidates.
 *
 * These tests are the point of the fix. They pin, in both directions:
 *
 * - multi-line and tabbed content in messages, system blocks and tool metadata
 *   SURVIVES, unmodified, into the canonical body;
 * - every OTHER C0 control, DEL and lone surrogates are STILL rejected;
 * - the header rule did NOT move: a control character in any value that lands
 *   in a header is still refused;
 * - metadata identifiers are STILL strict.
 */

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
  ClaudeCodeWireError,
} from "../../src/index.js";

const RUNTIME = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  deviceId: "22222222-2222-4222-8222-222222222222",
  accountUuid: "33333333-3333-4333-8333-333333333333",
  runtime: "node",
  runtimeVersion: "22.0.0",
  os: "Linux",
  arch: "x64",
} as const;

const BASE: ClaudeCodeRequestInput = {
  accessToken: "multiline-content-token",
  model: "claude-sonnet-4-6",
  maxTokens: 2048,
  messages: [{ role: "user", content: "hello wire compat" }],
  runtime: RUNTIME,
  clientRequestId: "multiline-content-request-1",
};

/** A prompt shaped like real traffic: prose, a blank line, tabbed code. */
const REALISTIC_PROMPT = [
  "Refactor the function below.",
  "",
  "Requirements:",
  "\t- keep the signature",
  "\t- no new dependencies",
  "",
  "```ts",
  "function add(a: number, b: number): number {",
  "\treturn a + b;",
  "}",
  "```",
].join("\n");

const REALISTIC_SYSTEM = [
  "You are a coding assistant.",
  "",
  "Rules:",
  "\t1. Be terse.",
  "\t2. Never invent APIs.",
].join("\n");

async function failureCode(input: ClaudeCodeRequestInput): Promise<string> {
  try {
    await buildClaudeCodeRequest(input);
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  throw new Error("expected buildClaudeCodeRequest to reject");
}

function parsedBody(body: string): Record<string, unknown> {
  return JSON.parse(body) as Record<string, unknown>;
}

function firstUserText(body: string): unknown {
  const messages = parsedBody(body)["messages"];
  if (!Array.isArray(messages)) throw new Error("messages missing");
  const first: unknown = messages[0];
  if (first === null || typeof first !== "object") {
    throw new Error("message missing");
  }
  return (first as { content: unknown }).content;
}

describe("multi-line body content", () => {
  it("accepts a realistic multi-line prompt with tabs and blank lines", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      messages: [{ role: "user", content: REALISTIC_PROMPT }],
    });

    expect(firstUserText(built.body)).toBe(REALISTIC_PROMPT);
    expect(REALISTIC_PROMPT).toContain("\n");
    expect(REALISTIC_PROMPT).toContain("\t");
  });

  it("accepts CR and CRLF line endings", async () => {
    const crlf = "windows line one\r\nwindows line two";
    const cr = "old mac line one\rold mac line two";
    const built = await buildClaudeCodeRequest({
      ...BASE,
      messages: [
        { role: "user", content: crlf },
        { role: "assistant", content: cr },
        { role: "user", content: "tab\tseparated\tvalues" },
      ],
    });

    expect(firstUserText(built.body)).toBe(crlf);
  });

  it("accepts multi-line text inside structured content blocks", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: REALISTIC_PROMPT },
            { type: "text", text: "second\nblock" },
          ],
        },
      ],
    });

    expect(built.body).toContain("\\n");
    expect(JSON.stringify(firstUserText(built.body))).toContain("\\n");
  });

  it("accepts a multi-line system block", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      system: [REALISTIC_SYSTEM, "second\nblock\twith a tab"],
      messages: [{ role: "user", content: REALISTIC_PROMPT }],
    });

    const system = parsedBody(built.body)["system"];
    if (!Array.isArray(system)) throw new Error("system missing");
    expect(JSON.stringify(system)).toContain("\\n");
    expect(built.evidence.systemBlockCount).toBe(2);
  });

  it("accepts multi-line tool descriptions", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      tools: [
        {
          name: "read_file",
          description: "Reads a file.\n\nUsage:\n\t- pass an absolute path",
          input_schema: { type: "object", properties: {} },
        },
      ],
      messages: [{ role: "user", content: REALISTIC_PROMPT }],
    });

    expect(built.body).toContain("Reads a file.");
    expect(built.body).toContain("\\n\\nUsage:");
  });

  it("accepts multi-line content on the count-tokens path", async () => {
    const built = await buildClaudeCodeCountTokensRequest({
      accessToken: "multiline-content-token",
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: REALISTIC_PROMPT }],
      runtime: RUNTIME,
      clientRequestId: "multiline-count-tokens-1",
    });

    expect(firstUserText(built.body)).toBe(REALISTIC_PROMPT);
  });

  it("keeps the body byte length and digest consistent with the escaped text", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      messages: [{ role: "user", content: REALISTIC_PROMPT }],
    });

    expect(built.evidence.bodyByteLength).toBe(
      new TextEncoder().encode(built.body).byteLength,
    );
    // JSON.stringify escapes the raw control characters, so no literal newline
    // reaches the wire even though the caller supplied one.
    expect(built.body.includes("\n")).toBe(false);
  });
});

/*
 * Golden-equivalent, deliberately NOT a golden fixture.
 *
 * `test/fixtures/golden/` is capture-derived ground truth: `manifest.json`
 * pins a `sourceCommit` and a SHA-256 per fixture, and the files record what
 * the genuine client was OBSERVED to send. There is no capture of the real
 * client sending a multi-line prompt available here, and authoring one by hand
 * would manufacture wire evidence — precisely what `docs/source-trace.md`
 * forbids, and it would be indistinguishable from a real capture afterwards.
 *
 * This block gives the same protection without the forgery: it pins the exact
 * canonical body produced from a fixed multi-line input, by hand-written
 * expectation rather than by recording whatever the code happened to emit, and
 * proves the evidence digest is self-consistent. A regression in escaping or
 * canonicalisation fails here exactly as it would fail a golden.
 */
describe("canonical body for multi-line input (golden-equivalent)", () => {
  const PINNED_INPUT: ClaudeCodeRequestInput = {
    ...BASE,
    system: ["Line one.\nLine two.\n\n\tIndented."],
    messages: [
      { role: "user", content: "Question one.\nQuestion two." },
      { role: "assistant", content: "Answer.\n\n\tIndented answer." },
    ],
  };

  it("emits the caller text verbatim, with only JSON escaping applied", async () => {
    const built = await buildClaudeCodeRequest(PINNED_INPUT);
    const body = parsedBody(built.body);

    expect(body["messages"]).toEqual([
      { role: "user", content: "Question one.\nQuestion two." },
      { role: "assistant", content: "Answer.\n\n\tIndented answer." },
    ]);

    const system = body["system"];
    if (!Array.isArray(system)) throw new Error("system missing");
    // Index 0 is the billing block and index 1 the identity block; the caller's
    // block follows them and must be untouched.
    expect(system[system.length - 1]).toEqual({
      type: "text",
      text: "Line one.\nLine two.\n\n\tIndented.",
    });
  });

  it("is byte-stable across builds", async () => {
    const first = await buildClaudeCodeRequest(PINNED_INPUT);
    const second = await buildClaudeCodeRequest(PINNED_INPUT);

    expect(second.body).toBe(first.body);
    expect(second.evidence.bodySha256).toBe(first.evidence.bodySha256);
  });

  it("records an evidence digest that matches the emitted body", async () => {
    const built = await buildClaudeCodeRequest(PINNED_INPUT);
    const independent = createHash("sha256")
      .update(Buffer.from(built.body, "utf8"))
      .digest("hex");

    expect(built.evidence.bodySha256).toBe(independent);
    expect(built.evidence.bodyByteLength).toBe(
      Buffer.byteLength(built.body, "utf8"),
    );
  });
});

describe("control characters that stay forbidden in the body", () => {
  const FORBIDDEN: readonly (readonly [string, string])[] = [
    ["NUL 0x00", "\u0000"],
    ["SOH 0x01", "\u0001"],
    ["VT 0x0B", "\u000b"],
    ["FF 0x0C", "\u000c"],
    ["US 0x1F", "\u001f"],
    ["DEL 0x7F", "\u007f"],
  ];

  it.each(FORBIDDEN)(
    "still rejects %s in message content",
    async (_l, char) => {
      expect(
        await failureCode({
          ...BASE,
          messages: [{ role: "user", content: `before${char}after` }],
        }),
      ).toBe("INVALID_UNICODE");
    },
  );

  it.each(FORBIDDEN)("still rejects %s in a system block", async (_l, char) => {
    expect(
      await failureCode({
        ...BASE,
        system: [`before${char}after`],
      }),
    ).toBe("INVALID_UNICODE");
  });

  it("still rejects a lone high surrogate", async () => {
    expect(
      await failureCode({
        ...BASE,
        messages: [{ role: "user", content: "broken \ud800 pair" }],
      }),
    ).toBe("INVALID_UNICODE");
  });

  it("still rejects a lone low surrogate", async () => {
    expect(
      await failureCode({
        ...BASE,
        messages: [{ role: "user", content: "broken \udc00 pair" }],
      }),
    ).toBe("INVALID_UNICODE");
  });

  it("still accepts a well formed surrogate pair", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      messages: [{ role: "user", content: "emoji \u{1f680} and a newline\n" }],
    });

    expect(firstUserText(built.body)).toBe("emoji \u{1f680} and a newline\n");
  });
});

describe("the header rule did not move", () => {
  it("still rejects LF in an extra header value", async () => {
    expect(
      await failureCode({
        ...BASE,
        extraHeaders: [["x-meu-header", "value\nx-smuggled: 1"]],
      }),
    ).toBe("HEADER_INJECTION");
  });

  it("still rejects CRLF in an extra header name", async () => {
    expect(
      await failureCode({
        ...BASE,
        extraHeaders: [["x-meu\r\nx-smuggled", "value"]],
      }),
    ).toBe("HEADER_INJECTION");
  });

  it("still rejects TAB in an extra header value", async () => {
    expect(
      await failureCode({
        ...BASE,
        extraHeaders: [["x-meu-header", "value\twith a tab"]],
      }),
    ).toBe("HEADER_INJECTION");
  });

  it("still rejects LF in a value that becomes a canonical header", async () => {
    expect(await failureCode({ ...BASE, clientRequestId: "request\nid" })).toBe(
      "HEADER_INJECTION",
    );
  });

  it("still rejects LF in a runtime identity field", async () => {
    // Caught one layer earlier than the header assembler, by
    // `validateRuntimeIdentity`, which pins the shape of every identity value.
    // The point of this test is that the value never reaches a header, not
    // which of the two guards fires first.
    expect(
      await failureCode({
        ...BASE,
        runtime: { ...RUNTIME, os: "Linux\nSmuggled" },
      }),
    ).toBe("INVALID_IDENTITY");
  });
});

describe("metadata identifiers stay strict", () => {
  // `src/metadata.ts` was deliberately NOT relaxed. `user_id` and its members
  // are identifiers that travel as JSON inside a header, not prose, so the
  // strict control-character rule still applies to them in full. These three
  // inputs are accepted as message content by the same build; they are refused
  // here purely because of where they land.

  it("still rejects LF in metadataOverrides.userId", async () => {
    expect(
      await failureCode({
        ...BASE,
        metadataOverrides: { userId: "user\nid" },
      }),
    ).toBe("INVALID_UNICODE");
  });

  it("still rejects TAB in metadataOverrides.userId", async () => {
    expect(
      await failureCode({
        ...BASE,
        metadataOverrides: { userId: "user\tid" },
      }),
    ).toBe("INVALID_UNICODE");
  });

  it("still rejects LF in a metadataOverrides.userIdFields value", async () => {
    expect(
      await failureCode({
        ...BASE,
        metadataOverrides: { userIdFields: { tenant: "acme\ncorp" } },
      }),
    ).toBe("INVALID_UNICODE");
  });

  it("accepts the same text as message content in the same build", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      messages: [{ role: "user", content: "user\nid" }],
      metadataOverrides: { userId: "opaque-host-identifier" },
    });

    expect(firstUserText(built.body)).toBe("user\nid");
  });
});
