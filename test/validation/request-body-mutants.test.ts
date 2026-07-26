// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { composeBetas } from "../../src/betas.js";
import { ClaudeCodeWireError } from "../../src/contracts.js";
import type { ClaudeCodeWireErrorCode } from "../../src/contracts.js";
import { resolveModel } from "../../src/models.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "../../src/profiles/claude-code-2.1.195.js";
import { buildCanonicalBody } from "../../src/request-body.js";

const model = {
  id: "m",
  wireId: "m",
  capabilities: {
    contextHint: true,
    adaptiveThinking: true,
    effort: true,
  },
} as const;

const baseInput = () => ({
  maxTokens: 1,
  messages: [{ role: "user", content: "ok" }],
});

function build(
  input: unknown = baseInput(),
  resolvedModel: unknown = model,
  system: unknown = [],
  metadata: unknown = {},
) {
  return buildCanonicalBody(input, resolvedModel, system, metadata);
}

function expectWireCode(action: () => unknown, code: ClaudeCodeWireErrorCode) {
  try {
    action();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ClaudeCodeWireError);
    if (!(error instanceof ClaudeCodeWireError)) throw error;
    expect(error.code).toBe(code);
    return error;
  }
  throw new Error(`Expected ClaudeCodeWireError ${code}`);
}

function expectTypeError(action: () => unknown, message: string) {
  try {
    action();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(TypeError);
    if (!(error instanceof TypeError)) throw error;
    expect(error.message).toBe(message);
    return;
  }
  throw new Error(`Expected TypeError: ${message}`);
}

function nestedValue(depth: number): unknown {
  let value: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) value = { child: value };
  return value;
}

function capabilities(
  overrides: Partial<{
    contextHint: boolean;
    adaptiveThinking: boolean;
    effort: boolean;
    interleavedThinking: boolean;
  }> = {},
) {
  return {
    contextHint: false,
    adaptiveThinking: false,
    effort: false,
    interleavedThinking: false,
    ...overrides,
  };
}

