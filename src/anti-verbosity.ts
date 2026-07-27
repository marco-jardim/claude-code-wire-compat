// SPDX-License-Identifier: GPL-3.0-or-later

import type {
  AntiVerbosityPolicy,
  AntiVerbositySection,
  ClaudeCodeProtocolProfile,
} from "./contracts.js";
import { ClaudeCodeWireError } from "./contracts.js";
import { normalizeModelId } from "./model-identity.js";
import { CLAUDE_CODE_2_1_195_PROFILE } from "./profiles/claude-code-2.1.195.js";

/**
 * The genuine client's anti-verbosity system-prompt section, and the three-way
 * selector that chooses between its variants.
 *
 * Upstream this is `ytm(e)` at byte offset 238083640 of the
 * pinned client build. The four strings below were not transcribed by hand: they
 * were produced by executing the client's own template literals against stubbed
 * predicates. The forensic dump tooling collapses non-printable runs and so
 * cannot be trusted for whitespace inside a template literal; the branch-3
 * heading in particular is followed by a newline, not a space, which a
 * dump-based reading got wrong.
 *
 * The package EXPOSES this text and never injects it. `buildClaudeCodeRequest`
 * does not consult this module. The genuine client assembles a large system
 * prompt from many sections and this package models only the protocol envelope,
 * so silently adding one section would produce a body matching neither the
 * client nor the caller's intent. This is the same boundary already settled for
 * `defaultEffort` and for cache-breakpoint placement: expose, let the caller
 * decide.
 */

/** Mirrors upstream defaults: a stock first-party install reports both false. */
export const DEFAULT_ANTI_VERBOSITY_POLICY: AntiVerbosityPolicy = Object.freeze(
  {
    briefModeEnabled: false,
    pewterOwlToolEnabled: false,
  },
);

/**
 * Branch 1 with upstream `htm` true, which is the default because `htm` is
 * `!(isBriefEnabled() || pewterOwlTool())`. Carries the extra paragraph about
 * text written between tool calls.
 */
export const COMMUNICATING_WITH_THE_USER_FULL =
  "# Communicating with the user\n" +
  "\n" +
  "Your text output is what the user reads; they usually can't see your thinking or the raw tool results. Write it for a teammate who stepped away and is catching up, not for a log file: they don't know the codenames or shorthand you created along the way, and they didn't watch your process unfold. Before your first tool call, say in a sentence what you're about to do; while working, give brief updates when you find something load-bearing or change direction.\n" +
  "\n" +
  "Text you write between tool calls may not be shown to the user. Everything the user needs from this turn — answers, summaries, findings, conclusions, deliverables — must be in the final text message of your turn, with no tool calls after it. Keep text between tool calls to brief status notes. If something important appeared only mid-turn or in your thinking, restate it in that final message.\n" +
  "\n" +
  'Lead with the outcome. Your first sentence after finishing should answer "what happened" or "what did you find" — the thing the user would ask for if they said "just give me the TLDR." Supporting detail and reasoning come after, for readers who want them.\n' +
  "\n" +
  "Being readable and being concise are different things, and readable matters more. If the user has to reread your summary or ask you to explain, any time saved by brevity is gone. The way to keep output short is to be selective about what you include (drop details that don't change what the reader would do next), not to compress the writing into fragments, abbreviations, arrow chains like `A → B → fails`, or jargon. What you do include, write in complete sentences with the technical terms spelled out. Don't make the reader cross-reference labels or numbering you invented earlier; say what you mean in place.\n" +
  "\n" +
  "Match the response to the question: a simple question gets a direct answer in prose, not headers and sections. Use tables only for short enumerable facts, with explanations in the surrounding prose rather than the cells. Calibrate to the user — a bit tighter for an expert, more explanatory for someone newer.\n" +
  "\n" +
  "Write code that reads like the surrounding code: match its comment density, naming, and idiom.\n" +
  "Only write a code comment to state a constraint the code itself can't show — never to say where it came from, what the next line does, or why your change is correct; that's you talking to the reviewer, not the next reader, and it's noise the moment the PR merges.";

