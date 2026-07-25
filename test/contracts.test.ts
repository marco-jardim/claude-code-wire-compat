// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  ClaudeCodeWireError,
  type ClaudeCodeWireErrorCode,
} from "../src/contracts.js";

const ERROR_CODES = [
  "INVALID_INPUT",
  "INVALID_IDENTITY",
  "UNSUPPORTED_MODEL",
  "UNSUPPORTED_CAPABILITY",
  "INVALID_THINKING",
  "INVALID_EFFORT",
  "FORBIDDEN_HEADER",
  "DUPLICATE_HEADER",
  "HEADER_INJECTION",
  "INVALID_UNICODE",
  "INPUT_TOO_DEEP",
  "INPUT_TOO_LARGE",
  "CYCLIC_INPUT",
  "CRYPTO_UNAVAILABLE",
  "REDACTION_FAILURE",
] as const satisfies readonly ClaudeCodeWireErrorCode[];

function constructWithInvalidDetail(value: unknown): void {
  Reflect.construct(ClaudeCodeWireError, ["INVALID_INPUT", { invalid: value }]);
}

describe("ClaudeCodeWireError", () => {
  it.each(ERROR_CODES)("constructs and serializes %s", (code) => {
    const error = new ClaudeCodeWireError(code, { attempt: 3 });

    expect(error.toJSON()).toEqual({
      name: "ClaudeCodeWireError",
      code,
      safeDetails: { attempt: 3 },
    });
  });

  it("freezes a copy of safeDetails", () => {
    const details = { field: "model" };
    const error = new ClaudeCodeWireError("INVALID_INPUT", details);

    expect(Reflect.set(error.safeDetails, "field", "changed")).toBe(false);
    expect(error.safeDetails["field"]).toBe("model");
    expect(Object.isFrozen(error.safeDetails)).toBe(true);
  });

  it.each([
    { nested: true },
    ["nested"],
    () => "nested",
    undefined,
    null,
    Symbol("nested"),
  ])("rejects the non-primitive detail value %#", (value) => {
    expect(() => {
      constructWithInvalidDetail(value);
    }).toThrow(TypeError);
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects the prototype-polluting key %s",
    (key) => {
      const details = Object.defineProperty({}, key, {
        enumerable: true,
        value: "sentinel",
      });

      expect(() =>
        Reflect.construct(ClaudeCodeWireError, ["INVALID_INPUT", details]),
      ).toThrow(TypeError);
    },
  );

  it("uses an empty frozen object by default", () => {
    const error = new ClaudeCodeWireError("INVALID_INPUT");

    expect(error.safeDetails).toEqual({});
    expect(Object.isFrozen(error.safeDetails)).toBe(true);
  });

  it("does not include detail values in its message", () => {
    const sentinel = "distinctive-secret-detail-7f31";
    const error = new ClaudeCodeWireError("INVALID_INPUT", {
      detail: sentinel,
    });

    expect(error.message).not.toContain(sentinel);
  });

  it("serializes only the safe public fields", () => {
    const error = new ClaudeCodeWireError("INVALID_INPUT", { field: "model" });
    const json = error.toJSON();

    expect(Object.keys(json)).toEqual(["name", "code", "safeDetails"]);
    expect(json).not.toHaveProperty("stack");
    expect(json).not.toHaveProperty("message");
    expect(json).not.toHaveProperty("cause");
  });

  it("retains native and custom error prototypes", () => {
    const error = new ClaudeCodeWireError("INVALID_INPUT");

    expect(error).toBeInstanceOf(ClaudeCodeWireError);
    expect(error).toBeInstanceOf(Error);
  });

  it("does not include a stack in JSON.stringify output", () => {
    const serialized = JSON.stringify(new ClaudeCodeWireError("INVALID_INPUT"));

    expect(serialized).not.toContain("stack");
  });
});
