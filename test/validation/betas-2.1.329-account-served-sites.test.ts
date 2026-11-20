// SPDX-License-Identifier: GPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { composeBetasWithAudit } from "../../src/betas.js";
import type { ComposeBetasInput } from "../../src/betas.js";
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  CLAUDE_CODE_2_1_329_PROFILE,
  ClaudeCodeWireError,
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
} from "../../src/index.js";
import { deriveCapabilities } from "../../src/model-capabilities.js";
import { isThinkingActive } from "../../src/thinking.js";

/*
 * The account-served and per-query push sites on 2.1.329: inline-tools (11d),
 * tool-provenance (11e), advisor-tool (11f), message-threads (18, with its body
 * `thread`), and the side-query and agentic-query markers. Every one is gated
 * on the profile's `accountServedInputs` behaviour, so each is also proved
 * inert on the three earlier profiles -- including 2.1.280, whose registry
 * DOES carry the inline-tools and message-threads entries.
 */

const CLAUDE_CODE = "claude-code-20250219";
const OAUTH = "oauth-2025-04-20";
const INTERLEAVED = "interleaved-thinking-2025-05-14";
const PROMPT_CACHING_SCOPE = "prompt-caching-scope-2026-01-05";
const TOOL_CHANGES = "mid-conversation-tool-changes-2026-07-01";
const INLINE_TOOLS = "inline-tools-2026-09-15";
const TOOL_PROVENANCE = "tool-provenance-2026-10-26";
const ADVISOR = "advisor-tool-2026-03-01";
const TOKEN_COUNT = "thinking-token-count-2026-05-13";
const CLEAR_AT = "mid-conversation-system-clear-at-2026-08-21";
const SIDE_QUERY = "claude-code-side-query-2026-09-29";
const EFFORT = "effort-2025-11-24";
const BINDING = "thinking-binding-controls-2026-08-01";
const CACHE_DIAGNOSIS = "cache-diagnosis-2026-04-07";
const MESSAGE_THREADS = "message-threads-2026-08-12";

const OPUS = "claude-opus-5-5";

function compose(
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile,
  overrides: Partial<ComposeBetasInput> = {},
): ReturnType<typeof composeBetasWithAudit> {
  const capabilities = deriveCapabilities(normalizedId, profile);
  const input: ComposeBetasInput = {
    rawModel: normalizedId,
    normalizedId,
    capabilities,
    thinkingDisplayActive: false,
    thinkingActive: isThinkingActive({ type: "adaptive" }, capabilities),
    ...overrides,
  };
  return composeBetasWithAudit(input, profile);
}

const betasOf = (
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile,
  overrides: Partial<ComposeBetasInput> = {},
): readonly string[] => compose(normalizedId, profile, overrides).betas;

const at = (list: readonly string[], header: string): number =>
  list.indexOf(header);

/** Asserts that the listed headers appear in this relative order. */
function expectOrder(list: readonly string[], order: readonly string[]): void {
  expect(list.filter((header) => order.includes(header))).toEqual(order);
}

function withPolicy(
  patch: Partial<ClaudeCodeProtocolProfile["betaPolicy"]>,
): ClaudeCodeProtocolProfile {
  return {
    ...CLAUDE_CODE_2_1_329_PROFILE,
    betaPolicy: { ...CLAUDE_CODE_2_1_329_PROFILE.betaPolicy, ...patch },
  };
}

const EARLIER_PROFILES = [
  ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
  ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
  ["2.1.280", CLAUDE_CODE_2_1_280_PROFILE],
] as const;

