# CLAUDE.md

## Running tests

Unit tests don't require auth. Integration tests require credentials resolved via the 1Password CLI (`op`). See `.git/hooks/pre-commit` for the auth setup.

## Type checking

`bunx tsc --noEmit`
