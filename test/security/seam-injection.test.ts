// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * The `additionalBetas` seam is the only caller input that lands verbatim in a
 * request header, and `anthropic-beta` is a single comma-joined field. That
 * makes it the natural forging surface: a comma smuggles an extra beta value, a
 * CR/LF smuggles an entirely separate header, and a canonical identifier
 * smuggles a duplicate. All three must fail closed, and no rejection may echo
 * the access token.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import { buildClaudeCodeRequest } from "../../src/index.js";

const TOKEN = "seam-injection-token-sentinel-4b17ac";

const BASE: ClaudeCodeRequestInput = {
  accessToken: TOKEN,
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
  clientRequestId: "seam-injection-request-1",
};

function serializedError(value: unknown): string {
  if (value instanceof Error) {
    return JSON.stringify({
      message: value.message,
      stack: value.stack,
      cause: value.cause,
      ...Object.fromEntries(Object.entries(value)),
    });
  }
  return JSON.stringify(value);
}

async function expectRejection(input: unknown, code: string): Promise<void> {
  try {
    await Reflect.apply(buildClaudeCodeRequest, undefined, [input]);
    throw new Error("Expected the adversarial seam input to be rejected");
  } catch (error) {
    expect(serializedError(error)).not.toContain(TOKEN);
    expect(error).toMatchObject({ code });
  }
}

describe("additionalBetas injection surface", () => {
  it.each([
    ["CRLF header split", "evil-beta\r\nx-forged: 1"],
    ["bare CR", "evil-beta\rx-forged: 1"],
    ["bare LF", "evil-beta\nx-forged: 1"],
    ["NUL byte", "evil-beta\u0000"],
    ["DEL", "evil-beta\u007f"],
    ["vertical tab", "evil-beta\u000b"],
  ])(
    "rejects %s as INVALID_UNICODE before header assembly",
    async (_l, beta) => {
      await expectRejection(
        { ...BASE, additionalBetas: [beta] },
        "INVALID_UNICODE",
      );
    },
  );

  it.each([
    ["comma smuggling a second beta", "evil-beta,oauth-2025-04-20"],
    ["trailing comma", "evil-beta,"],
    ["leading comma", ",evil-beta"],
    ["bare comma", ","],
    ["space-separated pair", "evil-beta other-beta"],
    ["colon, as in a header line", "x-forged: 1"],
    ["semicolon parameter", "evil-beta;q=1"],
    ["empty identifier", ""],
    ["leading dot", ".evil-beta"],
    ["leading hyphen", "-evil-beta"],
    ["unicode lookalike comma", "evil\uff0cbeta"],
    ["zero-width joiner", "evil\u200dbeta"],
  ])("rejects %s as INVALID_INPUT", async (_l, beta) => {
    await expectRejection(
      { ...BASE, additionalBetas: [beta] },
      "INVALID_INPUT",
    );
  });

  it("rejects an oversized identifier and an oversized list", async () => {
    await expectRejection(
      { ...BASE, additionalBetas: ["a".repeat(129)] },
      "INVALID_INPUT",
    );
    await expectRejection(
      {
        ...BASE,
        additionalBetas: Array.from(
          { length: 33 },
          (_unused, index) => `beta-${String(index)}`,
        ),
      },
      "INVALID_INPUT",
    );
  });

  it("cannot duplicate a canonical beta into the emitted header", async () => {
    const canonical = await buildClaudeCodeRequest({
      ...BASE,
      accessToken: "canonical-probe-token",
    });
    const built = await buildClaudeCodeRequest({
      ...BASE,
      accessToken: "canonical-probe-token",
      additionalBetas: [...canonical.evidence.betaFeatures].reverse(),
    });

    expect(built.evidence.betaFeatures).toEqual(
      canonical.evidence.betaFeatures,
    );
    const header = built.headers.find(([name]) => name === "anthropic-beta");
    expect(header?.[1]).toBe(canonical.evidence.betaFeatures.join(","));
  });

  it("cannot forge a second header through the beta list", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      accessToken: "forge-probe-token",
      additionalBetas: ["x-forged-2026-01-01"],
    });
    const names = built.headers.map(([name]) => name);

    expect(names.filter((name) => name === "anthropic-beta")).toHaveLength(1);
    expect(names).not.toContain("x-forged-2026-01-01");
    expect(names).toEqual(built.evidence.logicalHeaderNames);
  });

  it("never leaks the access token through a beta list carrying it", async () => {
    await expectRejection(
      { ...BASE, additionalBetas: [TOKEN] },
      "INVALID_INPUT",
    );
  });
});

describe("betaOverrides and suppressIdentityBlock injection surface", () => {
  it("rejects a prototype-pollution payload in betaOverrides", async () => {
    const payload: unknown = JSON.parse('{"__proto__":{"polluted":true}}');
    await expectRejection({ ...BASE, betaOverrides: payload }, "INVALID_INPUT");
  });

  it("rejects a truthy non-boolean override", async () => {
    await expectRejection(
      { ...BASE, betaOverrides: { use1MContext: 1 } },
      "INVALID_INPUT",
    );
  });

  it("rejects a truthy non-boolean suppression flag", async () => {
    await expectRejection(
      { ...BASE, cacheControl: { suppressIdentityBlock: 1 } },
      "INVALID_INPUT",
    );
  });

  it("cannot remove the billing block through suppression", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      accessToken: "suppression-probe-token",
      cacheControl: { suppressIdentityBlock: true },
    });
    const parsed: unknown = JSON.parse(built.body);
    const system = isRecord(parsed) ? parsed["system"] : undefined;

    expect(Array.isArray(system)).toBe(true);
    expect(Array.isArray(system) ? system.length : -1).toBe(2);
    expect(built.evidence.systemBlockCount).toBe(0);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
