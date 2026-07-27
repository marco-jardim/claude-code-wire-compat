// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { clampMaxTokens, modelOutputTokenLimits } from "../../src/thinking.js";

describe("modelOutputTokenLimits", () => {
  it.each([
    ["claude-fable-5", 64000, 128000],
    ["claude-mythos-5", 64000, 128000],
    ["claude-opus-4-8", 64000, 128000],
    ["claude-opus-4-7", 64000, 128000],
    ["claude-sonnet-4-6", 32000, 128000],
    ["claude-opus-4-6", 64000, 128000],
    ["claude-opus-4-5", 32000, 64000],
    ["claude-sonnet-4-0", 32000, 64000],
    ["claude-sonnet-4-5", 32000, 64000],
    ["claude-haiku-4-5", 32000, 64000],
    ["claude-opus-4-1", 32000, 32000],
    ["claude-opus-4-0", 32000, 32000],
    ["claude-3-opus", 4096, 4096],
    ["claude-3-sonnet", 8192, 8192],
    ["claude-3-haiku", 4096, 4096],
    ["claude-3-5-sonnet", 8192, 8192],
    ["claude-3-5-haiku", 8192, 8192],
    ["claude-3-7-sonnet", 32000, 64000],
    ["unknown-model", 32000, 128000],
  ] as const)(
    "returns the limits for %s",
    (model, defaultBudget, upperLimit) => {
      expect(modelOutputTokenLimits(model)).toEqual({
        default: defaultBudget,
        upperLimit,
      });
    },
  );
});

describe("clampMaxTokens (D16)", () => {
  it.each([
    ["claude-opus-4-8", 64000],
    ["claude-sonnet-4-6", 32000],
    ["claude-3-opus", 4096],
    ["unknown-model", 32000],
  ] as const)("caps a request above the %s default", (model, cap) => {
    expect(clampMaxTokens(cap + 1, model)).toBe(cap);
    expect(clampMaxTokens(1_000_000, model)).toBe(cap);
  });

  it.each([
    ["claude-opus-4-8", 64000],
    ["claude-sonnet-4-6", 32000],
    ["claude-3-opus", 4096],
  ] as const)("passes a request at or below the %s default", (model, cap) => {
    expect(clampMaxTokens(cap, model)).toBe(cap);
    expect(clampMaxTokens(1, model)).toBe(1);
  });

  it("clamps against the default, never the upper limit", () => {
    // claude-opus-4-8 is default 64000 / upperLimit 128000. Bounding by
    // upperLimit instead would wrongly let 100000 through.
    expect(modelOutputTokenLimits("claude-opus-4-8").upperLimit).toBe(128000);
    expect(clampMaxTokens(100000, "claude-opus-4-8")).toBe(64000);
  });
});
