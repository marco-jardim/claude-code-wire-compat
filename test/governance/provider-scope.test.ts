// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

/*
 * This package models the wire of the official Claude Code client talking to
 * `api.anthropic.com` and nothing else. Bedrock, Vertex, Foundry, Mantle and
 * `anthropicAws` are permanently out of scope (`docs/source-trace.md`,
 * governance ledgers L14 and L20).
 *
 * Until this file existed, that decision was enforced by exactly two things: a
 * compile-time literal type (`readonly provider: "anthropic"`) and a paragraph
 * of prose. Widen the literal to a union and the type gate evaporates silently
 * — no test in `test/governance/` noticed. This file turns the decision into a
 * SOURCE-level invariant so the surface cannot grow by accident.
 *
 * The hard part is distinguishing MENTION from BRANCH. Reverse-engineering
 * notes about how the upstream client treats other providers are legitimate
 * and must stay: `src/model-capabilities.ts` documents `l_(e) === "foundry"`
 * verbatim, comparison operator and all, inside a comment. A naive text scan
 * would fail on that today. So the scan runs over COMMENT-STRIPPED source, and
 * the one surviving reference identifier carries a mandatory justification.
 */

const SRC_DIR = new URL("../../src/", import.meta.url);
const TRACE_DOC = new URL("../../docs/source-trace.md", import.meta.url);

const MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages?beta=true";
const COUNT_TOKENS_ENDPOINT =
  "https://api.anthropic.com/v1/messages/count_tokens?beta=true";

/** The upstream provider discriminants this package refuses to model. */
const FOREIGN_PROVIDERS = [
  "bedrock",
  "vertex",
  "foundry",
  "anthropicAws",
  "mantle",
] as const;

/**
 * Identifiers that name a foreign provider yet are NOT multi-provider surface.
 *
 * Every entry carries a mandatory justification, and `no stale allowlist entry`
 * below deletes the loophole of a justification outliving the code it excuses:
 * an entry that no longer matches anything in `src/` fails the suite.
 */
const REFERENCE_IDENTIFIERS: ReadonlyMap<string, string> = new Map([
  [
    "BEDROCK_UNSUPPORTED_BETAS",
    "Static reference data, not a selectable branch. It is a frozen Set of " +
      "beta headers transcribed from upstream `S2r`, exported for documentary " +
      "value and consumed by NOTHING in `src/` — there is no call site, so no " +
      "provider can select it. Removing it would delete reverse-engineering " +
      "knowledge; keeping it costs no runtime surface.",
  ],
]);

/**
 * Replaces the contents of `//` and block comments with nothing, preserving
 * string and template literals verbatim.
 *
 * String literals must survive because a real provider branch is spelled with
 * one (`provider === "bedrock"`, `case "bedrock":`). Comments must not survive
 * because that is precisely where the legitimate upstream notes live.
 */
