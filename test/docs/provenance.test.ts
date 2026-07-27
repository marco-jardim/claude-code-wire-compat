// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const protocolDirectory = join(root, "docs", "protocol");
const attributionPath = join(root, "docs", "ATTRIBUTION.md");

/**
 * Upstream identity. Every ported protocol document derives from this exact
 * repository at this exact commit; the provenance header of each document and
 * the attribution table must agree with these values.
 */
const SOURCE_REPOSITORY =
  "https://github.com/marco-jardim/opencode-anthropic-fix";
const SOURCE_COMMIT = "466d500";
const SOURCE_LICENSE = "GPL-3.0-or-later";

interface PortedDocument {
  /** Path relative to `docs/protocol/`, in POSIX form. */
  readonly destination: string;
  /** Path relative to the upstream repository root, in POSIX form. */
  readonly source: string;
  /** Exact line count of the source file at `SOURCE_COMMIT`. */
  readonly sourceLines: number;
}

/**
 * The exact protocol knowledge corpus. Adding a document to `docs/protocol/`
 * without adding it here, or listing one here without porting it, fails.
 */
const PROTOCOL_CORPUS: readonly PortedDocument[] = [
  {
    destination: "reverse-engineering.md",
    source: "docs/claude-code-reverse-engineering.md",
    sourceLines: 1891,
  },
  {
    destination: "http-headers-and-system-prompt.md",
    source: "docs/mimese-http-header-system-prompt.md",
    sourceLines: 866,
  },
  {
    destination: "fingerprint-extraction.md",
    source: "docs/MIMESE_FINGERPRINT_EXTRACTION.md",
    sourceLines: 800,
  },
  {
    destination: "message-flow.md",
    source: "docs/MESSAGE_FLOW_DIAGRAM.md",
    sourceLines: 491,
  },
  {
    destination: "tool-use-examples.md",
    source: "docs/TOOL_USE_CODE_EXAMPLES.md",
    sourceLines: 479,
  },
  {
    destination: "code-comparison-reference.md",
    source: "docs/CODE_COMPARISON_REFERENCE.md",
    sourceLines: 420,
  },
  {
    destination: "divergence-analysis.md",
    source: "docs/DIVERGENCE_ANALYSIS.md",
    sourceLines: 413,
  },
  {
    destination: "quick-reference.md",
    source: "docs/QUICK_REFERENCE.md",
    sourceLines: 209,
  },
  {
    destination: "system-prompt-search-results.md",
    source: "docs/SEARCH_RESULTS_SUMMARY.md",
    sourceLines: 202,
  },
  {
    destination: "divergence-executive-summary.md",
    source: "docs/EXECUTIVE_SUMMARY.md",
    sourceLines: 182,
  },
  {
    destination: "cache-transparency.md",
    source: "docs/anti-verbosity-and-cache-transparency.md",
    sourceLines: 111,
  },
  {
    destination: "beta-decision-table.md",
    source: "docs/mimicry/beta-decision-table.md",
    sourceLines: 72,
  },
];

/**
 * The per-version wire analyses. Each Claude Code release may change the wire
 * contract, so every pinned version keeps its own analysis document.
 */
const VERSION_ANALYSES: readonly PortedDocument[] = [
  {
    destination: "versions/claude-code-2.1.119-analysis.md",
    source: "docs/claude-code-2.1.119-analysis.md",
    sourceLines: 77,
  },
  {
    destination: "versions/claude-code-2.1.133-analysis.md",
    source: "docs/claude-code-2.1.133-analysis.md",
    sourceLines: 101,
  },
  {
    destination: "versions/claude-code-2.1.143-analysis.md",
    source: "docs/claude-code-2.1.143-analysis.md",
    sourceLines: 452,
  },
  {
    destination: "versions/claude-code-2.1.150-analysis.md",
    source: "docs/claude-code-2.1.150-analysis.md",
    sourceLines: 142,
  },
  {
    destination: "versions/claude-code-2.1.159-analysis.md",
    source: "docs/claude-code-2.1.159-analysis.md",
    sourceLines: 155,
  },
  {
    destination: "versions/claude-code-2.1.195-analysis.md",
    source: "docs/claude-code-2.1.195-analysis.md",
    sourceLines: 334,
  },
];

const PORTED_DOCUMENTS: readonly PortedDocument[] = [
  ...PROTOCOL_CORPUS,
  ...VERSION_ANALYSES,
];

/** Documents that are authored for this package rather than ported. */
const FIRST_PARTY_PROTOCOL_DOCUMENTS: readonly string[] = [
  "versions/README.md",
];

const portedDestinations = new Set(
  PORTED_DOCUMENTS.map((entry) => entry.destination),
);

const profilesDirectory = join(root, "src", "profiles");

/**
 * Every profile the package can pin is derived from a specific Claude Code
 * release, so the analysis for that release must be part of the corpus.
 */
