// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  isAdaptiveThinkingModel,
  isEligibleFor1MContext,
  modelCapability,
  modelCatalogueEntry,
} from "../../src/index.js";
import { modelIdLadder, normalizeModelId } from "../../src/model-identity.js";

/*
 * The 2.1.329 bundle's normalizer (`NK`, view lines 113702-113708) carries four
 * rungs the earlier ladder lacks. They are gated by the `extendedModelIdLadder`
 * behaviour flag so 2.1.195, 2.1.233 and 2.1.280 keep their folding.
 */

/** Each extended id, paired with what the base ladder makes of it. */
const EXTENDED_RUNGS = [
  ["claude-sonnet-5-5", "claude-sonnet-5"],
  // No base rung matches a haiku 5.5 id, so it passes through unchanged.
  ["claude-haiku-5-5", "claude-haiku-5-5"],
  ["claude-fable-5-2", "claude-fable-5"],
  ["claude-mythos-5-2", "claude-mythos-5"],
] as const;

describe("model-id ladder selection", () => {
  it("selects the extended ladder for 2.1.329 only", () => {
    expect(modelIdLadder(CLAUDE_CODE_2_1_195_PROFILE)).toBe("base");
    expect(modelIdLadder(CLAUDE_CODE_2_1_233_PROFILE)).toBe("base");
    expect(modelIdLadder(CLAUDE_CODE_2_1_280_PROFILE)).toBe("base");
    expect(modelIdLadder(CLAUDE_CODE_2_1_329_PROFILE)).toBe("extended");
  });

  it("keeps an overridden profile id on the base ladder", () => {
    expect(
      modelIdLadder({
        ...CLAUDE_CODE_2_1_329_PROFILE,
        id: "claude-code-custom",
      }),
    ).toBe("base");
  });

  it("defaults normalizeModelId to the base ladder", () => {
    expect(normalizeModelId("claude-sonnet-5-5")).toBe("claude-sonnet-5");
  });
});

describe("extended normalizer rungs", () => {
  it.each(EXTENDED_RUNGS)(
    "%s resolves to itself on the extended ladder",
    (id) => {
      expect(normalizeModelId(id, "extended")).toBe(id);
      expect(normalizeModelId(id.toUpperCase(), "extended")).toBe(id);
      expect(normalizeModelId(`${id}[1m]`, "extended")).toBe(id);
    },
  );

  it.each(EXTENDED_RUNGS)(
    "%s keeps its base-ladder result on the base ladder",
    (id, folded) => {
      expect(normalizeModelId(id, "base")).toBe(folded);
    },
  );

  it("accepts dotted spellings and provider-prefixed ids", () => {
    expect(normalizeModelId("claude-sonnet-5.5", "extended")).toBe(
      "claude-sonnet-5-5",
    );
    expect(
      normalizeModelId("us.anthropic.claude-sonnet-5-5-v1:0", "extended"),
    ).toBe("claude-sonnet-5-5");
    expect(normalizeModelId("claude-haiku-5-5-20260101", "extended")).toBe(
      "claude-haiku-5-5",
    );
  });

  it("leaves the shorter siblings reachable on the extended ladder", () => {
    expect(normalizeModelId("claude-sonnet-5", "extended")).toBe(
      "claude-sonnet-5",
    );
    expect(normalizeModelId("claude-haiku-4-5", "extended")).toBe(
      "claude-haiku-4-5",
    );
    expect(normalizeModelId("claude-fable-5-1", "extended")).toBe(
      "claude-fable-5-1",
    );
    expect(normalizeModelId("claude-mythos-5-1", "extended")).toBe(
      "claude-mythos-5-1",
    );
    expect(normalizeModelId("claude-fable-5", "extended")).toBe(
      "claude-fable-5",
    );
    expect(normalizeModelId("claude-mythos-5", "extended")).toBe(
      "claude-mythos-5",
    );
  });

  describe("date guard on the fable and mythos rungs (upstream V2e)", () => {
    it.each([
      ["claude-fable-5-20260101", "claude-fable-5"],
      ["claude-mythos-5-20260101", "claude-mythos-5"],
      ["claude-fable-5-2", "claude-fable-5-2"],
      ["claude-mythos-5-2", "claude-mythos-5-2"],
      ["claude-fable-5-2-20260101", "claude-fable-5-2"],
      ["claude-mythos-5-2-20260101", "claude-mythos-5-2"],
      // The guard rejects three digits right after the needle, not two.
      ["claude-fable-5-21", "claude-fable-5-2"],
      ["claude-fable-5-200", "claude-fable-5-2"],
      ["claude-fable-5-2000", "claude-fable-5"],
      // A later undated occurrence still counts.
      ["claude-fable-5-20260101/claude-fable-5-2", "claude-fable-5-2"],
    ])("%s -> %s", (input, expected) => {
      expect(normalizeModelId(input, "extended")).toBe(expected);
    });

    it("does not apply the guard on the base ladder", () => {
      expect(normalizeModelId("claude-fable-5-20260101", "base")).toBe(
        "claude-fable-5",
      );
      expect(normalizeModelId("claude-fable-5-2", "base")).toBe(
        "claude-fable-5",
      );
    });
  });
});

