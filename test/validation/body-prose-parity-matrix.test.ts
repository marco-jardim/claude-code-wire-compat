// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Characterization: body-prose control-character parity matrix.
 *
 * Decision P1.T1 (2026-09-25) established that the body-prose control rule was
 * a library-local defensive policy with no upstream provenance, and relaxed
 * body prose to accept every well-formed UTF-16 string (only lone surrogates
 * stay rejected). This file was born pinning the PRE-relaxation behavior cell
 * by cell; the policy-switch commit updated every expectation deliberately, so
 * the diff between the two revisions IS the audit trail of the relaxation.
 *
 * Matrix dimensions:
 *
 * - code points: TAB/LF/CR, NUL/ESC/FF/DEL, NEL U+0085 and CSI U+009B (C1 —
 *   accepted in message lanes but rejected in the system lane before the
 *   switch; the divergence this work removed), lone surrogates (rejected
 *   before and forever), and one valid astral pair;
 * - lanes: user text, tool_result content, tool_use input value, tool
 *   description, and the system field;
 * - entries: buildClaudeCodeRequest, buildClaudeCodeCountTokensRequest and
 *   parseBuiltClaudeCodeRequest.
 *
 * All special characters are escape-constructed so this source stays plain
 * ASCII.
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
  ClaudeCodeWireError,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const RUNTIME = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  deviceId: "22222222-2222-4222-8222-222222222222",
  accountUuid: "33333333-3333-4333-8333-333333333333",
  runtime: "node",
  runtimeVersion: "22.0.0",
  os: "Linux",
  arch: "x64",
} as const;

const BASE: ClaudeCodeRequestInput = {
  accessToken: "parity-matrix-token",
  model: "claude-sonnet-4-6",
  maxTokens: 2048,
  messages: [{ role: "user", content: "parity matrix baseline" }],
  runtime: RUNTIME,
  clientRequestId: "parity-matrix-request-1",
};

type Expectation = "accept" | "INVALID_UNICODE";

interface MatrixChar {
  readonly name: string;
  readonly char: string;
  /** Expected outcome in every non-system body lane. */
  readonly body: Expectation;
  /** Expected outcome in the system lane (stricter validator today). */
  readonly system: Expectation;
}

const MATRIX_CHARS: readonly MatrixChar[] = [
  { name: "TAB 0x09", char: "\t", body: "accept", system: "accept" },
  { name: "LF 0x0A", char: "\n", body: "accept", system: "accept" },
  { name: "CR 0x0D", char: "\r", body: "accept", system: "accept" },
  { name: "NUL 0x00", char: "\u0000", body: "accept", system: "accept" },
  { name: "ESC 0x1B", char: "\u001b", body: "accept", system: "accept" },
  { name: "FF 0x0C", char: "\u000c", body: "accept", system: "accept" },
  { name: "DEL 0x7F", char: "\u007f", body: "accept", system: "accept" },
  // The pre-switch C1 divergence (accepted in message lanes, rejected in the
  // system lane) is gone: both are plain body prose now.
  { name: "NEL U+0085", char: "\u0085", body: "accept", system: "accept" },
  { name: "CSI U+009B", char: "\u009b", body: "accept", system: "accept" },
  {
    name: "lone high surrogate 0xD800",
    char: "\ud800",
    body: "INVALID_UNICODE",
    system: "INVALID_UNICODE",
  },
  {
    name: "lone low surrogate 0xDC00",
    char: "\udc00",
    body: "INVALID_UNICODE",
    system: "INVALID_UNICODE",
  },
  {
    name: "astral pair U+1F600",
    char: "\u{1f600}",
    body: "accept",
    system: "accept",
  },
];

type Lane = "userText" | "toolResult" | "toolUseInput" | "toolDescription";

const LANES: readonly Lane[] = [
  "userText",
  "toolResult",
  "toolUseInput",
  "toolDescription",
];

function wrap(char: string): string {
  return `before${char}after`;
}

function laneInput(lane: Lane, char: string): ClaudeCodeRequestInput {
  const text = wrap(char);
  switch (lane) {
    case "userText":
      return { ...BASE, messages: [{ role: "user", content: text }] };
    case "toolResult":
      return {
        ...BASE,
        messages: [
          {
            role: "assistant",
            content: [
              { type: "tool_use", id: "tu1", name: "probe", input: {} },
            ],
          },
          {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tu1", content: text },
            ],
          },
        ],
      };
    case "toolUseInput":
      return {
        ...BASE,
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "tu1",
                name: "probe",
                input: { note: text },
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tu1", content: "done" },
            ],
          },
        ],
      };
    case "toolDescription":
      return {
        ...BASE,
        tools: [
          {
            name: "probe",
            description: text,
            input_schema: { type: "object", properties: {} },
          },
        ],
      };
  }
}

