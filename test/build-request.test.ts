// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the complete request-builder surface.
 * Wave 2 must export `buildClaudeCodeRequest(input, profile?): Promise<BuiltClaudeCodeRequest>`
 * and `parseBuiltClaudeCodeRequest(value: unknown, profile?): BuiltClaudeCodeRequest`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { BuiltClaudeCodeRequest, HeaderPair } from "../src/contracts.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "./support/wave2-modules.js";

type BuildClaudeCodeRequest = (
  input: unknown,
  profile?: unknown,
) => Promise<BuiltClaudeCodeRequest>;
type ParseBuiltClaudeCodeRequest = (
  value: unknown,
  profile?: unknown,
) => BuiltClaudeCodeRequest;

const ENDPOINT = "https://api.anthropic.com/v1/messages?beta=true";
const GOLDENS = [
  "outgoing-foreground.json",
  "outgoing-canary-context-hint-off.json",
] as const;

interface GoldenFixture {
  readonly url: string;
  readonly method: string;
  readonly headers: readonly HeaderPair[];
  readonly body: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string")
    throw new TypeError(`${field} must be a string.`);
  return value;
}

function parseHeaders(value: unknown): readonly HeaderPair[] {
  if (!Array.isArray(value)) throw new TypeError("headers must be an array.");
  return value.map((pair: unknown) => {
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      typeof pair[0] !== "string" ||
      typeof pair[1] !== "string"
    ) {
      throw new TypeError("header must be a string pair.");
    }
    return [pair[0], pair[1]];
  });
}

function readGolden(filename: string): GoldenFixture {
  const parsed: unknown = JSON.parse(
    readFileSync(
      new URL(`./fixtures/golden/${filename}`, import.meta.url),
      "utf8",
    ),
  );
  if (!isRecord(parsed) || !isRecord(parsed["body"])) {
    throw new TypeError("Golden fixture is malformed.");
  }
  return {
    url: requireString(parsed["url"], "url"),
    method: requireString(parsed["method"], "method"),
    headers: parseHeaders(parsed["headers"]),
    body: parsed["body"],
  };
}

function headerValue(golden: GoldenFixture, name: string): string {
  const value = golden.headers.find(([candidate]) => candidate === name)?.[1];
  if (value === undefined)
    throw new TypeError(`Missing golden header ${name}.`);
  return value;
}

function syntheticInput(golden: GoldenFixture): Record<string, unknown> {
  const body = golden.body;
  const metadata = body["metadata"];
  if (!isRecord(metadata)) throw new TypeError("Golden metadata is missing.");
  const encodedIdentity = requireString(
    metadata["user_id"],
    "metadata.user_id",
  );
  const identity: unknown = JSON.parse(encodedIdentity);
  if (!isRecord(identity)) throw new TypeError("Golden identity is malformed.");
  const system = body["system"];
  if (!Array.isArray(system)) throw new TypeError("Golden system is missing.");
  const input: Record<string, unknown> = {
    accessToken: headerValue(golden, "authorization").replace(/^Bearer /u, ""),
    model: body["model"],
    maxTokens: body["max_tokens"],
    messages: body["messages"],
    system: system.slice(2),
    runtime: {
      sessionId: identity["session_id"],
      deviceId: identity["device_id"],
      accountUuid: identity["account_uuid"],
      runtime: headerValue(golden, "x-stainless-runtime"),
      runtimeVersion: headerValue(golden, "x-stainless-runtime-version"),
      os: headerValue(golden, "x-stainless-os"),
      arch: headerValue(golden, "x-stainless-arch"),
    },
    clientRequestId: headerValue(golden, "x-client-request-id"),
  };
  if (body["tools"] !== undefined) input["tools"] = body["tools"];
  if (body["thinking"] !== undefined) input["thinking"] = body["thinking"];
  if (isRecord(body["output_config"])) {
    input["effort"] = body["output_config"]["effort"];
  }
  return input;
}

function deepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) =>
    deepFrozen(Reflect.get(value, key)),
  );
}

