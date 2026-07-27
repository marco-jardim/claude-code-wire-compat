// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { HeaderPair } from "../../src/contracts.js";
import { buildOrderedHeaders } from "../../src/headers.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";

const TOKEN = "sentinel-token-headers-validation-9c31de";

function validInput(extraHeaders: readonly HeaderPair[] = []): unknown {
  return {
    accessToken: TOKEN,
    runtime: {
      sessionId: "00000000-0000-4000-8000-000000000001",
      runtime: "node",
      runtimeVersion: "v24.15.0",
      os: "Windows",
      arch: "x64",
    },
    clientRequestId: "00000000-0000-4000-8000-000000000002",
    betaFeatures: ["synthetic-beta"],
    extraHeaders,
    profile: CLAUDE_CODE_2_1_195_PROFILE,
  };
}

function withField(key: string, value: unknown): unknown {
  return { ...(validInput() as Record<string, unknown>), [key]: value };
}

function expectInvalidInput(input: unknown): void {
  expect(() => buildOrderedHeaders(input)).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
}

describe("buildOrderedHeaders input validation", () => {
  // Wrap each case so Vitest passes array values as one callback argument.
  it.each([[null], [[]], ["headers"]])(
    "rejects a non-record input",
    (input) => {
      expectInvalidInput(input);
    },
  );

  it.each([undefined, 7, ""])("rejects accessToken %j", (accessToken) => {
    expectInvalidInput(withField("accessToken", accessToken));
  });

  it("rejects a non-record runtime", () => {
    expectInvalidInput(withField("runtime", null));
  });

  it.each([undefined, "synthetic-beta"])(
    "rejects non-array betaFeatures %j",
    (betaFeatures) => {
      expectInvalidInput(withField("betaFeatures", betaFeatures));
    },
  );

  it.each(["", 3, null])("rejects an invalid beta feature %j", (feature) => {
    expectInvalidInput(withField("betaFeatures", [feature]));
  });

  it("rejects non-array extraHeaders", () => {
    expectInvalidInput(withField("extraHeaders", { name: "x-synthetic" }));
  });

  it.each([
    "x-synthetic",
    ["x-synthetic"],
    ["x-synthetic", "value", "extra"],
    [3, "value"],
    ["x-synthetic", 3],
  ])("rejects malformed extra-header entry %j", (entry) => {
    expectInvalidInput(withField("extraHeaders", [entry]));
  });

  it("rejects a structurally equal but unpinned profile", () => {
    expectInvalidInput(
      withField("profile", { ...CLAUDE_CODE_2_1_195_PROFILE }),
    );
  });

  it.each(["\u0001", "\u001f", "\u007f", "\u0085", "\u009f"])(
    "rejects C0, DEL, and C1 controls U+%s",
    (control) => {
      expect(() =>
        buildOrderedHeaders(
          withField("extraHeaders", [["x-synthetic", `bad${control}value`]]),
        ),
      ).toThrow(expect.objectContaining({ code: "HEADER_INJECTION" }));
    },
  );

  it("rejects duplicate names introduced by two extra headers", () => {
    expect(() =>
      buildOrderedHeaders(
        withField("extraHeaders", [
          ["x-synthetic", "first"],
          ["X-Synthetic", "second"],
        ]),
      ),
    ).toThrow(expect.objectContaining({ code: "DUPLICATE_HEADER" }));
  });

  it("rejects an access token that appears in a non-authorization value", () => {
    expect(() => buildOrderedHeaders(withField("accessToken", "true"))).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });
});
