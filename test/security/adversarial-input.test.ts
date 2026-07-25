// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../../src/index.js";
import {
  referenceAdapter,
  syntheticInput,
} from "../conformance/reference-adapter.js";

const TOKEN = "adversarial-token-sentinel-c66b2d89";
const base = syntheticInput(referenceAdapter("outgoing-foreground.json"));

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

async function expectSafeRejection(input: unknown): Promise<void> {
  try {
    await Reflect.apply(buildClaudeCodeRequest, undefined, [input]);
    throw new Error("Expected adversarial input to be rejected");
  } catch (error) {
    expect(serializedError(error)).not.toContain(TOKEN);
  }
}

describe("additional adversarial public inputs", () => {
  it("rejects NUL and mixed CR/LF injection in string-bearing positions", async () => {
    const injection = `prefix\r\n\0${TOKEN}`;
    const candidates: unknown[] = [
      { ...base, model: injection, accessToken: TOKEN },
      { ...base, system: injection, accessToken: TOKEN },
      {
        ...base,
        messages: [{ role: "user", content: injection }],
        accessToken: TOKEN,
      },
      {
        ...base,
        tools: [{ name: injection, description: injection, inputSchema: {} }],
        accessToken: TOKEN,
      },
      { ...base, metadata: { user_id: injection }, accessToken: TOKEN },
      { ...base, sessionId: injection, accessToken: TOKEN },
      { ...base, clientRequestId: injection, accessToken: TOKEN },
      {
        ...base,
        runtime: {
          runtime: injection,
          runtimeVersion: injection,
          os: injection,
          arch: injection,
        },
        accessToken: TOKEN,
      },
    ];
    for (const candidate of candidates) await expectSafeRejection(candidate);
  });

  it("cannot override transport output through input properties", async () => {
    await expectSafeRejection({
      ...base,
      accessToken: TOKEN,
      url: "https://attacker.invalid/",
      method: "DELETE",
      headers: [["authorization", "attacker"]],
    });
  });

  it("rejects forbidden headers through every reachable nested path", async () => {
    for (const path of [
      "headers",
      "extraHeaders",
      "runtime.headers",
      "metadata.headers",
    ]) {
      const runtime = { ...base.runtime, headers: [["host", "attacker"]] };
      const metadata = { headers: [["content-length", "1"]] };
      const candidate = {
        ...base,
        accessToken: TOKEN,
        ...(path === "headers" ? { headers: [["authorization", TOKEN]] } : {}),
        ...(path === "extraHeaders"
          ? { extraHeaders: [["cookie", TOKEN]] }
          : {}),
        ...(path === "runtime.headers" ? { runtime } : {}),
        ...(path === "metadata.headers" ? { metadata } : {}),
      };
      await expectSafeRejection(candidate);
    }
  });

  it("rejects oversized graphs without disclosing tokens in rich errors", async () => {
    await expectSafeRejection({
      ...base,
      accessToken: TOKEN,
      system: "s".repeat(10_000_001),
      metadata: { safeDetails: TOKEN, cause: TOKEN },
    });
  });
});
