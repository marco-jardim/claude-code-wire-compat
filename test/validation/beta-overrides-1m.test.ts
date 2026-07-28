// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  parseBuiltClaudeCodeRequest,
} from "../../src/index.js";

const LONG_CONTEXT_BETA = "context-1m-2025-08-07";

const BASE: ClaudeCodeRequestInput = {
  accessToken: "beta-overrides-token",
  model: "claude-sonnet-4-6",
  maxTokens: 1024,
  messages: [{ role: "user", content: "hello wire compat" }],
  runtime: {
    sessionId: "11111111-1111-4111-8111-111111111111",
    deviceId: "22222222-2222-4222-8222-222222222222",
    accountUuid: "33333333-3333-4333-8333-333333333333",
    runtime: "node",
    runtimeVersion: "22.0.0",
    os: "Linux",
    arch: "x64",
  },
  clientRequestId: "beta-overrides-request-1",
};

const MARKED: ClaudeCodeRequestInput = {
  ...BASE,
  model: "claude-sonnet-4-6[1m]",
};

describe("betaOverrides.use1MContext seam", () => {
  it("does not emit the beta on the default path", async () => {
    const built = await buildClaudeCodeRequest(BASE);

    expect(built.evidence.betaFeatures).not.toContain(LONG_CONTEXT_BETA);
  });

  it("emits the beta for a [1m]-marked model, as before the seam existed", async () => {
    const built = await buildClaudeCodeRequest(MARKED);

    expect(built.evidence.betaFeatures).toContain(LONG_CONTEXT_BETA);
  });

  it("forces the beta without the [1m] marker when the override is true", async () => {
    const built = await buildClaudeCodeRequest({
      ...BASE,
      betaOverrides: { use1MContext: true },
    });

    expect(built.evidence.betaFeatures).toContain(LONG_CONTEXT_BETA);
  });

  it("suppresses the beta for a [1m]-marked model when the override is false", async () => {
    const built = await buildClaudeCodeRequest({
      ...MARKED,
      betaOverrides: { use1MContext: false },
    });

    expect(built.evidence.betaFeatures).not.toContain(LONG_CONTEXT_BETA);
  });

  it("keeps the forced beta in canonical position, not appended at the end", async () => {
    const marked = await buildClaudeCodeRequest(MARKED);
    const forced = await buildClaudeCodeRequest({
      ...BASE,
      betaOverrides: { use1MContext: true },
    });

    expect(forced.evidence.betaFeatures).toEqual(marked.evidence.betaFeatures);
  });

  it("records the decision in evidence only when the override is supplied", async () => {
    const withoutOverride = await buildClaudeCodeRequest(BASE);
    const forced = await buildClaudeCodeRequest({
      ...BASE,
      betaOverrides: { use1MContext: true },
    });
    const suppressed = await buildClaudeCodeRequest({
      ...MARKED,
      betaOverrides: { use1MContext: false },
    });

    expect(
      Object.hasOwn(
        withoutOverride.evidence.capabilityDecisions,
        "use1MContext",
      ),
    ).toBe(false);
    expect(forced.evidence.capabilityDecisions.use1MContext).toBe(true);
    expect(suppressed.evidence.capabilityDecisions.use1MContext).toBe(false);
  });

  it("round-trips evidence carrying the override decision", async () => {
    const forced = await buildClaudeCodeRequest({
      ...BASE,
      betaOverrides: { use1MContext: true },
    });

    expect(parseBuiltClaudeCodeRequest(forced)).toEqual(forced);
  });

  it("leaves the canonical body untouched by the override", async () => {
    const withoutOverride = await buildClaudeCodeRequest(BASE);
    const forced = await buildClaudeCodeRequest({
      ...BASE,
      betaOverrides: { use1MContext: true },
    });

    expect(forced.body).toBe(withoutOverride.body);
  });

  it("rejects an empty override object", async () => {
    await expect(
      buildClaudeCodeRequest({ ...BASE, betaOverrides: {} }),
    ).resolves.toBeDefined();
  });

  it("rejects an unknown override key", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        betaOverrides: { useOneMillion: true },
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a non-boolean override value", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        betaOverrides: { use1MContext: "yes" },
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects a non-object override", async () => {
    await expect(
      buildClaudeCodeRequest({
        ...BASE,
        betaOverrides: true,
      } as unknown as ClaudeCodeRequestInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
