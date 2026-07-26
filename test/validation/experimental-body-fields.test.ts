// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { buildClaudeCodeRequest } from "../../src/build-request.js";
import type {
  ClaudeCodeRequestInput,
  ClaudeCodeWireErrorCode,
} from "../../src/contracts.js";
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
const PUBLIC_INPUT = {
  accessToken: "sentinel-token-experimental-body",
  ...BASE_INPUT,
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
} satisfies ClaudeCodeRequestInput;

function build(input: unknown): Readonly<Record<string, unknown>> {
  return buildCanonicalBody(input, RESOLVED_MODEL, [], {});
}

function expectCode(operation: () => unknown, code: ClaudeCodeWireErrorCode) {
  expect(operation).toThrow(expect.objectContaining({ code }));
}

function nestedValue(depth: number): unknown {
  let value: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) value = { child: value };
  return value;
}

describe("experimental body fields", () => {
  it("appends scalar, null, array, and nested fields in recursive caller order", () => {
    const result = build({
      ...BASE_INPUT,
      experimentalBodyFields: {
        scalar_beta: "value",
        nullable_beta: null,
        array_beta: [3, { z: true, a: false }, 1],
        object_beta: { third: 3, first: 1, second: { y: 2, x: 1 } },
      },
    });

    expect(Object.keys(result)).toEqual([
      "model",
      "max_tokens",
      "system",
      "messages",
      "temperature",
      "metadata",
      "scalar_beta",
      "nullable_beta",
      "array_beta",
      "object_beta",
    ]);
    expect(result).toMatchObject({
      scalar_beta: "value",
      nullable_beta: null,
      array_beta: [3, { z: true, a: false }, 1],
      object_beta: { third: 3, first: 1, second: { y: 2, x: 1 } },
    });
    expect(Object.keys(result["object_beta"] as object)).toEqual([
      "third",
      "first",
      "second",
    ]);
    expect(
      Object.keys(
        (result["object_beta"] as Record<string, unknown>)["second"] as object,
      ),
    ).toEqual(["y", "x"]);
  });

  it.each([
    "model",
    "max_tokens",
    "system",
    "messages",
    "temperature",
    "metadata",
  ])("rejects collision with always-emitted body key %s", (key) => {
    expectCode(
      () =>
        build({
          ...BASE_INPUT,
          experimentalBodyFields: { [key]: "collision" },
        }),
      "INVALID_INPUT",
    );
  });

  it("checks collisions against conditionally emitted wire keys", () => {
    const tool = { name: "inspect", input_schema: {} };
    expectCode(
      () =>
        build({
          ...BASE_INPUT,
          tools: [tool],
          experimentalBodyFields: { tools: [tool] },
        }),
      "INVALID_INPUT",
    );
    expect(
      build({ ...BASE_INPUT, experimentalBodyFields: { top_p: 0.75 } }),
    ).toHaveProperty("top_p", 0.75);
    expect(
      build({ ...BASE_INPUT, experimentalBodyFields: { novel_beta: true } }),
    ).toHaveProperty("novel_beta", true);
  });

  it("rejects equal-value and null-value collisions", () => {
    expectCode(
      () =>
        build({
          ...BASE_INPUT,
          experimentalBodyFields: { model: MODEL_ID },
        }),
      "INVALID_INPUT",
    );
    expectCode(
      () =>
        build({
          ...BASE_INPUT,
          contextManagement: null,
          experimentalBodyFields: { context_management: null },
        }),
      "INVALID_INPUT",
    );
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects forbidden extension key %s",
    (key) => {
      const fields = Object.defineProperty({}, key, {
        enumerable: true,
        value: "unsafe",
      });
      expectCode(
        () => build({ ...BASE_INPUT, experimentalBodyFields: fields }),
        "INVALID_INPUT",
      );
    },
  );

  it("retains graph and JSON validation failures", () => {
    const withSymbol = { safe: true, [Symbol("unsafe")]: true };
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    const sparse = new Array<unknown>(2);
    sparse[0] = "present";
    const accessor = Object.defineProperty({}, "secret", {
      enumerable: true,
      get: () => "must not run",
    });

    for (const value of [withSymbol, accessor, { value: Number.NaN }, sparse]) {
      expectCode(
        () =>
          build({ ...BASE_INPUT, experimentalBodyFields: { novel: value } }),
        "INVALID_INPUT",
      );
    }
    expectCode(
      () => build({ ...BASE_INPUT, experimentalBodyFields: { novel: cyclic } }),
      "CYCLIC_INPUT",
    );
    expectCode(
      () =>
        build({
          ...BASE_INPUT,
          experimentalBodyFields: { novel: "invalid\ud800text" },
        }),
      "INVALID_UNICODE",
    );
    expectCode(
      () =>
        build({
          ...BASE_INPUT,
          experimentalBodyFields: { novel: nestedValue(101) },
        }),
      "INPUT_TOO_DEEP",
    );
    expectCode(
      () =>
        build({
          ...BASE_INPUT,
          experimentalBodyFields: { novel: "x".repeat(1_000_001) },
        }),
      "INPUT_TOO_LARGE",
    );
  });

  it("does not alter headers or bypass known-field validation", async () => {
    const baseline = await buildClaudeCodeRequest(PUBLIC_INPUT);
    const extended = await buildClaudeCodeRequest({
      ...PUBLIC_INPUT,
      experimentalBodyFields: {
        headers: [["authorization", "attacker-controlled"]],
      },
    });
    expect(extended.headers).toEqual(baseline.headers);
    expect(JSON.parse(extended.body)).toHaveProperty("headers", [
      ["authorization", "attacker-controlled"],
    ]);

    await expect(
      buildClaudeCodeRequest({
        ...PUBLIC_INPUT,
        tools: [{ name: "inspect", input_schema: {}, unknown: true }],
        experimentalBodyFields: { novel_beta: true },
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
