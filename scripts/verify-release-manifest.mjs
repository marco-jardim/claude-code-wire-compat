// SPDX-License-Identifier: GPL-3.0-or-later

// Read-only: compare one packed artefact with a reviewed, committed manifest.
import { createHash } from "node:crypto";
import { closeSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const PACKAGE_NAME = "@tormentalabs/claude-code-wire-compat";
const MIB = 1024 * 1024;
const MAX_ENTRIES = 10_000;
const MAX_FILE = 16 * MIB;
const BLOCK = 512;

class VerifyError extends Error {
  constructor(code, subject) {
    super(code);
    this.code = code;
    this.subject = subject;
  }
}

function fail(code, subject) {
  throw new VerifyError(code, subject);
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length && actual.every((key, i) => key === keys[i])
  );
}

function safePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    value
      .split("/")
      .every(
        (part) =>
          /^[A-Za-z0-9._@+-]+$/u.test(part) && part !== "." && part !== "..",
      )
  );
}

function readBounded(file, max, code) {
  let stat;
  try {
    stat = lstatSync(file);
  } catch {
    fail(`${code}_MISSING`);
  }
  if (!stat.isFile()) fail(`${code}_NOT_REGULAR`);
  if (stat.size > max) fail(`${code}_TOO_LARGE`);
  const fd = openSync(file, "r");
  try {
    const opened = fstatSync(fd);
    if (
      !opened.isFile() ||
      opened.size !== stat.size ||
      opened.ino !== stat.ino ||
      opened.dev !== stat.dev
    )
      fail(`${code}_CHANGED`);
    const buffer = Buffer.alloc(stat.size + 1);
    let total = 0;
    for (;;) {
      const count = readSync(fd, buffer, total, buffer.length - total, null);
      if (count === 0) break;
      total += count;
      if (total > stat.size) fail(`${code}_CHANGED`);
    }
    if (total !== stat.size || fstatSync(fd).size !== stat.size)
      fail(`${code}_CHANGED`);
    return buffer.subarray(0, total);
  } finally {
    closeSync(fd);
  }
}

function json(bytes, code) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(code);
  }
}

function identity(pkg, code) {
  if (!record(pkg)) fail(code);
  if (pkg.name !== PACKAGE_NAME) fail(`${code}_NAME`);
  if (
    typeof pkg.version !== "string" ||
    pkg.version.length > 64 ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(pkg.version)
  )
    fail(`${code}_VERSION`);
  return pkg.version;
}

function validateManifest(manifest) {
  if (
    !record(manifest) ||
    !exactKeys(manifest, ["archive", "commit", "files", "integrity"])
  )
    fail("MANIFEST_KEYS");
  for (const key of ["archive", "commit", "integrity"]) {
    if (typeof manifest[key] !== "string" || manifest[key].length > 512)
      fail("MANIFEST_METADATA");
  }
  if (
    !Array.isArray(manifest.files) ||
    manifest.files.length === 0 ||
    manifest.files.length > MAX_ENTRIES
  )
    fail("MANIFEST_FILES");
  const files = new Map();
  const folded = new Set();
  for (const file of manifest.files) {
    if (!record(file) || !exactKeys(file, ["path", "sha256", "size"]))
      fail("MANIFEST_ENTRY_KEYS");
    if (!safePath(file.path)) fail("MANIFEST_PATH");
    if (
      !Number.isSafeInteger(file.size) ||
      Object.is(file.size, -0) ||
      file.size < 0 ||
      file.size > MAX_FILE
    )
      fail("MANIFEST_SIZE", file.path);
    if (typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(file.sha256))
      fail("MANIFEST_SHA256", file.path);
    const lower = file.path.toLowerCase();
    if (folded.has(lower)) fail("MANIFEST_DUPLICATE", file.path);
    folded.add(lower);
    files.set(file.path, file);
  }
  if (!files.has("package.json")) fail("MANIFEST_NO_PACKAGE_JSON");
  return files;
}

function allZero(bytes) {
  return bytes.every((byte) => byte === 0);
}

function tarString(header, offset, length) {
  const field = header.subarray(offset, offset + length);
  const nul = field.indexOf(0);
  const end = nul < 0 ? length : nul;
  if (
    !allZero(field.subarray(end)) ||
    field.subarray(0, end).some((byte) => byte < 32 || byte > 126)
  )
    fail("TAR_BAD_NAME");
  return field.toString("latin1", 0, end);
}

function octal(header, offset, length) {
  const field = header.subarray(offset, offset + length);
  if ((field[0] & 128) !== 0) fail("TAR_BASE256_UNSUPPORTED");
  let end = field.length;
  while (end > 0 && (field[end - 1] === 0 || field[end - 1] === 32)) end--;
  const text = field.toString("latin1", 0, end);
  if (!/^[0-7]{1,12}$/u.test(text)) fail("TAR_BAD_NUMBER");
  return Number.parseInt(text, 8);
}

