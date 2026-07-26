// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildOrderedHeaders } from "../../src/headers.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";

const ACCESS_TOKEN = "sentinel-token-header-mutants";

function headerInput(
  overrides: Readonly<Record<string, unknown>> = {},
): unknown {
  return {
    accessToken: ACCESS_TOKEN,
    runtime: {
      sessionId: "session",
      runtime: "node",
      runtimeVersion: "22.0.0",
      os: "Linux",
      arch: "x64",
    },
    clientRequestId: "request",
    betaFeatures: [],
    app: "cli",
    stainlessRetryCount: 0,
    extraHeaders: [],
    profile: CLAUDE_CODE_2_1_195_PROFILE,
    ...overrides,
  };
}

function expectCode(
  overrides: Readonly<Record<string, unknown>>,
  code: string,
): void {
  expect(() => buildOrderedHeaders(headerInput(overrides))).toThrow(
    expect.objectContaining({ code }),
  );
}

describe("expanded header validation mutants", () => {
  it.each(["background", null, 1])("rejects invalid app %#", (app) => {
    expectCode({ app }, "INVALID_INPUT");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5, "0", null])(
    "rejects invalid retry count %#",
    (stainlessRetryCount) => {
      expectCode({ stainlessRetryCount }, "INVALID_INPUT");
    },
  );

  it.each([
    "stainlessHelper",
    "claudeRemoteContainerId",
    "claudeRemoteSessionId",
    "clientApp",
    "anthropicAdditionalProtection",
  ])("rejects empty and non-string %s", (key) => {
    expectCode({ [key]: "" }, "INVALID_INPUT");
    expectCode({ [key]: 1 }, "INVALID_INPUT");
  });

  it.each([
    "x-stainless-helper",
    "x-claude-remote-container-id",
    "x-claude-remote-session-id",
    "x-client-app",
    "x-anthropic-additional-protection",
  ])("reserves the canonical name %s", (name) => {
    expectCode(
      { extraHeaders: [[name.toUpperCase(), "value"]] },
      "DUPLICATE_HEADER",
    );
  });

  it("applies injection and token-isolation checks to dynamic values", () => {
    expectCode({ stainlessHelper: "bad\u0000value" }, "HEADER_INJECTION");
    expectCode(
      { anthropicAdditionalProtection: `leak-${ACCESS_TOKEN}` },
      "INVALID_INPUT",
    );
  });
});
