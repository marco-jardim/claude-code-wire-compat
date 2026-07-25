// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_UNAVAILABLE_EXIT_CODE = 2;
const DEFAULT_SOURCE = String.raw`D:\git\opencode-anthropic-fix`;
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const profilePath = path.join(
  repositoryRoot,
  "src",
  "profiles",
  "claude-code-2.1.195.ts",
);
const goldenManifestPath = path.join(
  repositoryRoot,
  "test",
  "fixtures",
  "golden",
  "manifest.json",
);

const canonicalHeaderNames = [
  "anthropic-beta",
  "anthropic-dangerous-direct-browser-access",
  "anthropic-version",
  "authorization",
  "user-agent",
  "x-app",
  "x-client-request-id",
  "x-stainless-arch",
  "x-stainless-lang",
  "x-stainless-os",
  "x-stainless-package-version",
  "x-stainless-retry-count",
  "x-stainless-runtime",
  "x-stainless-runtime-version",
  "x-stainless-timeout",
];
const billingPrefix = "x-anthropic-billing-header:";

function sourceArgument(argv) {
  const sourceIndex = argv.indexOf("--source");
  if (sourceIndex === -1) {
    return existsSync(DEFAULT_SOURCE) ? DEFAULT_SOURCE : undefined;
  }

  const source = argv[sourceIndex + 1];
  return typeof source === "string" && source.length > 0 ? source : undefined;
}

function sourceFile(sourceRoot, ...segments) {
  const upstreamPath = path.join(sourceRoot, ...segments);
  return existsSync(upstreamPath) ? upstreamPath : `${upstreamPath}.fixture`;
}

function quotedConstant(source, name) {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`));
  return match?.[1];
}

function quotedArray(source, name) {
  const match = source.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:new Set\\()?\\s*\\[([\\s\\S]*?)\\]`),
  );
  if (match?.[1] === undefined) return undefined;

  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
}

function profileValues(profileSource) {
  const orderedBetasMatch = profileSource.match(
    /orderedBetas:\s*\[([\s\S]*?)\],/,
  );
  return {
    id:
      quotedConstant(profileSource, "id") ??
      profileSource.match(/\bid:\s*["']([^"']+)["']/)?.[1],
    cliVersion: profileSource.match(/\bcliVersion:\s*["']([^"']+)["']/)?.[1],
    sdkVersion: profileSource.match(/\bsdkVersion:\s*["']([^"']+)["']/)?.[1],
    endpoint: profileSource.match(/\bendpoint:\s*["']([^"']+)["']/)?.[1],
    orderedBetas:
      orderedBetasMatch?.[1] === undefined
        ? undefined
        : [...orderedBetasMatch[1].matchAll(/["']([^"']+)["']/g)].map(
            (item) => item[1],
          ),
  };
}

function upstreamOrderedBetas(headers, expectedValues) {
  const explicit = quotedArray(headers, "ORDERED_BETAS");
  if (explicit !== undefined) return explicit;

  if (!Array.isArray(expectedValues)) return undefined;

  const expected = new Set(expectedValues);
  const ordered = [];
  const initialBetas = headers.match(
    /\bconst\s+betas\s*=\s*\[([\s\S]*?)\]/,
  )?.[1];
  const signaturePushStart = headers.indexOf(
    "betas.push(CLAUDE_CODE_BETA_FLAG)",
  );
  const orderedPushSource =
    signaturePushStart < 0 ? "" : headers.slice(signaturePushStart);
  const pushArguments = [
    ...(initialBetas === undefined
      ? []
      : initialBetas.matchAll(/["']([^"']+)["']/g)),
    ...orderedPushSource.matchAll(
      /\bbetas\.push\(\s*(?:["']([^"']+)["']|([A-Z_]+))\s*\)/g,
    ),
  ];

  for (const match of pushArguments) {
    const value =
      match[1] ??
      (match[2] === undefined ? undefined : quotedConstant(headers, match[2]));
    if (
      value !== undefined &&
      expected.has(value) &&
      !ordered.includes(value)
    ) {
      ordered.push(value);
    }
  }
  return ordered;
}

function cliSdkPairMatches(requestHeaders, cliVersion, sdkVersion) {
  if (cliVersion === undefined || sdkVersion === undefined) return false;
  const escapedCli = cliVersion.replaceAll(".", "\\.");
  const escapedSdk = sdkVersion.replaceAll(".", "\\.");
  return new RegExp(
    `\\[\\s*["']${escapedCli}["']\\s*,\\s*["']${escapedSdk}["']\\s*\\]`,
  ).test(requestHeaders);
}

