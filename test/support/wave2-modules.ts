// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Deferred module loader for the Wave 1 RED behavioral suite.
 *
 * The behavioral test suite is authored in Wave 1, before the Wave 2
 * implementation modules under `src/` exist. Those modules are owned by
 * separate Wave 2 lanes and must not be created early.
 *
 * A static `import "../src/fingerprint.js"` would therefore raise TS2307 and
 * break `npm run lint`, which type-checks `test/**` through
 * `tsconfig.eslint.json`. That would make the suite fail for a CONFIGURATION
 * reason rather than for the intended reason — a missing implementation.
 *
 * Routing every load through a non-literal specifier defers resolution to
 * runtime. The suite then fails with `ERR_MODULE_NOT_FOUND`, which is exactly
 * the enumerated RED condition, while lint and typecheck stay green. When a
 * Wave 2 lane lands its module, the same test file turns GREEN untouched.
 */

/** Namespace of a loaded module, before any export is narrowed. */
export type ModuleNamespace = Readonly<Record<string, unknown>>;

/** Any function shape a loaded export may be narrowed to. */
export type UnknownFunction = (...args: never[]) => unknown;

function specifierFor(moduleName: string): string {
  return `../../src/${moduleName}.js`;
}

function isNamespace(value: unknown): value is ModuleNamespace {
  return typeof value === "object" && value !== null;
}

/**
 * Load a Wave 2 module by name, relative to `src/`.
 *
 * Rejects with `ERR_MODULE_NOT_FOUND` while the module is unimplemented.
 */
export async function loadWave2Module(
  moduleName: string,
): Promise<ModuleNamespace> {
  const namespace: unknown = await import(specifierFor(moduleName));
  if (!isNamespace(namespace)) {
    throw new TypeError(
      `Module "${moduleName}" did not resolve to a module namespace.`,
    );
  }
  return namespace;
}

/**
 * Read a named export from a Wave 2 module without narrowing its type.
 *
 * Throws while the module is missing, and also once the module exists but does
 * not yet declare the export, so both stages of RED are distinguishable.
 */
export async function loadWave2Export(
  moduleName: string,
  exportName: string,
): Promise<unknown> {
  const namespace = await loadWave2Module(moduleName);
  if (!(exportName in namespace)) {
    throw new TypeError(
      `Module "${moduleName}" does not export "${exportName}".`,
    );
  }
  return namespace[exportName];
}

/**
 * Load a named export and narrow it to a caller-supplied function signature.
 *
 * The single type assertion below is a deliberate module-boundary narrowing,
 * not error suppression: the value is proven to be callable at runtime first,
 * and the dynamic `import` cannot carry static type information across a
 * non-literal specifier. Every caller states the signature it expects, so a
 * wrong signature still fails when the Wave 2 module lands.
 */
export async function loadWave2Function<Fn extends UnknownFunction>(
  moduleName: string,
  exportName: string,
): Promise<Fn> {
  const value = await loadWave2Export(moduleName, exportName);
  if (typeof value !== "function") {
    throw new TypeError(
      `Export "${exportName}" of module "${moduleName}" is not callable.`,
    );
  }
  return value as Fn;
}

/**
 * Report whether a module is still unimplemented.
 *
 * Returns `true` only for a genuine module-resolution failure. Import-time
 * syntax errors, transitive dependency failures, and side-effect exceptions
 * are rethrown so they cannot be mistaken for an absent Wave 2 module.
 */
export async function expectModuleUnimplemented(
  moduleName: string,
): Promise<boolean> {
  try {
    await loadWave2Module(moduleName);
    return false;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (("code" in error && error.code === "ERR_MODULE_NOT_FOUND") ||
        /Failed to load url|Cannot find module/u.test(error.message))
    ) {
      return true;
    }
    throw error;
  }
}
