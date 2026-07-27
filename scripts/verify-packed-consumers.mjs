// SPDX-License-Identifier: GPL-3.0-or-later

// Installs the package tarball into isolated consumers and compares their output.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Miniflare } from "miniflare";

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
const consumerSource = `
import { buildClaudeCodeRequest } from "@tormentalabs/claude-code-wire-compat";

const token = "test-token-not-a-secret";
const request = await buildClaudeCodeRequest({
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
});

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
const digest = [...new Uint8Array(digestBytes)]
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

export const report = { digest };
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

function parseDigest(output, runtime) {
  const lines = output.split(/\r?\n/u).filter(Boolean);
  const report = JSON.parse(lines.at(-1));
  if (typeof report.digest !== "string") {
    throw new Error(`${runtime} did not return a digest`);
  }
  return report.digest;
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

  const [packResult] = JSON.parse(
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
    parseDigest(
      run(process.execPath, ["run.mjs"], { cwd: nodeDirectory }),
      "node",
    ),
  );
  digests.set(
    "bun",
    parseDigest(run("bun", ["run.mjs"], { cwd: bunDirectory }), "bun"),
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
    digests.set("workerd", parseDigest(await response.text(), "workerd"));
  } finally {
    await mf.dispose();
  }

  for (const [runtime, digest] of digests) {
    console.log(`${runtime}: ${digest}`);
  }
  if (new Set(digests.values()).size !== 1) {
    throw new Error("Packed consumer digests do not match");
  }
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
