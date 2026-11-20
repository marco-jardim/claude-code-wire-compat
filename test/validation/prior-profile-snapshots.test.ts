// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  ClaudeCodeWireError,
  buildClaudeCodeCountTokensRequest,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import type {
  BuiltClaudeCodeRequest,
  ClaudeCodeCountTokensInput,
  ClaudeCodeRequestInput,
} from "../../src/index.js";
import {
  referenceAdapter,
  syntheticInput,
} from "../conformance/reference-adapter.js";

/*
 * NON-REGRESSION SNAPSHOT, NOT CONFORMANCE.
 *
 * Each literal below is the SHA-256 of the complete observable output
 * (`url`, `method`, `headers`, `body` and `evidence`, serialised in that order)
 * that an already-shipped profile produced for one scenario BEFORE the 2.1.329
 * port started, or the error code the builder raised. It records what the
 * package did, not what upstream does. Its only purpose is to fail loudly if a
 * change made for a later profile moves a byte for 2.1.195, 2.1.233 or 2.1.280.
 *
 * The literals were generated once on the untouched tree and must never be
 * regenerated to make a failure pass: a mismatch means an existing profile's
 * wire output changed, and the cause is to be found and reverted. They are
 * deliberately insensitive to which profile is the default, because every case
 * names its profile.
 */

type PinnedProfile = NonNullable<Parameters<typeof buildClaudeCodeRequest>[1]>;

const TOKEN = "test-token-not-a-secret";

const RUNTIME = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  deviceId: "0000000000000000000000000000000000000000000000000000000000000002",
  accountUuid: "00000000-0000-4000-8000-000000000000",
  runtime: "node",
  runtimeVersion: "v24.15.0",
  os: "Windows",
  arch: "x64",
} as const;

const CLIENT_REQUEST_ID = "00000000-0000-4000-8000-000000000002";

const TOOL = {
  name: "lookup",
  description: "Synthetic snapshot tool",
  input_schema: { type: "object", properties: {} },
} as const;

function base(
  model: string,
  extra: Partial<ClaudeCodeRequestInput> = {},
): ClaudeCodeRequestInput {
  return {
    accessToken: TOKEN,
    model,
    maxTokens: 4096,
    messages: [{ role: "user", content: "hello wire compat" }],
    system: ["synthetic system prompt"],
    runtime: RUNTIME,
    clientRequestId: CLIENT_REQUEST_ID,
    ...extra,
  };
}

const ADAPTIVE = { thinking: { type: "adaptive" } } as const;

// S13 goes through the count-tokens builder, which takes a narrower input.
const COUNT_INPUT: ClaudeCodeCountTokensInput = {
  accessToken: TOKEN,
  model: "claude-sonnet-4-5",
  messages: [{ role: "user", content: "hello wire compat" }],
  tools: [TOOL],
  runtime: RUNTIME,
  clientRequestId: CLIENT_REQUEST_ID,
};

const REQUEST_INPUTS: Readonly<Record<string, ClaudeCodeRequestInput>> = {
  // The input the packed-consumer canary shares across runtimes.
  S01_packed_consumer_input: {
    accessToken: TOKEN,
    model: "claude-sonnet-4-5",
    maxTokens: 128,
    messages: [{ role: "user", content: "hello wire compat" }],
    system: ["synthetic system prompt"],
    runtime: RUNTIME,
    clientRequestId: CLIENT_REQUEST_ID,
  },
  S02_default_path_fixture_input: syntheticInput(
    referenceAdapter("outgoing-default-path-2.1.280.json"),
  ),
  S03_opus_4_8_effort_high: base("claude-opus-4-8", { effort: "high" }),
  S04_sonnet_5_5_thinking: base("claude-sonnet-5-5", ADAPTIVE),
  S05_haiku_5_5_thinking: base("claude-haiku-5-5", ADAPTIVE),
  S06_fable_5_2_thinking: base("claude-fable-5-2", ADAPTIVE),
  S07_mythos_5_2_thinking: base("claude-mythos-5-2", ADAPTIVE),
  S08a_fable_5_dated: base("claude-fable-5-20260101"),
  S08b_bedrock_sonnet_5_5: base("us.anthropic.claude-sonnet-5-5-v1:0"),
  S09_mythos_5_thinking_enabled: base("claude-mythos-5", {
    thinking: { type: "enabled", budgetTokens: 1024 },
  }),
  S10_opus_5_5_one_million_suffix: base("claude-opus-5-5[1m]"),
  S11_extra_headers_accept_and_request_class: base("claude-opus-4-8", {
    extraHeaders: [
      ["accept", "application/json"],
      ["x-claude-code-request-class", "main"],
    ],
  }),
  S12_profile_override_custom_id: base("claude-opus-4-8", {
    profileOverride: { id: "claude-code-custom" },
  }),
  S14_forced_tool_choice_under_thinking: base("claude-opus-4-6", {
    tools: [TOOL],
    toolChoice: { type: "tool", name: "lookup" },
    thinking: { type: "enabled", budgetTokens: 1024 },
  }),
};

