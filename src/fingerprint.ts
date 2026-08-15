// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile, TextBlock } from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

const FINGERPRINT_PREFIX = "59cf53e54c78";

/**
 * Upstream guard on `cc_prev_req`, transcribed verbatim from the 2.1.233
 * billing-header builder: the segment is emitted only when the value is
 * defined AND matches this pattern AND the request is first-party.
 */
const PREVIOUS_REQUEST_ID_PATTERN = /^req_[A-Za-z0-9_-]{1,36}$/;

/**
 * Upstream guard on `cc_prompt_id`, transcribed verbatim from the same builder.
 * The `i` flag is upstream's, not a relaxation: an upper-case UUID IS emitted.
 */
const PROMPT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The conversation-chaining inputs of the 2.1.233 billing block. Both are the
 * caller's to supply; see `ClaudeCodeRequestInput.previousRequestId`.
 */
export interface BillingChain {
  readonly previousRequestId?: string;
  readonly promptId?: string;
}

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

/**
 * Builds the canonical billing block (system index 0).
 *
 * The upstream 2.1.233 builder assembles a fixed prefix followed by five
 * optional segments, each one space-prefixed and semicolon-terminated, in this
 * order: `cch`, `cc_workload`, `cc_is_subagent`, `cc_prev_req`, `cc_prompt_id`.
 *
 * Three of those five are settled for every request this package emits:
 *
 *   - `cch=00000;` is always present. Its gate is the first-party predicate,
 *     which is true for the Anthropic provider this package targets, and its
 *     value is static — the upstream hashed-cache path is dead code.
 *   - `cc_workload` and `cc_is_subagent` are never emitted. They describe a
 *     background workload and a sub-agent session respectively; this package
 *     models the CLI's main session, which has neither. Same position as
 *     2.1.195, which has no such segments at all.
 *
 * The remaining two are conversation state and are the caller's to supply.
 */
export async function createBillingBlock(
  firstUserText: string,
  profile: ClaudeCodeProtocolProfile,
  crypto?: Pick<Crypto, "subtle">,
  chain?: BillingChain,
): Promise<TextBlock> {
  const { cliVersion, entrypoint } = profile;
  const fingerprint = await createBillingFingerprint(
    firstUserText,
    cliVersion,
    crypto,
  );

  let text = `x-anthropic-billing-header: cc_version=${cliVersion}.${fingerprint}; cc_entrypoint=${entrypoint}; cch=00000;`;

  /*
   * ---- Demarcated: conversation chaining, upstream 2.1.233. ----
   *
   * The gate is STRUCTURAL, not a capability flag: the 2.1.233 builder takes
   * these two values, the 2.1.195 builder has no parameter for them, so the
   * 195 profile must never emit either segment even when a caller supplies
   * both. They are dropped silently there, exactly as a client without the
   * feature would drop them. Centralising per-version dispatch — so that this
   * reads as a profile trait rather than an identity comparison — is a later
   * task, as it is in `thinking.ts`.
   *
   * A malformed value is dropped silently too, and never interpolated: these
   * segments are the only caller-controlled bytes in the block, so a value
   * failing its pattern must not reach the wire in any form.
   */
  if (profile.id !== CLAUDE_CODE_2_1_195_PROFILE.id) {
    const previousRequestId = chain?.previousRequestId;
    if (
      previousRequestId !== undefined &&
      PREVIOUS_REQUEST_ID_PATTERN.test(previousRequestId)
    ) {
      text += ` cc_prev_req=${previousRequestId};`;
    }
    const promptId = chain?.promptId;
    if (promptId !== undefined && PROMPT_ID_PATTERN.test(promptId)) {
      text += ` cc_prompt_id=${promptId};`;
    }
  }

  return { type: "text", text };
}
