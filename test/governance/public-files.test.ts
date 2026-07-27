// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const file = (name: string): string => readFileSync(join(root, name), "utf8");

describe("public governance files", () => {
  it("preserves the complete GPL license text", () => {
    const license = file("LICENSE");
    expect(Buffer.byteLength(license)).toBe(35_149);
    expect(license).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(license).toContain("Version 3, 29 June 2007");
    expect(license).toContain("END OF TERMS AND CONDITIONS");
  });

  it("records upstream attribution and modified-work provenance", () => {
    const notice = file("NOTICE");
    expect(notice).toContain("GPL-3.0-or-later");
    expect(notice).toContain("opencode-anthropic-fix");
    expect(notice).toContain("466d500");
    expect(notice.toLowerCase()).toContain("modified work");
    expect(notice).toContain(
      "https://github.com/marco-jardim/claude-code-wire-compat",
    );
  });

  it.each([
    "README.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
    "NOTICE",
  ])("requires %s to be substantive", (name) => {
    expect(file(name).trim().length).toBeGreaterThan(100);
  });

  it("documents private disclosure and contribution licensing", () => {
    expect(file("SECURITY.md")).toContain("private security advisory");
    expect(file("CONTRIBUTING.md")).toContain(
      "Developer Certificate of Origin",
    );
    expect(file("CONTRIBUTING.md")).toContain("GPL-3.0-or-later");
  });

  it("carries an SPDX identifier on every first-party source file", () => {
    const files = [
      "src/index.ts",
      "eslint.config.js",
      "vitest.config.ts",
      ".github/workflows/ci.yml",
      ".github/workflows/publish.yml",
    ];
    for (const name of files) {
      expect(file(name)).toContain("SPDX-License-Identifier: GPL-3.0-or-later");
    }
  });
});
