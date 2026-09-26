// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Violation diagnostics (P1.T1, D4): validation failures carry safeDetails
 * that locate the offending string without leaking caller content — a
 * closed-set reason, a vocabulary-capped path, numeric offsets and code units
 * from control/surrogate ranges only. These tests pin the end-to-end shape
 * through the public entries (post-sanitizeError) and the redaction
 * allowlist's hostile-input handling.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
  ClaudeCodeWireError,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import { toSafeErrorDetails } from "../../src/redaction.js";
import {
  formatViolationPath,
  isValidViolationCodeUnit,
  isValidViolationPath,
  isValidViolationReason,
} from "../../src/violation.js";

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
  accessToken: "violation-details-token",
  model: "claude-sonnet-4-6",
  maxTokens: 2048,
  messages: [{ role: "user", content: "violation details baseline" }],
  runtime: RUNTIME,
  clientRequestId: "violation-details-request-1",
};

const LONE_HIGH = "broken \ud800 pair";

async function captureError(
  input: ClaudeCodeRequestInput,
): Promise<ClaudeCodeWireError> {
  try {
    await buildClaudeCodeRequest(input);
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error;
    throw error;
  }
  throw new Error("expected buildClaudeCodeRequest to reject");
}

describe("violation safeDetails end to end", () => {
  it.each([
    // ESC serializes as six bytes, so request plus body is ~7N against the
    // 100,663,296 composite evidence budget; a quote serializes as two bytes
    // (~3N); plain ASCII is bounded by the 33,554,432 input ceiling instead.
    [27, 14_300_000],
    [34, 33_000_000],
    [97, 33_000_000],
  ])(
    "roundtrips near-budget prose, code unit %s",
    { timeout: 120_000 },
    async (unit, length) => {
      const built = await buildClaudeCodeRequest({
        ...BASE,
        messages: [
          { role: "user", content: String.fromCharCode(unit).repeat(length) },
        ],
      });
      expect(parseBuiltClaudeCodeRequest(built).body).toBe(built.body);
    },
  );

  it(
    "rejects expanded evidence during build rather than returning an unparseable body",
    { timeout: 120_000 },
    async () => {
      await expect(
        buildClaudeCodeRequest({
          ...BASE,
          messages: [
            {
              role: "user",
              content: String.fromCharCode(27).repeat(14_500_000),
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: "INPUT_TOO_LARGE",
        safeDetails: { maximumSize: 100_663_296 },
      });
    },
  );

  it.each([
    { type: "image", source: { type: "url", url: "bad\u0000url" } },
    { type: "image", source: { type: "file", file_id: "bad\u0000id" } },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: "bad\u0000data",
      },
    },
    {
      type: "thinking",
      thinking: "valid text",
      signature: "bad\u0000signature",
    },
    { type: "redacted_thinking", data: "bad\u0000data" },
    {
      type: "search_result",
      source: "bad\u0000source",
      title: "title",
      content: [{ type: "text", text: "text" }],
    },
  ])("keeps opaque $type tokens strict", async (block) => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        messages: [
          { role: "assistant", content: [block] },
          { role: "user", content: "continue" },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_UNICODE" });
  });

  it("locates a lone surrogate in plain message text", async () => {
    const error = await captureError({
      ...BASE,
      messages: [{ role: "user", content: LONE_HIGH }],
    });

    expect(error.code).toBe("INVALID_UNICODE");
    expect(error.safeDetails).toMatchObject({
      violationReason: "lone-surrogate",
      violationPath: "/messages/0/content",
      violationOffset: 7,
      violationCodeUnit: 0xd800,
      violationTextLength: LONE_HIGH.length,
      violationInKey: false,
    });
  });

  it("locates a lone surrogate inside a structured text block", async () => {
    const error = await captureError({
      ...BASE,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: LONE_HIGH }],
        },
      ],
    });

    expect(error.safeDetails).toMatchObject({
      violationReason: "lone-surrogate",
      violationPath: "/messages/0/content/0/text",
      violationOffset: 7,
      violationInKey: false,
    });
  });

  it("masks a user-controlled key holding a lone surrogate", async () => {
    const error = await captureError({
      ...BASE,
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tu1",
              name: "probe",
              input: { ["bad\ud800key"]: 1 },
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "tu1", content: "x" }],
        },
      ],
    });

    expect(error.safeDetails).toMatchObject({
      violationReason: "lone-surrogate",
      violationPath: "/messages/0/content/0/input/*",
      violationInKey: true,
    });
    expect(JSON.stringify(error.safeDetails)).not.toContain("bad");
  });

  it("locates a lone surrogate in the system field", async () => {
    const error = await captureError({ ...BASE, system: [LONE_HIGH] });

    expect(error.safeDetails).toMatchObject({
      violationReason: "lone-surrogate",
      violationPath: "/system/0",
      violationOffset: 7,
    });
  });

  it.each(["583920", "name", "id", "length", "description"])(
    "masks user keys even when numeric or schema-like: %s",
    async (key) => {
      const messages: ClaudeCodeRequestInput["messages"] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tu1",
              name: "probe",
              input: { [key]: { name: LONE_HIGH } },
            },
          ],
        },
      ];
      const error = await captureError({ ...BASE, messages });
      expect(error.safeDetails["violationPath"]).toBe(
        "/messages/0/content/0/input/*/*",
      );
      await expect(
        buildClaudeCodeCountTokensRequest({
          accessToken: BASE.accessToken,
          model: BASE.model,
          messages,
          runtime: RUNTIME,
          clientRequestId: "masked-count",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_UNICODE",
        safeDetails: { violationPath: "/messages/0/content/0/input/*/*" },
      });
    },
  );

  it("carries the same details on the count-tokens path", async () => {
    try {
      await buildClaudeCodeCountTokensRequest({
        accessToken: "violation-details-token",
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: LONE_HIGH }],
        runtime: RUNTIME,
        clientRequestId: "violation-details-count-1",
      });
      throw new Error("expected count-tokens to reject");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ClaudeCodeWireError);
      const wireError = error as ClaudeCodeWireError;
      expect(wireError.safeDetails).toMatchObject({
        violationReason: "lone-surrogate",
        violationPath: "/messages/0/content",
        violationOffset: 7,
      });
    }
  });

  it("masks numeric and vocabulary keys in schema and metadata", async () => {
    const schemaError = await captureError({
      ...BASE,
      tools: [
        {
          name: "probe",
          input_schema: { properties: { "583920": { name: LONE_HIGH } } },
        },
      ],
    });
    expect(schemaError.safeDetails["violationPath"]).toBe(
      "/tools/0/input_schema/*/*/*",
    );
    const metadataError = await captureError({
      ...BASE,
      metadata: { "583920": { name: LONE_HIGH } },
    });
    expect(metadataError.safeDetails["violationPath"]).toBe("/metadata/*/*");
  });

  it("validates escaped surrogates in parsed body values with masked paths", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      messages: [
        { role: "user", content: "run" },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tu1",
              name: "probe",
              input: { "583920": { name: "safe-sentinel" } },
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "tu1", content: "ok" }],
        },
      ],
    });
    try {
      parseBuiltClaudeCodeRequest({
        ...built,
        body: built.body.replace("safe-sentinel", "\\ud800"),
      });
      throw new Error("expected invalid parsed text to fail");
    } catch (error: unknown) {
      if (!(error instanceof ClaudeCodeWireError)) throw error;
      expect(error.code).toBe("INVALID_UNICODE");
      expect(error.safeDetails["violationPath"]).toBe(
        "/messages/1/content/0/input/*/*",
      );
    }
  });

  it("keeps user input named model/name as prose while rejecting identifiers", async () => {
    const control = String.fromCharCode(0);
    const input = {
      ...BASE,
      messages: [
        { role: "user" as const, content: "run" },
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool_use" as const,
              id: "tu1",
              name: "probe",
              input: { model: control, name: control },
            },
          ],
        },
        {
          role: "user" as const,
          content: [
            { type: "tool_result" as const, tool_use_id: "tu1", content: "ok" },
          ],
        },
      ],
    };
    const built = await buildClaudeCodeRequest(input);
    expect(parseBuiltClaudeCodeRequest(built).body).toBe(built.body);
    await expect(
      buildClaudeCodeRequest({ ...BASE, model: `model${control}` }),
    ).rejects.toMatchObject({ code: "INVALID_UNICODE" });
    await expect(
      buildClaudeCodeCountTokensRequest({
        accessToken: BASE.accessToken,
        model: `model${control}`,
        messages: BASE.messages,
        runtime: RUNTIME,
        clientRequestId: "identifier-count",
      }),
    ).rejects.toMatchObject({ code: "INVALID_UNICODE" });
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        tools: [{ name: `tool${control}`, input_schema: {} }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_UNICODE" });
  });

  it("truncates deep paths with the marker", async () => {
    let nested: Record<string, unknown> = { key: LONE_HIGH };
    for (let level = 0; level < 14; level += 1) nested = { key: nested };

    const error = await captureError({
      ...BASE,
      messages: [
        {
          role: "assistant",
          content: [
            { type: "tool_use", id: "tu1", name: "probe", input: nested },
          ],
        },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "tu1", content: "x" }],
        },
      ],
    });

    const path = error.safeDetails["violationPath"];
    expect(typeof path).toBe("string");
    expect(path as string).toMatch(/\/\.\.\.$/u);
    expect((path as string).length).toBeLessThanOrEqual(256);
    expect(isValidViolationPath(path as string)).toBe(true);
  });
});

