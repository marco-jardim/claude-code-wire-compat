// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { ClaudeCodeWireError } from "../../src/contracts.js";
import { createBillingFingerprint } from "../../src/fingerprint.js";

type FingerprintWithUnknownProvider = (
  firstUserText: string,
  cliVersion: string,
  crypto?: unknown,
) => Promise<string>;

const createFingerprintWithUnknownProvider =
  createBillingFingerprint as unknown as FingerprintWithUnknownProvider;

function providerReturning(result: unknown): unknown {
  return { subtle: { digest: () => result } };
}

async function expectCryptoUnavailable(provider: unknown): Promise<void> {
  let caught: unknown;
  try {
    await createFingerprintWithUnknownProvider(
      "hello wire compat",
      "2.1.195",
      provider,
    );
  } catch (error: unknown) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ClaudeCodeWireError);
  if (!(caught instanceof ClaudeCodeWireError)) {
    throw new TypeError("Expected ClaudeCodeWireError");
  }
  expect(caught.code).toBe("CRYPTO_UNAVAILABLE");
}

describe("billing fingerprint crypto validation", () => {
  it("rejects a non-buffer digest result with the exact error code", async () => {
    await expectCryptoUnavailable(providerReturning("not-a-buffer"));
    await expectCryptoUnavailable(
      providerReturning({
        buffer: new ArrayBuffer(32),
        byteLength: 32,
        byteOffset: 0,
      }),
    );
  });

  it.each([4, 31, 33])(
    "rejects a %i-byte digest with the exact error code",
    async (byteLength) => {
      await expectCryptoUnavailable(
        providerReturning(Promise.resolve(new Uint8Array(byteLength).buffer)),
      );
    },
  );

  it("accepts an exact 32-byte digest and matches the default fingerprint", async () => {
    const digest = new Uint8Array(32);
    digest[0] = 0x0f;
    digest[1] = 0x60;

    const expected = await createBillingFingerprint(
      "hello wire compat",
      "2.1.195",
    );
    await expect(
      createFingerprintWithUnknownProvider(
        "hello wire compat",
        "2.1.195",
        providerReturning(Promise.resolve(digest.buffer)),
      ),
    ).resolves.toBe(expected);
    expect(expected).toBe("0f6");
  });

  it("preserves support for an exact 32-byte ArrayBuffer view", async () => {
    const backing = new ArrayBuffer(34);
    const bytes = new Uint8Array(backing);
    bytes[1] = 0x0f;
    bytes[2] = 0x60;
    const digestView = new DataView(backing, 1, 32);

    await expect(
      createFingerprintWithUnknownProvider(
        "hello wire compat",
        "2.1.195",
        providerReturning(digestView),
      ),
    ).resolves.toBe("0f6");
  });

  it.each([
    ["empty provider", {}],
    ["null subtle", { subtle: null }],
    ["missing digest", { subtle: {} }],
    ["non-callable digest", { subtle: { digest: 42 } }],
    ["primitive provider", "nope"],
    [
      "throwing digest",
      {
        subtle: {
          digest: () => {
            throw new Error("boom");
          },
        },
      },
    ],
  ])("continues to reject %s", async (_label, provider) => {
    await expectCryptoUnavailable(provider);
  });
});