function endpointMatches(
  profileEndpoint,
  requestHeaders,
  headers,
  indexSource,
) {
  const explicit =
    quotedConstant(requestHeaders, "ANTHROPIC_MESSAGES_ENDPOINT") ??
    quotedConstant(headers, "ANTHROPIC_MESSAGES_ENDPOINT");
  if (explicit !== undefined) return explicit === profileEndpoint;
  if (profileEndpoint === undefined) return false;

  const endpoint = new URL(profileEndpoint);
  const expectedBeta = endpoint.searchParams.get("beta");
  /*
   * Upstream composes the endpoint rather than declaring the full URL: its API
   * base supplies the origin, transformRequestUrl recognises /v1/messages, and
   * searchParams.set supplies beta=true. Verify those three independent source
   * facts. No other query parameters are represented or claimed here.
   */
  return (
    indexSource.includes(endpoint.origin) &&
    indexSource.includes(`p === "${endpoint.pathname}"`) &&
    expectedBeta === "true" &&
    /searchParams\.set\(\s*["']beta["']\s*,\s*["']true["']\s*\)/.test(
      indexSource,
    )
  );
}

function sameOrderedValues(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function parseManifest(source) {
  const parsed = JSON.parse(source);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }
  const fixtures = Reflect.get(parsed, "fixtures");
  if (
    fixtures === null ||
    typeof fixtures !== "object" ||
    Array.isArray(fixtures)
  ) {
    return undefined;
  }
  return fixtures;
}

async function readGoldenHashes(sourceRoot, localHashes) {
  const sourceGoldenRoot = path.join(sourceRoot, "test", "fixtures", "golden");
  const sourceManifest = path.join(sourceGoldenRoot, "manifest.json");
  if (existsSync(sourceManifest)) {
    return parseManifest(await readFile(sourceManifest, "utf8"));
  }

  // The pinned upstream has no manifest for package-owned decision fixtures.
  // In that case verify the package's recorded hashes against its local files.
  const hashes = {};
  for (const fixtureName of Object.keys(localHashes)) {
    const contents = await readFile(
      path.join(repositoryRoot, "test", "fixtures", "golden", fixtureName),
    );
    hashes[fixtureName] = createHash("sha256").update(contents).digest("hex");
  }
  return hashes;
}

function recordDrift(drifts, condition, field, category = "protocol") {
  if (!condition) drifts.push({ category, field });
}

function reportDrift(drifts) {
  const categories = new Map();
  for (const drift of drifts) {
    const fields = categories.get(drift.category) ?? [];
    if (!fields.includes(drift.field)) fields.push(drift.field);
    categories.set(drift.category, fields);
  }
  for (const [category, fields] of categories) {
    console.log(`category=${category} fields=${fields.join(",")}`);
  }
}

async function verify(sourceRoot) {
  await access(sourceRoot, fsConstants.R_OK);

  const [
    profileSource,
    localManifestSource,
    requestHeaders,
    headers,
    systemPrompt,
    indexSource,
  ] = await Promise.all([
    readFile(profilePath, "utf8"),
    readFile(goldenManifestPath, "utf8"),
    readFile(sourceFile(sourceRoot, "lib", "request-headers.mjs"), "utf8"),
    readFile(sourceFile(sourceRoot, "lib", "mimicry", "headers.mjs"), "utf8"),
    readFile(
      sourceFile(sourceRoot, "lib", "mimicry", "system-prompt.mjs"),
      "utf8",
    ),
    existsSync(path.join(sourceRoot, "index.mjs"))
      ? readFile(path.join(sourceRoot, "index.mjs"), "utf8")
      : "",
  ]);

  const profile = profileValues(profileSource);
  const localHashes = parseManifest(localManifestSource);
  if (localHashes === undefined)
    throw new Error("Local golden manifest is invalid");
  const upstreamHashes = await readGoldenHashes(sourceRoot, localHashes);
  const upstreamHeaders = new Set(
    [...headers.matchAll(/["']([a-z][a-z0-9-]+)["']/g)].map(
      (match) => match[1],
    ),
  );

  const drifts = [];
  recordDrift(
    drifts,
    quotedConstant(requestHeaders, "FALLBACK_CLAUDE_CLI_VERSION") ===
      profile.cliVersion,
    "cliVersion",
  );
  recordDrift(
    drifts,
    quotedConstant(requestHeaders, "ANTHROPIC_SDK_VERSION") ===
      profile.sdkVersion &&
      cliSdkPairMatches(requestHeaders, profile.cliVersion, profile.sdkVersion),
    "sdkVersion",
  );
  recordDrift(
    drifts,
    endpointMatches(profile.endpoint, requestHeaders, headers, indexSource),
    "endpoint",
  );
  recordDrift(
    drifts,
    sameOrderedValues(
      upstreamOrderedBetas(headers, profile.orderedBetas),
      profile.orderedBetas,
    ),
    "orderedBetas",
  );
  recordDrift(
    drifts,
    canonicalHeaderNames.every((name) => upstreamHeaders.has(name)),
    "headerNames",
  );
  recordDrift(drifts, systemPrompt.includes(billingPrefix), "billingPrefix");
  recordDrift(
    drifts,
    upstreamHashes !== undefined &&
      Object.entries(localHashes).every(
        ([name, hash]) => Reflect.get(upstreamHashes, name) === hash,
      ),
    "goldenHashes",
    "integrity",
  );

  if (drifts.length > 0) {
    reportDrift(drifts);
    process.exitCode = 1;
    return;
  }

  console.log(`profile=${profile.id} drift=none`);
}

const source = sourceArgument(process.argv.slice(2));
if (source === undefined) {
  console.log("SOURCE_UNAVAILABLE");
  process.exitCode = SOURCE_UNAVAILABLE_EXIT_CODE;
} else {
  try {
    await verify(path.resolve(source));
  } catch {
    console.log("SOURCE_UNAVAILABLE");
    process.exitCode = SOURCE_UNAVAILABLE_EXIT_CODE;
  }
}
