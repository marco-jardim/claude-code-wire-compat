// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const BASE: ClaudeCodeRequestInput = {
  accessToken: "additional-betas-token",
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
  clientRequestId: "additional-betas-request-1",
};

function headerValue(
  headers: readonly (readonly [string, string])[],
  name: string,
): string {
  const match = headers.find(([candidate]) => candidate === name);
  if (match === undefined) throw new Error(`missing header ${name}`);
  return match[1];
}

describe("additionalBetas seam", () => {
  it("produces byte-identical output when the field is omitted", async () => {
    const withoutField = await buildClaudeCodeRequest(BASE);
    const withEmpty = await buildClaudeCodeRequest({
      ...BASE,
      additionalBetas: [],
    });

    expect(withEmpty.body).toBe(withoutField.body);
    expect(withEmpty.headers).toEqual(withoutField.headers);
    expect(withEmpty.evidence).toEqual(withoutField.evidence);
  });

  it("appends caller betas after the canonical set, preserving caller order", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const built = await buildClaudeCodeRequest({
      ...BASE,
      additionalBetas: ["zulu-2026-01-01", "alpha-2026-01-01"],
    });

    expect(built.evidence.betaFeatures).toEqual([
      ...canonical.evidence.betaFeatures,
      "zulu-2026-01-01",
      "alpha-2026-01-01",
    ]);
  });

  it("keeps the anthropic-beta header in sync with the evidence", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      additionalBetas: ["extra-beta-2026-02-02"],
    });

    expect(headerValue(built.headers, "anthropic-beta")).toBe(
      built.evidence.betaFeatures.join(","),
    );
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it("deduplicates a canonical beta without reordering the canonical set", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const duplicated = canonical.evidence.betaFeatures[0];
    if (duplicated === undefined) throw new Error("no canonical beta to reuse");

    const built = await buildClaudeCodeRequest({
      ...BASE,
      additionalBetas: [duplicated, "tail-beta-2026-03-03"],
    });

    expect(built.evidence.betaFeatures).toEqual([
      ...canonical.evidence.betaFeatures,
      "tail-beta-2026-03-03",
    ]);
  });

  it("deduplicates repeated caller betas idempotently", async () => {
    const once = await buildClaudeCodeRequest({
      ...BASE,
      additionalBetas: ["repeat-2026-04-04"],
    });
    const thrice = await buildClaudeCodeRequest({
      ...BASE,
      additionalBetas: [
        "repeat-2026-04-04",
        "repeat-2026-04-04",
        "repeat-2026-04-04",
      ],
    });

    expect(thrice.evidence.betaFeatures).toEqual(once.evidence.betaFeatures);
  });

  it.each([
    ["empty entry", [""]],
    ["comma separator", ["a,b"]],
    ["whitespace", ["has space"]],
    ["leading punctuation", ["-leading"]],
    ["oversized entry", ["a".repeat(129)]],
    [
      "too many entries",
      Array.from({ length: 33 }, (_, i) => `beta-${String(i)}`),
    ],
  ])("rejects %s with INVALID_INPUT", async (_label, additionalBetas) => {
    await expect(
      buildClaudeCodeRequest({ ...BASE, additionalBetas }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a non-array value", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        additionalBetas: "not-an-array",
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a non-string entry", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        additionalBetas: [1] as unknown as readonly string[],
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