describe("request body inspection mutation boundaries", () => {
  it.each([
    ["nul", "\u0000"],
    ["backspace boundary", "\u0008"],
    ["vertical tab", "\u000b"],
    ["form feed", "\u000c"],
    ["shift out boundary", "\u000e"],
    ["unit separator boundary", "\u001f"],
    ["delete", "\u007f"],
  ])("rejects the %s control character", (_name, content) => {
    expectWireCode(
      () => build({ maxTokens: 1, messages: [{ role: "user", content }] }),
      "INVALID_INPUT",
    );
  });

  it.each(["\u0009", "\u000a", "\u000d", "\u0020", "\u007e"])(
    "accepts the control-character boundary %j",
    (content) => {
      expect(
        build({ maxTokens: 1, messages: [{ role: "user", content }] }),
      ).toMatchObject({ messages: [{ role: "user", content }] });
    },
  );

  it.each([
    ["high surrogate lower boundary", "\ud800"],
    ["high surrogate upper boundary", "\udbff"],
    ["low surrogate lower boundary", "\udc00"],
    ["low surrogate upper boundary", "\udfff"],
    ["high surrogate followed by a non-low surrogate", "\ud800x"],
  ])("rejects an unpaired %s", (_name, content) => {
    expectWireCode(
      () => build({ maxTokens: 1, messages: [{ role: "user", content }] }),
      "INVALID_UNICODE",
    );
  });

  it.each(["\ud800\udc00", "\ud800\udfff", "\udbff\udc00", "\udbff\udfff"])(
    "accepts the paired-surrogate boundary %j",
    (content) => {
      expect(
        build({ maxTokens: 1, messages: [{ role: "user", content }] }),
      ).toMatchObject({ messages: [{ role: "user", content }] });
    },
  );

  it("distinguishes the exact aggregate string-size limit from one over", () => {
    const exactlyAtLimit = "x".repeat(999_912);
    const oneOverLimit = "x".repeat(999_913);

    expect(
      build({
        maxTokens: 1,
        messages: [{ role: "user", content: exactlyAtLimit }],
      }),
    ).toMatchObject({ messages: [{ content: exactlyAtLimit }] });
    expectWireCode(
      () =>
        build({
          maxTokens: 1,
          messages: [{ role: "user", content: oneOverLimit }],
        }),
      "INPUT_TOO_LARGE",
    );
  });

  it("distinguishes the exact nesting limit from one over", () => {
    expect(build(baseInput(), model, [], nestedValue(100))).toHaveProperty(
      "metadata",
    );
    expectWireCode(
      () => build(baseInput(), model, [], nestedValue(101)),
      "INPUT_TOO_DEEP",
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite number %s",
    (value) => {
      expectWireCode(
        () => build(baseInput(), model, [], { value }),
        "INVALID_INPUT",
      );
    },
  );

  it("rejects cyclic input with the specific cyclic-input code", () => {
    const metadata: { self?: unknown } = {};
    metadata.self = metadata;
    expectWireCode(
      () => build(baseInput(), model, [], metadata),
      "CYCLIC_INPUT",
    );
  });

  it("rejects a sparse array rather than silently canonicalizing its hole", () => {
    const messages = new Array<unknown>(1);
    expectWireCode(() => build({ maxTokens: 1, messages }), "INVALID_INPUT");
  });

  it("rejects objects with custom prototypes", () => {
    class CustomMetadata {
      readonly value = "own";
    }
    const metadata = new CustomMetadata();
    expectWireCode(
      () => build(baseInput(), model, [], metadata),
      "INVALID_INPUT",
    );
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects the own forbidden key %s",
    (key) => {
      const metadata = {};
      Object.defineProperty(metadata, key, {
        enumerable: true,
        value: "unsafe",
      });
      expectWireCode(
        () => build(baseInput(), model, [], metadata),
        "INVALID_INPUT",
      );
    },
  );

  it("rejects accessor properties without invoking them", () => {
    let invoked = false;
    const metadata = {};
    Object.defineProperty(metadata, "secret", {
      enumerable: true,
      get() {
        invoked = true;
        return "leak";
      },
    });
    expectWireCode(
      () => build(baseInput(), model, [], metadata),
      "INVALID_INPUT",
    );
    expect(invoked).toBe(false);
  });
});

describe("request body canonicalization mutation boundaries", () => {
  // Wrap each case so Vitest passes array values as one callback argument.
  it.each([[null], [[]], ["not-an-object"]])(
    "rejects a non-record experimental body envelope %#",
    (experimentalBodyFields) => {
      expectWireCode(
        () => build({ ...baseInput(), experimentalBodyFields }),
        "INVALID_INPUT",
      );
    },
  );

  it("clones extension values before appending and freezing them", () => {
    const nested = { second: 2, first: [1, { z: true, a: false }] };
    const result = build({
      ...baseInput(),
      experimentalBodyFields: { future_field: nested },
    });
    const emitted = result["future_field"] as Record<string, unknown>;

    expect(emitted).toEqual(nested);
    expect(emitted).not.toBe(nested);
    expect(Object.keys(emitted)).toEqual(["second", "first"]);
    expect(Object.isFrozen(emitted)).toBe(true);
    expect(Object.isFrozen(nested)).toBe(false);
  });

  it("allows a known wire name only while that field is not emitted", () => {
    expect(
      build({
        ...baseInput(),
        experimentalBodyFields: { tools: [{ future: true }] },
      })["tools"],
    ).toEqual([{ future: true }]);
    expectWireCode(
      () =>
        build({
          ...baseInput(),
          tools: [{ name: "known", input_schema: {} }],
          experimentalBodyFields: { tools: [] },
        }),
      "INVALID_INPUT",
    );
  });

  it("preserves nested JSON key insertion order", () => {
    const result = build(
      {
        ...baseInput(),
        tools: [
          {
            name: "ordered",
            input_schema: {
              z: true,
              nested: { z: "last", a: 7, middle: false },
              list: [{ z: "array-last", a: "array-first" }],
              a: null,
            },
          },
        ],
      },
      model,
      [],
      {
        z: true,
        nested: { z: "last", a: 7, middle: false },
        list: [
          null,
          "text",
          3,
          true,
          false,
          { z: "array-last", a: "array-first" },
        ],
        a: null,
      },
    );
    const metadata = result["metadata"];
    expect(metadata).toEqual({
      z: true,
      nested: { z: "last", a: 7, middle: false },
      list: [
        null,
        "text",
        3,
        true,
        false,
        { z: "array-last", a: "array-first" },
      ],
      a: null,
    });
    expect(Object.keys(metadata as object)).toEqual([
      "z",
      "nested",
      "list",
      "a",
    ]);
    expect(
      Object.keys((metadata as Record<string, unknown>)["nested"] as object),
    ).toEqual(["z", "a", "middle"]);
    expect(
      Object.keys(
        (
          (metadata as Record<string, unknown>)["list"] as unknown[]
        )[5] as object,
      ),
    ).toEqual(["z", "a"]);

    const tools = result["tools"] as readonly Record<string, unknown>[];
    const inputSchema = tools[0]?.["input_schema"];
    expect(Object.keys(inputSchema as object)).toEqual([
      "z",
      "nested",
      "list",
      "a",
    ]);
  });

  it.each(["5m", "1h"])("preserves the accepted cache ttl %s", (ttl) => {
    const result = build({
      maxTokens: 1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "cached",
              cache_control: { type: "ephemeral", ttl },
            },
          ],
        },
      ],
    });
    expect(result["messages"]).toEqual([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "cached",
            cache_control: { type: "ephemeral", ttl },
          },
        ],
      },
    ]);
  });

  it.each(["", "5M", "30m"])("rejects the invalid cache ttl %j", (ttl) => {
    expectWireCode(
      () =>
        build({
          maxTokens: 1,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "cached",
                  cache_control: { type: "ephemeral", ttl },
                },
              ],
            },
          ],
        }),
      "INVALID_INPUT",
    );
  });

  it("rejects a non-tool-result block instead of parsing it as one", () => {
    expectWireCode(
      () =>
        build({
          maxTokens: 1,
          messages: [
            { role: "user", content: [{ type: "unknown", content: "x" }] },
          ],
        }),
      "INVALID_INPUT",
    );
  });

  it("rejects duplicate tool-use ids", () => {
    const toolUse = { type: "tool_use", id: "same", name: "tool", input: {} };
    expectWireCode(
      () =>
        build({
          maxTokens: 1,
          messages: [{ role: "assistant", content: [toolUse, toolUse] }],
        }),
      "INVALID_INPUT",
    );
  });

  it("parses a tool result and verifies its tool-use relationship", () => {
    const input = {
      maxTokens: 1,
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "call-1",
              name: "tool",
              input: { z: 1, a: 2 },
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "call-1",
              content: "done",
              is_error: false,
            },
          ],
        },
      ],
    };
    expect(build(input)["messages"]).toEqual(
      input.messages.map((message) =>
        message.role === "assistant"
          ? {
              ...message,
              content: [{ ...message.content[0], input: { a: 2, z: 1 } }],
            }
          : message,
      ),
    );
  });

  it.each([
    [{ thinking: "yes", adaptiveThinking: true, effort: true }, "thinking"],
    [
      { contextHint: true, adaptiveThinking: "yes", effort: true },
      "adaptiveThinking",
    ],
  ])("rejects a non-boolean model capability (%s)", (badCapabilities) => {
    expectWireCode(
      () =>
        build(baseInput(), {
          id: "m",
          wireId: "m",
          capabilities: badCapabilities,
        }),
      "INVALID_INPUT",
    );
  });

  it("rejects a deliberately mismatched input and resolved model", () => {
    expectWireCode(
      () => build({ ...baseInput(), model: "different" }, model),
      "INVALID_INPUT",
    );
  });
});