const declaredProfileVersions = (): string[] => {
  const ids = readdirSync(profilesDirectory)
    .filter((name) => name.endsWith(".ts"))
    .flatMap((name) => {
      const source = readFileSync(join(profilesDirectory, name), "utf8");

      return [...source.matchAll(/\bid:\s*"([^"]+)"/gu)].map(
        (match) => match[1],
      );
    });

  return [
    ...new Set(
      ids.flatMap((id) => {
        const version = /(\d+\.\d+\.\d+)/u.exec(id);

        return version ? [version[1]] : [];
      }),
    ),
  ].sort();
};

const listMarkdown = (directory: string): string[] => {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) =>
      relative(protocolDirectory, join(entry.parentPath, entry.name))
        .split(sep)
        .join(posix.sep),
    )
    .sort();
};

const readAttribution = (): string =>
  existsSync(attributionPath) ? readFileSync(attributionPath, "utf8") : "";

describe("protocol documentation provenance", () => {
  it("publishes the attribution manifest", () => {
    const attribution = readAttribution();

    expect(existsSync(attributionPath)).toBe(true);
    expect(attribution).toContain(SOURCE_REPOSITORY);
    expect(attribution).toContain(SOURCE_COMMIT);
    expect(attribution).toContain(SOURCE_LICENSE);
    expect(attribution).toMatch(
      /\|\s*Ported file\s*\|\s*Source path\s*\|\s*Source lines\s*\|\s*Modification\s*\|/u,
    );
    expect(attribution).toContain("GPL-3.0 section 5(a)");
  });

  it.each(PORTED_DOCUMENTS.map((entry) => [entry.destination, entry] as const))(
    "ports %s with a complete provenance header",
    (_destination, entry) => {
      const path = join(protocolDirectory, entry.destination);

      expect(existsSync(path)).toBe(true);

      const contents = readFileSync(path, "utf8");
      const lines = contents.split("\n");
      const header = lines.slice(0, 12).join("\n");

      expect(lines[0]).toBe(
        `<!-- SPDX-License-Identifier: ${SOURCE_LICENSE} -->`,
      );
      expect(lines[2]).toBe("> **Provenance**");
      expect(header).toContain(`> - Source repository: <${SOURCE_REPOSITORY}>`);
      expect(header).toContain(`> - Source path: \`${entry.source}\``);
      expect(header).toContain(`> - Source commit: \`${SOURCE_COMMIT}\``);
      expect(header).toContain(`> - License: \`${SOURCE_LICENSE}\``);
      expect(header).toMatch(
        /> - (Ported verbatim|Ported with modifications: \S)/u,
      );
    },
  );

  it.each(PORTED_DOCUMENTS.map((entry) => [entry.destination, entry] as const))(
    "records %s in the attribution table",
    (destination, entry) => {
      const attribution = readAttribution();
      const row = attribution
        .split("\n")
        .find((line) => line.includes(`docs/protocol/${destination}`));

      expect(row).toBeDefined();
      expect(row).toContain(`\`${entry.source}\``);
      expect(row).toContain(String(entry.sourceLines));
    },
  );

  it("leaves no protocol document unaccounted for", () => {
    const onDisk = listMarkdown(protocolDirectory);
    const declared = new Set([
      ...portedDestinations,
      ...FIRST_PARTY_PROTOCOL_DOCUMENTS,
    ]);
    const undeclared = onDisk.filter((name) => !declared.has(name));

    expect(undeclared).toEqual([]);
  });

  it("keeps the ported body faithful to the source line count", () => {
    const shortfall = PORTED_DOCUMENTS.filter((entry) => {
      const path = join(protocolDirectory, entry.destination);

      if (!existsSync(path)) {
        return true;
      }

      const body = readFileSync(path, "utf8").split("\n");
      const headerEnd = body.findIndex(
        (line, index) => index > 2 && !line.startsWith(">") && line !== "",
      );

      return body.length - headerEnd < entry.sourceLines;
    }).map((entry) => entry.destination);

    expect(shortfall).toEqual([]);
  });
});

interface NonPortedDocument {
  /** Path relative to the upstream repository root, in POSIX form. */
  readonly source: string;
  /** Exact non-empty line count of the source file at `SOURCE_COMMIT`. */
  readonly sourceLines: number;
  /** Why the file is not protocol knowledge. */
  readonly category: "plugin-operational" | "planning material";
}

/**
 * Upstream documents that were reviewed and deliberately left behind. Recording
 * them is what makes the port auditable: a reader can tell an intentional
 * exclusion from an oversight.
 */
