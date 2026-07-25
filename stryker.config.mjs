// SPDX-License-Identifier: GPL-3.0-or-later

export default {
  mutate: ["src/**/*.ts"],
  testRunner: "vitest",
  vitest: { configFile: "vitest.mutation.config.ts" },
  reporters: ["clear-text", "progress", "json"],
  incremental: true,
  incrementalFile: "reports/mutation/incremental.json",
  /*
   * `break` is the enforced floor. The implementation plan requires a mutation
   * score of at least 90% overall, so the build must fail below that rather
   * than at the Stryker default of 80.
   */
  thresholds: { high: 95, low: 90, break: 90 },
  coverageAnalysis: "perTest",
  /*
   * Instrumented mutant runs are much slower than the baseline suite, and the
   * dry run establishes the reference duration. Give slow-but-valid mutants
   * room so they are reported as survived or killed on their merits instead of
   * being recorded as timeouts.
   */
  timeoutMS: 60_000,
  timeoutFactor: 2,
};
