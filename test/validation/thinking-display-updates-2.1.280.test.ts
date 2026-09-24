// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { composeBetasWithAudit } from "../../src/betas.js";
import type { ComposeBetasInput } from "../../src/betas.js";
import type { ClaudeCodeProtocolProfile } from "../../src/contracts.js";
import type { ClaudeCodeRequestInput } from "../../src/index.js";
import {
  buildClaudeCodeRequest,
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
} from "../../src/index.js";
import { deriveCapabilities } from "../../src/model-capabilities.js";

/*
 * Push site 12b on the 2.1.280 profile is a coupled beta/body pair: it pushes
 * `thinking-display-updates-2026-08-18`, sets `display: "updates"` on the body's
 * `thinking` object, and removes the `redact-thinking-2026-02-12` beta that
 * site 5 composed earlier. It fires when experimental betas are enabled,
 * thinking is active, and the caller supplied no `thinking.display`.
 *
 * Site 5 (redact-thinking) does NOT read thinking activity: it is gated on
 * experimental betas, the interleaved-thinking capability, the interactive
 * policy, thinking summaries not shown, and no caller display. So "no
 * redact-thinking in the header" has two distinct causes, and several cases
 * below exist to tell them apart.
 */

const UPDATES = "thinking-display-updates-2026-08-18";
const REDACT = "redact-thinking-2026-02-12";
const BINDING = "thinking-binding-controls-2026-08-01";
const CACHE_DIAGNOSIS = "cache-diagnosis-2026-04-07";

const MODEL = "claude-opus-5-5";

const BASE_INPUT: ClaudeCodeRequestInput = {
  accessToken: "thinking-display-updates-token",
  model: MODEL,
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
  clientRequestId: "thinking-display-updates-request-1",
  thinking: { type: "adaptive" },
};

interface Built {
  readonly betas: readonly string[];
  readonly body: string;
}

async function build(
  overrides: Partial<ClaudeCodeRequestInput>,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_280_PROFILE,
): Promise<Built> {
  const request = await buildClaudeCodeRequest(
    { ...BASE_INPUT, ...overrides },
    profile,
  );
  const header = request.headers.find(
    ([name]) => name.toLowerCase() === "anthropic-beta",
  );
  expect(header).toBeDefined();
  const betas =
    header === undefined
      ? []
      : header[1]
          .split(",")
          .map((beta) => beta.trim())
          .filter((beta) => beta.length > 0);
  return { betas, body: request.body };
}

function withExperimental(
  profile: ClaudeCodeProtocolProfile,
  experimentalBetasEnabled: boolean,
): ClaudeCodeProtocolProfile {
  return {
    ...profile,
    betaPolicy: { ...profile.betaPolicy, experimentalBetasEnabled },
  };
}

/** Unit-level input for the real 2.1.280 catalogue entry of `MODEL`. */
function unitInput(thinkingActive: boolean): ComposeBetasInput {
  return {
    rawModel: MODEL,
    normalizedId: MODEL,
    capabilities: deriveCapabilities(MODEL, CLAUDE_CODE_2_1_280_PROFILE),
    thinkingDisplayActive: false,
    thinkingActive,
  };
}