type Built = Omit<BuiltClaudeCodeRequest, "url"> & { readonly url: string };

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function snapshot(build: () => Promise<Built>): Promise<string> {
  try {
    const built = await build();
    return sha256(
      JSON.stringify({
        url: built.url,
        method: built.method,
        headers: built.headers,
        body: built.body,
        evidence: built.evidence,
      }),
    );
  } catch (error) {
    if (error instanceof ClaudeCodeWireError) {
      return `error:${error.code}`;
    }
    throw error;
  }
}

async function snapshotAll(
  profile: PinnedProfile,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [name, input] of Object.entries(REQUEST_INPUTS)) {
    result[name] = await snapshot(() => buildClaudeCodeRequest(input, profile));
  }
  result["S13_count_tokens"] = await snapshot(() =>
    buildClaudeCodeCountTokensRequest(COUNT_INPUT, profile),
  );
  return result;
}

const EXPECTED_2_1_195: Readonly<Record<string, string>> = {
  S01_packed_consumer_input:
    "0f8b8cba2a58bb99d385cc91e9ef84b0b69193e9fa6425e400ba7680aee46067",
  S02_default_path_fixture_input:
    "3923db74ae059ecd3e9b62f31e8970b4fac32d91020b286a5162fbed49afa2ef",
  S03_opus_4_8_effort_high:
    "b37c1a3b1390cc6a39dd722504268baa61b8656830a0f1a391d0927882852931",
  S04_sonnet_5_5_thinking:
    "31ee001c75d0a7ca578c135b1f67d7f67d9149397c90b07cc6219470098688b6",
  S05_haiku_5_5_thinking:
    "9753f3b43a29489ae6f9ad3ecea5bab74ec2db1745036094ba4179860d532d5a",
  S06_fable_5_2_thinking:
    "3178426320dd4c60f7249f5d6a807d1a29822dadbbd5fe72aba82247841ffac1",
  S07_mythos_5_2_thinking:
    "08ee2d74610fe47d0ece0b9cbc2cf8c653e78944e4afbcf68a96509b267ea5fb",
  S08a_fable_5_dated:
    "7de494723716939374ca347a982ce210fb327c7109a59b5e8a0ee3debaceec52",
  S08b_bedrock_sonnet_5_5:
    "5b0da61db546ebf90759dd478229025e75aa672522e9d668fe92c134ca115527",
  S09_mythos_5_thinking_enabled:
    "4d33b4b5ad5d22fcb7c5deb8680856f6006b9db9b6f7ada7e6960aff5851cdb1",
  S10_opus_5_5_one_million_suffix:
    "3f217f7e8ef17fc851f54d8c14d242b481644f2f3fdc2cb23973f76bd8a4eed5",
  S11_extra_headers_accept_and_request_class:
    "b9cd37f78ea86d1ee1f15a264eddf4cb9b4b98434e75aa45d4793f5dd3d65ba4",
  S12_profile_override_custom_id:
    "b1c5d2cf575559856b57cdc23d57c9cd3c0942ba3c71f11f93c459e4229ab20b",
  S13_count_tokens:
    "e8bd72bc554b09f1014498eaf89ff567b1a684c860830d556e798687a9c642d2",
  S14_forced_tool_choice_under_thinking:
    "99d1ca6d16d7b083232a3980794c89335dd41bfeb3a3a0d0de496d82ea20cb23",
};

