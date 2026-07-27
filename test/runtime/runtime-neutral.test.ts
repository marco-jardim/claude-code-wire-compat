// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for runtime-neutral core behavior.
 * Wave 2 must export `buildClaudeCodeRequest(input, profile?): Promise<BuiltClaudeCodeRequest>`
 * and consume an injected `Crypto`-compatible `subtle.digest` implementation.
 */
import { createHash, webcrypto } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { BuiltClaudeCodeRequest } from "../../src/contracts.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "../support/wave2-modules.js";

type BuildRequest = (input: unknown) => Promise<BuiltClaudeCodeRequest>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function input(system: string, message: string): Record<string, unknown> {
  return {
    accessToken: "runtime-neutral-synthetic-token",
    model: "claude-sonnet-4-5",
    maxTokens: 128,
    messages: [{ role: "user", content: message }],
    system: [system],
    runtime: {
      sessionId: "00000000-0000-4000-8000-000000000001",
      deviceId: "device-synthetic",
      accountUuid: "00000000-0000-4000-8000-000000000000",
      runtime: "node",
      runtimeVersion: "v24.15.0",
      os: "Windows",
      arch: "x64",
    },
    clientRequestId: "00000000-0000-4000-8000-000000000002",
  };
}

function fingerprint(text: string): string {
  const payload = `59cf53e54c78${text[4] ?? "0"}${text[7] ?? "0"}${text[20] ?? "0"}2.1.195`;
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 3);
}

describe("runtime/runtime-neutral (Wave 1 RED specification)", () => {
  it("records that the Wave 2 module must be implemented", async () => {
    await expect(expectModuleUnimplemented("build-request")).resolves.toBe(
      false,
    );
  });

  it("imports the package entry without global side effects and exposes only public runtime values", async () => {
    const globalsBefore = Reflect.ownKeys(globalThis);
    const first = await import("../../src/index.js");
    const globalsAfterFirst = Reflect.ownKeys(globalThis);
    // The public runtime surface is a CLOSED set. Wave 1 froze the skeleton at
    // the profile and the typed error; Wave 2 Task 2.3 adds exactly the builder
    // and the parser. Type-only exports are erased and never appear here, so any
    // additional runtime export — including an accidental internal helper —
    // fails this assertion.
    expect(Object.keys(first).sort()).toEqual([
      "CLAUDE_CODE_2_1_195_PROFILE",
      "ClaudeCodeWireError",
      "DEFAULT_ANTI_VERBOSITY_POLICY",
      "antiVerbosityText",
      "buildClaudeCodeCountTokensRequest",
      "buildClaudeCodeRequest",
      "parseBuiltClaudeCodeRequest",
      "selectAntiVerbositySection",
    ]);
    expect(globalsAfterFirst).toEqual(globalsBefore);
    expect(Reflect.ownKeys(globalThis)).toEqual(globalsBefore);
  });

  it("uses only an injected subtle.digest and produces the expected fingerprint", async () => {
    const build = await loadWave2Function<BuildRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const systemText = "runtime-neutral synthetic system";
    const messageText = "hello";
    const request = input(systemText, messageText);
    request["crypto"] = {
      subtle: { digest: webcrypto.subtle.digest.bind(webcrypto.subtle) },
    };
    const built = await build(request);
    const body: unknown = JSON.parse(built.body);
    if (!isRecord(body) || !Array.isArray(body["system"])) {
      throw new TypeError("Canonical body system is missing.");
    }
    const billing: unknown = body["system"][0];
    if (!isRecord(billing) || typeof billing["text"] !== "string") {
      throw new TypeError("Canonical billing block is missing.");
    }
    // The fingerprint is seeded by the FIRST USER MESSAGE, never by the system
    // prompt (upstream `lib/mimicry/system-prompt.mjs:134,143`). Asserting the
    // system text here previously drove the builder to an invented
    // system-vs-message branch that broke golden parity.
    expect(billing["text"]).toContain(
      `cc_version=2.1.195.${fingerprint(messageText)}`,
    );
    expect(billing["text"]).not.toContain(fingerprint(systemText));
  });

  it("does not retain mutable state between builder calls", async () => {
    const build = await loadWave2Function<BuildRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const crypto = {
      subtle: { digest: webcrypto.subtle.digest.bind(webcrypto.subtle) },
    };
    const firstInput = { ...input("system-one", "message-one"), crypto };
    const secondInput = { ...input("system-two", "message-two"), crypto };
    const first = await build(firstInput);
    const second = await build(secondInput);
    expect(first.body).toContain("message-one");
    expect(first.body).not.toContain("message-two");
    expect(second.body).toContain("message-two");
    expect(second.body).not.toContain("message-one");
    expect(first.body).not.toBe(second.body);
  });
});
