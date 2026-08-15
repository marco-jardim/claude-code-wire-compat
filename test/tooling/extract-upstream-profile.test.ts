// SPDX-License-Identifier: GPL-3.0-or-later

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BETA_REGISTRY_2_1_233 } from "../../src/profiles/beta-registry-2.1.233.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const scriptPath = path.join(
  repositoryRoot,
  "scripts",
  "extract-upstream-profile.mjs",
);
const fixtureRoot = path.join(
  repositoryRoot,
  "test",
  "tooling",
  "fixtures",
  "extract",
);

function fixture(name: string): string {
  return path.join(fixtureRoot, `${name}.txt`);
}

function extract(...args: readonly string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

function extractFixture(name: string) {
  return extract("--dump", fixture(name));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses a successful run's stdout, failing loudly on a non-zero exit. */
function report(name: string): Record<string, unknown> {
  const result = extractFixture(name);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);

  const parsed: unknown = JSON.parse(result.stdout);
  if (!isRecord(parsed)) throw new Error(`report for ${name} is not an object`);
  return parsed;
}

function section(name: string, key: string): Record<string, unknown> {
  const value = report(name)[key];
  if (!isRecord(value)) throw new Error(`${name} has no \`${key}\` object`);
  return value;
}

const WELL_FORMED_BETA_REGISTRY = {
  auxiliarySets: [
    { members: ["claude-code-20250219", "context-1m-2025-08-07"] },
    {
      unresolved:
        "a member reads a minified property name; nothing in the dump says which of the entry's two strings it selects",
    },
  ],
  entries: [
    { featureKey: "claude_code", header: "claude-code-20250219" },
    { featureKey: "oauth_auth", header: "oauth-2025-04-20" },
    { featureKey: "long_context", header: "context-1m-2025-08-07" },
    { featureKey: "effort", header: "effort-2025-11-24" },
  ],
  nullFiltered: true,
  nullSlots: [3],
  order: "frozen-array",
  slotCount: 5,
  unresolvedSlots: [],
};

const WELL_FORMED_MODELS = [
  {
    advisor_rank: 2,
    capabilities: ["effort", "thinking"],
    context: {
      native_1m: true,
      supports_1m_beta: true,
      supports_1m_suffix: false,
      window: 1_000_000,
    },
    default_effort: "high",
    effort_cost_index: { high: 1.6, low: 0.47, medium: 1 },
    family: "sonnet",
    id: "claude-sonnet-5",
    max_output_tokens: { default: 64_000, upper: 128_000 },
    pricing: "sonnet_tier",
  },
  {
    advisor_rank: 5,
    capabilities: ["speed"],
    context: { native_1m: false, supports_1m_beta: false, window: 200_000 },
    default_effort: "low",
    family: "haiku",
    id: "claude-haiku-4-5",
    max_output_tokens: { default: 8192, upper: 32_000 },
  },
];

const WELL_FORMED_SCALARS = {
  anthropicVersion: "2023-06-01",
  buildTime: "2026-07-20T11:02:41.000Z",
  endpoint: "/v1/messages?beta=true",
  fingerprintSalt: "59cf53e54c78",
  gitSha: "0123456789abcdef0123456789abcdef01234567",
  stainlessPackageVersion: "0.94.0",
  userAgent: "claude-cli/2.1.233 (external, cli)",
  version: "2.1.233",
};

describe("upstream profile extraction script", () => {
  it("reports every section of a well-formed dump", () => {
    expect(report("well-formed")).toEqual({
      betaRegistry: WELL_FORMED_BETA_REGISTRY,
      models: WELL_FORMED_MODELS,
      scalars: WELL_FORMED_SCALARS,
      tokenLimits: {
        "claude-3-haiku": [4096],
        "claude-3-opus": [4096],
        "claude-3-sonnet": [8192],
      },
    });
  });

  it("emits sorted keys at every depth", () => {
    const parsed = report("well-formed");
    const models = parsed.models;
    if (!Array.isArray(models) || !isRecord(models[0])) {
      throw new Error("well-formed report has no model records");
    }

    expect(Object.keys(parsed)).toEqual([
      "betaRegistry",
      "models",
      "scalars",
      "tokenLimits",
    ]);
    expect(Object.keys(models[0])).toEqual([...Object.keys(models[0])].sort());
    const context = models[0].context;
    expect(isRecord(context) ? Object.keys(context) : []).toEqual([
      "native_1m",
      "supports_1m_beta",
      "supports_1m_suffix",
      "window",
    ]);
  });

  /*
   * The minified forms are the whole reason a JSON parser cannot be used here:
   * `!0`/`!1` for booleans and `1e6`/`.47` for numbers are not JSON, and a
   * catalogue read with JSON.parse would come back empty on every real build.
   */
  it("decodes minified booleans and exponent-form numbers", () => {
    const models = report("well-formed").models;
    if (!Array.isArray(models) || !isRecord(models[0])) {
      throw new Error("well-formed report has no model records");
    }

    expect(models[0].context).toEqual({
      native_1m: true,
      supports_1m_beta: true,
      supports_1m_suffix: false,
      window: 1_000_000,
    });
    expect(models[0].effort_cost_index).toEqual({
      high: 1.6,
      low: 0.47,
      medium: 1,
    });
  });

  it("records both an identifier null slot and a literal one", () => {
    expect(section("null-slot", "betaRegistry")).toEqual({
      auxiliarySets: [],
      entries: [
        { featureKey: "claude_code", header: "claude-code-20250219" },
        { featureKey: "speed", header: "fast-mode-2026-02-01" },
        { featureKey: "afk_mode", header: "afk-mode-2026-01-31" },
      ],
      nullFiltered: true,
      nullSlots: [1, 2],
      order: "frozen-array",
      slotCount: 5,
      unresolvedSlots: [],
    });
  });

  /*
   * A field this tool does not model is upstream's business, not a failure.
   * Ignoring it silently is what lets the extractor survive a build that adds
   * one; erroring would make every catalogue change an outage.
   */
  it("ignores unknown model fields and wrongly typed known ones", () => {
    const models = report("unknown-model-fields").models;

    expect(models).toEqual([
      {
        capabilities: ["effort", "thinking"],
        context: { window: 500_000 },
        family: "opus",
        id: "claude-opus-9",
        max_output_tokens: { default: 32_000, upper: 64_000 },
      },
    ]);
  });

  it("reports auxiliary set membership it cannot decide without minified names", () => {
    const registry = section("well-formed", "betaRegistry");
    const sets = registry.auxiliarySets;
    if (!Array.isArray(sets) || !isRecord(sets[1])) {
      throw new Error("well-formed report has no auxiliary sets");
    }

    expect(typeof sets[1].unresolved).toBe("string");
    expect(sets[1].unresolved).toContain("minified property name");
  });

  it("reports an unresolved scalar rather than a guess", () => {
    expect(section("null-slot", "scalars")).toEqual({
      anthropicVersion: {
        unresolved: "no dated literal beside the anthropic-version header name",
      },
      buildTime: { unresolved: "no ISO timestamp beside BUILD_TIME" },
      endpoint: { unresolved: "no /v1/messages literal" },
      fingerprintSalt: {
        unresolved:
          "the known salt literal is absent and a bare 12-hex run is not distinguishable from any other hex literal",
      },
      gitSha: { unresolved: "no 40-character hex literal in the dump" },
      stainlessPackageVersion: {
        unresolved:
          "no dotted version beside the X-Stainless-Package-Version header name",
      },
      userAgent: { unresolved: "no literal containing claude-cli/" },
      version: {
        unresolved:
          "no VERSION literal and no dotted version beside BUILD_TIME",
      },
    });
  });

  it("reports an unresolved beta registry when no factory call is anchored", () => {
    expect(section("unknown-model-fields", "betaRegistry")).toEqual({
      unresolved:
        "no two-string factory call of the registry's shape is present",
    });
  });

  /*
   * Upstream hoists one entry's header into a const and passes it by name. A
   * rule demanding two string literals drops that entry and silently renumbers
   * every entry after it, which is a corrupted registry reported as a clean
   * one -- the worst failure mode this tool has.
   */
  it("keeps an entry whose header argument is an identifier", () => {
    expect(section("identifier-header", "betaRegistry")).toEqual({
      auxiliarySets: [],
      entries: [
        { featureKey: "claude_code", header: "claude-code-20250219" },
        {
          featureKey: "oauth_auth",
          header: { unresolved: "identifier-valued" },
        },
        { featureKey: "effort", header: "effort-2025-11-24" },
      ],
      nullFiltered: true,
      nullSlots: [],
      order: "frozen-array",
      slotCount: 3,
      unresolvedSlots: [],
    });
  });

  /*
   * The `id:"claude-` anchor also matches records that share the id namespace
   * without being catalogue entries. Counting those inflates the catalogue,
   * and a catalogue that claims models upstream does not serve is worse than
   * one that is short.
   */
  it("skips objects that carry a claude- id but no catalogue shape", () => {
    const models = report("catalogue-false-positive").models;

    expect(models).toEqual([
      {
        family: "sonnet",
        id: "claude-sonnet-5",
        max_output_tokens: { default: 64_000, upper: 128_000 },
      },
    ]);
  });

  it("captures a backtick user-agent template", () => {
    expect(section("user-agent-template", "scalars").userAgent).toBe(
      "claude-cli/${VERSION} (external, cli)",
    );
  });

  /*
   * `claude-cli/` also occurs inside prose templates. Emitting the surrounding
   * source as the user agent would put that source on the wire, so an anchor
   * that cannot be bounded to one clean literal is reported ambiguous.
   */
  it("reports an unboundable user-agent anchor rather than emitting source", () => {
    const scalars = section("garbage-user-agent", "scalars");

    expect(scalars.userAgent).toEqual({ unresolved: "anchor-ambiguous" });
    expect(JSON.stringify(scalars)).not.toContain("ISSUES_EXPLAINER");
    expect(scalars.version).toBe("2.1.233");
  });

  it.each([
    ["truncated", "error=truncated-dump\n"],
    ["empty", "error=empty-dump\n"],
    ["no-anchors", "error=no-anchors\n"],
  ])("rejects the %s dump", (name, expected) => {
    const result = extractFixture(name);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe(expected);
    expect(result.stderr).toBe("");
  });

  it("rejects a missing --dump argument", () => {
    const withoutValue = extract("--dump");

    expect(extract().status).toBe(1);
    expect(extract().stdout).toBe("error=missing-dump\n");
    expect(withoutValue.status).toBe(1);
    expect(withoutValue.stdout).toBe("error=missing-dump\n");
  });

  it("rejects a dump path that cannot be read without echoing it", () => {
    const absent = path.join(fixtureRoot, "SYNTHETIC-ABSENT-PATH.txt");

    const result = extract("--dump", absent);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("error=unreadable-dump\n");
    expect(result.stdout).not.toContain("SYNTHETIC-ABSENT-PATH");
    expect(result.stderr).toBe("");
  });

  it("produces byte-identical output across runs", () => {
    const first = extractFixture("well-formed");
    const second = extractFixture("well-formed");

    expect(first.stdout).toBe(second.stdout);
    expect(first.stdout.endsWith("}\n")).toBe(true);
  });

  /*
   * Ties the tool to the datum it exists to produce. The fixture is a synthetic
   * transcription of the 2.1.233 registry in upstream's own emitted form, so a
   * change to either the extractor's ordering or the committed registry breaks
   * this without anyone needing the 300 MB binary.
   */
  it("recovers the committed 2.1.233 registry order from an upstream-shaped array", () => {
    const registry = section("registry-2.1.233", "betaRegistry");
    const entries = registry.entries;
    if (!Array.isArray(entries) || !isRecord(entries[1])) {
      throw new Error("2.1.233 registry report has no entries");
    }

    // Mirrors the real build: this one entry is passed by identifier, and its
    // header is only present because the identifier was resolved.
    expect(entries[1]).toEqual({
      featureKey: "oauth_auth",
      header: "oauth-2025-04-20",
    });
    expect(registry.entries).toEqual(
      Object.values(BETA_REGISTRY_2_1_233).map((entry) => ({
        featureKey: entry.featureKey,
        header: entry.header,
      })),
    );
    expect(registry.order).toBe("frozen-array");
    expect(registry.slotCount).toBe(
      Object.keys(BETA_REGISTRY_2_1_233).length + 1,
    );
    expect(registry.nullSlots).toEqual([
      Object.keys(BETA_REGISTRY_2_1_233).length - 1,
    ]);
    expect(registry.unresolvedSlots).toEqual([]);
  });
});
