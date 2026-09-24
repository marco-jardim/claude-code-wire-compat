// SPDX-License-Identifier: GPL-3.0-or-later

// Installs the package tarball into isolated consumers and compares their output.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Miniflare } from "miniflare";

import { firstPackResult } from "./lib/pack-json.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = resolve(process.env.TEMP ?? tmpdir());
const consumerNames = [
  "com466-pack-node",
  "com466-pack-bun",
  "com466-pack-workerd",
];
const consumerDirectories = consumerNames.map((name) =>
  join(temporaryRoot, name),
);
/*
 * The cases every consumer runs, in this order.
 *
 * `default` exercises the package's implicit default and is what this script
 * has always measured. It is kept, but it is no longer the only signal: a
 * default switch moves it by design, which is precisely why it cannot be the
 * canary for an unintended change. The explicit cases are the canary — each
 * names its profile, so its digest is a statement about THAT profile and must
 * not move for any reason other than a change to that profile's own wire
 * output.
 *
 * The request input is identical across cases on purpose, so the profile is
 * the only variable between their digests. The model is catalogued
 * identically by both profiles, which keeps the comparison about profile
 * scalars and beta composition rather than about catalogue deltas.
 */
const CASE_NAMES = ["default", "2.1.195", "2.1.233", "2.1.280"];
/*
 * The frozen digests the explicit cases must reproduce. A mismatch means a
 * code change altered the wire output of a profile that was supposed to be
 * untouched. The correct response is to find and revert that cause — NEVER
 * to update a literal here to match the new output.
 *
 * `default` is deliberately not pinned to a literal: switching
 * `DEFAULT_PROFILE` moves it on purpose. It is pinned instead to the case name
 * it must currently agree with, so a default switch is a deliberate one-line
 * change to `EXPECTED_DEFAULT_CASE` and is still verified rather than going
 * unobserved.
 *
 * A case listed in `CASE_NAMES` but absent from `EXPECTED_DIGESTS` is
 * intentionally unpinned; that is how a newly added profile behaves until its
 * digest is first recorded.
 */
const EXPECTED_DIGESTS = {
  "2.1.195": "6b9609b29463c890544845dd94acf560206b6f8165538faafd8886750037d277",
  "2.1.233": "4e06af42310d63549a4fa9af60ff0c9b13e95d7864624c6b7bf94d45ce9a3997",
  "2.1.280": "9a531ed01ddd3440ce5b7f25c6caf5f045a9b4e78d885b5317508e21a22ada90",
};
const EXPECTED_DEFAULT_CASE = "2.1.233";
const consumerSource = `
import {
  CLAUDE_CODE_2_1_195_PROFILE,
  CLAUDE_CODE_2_1_233_PROFILE,
  CLAUDE_CODE_2_1_280_PROFILE,
  buildClaudeCodeRequest,
} from "@tormentalabs/claude-code-wire-compat";

const token = "test-token-not-a-secret";
const input = {
  accessToken: token,
  model: "claude-sonnet-4-5",
  maxTokens: 128,
  messages: [{ role: "user", content: "hello wire compat" }],
  system: ["synthetic system prompt"],
  runtime: {
    sessionId: "00000000-0000-4000-8000-000000000001",
    deviceId: "0000000000000000000000000000000000000000000000000000000000000002",
    accountUuid: "00000000-0000-4000-8000-000000000000",
    runtime: "node",
    runtimeVersion: "v24.15.0",
    os: "Windows",
    arch: "x64",
  },
  clientRequestId: "00000000-0000-4000-8000-000000000002",
};

async function digestFor(profile) {
  const request =
    profile === undefined
      ? await buildClaudeCodeRequest(input)
      : await buildClaudeCodeRequest(input, profile);
  const headers = [...new Headers(request.headers).entries()]
    .filter(([name]) => name !== "authorization" && name !== "x-api-key")
    .sort(([left], [right]) => left.localeCompare(right));
  const normalized = {
    url: request.url,
    method: request.method,
    headers,
    body: request.body,
  };
  const serialized = JSON.stringify(normalized);
  if (serialized.includes(token)) {
    throw new Error("Normalized request contains the synthetic token");
  }
  const digestBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serialized),
  );
  return [...new Uint8Array(digestBytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const report = {
  digests: {
    "default": await digestFor(undefined),
    "2.1.195": await digestFor(CLAUDE_CODE_2_1_195_PROFILE),
    "2.1.233": await digestFor(CLAUDE_CODE_2_1_233_PROFILE),
    "2.1.280": await digestFor(CLAUDE_CODE_2_1_280_PROFILE),
  },
};
`;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function npmCliPath() {
  const candidates = [];
  if (process.env.npm_execpath) {
    candidates.push(process.env.npm_execpath);
  }
  try {
    candidates.push(
      createRequire(import.meta.url).resolve("npm/bin/npm-cli.js"),
    );
  } catch (error) {
    if (
      error?.code !== "MODULE_NOT_FOUND" &&
      error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED"
    ) {
      throw error;
    }
  }
  candidates.push(
    resolve(
      dirname(process.execPath),
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js",
    ),
  );
  const npmCli = candidates.find((candidate) => existsSync(candidate));
  if (!npmCli) {
    throw new Error(
      `Unable to locate npm CLI; checked: ${candidates.join(", ")}`,
    );
  }
  return npmCli;
}

