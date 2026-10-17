# Dependency management

## What a dependency has to satisfy

[Bun](https://bun.sh/) is the package manager, and the maintainer selects every dependency. One is acceptable when it is:

1. actively maintained — regular releases, and a responsive advisory record
2. compatible with the runtime matrix: Node 22.12 or later, Bun 1.2 or later, and the Cloudflare Workers build image, whose Bun reads only a `lockfileVersion: 1` lockfile
3. compatible with both Nest majors the [compatibility matrix](../packages/compatibility/README.md) runs
4. within the size gate: a dependency that pushes a bundle past its ceiling in a `.size-limit.json` is refused unless the ceiling is explicitly raised, with the reason, in the same change

## Adding one

1. The package and its latest stable version are identified.
2. The dependency lands in the workspace package that uses it — never in the root manifest, which is private and publishes nothing.
3. `bun install` updates `bun.lock`.
4. `bun run check` runs the whole gate: lint, format, typecheck, test, build and size.
5. The pull request follows [CONTRIBUTING.md](../CONTRIBUTING.md).

## Where each kind lives

- **A direct dependency** is declared by the workspace package that imports it, under `dependencies` or `devDependencies`. The root manifest declares no dependency of its own.
- **A peer dependency** is a version the consumer owns, so a package that only works against a particular one names it in `peerDependencies` — `hono`, `@nestjs/common` and `@nestjs/core` throughout.
- **A resolved version** is fixed by `bun.lock`. The `lockfile` job in `.github/workflows/lockfile.yml` parses `lockfileVersion` out of it and fails anything but version 1, because that is the format the Cloudflare build image reads; the lockfile itself is reviewed like any other change.
- **A vulnerability** is scanned by the `dependency-review` job on every pull request, which fails on a high-severity change, and by GitHub code scanning. The thresholds are in [SCA_POLICY.md](SCA_POLICY.md).

## Updating one

- A routine update waits for the compatibility matrix to pass on both Nest 11 and 12 — every `@nestjs/*` package moves together, because a mixed install is what a WebSocket, microservice or bridge case fails on.
- A security advisory is assessed at once, and a patch release follows when the assessment calls for one.
- A major version is read for its breaking changes before it is taken, and the migration lands with the release note that explains it.
