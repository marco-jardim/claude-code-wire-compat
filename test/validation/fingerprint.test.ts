// SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

import { createBillingFingerprint } from "../../src/fingerprint.js";

const CLI_VERSION = "2.1.195";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fingerprint crypto validation", () => {
  it.each([
    ["a primitive", 17],
    ["null", null],
    ["a non-object subtle implementation", { subtle: 17 }],
    ["a null subtle implementation", { subtle: null }],
    ["a subtle implementation without digest", { subtle: {} }],
  ])(
    "maps %s default crypto provider to CRYPTO_UNAVAILABLE",
    async (_label, value) => {
      vi.stubGlobal("crypto", value);

      await expect(
        createBillingFingerprint("validation synthetic", CLI_VERSION),
      ).rejects.toMatchObject({ code: "CRYPTO_UNAVAILABLE" });
    },
  );

  it("maps an explicitly injected invalid crypto provider to CRYPTO_UNAVAILABLE", async () => {
    // This cast deliberately passes an invalid-input fixture through the public type.
    const invalidCrypto = 17 as unknown as Pick<Crypto, "subtle">;

    await expect(
      createBillingFingerprint(
        "validation synthetic",
        CLI_VERSION,
        invalidCrypto,
      ),
    ).rejects.toMatchObject({ code: "CRYPTO_UNAVAILABLE" });
  });
});