/** Branch 1 with upstream `htm` false: brief mode or the pewter-owl tool is on. */
export const COMMUNICATING_WITH_THE_USER_CONDENSED =
  "# Communicating with the user\n" +
  "\n" +
  "Your text output is what the user reads between tool calls; they usually can't see your thinking or the raw tool results. Write it for a teammate who stepped away and is catching up, not for a log file: they don't know the codenames or shorthand you created along the way, and they didn't watch your process unfold. Before your first tool call, say in a sentence what you're about to do; while working, give brief updates when you find something load-bearing or change direction.\n" +
  "\n" +
  'Lead with the outcome. Your first sentence after finishing should answer "what happened" or "what did you find" — the thing the user would ask for if they said "just give me the TLDR." Supporting detail and reasoning come after, for readers who want them.\n' +
  "\n" +
  "Being readable and being concise are different things, and readable matters more. If the user has to reread your summary or ask you to explain, any time saved by brevity is gone. The way to keep output short is to be selective about what you include (drop details that don't change what the reader would do next), not to compress the writing into fragments, abbreviations, arrow chains like `A → B → fails`, or jargon. What you do include, write in complete sentences with the technical terms spelled out. Don't make the reader cross-reference labels or numbering you invented earlier; say what you mean in place.\n" +
  "\n" +
  "Match the response to the question: a simple question gets a direct answer in prose, not headers and sections. Use tables only for short enumerable facts, with explanations in the surrounding prose rather than the cells. Calibrate to the user — a bit tighter for an expert, more explanatory for someone newer.\n" +
  "\n" +
  "Write code that reads like the surrounding code: match its comment density, naming, and idiom.\n" +
  "Only write a code comment to state a constraint the code itself can't show — never to say where it came from, what the next line does, or why your change is correct; that's you talking to the reviewer, not the next reader, and it's noise the moment the PR merges.";

/** Branch 2, upstream `ph(e)` true. A single sentence. */
export const LEAN_SECTION =
  "Write code that reads like the surrounding code: match its comment density, naming, and idiom.";

/** Branch 3, the fallthrough. */
export const TEXT_OUTPUT_SECTION =
  "# Text output (does not apply to tool calls)\n" +
  "Assume users can't see most tool calls or thinking — only your text output. Before your first tool call, state in one sentence what you're about to do. While working, give short updates at key moments: when you find something, when you change direction, or when you hit a blocker. Brief is good — silent is not. One sentence per update is almost always enough.\n" +
  "\n" +
  "Don't narrate your internal deliberation. User-facing text should be relevant communication to the user, not a running commentary on your thought process. State results and decisions directly, and focus user-facing text on relevant updates for the user.\n" +
  "\n" +
  "When you do write updates, write so the reader can pick up cold: complete sentences, no unexplained jargon or shorthand from earlier in the session. But keep it tight — a clear sentence is better than a clear paragraph.\n" +
  "\n" +
  "End-of-turn summary: one or two sentences. What changed and what's next. Nothing else.\n" +
  "\n" +
  "Match responses to the task: a simple question gets a direct answer, not headers and sections.\n" +
  "\n" +
  "In code: default to writing no comments. Never write multi-paragraph docstrings or multi-line comment blocks — one short line max. Don't create planning, decision, or analysis documents unless the user asks for them — work from conversation context, not intermediate files.";

/**
 * SHA-256 of each constant as executed from the genuine client. A test pins
 * these so any edit to the text above fails loudly rather than silently
 * shipping a divergent prompt.
 */
export const ANTI_VERBOSITY_DIGESTS = Object.freeze({
  communicatingWithTheUserFull:
    "41a8a87303e6f6f8224906daf9741fd6be495b79400854d92078991d15e9c56c",
  communicatingWithTheUserCondensed:
    "7028dc6d1492b7616b9b5f2f58416c09a0db5cd671f1032fbaeb9120ad51437b",
  lean: "ee43af37398581e92bde06d341c98c7b7a9ff6c56023c2bc17b9feaf2d6e31ea",
  textOutput:
    "c184a5d4b4b6a0fc374a37c69f72937abf38bcccaa2d0cce0427968fcda3ccc7",
});

