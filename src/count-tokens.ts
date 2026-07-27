// SPDX-License-Identifier: GPL-3.0-or-later

import { COUNT_TOKENS_BETAS } from "./beta-registry.js";
import type { Message, ToolDefinition } from "./contracts.js";

/** Upstream SDK `countTokens` endpoint at byte offset 224471633. */
export const COUNT_TOKENS_ENDPOINT =
  "https://api.anthropic.com/v1/messages/count_tokens?beta=true" as const;

/** Upstream SDK `countTokens` beta at byte offset 224471633. */
export const TOKEN_COUNTING_BETA = "token-counting-2024-11-01" as const;

/** Upstream `PMo` used by `P5e` at byte offset 235439559. */
export const COUNT_TOKENS_THINKING_BUDGET = 1024 as const;

/** Upstream `P5e` empty-message fallback at byte offset 235439559. */
export const COUNT_TOKENS_EMPTY_MESSAGES = Object.freeze([
  Object.freeze({ role: "user", content: "foo" }),
]);

/**
 * Upstream `Bkl` at byte offset 235438568.
 *
 * Decides whether the count-tokens body carries a `thinking` field. Note the
 * two conjuncts upstream requires and this port preserves: the message role
 * must be `assistant`, and its content must be an ARRAY. A thinking block on a
 * user message, or an assistant message whose content is a plain string, does
 * not qualify.
 *
 * Upstream additionally guards each message and block against being a
 * non-object, because it runs on loosely typed internal history. This port is
 * reached only through `canonicalCountTokensLists`, which has already proven
 * every element well formed, so those guards would be unreachable branches.
 * Restore them only if a caller path is ever added that bypasses that
 * canonicaliser.
 */
export function containsThinkingBlock(messages: readonly Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "assistant" &&
      typeof message.content !== "string" &&
      message.content.some(
        (block) =>
          block.type === "thinking" || block.type === "redacted_thinking",
      ),
  );
}

/** Upstream `E2r` filtering in `P5e` at byte offset 235439559. */
export function filterCountTokensBetas(
  composedBetas: readonly string[],
): readonly string[] {
  return Object.freeze(
    composedBetas.filter((beta) => COUNT_TOKENS_BETAS.has(beta)),
  );
}

/**
 * Upstream `P5e` wire-body construction at byte offset 235439559.
 *
 * Both list arguments MUST already have been canonicalised by
 * `canonicalCountTokensLists`. Key order is load-bearing: the vendored SDK
 * destructures `betas` out of the body and object rest preserves the
 * declaration order of the survivors, leaving `model`, `messages`, `tools`,
 * then an optional `thinking` on the wire.
 */
export function buildCountTokensBody(
  model: string,
  messages: readonly Message[],
  tools: readonly ToolDefinition[],
): Readonly<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    model,
    messages: messages.length > 0 ? messages : COUNT_TOKENS_EMPTY_MESSAGES,
    tools,
  };
  if (containsThinkingBlock(messages)) {
    body["thinking"] = {
      type: "enabled",
      budget_tokens: COUNT_TOKENS_THINKING_BUDGET,
    };
  }
  return Object.freeze(body);
}