describe("violation path formatting", () => {
  it("maps vocabulary keys, indices and user keys", () => {
    expect(formatViolationPath(["messages", 0, "content", "secret"])).toBe(
      "/messages/0/content/*",
    );
  });

  it("maps non-safe-integer numeric segments to the placeholder", () => {
    expect(formatViolationPath(["messages", -1, Number.NaN])).toBe(
      "/messages/*/*",
    );
  });

  it("caps overlong paths at 256 characters with the marker", () => {
    const segments = Array.from(
      { length: 16 },
      () => "anthropicAdditionalProtection",
    );
    const path = formatViolationPath(segments);
    expect(path.length).toBeLessThanOrEqual(256);
    expect(path).toMatch(/\/\.\.\.$/u);
    expect(isValidViolationPath(path)).toBe(true);
  });

  it("formats only paths accepted by the redaction validator", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.constantFrom(
              "messages",
              "metadataOverrides",
              "input_schema",
              "input",
              "name",
              "anthropicAdditionalProtection",
            ),
          ),
          { maxLength: 80 },
        ),
        (segments) => isValidViolationPath(formatViolationPath(segments)),
      ),
      { seed: 20260925, numRuns: 1000 },
    );
    expect(formatViolationPath([])).toBe("/");
    expect(isValidViolationPath("/")).toBe(true);
  });

  it("masks opaque subtrees and rejects forged unmasked paths", () => {
    for (const root of ["input", "input_schema", "metadataOverrides"]) {
      expect(formatViolationPath([root, "name", "583920", 0, "id"])).toBe(
        `/${root}/*/*/0/*`,
      );
      expect(isValidViolationPath(`/${root}/name`)).toBe(false);
    }
    expect(formatViolationPath(["length", 1_000_000, -0])).toBe("/*/*/*");
    expect(formatViolationPath(["unclassified-subtree", "name", "id"])).toBe(
      "/*/*/*",
    );
    expect(isValidViolationPath("/*/name")).toBe(false);
    expect(formatViolationPath(["headers", 0, "name"])).toBe("/headers/0/*");
    expect(isValidViolationPath("/messages/01")).toBe(false);
    expect(isValidViolationPath(`/${Array(17).fill("text").join("/")}`)).toBe(
      false,
    );
    expect(
      isValidViolationPath(`/${Array(16).fill("text").join("/")}/...`),
    ).toBe(true);
  });

  it("rejects malformed paths in the redaction validator", () => {
    expect(isValidViolationPath("/messages/0/content")).toBe(true);
    expect(isValidViolationPath("")).toBe(false);
    expect(isValidViolationPath("messages/0/content")).toBe(false);
    expect(isValidViolationPath("/messages/0/secretKey")).toBe(false);
    expect(isValidViolationPath("/messages/0/.../content")).toBe(false);
    expect(isValidViolationPath(`/messages/${"0".repeat(7)}`)).toBe(false);
    expect(isValidViolationPath("/messages/123456/0")).toBe(true);
  });

  it("validates reasons and code units against their closed sets", () => {
    expect(isValidViolationReason("lone-surrogate")).toBe(true);
    expect(isValidViolationReason("control-char")).toBe(true);
    expect(isValidViolationReason("forbidden-key")).toBe(false);
    expect(isValidViolationReason("other")).toBe(false);

    expect(isValidViolationCodeUnit(0x00)).toBe(true);
    expect(isValidViolationCodeUnit(0x1f)).toBe(true);
    expect(isValidViolationCodeUnit(0x7f)).toBe(true);
    expect(isValidViolationCodeUnit(0x9f)).toBe(true);
    expect(isValidViolationCodeUnit(0xd800)).toBe(true);
    expect(isValidViolationCodeUnit(0xdfff)).toBe(true);
    expect(isValidViolationCodeUnit(0x20)).toBe(false);
    expect(isValidViolationCodeUnit(0x61)).toBe(false);
    expect(isValidViolationCodeUnit(0xe000)).toBe(false);
    expect(isValidViolationCodeUnit(-1)).toBe(false);
    expect(isValidViolationCodeUnit(1.5)).toBe(false);
  });
});