describe("inline-tools site (11d)", () => {
  const features = { accountFeatures: { inlineTools: true } } as const;

  it("is absent by default and when the feature is false", () => {
    expect(betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE)).not.toContain(
      INLINE_TOOLS,
    );
    expect(
      betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE, {
        accountFeatures: { inlineTools: false },
      }),
    ).not.toContain(INLINE_TOOLS);
  });

  it("is pushed immediately after mid-conversation-tool-changes", () => {
    const list = betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE, features);

    expect(at(list, INLINE_TOOLS) - at(list, TOOL_CHANGES)).toBe(1);
    expect(at(list, TOKEN_COUNT) - at(list, INLINE_TOOLS)).toBe(1);
  });

  it("requires the tool-changes beta to have fired", () => {
    // claude-opus-4-7 composes none of the mid-conversation betas.
    const list = betasOf(
      "claude-opus-4-7",
      CLAUDE_CODE_2_1_329_PROFILE,
      features,
    );

    expect(list).not.toContain(TOOL_CHANGES);
    expect(list).not.toContain(INLINE_TOOLS);
  });

  it("requires the experimental gate", () => {
    const list = betasOf(
      OPUS,
      withPolicy({ experimentalBetasEnabled: false }),
      features,
    );

    expect(list).not.toContain(INLINE_TOOLS);
  });

  it.each(EARLIER_PROFILES)("is inert on %s", (_name, profile) => {
    expect(betasOf(OPUS, profile, features)).toEqual(betasOf(OPUS, profile));
  });
});

describe("tool-provenance site (11e)", () => {
  const features = { accountFeatures: { toolProvenance: true } } as const;

  it("is never composed by default", () => {
    expect(betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE)).not.toContain(
      TOOL_PROVENANCE,
    );
    expect(
      betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE, {
        accountFeatures: { toolProvenance: false },
      }),
    ).not.toContain(TOOL_PROVENANCE);
  });

  it("is pushed between inline-tools and advisor-tool when opted in", () => {
    const list = betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE, {
      accountFeatures: { inlineTools: true, toolProvenance: true },
      hasAdvisorTool: true,
    });

    expectOrder(list, [
      TOOL_CHANGES,
      INLINE_TOOLS,
      TOOL_PROVENANCE,
      ADVISOR,
      TOKEN_COUNT,
    ]);
    expect(at(list, TOOL_PROVENANCE) - at(list, INLINE_TOOLS)).toBe(1);
    expect(at(list, ADVISOR) - at(list, TOOL_PROVENANCE)).toBe(1);
  });

  it("does not need the tool-changes beta (it keys on OAuth)", () => {
    const list = betasOf(
      "claude-opus-4-7",
      CLAUDE_CODE_2_1_329_PROFILE,
      features,
    );

    expect(list).toContain(TOOL_PROVENANCE);
    expect(at(list, TOOL_PROVENANCE)).toBeLessThan(at(list, TOKEN_COUNT));
  });

  it("requires OAuth authentication", () => {
    const list = betasOf(
      OPUS,
      withPolicy({ oauthAuthenticated: false }),
      features,
    );

    expect(list).not.toContain(TOOL_PROVENANCE);
  });

  it("requires the experimental gate", () => {
    const list = betasOf(
      OPUS,
      withPolicy({ experimentalBetasEnabled: false }),
      features,
    );

    expect(list).not.toContain(TOOL_PROVENANCE);
  });

  it.each(EARLIER_PROFILES)("is inert on %s", (_name, profile) => {
    expect(betasOf(OPUS, profile, features)).toEqual(betasOf(OPUS, profile));
  });
});

describe("advisor-tool site (11f)", () => {
  it("is absent without an advisor tool", () => {
    expect(betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE)).not.toContain(ADVISOR);
    expect(
      betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE, { hasAdvisorTool: false }),
    ).not.toContain(ADVISOR);
  });

  it("is pushed before the relocated thinking-token-count (6')", () => {
    const list = betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE, {
      hasAdvisorTool: true,
    });

    expectOrder(list, [TOOL_CHANGES, ADVISOR, TOKEN_COUNT, CLEAR_AT]);
    expect(at(list, TOKEN_COUNT) - at(list, ADVISOR)).toBe(1);
    expect(at(list, ADVISOR) - at(list, TOOL_CHANGES)).toBe(1);
  });

  it("needs no experimental gate and no account feature", () => {
    const list = betasOf(
      OPUS,
      withPolicy({ experimentalBetasEnabled: false }),
      { hasAdvisorTool: true },
    );

    expect(list).toContain(ADVISOR);
  });

  it.each(EARLIER_PROFILES)("is inert on %s", (_name, profile) => {
    // Every earlier registry declares the advisor entry; only the profile gate
    // keeps the site quiet.
    expect(betasOf(OPUS, profile, { hasAdvisorTool: true })).toEqual(
      betasOf(OPUS, profile),
    );
  });
});

