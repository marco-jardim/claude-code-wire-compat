// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_280_PROFILE,
  ClaudeCodeWireError,
  parseBuiltClaudeCodeRequest,
  type ClaudeCodeCountTokensInput,
  type ClaudeCodeRequestInput,
  type Message,
} from "../../src/index.js";
import {
  MAX_COMPOSITE_SIZE,
  MAX_INPUT_ITEMS,
  MAX_INPUT_SIZE,
} from "../../src/limits.js";
import { buildCanonicalBody } from "../../src/request-body.js";

// Independent oracles. The Messages API accepts request bodies up to 32 MB;
// the ceiling takes the binary reading (32 MiB), the larger of the two, so a
// request the API accepts is never refused locally.
const INPUT_CEILING = 33_554_432;
const ITEM_CEILING = 3_355_443;
const COMPOSITE_CEILING = 100_663_296;
const HEAVY = { timeout: 120_000 };

const RUNTIME = {
  sessionId: "10000000-0000-4000-8000-000000000001",
  deviceId: "1000000000000000000000000000000000000000000000000000000000000001",
  accountUuid: "10000000-0000-4000-8000-000000000000",
  runtime: "node",
  runtimeVersion: "v24.15.0",
  os: "Windows",
  arch: "x64",
} as const;

function requestInput(messages: readonly Message[]): ClaudeCodeRequestInput {
  return {
    accessToken: "limits-token-4d30e8",
    model: "claude-opus-5-5",
    maxTokens: 32_000,
    messages,
    system: ["You are a coding agent."],
    runtime: RUNTIME,
    clientRequestId: "10000000-0000-4000-8000-000000000002",
  };
}

function countTokensInput(
  messages: readonly Message[],
): ClaudeCodeCountTokensInput {
  return {
    accessToken: "limits-token-4d30e8",
    model: "claude-opus-5-5",
    messages,
    runtime: RUNTIME,
    clientRequestId: "10000000-0000-4000-8000-000000000002",
  };
}

/** Mirrors the builder's graph measure: UTF-8 bytes, keys and scalars. */
function graphSize(value: unknown): number {
  if (typeof value === "string") {
    return new TextEncoder().encode(value).byteLength;
  }
  if (value === null || typeof value !== "object") return 1;
  const keys = Reflect.ownKeys(value);
  let size = keys.length;
  for (const key of keys) {
    if (typeof key !== "string") throw new TypeError("Unsupported key.");
    size += new TextEncoder().encode(key).byteLength;
    size += graphSize(Reflect.get(value, key));
  }
  return size;
}

/** Counts the objects and arrays the canonical-body walker counts. */
function containerCount(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  let count = 1;
  for (const child of Object.values(value)) count += containerCount(child);
  return count;
}

/**
 * A long agent session: user turns, assistant tool calls and multi-kilobyte
 * tool results with non-ASCII text, until the chunk budget reaches the target.
 */
function realisticMessages(targetBytes: number): Message[] {
  const chunk =
    "line of tool output: const value = compute(index) // ünïcødé ✓\n".repeat(
      60,
    );
  const messages: Message[] = [];
  let bytes = 0;
  for (let turn = 0; bytes < targetBytes; turn += 1) {
    const id = `toolu_${String(turn).padStart(8, "0")}`;
    messages.push(
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `turn ${String(turn)}: ${chunk.slice(0, 200)}`,
          },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Running the tool." },
          {
            type: "tool_use",
            id,
            name: "read_file",
            input: { path: `src/file-${String(turn)}.ts`, limit: 2000 },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: id,
            content: [{ type: "text", text: `${chunk}${String(turn)}` }],
          },
        ],
      },
    );
    bytes += chunk.length + 600;
  }
  messages.push({ role: "user", content: "final question" });
  return messages;
}

function paddedMessages(padding: number): Message[] {
  return [{ role: "user", content: "x".repeat(padding) }];
}

async function captureAsync(
  operation: () => Promise<unknown>,
): Promise<ClaudeCodeWireError> {
  try {
    await operation();
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error;
    throw error;
  }
  throw new Error("expected the operation to reject");
}

function captureSync(operation: () => unknown): ClaudeCodeWireError {
  try {
    operation();
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error;
    throw error;
  }
  throw new Error("expected the operation to throw");
}

