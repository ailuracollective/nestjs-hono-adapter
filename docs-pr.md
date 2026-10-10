# Titulo
docs: remove obsolete lint exceptions documentation references

# Tipo
`docs`

# Cuerpo
## Linked issue (required)

Closes #<issue-number>

## Summary

Removes the obsolete `docs/lint-exceptions.md` page and updates
repository guidance so `AGENTS.md` only references current
documentation.

## Changes

- Deletes `docs/lint-exceptions.md`.
- Updates the Documentation section in `AGENTS.md` to stop
  listing lint exceptions as part of the documentation set.
- Removes the `docs/lint-exceptions.md` entry from Additional
  references in `AGENTS.md`.

## Verification

- Confirmed the diff against `main` only includes:
  - `M AGENTS.md`
  - `D docs/lint-exceptions.md`
- Confirmed no repository references remain for:
  - `docs/lint-exceptions.md`
  - `lint-exceptions`
  - `lint exceptions`

## Risk / compatibility

Low risk. This change only removes obsolete documentation and
stale references. It does not affect runtime behavior, package
surface, or build output.
