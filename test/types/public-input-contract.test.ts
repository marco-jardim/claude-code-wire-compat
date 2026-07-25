// SPDX-License-Identifier: GPL-3.0-or-later

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
} from "../../src/index.js";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

describe("public request input contract", () => {
  it("type-checks the successful public input against its declaration", () => {
    const program = ts.createProgram({
      rootNames: [import.meta.filename],
      options: {
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
        types: ["node", "vitest/globals"],
      },
    });
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .filter((diagnostic) =>
        diagnostic.file?.fileName.endsWith("public-input-contract.test.ts"),
      )
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );

    expect(diagnostics).toEqual([]);
  });

  it("builds a request using an explicitly annotated public input", async () => {
    const clientRequestId = "public-contract-request-1";
    const input: ClaudeCodeRequestInput = {
      accessToken: "test-token",
      model: "claude-sonnet-4-6",
      maxTokens: 1024,
      messages: [{ role: "user", content: "Hello" }],
      runtime: {
        sessionId: "session-1",
        deviceId: "device-1",
        accountUuid: "account-1",
        runtime: "node",
        runtimeVersion: "22.0.0",
        os: "Linux",
        arch: "x64",
      },
      clientRequestId,
    };

    const result = buildClaudeCodeRequest(input, CLAUDE_CODE_2_1_195_PROFILE);
    await expect(result).resolves.toBeDefined();
    const built = await result;
    expect(built.headers).toContainEqual([
      "x-client-request-id",
      clientRequestId,
    ]);
  });

  it("rejects a public-contract input missing the mandatory client request id", async () => {
    const input: ClaudeCodeRequestInput = {
      accessToken: "test-token",
      model: "claude-sonnet-4-6",
      maxTokens: 1024,
      messages: [{ role: "user", content: "Hello" }],
      runtime: {
        sessionId: "session-1",
        deviceId: "device-1",
        accountUuid: "account-1",
        runtime: "node",
        runtimeVersion: "22.0.0",
        os: "Linux",
        arch: "x64",
      },
      clientRequestId: "removed-before-build",
    };
    Reflect.deleteProperty(input, "clientRequestId");

    await expect(
      buildClaudeCodeRequest(input, CLAUDE_CODE_2_1_195_PROFILE),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
