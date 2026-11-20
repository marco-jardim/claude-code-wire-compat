// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  buildClaudeCodeRequest,
} from "../../src/index.js";
import {
  referenceAdapter,
  syntheticInput,
} from "../conformance/reference-adapter.js";

/*
 * Inputs introduced for 2.1.329 must be inert on every earlier profile. The
 * reference is the sealed 2.1.280 default-path fixture: building its input with
 * the new inputs added must give the same bytes as building it without them,
 * and those bytes are the fixture's own.
 *
 * Later ports of 2.1.329-only inputs extend the `NEW_INPUTS` table below.
 */

const NEW_INPUTS = {
  turnOrigin: "human",
  turnPosition: { promptIndex: 1, turnIndex: 1 },
  toolsUsed: [{ name: "Read" }, { name: "mcp__server__tool", mcp: true }],
} as const;

describe("2.1.329-only inputs are inert on 2.1.280", () => {
  const reference = referenceAdapter("outgoing-default-path-2.1.280.json");
  const input = syntheticInput(reference);

  it("reproduces the sealed fixture bytes without the inputs", async () => {
    const built = await buildClaudeCodeRequest(
      input,
      CLAUDE_CODE_2_1_280_PROFILE,
    );

    expect(built.url).toBe(reference.url);
    expect(built.method).toBe(reference.method);
    expect(built.body).toBe(JSON.stringify(reference.body));
  });

  it("emits the same bytes with the inputs added", async () => {
    const plain = await buildClaudeCodeRequest(
      input,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const withInputs = await buildClaudeCodeRequest(
      { ...input, ...NEW_INPUTS },
      CLAUDE_CODE_2_1_280_PROFILE,
    );

    expect(withInputs.body).toBe(JSON.stringify(reference.body));
    expect(withInputs.body).toBe(plain.body);
    expect(withInputs.headers).toEqual(plain.headers);
    expect(withInputs.url).toBe(plain.url);
    expect(withInputs.evidence).toEqual(plain.evidence);
    expect(withInputs.body).not.toContain("cc_turn_origin");
    expect(withInputs.body).not.toContain("cc_prompt_index");
  });

  it("emits no 2.1.329 header for the tools-used input or the prompt id", async () => {
    const plain = await buildClaudeCodeRequest(
      input,
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const withInputs = await buildClaudeCodeRequest(
      {
        ...input,
        ...NEW_INPUTS,
        promptId: "00000000-0000-4000-8000-000000000003",
      },
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const headerNames = withInputs.headers.map(([name]) => name);

    // The prompt id still feeds the billing text on 2.1.280 (an existing
    // behaviour); only the headers are asserted unchanged here.
    expect(withInputs.headers).toEqual(plain.headers);
    expect(headerNames).not.toContain("x-claude-code-sandy-plover");
    expect(headerNames).not.toContain("x-claude-code-prompt-id");
    expect(headerNames).not.toContain("Accept");
    expect(headerNames).toEqual(headerNames.map((name) => name.toLowerCase()));
  });

  it("changes only the cch characters when a cch value is added", async () => {
    const plain = await buildClaudeCodeRequest(
      { ...input, ...NEW_INPUTS },
      CLAUDE_CODE_2_1_280_PROFILE,
    );
    const withCch = await buildClaudeCodeRequest(
      { ...input, ...NEW_INPUTS, cch: "abcde" },
      CLAUDE_CODE_2_1_280_PROFILE,
    );

    expect(withCch.body.replace("cch=abcde;", "cch=00000;")).toBe(plain.body);
    expect(withCch.headers).toEqual(plain.headers);
  });
});

describe("2.1.329-only inputs are inert on the other earlier profiles", () => {
  it.each([
    ["2.1.195", CLAUDE_CODE_2_1_195_PROFILE],
    ["2.1.233", CLAUDE_CODE_2_1_233_PROFILE],
  ])("%s", async (_name, profile) => {
    const input = syntheticInput(
      referenceAdapter("outgoing-default-path-2.1.280.json"),
    );
    const plain = await buildClaudeCodeRequest(input, profile);
    const withInputs = await buildClaudeCodeRequest(
      { ...input, ...NEW_INPUTS },
      profile,
    );

    expect(withInputs).toEqual(plain);
  });
});
