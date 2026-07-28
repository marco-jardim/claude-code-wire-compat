// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * `suppressBetas` is the removal counterpart of `additionalBetas`: a consumer
 * that exposes user switches ("disable experimental betas", round-robin account
 * strategy) has to be able to take a beta OUT of the set this package composes,
 * which no other seam allows. The filter runs last, so suppression beats
 * addition, and an identifier that was never composed is a silent no-op.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const BASE: ClaudeCodeRequestInput = {
  accessToken: "suppress-betas-token",
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
  clientRequestId: "suppress-betas-request-1",
};

function headerValue(
  headers: readonly (readonly [string, string])[],
  name: string,
): string {
  const match = headers.find(([candidate]) => candidate === name);
  if (match === undefined) throw new Error(`missing header ${name}`);
  return match[1];
}

function requireBeta(features: readonly string[], index: number): string {
  const beta = features[index];
  if (beta === undefined)
    throw new Error(`no canonical beta at ${String(index)}`);
  return beta;
}

describe("suppressBetas seam", () => {
  it("produces byte-identical output when the field is omitted", async () => {
    const withoutField = await buildClaudeCodeRequest(BASE);
    const withEmpty = await buildClaudeCodeRequest({
      ...BASE,
      suppressBetas: [],
    });

    expect(withEmpty.body).toBe(withoutField.body);
    expect(withEmpty.headers).toEqual(withoutField.headers);
    expect(withEmpty.evidence).toEqual(withoutField.evidence);
    expect(Object.hasOwn(withEmpty.evidence, "suppressedBetaNames")).toBe(
      false,
    );
  });

  it("removes a beta the package itself composed", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const target = requireBeta(canonical.evidence.betaFeatures, 0);

    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBetas: [target],
    });

    expect(built.evidence.betaFeatures).toEqual(
      canonical.evidence.betaFeatures.filter((beta) => beta !== target),
    );
    expect(built.evidence.betaFeatures).not.toContain(target);
    expect(headerValue(built.headers, "anthropic-beta")).toBe(
      built.evidence.betaFeatures.join(","),
    );
    expect(built.evidence.suppressedBetaNames).toEqual([target]);
  });

  it("removes a beta that arrived through additionalBetas", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const built = await buildClaudeCodeRequest({
      ...BASE,
      additionalBetas: ["kept-2026-01-01", "dropped-2026-01-02"],
      suppressBetas: ["dropped-2026-01-02"],
    });

    expect(built.evidence.betaFeatures).toEqual([
      ...canonical.evidence.betaFeatures,
      "kept-2026-01-01",
    ]);
    expect(built.evidence.suppressedBetaNames).toEqual(["dropped-2026-01-02"]);
  });

  it("lets suppression win over an identifier present in both seams", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const built = await buildClaudeCodeRequest({
      ...BASE,
      additionalBetas: ["contested-2026-02-02"],
      suppressBetas: ["contested-2026-02-02"],
    });

    expect(built.evidence.betaFeatures).toEqual(
      canonical.evidence.betaFeatures,
    );
    expect(built.evidence.suppressedBetaNames).toEqual([
      "contested-2026-02-02",
    ]);
  });

  it("treats an identifier that was never composed as a silent no-op", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBetas: ["never-composed-2026-03-03"],
    });

    expect(built.body).toBe(canonical.body);
    expect(built.headers).toEqual(canonical.headers);
    expect(built.evidence).toEqual(canonical.evidence);
    expect(Object.hasOwn(built.evidence, "suppressedBetaNames")).toBe(false);
  });

  it("preserves the canonical order of the surviving betas", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const first = requireBeta(canonical.evidence.betaFeatures, 0);
    const third = requireBeta(canonical.evidence.betaFeatures, 2);

    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBetas: [third, first],
    });

    const survivors = canonical.evidence.betaFeatures.filter(
      (beta) => beta !== first && beta !== third,
    );
    expect(built.evidence.betaFeatures).toEqual(survivors);
    expect(headerValue(built.headers, "anthropic-beta")).toBe(
      survivors.join(","),
    );
  });

  it("lists only the effectively removed betas, in composed order", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const first = requireBeta(canonical.evidence.betaFeatures, 0);
    const second = requireBeta(canonical.evidence.betaFeatures, 1);

    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBetas: [second, "absent-2026-04-04", first],
    });

    expect(built.evidence.suppressedBetaNames).toEqual([first, second]);
  });

  it("keeps the built request round-trippable through the parser", async () => {
    const canonical = await buildClaudeCodeRequest(BASE);
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBetas: [requireBeta(canonical.evidence.betaFeatures, 0)],
    });

    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
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
  ])("rejects %s with INVALID_INPUT", async (_label, suppressBetas) => {
    await expect(
      buildClaudeCodeRequest({ ...BASE, suppressBetas }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("accepts the maximum accepted entry length and count", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      suppressBetas: [
        "a".repeat(128),
        ...Array.from({ length: 31 }, (_, i) => `absent-${String(i)}`),
      ],
    });

    expect(Object.hasOwn(built.evidence, "suppressedBetaNames")).toBe(false);
  });

  it("refuses to record a suppressed name that carries the access token", async () => {
    // The name is not EQUAL to the access token, so the input-graph scan lets
    // it through; it only reaches evidence because suppression removed it, and
    // the redaction screen is what has to catch the embedded credential.
    const smuggled = `x-forwarded-${BASE.accessToken}`;

    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        additionalBetas: [smuggled],
        suppressBetas: [smuggled],
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a non-array value", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        suppressBetas: "not-an-array",
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a non-string entry", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        suppressBetas: [1] as unknown as readonly string[],
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
