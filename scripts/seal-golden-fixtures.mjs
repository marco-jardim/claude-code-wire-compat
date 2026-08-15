// SPDX-License-Identifier: GPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FAILURE_EXIT_CODE = 1;
const MANIFEST_NAME = "manifest.json";
const GOLDEN_PREFIX = "test/fixtures/golden/";
const SECTION_HEADING = "### Fixture integrity";
const SHA256_HEX = /\b[0-9a-f]{64}\b/gu;
const TABLE_BLOCK = /(?:^[ \t]*\|[^\r\n]*(?:\r?\n|$))+/mu;
const NO_MODEL = "n/a (decision record)";
const TABLE_HEADER = ["Fixture", "Model", "SHA-256"];

const defaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function rootArgument(argv) {
  const rootIndex = argv.indexOf("--root");
  if (rootIndex === -1) return defaultRoot;

  const root = argv[rootIndex + 1];
  if (typeof root !== "string" || root.length === 0) {
    throw new Error("--root requires a directory path");
  }
  return path.resolve(root);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/*
 * Every rewritten line reuses the document's own dominant terminator. The repo
 * is checked out on Windows with autocrlf, so a script that normalised newlines
 * would rewrite every line of the document it only meant to reseal.
 */
function dominantEol(text) {
  const crlf = (text.match(/\r\n/gu) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/gu) ?? []).length;
  return crlf > lf ? "\r\n" : "\n";
}

function readTextFile(filePath, description) {
  if (!existsSync(filePath)) {
    throw new Error(`${description} is missing: ${filePath}`);
  }
  return readFileSync(filePath).toString("utf8");
}

function readManifest(manifestPath) {
  const source = readTextFile(manifestPath, "golden manifest");
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(`golden manifest is not valid JSON: ${manifestPath}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`golden manifest is not an object: ${manifestPath}`);
  }
  const fixtures = Reflect.get(parsed, "fixtures");
  if (!isRecord(fixtures)) {
    throw new Error(`golden manifest has no \`fixtures\` object`);
  }
  for (const [name, hash] of Object.entries(fixtures)) {
    if (typeof hash !== "string") {
      throw new Error(`golden manifest hash for ${name} is not a string`);
    }
  }
  const models = Reflect.get(parsed, "models");
  return {
    source,
    sourceCommit: Reflect.get(parsed, "sourceCommit"),
    models: isRecord(models) ? models : {},
    fixtures,
  };
}

function diskHashes(goldenRoot) {
  if (!existsSync(goldenRoot)) {
    throw new Error(`golden fixture directory is missing: ${goldenRoot}`);
  }
  const names = readdirSync(goldenRoot)
    .filter((name) => name.endsWith(".json") && name !== MANIFEST_NAME)
    .sort();

  const hashes = new Map();
  for (const name of names) {
    const contents = readFileSync(path.join(goldenRoot, name));
    hashes.set(name, createHash("sha256").update(contents).digest("hex"));
  }
  return hashes;
}

/*
 * Section bounds are the normative rule enforced by
 * test/governance/source-trace-integrity.test.ts: the heading starts it and the
 * next level-two heading ends it. Any other slicing would let this script seal a
 * region the governance test does not read.
 */
function sectionBounds(markdown) {
  const start = markdown.indexOf(SECTION_HEADING);
  if (start < 0) {
    throw new Error(`source trace has no \`${SECTION_HEADING}\``);
  }
  const rest = markdown.slice(start);
  const end = rest.search(/^## /mu);
  return { start, end: end < 0 ? markdown.length : start + end };
}

function documentedHashes(section) {
  return section.match(SHA256_HEX) ?? [];
}

function modelCell(models, name) {
  const model = Reflect.get(models, name);
  return typeof model === "string" && model.length > 0
    ? `\`${model}\``
    : NO_MODEL;
}

function formatTable(rows, eol) {
  const widths = TABLE_HEADER.map((heading, column) =>
    Math.max(
      3,
      heading.length,
      ...rows.map((row) => row[column].length),
      // A single-row table still needs the header width to win.
      0,
    ),
  );
  const line = (cells) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column])).join(" | ")} |`;
  const separator = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;

  return [line(TABLE_HEADER), separator, ...rows.map(line)].join(eol) + eol;
}

function tableRows(hashes, models) {
  return [...hashes.keys()]
    .sort()
    .map((name) => [
      `\`test/fixtures/golden/${name}\``,
      modelCell(models, name),
      `\`${hashes.get(name)}\``,
    ]);
}