describe("2.1.280 thinking-display-updates (site 12b)", () => {
  describe("caller-supplied display", () => {
    it('caller display "summarized" suppresses both the beta and the injection', async () => {
      const { betas, body } = await build({
        thinking: { type: "adaptive", display: "summarized" },
      });
      expect(betas).not.toContain(UPDATES);
      // This absence is site 5 never firing (its guard requires no caller
      // display), NOT the site-12b removal: site 12b is silent here too.
      expect(betas).not.toContain(REDACT);
      expect(body).toContain('"display":"summarized"');
      expect(body).not.toContain('"display":"updates"');
    });

    it('caller display "omitted" behaves the same', async () => {
      const { betas, body } = await build({
        thinking: { type: "adaptive", display: "omitted" },
      });
      expect(betas).not.toContain(UPDATES);
      // As above: site 5 never pushed redact-thinking; nothing was removed.
      expect(betas).not.toContain(REDACT);
      expect(body).toContain('"display":"omitted"');
      expect(body).not.toContain('"display":"updates"');
    });
  });

  describe("thinking disabled", () => {
    it("thinking disabled emits neither thinking beta and no display field", async () => {
      const { betas, body } = await build({ thinking: { type: "disabled" } });
      expect(betas).not.toContain(BINDING);
      expect(betas).not.toContain(UPDATES);
      expect(body).not.toContain('"display"');
      // Site 5's guard does not read thinking activity, so it pushes
      // redact-thinking regardless; with site 12b silent nothing removes it.
      expect(betas).toContain(REDACT);
    });
  });

  describe("composed then removed", () => {
    it("redact-thinking is composed and then removed when site 12b fires", () => {
      /*
       * The two compositions differ ONLY in `thinkingActive`. Site 5's guard
       * reads neither `thinkingActive` nor anything else that differs here
       * (`thinkingDisplayActive` is false in both), so site 5 pushed
       * redact-thinking in BOTH compositions -- the `false` case shows it
       * surviving. Its absence in the `true` case can therefore only be the
       * site-12b removal. This is what replaces an audit field: the package
       * deliberately records nothing extra for an inert or self-cancelling
       * site, so the fact is pinned behaviourally instead.
       */
      const inactive = composeBetasWithAudit(
        unitInput(false),
        CLAUDE_CODE_2_1_280_PROFILE,
      );
      const active = composeBetasWithAudit(
        unitInput(true),
        CLAUDE_CODE_2_1_280_PROFILE,
      );

      expect(inactive.betas).toContain(REDACT);
      expect(inactive.betas).not.toContain(UPDATES);

      expect(active.betas).toContain(UPDATES);
      expect(active.betas).not.toContain(REDACT);
    });
  });

  describe("enabled thinking path", () => {
    it("thinking enabled with a manual budget still injects updates", async () => {
      /*
       * `claude-opus-4-5` is catalogued on 2.1.280 with only
       * `context_management`, so it derives no `adaptiveThinking` while still
       * deriving `thinking` and `interleavedThinking`; the resolved type is
       * therefore `"enabled"`. The expected key order `budget_tokens, type,
       * display` is transcribed from
       * `docs/protocol/versions/claude-code-2.1.280-analysis.md`, which records
       * the enabled-path construction as
       * `yc = {budget_tokens:hf, type:"enabled", display:Vg}`.
       */
      const { betas, body } = await build({
        model: "claude-opus-4-5",
        maxTokens: 16000,
        thinking: { type: "enabled", budgetTokens: 4096 },
      });
      expect(betas).toContain(UPDATES);
      expect(body).toContain(
        '"thinking":{"budget_tokens":4096,"type":"enabled","display":"updates"}',
      );
    });
  });

  describe("experimental gate", () => {
    it("experimental false suppresses the beta and the body override together", () => {
      const on = composeBetasWithAudit(
        unitInput(true),
        withExperimental(CLAUDE_CODE_2_1_280_PROFILE, true),
      );
      const off = composeBetasWithAudit(
        unitInput(true),
        withExperimental(CLAUDE_CODE_2_1_280_PROFILE, false),
      );

      expect(on.betas).toContain(UPDATES);
      expect(on.thinkingDisplayOverride).toBe("updates");

      expect(off.betas).not.toContain(UPDATES);
      expect(off.thinkingDisplayOverride).toBeUndefined();
    });
  });

  describe("frozen profiles", () => {
    it("the 2.1.233 default path still carries redact-thinking and no display", async () => {
      const { betas, body } = await build({}, CLAUDE_CODE_2_1_233_PROFILE);
      expect(betas).toContain(REDACT);
      expect(betas).not.toContain(UPDATES);
      expect(body).not.toContain('"display"');
    });

    it("the 2.1.233 top-level body key order is unchanged", async () => {
      /*
       * This array was captured from current behaviour, NOT derived from any
       * analysis document. Its job is to catch a FUTURE key-order regression at
       * unit level instead of letting it surface later as a moved digest.
       */
      const { body } = await build({}, CLAUDE_CODE_2_1_233_PROFILE);
      expect(Object.keys(JSON.parse(body) as object)).toEqual([
        "model",
        "max_tokens",
        "system",
        "messages",
        "thinking",
        "metadata",
      ]);
    });

    it("2.1.195 never emits the updates override", async () => {
      const { betas, body } = await build({}, CLAUDE_CODE_2_1_195_PROFILE);
      expect(betas).not.toContain(UPDATES);
      expect(body).not.toContain('"display"');
    });
  });

  describe("caller seams", () => {
    it("a caller-supplied redact-thinking in additionalBetas survives the removal", async () => {
      /*
       * The site-12b removal runs before the caller merge, so when the merge
       * asks "not already present?" the answer is yes and the caller's entry is
       * re-added, after every canonical identifier.
       */
      const { betas } = await build({ additionalBetas: [REDACT] });
      expect(betas).toContain(UPDATES);
      expect(betas).toContain(REDACT);
      const redactAt = betas.indexOf(REDACT);
      const diagnosisAt = betas.indexOf(CACHE_DIAGNOSIS);
      expect(redactAt).not.toBe(-1);
      expect(diagnosisAt).not.toBe(-1);
      expect(redactAt).toBeGreaterThan(diagnosisAt);
      expect(redactAt).toBe(betas.length - 1);
    });

    it("suppressing the beta removes the header but keeps the body field", async () => {
      /*
       * Established coupled-pair behaviour: suppression is a header-list
       * filter only, exactly as suppressing `effort-2025-11-24` leaves
       * `output_config.effort` in the body.
       */
      const { betas, body } = await build({ suppressBetas: [UPDATES] });
      expect(betas).not.toContain(UPDATES);
      expect(body).toContain('"display":"updates"');
    });
  });
});
