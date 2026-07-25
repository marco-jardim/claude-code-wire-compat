// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  ClaudeCodeRuntimeIdentity,
  HeaderPair,
  Message,
  ToolDefinition,
} from "../../src/contracts.js";
import { expectTypeOf } from "vitest";

const runtimeIdentity: ClaudeCodeRuntimeIdentity = {
  sessionId: "session-1",
  deviceId: "device-1",
  accountUuid: "account-1",
  runtime: "node",
  runtimeVersion: "22.0.0",
  os: "Linux",
  arch: "x64",
};

const message: Message = {
  role: "user",
  content: [{ type: "text", text: "Hello" }],
};

const tool: ToolDefinition = {
  name: "lookup",
  description: "Looks up a value",
  input_schema: {
    type: "object",
    properties: { query: { type: "string" } },
  },
};

const request: ClaudeCodeRequestInput = {
  accessToken: "token",
  model: "claude-sonnet",
  maxTokens: 1024,
  messages: [message],
  clientRequestId: "client-request-1",
  system: ["Be concise", { type: "text", text: "Use tools" }],
  tools: [tool],
  runtime: runtimeIdentity,
  capabilities: {
    contextHint: true,
    adaptiveThinking: true,
    effort: true,
    interleavedThinking: false,
  },
  thinking: { type: "enabled", budgetTokens: 512 },
  effort: "high",
  metadata: { requestId: "request-1", retry: 0, cached: false },
};

expectTypeOf(request).toExtend<ClaudeCodeRequestInput>();

expectTypeOf<{ role: "system"; content: string }>().not.toExtend<Message>();
expectTypeOf<"deno">().not.toExtend<ClaudeCodeRuntimeIdentity["runtime"]>();
expectTypeOf<"extreme">().not.toExtend<
  NonNullable<ClaudeCodeRequestInput["effort"]>
>();
expectTypeOf<ClaudeCodeProtocolProfile>().toEqualTypeOf<
  Readonly<ClaudeCodeProtocolProfile>
>();
expectTypeOf<HeaderPair>().toEqualTypeOf<Readonly<HeaderPair>>();

type HasOnlyKnownKeys<Candidate, Shape> =
  Exclude<keyof Candidate, keyof Shape> extends never ? true : false;

expectTypeOf<
  HasOnlyKnownKeys<
    ClaudeCodeRequestInput & { unknownProperty: true },
    ClaudeCodeRequestInput
  >
>().toEqualTypeOf<false>();