describe("request body capability and freeze behavior", () => {
  it("enables context hints only when request and profile enable it", () => {
    const requested = { ...baseInput(), capabilities: { contextHint: true } };
    const enabled = buildCanonicalBody(
      requested,
      model,
      [],
      {},
      { ...CLAUDE_CODE_2_1_195_PROFILE, contextHintEnabled: true },
    );
    expect(enabled["context_hint"]).toEqual({ enabled: true });

    expect(
      buildCanonicalBody(
        baseInput(),
        model,
        [],
        {},
        CLAUDE_CODE_2_1_195_PROFILE,
      ),
    ).not.toHaveProperty("context_hint");
    expect(
      buildCanonicalBody(
        requested,
        {
          ...model,
          capabilities: { ...model.capabilities, contextHint: false },
        },
        [],
        {},
        { ...CLAUDE_CODE_2_1_195_PROFILE, contextHintEnabled: true },
      ),
    ).toHaveProperty("context_hint", { enabled: true });
    expect(build(requested)).not.toHaveProperty("context_hint");
  });

  it("does not mistake malformed or false context-hint requests for true", () => {
    for (const requested of [false, "true", 1, null, {}]) {
      const input = {
        ...baseInput(),
        capabilities: { contextHint: requested },
      };
      const result = buildCanonicalBody(
        input,
        model,
        [],
        {},
        CLAUDE_CODE_2_1_195_PROFILE,
      );
      expect(result).not.toHaveProperty("context_hint");
    }
    const result = buildCanonicalBody(
      { ...baseInput(), capabilities: null },
      model,
      [],
      {},
      CLAUDE_CODE_2_1_195_PROFILE,
    );
    expect(result).not.toHaveProperty("context_hint");
  });

  it("inspects a supplied profile and rejects cycles inside it", () => {
    const cycle: unknown[] = [];
    cycle.push(cycle);
    const profile = { ...CLAUDE_CODE_2_1_195_PROFILE, cycle };
    expectWireCode(
      () => buildCanonicalBody(baseInput(), model, [], {}, profile),
      "CYCLIC_INPUT",
    );
  });

  it("distinguishes enabled and adaptive thinking and effort output", () => {
    const enabled = build({
      ...baseInput(),
      thinking: { type: "enabled", budgetTokens: 256 },
      effort: "high",
    });
    expect(enabled["thinking"]).toEqual({
      type: "enabled",
      budget_tokens: 256,
    });
    expect(enabled).not.toHaveProperty("temperature");
    expect(enabled).not.toHaveProperty("output_config");

    const adaptive = build({
      ...baseInput(),
      thinking: { type: "adaptive" },
      effort: "high",
    });
    expect(adaptive["thinking"]).toEqual({ type: "adaptive" });
    expect(adaptive["output_config"]).toEqual({ effort: "high" });
    expect(adaptive).not.toHaveProperty("temperature");
  });

  it("rejects adaptive thinking when the model lacks the capability", () => {
    expectWireCode(
      () =>
        build(
          { ...baseInput(), thinking: { type: "adaptive" } },
          {
            ...model,
            capabilities: { ...model.capabilities, adaptiveThinking: false },
          },
        ),
      "INVALID_THINKING",
    );
  });

  it("deep-freezes the full canonical result without treating primitives as objects", () => {
    const result = build(
      {
        ...baseInput(),
        tools: [
          { name: "tool", input_schema: { z: [1, { nested: true }], a: null } },
        ],
      },
      model,
      ["system"],
      { nested: { array: [1, "two", false] } },
    );
    const metadata = result["metadata"] as Record<string, unknown>;
    const nested = metadata["nested"] as Record<string, unknown>;
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result["messages"])).toBe(true);
    expect(Object.isFrozen(result["tools"])).toBe(true);
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(nested)).toBe(true);
    expect(Object.isFrozen(nested["array"])).toBe(true);
  });
});

