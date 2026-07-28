// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const docsDirectory = join(root, "docs");
const protocolDirectory = join(docsDirectory, "protocol");

const toPosix = (value: string): string => value.split(sep).join(posix.sep);

const markdownFiles = (): string[] => [
  "README.md",
  ...readdirSync(docsDirectory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => toPosix(relative(root, join(entry.parentPath, entry.name))))
    .sort(),
];

const INLINE_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;

const isExternal = (target: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/iu.test(target) ||
  target.startsWith("//") ||
  target.startsWith("#");

const relativeLinks = (file: string): string[] => {
  const contents = readFileSync(join(root, file), "utf8");

  return [...contents.matchAll(INLINE_LINK)]
    .map((match) => match[1])
    .filter((target) => !isExternal(target))
    .map((target) => target.split("#")[0])
    .filter((target) => target !== "");
};

const brokenLinks = (file: string): string[] =>
  relativeLinks(file).filter(
    (target) =>
      !existsSync(resolve(root, dirname(file), decodeURIComponent(target))),
  );

const files = markdownFiles();

describe("relative Markdown links", () => {
  it("finds Markdown to check", () => {
    expect(files).toContain("README.md");
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files)("resolves every relative link in %s", (file) => {
    expect(brokenLinks(file)).toEqual([]);
  });
});

describe("README protocol documentation section", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");

  it("publishes a protocol documentation section", () => {
    expect(readme).toContain("## Protocol documentation");
  });

  it.each(
    readdirSync(protocolDirectory, { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) =>
        toPosix(relative(root, join(entry.parentPath, entry.name))),
      )
      .sort(),
  )("links %s", (file) => {
    expect(readme).toContain(`(./${file})`);
  });
});
