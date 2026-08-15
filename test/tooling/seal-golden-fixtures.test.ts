// SPDX-License-Identifier: GPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const scriptPath = path.join(
  repositoryRoot,
  "scripts",
  "seal-golden-fixtures.mjs",
);
const templateRoot = path.join(repositoryRoot, "test", "tooling", "fixtures");
const SECTION_HEADING = "### Fixture integrity";
const NEXT_HEADING = "## Billing fingerprint";
const ORPHAN_HASH =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const temporaryRoots: string[] = [];

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function manifestFixtures(manifestPath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!isRecord(parsed) || !isRecord(parsed.fixtures)) {
    throw new Error("synthetic manifest has no `fixtures` object");
  }
  return parsed.fixtures;
}

interface TreeOptions {
  /** Extra fixture files dropped into the synthetic golden directory. */
  readonly extraFixtures?: Readonly<Record<string, string>>;
  readonly doc?: (markdown: string) => string;
  readonly manifest?: (json: string) => string;
}

interface Tree {
  readonly root: string;
  readonly goldenRoot: string;
  readonly manifestPath: string;
  readonly docPath: string;
  readonly hashes: ReadonlyMap<string, string>;
}

function substitute(template: string, hashes: ReadonlyMap<string, string>) {
  let rendered = template;
  for (const [name, hash] of hashes) {
    rendered = rendered.replaceAll(`{{hash:${name}}}`, hash);
  }
  return rendered;
}

function makeTree(options: TreeOptions = {}): Tree {
  const root = mkdtempSync(path.join(os.tmpdir(), "seal-golden-"));
  temporaryRoots.push(root);

  const goldenRoot = path.join(root, "test", "fixtures", "golden");
  mkdirSync(goldenRoot, { recursive: true });
  mkdirSync(path.join(root, "docs"), { recursive: true });
  cpSync(path.join(templateRoot, "golden"), goldenRoot, { recursive: true });

  for (const [name, contents] of Object.entries(options.extraFixtures ?? {})) {
    writeFileSync(path.join(goldenRoot, name), contents);
  }

  const hashes = new Map<string, string>();
  for (const name of readdirSync(goldenRoot).sort()) {
    hashes.set(name, sha256(readFileSync(path.join(goldenRoot, name))));
  }

  const manifestPath = path.join(goldenRoot, "manifest.json");
  const docPath = path.join(root, "docs", "source-trace.md");
  const manifest = substitute(
    readFileSync(path.join(templateRoot, "manifest.template.json"), "utf8"),
    hashes,
  );
  const doc = substitute(
    readFileSync(path.join(templateRoot, "source-trace.template.md"), "utf8"),
    hashes,
  );

  writeFileSync(manifestPath, (options.manifest ?? ((json) => json))(manifest));
  writeFileSync(docPath, (options.doc ?? ((markdown) => markdown))(doc));

  return { root, goldenRoot, manifestPath, docPath, hashes };
}

function seal(root: string, ...args: readonly string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args, "--root", root], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

function git(root: string, ...args: readonly string[]) {
  return spawnSync(
    "git",
    [
      "-c",
      "user.email=seal@example.invalid",
      "-c",
      "user.name=Seal Test",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd: root, encoding: "utf8" },
  );
}

function snapshot(root: string): ReadonlyMap<string, string> {
  const targets = [
    path.join(root, "docs", "source-trace.md"),
    ...readdirSync(path.join(root, "test", "fixtures", "golden")).map((name) =>
      path.join(root, "test", "fixtures", "golden", name),
    ),
  ];
  const state = new Map<string, string>();
  for (const target of targets) {
    const stats = statSync(target);
    state.set(
      target,
      [
        String(stats.mtimeMs),
        sha256(readFileSync(target)),
        String(stats.size),
      ].join(":"),
    );
  }
  return state;
}

