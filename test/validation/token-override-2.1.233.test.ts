// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
} from "../../src/index.js";
import { deriveCapabilities } from "../../src/model-capabilities.js";
import {
  clampMaxTokens,
  modelOutputTokenLimits,
  resolveThinking,
} from "../../src/thinking.js";

/*
 * The request-derived output-token bound that upstream grew in 2.1.222 and
 * carries unchanged into 2.1.233:
 *
 *   upperLimit = requestedMaxTokens;
 *   default    = Math.min(default, upperLimit);
 *
 * applied only when the caller's `max_tokens` is at least 4096. 2.1.195 has no
 * such adjustment, so the whole behaviour is gated on the profile and this
 * suite pins BOTH halves of that gate: that 2.1.233 does it, and that 2.1.195
 * never does, for identical inputs.
 *
 * `token-limits-equivalence.test.ts` pins the no-argument behaviour and is
 * deliberately untouched: without a `requestedMaxTokens` the two profiles must
 * still answer from the catalogue alone.
 */

/**
 * `claude-sonnet-4-5` in the 2.1.233 catalogue: default 32000, upper 64000.
 * Both numbers matter below -- 32000 is what the override lowers, 64000 is
 * what it raises -- so they are asserted rather than assumed.
 */
const MODEL = "claude-sonnet-4-5";
const CATALOGUE = { default: 32000, upperLimit: 64000 } as const;

const CAPABILITIES = deriveCapabilities(MODEL);
const BETA_POLICY = CLAUDE_CODE_2_1_233_PROFILE.betaPolicy;

describe("request-derived token bound: anti-vacuity", () => {
  it("pins the catalogue row this suite reasons from", () => {
    expect(modelOutputTokenLimits(MODEL, CLAUDE_CODE_2_1_233_PROFILE)).toEqual(
      CATALOGUE,
    );
    expect(modelOutputTokenLimits(MODEL, CLAUDE_CODE_2_1_195_PROFILE)).toEqual(
      CATALOGUE,
    );
  });

  it("selects the enabled-thinking branch, not the adaptive one", () => {
    expect(CAPABILITIES).toMatchObject({
      thinking: true,
      adaptiveThinking: false,
    });
  });

  it("distinguishes the two profiles by id, which is what the gate reads", () => {
    expect(CLAUDE_CODE_2_1_233_PROFILE.id).not.toBe(
      CLAUDE_CODE_2_1_195_PROFILE.id,
    );
  });
});

describe("modelOutputTokenLimits: 2.1.233 threshold at 4096", () => {
  it("does not override at 4095", () => {
    expect(
      modelOutputTokenLimits(MODEL, CLAUDE_CODE_2_1_233_PROFILE, 4095),
    ).toEqual(CATALOGUE);
  });

  it("overrides at exactly 4096, lowering default to meet it", () => {
    expect(
      modelOutputTokenLimits(MODEL, CLAUDE_CODE_2_1_233_PROFILE, 4096),
    ).toEqual({ default: 4096, upperLimit: 4096 });
  });

  it("raises upperLimit above the catalogue's, leaving default alone", () => {
    expect(
      modelOutputTokenLimits(MODEL, CLAUDE_CODE_2_1_233_PROFILE, 200000),
    ).toEqual({ default: 32000, upperLimit: 200000 });
  });

  it("lowers both when the request sits between the threshold and default", () => {
    expect(
      modelOutputTokenLimits(MODEL, CLAUDE_CODE_2_1_233_PROFILE, 8000),
    ).toEqual({ default: 8000, upperLimit: 8000 });
  });

  it("applies to a model whose catalogue default already exceeds the request", () => {
    // `claude-sonnet-5` is 64000/128000; a 4096 request collapses both.
    expect(
      modelOutputTokenLimits("claude-sonnet-5", CLAUDE_CODE_2_1_233_PROFILE),
    ).toEqual({ default: 64000, upperLimit: 128000 });
    expect(
      modelOutputTokenLimits(
        "claude-sonnet-5",
        CLAUDE_CODE_2_1_233_PROFILE,
        4096,
      ),
    ).toEqual({ default: 4096, upperLimit: 4096 });
  });

  it("applies on the fallback path too, not only to catalogued ids", () => {
    expect(
      modelOutputTokenLimits("no-such-model", CLAUDE_CODE_2_1_233_PROFILE),
    ).toEqual({ default: 32000, upperLimit: 128000 });
    expect(
      modelOutputTokenLimits(
        "no-such-model",
        CLAUDE_CODE_2_1_233_PROFILE,
        200000,
      ),
    ).toEqual({ default: 32000, upperLimit: 200000 });
  });
});

/*
 * The gate is `Number.isSafeInteger(x) && x >= 4096`, deliberately stricter
 * than upstream's truthy check. Every row below is a value the upstream
 * runtime cannot produce in this field; the point is that if one ever arrives
 * it must be ignored rather than propagated into `budget_tokens`.
 */
const REJECTED_REQUESTS: readonly (number | undefined)[] = [
  0,
  -1,
  -200000,
  1,
  4095,
  4095.5,
  4096.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
  undefined,
];