describe("build-request (Wave 1 RED specification)", () => {
  it("records that the Wave 2 module must be implemented", async () => {
    await expect(expectModuleUnimplemented("build-request")).resolves.toBe(
      false,
    );
  });

  it.each(GOLDENS)("is byte-exact with %s", async (filename) => {
    const build = await loadWave2Function<BuildClaudeCodeRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const golden = readGolden(filename);
    const built = await build(syntheticInput(golden));
    expect(built.url).toBe(golden.url);
    expect(built.method).toBe(golden.method);
    expect(built.headers).toEqual(golden.headers);
    expect(JSON.parse(built.body)).toEqual(golden.body);
  });

  it("pins endpoint and method against caller overrides", async () => {
    const build = await loadWave2Function<BuildClaudeCodeRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const input = {
      ...syntheticInput(readGolden(GOLDENS[0])),
      url: "https://invalid.example.test/",
      method: "DELETE",
    };
    try {
      const built = await build(input);
      expect(built.url).toBe(ENDPOINT);
      expect(built.method).toBe("POST");
    } catch (error: unknown) {
      expect(error).toEqual(expect.objectContaining({ code: "INVALID_INPUT" }));
    }
  });

  it("produces independently verifiable, redacted evidence", async () => {
    const build = await loadWave2Function<BuildClaudeCodeRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const golden = readGolden(GOLDENS[0]);
    const input = syntheticInput(golden);
    const token = requireString(input["accessToken"], "accessToken");
    const rawMarker = "raw-input-marker-95df86";
    input["messages"] = [{ role: "user", content: rawMarker }];
    const built = await build(input);
    expect(built.evidence.bodySha256).toBe(
      createHash("sha256").update(built.body, "utf8").digest("hex"),
    );
    expect(built.evidence.bodyByteLength).toBe(
      Buffer.byteLength(built.body, "utf8"),
    );
    expect(built.body).not.toContain(token);
    expect(JSON.stringify(built.evidence)).not.toContain(token);
    expect(JSON.stringify(built.evidence)).not.toContain(rawMarker);
  });

  it("round-trips into a new deeply frozen value", async () => {
    const build = await loadWave2Function<BuildClaudeCodeRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const parse = await loadWave2Function<ParseBuiltClaudeCodeRequest>(
      "build-request",
      "parseBuiltClaudeCodeRequest",
    );
    const built = await build(syntheticInput(readGolden(GOLDENS[0])));
    const parsed = parse(built);
    expect(parsed).toEqual(built);
    expect(parsed).not.toBe(built);
    expect(deepFrozen(parsed)).toBe(true);
  });

  it("rejects adversarial parsed request variants", async () => {
    const build = await loadWave2Function<BuildClaudeCodeRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const parse = await loadWave2Function<ParseBuiltClaudeCodeRequest>(
      "build-request",
      "parseBuiltClaudeCodeRequest",
    );
    const built = await build(syntheticInput(readGolden(GOLDENS[0])));
    const wrongSessionHeaders = built.headers.map(
      ([name, value]): HeaderPair => [
        name,
        name === "x-claude-code-session-id" ? "different-session" : value,
      ],
    );
    const variants: readonly unknown[] = [
      { ...built, unexpected: true },
      { ...built, url: "https://invalid.example.test/" },
      { ...built, method: "GET" },
      { ...built, headers: [...built.headers, ["cookie", "forbidden"]] },
      { ...built, evidence: { ...built.evidence, bodySha256: "0".repeat(64) } },
      {
        ...built,
        evidence: { ...built.evidence, bodyByteLength: built.body.length + 1 },
      },
      { ...built, headers: wrongSessionHeaders },
    ];
    for (const variant of variants) expect(() => parse(variant)).toThrow();
  });

  it("never mutates input and deeply freezes its result", async () => {
    const build = await loadWave2Function<BuildClaudeCodeRequest>(
      "build-request",
      "buildClaudeCodeRequest",
    );
    const input = syntheticInput(readGolden(GOLDENS[0]));
    const before = structuredClone(input);
    const built = await build(input);
    expect(input).toEqual(before);
    expect(deepFrozen(built)).toBe(true);
  });
});
