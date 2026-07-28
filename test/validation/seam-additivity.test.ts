// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Non-breaking criterion for the three package-extension seams
 * (`additionalBetas`, `betaOverrides`, `cacheControl.suppressIdentityBlock`).
 *
 * Each case builds the SAME request twice: once without the seam field and once
 * with the seam field in its no-op form. The two results must be identical in
 * `body` (byte for byte), `headers` and `evidence` — the whole built object, not
 * a hand-picked subset — otherwise the seam is not additive.
 */

import { describe, expect, it } from "vitest";

import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeRequestInput,
} from "../../src/index.js";
import { buildClaudeCodeRequest } from "../../src/index.js";

const BASE: ClaudeCodeRequestInput = {
  accessToken: "seam-additivity-token",
  model: "claude-sonnet-4-6",
  maxTokens: 2048,
  messages: [
    { role: "user", content: "hello wire compat" },
    { role: "assistant", content: "acknowledged" },
    { role: "user", content: [{ type: "text", text: "second turn" }] },
  ],
  system: ["caller supplied guidance", "second caller block"],
  tools: [
    {
      name: "read_file",
      description: "reads a file",
      input_schema: { type: "object", properties: {} },
    },
  ],
  runtime: {
    sessionId: "11111111-1111-4111-8111-111111111111",
    deviceId: "22222222-2222-4222-8222-222222222222",
    accountUuid: "33333333-3333-4333-8333-333333333333",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  metadata: { correlation: "seam-additivity" },
  clientRequestId: "seam-additivity-request-1",
};

const CACHE_BASE = {
  enabled: true,
  ttl: "5m",
  systemBreakpoint: true,
  toolBreakpoint: true,
  messageBreakpoint: true,
} as const;

function encodedLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function expectIdentical(
  actual: BuiltClaudeCodeRequest,
  expected: BuiltClaudeCodeRequest,
): void {
  expect(actual.body).toBe(expected.body);
  expect(encodedLength(actual.body)).toBe(encodedLength(expected.body));
  expect(actual.headers).toEqual(expected.headers);
  expect(actual.evidence).toEqual(expected.evidence);
  expect(Object.keys(actual.evidence.capabilityDecisions).sort()).toEqual(
    Object.keys(expected.evidence.capabilityDecisions).sort(),
  );
  expect(actual).toEqual(expected);
}

const CASES: readonly (readonly [
  string,
  ClaudeCodeRequestInput,
  ClaudeCodeRequestInput,
])[] = [
  ["additionalBetas omitted vs empty", BASE, { ...BASE, additionalBetas: [] }],
  ["betaOverrides omitted vs empty", BASE, { ...BASE, betaOverrides: {} }],
  [
    "suppressIdentityBlock omitted vs explicit false",
    { ...BASE, cacheControl: CACHE_BASE },
    { ...BASE, cacheControl: { ...CACHE_BASE, suppressIdentityBlock: false } },
  ],
  [
    "no cacheControl vs all three seams in no-op form",
    BASE,
    { ...BASE, additionalBetas: [], betaOverrides: {} },
  ],
  [
    "cacheControl present vs all three seams in no-op form",
    { ...BASE, cacheControl: CACHE_BASE },
    {
      ...BASE,
      cacheControl: { ...CACHE_BASE, suppressIdentityBlock: false },
      additionalBetas: [],
      betaOverrides: {},
    },
  ],
];

describe("package-extension seam additivity", () => {
  it.each(CASES)(
    "%s produces an identical request",
    async (_l, left, right) => {
      expectIdentical(
        await buildClaudeCodeRequest(right),
        await buildClaudeCodeRequest(left),
      );
    },
  );

  it("keeps evidence free of the override key on every no-op form", async () => {
    for (const [, left, right] of CASES) {
      for (const input of [left, right]) {
        const built = await buildClaudeCodeRequest(input);
        expect(
          Object.hasOwn(built.evidence.capabilityDecisions, "use1MContext"),
        ).toBe(false);
      }
    }
  });
});
