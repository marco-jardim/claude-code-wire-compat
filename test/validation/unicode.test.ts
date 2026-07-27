// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { classifySurrogateAt } from "../../src/unicode.js";

describe("classifySurrogateAt", () => {
  it.each([
    ["ASCII", "a", 0],
    ["the code unit below the surrogate range", "\ud7ff", 0],
    ["the code unit above the surrogate range", "\ue000", 0],
  ])("reports %s as a non-surrogate", (_label, value, index) => {
    expect(classifySurrogateAt(value, index)).toBe("notSurrogate");
  });

  it("reports an index past the end of the string as a non-surrogate", () => {
    expect(classifySurrogateAt("a", 5)).toBe("notSurrogate");
  });

  it.each([
    ["minimum", "\ud800\udc00"],
    ["maximum", "\udbff\udfff"],
  ])("reports the %s surrogate pair", (_label, value) => {
    expect(classifySurrogateAt(value, 0)).toBe("surrogatePair");
  });

  it.each([
    ["a trailing high surrogate", "\ud800", 0],
    ["a trailing maximum high surrogate", "\udbff", 0],
    ["a high surrogate followed by ASCII", "\ud800a", 0],
    ["a high surrogate followed above the low range", "\ud800\ue000", 0],
    ["a high surrogate followed below the low range", "\ud800\udbff", 0],
    ["an unpaired minimum low surrogate", "\udc00", 0],
    ["an unpaired maximum low surrogate", "\udfff", 0],
    ["the low surrogate of a pair inspected alone", "\ud800\udc00", 1],
  ])("reports %s as a lone surrogate", (_label, value, index) => {
    expect(classifySurrogateAt(value, index)).toBe("loneSurrogate");
  });
});
