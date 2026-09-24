// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * AGENTS.md is the file a porter copies from: it restates the frozen
 * packed-consumer digests and the fingerprint known-answer vectors so that a
 * maintainer does not have to dig them out of scripts and tests. Those
 * literals are hand-maintained copies, and nothing else cross-checks them, so
 * a single transposed character would ship silently and then be copied into
 * the next port.
 *
 * This test is what stops that. Every expected value is derived from the
 * authoritative file at run time — the `EXPECTED_DIGESTS` table in
 * `scripts/verify-packed-consumers.mjs` and the `it.each` table in
 * `test/fingerprint-2.1.280.test.ts` — and AGENTS.md must contain each one.
 * No literal is hardcoded here, and each extraction asserts a non-zero count
 * so the test cannot pass vacuously if a regex stops matching.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
const packedConsumers = readFileSync(
  join(root, "scripts", "verify-packed-consumers.mjs"),
  "utf8",
);
const fingerprint280 = readFileSync(
  join(root, "test", "fingerprint-2.1.280.test.ts"),
  "utf8",
);

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  if (from === -1) return "";
  const to = source.indexOf(end, from + start.length);
  return to === -1 ? "" : source.slice(from + start.length, to);
}

const digestBlock = sliceBetween(
  packedConsumers,
  "const EXPECTED_DIGESTS = {",
  "};",
);
const digests = [
  ...digestBlock.matchAll(/"(\d+\.\d+\.\d+)":\s*"([0-9a-f]{64})"/g),
].flatMap(([, version, digest]) =>
  version === undefined || digest === undefined ? [] : [{ version, digest }],
);

const vectorBlock = sliceBetween(fingerprint280, "it.each([", "])(");
const vectors = [
  ...vectorBlock.matchAll(/\[\s*"(?:[^"\\]|\\.)*"\s*,\s*"([0-9a-f]{3})"\s*\]/g),
].flatMap(([, hex]) => (hex === undefined ? [] : [hex]));

describe("AGENTS.md hand-copied literals", () => {
  it("extracts exactly three frozen digests from EXPECTED_DIGESTS", () => {
    expect(digests).toHaveLength(3);
  });

  it("restates every frozen packed-consumer digest against its version", () => {
    const missing = digests
      .filter(
        ({ version, digest }) => !agents.includes(`${version} = \`${digest}\``),
      )
      .map(({ version, digest }) => `${version} = ${digest}`);

    expect({ missingFromAgentsMd: missing }).toEqual({
      missingFromAgentsMd: [],
    });
  });

  it("extracts a non-empty 2.1.280 fingerprint vector table", () => {
    expect(vectors.length).toBeGreaterThan(0);
  });

  it("restates every 2.1.280 fingerprint vector", () => {
    const missing = vectors.filter((hex) => !agents.includes(`\`${hex}\``));

    expect({ missingFromAgentsMd: missing }).toEqual({
      missingFromAgentsMd: [],
    });
  });
});
