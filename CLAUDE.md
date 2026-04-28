# CLAUDE.md

## Running tests

Unit tests don't require auth. Integration tests require credentials resolved via the 1Password CLI (`op`). See `.git/hooks/pre-commit` for the auth setup.

## Type checking

`bunx tsc --noEmit`

## Task date fields — Griply Firestore layout (counter-intuitive)

The Griply UI exposes a "Date" picker and a separate "Deadline" picker. They map to Firestore fields whose names actively mislead:

- UI **"Date"** (start date) → `endStrategy.deadline` — yes, the field literally named `deadline` inside `endStrategy` is the *start* date.
- UI **"Deadline"** → `deadlineDeadline`.
- Firestore `startDate` is **not** a start date — it's the doc creation timestamp (== `createdAt`). Don't read or write it as if it were user-controlled.

Storage anchors differ between the two pickers and matter for round-trip correctness:

- Start date is stored at `T22:59:59.999Z` UTC for the chosen calendar date.
- Deadline is stored at *midnight at the start of the chosen date in the user's local timezone* (e.g. `2026-05-01` in BST → `2026-04-30T23:00:00Z`).

`src/utils.ts` has `dateToStartTimestamp` and `dateToDeadlineTimestamp(dateStr, tz)` for these. The deadline encoder needs the user's TZ — read it from `DEFAULT_TIMEZONE` (driven by the `GRIPLY_TIMEZONE` env var).

Griply does **not** mirror the start date into `deadlineDeadline` for fresh docs. Some legacy docs do have a mirror, so reads suppress `deadlineDeadline` when it equals `endStrategy.deadline` (`getDeadlineTimestamp` in `src/utils.ts`).

The MCP surface emits `startDate` and `deadline` as `YYYY-MM-DD` (in `DEFAULT_TIMEZONE`); `startDate` upgrades to `YYYY-MM-DDTHH:MM±OFFSET` when `timeslot.startTime` is set.
