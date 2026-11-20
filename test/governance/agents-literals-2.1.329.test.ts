// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * The 2.1.329 half of the AGENTS.md hand-copied-literal check; see
 * `agents-literals.test.ts` for the rationale and the digest and 2.1.280
 * halves. Every expected value is derived at run time from the `it.each`
 * table in `test/fingerprint-2.1.329.test.ts`, no literal is hardcoded here,
 * and the extraction asserts the exact row count so the test cannot pass
 * vacuously if the regex stops matching.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
const fingerprint329 = readFileSync(
  join(root, "test", "fingerprint-2.1.329.test.ts"),
  "utf8",
);

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  if (from === -1) return "";
  const to = source.indexOf(end, from + start.length);
  return to === -1 ? "" : source.slice(from + start.length, to);
}

const vectorBlock = sliceBetween(fingerprint329, "it.each([", "])(");
const vectors = [
  ...vectorBlock.matchAll(/\[\s*"(?:[^"\\]|\\.)*"\s*,\s*"([0-9a-f]{3})"\s*\]/g),
].flatMap(([, hex]) => (hex === undefined ? [] : [hex]));

describe("AGENTS.md 2.1.329 fingerprint literals", () => {
  it("extracts the seven table rows of the 2.1.329 fingerprint vectors", () => {
    expect(vectors).toHaveLength(7);
  });

  it("restates every 2.1.329 fingerprint vector", () => {
    const missing = vectors.filter((hex) => !agents.includes(`\`${hex}\``));

    expect({ missingFromAgentsMd: missing }).toEqual({
      missingFromAgentsMd: [],
    });
  });

  it("restates the vector that is outside the table", () => {
    // The non-BMP probe lives in its own test, not in the table, so it is
    // checked against the test source and AGENTS.md separately.
    const outsideTable = [
      ...fingerprint329.matchAll(
        /createBillingFingerprint\("\\u\{1F642\}wire compat probe", CLI_VERSION\),\s*\)\.resolves\.toBe\("([0-9a-f]{3})"\)/g,
      ),
    ].flatMap(([, hex]) => (hex === undefined ? [] : [hex]));

    expect(outsideTable).toHaveLength(1);
    expect(agents).toContain(`\`${outsideTable[0] ?? ""}\``);
  });
});