describe("toSafeErrorDetails violation allowlist", () => {
  it.each([-0, -1, 1.5, 33_554_433, Number.MAX_SAFE_INTEGER + 1])(
    "drops out-of-budget positions: %s",
    (value) => {
      const details = toSafeErrorDetails(
        new ClaudeCodeWireError("INVALID_UNICODE", {
          violationOffset: value,
          violationTextLength: value,
        }),
      );
      expect(details["violationOffset"]).toBeUndefined();
      expect(details["violationTextLength"]).toBeUndefined();
    },
  );

  it("keeps positions at the 33,554,432 input ceiling", () => {
    const details = toSafeErrorDetails(
      new ClaudeCodeWireError("INVALID_UNICODE", {
        violationOffset: 33_554_432,
        violationTextLength: 33_554_432,
      }),
    );
    expect(details["violationOffset"]).toBe(33_554_432);
    expect(details["violationTextLength"]).toBe(33_554_432);
  });

  it.each([
    ["lone-surrogate", 0x1b],
    ["control-char", 0xd800],
    ["forbidden-key", 0xd800],
    ["unknown", 0xd800],
    ["control-char", -0],
  ] as const)("drops code units inconsistent with %s", (reason, codeUnit) => {
    expect(
      toSafeErrorDetails(
        new ClaudeCodeWireError("INVALID_UNICODE", {
          violationReason: reason,
          violationCodeUnit: codeUnit,
        }),
      )["violationCodeUnit"],
    ).toBeUndefined();
  });

  it("keeps well-formed violation details", () => {
    const error = new ClaudeCodeWireError("INVALID_UNICODE", {
      violationReason: "lone-surrogate",
      violationPath: "/messages/0/content",
      violationOffset: 7,
      violationCodeUnit: 0xd800,
      violationTextLength: 15,
      violationInKey: false,
    });

    expect(toSafeErrorDetails(error)).toMatchObject({
      violationReason: "lone-surrogate",
      violationPath: "/messages/0/content",
      violationOffset: 7,
      violationCodeUnit: 0xd800,
      violationTextLength: 15,
      violationInKey: false,
    });
  });

  it("drops hostile violation fields but keeps the code", () => {
    const error = new ClaudeCodeWireError("INVALID_UNICODE", {
      violationReason: "lone-surrogate'; DROP TABLE",
      violationPath: "/messages/0/userSecretKey",
      violationOffset: -1,
      violationCodeUnit: 65,
      violationTextLength: 1.5,
      violationInKey: "yes",
    });

    const details = toSafeErrorDetails(error);
    expect(details["code"]).toBe("INVALID_UNICODE");
    expect(details["violationReason"]).toBeUndefined();
    expect(details["violationPath"]).toBeUndefined();
    expect(details["violationOffset"]).toBeUndefined();
    expect(details["violationCodeUnit"]).toBeUndefined();
    expect(details["violationTextLength"]).toBeUndefined();
    expect(details["violationInKey"]).toBeUndefined();
  });
});