describe("message-threads site (18)", () => {
  const create = { accountFeatures: { thread: { type: "create" } } } as const;
  const resume = {
    accountFeatures: {
      thread: { type: "continue", previousMessageId: "msg_01AbC_dEf" },
    },
  } as const;

  it("is absent without a thread", () => {
    const composed = compose(OPUS, CLAUDE_CODE_2_1_329_PROFILE);

    expect(composed.betas).not.toContain(MESSAGE_THREADS);
    expect(composed.thread).toBeUndefined();
  });

  it("is pushed after cache-diagnosis and decides the create body", () => {
    const composed = compose(OPUS, CLAUDE_CODE_2_1_329_PROFILE, create);

    expect(composed.betas[composed.betas.length - 1]).toBe(MESSAGE_THREADS);
    expect(at(composed.betas, MESSAGE_THREADS)).toBe(
      at(composed.betas, CACHE_DIAGNOSIS) + 1,
    );
    expect(composed.thread).toStrictEqual({ type: "create" });
  });

  it("decides the continue body with the wire key name", () => {
    expect(
      compose(OPUS, CLAUDE_CODE_2_1_329_PROFILE, resume).thread,
    ).toStrictEqual({ type: "continue", previous_message_id: "msg_01AbC_dEf" });
  });

  it("requires the experimental gate", () => {
    const composed = compose(
      OPUS,
      withPolicy({ experimentalBetasEnabled: false }),
      create,
    );

    expect(composed.betas).not.toContain(MESSAGE_THREADS);
    expect(composed.thread).toBeUndefined();
  });

  it("drops the body decision when the caller suppresses the beta", () => {
    const composed = compose(OPUS, CLAUDE_CODE_2_1_329_PROFILE, {
      ...create,
      suppressBetas: [MESSAGE_THREADS],
    });

    expect(composed.betas).not.toContain(MESSAGE_THREADS);
    expect(composed.suppressedBetaNames).toEqual([MESSAGE_THREADS]);
    expect(composed.thread).toBeUndefined();
  });

  it("keeps the body decision when the caller suppresses another beta", () => {
    const composed = compose(OPUS, CLAUDE_CODE_2_1_329_PROFILE, {
      ...create,
      suppressBetas: [EFFORT],
    });

    expect(composed.thread).toStrictEqual({ type: "create" });
  });

  it.each(EARLIER_PROFILES)("is inert on %s", (_name, profile) => {
    // The 2.1.280 registry declares the entry; only the profile gate holds.
    const composed = compose(OPUS, profile, resume);

    expect(composed.betas).toEqual(betasOf(OPUS, profile));
    expect(composed.thread).toBeUndefined();
  });
});

describe("side-query marker", () => {
  it("is absent unless requested", () => {
    expect(betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE)).not.toContain(
      SIDE_QUERY,
    );
    expect(
      betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE, { sideQuery: false }),
    ).not.toContain(SIDE_QUERY);
  });

  it("is pushed after clear-at and before effort", () => {
    const list = betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE, {
      sideQuery: true,
    });

    expectOrder(list, [TOKEN_COUNT, CLEAR_AT, SIDE_QUERY, EFFORT, BINDING]);
    expect(at(list, SIDE_QUERY) - at(list, CLEAR_AT)).toBe(1);
    expect(at(list, EFFORT) - at(list, SIDE_QUERY)).toBe(1);
  });

  it("still lands before effort for a model with no mid-conversation betas", () => {
    const list = betasOf("claude-opus-4-7", CLAUDE_CODE_2_1_329_PROFILE, {
      sideQuery: true,
    });

    expect(at(list, SIDE_QUERY)).toBeGreaterThan(at(list, TOKEN_COUNT));
    expect(at(list, EFFORT) - at(list, SIDE_QUERY)).toBe(1);
  });

  it.each(EARLIER_PROFILES)("is inert on %s", (_name, profile) => {
    expect(betasOf(OPUS, profile, { sideQuery: true })).toEqual(
      betasOf(OPUS, profile),
    );
  });
});

