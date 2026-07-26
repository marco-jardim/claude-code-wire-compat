// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/contracts.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
import { buildCanonicalBody } from "../../src/request-body.js";

const MODEL_ID = "claude-opus-4-8";
const MODEL_DEFINITION = CLAUDE_CODE_2_1_195_PROFILE.supportedModels[MODEL_ID];
if (MODEL_DEFINITION === undefined)
  throw new Error("Missing test model profile.");
const RESOLVED_MODEL = { id: MODEL_ID, ...MODEL_DEFINITION };
const BASE_INPUT = {
  model: MODEL_ID,
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello" }],
};

function build(metadata: unknown): Readonly<Record<string, unknown>> {
  return buildCanonicalBody(BASE_INPUT, RESOLVED_MODEL, [], metadata);
}

describe("metadata contract expansion", () => {
  it("accepts nested object and array values in the public input type", () => {
    const input = {
      accessToken: "sentinel-token-metadata-expansion",
      model: MODEL_ID,
      maxTokens: 1024,
      messages: [{ role: "user", content: "hello" }],
      runtime: {
        sessionId: "00000000-0000-4000-8000-000000000001",
        deviceId:
          "0000000000000000000000000000000000000000000000000000000000000002",
        accountUuid: "00000000-0000-4000-8000-000000000000",
        runtime: "node",
        runtimeVersion: "22.0.0",
        os: "Linux",
        arch: "x64",
      },
      clientRequestId: "request",
      metadata: {
        nested: { z: true, a: [null, "text", 7] },
        list: [{ inner: false }],
      },
    } satisfies ClaudeCodeRequestInput;

    expect(input.metadata.nested).toEqual({ z: true, a: [null, "text", 7] });
  });

  it("serializes nested metadata recursively in caller insertion order", () => {
    const result = build({
      z: { third: 3, first: 1, second: [{ beta: 2, alpha: 1 }] },
      a: [null, true, { last: "z", first: "a" }],
    });
    const metadata = result["metadata"] as Record<string, unknown>;
    const nested = metadata["z"] as Record<string, unknown>;
    const nestedArray = nested["second"] as readonly Record<string, unknown>[];

    expect(Object.keys(metadata)).toEqual(["z", "a"]);
    expect(Object.keys(nested)).toEqual(["third", "first", "second"]);
    expect(Object.keys(nestedArray[0] ?? {})).toEqual(["beta", "alpha"]);
    expect(JSON.stringify(metadata)).toBe(
      '{"z":{"third":3,"first":1,"second":[{"beta":2,"alpha":1}]},"a":[null,true,{"last":"z","first":"a"}]}',
    );
  });

  it("preserves string and explicit-null user_id values", () => {
    expect(build({ user_id: "correlated-user" })["metadata"]).toEqual({
      user_id: "correlated-user",
    });
    expect(build({ user_id: null })["metadata"]).toEqual({ user_id: null });
  });

  it.each([0, false, [], {}, ["not-a-user-id"]])(
    "rejects non-string, non-null user_id value %#",
    (user_id) => {
      expect(() => build({ user_id })).toThrow(
        expect.objectContaining({ code: "INVALID_INPUT" }),
      );
    },
  );

  it("retains existing failure codes for cyclic and non-JSON nested metadata", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;

    expect(() => build({ nested: cyclic })).toThrow(
      expect.objectContaining({ code: "CYCLIC_INPUT" }),
    );
    expect(() => build({ nested: { invalid: Symbol("invalid") } })).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });
});
