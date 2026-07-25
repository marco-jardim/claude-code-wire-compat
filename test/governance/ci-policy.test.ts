import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ci = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
const publish = readFileSync(
  join(root, ".github", "workflows", "publish.yml"),
  "utf8",
);

describe("CI policy", () => {
  it.each(["node-20:", "node-22:", "node-24:", "bun:", "workerd:", "quality:"])(
    "defines required job %s",
    (job) => {
      expect(ci).toContain(job);
    },
  );

  it.each([
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run test:coverage",
    "npm run build",
    "npm run pack:check",
    "license-checker-rseidelsohn",
    "gitleaks",
    "Mutation",
    "npm run drift:check",
  ])("contains quality gate %s", (gate) => {
    expect(ci).toContain(gate);
  });

  it("does not consume repository secrets for pull requests", () => {
    expect(ci).toContain("pull_request:");
    expect(ci).not.toContain("secrets.");
  });

  it("restricts publication to provenance-enabled automation", () => {
    expect(publish).toContain("workflow_dispatch:");
    expect(publish).toContain("release:");
    expect(publish).toContain("id-token: write");
    expect(publish).toContain("contents: read");
    expect(publish).toContain("NPM_CONFIG_PROVENANCE: true");
    expect(publish).toContain("npm publish --access public");
    expect(publish).toContain("--tag beta");
    expect(publish).toContain("--tag latest");
  });
});
