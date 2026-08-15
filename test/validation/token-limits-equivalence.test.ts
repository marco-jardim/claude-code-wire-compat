// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/index.js";
import { deriveCapabilities } from "../../src/model-capabilities.js";
import {
  clampMaxTokens,
  modelOutputTokenLimits,
  resolveThinking,
} from "../../src/thinking.js";

/*
 * Executable specification of output-token-limit resolution, written BEFORE
 * the catalogue-driven refactor of `modelOutputTokenLimits` (Fase 1.2) and
 * required to pass unchanged after it.
 *
 * Three things are pinned, because the limit table feeds three distinct wire
 * decisions:
 *
 *   1. `modelOutputTokenLimits` itself, for every catalogue id, for the ids
 *      that are reachable through the normaliser without a catalogue entry
 *      (`claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`,
 *      `claude-mythos-5`), and for ids that hit the fallback.
 *   2. `clampMaxTokens`, which caps the emitted `max_tokens` at `default`.
 *   3. The enabled-thinking branch of `resolveThinking`, whose budget is
 *      seeded from `upperLimit` and clamped against the emitted `max_tokens`,
 *      plus the load-bearing key order of the emitted object.
 *
 * The arithmetic below is transcribed from what the code DOES, including the
 * degenerate `maxTokens` values where the result is not what a reasonable
 * person would design. Those rows are pins, not endorsements; see the
 * comments on each.
 */

interface Limits {
  readonly default: number;
  readonly upperLimit: number;
}

/** The fallback row, returned for any id no branch claims. */
const FALLBACK: Limits = { default: 32000, upperLimit: 128000 };

/** Every id in the 2.1.195 catalogue. */
const CATALOGUE_LIMITS: Readonly<Record<string, Limits>> = {
  "claude-3-5-haiku": { default: 8192, upperLimit: 8192 },
  "claude-3-5-sonnet": { default: 8192, upperLimit: 8192 },
  "claude-3-7-sonnet": { default: 32000, upperLimit: 64000 },
  "claude-haiku-4-5": { default: 32000, upperLimit: 64000 },
  "claude-sonnet-4-0": { default: 32000, upperLimit: 64000 },
  "claude-sonnet-4-5": { default: 32000, upperLimit: 64000 },
  "claude-sonnet-4-6": { default: 32000, upperLimit: 128000 },
  "claude-opus-4-0": { default: 32000, upperLimit: 32000 },
  "claude-opus-4-1": { default: 32000, upperLimit: 32000 },
  "claude-opus-4-5": { default: 32000, upperLimit: 64000 },
  "claude-opus-4-6": { default: 64000, upperLimit: 128000 },
  "claude-opus-4-7": { default: 64000, upperLimit: 128000 },
  "claude-opus-4-8": { default: 64000, upperLimit: 128000 },
  "claude-fable-5": { default: 64000, upperLimit: 128000 },
};

/**
 * Ids with a limit row but NO catalogue entry. `claude-mythos-5` is absent by
 * product decision D-1; the three `claude-3-*` ids are reachable through the
 * normaliser and predate the catalogue. All four must keep their limits after
 * derivation moves to the catalogue -- they can only come from the fallback
 * table, which is why that table must survive the refactor intact.
 */
const OFF_CATALOGUE_LIMITS: Readonly<Record<string, Limits>> = {
  "claude-mythos-5": { default: 64000, upperLimit: 128000 },
  "claude-3-opus": { default: 4096, upperLimit: 4096 },
  "claude-3-sonnet": { default: 8192, upperLimit: 8192 },
  "claude-3-haiku": { default: 4096, upperLimit: 4096 },
};

/**
 * Ids no branch claims. `claude-opus-4-1x` is here on purpose: every branch
 * tests `===`, never a prefix, so a longer id does NOT inherit
 * `claude-opus-4-1`'s row. `claude-sonnet-4-5[1m]` is the same shape -- an id
 * that escaped normalisation keeps its marker and stops matching.
 */
const FALLBACK_IDS = [
  "foo",
  "",
  "claude-opus-4-1x",
  "claude-sonnet-4-5[1m]",
  "claude-opus-5",
] as const;