function npm(args, options = {}) {
  return run(process.execPath, [npmCliPath(), ...args], options);
}

function safeRemove(directory) {
  const pathFromTemp = relative(temporaryRoot, directory);
  if (
    !directory.includes("com466-pack-") ||
    pathFromTemp === "" ||
    pathFromTemp.startsWith("..") ||
    isAbsolute(pathFromTemp)
  ) {
    throw new Error(`Refusing to remove unsafe temporary path: ${directory}`);
  }
  rmSync(directory, { recursive: true, force: true });
}

function parseDigests(output, runtime) {
  const lines = output.split(/\r?\n/u).filter(Boolean);
  const report = JSON.parse(lines.at(-1));
  const digests = report.digests;
  if (digests === null || typeof digests !== "object") {
    throw new Error(`${runtime} did not return digests`);
  }
  // Exact case set, not a subset: a consumer that silently skips a profile
  // would otherwise pass by reporting fewer digests than it was asked for.
  if (JSON.stringify(Object.keys(digests)) !== JSON.stringify(CASE_NAMES)) {
    throw new Error(
      `${runtime} reported cases ${JSON.stringify(Object.keys(digests))}`,
    );
  }
  for (const name of CASE_NAMES) {
    if (typeof digests[name] !== "string" || digests[name].length !== 64) {
      throw new Error(`${runtime} did not return a digest for ${name}`);
    }
  }
  return digests;
}

if (!existsSync(temporaryRoot)) {
  throw new Error(`OS temporary directory does not exist: ${temporaryRoot}`);
}

