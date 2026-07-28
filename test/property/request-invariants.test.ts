// SPDX-License-Identifier: GPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import type { ClaudeCodeRequestInput } from "../../src/contracts.js";
import {
  referenceAdapter,
  syntheticInput,
} from "../conformance/reference-adapter.js";

const SEED = 0x31c0ffee;
const TOKEN = "property-token-sentinel-9f1d77";
console.info(`fast-check seed: ${String(SEED)}`);

const base = syntheticInput(referenceAdapter("outgoing-foreground.json"));
const safeString = fc.string({ unit: "grapheme", minLength: 1, maxLength: 80 });
const inputArbitrary: fc.Arbitrary<ClaudeCodeRequestInput> = fc
  .record({
    message: safeString,
    system: safeString,
    metadataValue: safeString,
    toolName: fc.stringMatching(/^[a-z][a-z0-9_-]{0,15}$/u),
  })
  .map(({ message, system, metadataValue, toolName }) => ({
    ...base,
    accessToken: TOKEN,
    messages: [{ role: "user", content: message }],
    system: [system],
    metadata: { generated: metadataValue },
    tools: [
      {
        name: toolName,
        description: "generated",
        input_schema: { type: "object", properties: {} },
      },
    ],
  }));

const LONG_CONTEXT_BETA = "context-1m-2025-08-07";
/** Mirrors the accepted grammar of `ClaudeCodeRequestInput.additionalBetas`. */
const betaArbitrary = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/u);

function builtHeader(
  built: { readonly headers: readonly (readonly [string, string])[] },
  name: string,
): string {
  const match = built.headers.find(([candidate]) => candidate === name);
  if (match === undefined) throw new Error(`missing header ${name}`);
  return match[1];
}

