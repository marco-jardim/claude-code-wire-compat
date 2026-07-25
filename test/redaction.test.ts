// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the redaction module.
 *
 * Wave 2 exports expected:
 * - `buildRedactedEvidence(input: BuildRedactedEvidenceInput): Promise<RedactedRequestEvidence>`
 * - `toSafeErrorDetails(value: unknown): Readonly<Record<string, string | number | boolean>>`
 */

import { describe, expect, it } from "vitest";

import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  HeaderPair,
  JsonValue,
  RedactedRequestEvidence,
} from "../src/contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../src/profiles/claude-code-2.1.195.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "./support/wave2-modules.js";

interface BuildRedactedEvidenceInput {
  readonly profile: ClaudeCodeProtocolProfile;
  readonly request: ClaudeCodeRequestInput;
  readonly modelFamily: "haiku" | "sonnet" | "opus";
  readonly logicalHeaders: readonly HeaderPair[];
  readonly betaFeatures: readonly string[];
  readonly body: string;
}

type BuildRedactedEvidence = (
  input: BuildRedactedEvidenceInput,
) => Promise<RedactedRequestEvidence>;
type ToSafeErrorDetails = (
  value: unknown,
) => Readonly<Record<string, string | number | boolean>>;

const SENTINEL = "sk-ant-oat01-SENTINEL-DO-NOT-LEAK";
const EVIDENCE_KEYS = [
  "profileId",
  "url",
  "method",
  "modelFamily",
  "logicalHeaderNames",
  "betaFeatures",
  "bodySha256",
  "bodyByteLength",
  "messageCount",
  "systemBlockCount",
  "capabilityDecisions",
] as const satisfies readonly (keyof RedactedRequestEvidence)[];

function requestWith(value: JsonValue): ClaudeCodeRequestInput {
  return {
    accessToken: SENTINEL,
    model: "claude-opus-4-8",
    maxTokens: 256,
    messages: [
      { role: "user", content: `message-${SENTINEL}` },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "synthetic-tool-use",
            name: "synthetic_tool",
            input: {
              direct: SENTINEL,
              nested: { secret: SENTINEL, value },
              array: [SENTINEL, { deeper: SENTINEL }],
            },
          },
        ],
      },
    ],
    system: [{ type: "text", text: `system-${SENTINEL}` }],
    tools: [
      {
        name: "synthetic_tool",
        input_schema: { description: SENTINEL },
      },
    ],
    runtime: {
      sessionId: "session-synthetic",
      deviceId: "device-synthetic",
      accountUuid: "account-synthetic",
      runtime: "node",
      runtimeVersion: "22.0.0",
      os: "Windows",
      arch: "x64",
    },
    metadata: { sentinel: SENTINEL },
  };
}

function evidenceInput(
  value: JsonValue = SENTINEL,
): BuildRedactedEvidenceInput {
  return {
    profile: CLAUDE_CODE_2_1_195_PROFILE,
    request: requestWith(value),
    modelFamily: "opus",
    logicalHeaders: [
      ["authorization", `Bearer ${SENTINEL}`],
      ["x-synthetic", SENTINEL],
    ],
    betaFeatures: ["oauth-2025-04-20"],
    body: JSON.stringify({ sentinel: SENTINEL, nested: [SENTINEL] }),
  };
}

function nestedValue(depth: number): JsonValue {
  let value: JsonValue = SENTINEL;
  for (let index = 0; index < depth; index += 1) value = { nested: value };
  return value;
}

describe("redaction (Wave 1 RED specification)", () => {
  it("the Wave 2 module is implemented", async () => {
    expect(await expectModuleUnimplemented("redaction")).toBe(false);
  });

  it("never emits a token from any raw input position", async () => {
    const buildRedactedEvidence =
      await loadWave2Function<BuildRedactedEvidence>(
        "redaction",
        "buildRedactedEvidence",
      );

    const evidence = await buildRedactedEvidence(evidenceInput());
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).not.toContain("sk-ant-");
  });

  it.each(["Bearer", "bearer", "BEARER"])(
    "redacts the %s authorization scheme variant",
    async (scheme) => {
      const buildRedactedEvidence =
        await loadWave2Function<BuildRedactedEvidence>(
          "redaction",
          "buildRedactedEvidence",
        );
      const input = evidenceInput();
      const withVariant: BuildRedactedEvidenceInput = {
        ...input,
        logicalHeaders: [["authorization", `${scheme} ${SENTINEL}`]],
      };

      expect(
        JSON.stringify(await buildRedactedEvidence(withVariant)),
      ).not.toContain(SENTINEL);
    },
  );

  it("rejects cyclic input without recursing indefinitely", async () => {
    const buildRedactedEvidence =
      await loadWave2Function<BuildRedactedEvidence>(
        "redaction",
        "buildRedactedEvidence",
      );
    const cyclic = evidenceInput();
    Object.defineProperty(cyclic, "cycle", { enumerable: true, value: cyclic });

    await expect(
      Reflect.apply(buildRedactedEvidence, undefined, [cyclic]),
    ).rejects.toMatchObject({ code: "CYCLIC_INPUT" });
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects prototype-polluting key %s",
    async (key) => {
      const buildRedactedEvidence =
        await loadWave2Function<BuildRedactedEvidence>(
          "redaction",
          "buildRedactedEvidence",
        );
      const polluted = evidenceInput();
      Object.defineProperty(polluted.request.metadata, key, {
        enumerable: true,
        value: SENTINEL,
      });

      await expect(buildRedactedEvidence(polluted)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    },
  );

  it("rejects excessive nesting depth", async () => {
    const buildRedactedEvidence =
      await loadWave2Function<BuildRedactedEvidence>(
        "redaction",
        "buildRedactedEvidence",
      );

    await expect(
      buildRedactedEvidence(evidenceInput(nestedValue(200))),
    ).rejects.toMatchObject({ code: "INPUT_TOO_DEEP" });
  });

  it("rejects excessive aggregate size", async () => {
    const buildRedactedEvidence =
      await loadWave2Function<BuildRedactedEvidence>(
        "redaction",
        "buildRedactedEvidence",
      );

    await expect(
      buildRedactedEvidence(evidenceInput("x".repeat(2_000_000))),
    ).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
  });

  it("returns frozen deny-by-default evidence containing only derived values", async () => {
    const buildRedactedEvidence =
      await loadWave2Function<BuildRedactedEvidence>(
        "redaction",
        "buildRedactedEvidence",
      );

    const evidence = await buildRedactedEvidence(evidenceInput());
    expect(Object.keys(evidence).sort()).toEqual([...EVIDENCE_KEYS].sort());
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(evidence.bodySha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.logicalHeaderNames).toEqual([
      "authorization",
      "x-synthetic",
    ]);
    expect(JSON.stringify(evidence)).not.toContain(SENTINEL);
  });

  it("converts unknown errors to frozen primitive-only safe details", async () => {
    const toSafeErrorDetails = await loadWave2Function<ToSafeErrorDetails>(
      "redaction",
      "toSafeErrorDetails",
    );
    const details = toSafeErrorDetails({
      message: SENTINEL,
      authorization: `Bearer ${SENTINEL}`,
      nested: { secret: SENTINEL },
    });

    expect(Object.isFrozen(details)).toBe(true);
    expect(JSON.stringify(details)).not.toContain(SENTINEL);
    expect(JSON.stringify(details)).not.toContain("sk-ant-");
    for (const value of Object.values(details)) {
      expect(["string", "number", "boolean"]).toContain(typeof value);
    }
  });
});