describe("profile-bound queries follow the profile's own ladder", () => {
  it("modelCapability reads the 5.5 catalogue rows under 2.1.329 only", () => {
    const own = modelCatalogueEntry(
      "claude-sonnet-5-5",
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    const sibling = modelCatalogueEntry(
      "claude-sonnet-5",
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    expect(own).not.toBe(sibling);
    const [capability] = own?.capabilities ?? [];
    if (capability === undefined) throw new Error("empty capability list");
    expect(
      modelCapability(
        "claude-sonnet-5-5",
        capability,
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).toBe(true);
  });

  it("isEligibleFor1MContext uses the profile ladder", () => {
    expect(
      isEligibleFor1MContext("claude-haiku-5-5", CLAUDE_CODE_2_1_329_PROFILE),
    ).toBe(
      CLAUDE_CODE_2_1_329_PROFILE.supportedModels["claude-haiku-5-5"]?.context
        ?.supports1mBeta === true,
    );
    // Under 2.1.280 no rung matches, so the id is uncatalogued and takes the
    // family fallback, which excludes haiku.
    expect(
      isEligibleFor1MContext("claude-haiku-5-5", CLAUDE_CODE_2_1_280_PROFILE),
    ).toBe(false);
  });

  it("isAdaptiveThinkingModel covers the four extended ids", () => {
    for (const [id] of EXTENDED_RUNGS) {
      expect(isAdaptiveThinkingModel(id)).toBe(true);
    }
    expect(isAdaptiveThinkingModel("claude-haiku-4-5")).toBe(false);
  });
});

describe("modelCatalogueEntry", () => {
  it("returns the entry the profile's own normalizer resolves to", () => {
    for (const [id] of EXTENDED_RUNGS) {
      expect(modelCatalogueEntry(id, CLAUDE_CODE_2_1_329_PROFILE)).toBe(
        CLAUDE_CODE_2_1_329_PROFILE.supportedModels[id],
      );
    }
  });

  it("is folding-consistent under 2.1.280", () => {
    expect(
      modelCatalogueEntry("claude-sonnet-5-5", CLAUDE_CODE_2_1_280_PROFILE),
    ).toBe(CLAUDE_CODE_2_1_280_PROFILE.supportedModels["claude-sonnet-5"]);
    expect(
      modelCatalogueEntry("claude-mythos-5-2", CLAUDE_CODE_2_1_280_PROFILE),
    ).toBe(CLAUDE_CODE_2_1_280_PROFILE.supportedModels["claude-mythos-5"]);
  });

  it("defaults to the 2.1.195 profile", () => {
    expect(modelCatalogueEntry("claude-opus-4-5")).toBe(
      CLAUDE_CODE_2_1_195_PROFILE.supportedModels["claude-opus-4-5"],
    );
  });

  it("answers undefined for uncatalogued, empty and non-string ids", () => {
    expect(
      modelCatalogueEntry("gpt-4o", CLAUDE_CODE_2_1_329_PROFILE),
    ).toBeUndefined();
    expect(
      modelCatalogueEntry("", CLAUDE_CODE_2_1_329_PROFILE),
    ).toBeUndefined();
    expect(
      Reflect.apply(modelCatalogueEntry, undefined, [
        42,
        CLAUDE_CODE_2_1_329_PROFILE,
      ]),
    ).toBeUndefined();
    expect(
      modelCatalogueEntry("constructor", CLAUDE_CODE_2_1_329_PROFILE),
    ).toBeUndefined();
    // 2.1.195 does not catalogue mythos at all.
    expect(
      modelCatalogueEntry("claude-mythos-5-2", CLAUDE_CODE_2_1_195_PROFILE),
    ).toBeUndefined();
  });
});
