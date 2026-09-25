// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Violation diagnostics (P1.T1, D4): validation failures carry safeDetails
 * that locate the offending string without leaking caller content — a
 * closed-set reason, a vocabulary-capped path, numeric offsets and code units
 * from control/surrogate ranges only. These tests pin the end-to-end shape
 * through the public entries (post-sanitizeError) and the redaction
 * allowlist's hostile-input handling.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
  ClaudeCodeWireError,
} from "../../src/index.js";
import { toSafeErrorDetails } from "../../src/redaction.js";
import {
  formatViolationPath,
  isValidViolationPath,
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

  it("rejects malformed paths in the redaction validator", () => {
    expect(isValidViolationPath("/messages/0/content")).toBe(true);
    expect(isValidViolationPath("messages/0/content")).toBe(false);
    expect(isValidViolationPath("/messages/0/secretKey")).toBe(false);
    expect(isValidViolationPath("/messages/0/.../content")).toBe(false);
  });
});

describe("toSafeErrorDetails violation allowlist", () => {
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