/** Upstream `i_e`, deliberately applied to the RAW caller string. */
const EAP_PATTERN = /-eap($|\[)/iu;

function catalogueCapability(
  normalizedId: string,
  capability: string,
  profile: ClaudeCodeProtocolProfile,
): boolean {
  if (!Object.hasOwn(profile.supportedModels, normalizedId)) return false;
  return (
    profile.supportedModels[normalizedId]?.capabilities.includes(capability) ===
    true
  );
}

/**
 * Upstream `Mte`. This is one of the few places where the catalogue capability
 * array is genuinely load-bearing: unlike the nine model-capability predicates,
 * `Mte` has no provider fallback, so the membership test decides the result.
 */
function hasFableMitigations(
  normalizedId: string,
  profile: ClaudeCodeProtocolProfile,
): boolean {
  return (
    catalogueCapability(normalizedId, "fable_5_mitigations", profile) ||
    normalizedId === "claude-mythos-5"
  );
}

/**
 * Upstream `Kkd`. Its trailing `return !td()` is false on the first-party
 * provider this profile pins, so an unrecognised identifier falls through to
 * the lean branch rather than the text-output branch.
 *
 * Upstream also carries `|| t === "claude-mythos-5"` beside the
 * `lean_prompt` test. It is omitted here because it is unreachable: the only
 * caller tests `hasFableMitigations` first, which already claims mythos-5 for
 * the communicating-with-the-user branch. Upstream shares `Kkd` with other
 * call sites and so still needs it. Restore it if this helper ever gains a
 * second caller.
 */
function usesTextOutputSection(
  rawModel: string,
  profile: ClaudeCodeProtocolProfile,
): boolean {
  if (EAP_PATTERN.test(rawModel)) return false;
  const id = normalizeModelId(rawModel);
  if (catalogueCapability(id, "lean_prompt", profile)) return false;
  return (
    id.includes("claude-3-") ||
    id.includes("haiku") ||
    id.includes("sonnet") ||
    id === "claude-opus-4-0" ||
    id === "claude-opus-4-1" ||
    id === "claude-opus-4-5" ||
    id === "claude-opus-4-6" ||
    id === "claude-opus-4-7"
  );
}

/**
 * Reports which branch of upstream `ytm` a model selects.
 *
 * Upstream `gtm` is `return !1`, so branch 1 is gated on `Mte` alone. Note
 * that `ytm` passes the NORMALISED id to `Mte` but the RAW caller string to
 * `ph`, because `ph` reaches `i_e`, which must see an unnormalised
 * `-eap` suffix. That asymmetry is reproduced here.
 */
export function selectAntiVerbositySection(
  rawModel: string,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): AntiVerbositySection {
  if (typeof rawModel !== "string" || rawModel.length === 0) {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  if (hasFableMitigations(normalizeModelId(rawModel), profile)) {
    return "communicating-with-the-user";
  }
  return usesTextOutputSection(rawModel, profile) ? "text-output" : "lean";
}

/** Returns the exact section text the genuine client would emit for a model. */
export function antiVerbosityText(
  rawModel: string,
  policy: AntiVerbosityPolicy = DEFAULT_ANTI_VERBOSITY_POLICY,
  profile: ClaudeCodeProtocolProfile = CLAUDE_CODE_2_1_195_PROFILE,
): string {
  // Validated eagerly, and for every section rather than only the one that
  // reads it, so a malformed policy fails the same way regardless of which
  // model it is paired with. `selectAntiVerbositySection` validates its own
  // argument the same way despite the declared types, because callers reach
  // this module across an untyped boundary.
  const candidate: unknown = policy;
  if (candidate === null || typeof candidate !== "object") {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  const brief: unknown = Reflect.get(candidate, "briefModeEnabled");
  const pewterOwl: unknown = Reflect.get(candidate, "pewterOwlToolEnabled");
  if (typeof brief !== "boolean" || typeof pewterOwl !== "boolean") {
    throw new ClaudeCodeWireError("INVALID_INPUT");
  }
  const section = selectAntiVerbositySection(rawModel, profile);
  if (section === "lean") return LEAN_SECTION;
  if (section === "text-output") return TEXT_OUTPUT_SECTION;
  return brief || pewterOwl
    ? COMMUNICATING_WITH_THE_USER_CONDENSED
    : COMMUNICATING_WITH_THE_USER_FULL;
}