describe("modelOutputTokenLimits", () => {
  it("covers every catalogue id (anti-vacuity guard)", () => {
    expect(Object.keys(CATALOGUE_LIMITS).sort()).toEqual(
      Object.keys(CLAUDE_CODE_2_1_195_PROFILE.supportedModels).sort(),
    );
  });

  for (const [id, expected] of Object.entries(CATALOGUE_LIMITS)) {
    it(`${id} resolves ${String(expected.default)}/${String(expected.upperLimit)}`, () => {
      expect(modelOutputTokenLimits(id)).toEqual(expected);
    });
  }

  for (const [id, expected] of Object.entries(OFF_CATALOGUE_LIMITS)) {
    it(`${id} resolves ${String(expected.default)}/${String(expected.upperLimit)} without a catalogue entry`, () => {
      expect(CLAUDE_CODE_2_1_195_PROFILE.supportedModels[id]).toBeUndefined();
      expect(modelOutputTokenLimits(id)).toEqual(expected);
    });
  }

  for (const id of FALLBACK_IDS) {
    it(`${JSON.stringify(id)} falls back to 32000/128000`, () => {
      expect(modelOutputTokenLimits(id)).toEqual(FALLBACK);
    });
  }
});

describe("clampMaxTokens", () => {
  it("returns the request when below the model default", () => {
    expect(clampMaxTokens(1000, "claude-opus-4-7")).toBe(1000);
    expect(clampMaxTokens(1, "claude-3-5-haiku")).toBe(1);
  });

  it("returns the request when equal to the model default", () => {
    expect(clampMaxTokens(64000, "claude-opus-4-7")).toBe(64000);
    expect(clampMaxTokens(8192, "claude-3-5-sonnet")).toBe(8192);
  });

  it("caps at the model default when the request exceeds it", () => {
    expect(clampMaxTokens(200000, "claude-opus-4-7")).toBe(64000);
    expect(clampMaxTokens(64000, "claude-opus-4-0")).toBe(32000);
    expect(clampMaxTokens(9999, "claude-3-haiku")).toBe(4096);
  });

  it("caps unknown ids at the fallback default, never at upperLimit", () => {
    expect(clampMaxTokens(999999, "foo")).toBe(FALLBACK.default);
  });
});

/*
 * `claude-sonnet-4-5` has `thinking` but not `adaptiveThinking`, which is what
 * drives `resolveThinking` into the enabled branch. `claude-opus-4-6` has
 * `adaptiveThinking` and drives the adaptive branch.
 */
const ENABLED_ID = "claude-sonnet-4-5";
const ADAPTIVE_ID = "claude-opus-4-6";

const BETA_POLICY = CLAUDE_CODE_2_1_195_PROFILE.betaPolicy;
const DISPLAY_POLICY = {
  ...CLAUDE_CODE_2_1_195_PROFILE.betaPolicy,
  experimentalBetasEnabled: true,
};

