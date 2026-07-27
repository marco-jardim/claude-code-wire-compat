import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import vitest from "@vitest/eslint-plugin";

export default tseslint.config(
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "node_modules/**",
      ".com466-evidence/**",
      ".opencode/**",
      "coverage-*/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // The mutation-testing signal (Stryker) was removed for being too slow and
    // costly in CI. These vitest lint rules are the cheap replacement: they
    // statically catch the test-quality regressions mutation testing used to
    // surface behaviourally — assertion-free tests, conditional or misplaced
    // expects, focused/disabled tests, and duplicate titles.
    files: ["test/**/*.ts"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-disabled-tests": "error",
      // Many suites assert through named wrappers (expectInvalid,
      // expectWireError, assertSecretSafe, ...) rather than a bare `expect`.
      // Teach the rule those names via glob so it still flags a test that makes
      // no assertion at all, without false-positiving on helper-based ones.
      "vitest/expect-expect": [
        "error",
        { assertFunctionNames: ["expect", "expect*", "assert*"] },
      ],
      // Deliberately off. This suite relies on guarded conditional assertions
      // that are correct and not vacuous: loops that assert each iteration
      // throws with a specific `.code` and fail via a trailing `throw` when it
      // does not, and type-narrowing guards placed after an explicit
      // `toBeDefined()`. Rewriting them to satisfy this rule would drop the
      // per-case code assertions or reduce readability without adding signal.
      "vitest/no-conditional-expect": "off",
    },
    settings: { vitest: { typecheck: true } },
  },
  {
    // Untyped JavaScript tooling (root configs and `scripts/**`). The globs must
    // be recursive: a bare `*.mjs` matches only repository-root files, which
    // silently left `scripts/verify-drift.mjs` without a parser project.
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
);
// SPDX-License-Identifier: GPL-3.0-or-later
