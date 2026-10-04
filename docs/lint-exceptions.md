# Lint rule exceptions

The lint configuration is the one the parent repository
(`ailura/cactu-care`) uses, copied here with the path-scoped
overrides rewritten for this package's layout. Every rule that
is off, and every rule pinned away from its default, is listed
with its reason. Do not add one without a written reason.

## Off everywhere

- `import/no-named-export` and `import/prefer-default-export` —
  mutually contradictory, and the adapter's API is named
  exports.
- `promise-function-async` — contradicts `require-await` for
  promise-returning wrappers.
- `prefer-readonly-parameter-types` — false positives on
  already-readonly types such as `ReadonlyMap`, and on Node's
  mutable `Dirent`.
- `sort-imports` — contradicts `import/order`.
- `no-undefined` — contradicts two enabled rules at once:
  `unicorn/no-typeof-undefined` requires comparing against
  `undefined` directly instead of through `typeof`, and
  `unicorn/no-null` says to replace `null` with `undefined`.
- `react/react-in-jsx-scope` — inherited verbatim from the
  parent configuration, together with the `react` and `jsx-a11y`
  plugins. No file here writes JSX, so it never fires; it is
  kept because the configuration is a copy and not a dialect.

## Scoped to `src/**/*.ts` and `test/**/*.ts`

These four are false positives for any file that declares a Nest
controller, a module or a fixture for one:

- `import/no-nodejs-modules` — the platform is Node:
  `@hono/node-server` is served by `node:http`, and the adapter
  reaches `node:util` for `promisify` and `node:stream` to
  convert a file stream. A case may reach a Node module for the
  same reason.
- `new-cap` — NestJS decorators (`@Controller()`, `@Module()`)
  are capitalized factory calls by design, and Hono's own
  constructors are capitalized too.
- `oxc/no-async-await` — `await` is the idiom in request
  handling, and the enabled `promise/prefer-await-to-then` asks
  for exactly that.
- `typescript/no-extraneous-class` — pinned to
  `allowWithDecorator`, because a class this package is handed
  may be a Nest module or controller, which is deliberately a
  member-less class whose decorator carries the metadata.

## Scoped to `src/**/*.ts`

The adapter is Node infrastructure that implements a stateless
contract, which makes two rules false positives:

- `class-methods-use-this` — an adapter implements a stateless
  contract, and requiring `this` would force artificial state
  into it.
- `promise/prefer-await-to-callbacks` — Hono's middleware
  signature is callback-shaped: a handler receives `next` and
  decides whether to continue, which is the transport's contract
  rather than a promise the adapter could await.

## Scoped to `src/core/**/*.ts` and `src/features/**/*.ts`

- `import/no-relative-parent-imports` — a layer imports the
  capability it composes onto, or the contract it shares, by
  naming the directory beside it. `core/` holds the Nest to Hono
  contract and `features/` the optional capabilities, so
  `core/server-adapter.ts` reaching CORS is `../features/` and a
  feature reaching the context is `../core/`. The rule forbids
  exactly the crossing the layered tree is for, and no file
  outside those two directories needs it.

## Scoped to `test/**/*.ts`

- `max-lines` at 600, against 400 for source. A source file that
  outgrows the bound is a file that should have been split; a
  case file that outgrows it is usually a file that has
  collected a second subject. The bound that actually matters
  there is one subject per file, which a line count cannot
  express, so the number is set high enough to be a ceiling
  rather than a quota and left to review to catch the real
  failure.

  Three test files sat within two lines of the source bound,
  which made any issue that added a case to a large file fail on
  a number rather than on a reason. That is the failure this
  fixes: a guard that fires for a reason nobody can act on
  trains people to raise the bound without reading it.

## Scoped to `test/**/*.ts`

A case builds the application it exercises, which is not a slice
and does not follow a slice's rules:

- `class-methods-use-this` — a probe controller's methods are
  route handlers, and a route handler needs no instance state.
- `max-classes-per-file` — a controller, the module that
  declares it and the filter a case installs belong together,
  because splitting a fixture across files hides what it proves.
- `import/no-unassigned-import` — a case imports
  `reflect-metadata` for its side effect, before any decorator
  is evaluated.
- `import/no-relative-parent-imports` — a case imports the
  source it covers with `../`, which is the test being next to
  what it tests rather than a boundary crossing.
- `import/max-dependencies` at 20 — a case names the application
  it builds the way a bootstrap does, and folding those imports
  through a barrel would hide which adapter a case exercises.

- `unicorn/prefer-event-target` — for `src/ws-client.ts` and
  `src/ws-server.ts`. Nest's own WebSocket contract is
  `on`/`once`-based (`BaseWsInstance`), and `EventTarget` offers
  neither, so the two classes that implement that contract for a
  connection and for a gateway path cannot be event targets.

## Scoped to one file

- `typescript/no-unsafe-type-assertion` — for
  `src/core/versioned-route.ts` and
  `src/core/response-helpers.ts`. The first narrows a type Nest
  declares too widely and cannot narrow itself: a versioned
  route resolves to `Function`, which no handler answering with
  a response satisfies. The second replaces Hono's own context
  helpers, which Hono types as methods on its class rather than
  as the own properties they are, so the wrapper is installed
  behind one asserted assignment. Both assertions sit one line
  behind a function that names what it is doing, and both files
  say so.

- `import/max-dependencies` at 12 — for
  `src/core/server-adapter.ts`. It is the composition root of
  the adapter: the response writer, the Nest bridge, the path
  dialect, CORS, static assets and views are each their own
  module, and it binds all of them. Folding two of those
  together to satisfy a count would hide a boundary the rest of
  the package keeps.

## Pinned to an option

Rules are also pinned to a deliberate option rather than the
default: `func-style` (declaration), `one-var` (never),
`capitalized-comments` (ignoring consecutive lines),
`no-magic-numbers` (ignoring 0 and 1), `no-duplicate-imports`
(allowing a separate `import type`, which
`import/consistent-type-specifier-style` prefers over inline
specifiers), `import/no-unassigned-import` (allowing a
stylesheet) and `no-void` (allowed as a statement, which is how
a deliberately ignored promise is marked next to `await`),
`react/jsx-filename-extension` (`.jsx`, `.tsx`) and
`react/jsx-max-depth` (5), which come from the same copy and
never fire here either.
