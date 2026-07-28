// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";
import type { ClaudeCodeRequestInput, HeaderPair } from "../../src/index.js";

const ACCESS_TOKEN = "sentinel-token-headers-wp-f";
const BASE_INPUT: ClaudeCodeRequestInput = {
  accessToken: ACCESS_TOKEN,
  model: "claude-opus-4-8",
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
  clientRequestId: "request-headers-wp-f",
};

function input(
  overrides: Readonly<Record<string, unknown>> = {},
): ClaudeCodeRequestInput {
  return { ...BASE_INPUT, ...overrides };
}

async function headers(
  overrides: Readonly<Record<string, unknown>> = {},
): Promise<readonly HeaderPair[]> {
  return (await buildClaudeCodeRequest(input(overrides))).headers;
}

function valueOf(
  pairs: readonly HeaderPair[],
  name: string,
): string | undefined {
  return pairs.find(([candidate]) => candidate === name)?.[1];
}

async function expectCode(
  overrides: Readonly<Record<string, unknown>>,
  code: string,
): Promise<void> {
  await expect(buildClaudeCodeRequest(input(overrides))).rejects.toEqual(
    expect.objectContaining({ code }),
  );
}

describe("expanded header controls", () => {
  it("exposes the expanded public declarations", () => {
    const typed: ClaudeCodeRequestInput = {
      ...BASE_INPUT,
      app: "cli-bg",
      stainlessRetryCount: 1,
      stainlessHelper: "helper",
      claudeRemoteContainerId: "container",
      claudeRemoteSessionId: "remote-session",
      clientApp: "client",
      anthropicAdditionalProtection: "protection",
      extraHeaders: [["x-cc-atis", "opaque"]],
    };
    expect(typed.app).toBe("cli-bg");
  });

  it("defaults app to cli and emits cli-bg when requested", async () => {
    expect(valueOf(await headers(), "x-app")).toBe("cli");
    expect(valueOf(await headers({ app: "cli-bg" }), "x-app")).toBe("cli-bg");
  });

  it.each([1, Number.MAX_SAFE_INTEGER])(
    "serializes retry count %s as base-10 text",
    async (stainlessRetryCount) => {
      expect(
        valueOf(
          await headers({ stainlessRetryCount }),
          "x-stainless-retry-count",
        ),
      ).toBe(String(stainlessRetryCount));
    },
  );

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"])(
    "rejects invalid retry count %#",
    async (stainlessRetryCount) => {
      await expectCode({ stainlessRetryCount }, "INVALID_INPUT");
    },
  );

  it("emits each evidenced dynamic header once in canonical order", async () => {
    const pairs = await headers({
      stainlessHelper: "helper",
      claudeRemoteContainerId: "container",
      claudeRemoteSessionId: "remote-session",
      clientApp: "client",
      anthropicAdditionalProtection: "protection",
    });
    const dynamic = pairs.slice(
      pairs.findIndex(([name]) => name === "x-stainless-timeout") + 1,
    );
    expect(dynamic).toEqual([
      ["x-stainless-helper", "helper"],
      ["x-claude-remote-container-id", "container"],
      ["x-claude-remote-session-id", "remote-session"],
      ["x-client-app", "client"],
      ["x-anthropic-additional-protection", "protection"],
    ]);
    for (const [name] of dynamic) {
      expect(pairs.filter(([candidate]) => candidate === name)).toHaveLength(1);
    }
  });

  it("appends extras in caller order and round-trips them", async () => {
    const extraHeaders = [
      ["x-zeta", "last"],
      ["x-alpha", "first"],
      ["x-cc-atis", "opaque"],
    ] as const;
    const built = await buildClaudeCodeRequest(input({ extraHeaders }));
    expect(built.headers.slice(-3)).toEqual(extraHeaders);
    expect(parseBuiltClaudeCodeRequest(built)).toEqual(built);
  });

  it.each([
    "Content-Type",
    "X-App",
    "X-Stainless-Helper",
    "X-Claude-Remote-Container-Id",
    "X-Claude-Remote-Session-Id",
    "X-Client-App",
    "X-Anthropic-Additional-Protection",
  ])("rejects a case-insensitive canonical duplicate %s", async (name) => {
    await expectCode({ extraHeaders: [[name, "value"]] }, "DUPLICATE_HEADER");
  });

  it("retains forbidden-header, injection, and token-isolation checks", async () => {
    await expectCode(
      { extraHeaders: [["cookie", "value"]] },
      "FORBIDDEN_HEADER",
    );
    // Still rejected, one layer later: the input-graph screen now admits CR/LF
    // as body content, and `assertHeaderText` refuses them for headers.
    await expectCode(
      { extraHeaders: [["x-custom", "line\r\nbreak"]] },
      "HEADER_INJECTION",
    );
    await expectCode(
      { extraHeaders: [["x-custom", `leak-${ACCESS_TOKEN}`]] },
      "INVALID_INPUT",
    );
    await expectCode({ stainlessHelper: "bad\u0001value" }, "INVALID_UNICODE");
    await expectCode({ clientApp: `leak-${ACCESS_TOKEN}` }, "INVALID_INPUT");
  });

  it.each([
    ["stainlessHelper", ""],
    ["claudeRemoteContainerId", 1],
    ["claudeRemoteSessionId", "bad\nvalue", "HEADER_INJECTION"],
    ["clientApp", ""],
    ["anthropicAdditionalProtection", false],
  ])("rejects malformed explicit header %s", async (key, value, code) => {
    await expectCode({ [key]: value }, code ?? "INVALID_INPUT");
  });

  it("accepts x-cc-atis only through extras", async () => {
    expect(
      valueOf(
        await headers({ extraHeaders: [["x-cc-atis", "opaque"]] }),
        "x-cc-atis",
      ),
    ).toBe("opaque");
    await expectCode({ xCcAtis: "opaque" }, "INVALID_INPUT");
  });
});
