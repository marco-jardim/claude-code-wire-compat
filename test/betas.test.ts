// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the betas module.
 *
 * Wave 2 export expected:
 * - `composeBetas(input: { readonly capabilities: ClaudeCodeCapabilities; readonly effortRequested: boolean; readonly contextHintRequested: boolean }, profile?: ClaudeCodeProtocolProfile): readonly string[]`
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeCapabilities,
  ClaudeCodeProtocolProfile,
} from "../src/contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "./support/wave2-modules.js";

interface ComposeBetasInput {
  readonly capabilities: ClaudeCodeCapabilities;
  readonly effortRequested: boolean;
  readonly contextHintRequested: boolean;
}

type ComposeBetas = (
  input: ComposeBetasInput,
  profile?: ClaudeCodeProtocolProfile,
) => readonly string[];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findBetaHeader(value: unknown): readonly string[] | undefined {
  if (typeof value === "string" && value.includes("oauth-2025-04-20")) {
    return value.split(",");
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBetaHeader(item);
      if (found !== undefined) return found;
    }
  } else if (isRecord(value)) {
    for (const item of Object.values(value)) {
      const found = findBetaHeader(item);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function fixtureBetas(fileName: string): readonly string[] {
  const fixture: unknown = JSON.parse(
    readFileSync(
      new URL(`fixtures/golden/${fileName}`, import.meta.url),
      "utf8",
    ),
  );
  const betas = findBetaHeader(fixture);
  if (betas === undefined) {
    throw new Error(`No beta header found in golden fixture ${fileName}.`);
  }
  return betas;
}

function capabilitiesFor(model: string): ClaudeCodeCapabilities {
  const definition = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[model];
  if (definition === undefined)
    throw new Error(`Missing profile model ${model}.`);
  return definition.capabilities;
}

describe("betas (Wave 1 RED specification)", () => {
  it("the Wave 2 module is implemented", async () => {
    expect(await expectModuleUnimplemented("betas")).toBe(false);
  });

  it("matches the non-effort foreground golden exactly", async () => {
    const composeBetas = await loadWave2Function<ComposeBetas>(
      "betas",
      "composeBetas",
    );
    // The foreground golden was generated for claude-sonnet-4-5, which the
    // pinned profile marks effort-incapable, so its beta list omits
    // effort-2025-11-24. Context hint is off in both goldens.
    const expected = fixtureBetas("outgoing-foreground.json");

    expect(
      composeBetas({
        capabilities: capabilitiesFor("claude-sonnet-4-5"),
        effortRequested: false,
        contextHintRequested: false,
      }),
    ).toEqual(expected);
    expect(expected).toEqual([
      "oauth-2025-04-20",
      "claude-code-20250219",
      "interleaved-thinking-2025-05-14",
      "prompt-caching-scope-2026-01-05",
      "extended-cache-ttl-2025-04-11",
      "context-management-2025-06-27",
      "web-search-2025-03-05",
      "advisor-tool-2026-03-01",
      "redact-thinking-2026-02-12",
      "thinking-token-count-2026-05-13",
    ]);
  });

  it("matches the effort-enabled canary golden exactly", async () => {
    const composeBetas = await loadWave2Function<ComposeBetas>(
      "betas",
      "composeBetas",
    );
    // The canary golden was generated for claude-opus-4-8 with adaptive
    // thinking and effort=high, so its beta list carries effort-2025-11-24
    // immediately after context-management-2025-06-27.
    const expected = fixtureBetas("outgoing-canary-context-hint-off.json");
    const actual = composeBetas({
      capabilities: capabilitiesFor("claude-opus-4-8"),
      effortRequested: true,
      contextHintRequested: false,
    });

    expect(actual).toEqual(expected);
    expect(actual.indexOf("effort-2025-11-24")).toBe(
      actual.indexOf("context-management-2025-06-27") + 1,
    );
  });

  it("emits context hint only when explicitly requested and supported", async () => {
    const composeBetas = await loadWave2Function<ComposeBetas>(
      "betas",
      "composeBetas",
    );
    const capabilities = capabilitiesFor("claude-opus-4-8");

    expect(
      composeBetas({
        capabilities,
        effortRequested: false,
        contextHintRequested: false,
      }),
    ).not.toContain("context-hint-2026-04-09");
    expect(
      composeBetas({
        capabilities,
        effortRequested: false,
        contextHintRequested: true,
      }),
    ).toContain("context-hint-2026-04-09");
  });

  it.each([
    ["context hint", false, true],
    ["effort", true, false],
  ] as const)(
    "rejects unsupported %s requests",
    async (_name, effortRequested, contextHintRequested) => {
      const composeBetas = await loadWave2Function<ComposeBetas>(
        "betas",
        "composeBetas",
      );
      const capabilities = {
        ...capabilitiesFor("claude-sonnet-4-5"),
        contextHint: false,
      };

      expect(() =>
        composeBetas({
          capabilities,
          effortRequested,
          contextHintRequested,
        }),
      ).toThrow(expect.objectContaining({ code: "UNSUPPORTED_CAPABILITY" }));
    },
  );

  it("is frozen, deterministic, duplicate-free, and profile-ordered", async () => {
    const composeBetas = await loadWave2Function<ComposeBetas>(
      "betas",
      "composeBetas",
    );
    const input: ComposeBetasInput = {
      capabilities: capabilitiesFor("claude-opus-4-8"),
      effortRequested: true,
      contextHintRequested: true,
    };
    const first = composeBetas(input);
    const second = composeBetas(input);

    expect(Object.isFrozen(first)).toBe(true);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(first).toEqual(
      CLAUDE_CODE_2_1_195_PROFILE.orderedBetas.filter((beta) =>
        first.includes(beta),
      ),
    );
  });
});
