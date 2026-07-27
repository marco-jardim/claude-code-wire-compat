// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the fingerprint module.
 *
 * Wave 2 exports expected:
 * - `createBillingFingerprint(firstUserText: string, cliVersion: string, crypto?: Pick<Crypto, "subtle">): Promise<string>`
 * - `createBillingBlock(firstUserText: string, cliVersion: string, crypto?: Pick<Crypto, "subtle">): Promise<TextBlock>`
 */

import { createHash, webcrypto } from "node:crypto";

import { describe, expect, it } from "vitest";

import { ClaudeCodeWireError, type TextBlock } from "../src/contracts.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "./support/wave2-modules.js";

type CreateBillingFingerprint = (
  firstUserText: string,
  cliVersion: string,
  crypto?: Pick<Crypto, "subtle">,
) => Promise<string>;
type CreateBillingBlock = (
  firstUserText: string,
  cliVersion: string,
  crypto?: Pick<Crypto, "subtle">,
) => Promise<TextBlock>;

const CLI_VERSION = "2.1.195";

function formulaFingerprint(text: string, cliVersion: string): string {
  const material = `59cf53e54c78${text[4] ?? "0"}${text[7] ?? "0"}${text[20] ?? "0"}${cliVersion}`;
  return createHash("sha256")
    .update(material, "utf8")
    .digest("hex")
    .slice(0, 3);
}

describe("fingerprint (Wave 1 RED specification)", () => {
  it("the Wave 2 module is implemented", async () => {
    expect(await expectModuleUnimplemented("fingerprint")).toBe(false);
  });

  it.each([
    ["hello wire compat", "0f6"],
    ["canary probe", "12f"],
    ["offline cch probe", "7fe"],
  ])("matches the known answer for %j", async (text, expected) => {
    const createBillingFingerprint =
      await loadWave2Function<CreateBillingFingerprint>(
        "fingerprint",
        "createBillingFingerprint",
      );

    await expect(createBillingFingerprint(text, CLI_VERSION)).resolves.toBe(
      expected,
    );
  });

  it.each(["", "short", "12345678"])(
    "uses literal zero only for missing code-unit indices in %j",
    async (text) => {
      const createBillingFingerprint =
        await loadWave2Function<CreateBillingFingerprint>(
          "fingerprint",
          "createBillingFingerprint",
        );

      const result = await createBillingFingerprint(text, CLI_VERSION);
      expect(result).toBe(formulaFingerprint(text, CLI_VERSION));
      expect(result).toMatch(/^[0-9a-f]{3}$/);
    },
  );

  it("indexes non-BMP text by JavaScript UTF-16 code unit", async () => {
    const createBillingFingerprint =
      await loadWave2Function<CreateBillingFingerprint>(
        "fingerprint",
        "createBillingFingerprint",
      );
    const text = "abcd😀efghijklmnopqrs";

    await expect(createBillingFingerprint(text, CLI_VERSION)).resolves.toBe(
      formulaFingerprint(text, CLI_VERSION),
    );
  });

  it("handles a lone surrogate safely", async () => {
    const createBillingFingerprint =
      await loadWave2Function<CreateBillingFingerprint>(
        "fingerprint",
        "createBillingFingerprint",
      );
    const text = `abcd${String.fromCharCode(0xd800)}payload`;

    try {
      const result = await createBillingFingerprint(text, CLI_VERSION);
      expect(result).toMatch(/^[0-9a-f]{3}$/);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ClaudeCodeWireError);
      expect(error).toMatchObject({ code: "INVALID_UNICODE" });
    }
  });

  it("builds the exact cache-free billing block with static cch", async () => {
    const createBillingBlock = await loadWave2Function<CreateBillingBlock>(
      "fingerprint",
      "createBillingBlock",
    );
    const fingerprint = formulaFingerprint("hello wire compat", CLI_VERSION);

    const block = await createBillingBlock("hello wire compat", CLI_VERSION);
    expect(block).toEqual({
      type: "text",
      text: `x-anthropic-billing-header: cc_version=${CLI_VERSION}.${fingerprint}; cc_entrypoint=cli; cch=00000;`,
    });
    expect(block).not.toHaveProperty("cache_control");
    expect(block.text).toContain("cch=00000;");
    // cch is STATIC, empirically confirmed; upstream xxHash is dead code.
  });

  it("maps an injected digest failure to CRYPTO_UNAVAILABLE", async () => {
    const createBillingFingerprint =
      await loadWave2Function<CreateBillingFingerprint>(
        "fingerprint",
        "createBillingFingerprint",
      );
    const subtle = new Proxy(webcrypto.subtle, {
      get(target, property, receiver): unknown {
        if (property === "digest") {
          return () => Promise.reject(new Error("synthetic digest failure"));
        }
        const value: unknown = Reflect.get(target, property, receiver);
        return value;
      },
    });

    await expect(
      createBillingFingerprint("hello wire compat", CLI_VERSION, { subtle }),
    ).rejects.toMatchObject({ code: "CRYPTO_UNAVAILABLE" });
  });
});