function check(paths) {
  const manifest = readManifest(paths.manifest);
  const hashes = diskHashes(paths.golden);
  const trace = readTextFile(paths.trace, "source trace");
  const bounds = sectionBounds(trace);
  const section = trace.slice(bounds.start, bounds.end);
  const published = new Set(Object.values(manifest.fixtures));

  const problems = [];
  for (const [name, actual] of hashes) {
    const expected = Reflect.get(manifest.fixtures, name);
    if (typeof expected !== "string") {
      problems.push(`fixture=${name} problem=missing-manifest-entry`);
      continue;
    }
    if (expected !== actual) {
      problems.push(`fixture=${name} expected=${expected} actual=${actual}`);
      continue;
    }
    if (!section.includes(name) || !section.includes(expected)) {
      problems.push(`fixture=${name} problem=undocumented`);
    }
  }

  for (const name of Object.keys(manifest.fixtures).sort()) {
    if (!hashes.has(name)) {
      problems.push(`fixture=${name} problem=missing-file`);
    }
  }

  for (const hash of documentedHashes(section)) {
    if (!published.has(hash)) {
      problems.push(`hash=${hash} problem=orphan-documented-hash`);
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.log(problem);
    process.exitCode = FAILURE_EXIT_CODE;
    return;
  }

  console.log(`fixtures=${hashes.size} sealed=ok`);
}

/*
 * An untracked path is hazardous only when it sits in the golden directory:
 * sealing it would publish a manifest hash for content no commit carries. Any
 * other untracked file can neither be corrupted by the reseal nor ride along in
 * its commit, so refusing on it is a false positive.
 */
function untrackedHazard(target) {
  return (
    target.startsWith(GOLDEN_PREFIX) ||
    (target.endsWith("/") && GOLDEN_PREFIX.startsWith(target))
  );
}

/*
 * Resealing rewrites two tracked files, so it must not run on top of unrelated
 * uncommitted work: the operator could not otherwise tell the reseal apart from
 * whatever else was in flight. A tree with no git at all (a synthetic fixture
 * tree) has nothing to confuse and is allowed.
 */
function refusals(root, allowed) {
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  });
  if (status.error !== undefined || status.status !== 0) return [];

  const refused = [];
  for (const line of status.stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const code = line.slice(0, 2);
    const entry = line.slice(3).trim();
    const target = entry.includes(" -> ")
      ? entry.slice(entry.indexOf(" -> ") + 4)
      : entry;
    const normalized = target.replaceAll('"', "").replaceAll("\\", "/");

    if (code === "??") {
      if (untrackedHazard(normalized)) {
        refused.push(`refused=untracked-fixture path=${normalized}`);
      }
      continue;
    }
    if (!allowed.includes(normalized)) {
      refused.push(`refused=dirty-tree path=${normalized}`);
    }
  }
  return refused.sort();
}

function sealedManifest(manifest, hashes, eol) {
  const models = {};
  for (const name of Object.keys(manifest.models).sort()) {
    if (hashes.has(name)) models[name] = Reflect.get(manifest.models, name);
  }
  const fixtures = {};
  for (const name of [...hashes.keys()].sort()) {
    fixtures[name] = hashes.get(name);
  }

  const sealed =
    manifest.sourceCommit === undefined
      ? { models, fixtures }
      : { sourceCommit: manifest.sourceCommit, models, fixtures };
  const json = `${JSON.stringify(sealed, undefined, 2)}\n`;
  return eol === "\n" ? json : json.replaceAll("\n", eol);
}

function sealedTrace(trace, hashes, models) {
  const bounds = sectionBounds(trace);
  const section = trace.slice(bounds.start, bounds.end);
  const table = section.match(TABLE_BLOCK);
  if (table === null) {
    throw new Error(`\`${SECTION_HEADING}\` has no fixture table`);
  }

  const eol = dominantEol(trace);
  const rendered = formatTable(tableRows(hashes, models), eol);
  const replacement = table[0].endsWith("\n")
    ? rendered
    : rendered.slice(0, -eol.length);
  const sealedSection =
    section.slice(0, table.index) +
    replacement +
    section.slice(table.index + table[0].length);

  return trace.slice(0, bounds.start) + sealedSection + trace.slice(bounds.end);
}

function write(paths, root) {
  const refused = refusals(root, [
    `${GOLDEN_PREFIX}${MANIFEST_NAME}`,
    "docs/source-trace.md",
  ]);
  if (refused.length > 0) {
    for (const refusal of refused) console.log(refusal);
    process.exitCode = FAILURE_EXIT_CODE;
    return;
  }

  const manifest = readManifest(paths.manifest);
  const hashes = diskHashes(paths.golden);
  const trace = readTextFile(paths.trace, "source trace");

  const nextManifest = sealedManifest(
    manifest,
    hashes,
    dominantEol(manifest.source),
  );
  const nextTrace = sealedTrace(trace, hashes, manifest.models);

  if (nextManifest !== manifest.source) {
    writeFileSync(paths.manifest, Buffer.from(nextManifest, "utf8"));
  }
  if (nextTrace !== trace) {
    writeFileSync(paths.trace, Buffer.from(nextTrace, "utf8"));
  }

  console.log(`fixtures=${hashes.size} sealed=written`);
}

try {
  const argv = process.argv.slice(2);
  const root = rootArgument(argv);
  const paths = {
    golden: path.join(root, "test", "fixtures", "golden"),
    manifest: path.join(root, "test", "fixtures", "golden", MANIFEST_NAME),
    trace: path.join(root, "docs", "source-trace.md"),
  };

  if (argv.includes("--write")) write(paths, root);
  else check(paths);
} catch (error) {
  console.log(
    `error=${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = FAILURE_EXIT_CODE;
}
