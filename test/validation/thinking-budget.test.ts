// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { thinkingBudgetLimits } from "../../src/thinking.js";

describe("thinkingBudgetLimits", () => {
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
      expect(thinkingBudgetLimits(model)).toEqual({
        default: defaultBudget,
        upperLimit,
      });
    },
  );
});