const NON_PORTED_DOCUMENTS: readonly NonPortedDocument[] = [
  {
    source: "docs/LATENCY_ANALYSIS_REPORT.md",
    sourceLines: 363,
    category: "plugin-operational",
  },
  {
    source: "docs/EXPLORATION_COMPLETE.md",
    sourceLines: 307,
    category: "planning material",
  },
  {
    source: "docs/EXPLORATION_EXECUTIVE_SUMMARY.md",
    sourceLines: 314,
    category: "planning material",
  },
  {
    source: "docs/EXPLORATION_INDEX.md",
    sourceLines: 327,
    category: "planning material",
  },
  {
    source: "docs/EXPLORATION_SUMMARY.md",
    sourceLines: 345,
    category: "planning material",
  },
  {
    source: "docs/fork-customizations.md",
    sourceLines: 148,
    category: "plugin-operational",
  },
  {
    source: "docs/future-improvements.md",
    sourceLines: 280,
    category: "planning material",
  },
  {
    source: "docs/agent-native-audit.md",
    sourceLines: 209,
    category: "plugin-operational",
  },
  {
    source: "docs/plan-b-new-plugins-feasibility.md",
    sourceLines: 526,
    category: "planning material",
  },
  {
    source: "docs/mimicry/strategy-decision-table.md",
    sourceLines: 45,
    category: "plugin-operational",
  },
];

/**
 * The whole planning tree is excluded. Counts are the verified file counts at
 * `SOURCE_COMMIT`, not the counts stated in the COM-466 plan.
 */
const NON_PORTED_PLANS_TREE = {
  directory: "docs/plans/",
  files: 13,
  qaDirectory: "docs/plans/qa/",
  qaFiles: 7,
} as const;

const nonPortSection = (): string => {
  const attribution = readAttribution();
  const start = attribution.indexOf("## Intentionally not ported");

  if (start === -1) {
    return "";
  }

  const rest = attribution.slice(start + 1);
  const end = rest.indexOf("\n## ");

  return end === -1 ? rest : rest.slice(0, end);
};

describe("intentional non-ports", () => {
  it("publishes the non-port section", () => {
    const section = nonPortSection();

    expect(section).not.toBe("");
    expect(section).toMatch(
      /\|\s*Excluded path\s*\|\s*Source lines\s*\|\s*Category\s*\|\s*Reason\s*\|/u,
    );
  });

  it.each(NON_PORTED_DOCUMENTS.map((entry) => [entry.source, entry] as const))(
    "records %s with its exact line count, category, and reason",
    (source, entry) => {
      const row = nonPortSection()
        .split("\n")
        .find((line) => line.includes(`\`${source}\``));

      expect(row).toBeDefined();
      expect(row).toContain(String(entry.sourceLines));
      expect(row).toContain(entry.category);
      // Reason column must be filled in, not an empty cell.
      expect(row?.split("|").at(-2)?.trim().length).toBeGreaterThan(20);
    },
  );

  it("records the excluded planning tree with verified file counts", () => {
    const section = nonPortSection();
    const row = section
      .split("\n")
      .find((line) => line.includes(`\`${NON_PORTED_PLANS_TREE.directory}\``));

    expect(row).toBeDefined();
    expect(row).toContain(`${String(NON_PORTED_PLANS_TREE.files)} files`);
    expect(row).toContain(`${String(NON_PORTED_PLANS_TREE.qaFiles)} files`);
    expect(row).toContain(NON_PORTED_PLANS_TREE.qaDirectory);
    expect(row).toContain("planning material");
    // The COM-466 plan stated 14 files; the verified count is 13.
    expect(section).toContain("the plan stated 14");
  });

  it("keeps every excluded document out of the ported corpus", () => {
    const excluded = new Set(
      NON_PORTED_DOCUMENTS.map((entry) => entry.source.toLowerCase()),
    );
    const portedSources = PORTED_DOCUMENTS.map((entry) =>
      entry.source.toLowerCase(),
    );

    expect(portedSources.filter((source) => excluded.has(source))).toEqual([]);

    const citedSources = listMarkdown(protocolDirectory).flatMap((name) => {
      const contents = readFileSync(join(protocolDirectory, name), "utf8");
      const cited = /> - Source path: `([^`]+)`/u.exec(contents);

      return cited ? [cited[1].toLowerCase()] : [];
    });

    expect(citedSources.filter((source) => excluded.has(source))).toEqual([]);
    expect(
      citedSources.filter((source) =>
        source.startsWith(NON_PORTED_PLANS_TREE.directory),
      ),
    ).toEqual([]);
  });
});

describe("per-version wire analyses", () => {
  it("explains why the versioned analyses exist and when a new one is required", () => {
    const readme = join(protocolDirectory, "versions", "README.md");

    expect(existsSync(readme)).toBe(true);

    const contents = readFileSync(readme, "utf8");

    expect(contents).toContain("wire contract");
    expect(contents).toContain("src/profiles/");
    expect(contents).toContain("REQUIRED");
  });

  it("covers every profile version declared in src/profiles/", () => {
    const versions = declaredProfileVersions();

    expect(versions.length).toBeGreaterThan(0);

    const uncovered = versions.filter(
      (version) =>
        !existsSync(
          join(
            protocolDirectory,
            "versions",
            `claude-code-${version}-analysis.md`,
          ),
        ),
    );

    expect(uncovered).toEqual([]);
  });
});
