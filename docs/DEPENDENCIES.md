# Dependency Management

## How dependencies are selected

This project uses [Bun](https://bun.sh/) as its package manager. Dependencies are selected by the maintainer and must:

1. Be actively maintained (regular releases, responsive security advisories)
2. Support the runtime matrix: Bun on Node >=22.12.0 and Cloudflare Workers
3. Be compatible with NestJS 11 and 12 (tested in the compatibility matrix)
4. Not break the size gate (bundle ceilings in `.size-limit.json`)

## How dependencies are added

1. Identify the package and its latest stable version
2. Add to the appropriate workspace package's `package.json` (not the root — the root is private)
3. Run `bun install` to update `bun.lock`
4. Run `bun run check` to verify lint, format, typecheck, test, build, and size
5. Open a PR following [CONTRIBUTING.md](CONTRIBUTING.md)

## How dependencies are tracked

- **Direct dependencies** are listed in each package's `package.json` under `dependencies` and `devDependencies`
- **Exact versions** are locked in `bun.lock` — CI fails when it changes (`lockfile.yml`)
- **Peer dependencies** are declared for packages a consumer must install (e.g., `@nestjs/common`, `hono`)
- **Vulnerability scanning** runs in CI via GitHub Security and Snyk

## How dependencies are updated

- Routine updates: when compatibility matrix tests pass on both Nest 11 and 12
- Security advisories: immediate assessment, patch release if needed
- Major versions: evaluated for breaking changes, documented in the release notes

## Size constraints

Each published package has a bundle ceiling in `.size-limit.json`. A dependency that pushes a bundle over its ceiling is not accepted unless the ceiling is explicitly raised with justification.
