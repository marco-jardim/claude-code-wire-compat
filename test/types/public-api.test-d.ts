// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  ClaudeCodeRuntimeIdentity,
  HeaderPair,
  Message,
  ToolDefinition,
} from "../../src/contracts.js";

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

const invalidRole: Message = {
  // @ts-expect-error invalid message role
  role: "system",
  content: "Hello",
};

const invalidRuntime: ClaudeCodeRuntimeIdentity = {
  ...runtimeIdentity,
  // @ts-expect-error invalid runtime
  runtime: "deno",
};

const invalidEffort: ClaudeCodeRequestInput = {
  ...request,
  // @ts-expect-error invalid effort
  effort: "extreme",
};

declare const profile: ClaudeCodeProtocolProfile;
// @ts-expect-error profile fields are readonly
profile.cliVersion = "2.1.195";

declare const header: HeaderPair;
// @ts-expect-error header pair elements are readonly
header[0] = "authorization";

const requestWithExtraProperty: ClaudeCodeRequestInput = {
  ...request,
  // @ts-expect-error unknown request property
  unknownProperty: true,
};

void invalidRole;
void invalidRuntime;
void invalidEffort;
void requestWithExtraProperty;