describe("agentic-query marker", () => {
  const HAIKU = "claude-haiku-5-5";

  it("leaves a haiku model without the claude-code beta by default", () => {
    expect(betasOf(HAIKU, CLAUDE_CODE_2_1_329_PROFILE)).not.toContain(
      CLAUDE_CODE,
    );
  });

  it("adds claude-code after the per-model entries and before the per-request sites", () => {
    const base = betasOf(HAIKU, CLAUDE_CODE_2_1_329_PROFILE);
    const list = betasOf(HAIKU, CLAUDE_CODE_2_1_329_PROFILE, {
      agenticQuery: true,
    });

    expect(list.filter((header) => header !== CLAUDE_CODE)).toEqual(base);
    expect(list.filter((header) => header === CLAUDE_CODE)).toHaveLength(1);
    expect(at(list, CLAUDE_CODE)).toBeGreaterThan(at(list, OAUTH));
    expect(at(list, CLAUDE_CODE)).toBeGreaterThan(at(list, INTERLEAVED));
    expect(at(list, CLAUDE_CODE)).toBeGreaterThan(
      at(list, PROMPT_CACHING_SCOPE),
    );
    expect(at(list, CLAUDE_CODE)).toBeLessThan(at(list, TOKEN_COUNT));
    expect(at(list, CLAUDE_CODE)).toBeLessThan(at(list, EFFORT));
  });

  it("does not duplicate or move the beta for a model that already has it", () => {
    const list = betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE, {
      agenticQuery: true,
    });

    expect(list).toEqual(betasOf(OPUS, CLAUDE_CODE_2_1_329_PROFILE));
    expect(at(list, CLAUDE_CODE)).toBe(0);
  });

  it.each(EARLIER_PROFILES)("is inert on %s", (_name, profile) => {
    expect(betasOf(HAIKU, profile, { agenticQuery: true })).toEqual(
      betasOf(HAIKU, profile),
    );
  });
});

/* ------------------------------------------------------------------------ *
 * End to end: the LIVE composite and the request surface.
 * ------------------------------------------------------------------------ */

const CAPTURE_PATH = fileURLToPath(
  new URL(
    "../../.temp/cc329/captures/inter329-205-messages-api.anthropic.com.json",
    import.meta.url,
  ),
);

/** Beta list of capture `inter329-205`, in order. */
const LIVE_BETAS = [
  "claude-code-20250219",
  "oauth-2025-04-20",
  "interleaved-thinking-2025-05-14",
  "context-management-2025-06-27",
  "prompt-caching-scope-2026-01-05",
  "per-turn-control-2026-07-01",
  "mid-conversation-tool-changes-2026-07-01",
  "inline-tools-2026-09-15",
  "advisor-tool-2026-03-01",
  "thinking-token-count-2026-05-13",
  "advanced-tool-use-2025-11-20",
  "mid-conversation-system-clear-at-2026-08-21",
  "effort-2025-11-24",
  "dangerous-tool-use-2026-09-03",
  "thinking-binding-controls-2026-08-01",
  "thinking-display-updates-2026-08-18",
  "afk-mode-2026-01-31",
  "extended-cache-ttl-2025-04-11",
  "cache-diagnosis-2026-04-07",
  "message-threads-2026-08-12",
] as const;

/**
 * Environment- and permission-mode-driven betas this package does not model
 * (the plan's non-goals), so they are not expected in the composite.
 */
const UNMODELLED_LIVE_BETAS: ReadonlySet<string> = new Set([
  "advanced-tool-use-2025-11-20",
  "dangerous-tool-use-2026-09-03",
  "afk-mode-2026-01-31",
]);

/** Header names of the capture the library does not own (transport headers). */
const TRANSPORT_HEADERS: ReadonlySet<string> = new Set([
  "Connection",
  "Host",
  "Accept-Encoding",
  "Content-Length",
]);

const LIVE_HEADER_NAMES = [
  "Accept",
  "Authorization",
  "Content-Type",
  "User-Agent",
  "X-Claude-Code-Session-Id",
  "X-Stainless-Arch",
  "X-Stainless-Lang",
  "X-Stainless-OS",
  "X-Stainless-Package-Version",
  "X-Stainless-Retry-Count",
  "X-Stainless-Runtime",
  "X-Stainless-Runtime-Version",
  "X-Stainless-Timeout",
  "anthropic-beta",
  "anthropic-dangerous-direct-browser-access",
  "anthropic-dispatch-id",
  "anthropic-version",
  "x-app",
  "x-claude-1p-request-class",
  "x-claude-code-prompt-id",
  "x-claude-code-request-class",
  "x-claude-code-sandy-plover",
  "x-client-request-id",
] as const;