describe("golden fixture sealing script", () => {
  it("accepts a coherent tree", () => {
    const tree = makeTree();

    const result = seal(tree.root, "--check");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("fixtures=3 sealed=ok\n");
    expect(result.stderr).toBe("");
  });

  it("reports a diverged hash without leaking fixture content", () => {
    const tree = makeTree();
    const expected = tree.hashes.get("alpha.json") ?? "";
    const replacement = '{ "kind": "SYNTHETIC-SECRET-PAYLOAD" }\n';
    writeFileSync(path.join(tree.goldenRoot, "alpha.json"), replacement);
    const actual = sha256(Buffer.from(replacement, "utf8"));

    const result = seal(tree.root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      `fixture=alpha.json expected=${expected} actual=${actual}\n`,
    );
    expect(result.stdout).not.toContain("SYNTHETIC-SECRET-PAYLOAD");
    expect(result.stderr).not.toContain("SYNTHETIC-SECRET-PAYLOAD");
    expect(result.stderr).toBe("");
  });

  it("rejects a fixture the manifest does not publish", () => {
    const tree = makeTree({ extraFixtures: { "gamma.json": "{}\n" } });

    const result = seal(tree.root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "fixture=gamma.json problem=missing-manifest-entry\n",
    );
  });

  it("rejects a manifest entry whose file is gone", () => {
    const tree = makeTree();
    rmSync(path.join(tree.goldenRoot, "beta.canary.json"));

    const result = seal(tree.root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "fixture=beta.canary.json problem=missing-file\n",
    );
  });

  it("rejects a documented hash the manifest no longer publishes", () => {
    const tree = makeTree({
      doc: (markdown) =>
        markdown.replace(
          `\n${NEXT_HEADING}`,
          `\nStale note: \`${ORPHAN_HASH}\`.\n\n${NEXT_HEADING}`,
        ),
    });

    const result = seal(tree.root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      `hash=${ORPHAN_HASH} problem=orphan-documented-hash\n`,
    );
  });

  it("writes idempotently", () => {
    const tree = makeTree();
    const originalManifest = readFileSync(tree.manifestPath);
    const originalDoc = readFileSync(tree.docPath);

    const first = seal(tree.root, "--write");
    const firstManifest = readFileSync(tree.manifestPath);
    const firstDoc = readFileSync(tree.docPath);
    const second = seal(tree.root, "--write");

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(readFileSync(tree.manifestPath).equals(firstManifest)).toBe(true);
    expect(readFileSync(tree.docPath).equals(firstDoc)).toBe(true);
    // The template is deliberately unsorted, so the first pass must have moved.
    expect(firstManifest.equals(originalManifest)).toBe(false);
    expect(firstDoc.equals(originalDoc)).toBe(false);
    expect(seal(tree.root, "--check").status).toBe(0);
  });

  it("preserves every byte outside the sealed table", () => {
    const tree = makeTree();
    const original = readFileSync(tree.docPath, "utf8");
    const prefix = original.slice(0, original.indexOf(SECTION_HEADING));
    const suffix = original.slice(original.indexOf(NEXT_HEADING));
    const prose = "Second paragraph of section prose, also preserved";

    expect(seal(tree.root, "--write").status).toBe(0);

    const sealed = readFileSync(tree.docPath, "utf8");
    expect(sealed.startsWith(prefix)).toBe(true);
    expect(sealed.endsWith(suffix)).toBe(true);
    expect(sealed).toContain(prose);
    expect(sealed).toContain("**source of truth**.");
  });

  it("reuses the document's own line terminator", () => {
    const tree = makeTree({
      doc: (markdown) => markdown.replaceAll("\n", "\r\n"),
    });
    const original = readFileSync(tree.docPath, "utf8");

    expect(seal(tree.root, "--write").status).toBe(0);

    const sealed = readFileSync(tree.docPath, "utf8");
    expect(sealed).not.toMatch(/(?<!\r)\n/u);
    expect(sealed.slice(0, sealed.indexOf(SECTION_HEADING))).toBe(
      original.slice(0, original.indexOf(SECTION_HEADING)),
    );
    expect(sealed.slice(sealed.indexOf(NEXT_HEADING))).toBe(
      original.slice(original.indexOf(NEXT_HEADING)),
    );
  });

  it("aligns the rewritten table into fixed-width columns", () => {
    const tree = makeTree();

    expect(seal(tree.root, "--write").status).toBe(0);

    const sealed = readFileSync(tree.docPath, "utf8");
    const section = sealed.slice(sealed.indexOf(SECTION_HEADING));
    const rows = section
      .split("\n")
      .filter((line) => line.startsWith("| `test/fixtures/golden/"));
    const header = section
      .split("\n")
      .find((line) => line.startsWith("| Fixture"));

    expect(rows).toHaveLength(3);
    expect(header).toBeDefined();
    expect(new Set(rows.map((row) => row.length)).size).toBe(1);
    expect(rows[0]?.length).toBe(header?.length);
    expect(rows.map((row) => row.split("|")[1]?.trim())).toEqual([
      "`test/fixtures/golden/alpha.json`",
      "`test/fixtures/golden/beta.canary.json`",
      "`test/fixtures/golden/decision.json`",
    ]);
    expect(section).toContain("| n/a (decision record) |");
  });

  it("refuses to write over an unrelated dirty tree", () => {
    const tree = makeTree();
    expect(git(tree.root, "init", "-q").status).toBe(0);
    expect(git(tree.root, "add", "-A").status).toBe(0);
    expect(git(tree.root, "commit", "-q", "-m", "synthetic").status).toBe(0);
    writeFileSync(path.join(tree.root, "README.md"), "dirty\n");
    const before = snapshot(tree.root);

    const result = seal(tree.root, "--write");

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("refused=dirty-tree path=README.md\n");
    expect(snapshot(tree.root)).toEqual(before);
  });

  it("writes nothing in check mode", () => {
    const coherent = makeTree();
    const diverged = makeTree({
      extraFixtures: { "gamma.json": "{}\n" },
    });
    const before = [snapshot(coherent.root), snapshot(diverged.root)];

    expect(seal(coherent.root, "--check").status).toBe(0);
    expect(seal(diverged.root, "--check").status).toBe(1);
    expect(seal(diverged.root).status).toBe(1);

    expect([snapshot(coherent.root), snapshot(diverged.root)]).toEqual(before);
  });

  it("reports a manifest without a fixtures object", () => {
    const tree = makeTree({ manifest: () => "{}\n" });

    const result = seal(tree.root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("golden manifest has no `fixtures` object");
  });

  it("reports a source trace without the sealed section", () => {
    const tree = makeTree({
      doc: (markdown) => markdown.replace(SECTION_HEADING, "### Other section"),
    });

    const result = seal(tree.root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "source trace has no `### Fixture integrity`",
    );
  });

  it("seals a section that runs to end of file", () => {
    const tree = makeTree({
      doc: (markdown) => markdown.slice(0, markdown.indexOf(NEXT_HEADING)),
    });

    const result = seal(tree.root, "--write");

    expect(result.status).toBe(0);
    expect(readFileSync(tree.docPath, "utf8")).not.toContain(NEXT_HEADING);
    expect(seal(tree.root, "--check").status).toBe(0);
  });

  it("seals a zero-byte fixture and a name carrying extra dots", () => {
    const tree = makeTree({ extraFixtures: { "empty.record.json": "" } });

    expect(seal(tree.root, "--write").status).toBe(0);

    const fixtures = manifestFixtures(tree.manifestPath);

    expect(fixtures["empty.record.json"]).toBe(EMPTY_SHA256);
    expect(Object.keys(fixtures)).toEqual([
      "alpha.json",
      "beta.canary.json",
      "decision.json",
      "empty.record.json",
    ]);
    expect(readFileSync(tree.docPath, "utf8")).toContain(
      "`test/fixtures/golden/empty.record.json`",
    );
    expect(seal(tree.root, "--check").status).toBe(0);
  });
});