describe("resolveThinking: enabled branch budget", () => {
  it("selects the branch this suite assumes", () => {
    expect(deriveCapabilities(ENABLED_ID)).toMatchObject({
      thinking: true,
      adaptiveThinking: false,
    });
    expect(deriveCapabilities(ADAPTIVE_ID)).toMatchObject({
      thinking: true,
      adaptiveThinking: true,
    });
  });

  it("seeds an omitted budget from upperLimit - 1, then clamps to maxTokens - 1", () => {
    // upperLimit 64000 -> 63999, clamped by maxTokens 32000 -> 31999.
    const resolved = resolveThinking(
      { type: "enabled" },
      ENABLED_ID,
      deriveCapabilities(ENABLED_ID),
      BETA_POLICY,
      32000,
    );
    expect(resolved.emitted).toEqual({
      budget_tokens: 31999,
      type: "enabled",
    });
  });

  it("uses upperLimit - 1 verbatim when maxTokens does not bind", () => {
    // maxTokens - 1 = 99999 exceeds upperLimit - 1 = 63999, so the seed wins.
    const resolved = resolveThinking(
      { type: "enabled" },
      ENABLED_ID,
      deriveCapabilities(ENABLED_ID),
      BETA_POLICY,
      100000,
    );
    expect(resolved.emitted).toEqual({
      budget_tokens: 63999,
      type: "enabled",
    });
  });

  it("honours a caller budget below maxTokens - 1", () => {
    const resolved = resolveThinking(
      { type: "enabled", budgetTokens: 5000 },
      ENABLED_ID,
      deriveCapabilities(ENABLED_ID),
      BETA_POLICY,
      32000,
    );
    expect(resolved.emitted).toEqual({ budget_tokens: 5000, type: "enabled" });
  });

  it("clamps a caller budget above maxTokens - 1", () => {
    const resolved = resolveThinking(
      { type: "enabled", budgetTokens: 999999 },
      ENABLED_ID,
      deriveCapabilities(ENABLED_ID),
      BETA_POLICY,
      1000,
    );
    expect(resolved.emitted).toEqual({ budget_tokens: 999, type: "enabled" });
  });

  /*
   * Degenerate `maxTokens`. `Math.min(maxTokens - 1, requested)` has no floor,
   * so these are what the code produces, not what it should produce. Pinned
   * exactly so the refactor cannot quietly introduce a clamp -- introducing
   * one would be a wire change.
   */
  it("emits budget_tokens 0 when maxTokens is 1", () => {
    const resolved = resolveThinking(
      { type: "enabled", budgetTokens: 500 },
      ENABLED_ID,
      deriveCapabilities(ENABLED_ID),
      BETA_POLICY,
      1,
    );
    expect(resolved.emitted).toEqual({ budget_tokens: 0, type: "enabled" });
  });

  it("emits a NEGATIVE budget_tokens when maxTokens is 0", () => {
    const resolved = resolveThinking(
      { type: "enabled", budgetTokens: 500 },
      ENABLED_ID,
      deriveCapabilities(ENABLED_ID),
      BETA_POLICY,
      0,
    );
    expect(resolved.emitted).toEqual({ budget_tokens: -1, type: "enabled" });
  });

  it("reports the request active and extended thinking active", () => {
    const resolved = resolveThinking(
      { type: "enabled" },
      ENABLED_ID,
      deriveCapabilities(ENABLED_ID),
      BETA_POLICY,
      32000,
    );
    expect(resolved.requestActive).toBe(true);
    expect(resolved.extendedThinkingActive).toBe(true);
  });
});

describe("resolveThinking: key order is load-bearing", () => {
  it("emits budget_tokens before type on the enabled branch", () => {
    const resolved = resolveThinking(
      { type: "enabled", budgetTokens: 5000 },
      ENABLED_ID,
      deriveCapabilities(ENABLED_ID),
      BETA_POLICY,
      32000,
    );
    expect(Object.keys(resolved.emitted ?? {})).toEqual([
      "budget_tokens",
      "type",
    ]);
  });

  it("appends display last on the enabled branch", () => {
    const resolved = resolveThinking(
      { type: "enabled", budgetTokens: 5000, display: "summarized" },
      ENABLED_ID,
      deriveCapabilities(ENABLED_ID),
      DISPLAY_POLICY,
      32000,
    );
    expect(Object.keys(resolved.emitted ?? {})).toEqual([
      "budget_tokens",
      "type",
      "display",
    ]);
    expect(resolved.emitted).toEqual({
      budget_tokens: 5000,
      type: "enabled",
      display: "summarized",
    });
  });

  it("emits type alone on the adaptive branch, discarding the budget", () => {
    const resolved = resolveThinking(
      { type: "enabled", budgetTokens: 5000 },
      ADAPTIVE_ID,
      deriveCapabilities(ADAPTIVE_ID),
      BETA_POLICY,
      32000,
    );
    expect(Object.keys(resolved.emitted ?? {})).toEqual(["type"]);
    expect(resolved.emitted).toEqual({ type: "adaptive" });
  });

  it("appends display last on the adaptive branch", () => {
    const resolved = resolveThinking(
      { type: "adaptive", display: "omitted" },
      ADAPTIVE_ID,
      deriveCapabilities(ADAPTIVE_ID),
      DISPLAY_POLICY,
      32000,
    );
    expect(Object.keys(resolved.emitted ?? {})).toEqual(["type", "display"]);
    expect(resolved.emitted).toEqual({ type: "adaptive", display: "omitted" });
  });
});