function stripComments(text: string): string {
  let out = "";
  let index = 0;

  // `charAt` is used throughout rather than index access: it is typed `string`
  // and returns "" past the end, so every branch below narrows without a cast.
  while (index < text.length) {
    const char = text.charAt(index);
    const next = text.charAt(index + 1);

    if (char === '"' || char === "'" || char === "`") {
      out += char;
      index += 1;
      while (index < text.length) {
        const inner = text.charAt(index);
        if (inner === "\\") {
          out += text.slice(index, index + 2);
          index += 2;
          continue;
        }
        out += inner;
        index += 1;
        if (inner === char) break;
        // An unterminated quote cannot span a line; bail rather than eat the file.
        if (char !== "`" && inner === "\n") break;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < text.length && text.charAt(index) !== "\n") index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (
        index < text.length &&
        !(text.charAt(index) === "*" && text.charAt(index + 1) === "/")
      ) {
        index += 1;
      }
      index += 2;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

function sourceFiles(directory: URL): readonly URL[] {
  const files: URL[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory())
      files.push(...sourceFiles(new URL(`${entry.name}/`, directory)));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(url);
  }
  return files;
}

interface SourceFile {
  readonly path: string;
  readonly raw: string;
  readonly code: string;
}

const SOURCES: readonly SourceFile[] = sourceFiles(SRC_DIR).map((url) => {
  const raw = readFileSync(url, "utf8");
  return {
    path: url.href.slice(SRC_DIR.href.length),
    raw,
    code: stripComments(raw),
  };
});

function read(relativePath: string): SourceFile {
  const file = SOURCES.find((candidate) => candidate.path === relativePath);
  if (file === undefined) {
    throw new Error(`src/${relativePath} does not exist`);
  }
  return file;
}

/** A string literal whose entire content is a foreign provider discriminant. */
const FOREIGN_PROVIDER_LITERAL = new RegExp(
  `(["'\`])(?:${FOREIGN_PROVIDERS.join("|")})\\1`,
  "giu",
);

/** `provider` compared against any string literal that is not `"anthropic"`. */
const PROVIDER_COMPARISON =
  /\bprovider\b\s*(?:===|!==|==|!=)\s*(["'`])([^"'`]*)\1|(["'`])([^"'`]*)\3\s*(?:===|!==|==|!=)\s*\bprovider\b/giu;

const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/gu;

function foreignIdentifiers(code: string): readonly string[] {
  return [...new Set(code.match(IDENTIFIER) ?? [])].filter((identifier) => {
    const lowered = identifier.toLowerCase();
    return FOREIGN_PROVIDERS.some((provider) =>
      lowered.includes(provider.toLowerCase()),
    );
  });
}

describe("provider scope: anthropic first-party only", () => {
  it("has sources to enforce", () => {
    expect(SOURCES.length).toBeGreaterThan(0);
  });

  it("keeps the comment stripper strict enough to matter", () => {
    // Comments die, including the ones that quote upstream provider branches.
    expect(stripComments('// l_(e) === "foundry"\nconst a = 1;')).not.toMatch(
      /foundry/u,
    );
    expect(
      stripComments("/* provider is firstParty|anthropicAws */\nconst a = 1;"),
    ).not.toMatch(/anthropicAws/u);
    expect(stripComments("const a = 1; // trailing")).toBe("const a = 1; ");

    // Code survives, and so do the string literals a real branch is built from.
    expect(stripComments('const p = "bedrock";')).toMatch(/"bedrock"/u);
    expect(stripComments('if (p === "vertex") {}')).toMatch(/"vertex"/u);

    // A `//` inside a string is not a comment: the pinned endpoints must not
    // be truncated by the stripper, or the scan would go blind mid-line.
    expect(
      stripComments(`const u = "${MESSAGES_ENDPOINT}"; const v = 1;`),
    ).toBe(`const u = "${MESSAGES_ENDPOINT}"; const v = 1;`);
    expect(stripComments('const s = "/* not a comment */"; const v = 1;')).toBe(
      'const s = "/* not a comment */"; const v = 1;',
    );
    expect(
      stripComments('const s = "\\" // still a string"; const v = 1;'),
    ).toBe('const s = "\\" // still a string"; const v = 1;');
  });

  it("strips real comments without eating real code", () => {
    const registry = read("beta-registry.ts");
    // The comment above the constant is gone...
    expect(registry.raw).toContain("Reserved for later work packages");
    expect(registry.code).not.toContain("Reserved for later work packages");
    // ...while the declaration it documents is untouched.
    expect(registry.code).toContain("BEDROCK_UNSUPPORTED_BETAS");

    const capabilities = read("model-capabilities.ts");
    expect(capabilities.raw).toContain("foundry");
    expect(capabilities.code).not.toMatch(/foundry/iu);
  });

  it("declares `provider` as the literal type `anthropic`", () => {
    const contracts = read("contracts.ts");
    const declarations = contracts.code.match(/readonly provider\s*:[^;]*;/gu);

    expect(declarations).not.toBeNull();
    expect(declarations).toEqual(['readonly provider: "anthropic";']);

    for (const declaration of declarations ?? []) {
      // Not a union, not widened to `string`, not optional.
      expect(declaration).not.toMatch(/\|/u);
      expect(declaration).not.toMatch(/\bstring\b/u);
      expect(declaration).not.toMatch(/\?\s*:/u);
    }
  });

  it("pins the profile to the anthropic first-party literal", () => {
    const profile = read("profiles/claude-code-2.1.195.ts");
    // Capture the assigned value rather than asserting a negative lookahead:
    // `\s*(?!...)` backtracks to zero width and passes on anything.
    const assignments = profile.code.match(/\bprovider\s*:\s*[^,\n]+/gu);
    expect(assignments).toEqual(['provider: "anthropic"']);
  });

  it("pins both endpoints to api.anthropic.com literally", () => {
    const contracts = read("contracts.ts");
    expect(contracts.code).toContain(`readonly url: "${MESSAGES_ENDPOINT}";`);
    expect(contracts.code).toContain(
      `readonly endpoint: "${MESSAGES_ENDPOINT}";`,
    );
    expect(contracts.code).toContain(
      `readonly url: "${COUNT_TOKENS_ENDPOINT}";`,
    );
    expect(contracts.code).toContain(
      `readonly countTokensEndpoint: "${COUNT_TOKENS_ENDPOINT}";`,
    );

    expect(read("count-tokens.ts").code).toContain(
      `"${COUNT_TOKENS_ENDPOINT}" as const`,
    );
    expect(read("profiles/claude-code-2.1.195.ts").code).toContain(
      `endpoint: "${MESSAGES_ENDPOINT}"`,
    );
    expect(read("redaction.ts").code).toContain(`"${MESSAGES_ENDPOINT}"`);
  });

  it("routes every source URL to api.anthropic.com", () => {
    for (const file of SOURCES) {
      for (const [, host] of file.code.matchAll(
        /https:\/\/([A-Za-z0-9.-]+)/gu,
      )) {
        expect({ file: file.path, host }).toEqual({
          file: file.path,
          host: "api.anthropic.com",
        });
      }
    }
  });

  it("has no foreign-provider string literal anywhere in src", () => {
    for (const file of SOURCES) {
      expect({
        file: file.path,
        literals: file.code.match(FOREIGN_PROVIDER_LITERAL) ?? [],
      }).toEqual({ file: file.path, literals: [] });
    }
  });

  it("has no runtime comparison that branches on provider", () => {
    for (const file of SOURCES) {
      for (const match of file.code.matchAll(PROVIDER_COMPARISON)) {
        const literal = match[2] ?? match[4];
        expect({ file: file.path, literal }).toEqual({
          file: file.path,
          literal: "anthropic",
        });
      }
    }
  });

  it("has no `switch` dispatching on a provider", () => {
    for (const file of SOURCES) {
      expect(file.code).not.toMatch(/\bswitch\s*\([^)]*\bprovider\b/iu);
    }
  });

  it("allows only justified foreign-provider identifiers", () => {
    for (const file of SOURCES) {
      const unexplained = foreignIdentifiers(file.code).filter(
        (identifier) => !REFERENCE_IDENTIFIERS.has(identifier),
      );
      expect({ file: file.path, unexplained }).toEqual({
        file: file.path,
        unexplained: [],
      });
    }
  });

  it("requires a substantive justification for every allowlist entry", () => {
    expect(REFERENCE_IDENTIFIERS.size).toBeGreaterThan(0);
    for (const justification of REFERENCE_IDENTIFIERS.values()) {
      expect(justification.trim().length).toBeGreaterThan(80);
    }
  });

  it("carries no stale allowlist entry", () => {
    const present = new Set(
      SOURCES.flatMap((file) => foreignIdentifiers(file.code)),
    );
    for (const identifier of REFERENCE_IDENTIFIERS.keys()) {
      expect({ identifier, present: present.has(identifier) }).toEqual({
        identifier,
        present: true,
      });
    }
  });

  it("keeps `BEDROCK_UNSUPPORTED_BETAS` inert: declared, never consumed", () => {
    /*
     * The allowlist entry above is only honest while the constant stays a leaf.
     * The declaration is its single occurrence in `src/`; a second one would
     * mean something now reads it, which is the branch this file forbids.
     */
    const occurrences = SOURCES.flatMap((file) => [
      ...(file.code.match(/\bBEDROCK_UNSUPPORTED_BETAS\b/gu) ?? []),
    ]);
    expect(occurrences).toHaveLength(1);
    expect(read("beta-registry.ts").code).toMatch(
      /export const BEDROCK_UNSUPPORTED_BETAS\b/u,
    );
  });

  it("keeps the permanent exclusion documented in docs/source-trace.md", () => {
    const trace = readFileSync(TRACE_DOC, "utf8").replace(/\s+/gu, " ");

    expect(trace).toContain(
      "`provider` remains pinned to `anthropic` and Bedrock, Vertex, Foundry and Mantle stay permanently out of scope",
    );
    expect(trace).toContain("### Governance ledger L20");
    expect(trace).toContain("`test/governance/provider-scope.test.ts`");
  });
});
