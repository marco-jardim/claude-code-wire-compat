// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, it } from "vitest";

import type { ClaudeCodeProtocolProfile } from "../../src/contracts.js";
import { buildOrderedHeaders } from "../../src/headers.js";
import { describeEachProfile } from "../support/profile-matrix.js";

const ACCESS_TOKEN = "sentinel-token-header-mutants";

function headerInput(
  profile: ClaudeCodeProtocolProfile,
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
    profile,
    ...overrides,
  };
}

describeEachProfile("expanded header validation mutants", (entry) => {
  function expectCode(
    overrides: Readonly<Record<string, unknown>>,
    code: string,
  ): void {
    expect(() =>
      buildOrderedHeaders(headerInput(entry.profile, overrides)),
    ).toThrow(expect.objectContaining({ code }));
  }

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
