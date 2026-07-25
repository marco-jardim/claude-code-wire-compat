// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wave 1 RED specification for the metadata module.
 *
 * Wave 2 exports expected:
 * - `validateRuntimeIdentity(identity: ClaudeCodeRuntimeIdentity): void`
 * - `buildCorrelatedMetadata(identity: ClaudeCodeRuntimeIdentity, supplied?: Readonly<Record<string, string>>): Readonly<Record<string, string>>`
 */

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRuntimeIdentity } from "../src/contracts.js";
import {
  expectModuleUnimplemented,
  loadWave2Function,
} from "./support/wave2-modules.js";

type ValidateRuntimeIdentity = (identity: ClaudeCodeRuntimeIdentity) => void;
type BuildCorrelatedMetadata = (
  identity: ClaudeCodeRuntimeIdentity,
  supplied?: Readonly<Record<string, string>>,
) => Readonly<Record<string, string>>;

const IDENTITY: ClaudeCodeRuntimeIdentity = {
  sessionId: "session-synthetic-01",
  deviceId: "device-synthetic-02",
  accountUuid: "account-synthetic-03",
  runtime: "node",
  runtimeVersion: "22.0.0",
  os: "Windows",
  arch: "x64",
};

function invalidIdentity(
  property: keyof ClaudeCodeRuntimeIdentity,
  value: unknown,
): object {
  return { ...IDENTITY, [property]: value };
}

describe("metadata (Wave 1 RED specification)", () => {
  it("the Wave 2 module is implemented", async () => {
    expect(await expectModuleUnimplemented("metadata")).toBe(false);
  });

  it("builds user_id with exact key names, values, and order", async () => {
    const buildCorrelatedMetadata =
      await loadWave2Function<BuildCorrelatedMetadata>(
        "metadata",
        "buildCorrelatedMetadata",
      );

    const metadata = buildCorrelatedMetadata(IDENTITY, { trace: "synthetic" });
    expect(metadata["user_id"]).toBe(
      JSON.stringify({
        device_id: IDENTITY.deviceId,
        account_uuid: IDENTITY.accountUuid,
        session_id: IDENTITY.sessionId,
      }),
    );
    expect(metadata["trace"]).toBe("synthetic");
  });

  it.each(["", " ", "\t\r\n"])(
    "rejects blank identity ids %j",
    async (value) => {
      const validateRuntimeIdentity =
        await loadWave2Function<ValidateRuntimeIdentity>(
          "metadata",
          "validateRuntimeIdentity",
        );

      for (const property of [
        "sessionId",
        "deviceId",
        "accountUuid",
      ] as const) {
        expect(() => {
          Reflect.apply(validateRuntimeIdentity, undefined, [
            invalidIdentity(property, value),
          ]);
        }).toThrow(expect.objectContaining({ code: "INVALID_IDENTITY" }));
      }
    },
  );

  it.each(["\u0000", "\u0001", "\r", "\n", "safe\u007funsafe"])(
    "rejects control characters in ids %j",
    async (fragment) => {
      const validateRuntimeIdentity =
        await loadWave2Function<ValidateRuntimeIdentity>(
          "metadata",
          "validateRuntimeIdentity",
        );
      expect(() => {
        Reflect.apply(validateRuntimeIdentity, undefined, [
          invalidIdentity("sessionId", `before${fragment}after`),
        ]);
      }).toThrow(expect.objectContaining({ code: "INVALID_IDENTITY" }));
    },
  );

  it("rejects oversized ids", async () => {
    const validateRuntimeIdentity =
      await loadWave2Function<ValidateRuntimeIdentity>(
        "metadata",
        "validateRuntimeIdentity",
      );
    expect(() => {
      Reflect.apply(validateRuntimeIdentity, undefined, [
        invalidIdentity("accountUuid", "x".repeat(8193)),
      ]);
    }).toThrow(expect.objectContaining({ code: "INVALID_IDENTITY" }));
  });

  it.each([
    ["runtime", "deno"],
    ["os", "FreeBSD"],
  ] as const)("rejects unsupported %s values", async (property, value) => {
    const validateRuntimeIdentity =
      await loadWave2Function<ValidateRuntimeIdentity>(
        "metadata",
        "validateRuntimeIdentity",
      );
    expect(() => {
      Reflect.apply(validateRuntimeIdentity, undefined, [
        invalidIdentity(property, value),
      ]);
    }).toThrow(expect.objectContaining({ code: "INVALID_IDENTITY" }));
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects prototype-polluting supplied key %s",
    async (key) => {
      const buildCorrelatedMetadata =
        await loadWave2Function<BuildCorrelatedMetadata>(
          "metadata",
          "buildCorrelatedMetadata",
        );
      const supplied = Object.defineProperty({}, key, {
        enumerable: true,
        value: "pollution-sentinel",
      });

      expect(() => buildCorrelatedMetadata(IDENTITY, supplied)).toThrow(
        expect.objectContaining({ code: "INVALID_INPUT" }),
      );
    },
  );

  it.each(["user_id", "device_id", "account_uuid", "session_id"])(
    "rejects conflicting supplied correlation key %s",
    async (key) => {
      const buildCorrelatedMetadata =
        await loadWave2Function<BuildCorrelatedMetadata>(
          "metadata",
          "buildCorrelatedMetadata",
        );

      expect(() =>
        buildCorrelatedMetadata(IDENTITY, { [key]: "disagrees" }),
      ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
    },
  );

  it("freezes its result, preserves the identity, and never derives ids", async () => {
    const buildCorrelatedMetadata =
      await loadWave2Function<BuildCorrelatedMetadata>(
        "metadata",
        "buildCorrelatedMetadata",
      );
    const before = JSON.stringify(IDENTITY);

    const first = buildCorrelatedMetadata(IDENTITY);
    const second = buildCorrelatedMetadata(IDENTITY);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first).toEqual(second);
    expect(Object.keys(first)).toEqual(["user_id"]);
    expect(JSON.stringify(IDENTITY)).toBe(before);
  });
});