const EXPECTED_2_1_233: Readonly<Record<string, string>> = {
  S01_packed_consumer_input:
    "25fdbce5798549d676a9cfcbfc1b01226f09d9ef70ed816b48abf7ae945c4f68",
  S02_default_path_fixture_input:
    "12d5d0d34bfd95d7218983e67b5b3a6310346d9064b5d458f215f9943ca06d05",
  S03_opus_4_8_effort_high:
    "2f60535a92bafaf6c51b67166c8375fa902df10dad7d23908da16f6b6544d937",
  S04_sonnet_5_5_thinking:
    "2197e4a83334aab868fd4a509a293754a4218165a1ed8f9e69603fe5dd36f9a2",
  S05_haiku_5_5_thinking:
    "e1aa057641d77265f63e843f3098ee5712ad01d8ba434c4a833302ef5106eff6",
  S06_fable_5_2_thinking:
    "100432beed8400bdcb568d5c6d33630301e6a2d848f14528bb9b019d4932c2db",
  S07_mythos_5_2_thinking:
    "ff37cc94f7732764b22940ebb8f5256eeb249b578e5a7c81139b02a903e9a652",
  S08a_fable_5_dated:
    "80f50dcacc54a65340ff254661127b9008bb78776437982470baf7bbaf6e99a6",
  S08b_bedrock_sonnet_5_5:
    "0ea0daf8361d09b50fd70f211154aa77d2b11d225f565400d239bfe498849c70",
  S09_mythos_5_thinking_enabled:
    "71064b9cbb041457df0c573987b71a5220f9519fb5826d0a0d9a5b346fcf554f",
  S10_opus_5_5_one_million_suffix:
    "caf593b84d802e44002a44ce2b4a89cdd894ac7eedf870631d37772696bec326",
  S11_extra_headers_accept_and_request_class:
    "220f2e08d5625655259a43ff9b7e26b75fb66119cf9e6397730f498399fce7d3",
  S12_profile_override_custom_id:
    "a29dc58ffe9778c7156fd41c6a99de74a0a305df962a6ff739c4a60e292c9bb3",
  S13_count_tokens:
    "2663f1f15d8734ada3972ca935482405ce7e0ad7ac336e772878a8025fbe977c",
  S14_forced_tool_choice_under_thinking:
    "3ddf77c555a2c98fb75009453f9cf04a03fa75705bb2f46d19d3379f76e5c3da",
};

const EXPECTED_2_1_280: Readonly<Record<string, string>> = {
  S01_packed_consumer_input:
    "418fd0e5a22f2dfb152ebd36fac17ea87c32957a812963dd7569f93942a4e6a1",
  S02_default_path_fixture_input:
    "a45074b7f74c81d24e6c97a7376ee9762463ea65854627c97970df6c1ac6aade",
  S03_opus_4_8_effort_high:
    "bd518eef3b1c6e7ea06b88d477bb15a29e615328bc80fe49b05fe0e1ab462607",
  S04_sonnet_5_5_thinking:
    "6e151f81ed605b9fd178fc0cf9c8413b0414d60e6a2a286feb29c361c03ac4cb",
  S05_haiku_5_5_thinking:
    "d222724586c1f03d22cb0b58259eba11a0a3f9078c3765c8b0552db5d5105201",
  S06_fable_5_2_thinking:
    "df0257043eada19ef0bde2334e796869a8e8da189576daff405c8167d2bfc941",
  S07_mythos_5_2_thinking:
    "9ca77fd1da068cce7b10f430300e60afc272ba9414dbdceeb83f414c673bc83c",
  S08a_fable_5_dated:
    "261d9d3d81bd67b61cff5efd0fe14de3fcc0b529daa1a46952355caa9594bf2e",
  S08b_bedrock_sonnet_5_5:
    "c2341cd80f3c2df49d8a5c91f106840121813574d05baa7d65c222717c14bbb9",
  S09_mythos_5_thinking_enabled:
    "ac58e1fa602ecc5f0fc5a3a8cf89647a3d857c3dfcaa538c32fbde834431d5fc",
  S10_opus_5_5_one_million_suffix:
    "ae0d59fdc7bc5d968c34ef1d568731970766c95f43066e304ba72c837e1848f7",
  S11_extra_headers_accept_and_request_class:
    "2c5ba89d55cfdac990c91ad49a4e9220f07c3b235e923aee7f139a8f94ad87cc",
  S12_profile_override_custom_id:
    "2001e27146a3a12953f0bbccc8bb6ca8b5b9cb940dfc64446b306e713bd382d9",
  S13_count_tokens:
    "f937f0a6f1f1a93aa55278625fde2cf148d2d583ba9b4e2c7893dbff415aad37",
  S14_forced_tool_choice_under_thinking:
    "ef2fd80f00d7967a3c6e12e80fb2112da4ae355d8323d14cbb0c3151f4c531ee",
};

describe("prior profiles: pre-2.1.329 wire output is unchanged", () => {
  it("covers scenarios S01 to S14, S08 being two cases", () => {
    expect(Object.keys(REQUEST_INPUTS)).toHaveLength(14);
    expect(Object.keys(EXPECTED_2_1_195)).toHaveLength(15);
    expect(Object.keys(EXPECTED_2_1_233)).toHaveLength(15);
    expect(Object.keys(EXPECTED_2_1_280)).toHaveLength(15);
  });

  it("2.1.195", async () => {
    expect(await snapshotAll(CLAUDE_CODE_2_1_195_PROFILE)).toEqual(
      EXPECTED_2_1_195,
    );
  });

  it("2.1.233", async () => {
    expect(await snapshotAll(CLAUDE_CODE_2_1_233_PROFILE)).toEqual(
      EXPECTED_2_1_233,
    );
  });

  it("2.1.280", async () => {
    expect(await snapshotAll(CLAUDE_CODE_2_1_280_PROFILE)).toEqual(
      EXPECTED_2_1_280,
    );
  });
});
