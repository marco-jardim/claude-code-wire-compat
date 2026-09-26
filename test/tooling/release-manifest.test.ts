// SPDX-License-Identifier: GPL-3.0-or-later
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

const script = resolve("scripts/verify-release-manifest.mjs");
const name = "@tormentalabs/claude-code-wire-compat";
const version = "1.2.3-rc.1";
const filename = `tormentalabs-claude-code-wire-compat-${version}.tgz`;
const identity = Buffer.from(JSON.stringify({ name, version }));
const payload = Buffer.from("export const value = 1;\n");
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

interface Entry {
  name: string;
  body: Buffer;
  type?: string;
  prefix?: string;
}
const base: Entry[] = [
  { name: "package/package.json", body: identity },
  { name: "package/dist/index.js", body: payload },
  { name: "package/empty.txt", body: Buffer.alloc(0) },
];
function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function manifest(entries = base): Record<string, unknown> {
  return {
    commit: "source-commit-not-head",
    archive: filename,
    integrity: "sha512-audit-only",
    files: entries.map((entry) => ({
      path: entry.name.slice(8),
      size: entry.body.length,
      sha256: hash(entry.body),
    })),
  };
}
function checksum(h: Buffer): void {
  h.fill(32, 148, 156);
  let sum = 0;
  for (const byte of h) sum += byte;
  h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "latin1");
}
function tar(entries = base, trailer = Buffer.alloc(1024)): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const h = Buffer.alloc(512);
    h.write(entry.name, 0, "latin1");
    h.write("0000644\0", 100, "latin1");
    h.write("0000000\0", 108, "latin1");
    h.write("0000000\0", 116, "latin1");
    h.write(
      `${entry.body.length.toString(8).padStart(11, "0")}\0`,
      124,
      "latin1",
    );
    h.write("00000000000\0", 136, "latin1");
    h.write(entry.type ?? "0", 156, "latin1");
    h.write("ustar\u000000", 257, "latin1");
    if (entry.prefix) h.write(entry.prefix, 345, "latin1");
    checksum(h);
    parts.push(
      h,
      entry.body,
      Buffer.alloc((512 - (entry.body.length % 512)) % 512),
    );
  }
  return Buffer.concat([...parts, trailer]);
}
interface Setup {
  archive?: Buffer;
  approved?: unknown;
  approvalText?: string;
  checkout?: unknown;
  tarballName?: string;
  args?: string[];
  manifestDirectory?: boolean;
}
function run(setup: Setup = {}) {
  const root = mkdtempSync(join(tmpdir(), "release-manifest-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(setup.checkout ?? { name, version }),
  );
  mkdirSync(join(root, "release-manifests"));
  const approvalPath = join(root, "release-manifests", `${version}.json`);
  if (setup.manifestDirectory) mkdirSync(approvalPath);
  else if (setup.approved !== null)
    writeFileSync(
      approvalPath,
      setup.approvalText ??
        `${JSON.stringify(setup.approved ?? manifest(), null, 2)}\n`,
    );
  const archiveName = setup.tarballName ?? filename;
  writeFileSync(join(root, archiveName), setup.archive ?? gzipSync(tar()));
  const result = spawnSync(
    process.execPath,
    [script, ...(setup.args ?? [archiveName])],
    { cwd: root, encoding: "utf8", timeout: 30_000 },
  );
  if (result.error) throw result.error;
  return result;
}
function expectRejected(setup: Setup, code: string): void {
  const result = run(setup);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain(`FAIL ${code}`);
}

describe("reviewed release manifest gate", () => {
  it("accepts exact archived bytes including empty files and prints the actual SRI", () => {
    const archive = gzipSync(tar());
    const result = run({ archive });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      `OK ${version} files=3 archive=sha512-${createHash("sha512").update(archive).digest("base64")}`,
    );
  });
  it("rejects duplicate JSON keys instead of accepting the last value", () => {
    const canonical = `${JSON.stringify(manifest(), null, 2)}\n`;
    expectRejected(
      {
        approvalText: canonical.replace(
          '  "files": [',
          '  "files": [],\n  "files": [',
        ),
      },
      "MANIFEST_NOT_CANONICAL",
    );
    expectRejected(
      {
        approvalText: canonical.replace(
          '      "sha256":',
          '      "sha256": "misleading",\n      "sha256":',
        ),
      },
      "MANIFEST_NOT_CANONICAL",
    );
  });
  it("accepts a NUL regular-file type", () => {
    expect(
      run({
        archive: gzipSync(tar(base.map((entry) => ({ ...entry, type: "\0" })))),
      }).status,
    ).toBe(0);
  });
  it("rejects concatenated gzip members containing a second tar archive", () => {
    expectRejected(
      { archive: Buffer.concat([gzipSync(tar()), gzipSync(tar())]) },
      "TAR_TRAILING_DATA",
    );
  });
  it("ignores ordering and compression metadata, not content", () => {
    expect(
      run({
        archive: gzipSync(tar([...base].reverse()), { level: 1 }),
        approved: {
          ...manifest(),
          commit: "different",
          archive: "other.tgz",
          integrity: "different",
        },
      }).status,
    ).toBe(0);
  });
  it("supports the ustar prefix field", () => {
    expect(
      run({
        archive: gzipSync(
          tar(
            base.map((entry) =>
              entry.name === "package/dist/index.js"
                ? { ...entry, name: "index.js", prefix: "package/dist" }
                : entry,
            ),
          ),
        ),
      }).status,
    ).toBe(0);
  });
  it.each([[], [filename, "extra"], ["--write"]])(
    "rejects unsupported argv %j",
    (...args) => {
      expectRejected({ args }, "USAGE");
    },
  );
  it("fails closed without an independently supplied approval", () => {
    expectRejected({ approved: null }, "MANIFEST_MISSING");
  });
  it("rejects a directory instead of a manifest", () => {
    expectRejected({ manifestDirectory: true }, "MANIFEST_NOT_REGULAR");
  });
  it("rejects wrong tarball names and checkout identity", () => {
    expectRejected({ tarballName: "other.tgz" }, "TARBALL_NAME");
    expectRejected(
      { checkout: { name: "other", version } },
      "CHECKOUT_PACKAGE_NAME",
    );
    expectRejected(
      { checkout: { name, version: "1.2.3/../x" } },
      "CHECKOUT_PACKAGE_VERSION",
    );
    expectRejected(
      {
        checkout: { name, version: "9.9.9" },
        tarballName: "tormentalabs-claude-code-wire-compat-9.9.9.tgz",
      },
      "MANIFEST_MISSING",
    );
  });
  it("rejects malformed JSON and schema", () => {
    expectRejected({ approvalText: "{" }, "MANIFEST_JSON");
    expectRejected({ approved: { ...manifest(), extra: 1 } }, "MANIFEST_KEYS");
    expectRejected(
      { approved: { ...manifest(), commit: 1 } },
      "MANIFEST_METADATA",
    );
    expectRejected(
      { approved: { ...manifest(), files: [] } },
      "MANIFEST_FILES",
    );
  });
  it.each(["../x", "/x", "a\\b", "a//b", "./x", "C:x", "x*", "x\u0001"])(
    "rejects unsafe manifest path %j",
    (file) => {
      expectRejected(
        {
          approved: {
            ...manifest(),
            files: [{ path: file, size: 0, sha256: hash(Buffer.alloc(0)) }],
          },
        },
        "MANIFEST_PATH",
      );
    },
  );
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, 16 * 1024 * 1024 + 1])(
    "rejects invalid sizes %s",
    (size) => {
      expectRejected(
        {
          approved: {
            ...manifest(),
            files: [{ path: "package.json", size, sha256: hash(identity) }],
          },
        },
        "MANIFEST_SIZE",
      );
    },
  );
  it("rejects noncanonical hashes, negative zero, unknown fields and duplicates", () => {
    const entry = {
      path: "package.json",
      size: identity.length,
      sha256: hash(identity),
    };
    expectRejected(
      {
        approved: {
          ...manifest(),
          files: [{ ...entry, sha256: "A".repeat(64) }],
        },
      },
      "MANIFEST_SHA256",
    );
    expectRejected(
      {
        approvalText: JSON.stringify({ ...manifest(), files: [entry] }).replace(
          `"size":${String(identity.length)}`,
          '"size":-0',
        ),
      },
      "MANIFEST_SIZE",
    );
    expectRejected(
      { approved: { ...manifest(), files: [{ ...entry, extra: 1 }] } },
      "MANIFEST_ENTRY_KEYS",
    );
    expectRejected(
      { approved: { ...manifest(), files: [entry, entry] } },
      "MANIFEST_DUPLICATE",
    );
    expectRejected(
      {
        approved: {
          ...manifest(),
          files: [entry, { ...entry, path: "PACKAGE.JSON" }],
        },
      },
      "MANIFEST_DUPLICATE",
    );
    expectRejected(
      { approved: manifest(base.slice(1)) },
      "MANIFEST_NO_PACKAGE_JSON",
    );
  });
  it("detects modified, extra and missing files", () => {
    expectRejected(
      {
        archive: gzipSync(
          tar(
            base.map((entry) =>
              entry.name.endsWith("index.js")
                ? { ...entry, body: Buffer.from("export const value = 2;\n") }
                : entry,
            ),
          ),
        ),
      },
      "FILE_SHA256",
    );
    expectRejected(
      {
        archive: gzipSync(
          tar(
            base.map((entry) =>
              entry.name.endsWith("index.js")
                ? { ...entry, body: Buffer.from("different length") }
                : entry,
            ),
          ),
        ),
      },
      "FILE_SIZE",
    );
    expectRejected(
      {
        archive: gzipSync(
          tar([...base, { name: "package/extra", body: Buffer.alloc(0) }]),
        ),
      },
      "FILE_UNEXPECTED",
    );
    expectRejected(
      { archive: gzipSync(tar(base.slice(0, 2))) },
      "FILE_MISSING",
    );
  });
  it("checks the approved package identity too", () => {
    for (const [pkgName, pkgVersion, code] of [
      ["other", version, "ARCHIVE_PACKAGE_NAME"],
      [name, "9.9.9", "ARCHIVE_PACKAGE_VERSION"],
    ]) {
      const entries = [
        {
          name: "package/package.json",
          body: Buffer.from(
            JSON.stringify({ name: pkgName, version: pkgVersion }),
          ),
        },
      ];
      expectRejected(
        { archive: gzipSync(tar(entries)), approved: manifest(entries) },
        code ?? "missing-case",
      );
    }
  });
  it.each(["1", "2", "3", "4", "5", "6", "x", "g", "L"])(
    "rejects nonregular tar entry type %s",
    (type) => {
      expectRejected(
        {
          archive: gzipSync(
            tar([
              ...base,
              { name: "package/link", body: Buffer.alloc(0), type },
            ]),
          ),
        },
        "TAR_UNSUPPORTED_TYPE",
      );
    },
  );
  it.each([
    "package/../x",
    "package/",
    "package/a//b",
    "package/x*",
    "package/a\\b",
  ])("rejects unsafe archived path %j", (file) => {
    expectRejected(
      { archive: gzipSync(tar([{ name: file, body: identity }])) },
      "TAR_BAD_PATH",
    );
  });
  it("rejects paths outside package and duplicate archived names", () => {
    expectRejected(
      {
        archive: gzipSync(
          tar([{ name: "/package/package.json", body: identity }]),
        ),
      },
      "TAR_OUTSIDE_PACKAGE",
    );
    expectRejected(
      {
        archive: gzipSync(
          tar([...base, { name: "package/PACKAGE.JSON", body: identity }]),
        ),
      },
      "TAR_DUPLICATE",
    );
  });
  it("rejects corrupt checksums, unsupported magic and base256 sizes", () => {
    const damaged = tar();
    damaged[0] = 0;
    expectRejected({ archive: gzipSync(damaged) }, "TAR_CHECKSUM");
    const magic = tar();
    magic[257] = 0;
    expectRejected({ archive: gzipSync(magic) }, "TAR_NOT_USTAR");
    const binary = tar();
    binary[124] = 128;
    checksum(binary.subarray(0, 512));
    expectRejected({ archive: gzipSync(binary) }, "TAR_BASE256_UNSUPPORTED");
  });
  it("rejects truncation, nonzero padding and trailing archives", () => {
    expectRejected(
      { archive: gzipSync(tar().subarray(0, 520)) },
      "TAR_TRUNCATED_PAYLOAD",
    );
    expectRejected(
      { archive: gzipSync(tar(base, Buffer.alloc(100))) },
      "TAR_TRUNCATED_HEADER",
    );
    expectRejected(
      { archive: gzipSync(tar(base, Buffer.alloc(512))) },
      "TAR_TRUNCATED_END",
    );
    expectRejected(
      { archive: gzipSync(Buffer.concat([tar(), tar()])) },
      "TAR_TRAILING_DATA",
    );
    const padding = tar();
    padding[512 + identity.length] = 1;
    expectRejected({ archive: gzipSync(padding) }, "TAR_BAD_PADDING");
  });
  it("rejects corrupt gzip and bounds decompression", () => {
    expectRejected({ archive: tar() }, "ARCHIVE_NOT_GZIP");
    expectRejected(
      { archive: Buffer.from([31, 139, 0]) },
      "ARCHIVE_GZIP_INVALID_OR_TOO_LARGE",
    );
    expectRejected(
      { archive: gzipSync(Buffer.alloc(65 * 1024 * 1024)) },
      "ARCHIVE_GZIP_INVALID_OR_TOO_LARGE",
    );
  });
});
