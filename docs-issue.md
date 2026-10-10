# Titulo
docs: remove obsolete lint exceptions documentation reference

# Tipo
`docs`

# Context
The repository no longer needs `docs/lint-exceptions.md`, but
`AGENTS.md` still described it as part of the documentation set
and linked it from Additional references. Keeping a deleted or
obsolete documentation page referenced in repository guidance
creates navigation noise and can mislead contributors about
which documentation is authoritative.

# Goal
Repository documentation references only the documentation that
still exists, and contributors are no longer directed to
`docs/lint-exceptions.md`.

# Scope
- Remove `docs/lint-exceptions.md`.
- Update `AGENTS.md` so the Documentation section no longer
  mentions lint exceptions.
- Remove the `docs/lint-exceptions.md` entry from Additional
  references.

# Acceptance criteria
- [ ] `docs/lint-exceptions.md` is no longer present in the
      repository.
- [ ] `AGENTS.md` does not mention `docs/lint-exceptions.md`.
- [ ] `AGENTS.md` no longer describes lint exceptions as part of
      the repository documentation set.
- [ ] No repository references to `docs/lint-exceptions.md`
      remain.

# References
- `AGENTS.md`
- `docs/architecture.md`
