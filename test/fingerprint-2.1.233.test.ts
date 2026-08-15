// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Known-answer vectors for the 2.1.233 billing fingerprint, and byte-exact
 * pins for the block that carries it.
 *
 * The three fingerprints below were computed independently of this package's
 * code, from the transcribed formula, and are pinned here so that a change to
 * the fingerprint algorithm cannot pass unnoticed. The 2.1.195 vectors in
 * `fingerprint.test.ts` are the same three phrases, and the two sets must
 * differ: the CLI version is part of the hashed material.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeProtocolProfile, TextBlock } from "../src/contracts.js";
import { CLAUDE_CODE_2_1_233_PROFILE } from "../src/profiles/claude-code-2.1.233.js";
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

const CLI_VERSION = "2.1.233";

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

describe("2.1.233 billing fingerprint", () => {
  it("pins the profile's CLI version", () => {
    expect(CLAUDE_CODE_2_1_233_PROFILE.cliVersion).toBe(CLI_VERSION);
  });

  it.each([
    ["offline cch probe", "365"],
    ["hello wire compat", "413"],
    ["canary probe", "cea"],
  ])("matches the known answer for %j", async (text, expected) => {
    const createBillingFingerprint = await loadFingerprint();

    await expect(createBillingFingerprint(text, CLI_VERSION)).resolves.toBe(
      expected,
    );
  });

  it("differs from the 2.1.195 answer for the same text", async () => {
    const createBillingFingerprint = await loadFingerprint();

    await expect(
      createBillingFingerprint("offline cch probe", CLI_VERSION),
    ).resolves.not.toBe(
      await createBillingFingerprint("offline cch probe", "2.1.195"),
    );
  });
});

describe("2.1.233 billing block", () => {
  it("emits the first-turn block with no chaining segments", async () => {
    const createBillingBlock = await loadBlock();

    const block = await createBillingBlock(
      "offline cch probe",
      CLAUDE_CODE_2_1_233_PROFILE,
    );

    expect(block).toEqual({
      type: "text",
      text: "x-anthropic-billing-header: cc_version=2.1.233.365; cc_entrypoint=cli; cch=00000;",
    });
    expect(block).not.toHaveProperty("cache_control");
  });

  it("emits both chaining segments after cch, in upstream order", async () => {
    const createBillingBlock = await loadBlock();

    const block = await createBillingBlock(
      "offline cch probe",
      CLAUDE_CODE_2_1_233_PROFILE,
      undefined,
      {
        previousRequestId: "req_abc123",
        promptId: "0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6f",
      },
    );

    expect(block.text).toBe(
      "x-anthropic-billing-header: cc_version=2.1.233.365; cc_entrypoint=cli;" +
        " cch=00000; cc_prev_req=req_abc123;" +
        " cc_prompt_id=0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6f;",
    );
  });
});
