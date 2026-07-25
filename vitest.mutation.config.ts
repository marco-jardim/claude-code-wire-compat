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
    },
  }),
);
