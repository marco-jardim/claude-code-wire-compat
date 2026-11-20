// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
} from "../../src/index.js";
import type { ClaudeCodeCatalogueEntry } from "../../src/index.js";
import { CLAUDE_CODE_2_1_329_PROFILE } from "../../src/profiles/claude-code-2.1.329.js";

/*
 * The expected catalogue order is the extractor report's own order for the
 * 2.1.329 build. The three bare dated ids the report lists after it belong to a
 * second model list and are not catalogue entries.
 */
const EXPECTED_MODEL_IDS: readonly string[] = [
  "claude-3-5-haiku",
  "claude-haiku-4-5",
  "claude-haiku-5-5",
  "claude-3-5-sonnet",
  "claude-3-7-sonnet",
  "claude-sonnet-4-0",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-sonnet-5-5",
  "claude-opus-4-0",
  "claude-opus-4-1",
  "claude-opus-4-5",
  "claude-opus-4-6",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-opus-5",
  "claude-opus-5-5",
  "claude-fable-5",
  "claude-fable-5-1",
  "claude-fable-5-2",
  "claude-mythos-5",
  "claude-mythos-5-1",
  "claude-mythos-5-2",
];

type Catalogue = Readonly<Record<string, ClaudeCodeCatalogueEntry>>;

function entry(id: string): ClaudeCodeCatalogueEntry {
  const found = Object.entries(
    CLAUDE_CODE_2_1_329_PROFILE.supportedModels,
  ).find(([key]) => key === id);
  if (found === undefined) throw new TypeError(`no catalogue entry ${id}`);
  return found[1];
}

function carriers(models: Catalogue): readonly string[] {
  return Object.entries(models)
    .filter(([, value]) => value.capabilities.includes("mid_conv_system"))
    .map(([id]) => id);
}

describe("2.1.329 profile scalars", () => {
  it("pins the transcribed scalars", () => {
    expect({
      id: CLAUDE_CODE_2_1_329_PROFILE.id,
      cliVersion: CLAUDE_CODE_2_1_329_PROFILE.cliVersion,
      sdkVersion: CLAUDE_CODE_2_1_329_PROFILE.sdkVersion,
      endpoint: CLAUDE_CODE_2_1_329_PROFILE.endpoint,
      countTokensEndpoint: CLAUDE_CODE_2_1_329_PROFILE.countTokensEndpoint,
      entrypoint: CLAUDE_CODE_2_1_329_PROFILE.entrypoint,
      userAgent: CLAUDE_CODE_2_1_329_PROFILE.userAgent,
      buildTime: CLAUDE_CODE_2_1_329_PROFILE.buildTime,
      gitSha: CLAUDE_CODE_2_1_329_PROFILE.gitSha,
      attributionHeaderEnabled:
        CLAUDE_CODE_2_1_329_PROFILE.attributionHeaderEnabled,
      provider: CLAUDE_CODE_2_1_329_PROFILE.provider,
      anthropicVersion: CLAUDE_CODE_2_1_329_PROFILE.anthropicVersion,
      contextHintEnabled: CLAUDE_CODE_2_1_329_PROFILE.contextHintEnabled,
    }).toEqual({
      id: "claude-code-2.1.329-sdk-0.128.0",
      cliVersion: "2.1.329",
      sdkVersion: "0.128.0",
      endpoint: "https://api.anthropic.com/v1/messages?beta=true",
      countTokensEndpoint:
        "https://api.anthropic.com/v1/messages/count_tokens?beta=true",
      entrypoint: "cli",
      userAgent: "claude-cli/2.1.329 (external, cli)",
      buildTime: "2026-11-19T16:23:05Z",
      gitSha: "6a49dd29d929a6fe40c060bbccfeb5a7f037c958",
      attributionHeaderEnabled: true,
      provider: "anthropic",
      anthropicVersion: "2023-06-01",
      contextHintEnabled: false,
    });
  });

  it("keeps the eleven beta policy flags of 2.1.280", () => {
    expect(CLAUDE_CODE_2_1_329_PROFILE.betaPolicy).toEqual(
      CLAUDE_CODE_2_1_280_PROFILE.betaPolicy,
    );
    // Retained, not re-derived.
    expect(CLAUDE_CODE_2_1_329_PROFILE.betaPolicy.afkModeEnabled).toBe(false);
  });

  it("carries the live runtime version and authorize scopes as data", () => {
    expect(CLAUDE_CODE_2_1_329_PROFILE.runtimeVersion).toBe("v26.12.1");
    expect(CLAUDE_CODE_2_1_329_PROFILE.oauthAuthorizeScopes).toEqual([
      "org:create_api_key",
      "user:profile",
      "user:inference",
      "user:sessions:claude_code",
      "user:mcp_servers",
      "user:file_upload",
      "user:plugins",
      "user:privacy_consents:write",
      "org:desktop_config",
    ]);
  });

  it("leaves the optional data fields off every older profile", () => {
    for (const profile of [
      CLAUDE_CODE_2_1_195_PROFILE,
      CLAUDE_CODE_2_1_233_PROFILE,
      CLAUDE_CODE_2_1_280_PROFILE,
    ]) {
      expect(Object.keys(profile)).not.toContain("runtimeVersion");
      expect(Object.keys(profile)).not.toContain("oauthAuthorizeScopes");
    }
  });

  it("is deeply frozen", () => {
    const { supportedModels, oauthAuthorizeScopes } =
      CLAUDE_CODE_2_1_329_PROFILE;

    expect(Object.isFrozen(CLAUDE_CODE_2_1_329_PROFILE)).toBe(true);
    expect(Object.isFrozen(supportedModels)).toBe(true);
    expect(Object.isFrozen(entry("claude-opus-5-5").capabilities)).toBe(true);
    expect(Object.isFrozen(oauthAuthorizeScopes)).toBe(true);
  });
});