/** Body keys of the capture, minus the host-served `safeguards`. */
const LIVE_BODY_KEYS = [
  "model",
  "messages",
  "system",
  "tools",
  "metadata",
  "max_tokens",
  "thinking",
  "context_management",
  "output_config",
  "thread",
  "diagnostics",
  "stream",
] as const;

const BASE = {
  accessToken: "account-served-token-not-a-secret",
  model: OPUS,
  maxTokens: 128000,
  messages: [{ role: "user", content: "hello" }],
  runtime: {
    sessionId: "00000000-0000-4000-8000-000000000001",
    deviceId:
      "0000000000000000000000000000000000000000000000000000000000000002",
    accountUuid: "00000000-0000-4000-8000-000000000000",
    runtime: "node",
    runtimeVersion: "v26.12.1",
    os: "Windows",
    arch: "x64",
  },
  clientRequestId: "00000000-0000-4000-8000-000000000002",
} as const satisfies ClaudeCodeRequestInput;

const COMPOSITE: ClaudeCodeRequestInput = {
  ...BASE,
  promptId: "85cadda7-09d0-40b9-9689-49f8b225def1",
  thinking: { type: "adaptive" },
  effort: "medium",
  stream: true,
  cacheControl: { ttl: "1h" },
  tools: [
    {
      name: "Read",
      description: "Reads a file",
      input_schema: { type: "object", properties: {} },
    },
    { type: "advisor_20260301", name: "advisor", model: OPUS },
  ],
  accountFeatures: {
    inlineTools: true,
    thread: { type: "create" },
    dispatchId: "v2d",
  },
};

function build(
  extra: Partial<ClaudeCodeRequestInput> = {},
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_329_PROFILE,
): Promise<BuiltClaudeCodeRequest> {
  return buildClaudeCodeRequest({ ...COMPOSITE, ...extra }, profile);
}

function betaHeader(built: BuiltClaudeCodeRequest): readonly string[] {
  const value = built.headers.find(([name]) => name === "anthropic-beta")?.[1];
  return (value ?? "").split(",");
}

async function failureCode(
  extra: Partial<ClaudeCodeRequestInput>,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_329_PROFILE,
): Promise<string | undefined> {
  try {
    await build(extra, profile);
  } catch (error: unknown) {
    if (error instanceof ClaudeCodeWireError) return error.code;
    throw error;
  }
  return undefined;
}

describe("LIVE composite (capture inter329-205)", () => {
  it("composes the live beta list minus the unmodelled betas", async () => {
    const built = await build();

    expect(betaHeader(built)).toEqual(
      LIVE_BETAS.filter((beta) => !UNMODELLED_LIVE_BETAS.has(beta)),
    );
  });

  it("orders the headers as the live capture does", async () => {
    const built = await build();

    expect(built.headers.map(([name]) => name)).toEqual(LIVE_HEADER_NAMES);
  });

  it("orders the body keys as the live capture does, minus safeguards", async () => {
    const built = await build();

    expect(Object.keys(JSON.parse(built.body) as object)).toEqual(
      LIVE_BODY_KEYS,
    );
  });

  it("agrees with the capture file itself when it is present", async () => {
    // The capture lives under the git-ignored `.temp` directory, so it exists
    // on the porting workstation only; the literals above carry the same
    // assertions everywhere else.
    if (!existsSync(CAPTURE_PATH)) return;
    const capture = JSON.parse(readFileSync(CAPTURE_PATH, "utf8")) as {
      readonly request_headers: readonly (readonly [string, string])[];
      readonly request_body: Readonly<Record<string, unknown>>;
    };
    const built = await build();
    const owned = capture.request_headers.filter(
      ([name]) => !TRANSPORT_HEADERS.has(name),
    );
    const liveBeta = owned.find(([name]) => name === "anthropic-beta")?.[1];

    expect(built.headers.map(([name]) => name)).toEqual(
      owned.map(([name]) => name),
    );
    expect(liveBeta?.split(",")).toEqual(LIVE_BETAS);
    expect(Object.keys(JSON.parse(built.body) as object)).toEqual(
      Object.keys(capture.request_body).filter((key) => key !== "safeguards"),
    );
    expect(capture.request_body["thread"]).toStrictEqual({ type: "create" });
  });

  it("round-trips through parseBuiltClaudeCodeRequest", async () => {
    const built = await build();

    expect(
      parseBuiltClaudeCodeRequest(
        JSON.parse(JSON.stringify(built)) as unknown,
        CLAUDE_CODE_2_1_329_PROFILE,
      ),
    ).toStrictEqual(built);
  });
});

