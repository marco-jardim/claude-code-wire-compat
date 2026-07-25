// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the canonical logical-header surface.
 * Wave 2 must export `buildOrderedHeaders(input): readonly HeaderPair[]`.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { HeaderPair } from "../src/contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "./support/wave2-modules.js";

type BuildOrderedHeaders = (input: unknown) => readonly HeaderPair[];

const TOKEN = "sentinel-token-headers-7db63e";
const SESSION_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_REQUEST_ID = "00000000-0000-4000-8000-000000000002";
const RUNTIME = Object.freeze({
  sessionId: SESSION_ID,
  deviceId: "device-synthetic",
  accountUuid: "00000000-0000-4000-8000-000000000000",
  runtime: "node",
  runtimeVersion: "v24.15.0",
  os: "Windows",
  arch: "x64",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function goldenHeaders(): readonly HeaderPair[] {
  const parsed: unknown = JSON.parse(
    readFileSync(
      new URL("./fixtures/golden/outgoing-foreground.json", import.meta.url),
      "utf8",
    ),
  );
  if (!isRecord(parsed) || !Array.isArray(parsed["headers"])) {
    throw new TypeError("Golden fixture headers are missing.");
  }
  return parsed["headers"].map((pair: unknown) => {
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      typeof pair[0] !== "string" ||
      typeof pair[1] !== "string"
    ) {
      throw new TypeError("Golden fixture header is not a string pair.");
    }
    return [pair[0], pair[1]];
  });
}

function baseInput(extraHeaders: readonly HeaderPair[] = []): unknown {
  const expected = goldenHeaders();
  const beta = expected.find(([name]) => name === "anthropic-beta")?.[1];
  if (beta === undefined) throw new TypeError("Golden beta header is missing.");
  return {
    accessToken: TOKEN,
    runtime: RUNTIME,
    clientRequestId: CLIENT_REQUEST_ID,
    betaFeatures: beta.split(","),
    extraHeaders,
    profile: CLAUDE_CODE_2_1_195_PROFILE,
  };
}

describe("headers (Wave 1 RED specification)", () => {
  it("records that the Wave 2 module must be implemented", async () => {
    await expect(expectModuleUnimplemented("headers")).resolves.toBe(false);
  });

  it("matches the committed golden logical order and values", async () => {
    const build = await loadWave2Function<BuildOrderedHeaders>(
      "headers",
      "buildOrderedHeaders",
    );
    const expected = goldenHeaders().map(([name, value]): HeaderPair => [
      name,
      name === "authorization" ? `Bearer ${TOKEN}` : value,
    ]);
    expect(build(baseInput())).toEqual(expected);
  });

  it("emits lowercase names, the pinned user agent, and the session id", async () => {
    const build = await loadWave2Function<BuildOrderedHeaders>(
      "headers",
      "buildOrderedHeaders",
    );
    const result = build(baseInput());
    for (const [name] of result) expect(name).not.toMatch(/[A-Z]/u);
    expect(result).toContainEqual([
      "user-agent",
      CLAUDE_CODE_2_1_195_PROFILE.userAgent,
    ]);
    expect(result).toContainEqual(["x-claude-code-session-id", SESSION_ID]);
  });

  it("places the bearer token only in authorization", async () => {
    const build = await loadWave2Function<BuildOrderedHeaders>(
      "headers",
      "buildOrderedHeaders",
    );
    const result = build(baseInput());
    const authorization = result.filter(([name]) => name === "authorization");
    expect(authorization).toEqual([["authorization", `Bearer ${TOKEN}`]]);
    for (const [name, value] of result) {
      if (name !== "authorization") expect(value).not.toContain(TOKEN);
    }
  });

  it("rejects case-insensitive duplicate logical headers", async () => {
    const build = await loadWave2Function<BuildOrderedHeaders>(
      "headers",
      "buildOrderedHeaders",
    );
    expect(() => build(baseInput([["User-Agent", "duplicate"]]))).toThrow(
      expect.objectContaining({ code: "DUPLICATE_HEADER" }),
    );
  });

  it.each([
    "x-api-key",
    "cookie",
    "set-cookie",
    "proxy-authorization",
    "proxy-synthetic",
    "forwarded",
    "x-forwarded-for",
  ])("rejects forbidden header %s", async (name) => {
    const build = await loadWave2Function<BuildOrderedHeaders>(
      "headers",
      "buildOrderedHeaders",
    );
    expect(() => build(baseInput([[name, "synthetic"]]))).toThrow(
      expect.objectContaining({ code: "FORBIDDEN_HEADER" }),
    );
  });

  it.each([
    ["bad\rname", "value"],
    ["bad\nname", "value"],
    ["bad\r\nname", "value"],
    ["bad\u0000name", "value"],
    ["x-synthetic", "bad\rvalue"],
    ["x-synthetic", "bad\nvalue"],
    ["x-synthetic", "bad\r\nvalue"],
    ["x-synthetic", "bad\u0000value"],
  ] as const)("rejects injection in %s", async (name, value) => {
    const build = await loadWave2Function<BuildOrderedHeaders>(
      "headers",
      "buildOrderedHeaders",
    );
    expect(() => build(baseInput([[name, value]]))).toThrow(
      expect.objectContaining({ code: "HEADER_INJECTION" }),
    );
  });

  it("deeply freezes canonical logical pairs", async () => {
    const build = await loadWave2Function<BuildOrderedHeaders>(
      "headers",
      "buildOrderedHeaders",
    );
    const result = build(baseInput());
    const canonical = structuredClone(result);
    expect(Object.isFrozen(result)).toBe(true);
    for (const pair of result) expect(Object.isFrozen(pair)).toBe(true);
    const first = result[0];
    expect(first).toBeDefined();
    if (first !== undefined)
      expect(Reflect.set(first, "0", "changed")).toBe(false);
    expect(result).toEqual(canonical);
  });

  it("preserves logical set/value equivalence through standard Headers", async () => {
    const build = await loadWave2Function<BuildOrderedHeaders>(
      "headers",
      "buildOrderedHeaders",
    );
    const pairs = build(baseInput());
    // The package guarantees canonical LOGICAL order only. Headers/fetch/undici
    // may normalize, combine, or reorder fields on the wire; no test may assert
    // on-wire ordering.
    const standard = new Headers(pairs);
    for (const [name, value] of pairs) expect(standard.get(name)).toBe(value);
    expect([...standard.keys()].sort()).toEqual(
      [...new Set(pairs.map(([name]) => name))].sort(),
    );
  });
});
