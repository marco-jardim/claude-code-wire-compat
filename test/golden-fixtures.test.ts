// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const GOLDEN_SCHEMA = "claude-code-wire-compat/golden/v1";
const PROFILE_ID = "claude-code-2.1.195-sdk-0.94.0";
const MESSAGES_URL = "https://api.anthropic.com/v1/messages?beta=true";
const IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";
const FIXTURE_FILENAMES = [
  "outgoing-foreground.json",
  "outgoing-canary-context-hint-off.json",
] as const;
const ALL_FIXTURE_FILENAMES = [
  ...FIXTURE_FILENAMES,
  "decision-context-hint-rejected.json",
] as const;
const ALLOWED_UUIDS = new Set([
  "00000000-0000-4000-8000-000000000000",
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
]);

type Header = readonly [name: string, value: string];

interface SystemBlock {
  readonly text: string;
  readonly cache_control?: {
    readonly type: string;
    readonly ttl?: string;
  };
}

interface GoldenBody {
  readonly system: readonly SystemBlock[];
  readonly [key: string]: unknown;
}

interface GoldenFixture {
  readonly $schema: string;
  readonly name: string;
  readonly profileId: string;
  readonly url: string;
  readonly method: string;
  readonly headers: readonly Header[];
  readonly body: GoldenBody;
  readonly notes: string;
}

function fixtureUrl(filename: string): URL {
  return new URL(`./fixtures/golden/${filename}`, import.meta.url);
}

function readFixture(filename: string): string {
  return readFileSync(fixtureUrl(filename), "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new TypeError("Expected a JSON object fixture.");
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string")
    throw new TypeError(`${field} must be a string.`);
  return value;
}

function parseHeaders(value: unknown): readonly Header[] {
  if (!Array.isArray(value)) throw new TypeError("headers must be an array.");
  return value.map((entry) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string" ||
      typeof entry[1] !== "string"
    ) {
      throw new TypeError("Each header must be a string pair.");
    }
    return [entry[0], entry[1]];
  });
}

function parseSystem(value: unknown): readonly SystemBlock[] {
  if (!Array.isArray(value))
    throw new TypeError("body.system must be an array.");
  return value.map((entry) => {
    if (!isRecord(entry))
      throw new TypeError("Each system block must be an object.");
    const text = requireString(entry.text, "system.text");
    if (entry.cache_control === undefined) return { text };
    if (!isRecord(entry.cache_control)) {
      throw new TypeError("cache_control must be an object.");
    }
    const type = requireString(entry.cache_control.type, "cache_control.type");
    if (entry.cache_control.ttl === undefined) {
      return { text, cache_control: { type } };
    }
    return {
      text,
      cache_control: {
        type,
        ttl: requireString(entry.cache_control.ttl, "cache_control.ttl"),
      },
    };
  });
}

function parseGolden(text: string): GoldenFixture {
  const value = parseRecord(text);
  if (!isRecord(value.body)) throw new TypeError("body must be an object.");
  return {
    $schema: requireString(value.$schema, "$schema"),
    name: requireString(value.name, "name"),
    profileId: requireString(value.profileId, "profileId"),
    url: requireString(value.url, "url"),
    method: requireString(value.method, "method"),
    headers: parseHeaders(value.headers),
    body: { ...value.body, system: parseSystem(value.body.system) },
    notes: requireString(value.notes, "notes"),
  };
}

function sha256(text: string | Buffer): string {
  return createHash("sha256").update(text).digest("hex");
}

