// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeProtocolProfile, TextBlock } from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { profileBehaviors } from "./profile-behaviors.js";

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
 * Exported because the 2.1.329 header layout guards `x-claude-code-prompt-id`
 * with the same pattern.
 */
export const PROMPT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shape of the `cch` value: exactly five lowercase hexadecimal characters.
 * Exported so the input validator and the block builder share one definition.
 */
export const CCH_PATTERN = /^[0-9a-f]{5}$/u;

/**
 * Upstream guard on `cc_turn_origin` (2.1.329 billing builder, view line
 * 115131): a lowercase letter followed by up to 31 lowercase letters or
 * underscores.
 */
const TURN_ORIGIN_PATTERN = /^[a-z][a-z_]{0,31}$/;

/**
 * Upstream integer guard `xu` (2.1.329 bundle, view line 115141): a finite
 * integer number from `minimum` to ten million inclusive.
 */
function isBoundedInteger(value: unknown, minimum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= 1e7
  );
}

/**
 * The conversation-chaining inputs of the billing block. All are the caller's
 * to supply; see `ClaudeCodeRequestInput.previousRequestId`.
 *
 * `cch` replaces the placeholder checksum value and is honoured by every
 * profile. `turnOrigin` and `turnPosition` feed the turn segments that only the
 * `billingTurnSegments` behaviour emits.
 */
export interface BillingChain {
  readonly previousRequestId?: string;
  readonly promptId?: string;
  readonly cch?: string;
  readonly turnOrigin?: string;
  readonly turnPosition?: {
    readonly promptIndex: number;
    readonly turnIndex: number;
  };
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
  // The upstream transcription in the analysis doc writes `||` here; `??` is a
  // deliberate, safe difference, not a divergence to "fix" in either
  // direction. A string subscript yields either a one-unit string, which is
  // always truthy, or `undefined`, so no value makes the two operators
  // disagree (and no test can tell them apart).
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
 *   - `cch=…;` is always present. Its gate is the first-party predicate,
 *     which is true for the Anthropic provider this package targets. Its value
 *     is the placeholder `00000` unless the caller supplies its own five
 *     lowercase hexadecimal characters through `BillingChain.cch`.
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

  /*
   * The checksum value is the caller's to supply when it has computed one;
   * otherwise the placeholder every earlier release emitted, so a request
   * built without it is byte-identical to before. It is the only caller bytes
   * in this position, so a value that is not five lowercase hexadecimal
   * characters is refused rather than interpolated.
   */
  const cch = chain?.cch ?? "00000";
  if (!CCH_PATTERN.test(cch)) {
    throw new ClaudeCodeWireError("INVALID_INPUT", { field: "cch" });
  }

  let text = `x-anthropic-billing-header: cc_version=${cliVersion}.${fingerprint}; cc_entrypoint=${entrypoint}; cch=${cch};`;

  /*
   * ---- Demarcated: conversation chaining, upstream 2.1.233. ----
   *
   * The gate is STRUCTURAL, not a capability flag: the 2.1.233 builder takes
   * these two values, the 2.1.195 builder has no parameter for them, so the
   * 195 profile must never emit either segment even when a caller supplies
   * both. They are dropped silently there, exactly as a client without the
   * feature would drop them. Which profiles are on which side is
   * `profile-behaviors.ts`'s question, not this module's.
   *
   * A malformed value is dropped silently too, and never interpolated: these
   * segments are the only caller-controlled bytes in the block, so a value
   * failing its pattern must not reach the wire in any form.
   */
  if (profileBehaviors(profile).billingChainSegments) {
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

  /*
   * ---- Demarcated: turn origin and turn position, upstream 2.1.329. ----
   *
   * Two segments follow `cc_prompt_id`, each guarded independently and each
   * dropped silently when its value fails the guard (a malformed value must
   * not reach the wire in any form). The origin names who started the turn;
   * the position pair is emitted only when BOTH indexes hold: the prompt index
   * from 0 and the turn index from 1, each an integer no greater than ten
   * million. A profile without the behaviour has no parameter for either, so
   * it never emits them, whatever the caller supplies.
   */
  if (profileBehaviors(profile).billingTurnSegments) {
    const turnOrigin = chain?.turnOrigin;
    if (
      typeof turnOrigin === "string" &&
      TURN_ORIGIN_PATTERN.test(turnOrigin)
    ) {
      text += ` cc_turn_origin=${turnOrigin};`;
    }
    const promptIndex = chain?.turnPosition?.promptIndex;
    const turnIndex = chain?.turnPosition?.turnIndex;
    if (isBoundedInteger(promptIndex, 0) && isBoundedInteger(turnIndex, 1)) {
      text += ` cc_prompt_index=${String(promptIndex)}; cc_turn_index=${String(turnIndex)};`;
    }
  }

  return { type: "text", text };
}
