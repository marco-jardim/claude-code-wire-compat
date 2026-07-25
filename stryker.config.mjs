// SPDX-License-Identifier: GPL-3.0-or-later

export default {
  mutate: ["src/**/*.ts"],
  testRunner: "vitest",
  reporters: ["clear-text", "progress"],
  thresholds: { high: 90, low: 80, break: 80 },
  coverageAnalysis: "perTest",
};