function tokenOccurrences(value: unknown): string[] {
  if (typeof value === "string") return value.includes(TOKEN) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(tokenOccurrences);
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(tokenOccurrences);
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pollutionFixture(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(
    '{"__proto__":{"polluted":true},"prototype":{},"constructor":{}}',
  );
  if (
    !isRecord(parsed) ||
    !isRecord(parsed["__proto__"]) ||
    parsed["__proto__"]["polluted"] !== true ||
    !isRecord(parsed["prototype"]) ||
    !isRecord(Reflect.get(parsed, "constructor"))
  ) {
    throw new TypeError("Pollution fixture has an invalid shape.");
  }
  return parsed;
}

describe("request properties", () => {
  it("preserves deterministic, immutable, redacted, parseable invariants", async () => {
    await fc.assert(
      fc.asyncProperty(inputArbitrary, async (input) => {
        const before = structuredClone(input);
        const first = await buildClaudeCodeRequest(input);
        const second = await buildClaudeCodeRequest(input);
        expect(first.body).toBe(second.body);
        expect(first.evidence).toEqual(second.evidence);
        expect(input).toEqual(before);
        expect(first.evidence.bodyByteLength).toBe(
          new TextEncoder().encode(first.body).length,
        );
        expect(parseBuiltClaudeCodeRequest(first)).toEqual(first);
        expect(Object.isFrozen(first)).toBe(true);
        expect(Object.isFrozen(first.headers)).toBe(true);
        expect(Object.isFrozen(first.evidence)).toBe(true);
        expect(tokenOccurrences(first)).toEqual([`Bearer ${TOKEN}`]);
      }),
      { seed: SEED, numRuns: 60, verbose: true },
    );
  });

  it("rejects explicit cyclic, Unicode, depth, size, pollution, and duplicate-id cases", async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let index = 0; index < 101; index += 1) {
      const next: Record<string, unknown> = {};
      cursor["next"] = next;
      cursor = next;
    }
    const pollution = pollutionFixture();
    const invalidValues: readonly (readonly [unknown, string])[] = [
      [cyclic, "CYCLIC_INPUT"],
      [deep, "INPUT_TOO_DEEP"],
      ["\ud800", "INVALID_UNICODE"],
      ["\udc00", "INVALID_UNICODE"],
      ["trailing\ud800", "INVALID_UNICODE"],
      ["trailing\udc00", "INVALID_UNICODE"],
      ["x".repeat(10_000_001), "INPUT_TOO_LARGE"],
      [pollution, "INVALID_INPUT"],
    ];
    for (const [metadata, code] of invalidValues) {
      await expect(
        Reflect.apply(buildClaudeCodeRequest, undefined, [
          { ...base, metadata },
        ]),
      ).rejects.toMatchObject({ code });
    }
    await expect(
      Reflect.apply(buildClaudeCodeRequest, undefined, [
        {
          ...base,
          tools: [
            { name: "same", inputSchema: { type: "object" } },
            { name: "same", inputSchema: { type: "object" } },
          ],
        },
      ]),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(JSON.parse('{"key":1,"key":2}')).toEqual({ key: 2 });
  });

  /*
   * Package-extension seam invariants. `additionalBetas` is the only caller
   * input that reaches the `anthropic-beta` header, which is a single
   * comma-joined field, so the header grammar has to hold for EVERY accepted
   * list, not just the hand-written cases.
   */
  it("keeps the beta header well formed for any accepted additionalBetas list", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(betaArbitrary, { maxLength: 32 }),
        async (additionalBetas) => {
          const canonical = await buildClaudeCodeRequest(base);
          const built = await buildClaudeCodeRequest({
            ...base,
            additionalBetas,
          });
          const header = builtHeader(built, "anthropic-beta");

          // Header grammar: no empty element, so no doubled or edge comma.
          expect(header).not.toContain(",,");
          expect(header.startsWith(",")).toBe(false);
          expect(header.endsWith(",")).toBe(false);
          expect(header).toBe(built.evidence.betaFeatures.join(","));

          // The canonical, upstream-derived prefix is never reordered or lost.
          expect(
            built.evidence.betaFeatures.slice(
              0,
              canonical.evidence.betaFeatures.length,
            ),
          ).toEqual(canonical.evidence.betaFeatures);

          // Dedup: the emitted set carries no repeated identifier, and every
          // caller entry survives exactly once.
          expect(new Set(built.evidence.betaFeatures).size).toBe(
            built.evidence.betaFeatures.length,
          );
          for (const beta of additionalBetas) {
            expect(built.evidence.betaFeatures).toContain(beta);
          }

          // Dedup is idempotent: feeding the emitted tail back changes nothing.
          const tail = built.evidence.betaFeatures.slice(
            canonical.evidence.betaFeatures.length,
          );
          const again = await buildClaudeCodeRequest({
            ...base,
            additionalBetas: [...additionalBetas, ...tail],
          });
          expect(again.evidence.betaFeatures).toEqual(
            built.evidence.betaFeatures,
          );

          // The body never observes the seam.
          expect(built.body).toBe(canonical.body);

          expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
        },
      ),
      { seed: SEED, numRuns: 40, verbose: true },
    );
  });

  it("keeps betaOverrides confined to the beta header and the evidence", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (use1MContext) => {
        const canonical = await buildClaudeCodeRequest(base);
        const built = await buildClaudeCodeRequest({
          ...base,
          betaOverrides: { use1MContext },
        });

        expect(built.body).toBe(canonical.body);
        expect(built.evidence.capabilityDecisions.use1MContext).toBe(
          use1MContext,
        );
        expect(built.evidence.betaFeatures.includes(LONG_CONTEXT_BETA)).toBe(
          use1MContext,
        );
        expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
      }),
      { seed: SEED, numRuns: 8, verbose: true },
    );
  });

  it("passes every catalogue model through without rewriting it", async () => {
    for (const model of Object.keys(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels,
    )) {
      const built = await buildClaudeCodeRequest({ ...base, model });
      expect(JSON.parse(built.body)).toMatchObject({ model });
    }
  });
});
