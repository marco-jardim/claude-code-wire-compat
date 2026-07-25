import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "node_modules/**",
      ".com466-evidence/**",
      ".opencode/**",
      ".stryker-tmp/**",
      "coverage-*/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: [
      "src/**/*.ts",
      "test/**/*.ts",
      "vitest.config.ts",
      "vitest.mutation.config.ts",
    ],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
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
