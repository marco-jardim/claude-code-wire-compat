// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for runtime-neutral core behavior.
 * Wave 2 must export `buildClaudeCodeRequest(input, profile?): Promise<BuiltClaudeCodeRequest>`
 * and consume an injected `Crypto`-compatible `subtle.digest` implementation.
 */
import { createHash, webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { builtinModules } from "node:module";

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

function sourceFiles(directory: URL): readonly URL[] {
  const files: URL[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory())
      files.push(...sourceFiles(new URL(`${entry.name}/`, directory)));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(url);
  }
  return files;
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

  it("keeps every source module free of ambient runtime dependencies", () => {
    const builtins = new Set(
      builtinModules.flatMap((name) => [name, name.replace(/^node:/u, "")]),
    );
    const src = new URL("../../src/", import.meta.url);
    for (const file of sourceFiles(src)) {
      const text = readFileSync(file, "utf8");
      const importSpecifiers = [
        ...text.matchAll(/(?:from\s+|import\s*\()(["'])([^"']+)\1/gu),
      ];
      for (const match of importSpecifiers) {
        const specifier = match[2];
        expect(specifier).toBeDefined();
        if (specifier !== undefined) {
          expect(builtins.has(specifier.replace(/^node:/u, ""))).toBe(false);
        }
      }
      expect(text).not.toMatch(/\bprocess\b|\bBuffer\b|__dirname|__filename/gu);
      expect(text).not.toMatch(/\brequire\s*\(|\bfetch\s*\(/gu);
      expect(text).not.toMatch(/\bset(?:Timeout|Interval)\s*\(/gu);
      expect(text).not.toMatch(/\bDate\.now\s*\(|\bnew\s+Date\s*\(/gu);
      expect(text).not.toMatch(/\bMath\.random\s*\(/gu);
    }
  });

  it("imports the package entry idempotently without global side effects", async () => {
    const globalsBefore = Reflect.ownKeys(globalThis);
    const first = await import("../../src/index.js");
    const globalsAfterFirst = Reflect.ownKeys(globalThis);
    const second = await import("../../src/index.js");
    expect(second).toBe(first);
    expect(globalsAfterFirst).toEqual(globalsBefore);
    expect(Reflect.ownKeys(globalThis)).toEqual(globalsBefore);
  });

  it("uses only an injected subtle.digest and produces the expected fingerprint", async () => {
    const build = await loadWave2Function<BuildRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const systemText = "runtime-neutral synthetic system";
    const request = input(systemText, "hello");
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
    expect(billing["text"]).toContain(
      `cc_version=2.1.195.${fingerprint(systemText)}`,
    );
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
