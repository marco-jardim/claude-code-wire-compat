// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly license?: unknown;
  readonly type?: unknown;
  readonly private?: unknown;
  readonly engines?: { readonly node?: unknown };
  readonly files?: readonly unknown[];
  readonly exports?: unknown;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly publishConfig?: { readonly access?: unknown };
}

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
) as PackageManifest;

const NODE_BUILTINS =
  "assert|async_hooks|buffer|child_process|cluster|console|constants|crypto|dgram|diagnostics_channel|dns|domain|events|fs|http|http2|https|inspector|module|net|os|path|perf_hooks|process|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|trace_events|tty|url|util|v8|vm|wasi|worker_threads|zlib";

export function runtimeNeutralityErrors(source: string): readonly string[] {
  const errors: string[] = [];
  const specifier = String.raw`['"](?:node:[^'"]+|(?:${NODE_BUILTINS})(?:/[^'"]*)?)['"]`;
  if (new RegExp(String.raw`\bfrom\s*${specifier}`, "u").test(source))
    errors.push("node builtin import");
  if (
    new RegExp(String.raw`\b(?:import|require)\s*\(\s*${specifier}`, "u").test(
      source,
    )
  )
    errors.push("node builtin import");
  if (new RegExp(String.raw`\bimport\s+${specifier}`, "u").test(source))
    errors.push("node builtin import");
  // Member access is matched without tolerating whitespace around the dot.
  // `src/anti-verbosity.ts` carries verbatim prompt prose from the pinned
  // client, and that prose ends a sentence with "your thought process. State
  // results directly", which a `\s*\.\s*` form flagged as a global read.
  if (/\bprocess\.[A-Za-z_$]|\bprocess\[/u.test(source))
    errors.push("process global");
  if (/\bBuffer\.[A-Za-z_$]|\bBuffer\[|\bBuffer\(/u.test(source))
    errors.push("Buffer global");
  if (/\b__(?:dirname|filename)\b/u.test(source))
    errors.push("commonjs global");
  if (source.toLowerCase().includes("xxhash")) errors.push("xxhash reference");
  return errors;
}

function policyErrors(value: PackageManifest): readonly string[] {
  const errors: string[] = [];
  if (value.name !== "@tormentalabs/claude-code-wire-compat")
    errors.push("package name");
  if (value.version !== "0.1.0-rc.16") errors.push("release candidate version");
  if (value.license !== "GPL-3.0-or-later") errors.push("GPL license");
  if (value.type !== "module") errors.push("ESM type");
  if (value.private === true) errors.push("public package");
  if (value.engines?.node !== ">=20") errors.push("Node engine");
  if (value.publishConfig?.access !== "public")
    errors.push("public publish access");
  if (
    JSON.stringify(value.files) !==
    JSON.stringify(["dist", "README.md", "LICENSE", "NOTICE", "CHANGELOG.md"])
  )
    errors.push("published files");
  if (
    JSON.stringify(value.exports) !==
    JSON.stringify({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      "./profiles/claude-code-2.1.195": {
        types: "./dist/profiles/claude-code-2.1.195.d.ts",
        import: "./dist/profiles/claude-code-2.1.195.js",
      },
    })
  )
    errors.push("explicit exports");
  if (
    value.dependencies !== undefined &&
    Object.keys(value.dependencies).length > 0
  )
    errors.push("runtime dependency");
  for (const version of Object.values(value.devDependencies ?? {})) {
    if (
      version.startsWith("^") ||
      version.startsWith("~") ||
      version === "*" ||
      version === "latest"
    )
      errors.push("unpinned dev dependency");
  }
  return errors;
}

function sourceFiles(directory: string): readonly string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("package policy", () => {
  it("enforces package identity and publishing boundaries", () => {
    expect(policyErrors(manifest)).toEqual([]);
  });

  it.each([
    [{ ...manifest, name: "wrong" }, "package name"],
    [{ ...manifest, private: true }, "public package"],
    [{ ...manifest, license: "MIT" }, "GPL license"],
    [{ ...manifest, exports: { "./*": "./dist/*.js" } }, "explicit exports"],
    [{ ...manifest, dependencies: { runtime: "1.0.0" } }, "runtime dependency"],
    [
      { ...manifest, devDependencies: { tooling: "^1.0.0" } },
      "unpinned dev dependency",
    ],
  ] as const)(
    "rejects an invalid manifest variant",
    (candidate, expectedError) => {
      expect(policyErrors(candidate)).toContain(expectedError);
    },
  );

  it("keeps source runtime-neutral and free of obsolete hashing claims", () => {
    const source = sourceFiles(join(root, "src"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(runtimeNeutralityErrors(source)).toEqual([]);
  });

  it.each([
    ['import { readFileSync } from "node:fs";', "node builtin import"],
    ['import { join } from "path";', "node builtin import"],
    ['const os = require("os");', "node builtin import"],
    ['import "node:crypto";', "node builtin import"],
    ["const home = process.env.HOME;", "process global"],
    ['const p = process["env"];', "process global"],
    ['const b = Buffer.from("x");', "Buffer global"],
    ["const b = Buffer(8);", "Buffer global"],
    ["const here = __dirname;", "commonjs global"],
    ["// hash via xxhash64", "xxhash reference"],
  ] as const)("detects runtime-specific source", (source, expectedError) => {
    expect(runtimeNeutralityErrors(source)).toContain(expectedError);
  });

  it.each([
    "// we process the blocks in canonical order",
    "// a running commentary on your thought process. State results directly.",
    "// they didn't watch your process unfold. Before your first tool call...",
    "/** Buffered output is not used here. */",
    'const digest = await subtle.digest("SHA-256", bytes);',
    "export interface ProcessingResult { readonly ok: boolean }",
    "// see the node: protocol docs for background",
  ])("allows runtime-neutral source", (source) => {
    expect(runtimeNeutralityErrors(source)).toEqual([]);
  });

  it("declares the ESM-only profile so the pack gate can exit zero", () => {
    const scripts = (manifest as { readonly scripts?: Record<string, string> })
      .scripts;
    expect(scripts?.["pack:check"]).toContain("--profile esm-only");
  });
});