describe("beta composition mutants", () => {
  const input = {
    rawModel: "claude-opus-4-8",
    normalizedId: "claude-opus-4-8",
    capabilities: capabilities(),
  } as const;

  it("returns the exact emergent defaults without optional builder pushes", () => {
    expect(composeBetas(input)).toEqual([
      "claude-code-20250219",
      "oauth-2025-04-20",
      "prompt-caching-scope-2026-01-05",
      "mid-conversation-system-2026-04-07",
    ]);
  });

  it("places effort after the base-set pushes whenever capability is present", () => {
    const result = composeBetas({
      ...input,
      capabilities: capabilities({ effort: true }),
    });
    expect(result).toEqual([
      "claude-code-20250219",
      "oauth-2025-04-20",
      "prompt-caching-scope-2026-01-05",
      "mid-conversation-system-2026-04-07",
      "effort-2025-11-24",
    ]);
  });

  it("returns exact ordered base betas for all relevant capabilities", () => {
    const result = composeBetas({
      ...input,
      capabilities: capabilities({
        effort: true,
        interleavedThinking: true,
        contextManagement: true,
      }),
    });
    expect(result).toEqual([
      "claude-code-20250219",
      "oauth-2025-04-20",
      "interleaved-thinking-2025-05-14",
      "redact-thinking-2026-02-12",
      "thinking-token-count-2026-05-13",
      "context-management-2025-06-27",
      "prompt-caching-scope-2026-01-05",
      "mid-conversation-system-2026-04-07",
      "effort-2025-11-24",
    ]);
  });

  it("gates context hint on the profile", () => {
    const profile = {
      ...CLAUDE_CODE_2_1_195_PROFILE,
      contextHintEnabled: true,
    };
    expect(composeBetas(input, profile)).toContain("context-hint-2026-04-09");
    expect(composeBetas(input)).not.toContain("context-hint-2026-04-09");
  });

  it("does not duplicate guarded builder betas", () => {
    const result = composeBetas({ ...input, cacheTtl: "1h", speed: "fast" });
    expect(
      result.filter((beta) => beta === "fast-mode-2026-02-01"),
    ).toHaveLength(1);
    expect(
      result.filter((beta) => beta === "extended-cache-ttl-2025-04-11"),
    ).toHaveLength(1);
  });
});