let tarballPath;
try {
  for (const directory of consumerDirectories) {
    safeRemove(directory);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "package.json"),
      `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
    );
  }

  const packResult = firstPackResult(
    npm(["pack", "--json", "--ignore-scripts"], {
      cwd: repositoryRoot,
    }),
  );
  if (typeof packResult?.filename !== "string") {
    throw new Error("npm pack did not report a tarball filename");
  }
  tarballPath = resolve(repositoryRoot, packResult.filename);
  if (!existsSync(tarballPath)) {
    throw new Error(`Packed tarball does not exist: ${tarballPath}`);
  }

  for (const directory of consumerDirectories) {
    npm(
      [
        "install",
        "--no-audit",
        "--no-fund",
        "--offline",
        "--ignore-scripts",
        tarballPath,
      ],
      { cwd: directory },
    );
  }

  const [nodeDirectory, bunDirectory, workerdDirectory] = consumerDirectories;
  writeFileSync(join(nodeDirectory, "fixture.mjs"), consumerSource);
  writeFileSync(
    join(nodeDirectory, "run.mjs"),
    'import { report } from "./fixture.mjs";\nconsole.log(JSON.stringify(report));\n',
  );
  writeFileSync(join(bunDirectory, "fixture.mjs"), consumerSource);
  writeFileSync(
    join(bunDirectory, "run.mjs"),
    'import { report } from "./fixture.mjs";\nconsole.log(JSON.stringify(report));\n',
  );
  writeFileSync(
    join(workerdDirectory, "fixture.mjs"),
    consumerSource.replace(
      'from "@tormentalabs/claude-code-wire-compat"',
      'from "./node_modules/@tormentalabs/claude-code-wire-compat/dist/index.js"',
    ),
  );
  writeFileSync(
    join(workerdDirectory, "worker.mjs"),
    'import { report } from "./fixture.mjs";\nexport default { fetch() { return Response.json(report); } };\n',
  );

  const digests = new Map();
  digests.set(
    "node",
    parseDigests(
      run(process.execPath, ["run.mjs"], { cwd: nodeDirectory }),
      "node",
    ),
  );
  digests.set(
    "bun",
    parseDigests(run("bun", ["run.mjs"], { cwd: bunDirectory }), "bun"),
  );

  const mf = new Miniflare({
    modules: true,
    modulesRoot: workerdDirectory,
    scriptPath: join(workerdDirectory, "worker.mjs"),
    modulesRules: [
      {
        type: "ESModule",
        include: ["**/*.js", "**/*.mjs"],
        fallthrough: false,
      },
    ],
    compatibilityDate: "2026-01-01",
  });
  try {
    const response = await mf.dispatchFetch("http://consumer.local/");
    if (!response.ok) {
      throw new Error(`workerd returned HTTP ${response.status}`);
    }
    digests.set("workerd", parseDigests(await response.text(), "workerd"));
  } finally {
    await mf.dispose();
  }

  // Cross-runtime equality is asserted PER CASE. A profile whose digest
  // differs between runtimes fails even if every other profile agrees.
  const mismatched = [];
  for (const name of CASE_NAMES) {
    const perRuntime = [...digests].map(([runtime, byCase]) => [
      runtime,
      byCase[name],
    ]);
    for (const [runtime, digest] of perRuntime) {
      console.log(`${name} ${runtime}: ${digest}`);
    }
    const distinct = new Set(perRuntime.map(([, digest]) => digest));
    if (distinct.size !== 1) {
      mismatched.push(name);
      continue;
    }
    console.log(`${name}: identical across runtimes.`);
  }
  if (mismatched.length > 0) {
    throw new Error(
      `Packed consumer digests do not match for: ${mismatched.join(", ")}`,
    );
  }

  // Every case is now known to be identical across runtimes, so the node
  // digest is a sound single reference for the agreed value of each case.
  const referenceDigests = digests.get("node");
  const agreed = new Map(
    CASE_NAMES.map((name) => [name, referenceDigests[name]]),
  );

  // Frozen-digest enforcement. Failures are collected, not thrown on the
  // first, so a reviewer sees whether one profile moved or several did.
  const frozenFailures = [];
  for (const [name, expected] of Object.entries(EXPECTED_DIGESTS)) {
    const observed = agreed.get(name);
    if (observed !== expected) {
      frozenFailures.push({ name, expected, observed });
    }
  }
  if (!agreed.has(EXPECTED_DEFAULT_CASE)) {
    throw new Error(
      `EXPECTED_DEFAULT_CASE "${EXPECTED_DEFAULT_CASE}" is not in CASE_NAMES ` +
        `(${CASE_NAMES.join(", ")}); fix this script's configuration.`,
    );
  }
  const expectedDefault = agreed.get(EXPECTED_DEFAULT_CASE);
  const observedDefault = agreed.get("default");
  if (observedDefault !== expectedDefault) {
    frozenFailures.push({
      name: `default (must equal ${EXPECTED_DEFAULT_CASE})`,
      expected: expectedDefault,
      observed: observedDefault,
    });
  }
  if (frozenFailures.length > 0) {
    const lines = frozenFailures.map(
      ({ name, expected, observed }) =>
        `  ${name}: expected ${expected}, observed ${observed}`,
    );
    throw new Error(
      [
        "Frozen packed consumer digests moved:",
        ...lines,
        "Do NOT edit EXPECTED_DIGESTS or EXPECTED_DEFAULT_CASE to make this " +
          "pass. Find the change that altered the wire bytes and revert it.",
      ].join("\n"),
    );
  }
  console.log(
    `Frozen digests matched for: ${Object.keys(EXPECTED_DIGESTS).join(", ")}; ` +
      `default matches ${EXPECTED_DEFAULT_CASE}.`,
  );
  console.log("Packed consumer digests are identical.");
} finally {
  if (tarballPath) {
    const pathFromRepository = relative(repositoryRoot, tarballPath);
    if (
      pathFromRepository !== "" &&
      !pathFromRepository.startsWith("..") &&
      !isAbsolute(pathFromRepository)
    ) {
      rmSync(tarballPath, { force: true });
    }
  }
  for (const directory of consumerDirectories) {
    safeRemove(directory);
  }
}
