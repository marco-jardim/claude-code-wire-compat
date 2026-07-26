// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ANTI_VERBOSITY_DIGESTS,
  COMMUNICATING_WITH_THE_USER_CONDENSED,
  COMMUNICATING_WITH_THE_USER_FULL,
  LEAN_SECTION,
  TEXT_OUTPUT_SECTION,
} from "../../src/anti-verbosity.js";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("anti-verbosity prompt text", () => {
  it.each([
    [
      "communicating-with-the-user full",
      COMMUNICATING_WITH_THE_USER_FULL,
      ANTI_VERBOSITY_DIGESTS.communicatingWithTheUserFull,
    ],
    [
      "communicating-with-the-user condensed",
      COMMUNICATING_WITH_THE_USER_CONDENSED,
      ANTI_VERBOSITY_DIGESTS.communicatingWithTheUserCondensed,
    ],
    ["lean", LEAN_SECTION, ANTI_VERBOSITY_DIGESTS.lean],
    ["text-output", TEXT_OUTPUT_SECTION, ANTI_VERBOSITY_DIGESTS.textOutput],
  ])("pins the %s digest", (_name, text, digest) => {
    expect(sha256(text)).toBe(digest);
  });

  it("preserves the byte-exact section shapes", () => {
    expect(
      TEXT_OUTPUT_SECTION.startsWith(
        "# Text output (does not apply to tool calls)\n",
      ),
    ).toBe(true);
    expect(TEXT_OUTPUT_SECTION.charAt(44)).toBe("\n");
    expect(
      TEXT_OUTPUT_SECTION.includes("(does not apply to tool calls) Assume"),
    ).toBe(false);
    expect(
      COMMUNICATING_WITH_THE_USER_FULL.startsWith(
        "# Communicating with the user\n\n",
      ),
    ).toBe(true);
    expect(LEAN_SECTION).not.toContain("\n");
    expect(COMMUNICATING_WITH_THE_USER_FULL.length).toBeGreaterThan(
      COMMUNICATING_WITH_THE_USER_CONDENSED.length,
    );

    for (const text of [
      COMMUNICATING_WITH_THE_USER_FULL,
      COMMUNICATING_WITH_THE_USER_CONDENSED,
      TEXT_OUTPUT_SECTION,
    ]) {
      expect(text).toContain("\u2014");
    }
    expect(LEAN_SECTION).not.toContain("\u2014");
  });
});
