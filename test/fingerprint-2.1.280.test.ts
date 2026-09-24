// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Known-answer vectors for the 2.1.280 billing fingerprint, and byte-exact
 * pins for the block that carries it.
 *
 * The fingerprints below were computed by a standalone script that lives
 * outside this repository and imports nothing from this package, only the
 * platform crypto module. Before any value here was trusted, that script was
 * calibrated by reproducing the known-answer vectors of both older profiles
 * (`fingerprint.test.ts` for 2.1.195 and `fingerprint-2.1.233.test.ts` for
 * 2.1.233). Those previous profiles' vectors use the same probe phrases, and
 * the sets must differ: the CLI version string is part of the hashed
 * material.
 *
 * The generator is reproduced below so the provenance claim can be re-checked
 * without the original file, which lived in a temporary directory. Apart from
 * the loop that printed its results, this is the whole of what was run, and
 * it imports nothing from this package:
 *
 * ```js
 * import { createHash } from "node:crypto";
 *
 * const SALT = "59cf53e54c78";
 *
 * function fingerprint(text, version) {
 *   const material =
 *     SALT + (text[4] || "0") + (text[7] || "0") + (text[20] || "0") + version;
 *   return createHash("sha256").update(material, "utf8").digest("hex").slice(0, 3);
 * }
 * ```
 *
 * Run against the probe phrases of the two older pinned releases, it
 * reproduced every one of their recorded answers before any new value here
 * was trusted.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeProtocolProfile, TextBlock } from "../src/contracts.js";
import { CLAUDE_CODE_2_1_280_PROFILE } from "../src/profiles/claude-code-2.1.280.js";
import { loadWave2Function } from "./support/wave2-modules.js";

type CreateBillingFingerprint = (
  firstUserText: string,
  cliVersion: string,
  crypto?: Pick<Crypto, "subtle">,
) => Promise<string>;
type CreateBillingBlock = (
  firstUserText: string,
  profile: ClaudeCodeProtocolProfile,
  crypto?: Pick<Crypto, "subtle">,
  chain?: { previousRequestId?: string; promptId?: string },
) => Promise<TextBlock>;

const CLI_VERSION = "2.1.280";

function loadFingerprint(): Promise<CreateBillingFingerprint> {
  return loadWave2Function<CreateBillingFingerprint>(
    "fingerprint",
    "createBillingFingerprint",
  );
}

function loadBlock(): Promise<CreateBillingBlock> {
  return loadWave2Function<CreateBillingBlock>(
    "fingerprint",
    "createBillingBlock",
  );
}

describe("2.1.280 billing fingerprint", () => {
  it("pins the profile's CLI version", () => {
    expect(CLAUDE_CODE_2_1_280_PROFILE.cliVersion).toBe(CLI_VERSION);
  });

  // The "hi" and "" rows deliberately share an expected value. Both inputs
  // are too short to reach any of the sampled indices, so every lookup falls
  // back to the literal "0" and the hashed material is byte-identical for
  // them. This is a property of the transcribed formula, not a copy-paste
  // error in the table.
  it.each([
    ["offline cch probe", "30c"],
    ["hello wire compat", "de6"],
    ["canary probe", "395"],
    // This is the only vector in the whole suite long enough to reach the
    // last of the sampled indices; every other row exercises that index's
    // "0" fallback instead. A change to which index is sampled last would be
    // caught by this row alone: the QA mutation that shifted that index
    // failed exactly this row and nothing else.
    ["the quick brown fox jumps over the lazy dog", "958"],
    ["hi", "d7b"],
    ["", "d7b"],
  ])(
    "matches the independently computed vector for %j",
    async (text, expected) => {
      const createBillingFingerprint = await loadFingerprint();

      await expect(createBillingFingerprint(text, CLI_VERSION)).resolves.toBe(
        expected,
      );
    },
  );

  it("differs from the 2.1.233 answer for the same text", async () => {
    const createBillingFingerprint = await loadFingerprint();

    await expect(
      createBillingFingerprint("offline cch probe", CLI_VERSION),
    ).resolves.not.toBe(
      await createBillingFingerprint("offline cch probe", "2.1.233"),
    );
  });

  it("uses UTF-16 code-unit indexing", async () => {
    const createBillingFingerprint = await loadFingerprint();

    // The leading emoji lies outside the Basic Multilingual Plane, so it is
    // a surrogate pair taking up two UTF-16 code units. Under code-unit
    // indexing the character at index four is therefore the letter "r". An
    // implementation that switched to code-point indexing (for example by
    // spreading the string into an array first) would sample a different
    // character and produce a different digest, which is what makes this
    // case discriminating rather than decorative. The probe is written with
    // an escape so this file stays ASCII and the test provably passes the
    // identical JavaScript string that the independent script hashed.
    await expect(
      createBillingFingerprint("\u{1F642}wire compat probe", CLI_VERSION),
    ).resolves.toBe("76f");
  });
});

describe("2.1.280 billing block", () => {
  it("emits the first-turn block with no chaining segments", async () => {
    const createBillingBlock = await loadBlock();

    const block = await createBillingBlock(
      "offline cch probe",
      CLAUDE_CODE_2_1_280_PROFILE,
    );

    expect(block).toEqual({
      type: "text",
      text: "x-anthropic-billing-header: cc_version=2.1.280.30c; cc_entrypoint=cli; cch=00000;",
    });
    expect(block).not.toHaveProperty("cache_control");
  });

  it("emits both chaining segments after cch, in upstream order", async () => {
    const createBillingBlock = await loadBlock();

    const block = await createBillingBlock(
      "offline cch probe",
      CLAUDE_CODE_2_1_280_PROFILE,
      undefined,
      {
        previousRequestId: "req_abc123",
        promptId: "0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6f",
      },
    );

    expect(block.text).toBe(
      "x-anthropic-billing-header: cc_version=2.1.280.30c; cc_entrypoint=cli;" +
        " cch=00000; cc_prev_req=req_abc123;" +
        " cc_prompt_id=0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6f;",
    );
  });
});