describe("2.1.329 catalogue", () => {
  it("holds the 24 entries in the extractor's order", () => {
    expect(Object.keys(CLAUDE_CODE_2_1_329_PROFILE.supportedModels)).toEqual(
      EXPECTED_MODEL_IDS,
    );
    expect(EXPECTED_MODEL_IDS).toHaveLength(24);
  });

  it("excludes the three bare dated ids of the second model list", () => {
    const keys = Object.keys(CLAUDE_CODE_2_1_329_PROFILE.supportedModels);

    for (const id of [
      "claude-haiku-4-5-20251001",
      "claude-opus-4-1-20250805",
      "claude-opus-4-5-20251101",
    ]) {
      expect(keys).not.toContain(id);
    }
  });

  it("adds exactly four rows to the 2.1.280 catalogue", () => {
    const previous = new Set(
      Object.keys(CLAUDE_CODE_2_1_280_PROFILE.supportedModels),
    );
    const added = Object.keys(CLAUDE_CODE_2_1_329_PROFILE.supportedModels)
      .filter((id) => !previous.has(id))
      .sort();

    expect(added).toEqual([
      "claude-fable-5-2",
      "claude-haiku-5-5",
      "claude-mythos-5-2",
      "claude-sonnet-5-5",
    ]);
    expect(
      [...previous].every((id) =>
        Object.hasOwn(CLAUDE_CODE_2_1_329_PROFILE.supportedModels, id),
      ),
    ).toBe(true);
  });

  it("pins the new rows' limits, families, defaults and context", () => {
    const rows = [
      ["claude-haiku-5-5", "haiku", "medium"],
      ["claude-sonnet-5-5", "sonnet", "medium"],
      ["claude-fable-5-2", "fable", "medium"],
      ["claude-mythos-5-2", "mythos", "medium"],
    ] as const;

    for (const [id, family, defaultEffort] of rows) {
      expect({ id, ...entry(id) }).toMatchObject({
        id,
        family,
        defaultEffort,
        maxOutputTokens: { default: 128000, upper: 128000 },
        context: { window: 1e6, native1m: true, supports1mBeta: true },
      });
    }
  });

  it("declares per_turn_effort on exactly the models whose report row does", () => {
    const perTurnEffort = Object.entries(
      CLAUDE_CODE_2_1_329_PROFILE.supportedModels,
    )
      .filter(([, value]) => value.capabilities.includes("per_turn_effort"))
      .map(([id]) => id);

    expect(perTurnEffort).toEqual([
      "claude-haiku-5-5",
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-fable-5-1",
      "claude-fable-5-2",
      "claude-mythos-5-2",
    ]);
  });

  /*
   * NEGATIVE ASSERTION, LOAD-BEARING. `mid_conv_system` graduated with its
   * beta; the 2.1.329 report carries the string on no entry, and carrying it
   * would drive a header the registry no longer has.
   */
  it("carries mid_conv_system on no entry", () => {
    expect(carriers(CLAUDE_CODE_2_1_329_PROFILE.supportedModels)).toEqual([]);
    // Anti-vacuity: the 2.1.280 catalogue does carry it.
    expect(carriers(CLAUDE_CODE_2_1_280_PROFILE.supportedModels)).toContain(
      "claude-opus-4-8",
    );
  });

  it("copies the unmapped capability strings verbatim", () => {
    expect(entry("claude-opus-5-5").capabilities).not.toContain(
      "total_tokens_reminder",
    );
    expect(entry("claude-opus-5-5").capabilities).toContain("tool_loaded_text");
    expect(entry("claude-sonnet-5-5").capabilities).toContain(
      "silent_turn_reminder",
    );
    expect(entry("claude-haiku-5-5").capabilities).toContain(
      "haiku_5_5_early_stopping_guidance",
    );
    expect(entry("claude-fable-5-2").capabilities).toContain(
      "script_output_cost",
    );
    expect(entry("claude-opus-4-8").capabilities).toContain(
      "send_user_file_input_whole",
    );
  });

  it("keeps the modelled limits and default efforts of the carried-over rows", () => {
    expect(entry("claude-sonnet-4-6").maxOutputTokens).toEqual({
      default: 32000,
      upper: 128000,
    });
    expect(entry("claude-opus-4-7").defaultEffort).toBe("xhigh");
    expect(entry("claude-mythos-5").capabilities).toEqual([
      "total_tokens_reminder",
      "tool_loaded_text",
    ]);
    expect(Object.keys(entry("claude-opus-4-5"))).not.toContain("context");
  });
});
