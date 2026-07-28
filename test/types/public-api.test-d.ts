// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  ClaudeCodeBetaOverrides,
  ClaudeCodeCapabilities,
  ClaudeCodeCapabilityDecisions,
  ClaudeCodeProtocolProfile,
  ClaudeCodeRequestInput,
  ClaudeCodeRuntimeIdentity,
  HeaderPair,
  Message,
  RedactedRequestEvidence,
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
    thinking: true,
    adaptiveThinking: true,
    interleavedThinking: false,
    effort: true,
    maxEffort: true,
    xhighEffort: true,
    contextManagement: true,
    temperature: false,
    rejectsDisabledThinking: true,
  },
  thinking: { type: "enabled", budgetTokens: 512 },
  effort: "high",
  metadata: { requestId: "request-1", retry: 0, cached: false },
  additionalBetas: ["custom-beta-2026-01-01"],
  betaOverrides: { use1MContext: true },
  cacheControl: { enabled: false, suppressIdentityBlock: true },
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

/*
 * Package-extension seams. Each one must be OPTIONAL on the public input, so a
 * consumer written against an earlier release still type-checks, and the
 * override members must stay booleans rather than widening to `unknown`.
 */
expectTypeOf<Record<never, never>>().toExtend<ClaudeCodeBetaOverrides>();
expectTypeOf<
  NonNullable<ClaudeCodeRequestInput["betaOverrides"]>["use1MContext"]
>().toEqualTypeOf<boolean | undefined>();
expectTypeOf<
  NonNullable<ClaudeCodeRequestInput["additionalBetas"]>
>().toEqualTypeOf<readonly string[]>();
expectTypeOf<
  NonNullable<ClaudeCodeRequestInput["cacheControl"]>["suppressIdentityBlock"]
>().toEqualTypeOf<boolean | null | undefined>();

// The nine capability keys stay mandatory; the seam key is additive-only.
expectTypeOf<ClaudeCodeCapabilityDecisions>().toExtend<
  Readonly<Record<keyof ClaudeCodeCapabilities, boolean>>
>();
expectTypeOf<
  RedactedRequestEvidence["capabilityDecisions"]["use1MContext"]
>().toEqualTypeOf<boolean | undefined>();
expectTypeOf<
  Readonly<Record<keyof ClaudeCodeCapabilities, boolean>>
>().toExtend<ClaudeCodeCapabilityDecisions>();
