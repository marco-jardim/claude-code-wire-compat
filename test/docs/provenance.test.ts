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
const FIRST_PARTY_PROTOCOL_DOCUMENTS: readonly string[] = ["versions/README.md"];

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