describe("input size ceilings", () => {
  it("pins the shared ceiling to 32 MiB and derives the others from it", () => {
    expect({
      MAX_INPUT_SIZE,
      MAX_INPUT_ITEMS,
      MAX_COMPOSITE_SIZE,
    }).toStrictEqual({
      MAX_INPUT_SIZE: INPUT_CEILING,
      MAX_INPUT_ITEMS: ITEM_CEILING,
      MAX_COMPOSITE_SIZE: COMPOSITE_CEILING,
    });
  });

  it("builds a request input measuring the old 1,000,000 ceiling plus one", async () => {
    const base = requestInput(paddedMessages(0));
    const padding = 1_000_001 - graphSize(base);
    const input = requestInput(paddedMessages(padding));
    expect(graphSize(input)).toBe(1_000_001);
    await expect(
      buildClaudeCodeRequest(input, CLAUDE_CODE_2_1_280_PROFILE),
    ).resolves.toMatchObject({ method: "POST" });
  });

  it(
    "rejects a build input one unit over the ceiling with the ceiling in safeDetails",
    HEAVY,
    async () => {
      const base = requestInput(paddedMessages(0));
      const input = requestInput(
        paddedMessages(INPUT_CEILING + 1 - graphSize(base)),
      );
      expect(graphSize(input)).toBe(INPUT_CEILING + 1);
      const error = await captureAsync(() =>
        buildClaudeCodeRequest(input, CLAUDE_CODE_2_1_280_PROFILE),
      );
      expect({
        code: error.code,
        safeDetails: error.safeDetails,
      }).toStrictEqual({
        code: "INPUT_TOO_LARGE",
        safeDetails: { maximumSize: INPUT_CEILING },
      });
    },
  );

  it(
    "builds a request whose input sits just below the ceiling",
    HEAVY,
    async () => {
      // Later walkers also count the canonical system blocks and the profile,
      // so the largest buildable input sits a few kilobytes under the graph
      // ceiling; 64 KiB of headroom is well clear of that and of nothing else.
      const base = requestInput(paddedMessages(0));
      const input = requestInput(
        paddedMessages(INPUT_CEILING - 65_536 - graphSize(base)),
      );
      const built = await buildClaudeCodeRequest(
        input,
        CLAUDE_CODE_2_1_280_PROFILE,
      );
      expect(built.evidence.bodyByteLength).toBeGreaterThan(
        INPUT_CEILING - 65_536,
      );
      expect(
        parseBuiltClaudeCodeRequest(built, CLAUDE_CODE_2_1_280_PROFILE).body,
      ).toBe(built.body);
    },
  );

  it("applies the same ceiling to count-tokens input", HEAVY, async () => {
    const base = countTokensInput(paddedMessages(0));
    const below = countTokensInput(
      paddedMessages(INPUT_CEILING - 65_536 - graphSize(base)),
    );
    await expect(
      buildClaudeCodeCountTokensRequest(below, CLAUDE_CODE_2_1_280_PROFILE),
    ).resolves.toMatchObject({ method: "POST" });

    const over = countTokensInput(
      paddedMessages(INPUT_CEILING + 1 - graphSize(base)),
    );
    expect(graphSize(over)).toBe(INPUT_CEILING + 1);
    const error = await captureAsync(() =>
      buildClaudeCodeCountTokensRequest(over, CLAUDE_CODE_2_1_280_PROFILE),
    );
    expect({ code: error.code, safeDetails: error.safeDetails }).toStrictEqual({
      code: "INPUT_TOO_LARGE",
      safeDetails: { maximumSize: INPUT_CEILING },
    });
  });

  it(
    "parses a decoded body at the ceiling and rejects one unit more",
    HEAVY,
    async () => {
      const built = await buildClaudeCodeRequest(
        requestInput(paddedMessages(8)),
        CLAUDE_CODE_2_1_280_PROFILE,
      );
      // Past the size gate the only failure left is the body digest, so the
      // error code alone shows which side of the ceiling each body fell on.
      const withBody = (padding: number): Record<string, unknown> => {
        const body = { padding: "x".repeat(padding) };
        return { ...built, body: JSON.stringify(body) };
      };
      const atCeiling = INPUT_CEILING - graphSize({ padding: "" });
      expect(graphSize({ padding: "x".repeat(atCeiling) })).toBe(INPUT_CEILING);

      const accepted = captureSync(() =>
        parseBuiltClaudeCodeRequest(
          withBody(atCeiling),
          CLAUDE_CODE_2_1_280_PROFILE,
        ),
      );
      expect(accepted.code).toBe("INVALID_INPUT");

      const rejected = captureSync(() =>
        parseBuiltClaudeCodeRequest(
          withBody(atCeiling + 1),
          CLAUDE_CODE_2_1_280_PROFILE,
        ),
      );
      expect({
        code: rejected.code,
        safeDetails: rejected.safeDetails,
      }).toStrictEqual({
        code: "INPUT_TOO_LARGE",
        safeDetails: { maximumSize: INPUT_CEILING },
      });
    },
  );

  it(
    "gives the built-request wrapper the composite budget",
    HEAVY,
    async () => {
      const built = await buildClaudeCodeRequest(
        requestInput(paddedMessages(8)),
        CLAUDE_CODE_2_1_280_PROFILE,
      );
      const wrapperWithoutBody = graphSize({ ...built, body: "" });
      const withBodyLength = (length: number): Record<string, unknown> => ({
        ...built,
        body: "x".repeat(length),
      });

      // At the composite budget the wrapper passes and the body, not JSON,
      // fails to parse; one unit over, the wrapper gate fires first.
      const accepted = captureSync(() =>
        parseBuiltClaudeCodeRequest(
          withBodyLength(COMPOSITE_CEILING - wrapperWithoutBody),
          CLAUDE_CODE_2_1_280_PROFILE,
        ),
      );
      expect(accepted.code).toBe("INVALID_INPUT");

      const rejected = captureSync(() =>
        parseBuiltClaudeCodeRequest(
          withBodyLength(COMPOSITE_CEILING - wrapperWithoutBody + 1),
          CLAUDE_CODE_2_1_280_PROFILE,
        ),
      );
      expect({
        code: rejected.code,
        safeDetails: rejected.safeDetails,
      }).toStrictEqual({
        code: "INPUT_TOO_LARGE",
        safeDetails: { maximumSize: COMPOSITE_CEILING },
      });
    },
  );

  it(
    "accepts exactly the container ceiling in the canonical body and rejects one more",
    HEAVY,
    () => {
      const profile = CLAUDE_CODE_2_1_280_PROFILE;
      const modelId = "claude-opus-5-5";
      const definition = profile.supportedModels[modelId];
      if (definition === undefined) throw new Error("Missing pinned model.");
      const resolvedModel = { id: modelId, wireId: modelId, ...definition };
      const inputWith = (items: readonly unknown[]) => ({
        model: modelId,
        maxTokens: 1024,
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "toolu_items",
                name: "bulk",
                input: { items },
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_items",
                content: "ok",
              },
            ],
          },
        ],
      });
      const fixedContainers =
        containerCount(inputWith([])) +
        containerCount(resolvedModel) +
        containerCount([]) +
        containerCount({}) +
        containerCount(profile);
      const atCeiling = ITEM_CEILING - fixedContainers;
      expect(atCeiling).toBeGreaterThan(3_000_000);

      const items = Array.from({ length: atCeiling }, () => []);
      expect(
        buildCanonicalBody(inputWith(items), resolvedModel, [], {}, profile),
      ).toHaveProperty("messages");

      items.push([]);
      const error = captureSync(() =>
        buildCanonicalBody(inputWith(items), resolvedModel, [], {}, profile),
      );
      expect(error.code).toBe("INPUT_TOO_LARGE");
    },
  );
});