function countLaneInput(lane: Lane, char: string) {
  const input = laneInput(lane, char);
  const { accessToken, model, messages, runtime, clientRequestId } = input;
  const base = { accessToken, model, messages, runtime, clientRequestId };
  return lane === "toolDescription" ? { ...base, tools: input.tools } : base;
}

async function buildFailureCode(
  input: ClaudeCodeRequestInput,
): Promise<string> {
  try {
    await buildClaudeCodeRequest(input);
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  throw new Error("expected buildClaudeCodeRequest to reject");
}

async function countFailureCode(
  input: Parameters<typeof buildClaudeCodeCountTokensRequest>[0],
): Promise<string> {
  try {
    await buildClaudeCodeCountTokensRequest(input);
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  throw new Error("expected buildClaudeCodeCountTokensRequest to reject");
}

describe("body-prose parity matrix (current behavior, pre-relaxation)", () => {
  describe("buildClaudeCodeRequest lanes", () => {
    for (const entry of MATRIX_CHARS) {
      for (const lane of LANES) {
        it(`${entry.name} in ${lane} -> ${entry.body}`, async () => {
          const input = laneInput(lane, entry.char);
          if (entry.body === "accept") {
            const built = await buildClaudeCodeRequest(input);
            expect(built.body.length).toBeGreaterThan(0);
          } else {
            expect(await buildFailureCode(input)).toBe(entry.body);
          }
        });
      }

      it(`${entry.name} in system -> ${entry.system}`, async () => {
        const input: ClaudeCodeRequestInput = {
          ...BASE,
          system: [wrap(entry.char)],
        };
        if (entry.system === "accept") {
          const built = await buildClaudeCodeRequest(input);
          expect(built.body.length).toBeGreaterThan(0);
        } else {
          expect(await buildFailureCode(input)).toBe(entry.system);
        }
      });
    }
  });

  describe("buildClaudeCodeCountTokensRequest lanes (no system field exists)", () => {
    for (const entry of MATRIX_CHARS) {
      for (const lane of LANES) {
        it(`${entry.name} in ${lane} -> ${entry.body}`, async () => {
          const input = countLaneInput(lane, entry.char);
          if (entry.body === "accept") {
            const built = await buildClaudeCodeCountTokensRequest(input);
            expect(built.body.length).toBeGreaterThan(0);
          } else {
            expect(await countFailureCode(input)).toBe(entry.body);
          }
        });
      }
    }
  });

  /*
   * parseBuiltClaudeCodeRequest inspects the built request object with the
   * same graph walker, so it can only be exercised over characters the build
   * path accepts today; build-rejected characters have no parse cell because
   * no built request carrying them can be produced through the public API.
   */
  describe("parseBuiltClaudeCodeRequest round-trip over build-accepted characters", () => {
    for (const entry of MATRIX_CHARS) {
      if (entry.body !== "accept") continue;
      it(`parse accepts a built request carrying ${entry.name}`, async () => {
        const built = await buildClaudeCodeRequest(
          laneInput("userText", entry.char),
        );
        const parsed = parseBuiltClaudeCodeRequest(built);
        expect(parsed.body).toBe(built.body);
      });
    }
  });

  it("pins the C1 unification explicitly: U+0085 accepted in a message and in system", async () => {
    const fromMessage = await buildClaudeCodeRequest(
      laneInput("userText", "\u0085"),
    );
    expect(fromMessage.body.length).toBeGreaterThan(0);
    const fromSystem = await buildClaudeCodeRequest({
      ...BASE,
      system: [wrap("\u0085")],
    });
    expect(fromSystem.body.length).toBeGreaterThan(0);
  });

  it("round-trips ESC in tool_result through build and parse with a consistent digest", async () => {
    const built = await buildClaudeCodeRequest(
      laneInput("toolResult", "\u001b"),
    );
    const parsed = parseBuiltClaudeCodeRequest(built);
    expect(parsed.body).toBe(built.body);

    const { createHash } = await import("node:crypto");
    const independent = createHash("sha256")
      .update(Buffer.from(built.body, "utf8"))
      .digest("hex");
    expect(built.evidence.bodySha256).toBe(independent);
    expect(built.evidence.bodyByteLength).toBe(
      Buffer.byteLength(built.body, "utf8"),
    );
  });
});