describe("model and error-contract mutants", () => {
  it("passes an unrecognised model through with unknown family", () => {
    expect(resolveModel("definitely-not-a-model")).toMatchObject({
      id: "definitely-not-a-model",
      wireId: "definitely-not-a-model",
      family: "unknown",
    });
  });

  it("rejects symbol safe-detail keys with the exact contract message", () => {
    const details: Record<string, string> = {};
    Object.defineProperty(details, Symbol("secret"), {
      enumerable: true,
      value: "hidden",
    });
    expectTypeError(
      () => new ClaudeCodeWireError("INVALID_INPUT", details),
      "safeDetails contains a forbidden key.",
    );
  });

  it.each(["__proto__", "prototype", "constructor"])(
    "rejects the forbidden safe-detail key %s with the exact contract message",
    (key) => {
      const details: Record<string, string> = {};
      Object.defineProperty(details, key, {
        enumerable: true,
        value: "hidden",
      });
      expectTypeError(
        () => new ClaudeCodeWireError("INVALID_INPUT", details),
        "safeDetails contains a forbidden key.",
      );
    },
  );

  it("rejects non-primitive safe-detail values with the exact contract message", () => {
    const details: Record<string, string> = { value: "initially safe" };
    Object.defineProperty(details, "value", { value: { nested: true } });
    expectTypeError(
      () => new ClaudeCodeWireError("INVALID_INPUT", details),
      "safeDetails values must be primitive-safe.",
    );
  });

  it("copies and freezes primitive-safe details", () => {
    const details = { text: "safe", count: 2, enabled: true };
    const error = new ClaudeCodeWireError("INVALID_INPUT", details);
    details.text = "changed";
    expect(error.safeDetails).toEqual({
      text: "safe",
      count: 2,
      enabled: true,
    });
    expect(Object.isFrozen(error.safeDetails)).toBe(true);
  });
});