describe("golden fixtures", () => {
  it.each(FIXTURE_FILENAMES)("validates the %s schema", (filename) => {
    const raw = parseRecord(readFixture(filename));
    expect(Object.keys(raw)).toEqual([
      "$schema",
      "name",
      "profileId",
      "url",
      "method",
      "headers",
      "body",
      "notes",
    ]);
    const fixture = parseGolden(JSON.stringify(raw));
    expect(fixture.$schema).toBe(GOLDEN_SCHEMA);
    expect(fixture.method).toBe("POST");
    expect(fixture.url).toBe(MESSAGES_URL);
    expect(fixture.profileId).toBe(PROFILE_ID);
  });

  it("matches every fixture hash in the manifest", () => {
    const manifest = parseRecord(readFixture("manifest.json"));
    expect(manifest.sourceCommit).toBe(
      "466d500084b59651798bf38bf24d21f3cb850db6",
    );
    if (!isRecord(manifest.fixtures))
      throw new TypeError("manifest.fixtures must be an object.");
    expect(Object.keys(manifest.fixtures)).toEqual(ALL_FIXTURE_FILENAMES);
    for (const filename of ALL_FIXTURE_FILENAMES) {
      expect(sha256(readFileSync(fixtureUrl(filename)))).toBe(
        manifest.fixtures[filename],
      );
    }
  });

  it.each(ALL_FIXTURE_FILENAMES)(
    "contains no private data in %s",
    (filename) => {
      const text = readFixture(filename);
      expect(text).not.toMatch(/sk-ant-/iu);
      expect(text).not.toMatch(/xxhash/iu);
      for (const match of text.matchAll(/Bearer\s+[^\s"\\]+/giu)) {
        expect(match[0]).toBe("Bearer REDACTED_SYNTHETIC_TOKEN");
      }
      for (const match of text.matchAll(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu,
      )) {
        expect(ALLOWED_UUIDS.has(match[0].toLowerCase())).toBe(true);
      }
    },
  );

  it.each(FIXTURE_FILENAMES)(
    "preserves system block order in %s",
    (filename) => {
      const raw = parseRecord(readFixture(filename));
      if (!isRecord(raw.body)) throw new TypeError("body must be an object.");
      if (!Array.isArray(raw.body.system)) {
        throw new TypeError("body.system must be an array.");
      }
      const rawBilling: unknown = raw.body.system[0];
      const rawIdentity: unknown = raw.body.system[1];
      if (!isRecord(rawBilling) || !isRecord(rawIdentity)) {
        throw new TypeError("Expected billing and identity system blocks.");
      }
      const fixture = parseGolden(JSON.stringify(raw));
      const billing = fixture.body.system[0];
      const identity = fixture.body.system[1];
      expect(billing?.text).toContain("cch=00000;");
      expect(Object.hasOwn(rawBilling, "cache_control")).toBe(false);
      expect(Object.hasOwn(rawIdentity, "cache_control")).toBe(true);
      expect(identity?.text).toBe(IDENTITY);
      expect(identity?.cache_control?.type).toBe("ephemeral");
      expect(identity?.cache_control?.ttl).toBe("1h");
    },
  );

  it.each(FIXTURE_FILENAMES)(
    "keeps context hint disabled in %s",
    (filename) => {
      const fixture = parseGolden(readFixture(filename));
      const betaHeader = fixture.headers.find(
        ([name]) => name === "anthropic-beta",
      );
      expect(betaHeader?.[1]).not.toContain("context-hint-2026-04-09");
      expect(fixture.body).not.toHaveProperty("context_hint");
    },
  );

  it.each(FIXTURE_FILENAMES)(
    "round-trips and preserves documented top-level key order in %s",
    (filename) => {
      const raw = readFixture(filename);
      const parsed = parseRecord(raw);
      const serialized = JSON.stringify(parsed);
      expect(parseRecord(serialized)).toEqual(parsed);
      const topLevelKeys = [...raw.matchAll(/^ {2}"([^"]+)":/gmu)].map(
        (match) => requireString(match[1], "top-level key"),
      );
      expect(topLevelKeys).toEqual([
        "$schema",
        "name",
        "profileId",
        "url",
        "method",
        "headers",
        "body",
        "notes",
      ]);
    },
  );

  it("records only the rejection decision, not provider response data", () => {
    const decision = parseRecord(
      readFixture("decision-context-hint-rejected.json"),
    );
    expect(Object.keys(decision)).toEqual([
      "$schema",
      "name",
      "profileId",
      "betaFeature",
      "observedStatus",
      "errorCategory",
      "decision",
      "notes",
    ]);
    expect(decision.observedStatus).toBe(400);
    expect(decision.errorCategory).toBe("invalid_request_error");
    expect(decision).not.toHaveProperty("body");
    expect(decision).not.toHaveProperty("headers");
    expect(decision).not.toHaveProperty("response");
  });
});
