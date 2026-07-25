// SPDX-License-Identifier: GPL-3.0-or-later

import type { TextBlock } from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

const FINGERPRINT_PREFIX = "59cf53e54c78";

function isCryptoProvider(value: unknown): value is Pick<Crypto, "subtle"> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const subtle: unknown = Reflect.get(value, "subtle");
  return (
    typeof subtle === "object" &&
    subtle !== null &&
    typeof Reflect.get(subtle, "digest") === "function"
  );
}

function getDefaultCrypto(): Pick<Crypto, "subtle"> {
  const value: unknown = Reflect.get(globalThis, "crypto");
  if (!isCryptoProvider(value)) {
    throw new ClaudeCodeWireError("CRYPTO_UNAVAILABLE");
  }
  return value;
}

export async function createBillingFingerprint(
  firstUserText: string,
  cliVersion: string,
  crypto?: Pick<Crypto, "subtle">,
): Promise<string> {
  const cryptoProvider = crypto ?? getDefaultCrypto();
  const material = `${FINGERPRINT_PREFIX}${firstUserText[4] ?? "0"}${firstUserText[7] ?? "0"}${firstUserText[20] ?? "0"}${cliVersion}`;
  const bytes = new TextEncoder().encode(material);

  let digest: unknown;
  // Keep this try deliberately narrow so our validation errors are not self-masked.
  try {
    digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
  } catch {
    throw new ClaudeCodeWireError("CRYPTO_UNAVAILABLE");
  }

  let digestBytes: Uint8Array;
  if (digest instanceof ArrayBuffer) {
    digestBytes = new Uint8Array(digest);
  } else if (ArrayBuffer.isView(digest)) {
    digestBytes = new Uint8Array(
      digest.buffer,
      digest.byteOffset,
      digest.byteLength,
    );
  } else {
    // Unvalidated digests silently corrupt billing fingerprints as "" or "000".
    throw new ClaudeCodeWireError("CRYPTO_UNAVAILABLE");
  }
  if (digestBytes.byteLength !== 32) {
    throw new ClaudeCodeWireError("CRYPTO_UNAVAILABLE");
  }

  return Array.from(digestBytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 3);
}

export async function createBillingBlock(
  firstUserText: string,
  cliVersion: string,
  crypto?: Pick<Crypto, "subtle">,
): Promise<TextBlock> {
  const fingerprint = await createBillingFingerprint(
    firstUserText,
    cliVersion,
    crypto,
  );
  const { entrypoint } = CLAUDE_CODE_2_1_195_PROFILE;

  return {
    type: "text",
    text: `x-anthropic-billing-header: cc_version=${cliVersion}.${fingerprint}; cc_entrypoint=${entrypoint}; cch=00000;`,
  };
}
