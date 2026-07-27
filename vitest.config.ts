import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "json-summary"],
      // Raised when Stryker mutation testing was removed: coverage is now the
      // primary structural floor, so these are pinned just below the measured
      // level (98.82 / 98.39 / 100 / 99.61) to lock it in while leaving a small
      // margin for ordinary refactors. Coverage cannot detect a weak assertion
      // over covered code the way mutation testing did; the @vitest/eslint-plugin
      // rules in `npm run lint` are the complementary test-quality signal.
      thresholds: {
        statements: 98,
        lines: 99,
        functions: 100,
        branches: 97,
      },
    },
  },
});
// SPDX-License-Identifier: GPL-3.0-or-later