function unpack(compressed) {
  if (compressed[0] !== 31 || compressed[1] !== 139) fail("ARCHIVE_NOT_GZIP");
  let tar;
  try {
    tar = gunzipSync(compressed, { maxOutputLength: 64 * MIB });
  } catch {
    fail("ARCHIVE_GZIP_INVALID_OR_TOO_LARGE");
  }
  const files = new Map();
  const folded = new Set();
  let offset = 0;
  for (;;) {
    if (offset + BLOCK > tar.length) fail("TAR_TRUNCATED_HEADER");
    const header = tar.subarray(offset, offset + BLOCK);
    if (allZero(header)) break;
    if (header.toString("latin1", 257, 265) !== "ustar\u000000")
      fail("TAR_NOT_USTAR");
    const checksum = octal(header, 148, 8);
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
    if (checksum !== sum) fail("TAR_CHECKSUM");
    if (header[156] !== 0 && header[156] !== 48) fail("TAR_UNSUPPORTED_TYPE");
    const name = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const full = prefix ? `${prefix}/${name}` : name;
    if (!full.startsWith("package/")) fail("TAR_OUTSIDE_PACKAGE");
    const file = full.slice(8);
    if (!safePath(file)) fail("TAR_BAD_PATH");
    const size = octal(header, 124, 12);
    if (size > MAX_FILE) fail("TAR_FILE_TOO_LARGE", file);
    if (files.size >= MAX_ENTRIES) fail("TAR_TOO_MANY_FILES");
    const start = offset + BLOCK;
    const end = start + Math.ceil(size / BLOCK) * BLOCK;
    if (end > tar.length) fail("TAR_TRUNCATED_PAYLOAD", file);
    if (!allZero(tar.subarray(start + size, end)))
      fail("TAR_BAD_PADDING", file);
    if (folded.has(file.toLowerCase())) fail("TAR_DUPLICATE", file);
    folded.add(file.toLowerCase());
    files.set(file, tar.subarray(start, start + size));
    offset = end;
  }
  if (offset + 2 * BLOCK > tar.length) fail("TAR_TRUNCATED_END");
  if (!allZero(tar.subarray(offset))) fail("TAR_TRAILING_DATA");
  return files;
}

function verify(args) {
  if (args.length !== 1 || args[0].startsWith("-")) fail("USAGE");
  const version = identity(
    json(readBounded("package.json", MIB, "CHECKOUT_PACKAGE"), "CHECKOUT_JSON"),
    "CHECKOUT_PACKAGE",
  );
  if (
    path.basename(args[0]) !==
    `tormentalabs-claude-code-wire-compat-${version}.tgz`
  )
    fail("TARBALL_NAME");
  const manifestBytes = readBounded(
    path.join("release-manifests", `${version}.json`),
    2 * MIB,
    "MANIFEST",
  );
  const parsedManifest = json(manifestBytes, "MANIFEST_JSON");
  const manifest = validateManifest(parsedManifest);
  // Canonical JSON prevents duplicate keys from hiding a different approval.
  if (
    !manifestBytes.equals(
      Buffer.from(`${JSON.stringify(parsedManifest, null, 2)}\n`),
    )
  )
    fail("MANIFEST_NOT_CANONICAL");
  const compressed = readBounded(args[0], 16 * MIB, "TARBALL");
  const actual = unpack(compressed);
  for (const file of manifest.keys())
    if (!actual.has(file)) fail("FILE_MISSING", file);
  for (const [file, bytes] of actual) {
    const expected = manifest.get(file);
    if (!expected) fail("FILE_UNEXPECTED", file);
    if (bytes.length !== expected.size) fail("FILE_SIZE", file);
    if (createHash("sha256").update(bytes).digest("hex") !== expected.sha256)
      fail("FILE_SHA256", file);
  }
  const packedVersion = identity(
    json(actual.get("package.json"), "ARCHIVE_PACKAGE_JSON"),
    "ARCHIVE_PACKAGE",
  );
  if (packedVersion !== version) fail("ARCHIVE_PACKAGE_VERSION");
  const integrity = `sha512-${createHash("sha512").update(compressed).digest("base64")}`;
  process.stdout.write(
    `release-manifest: OK ${version} files=${actual.size} archive=${integrity}\n`,
  );
}

try {
  verify(process.argv.slice(2));
} catch (error) {
  const code = error instanceof VerifyError ? error.code : "INTERNAL";
  const subject =
    error instanceof VerifyError && safePath(error.subject)
      ? ` ${error.subject}`
      : "";
  process.stderr.write(`release-manifest: FAIL ${code}${subject}\n`);
  process.exitCode = 1;
}