describe("long-session requests", () => {
  it.each([
    [5, 5_000_000],
    [20, 20_000_000],
  ])(
    "builds, parses and counts a realistic %s MB multi-message request",
    HEAVY,
    async (_label, targetBytes) => {
      const messages = realisticMessages(targetBytes);
      const built = await buildClaudeCodeRequest(
        requestInput(messages),
        CLAUDE_CODE_2_1_280_PROFILE,
      );
      expect(built.evidence.bodyByteLength).toBeGreaterThan(targetBytes);
      expect(built.evidence.messageCount).toBe(messages.length);
      expect(
        parseBuiltClaudeCodeRequest(built, CLAUDE_CODE_2_1_280_PROFILE).body,
      ).toBe(built.body);
      await expect(
        buildClaudeCodeCountTokensRequest(
          countTokensInput(messages),
          CLAUDE_CODE_2_1_280_PROFILE,
        ),
      ).resolves.toMatchObject({ method: "POST" });
    },
  );

  it(
    "scales build time linearly rather than quadratically",
    HEAVY,
    async () => {
      const timeBuild = async (targetBytes: number): Promise<number> => {
        const input = requestInput(realisticMessages(targetBytes));
        const started = performance.now();
        await buildClaudeCodeRequest(input, CLAUDE_CODE_2_1_280_PROFILE);
        return performance.now() - started;
      };
      await timeBuild(1_000_000);
      const small = await timeBuild(2_000_000);
      const large = await timeBuild(16_000_000);
      // Eight times the input: linear work costs ~8x, quadratic ~64x. The
      // generous bound absorbs scheduler and GC noise on shared CI runners.
      expect(large / small).toBeLessThan(24);
    },
  );
});
