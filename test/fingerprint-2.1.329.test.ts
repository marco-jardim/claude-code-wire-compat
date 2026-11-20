// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Known-answer vectors for the 2.1.329 billing fingerprint, and byte-exact
 * pins for the block that carries it.
 *
 * Seven of the eight vectors below were computed by a standalone script that
 * lives outside this repository and imports nothing from this package, only
 * the platform crypto module; the script was run twice, once in Node and once
 * in Python, and the two implementations agreed on every value. The eighth,
 * `hello` -> `e8c`, is a LIVE vector: it is the fingerprint the genuine 2.1.329
 * client placed in a captured request whose first user text was `hello`.
 *
 * The formula is the one `fingerprint-2.1.280.test.ts` documents (the
 * generator is reproduced there): the salt, the characters at UTF-16 code-unit
 * indices 4, 7 and 20 of the first user text (falling back to "0"), and the
 * CLI version string, hashed with SHA-256 and truncated to three hex
 * characters. Only the CLI version differs, which is why the 2.1.329 answers
 * differ from the older profiles' answers for the same probe phrases.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeProtocolProfile, TextBlock } from "../src/contracts.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_329_PROFILE,
} from "../src/index.js";
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

const CLI_VERSION = "2.1.329";

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

describe("2.1.329 billing fingerprint", () => {
  it("pins the profile's CLI version", () => {
    expect(CLAUDE_CODE_2_1_329_PROFILE.cliVersion).toBe(CLI_VERSION);
  });

  // The "hi" and "" rows deliberately share an expected value. Both inputs
  // are too short to reach any of the sampled indices, so every lookup falls
  // back to the literal "0" and the hashed material is byte-identical for
  // them. This is a property of the transcribed formula, not a copy-paste
  // error in the table.
  it.each([
    // LIVE: the fingerprint of the genuine client's captured request.
    ["hello", "e8c"],
    ["offline cch probe", "100"],
    ["hello wire compat", "dac"],
    ["canary probe", "776"],
    // The only vector long enough to reach the last sampled index; every
    // other row exercises that index's "0" fallback instead.
    ["the quick brown fox jumps over the lazy dog", "945"],
    ["hi", "3c4"],
    ["", "3c4"],
  ])(
    "matches the independently computed vector for %j",
    async (text, expected) => {
      const createBillingFingerprint = await loadFingerprint();

      await expect(createBillingFingerprint(text, CLI_VERSION)).resolves.toBe(
        expected,
      );
    },
  );

  it("differs from the 2.1.280 answer for the same text", async () => {
    const createBillingFingerprint = await loadFingerprint();

    await expect(
      createBillingFingerprint("offline cch probe", CLI_VERSION),
    ).resolves.not.toBe(
      await createBillingFingerprint("offline cch probe", "2.1.280"),
    );
  });

  it("uses UTF-16 code-unit indexing", async () => {
    const createBillingFingerprint = await loadFingerprint();

    // The leading emoji is a surrogate pair, two UTF-16 code units, so under
    // code-unit indexing the character at index four is the letter "r"; a
    // code-point implementation would sample a different character. The probe
    // is written with an escape so this file stays ASCII.
    await expect(
      createBillingFingerprint("\u{1F642}wire compat probe", CLI_VERSION),
    ).resolves.toBe("878");
  });
});

describe("2.1.329 billing block", () => {
  it("emits the first-turn block with no chaining segments", async () => {
    const createBillingBlock = await loadBlock();

    const block = await createBillingBlock(
      "offline cch probe",
      CLAUDE_CODE_2_1_329_PROFILE,
    );

    expect(block).toEqual({
      type: "text",
      text: "x-anthropic-billing-header: cc_version=2.1.329.100; cc_entrypoint=cli; cch=00000;",
    });
    expect(block).not.toHaveProperty("cache_control");
  });

  it("emits both chaining segments after cch, in upstream order", async () => {
    const createBillingBlock = await loadBlock();

    const block = await createBillingBlock(
      "offline cch probe",
      CLAUDE_CODE_2_1_329_PROFILE,
      undefined,
      {
        previousRequestId: "req_abc123",
        promptId: "0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6f",
      },
    );

    expect(block.text).toBe(
      "x-anthropic-billing-header: cc_version=2.1.329.100; cc_entrypoint=cli;" +
        " cch=00000; cc_prev_req=req_abc123;" +
        " cc_prompt_id=0f6e2a71-9d4c-4b8a-8f3d-1c2b3a4d5e6f;",
    );
  });

  /*
   * LIVE: the SDK-entrypoint billing text of the genuine 2.1.329 client.
   *
   * The template is `system[0].text` of the captured sdk-cli request; its
   * prompt id is replaced by a synthetic one (real ids are never copied
   * here). The first user text of that capture was `hello`, so the
   * fingerprint is the same `e8c` as the interactive vector. The entrypoint
   * is reached through `profileOverride`, the public seam for it.
   */
  it("reproduces the live sdk-cli billing template byte for byte", async () => {
    const built = await buildClaudeCodeRequest(
      {
        accessToken: "fingerprint-token-not-a-secret",
        model: "claude-opus-5-5",
        maxTokens: 128,
        messages: [{ role: "user", content: "hello" }],
        runtime: {
          sessionId: "00000000-0000-4000-8000-000000000001",
          deviceId:
            "0000000000000000000000000000000000000000000000000000000000000002",
          accountUuid: "00000000-0000-4000-8000-000000000000",
          runtime: "node",
          runtimeVersion: "v24.15.0",
          os: "Windows",
          arch: "x64",
        },
        clientRequestId: "00000000-0000-4000-8000-000000000002",
        profileOverride: { entrypoint: "sdk-cli" },
        // The `x-app` header defaults to the profile entrypoint and accepts
        // only "cli" or "cli-bg", so the SDK entrypoint must be paired with an
        // explicit `app`. The billing block reads the overridden entrypoint.
        app: "cli",
        cch: "ca29e",
        promptId: "00000000-0000-4000-8000-000000000003",
        turnOrigin: "sdk",
        turnPosition: { promptIndex: 0, turnIndex: 1 },
      },
      CLAUDE_CODE_2_1_329_PROFILE,
    );
    const body = JSON.parse(built.body) as {
      system: readonly { readonly text: string }[];
    };

    expect(body.system[0]?.text).toBe(
      "x-anthropic-billing-header: cc_version=2.1.329.e8c; cc_entrypoint=sdk-cli; cch=ca29e; cc_prompt_id=00000000-0000-4000-8000-000000000003; cc_turn_origin=sdk; cc_prompt_index=0; cc_turn_index=1;",
    );
  });
});
