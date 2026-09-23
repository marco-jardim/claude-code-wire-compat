// SPDX-License-Identifier: GPL-3.0-or-later

// Shared parser for the output of `npm pack --json`.

/**
 * npm 12 changed `npm pack --json` from an array of pack results to an
 * object keyed by package name. Accept both so the gates that consume it do
 * not depend on the contributor's npm major version.
 *
 * A non-null object that itself carries an own `filename` property is
 * returned as-is, before the keyed-object fallback. A future npm that emits
 * the single pack result as a flat object would otherwise be silently misread
 * into the value of its first property, and the failure would surface as a
 * confusing "expected undefined" rather than a shape error.
 *
 * @param {string} packOutput raw stdout of `npm pack --json`
 * @returns {{filename?: string} | undefined} the first reported pack result
 */
export function firstPackResult(packOutput) {
  const parsed = JSON.parse(packOutput);
  if (Array.isArray(parsed)) return parsed[0];
  if (parsed !== null && typeof parsed === "object") {
    if (Object.hasOwn(parsed, "filename")) return parsed;
    return Object.values(parsed)[0];
  }
  return undefined;
}
