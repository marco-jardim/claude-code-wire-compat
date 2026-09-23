// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { firstPackResult } from "../../scripts/lib/pack-json.mjs";

describe("firstPackResult", () => {
  it("reads the npm 11 and earlier array shape", () => {
    expect(firstPackResult('[{"filename":"a.tgz","files":[]}]')).toEqual({
      filename: "a.tgz",
      files: [],
    });
  });

  it("returns undefined for an empty array", () => {
    expect(firstPackResult("[]")).toBeUndefined();
  });

  it("reads the npm 12 object shape keyed by package name", () => {
    expect(
      firstPackResult('{"@scope/name":{"filename":"a.tgz","files":[]}}'),
    ).toEqual({ filename: "a.tgz", files: [] });
  });

  it("returns undefined for an empty object", () => {
    expect(firstPackResult("{}")).toBeUndefined();
  });

  it("returns a flat single-result object itself, not its first property", () => {
    expect(firstPackResult('{"filename":"a.tgz","files":[]}')).toEqual({
      filename: "a.tgz",
      files: [],
    });
  });

  it("returns undefined for null", () => {
    expect(firstPackResult("null")).toBeUndefined();
  });

  it("returns undefined for a bare number", () => {
    expect(firstPackResult("1")).toBeUndefined();
  });

  it("returns undefined for a bare string", () => {
    expect(firstPackResult('"x"')).toBeUndefined();
  });
});