describe("thread body on 2.1.329", () => {
  const threadOf = (built: BuiltClaudeCodeRequest): unknown =>
    (JSON.parse(built.body) as Record<string, unknown>)["thread"];

  it("carries {type:create} for a new thread", async () => {
    expect(threadOf(await build())).toStrictEqual({ type: "create" });
  });

  it("carries the previous message id of a continued thread", async () => {
    const built = await build({
      accountFeatures: {
        thread: { type: "continue", previousMessageId: "msg_01AbC_dEf" },
      },
    });

    expect(threadOf(built)).toStrictEqual({
      type: "continue",
      previous_message_id: "msg_01AbC_dEf",
    });
  });

  it("is absent without a thread, and header and body stay paired", async () => {
    const built = await build({ accountFeatures: { dispatchId: "v2d" } });

    expect(threadOf(built)).toBeUndefined();
    expect(betaHeader(built)).not.toContain(MESSAGE_THREADS);
  });

  it("is dropped together with the beta when the caller suppresses it", async () => {
    const built = await build({ suppressBetas: [MESSAGE_THREADS] });

    expect(betaHeader(built)).not.toContain(MESSAGE_THREADS);
    expect(threadOf(built)).toBeUndefined();
    expect(Object.keys(JSON.parse(built.body) as object)).toEqual(
      LIVE_BODY_KEYS.filter((key) => key !== "thread"),
    );
  });

  it("refuses an experimental body field that collides with it", async () => {
    expect(
      await failureCode({ experimentalBodyFields: { thread: { type: "x" } } }),
    ).toBe("INVALID_INPUT");
  });

  it.each(EARLIER_PROFILES)("is not emitted on %s", async (_name, profile) => {
    const built = await build({}, profile);

    expect(threadOf(built)).toBeUndefined();
    expect(betaHeader(built)).not.toContain(MESSAGE_THREADS);
    expect(betaHeader(built)).not.toContain(INLINE_TOOLS);
  });
});

describe("sideQuery and agenticQuery inputs", () => {
  const HAIKU_INPUT = { model: "claude-haiku-5-5", maxTokens: 1024 } as const;

  it("compose the side-query beta only when requested", async () => {
    expect(betaHeader(await build())).not.toContain(SIDE_QUERY);
    expect(betaHeader(await build({ sideQuery: true }))).toContain(SIDE_QUERY);
  });

  it("restore claude-code for a haiku model when agentic", async () => {
    const plain = await build(HAIKU_INPUT);
    const agentic = await build({ ...HAIKU_INPUT, agenticQuery: true });

    expect(betaHeader(plain)).not.toContain(CLAUDE_CODE);
    expect(betaHeader(agentic)).toContain(CLAUDE_CODE);
  });

  it.each([
    ["sideQuery", "yes"],
    ["sideQuery", 1],
    ["agenticQuery", "true"],
    ["agenticQuery", null],
  ])("reject a non-boolean %s on 2.1.329", async (key, value) => {
    expect(await failureCode({ [key]: value })).toBe("INVALID_INPUT");
  });

  it.each(EARLIER_PROFILES)(
    "validate but ignore both on %s",
    async (_name, profile) => {
      const plain = await build(HAIKU_INPUT, profile);
      const withInputs = await build(
        { ...HAIKU_INPUT, sideQuery: true, agenticQuery: true },
        profile,
      );

      expect(withInputs).toStrictEqual(plain);
      expect(await failureCode({ sideQuery: "yes" as never }, profile)).toBe(
        "INVALID_INPUT",
      );
      expect(await failureCode({ agenticQuery: "yes" as never }, profile)).toBe(
        "INVALID_INPUT",
      );
    },
  );
});
