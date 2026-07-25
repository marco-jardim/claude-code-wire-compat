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

function policyErrors(value: PackageManifest): readonly string[] {
  const errors: string[] = [];
  if (value.name !== "@tormentalabs/claude-code-wire-compat")
    errors.push("package name");
  if (value.version !== "0.1.0-rc.1") errors.push("release candidate version");
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
    expect(source).not.toMatch(
      /(?:node:|from\s+['"](?:fs|path|buffer|crypto|process)['"]|\bBuffer\b|\bprocess\b)/u,
    );
    expect(source.toLowerCase()).not.toContain("xxhash");
  });
});
