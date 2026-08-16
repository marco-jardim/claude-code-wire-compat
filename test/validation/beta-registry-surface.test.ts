// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  BETA_REGISTRY,
  BETA_REGISTRY_2_1_233,
  TOKEN_COUNTING_BETA,
} from "../../src/index.js";

interface BetaRegistryEntry {
  readonly featureKey: string;
  readonly header: string;
}

/**
 * The registries are exported as protocol constants, so this suite reads them
 * through the public entry point exactly as a consumer would. It pins SHAPE and
 * the entries a consumer is documented to reach for — not the full
 * transcription, which `test/validation/betas.test.ts` and the profile suites
 * already own.
 */
function entriesOf(
  registry: Record<string, BetaRegistryEntry>,
): readonly (readonly [string, BetaRegistryEntry])[] {
  return Object.entries(registry);
}

const registries = [
  ["BETA_REGISTRY", BETA_REGISTRY, 28],
  ["BETA_REGISTRY_2_1_233", BETA_REGISTRY_2_1_233, 31],
] as const;

describe("public beta registry surface", () => {
  it.each(registries)(
    "%s exposes %#: deeply frozen entries with non-empty transcribed strings",
    (_name, registry, size) => {
      const entries = entriesOf(registry);

      expect(entries).toHaveLength(size);
      expect(Object.isFrozen(registry)).toBe(true);
      for (const [key, entry] of entries) {
        expect({ key, frozen: Object.isFrozen(entry) }).toEqual({
          key,
          frozen: true,
        });
        expect(typeof entry.featureKey).toBe("string");
        expect(typeof entry.header).toBe("string");
        expect(entry.featureKey.length).toBeGreaterThan(0);
        expect(entry.header.length).toBeGreaterThan(0);
        expect(entry.header.trim()).toBe(entry.header);
      }
    },
  );

  it.each(registries)(
    "%s carries no duplicate beta header",
    (_name, registry) => {
      const headers = entriesOf(registry).map(([, entry]) => entry.header);

      expect(new Set(headers).size).toBe(headers.length);
    },
  );

  /*
   * `featureKey` is deliberately NOT unique: `ADVANCED_TOOL_USE` and
   * `TOOL_SEARCH` both key off `tool_search` upstream. Pinned so a future
   * "cleanup" that de-duplicates feature keys fails here first.
   */
  it.each(registries)(
    "%s reuses the tool_search feature key across two distinct headers",
    (_name, registry) => {
      const toolSearchHeaders = entriesOf(registry)
        .filter(([, entry]) => entry.featureKey === "tool_search")
        .map(([, entry]) => entry.header)
        .sort();

      expect(toolSearchHeaders).toEqual([
        "advanced-tool-use-2025-11-20",
        "tool-search-tool-2025-10-19",
      ]);
    },
  );

  it("pins the prompt-caching-scope entry both registries carry", () => {
    expect(BETA_REGISTRY.PROMPT_CACHING_SCOPE).toEqual({
      featureKey: "prompt_caching_scope",
      header: "prompt-caching-scope-2026-01-05",
    });
    expect(BETA_REGISTRY_2_1_233.PROMPT_CACHING_SCOPE).toEqual(
      BETA_REGISTRY.PROMPT_CACHING_SCOPE,
    );
  });

  it("pins the count-tokens beta appended to the count-tokens header set", () => {
    expect(TOKEN_COUNTING_BETA).toBe("token-counting-2024-11-01");
  });

  it("records the 2.1.233 additions against the 2.1.195-era registry", () => {
    const current = new Set(Object.keys(BETA_REGISTRY));

    for (const key of [
      "PROMPT_CACHING_EVICT",
      "PER_MESSAGE_EFFORT",
      "SERVER_SIDE_FALLBACK_CATEGORY",
      "AUTO_MODE_CLASSIFIER",
    ]) {
      expect(Object.keys(BETA_REGISTRY_2_1_233)).toContain(key);
      expect(current.has(key)).toBe(false);
    }
  });

  /*
   * NEGATIVE ASSERTION, LOAD-BEARING. `NARRATION_SUMMARIES` was REMOVED
   * upstream in 2.1.222+; its absence from the 2.1.233 registry is contract,
   * not a transcription gap (see the comment at
   * `src/profiles/beta-registry-2.1.233.ts`). Re-adding it would emit a header
   * the genuine client no longer sends.
   */
  it("keeps narration summaries out of the 2.1.233 registry entirely", () => {
    expect(BETA_REGISTRY.NARRATION_SUMMARIES).toEqual({
      featureKey: "narration_summaries",
      header: "summarize-connector-text-2026-03-13",
    });

    expect(Object.keys(BETA_REGISTRY_2_1_233)).not.toContain(
      "NARRATION_SUMMARIES",
    );
    expect(
      entriesOf(BETA_REGISTRY_2_1_233).map(([, entry]) => entry.header),
    ).not.toContain("summarize-connector-text-2026-03-13");
    expect(
      entriesOf(BETA_REGISTRY_2_1_233).map(([, entry]) => entry.featureKey),
    ).not.toContain("narration_summaries");
  });
});
