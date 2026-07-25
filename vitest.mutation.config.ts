// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig, mergeConfig } from "vitest/config";

import base from "./vitest.config.js";

/*
 * Governance tests assert source text rather than runtime behavior. Stryker
 * rewrites source files during instrumentation, so those assertions cannot
 * evaluate mutants honestly and would inflate the mutation score by detecting
 * Stryker's injected text instead of behavioral changes.
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: ["test/governance/**"],
      /*
       * Stryker instruments every source file and runs many test-runner
       * processes concurrently, so wall-clock time per test is far higher than
       * in a normal run. The default 5s limit fails the property suite during
       * the dry run even though it completes in well under a second normally.
       * Raising the limit here only affects mutation runs; the base config
       * keeps the strict default for ordinary test runs.
       */
      testTimeout: 120_000,
      hookTimeout: 120_000,
    },
  }),
);