describe("modelOutputTokenLimits: rejected requested values", () => {
  for (const requested of REJECTED_REQUESTS) {
    it(`ignores ${String(requested)}`, () => {
      const limits = modelOutputTokenLimits(
        MODEL,
        CLAUDE_CODE_2_1_233_PROFILE,
        requested,
      );
      expect(limits).toEqual(CATALOGUE);
      expect(Number.isSafeInteger(limits.default)).toBe(true);
      expect(Number.isSafeInteger(limits.upperLimit)).toBe(true);
    });
  }

  it("accepts MAX_SAFE_INTEGER, which is the top of the accepted range", () => {
    expect(
      modelOutputTokenLimits(
        MODEL,
        CLAUDE_CODE_2_1_233_PROFILE,
        Number.MAX_SAFE_INTEGER,
      ),
    ).toEqual({ default: 32000, upperLimit: Number.MAX_SAFE_INTEGER });
  });
});

describe("modelOutputTokenLimits: 2.1.195 is never overridden", () => {
  const ALL_REQUESTS: readonly (number | undefined)[] = [
    ...REJECTED_REQUESTS,
    4096,
    8000,
    200000,
    Number.MAX_SAFE_INTEGER,
  ];

  for (const requested of ALL_REQUESTS) {
    it(`answers from the catalogue for ${String(requested)}`, () => {
      expect(
        modelOutputTokenLimits(MODEL, CLAUDE_CODE_2_1_195_PROFILE, requested),
      ).toEqual(CATALOGUE);
    });
  }

  it("answers from the fallback for an unknown id regardless of the request", () => {
    expect(
      modelOutputTokenLimits(
        "no-such-model",
        CLAUDE_CODE_2_1_195_PROFILE,
        200000,
      ),
    ).toEqual({ default: 32000, upperLimit: 128000 });
  });

  it("is the default profile, so the bare two-argument call is unaffected", () => {
    expect(modelOutputTokenLimits(MODEL)).toEqual(CATALOGUE);
  });
});

/*
 * `clampMaxTokens` forwards `requested` as the bound, but the forwarding is
 * for coherence of reading, not for effect:
 *
 *   min(requested, min(default, requested)) === min(requested, default)
 *
 * so the 2.1.233 result must equal the 2.1.195 result wherever the two
 * catalogues agree on `default`. That invariance is the assertion.
 */
describe("clampMaxTokens: the override cannot move the result", () => {
  const REQUESTS = [
    1,
    4095,
    4096,
    8000,
    31999,
    32000,
    32001,
    200000,
    Number.MAX_SAFE_INTEGER,
  ] as const;

  for (const requested of REQUESTS) {
    it(`agrees across profiles for ${String(requested)}`, () => {
      const on233 = clampMaxTokens(
        requested,
        MODEL,
        CLAUDE_CODE_2_1_233_PROFILE,
      );
      expect(on233).toBe(
        clampMaxTokens(requested, MODEL, CLAUDE_CODE_2_1_195_PROFILE),
      );
      expect(on233).toBe(Math.min(requested, CATALOGUE.default));
    });
  }
});

/*
 * The one wire-visible consumer: the default thinking budget, seeded from
 * `upperLimit - 1`. When the caller asks for more `max_tokens` than the
 * catalogue's upper limit, 2.1.233 seeds from THEIR number and 2.1.195 seeds
 * from the catalogue's.
 */
describe("resolveThinking: the override reaches the wire", () => {
  const emit = (
    maxTokens: number,
    profile: typeof CLAUDE_CODE_2_1_195_PROFILE,
  ) =>
    resolveThinking(
      { type: "enabled" },
      MODEL,
      CAPABILITIES,
      BETA_POLICY,
      maxTokens,
      profile,
    ).emitted;

  it("seeds the default budget from the caller's max_tokens on 2.1.233", () => {
    expect(emit(200000, CLAUDE_CODE_2_1_233_PROFILE)).toEqual({
      budget_tokens: 199999,
      type: "enabled",
    });
  });

  it("seeds it from the catalogue's upper limit on 2.1.195", () => {
    expect(emit(200000, CLAUDE_CODE_2_1_195_PROFILE)).toEqual({
      budget_tokens: 63999,
      type: "enabled",
    });
  });

  it("preserves the load-bearing key order under the override", () => {
    expect(
      Object.keys(emit(200000, CLAUDE_CODE_2_1_233_PROFILE) ?? {}),
    ).toEqual(["budget_tokens", "type"]);
  });

  it("agrees with 2.1.195 when max_tokens stays under the catalogue's limit", () => {
    for (const maxTokens of [1, 4095, 4096, 32000, 63999, 64000]) {
      expect(emit(maxTokens, CLAUDE_CODE_2_1_233_PROFILE)).toEqual(
        emit(maxTokens, CLAUDE_CODE_2_1_195_PROFILE),
      );
    }
  });

  it("leaves an explicit caller budget untouched by the override", () => {
    // `budgetTokens` short-circuits the seed, so only `maxTokens - 1` binds.
    for (const profile of [
      CLAUDE_CODE_2_1_233_PROFILE,
      CLAUDE_CODE_2_1_195_PROFILE,
    ]) {
      expect(
        resolveThinking(
          { type: "enabled", budgetTokens: 5000 },
          MODEL,
          CAPABILITIES,
          BETA_POLICY,
          200000,
          profile,
        ).emitted,
      ).toEqual({ budget_tokens: 5000, type: "enabled" });
    }
  });

  it("never emits a non-integer budget", () => {
    const emitted = emit(Number.MAX_SAFE_INTEGER, CLAUDE_CODE_2_1_233_PROFILE);
    expect(emitted?.["budget_tokens"]).toBe(Number.MAX_SAFE_INTEGER - 1);
  });
});
