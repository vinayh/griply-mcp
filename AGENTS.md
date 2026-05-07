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

## Soft delete via `deletedAt` (read-only on the client)

Griply's mobile app soft-deletes tasks and habits by stamping a `deletedAt` timestamp — it does **not** remove the doc. The field is **absent** on live docs (not `null`), so `where("deletedAt", "==", null)` would exclude every live doc and is unusable. All read paths that hit the `tasks` collection therefore filter `deletedAt != null` in code after the query (`listTasks`, `listHabits`, `getGoal`'s linked tasks, `getTodaySummary`).

The mobile app reaches the soft-delete path via a Cloud Function. The Firebase JS SDK can't replicate that: Griply's security rules reject any client `updateDoc` writing `deletedAt` or `archivedAt` (verified: `PERMISSION_DENIED`). `deleteDoc` is permitted, so the `delete_task` tool **hard-deletes**. The observable outcome is the same (doc gone from reads); only the on-disk artifact differs.

## Bundling caveat

Do not run the server from `bun build` output against Firestore. Bun's bundler swaps in the browser-side gRPC-Web transport, which can't open the Firestore listen stream from Node and silently degrades to "offline mode" — every query returns empty. Run `bun src/index.ts` directly, or rebuild with `--external firebase` and ship `node_modules` if you need a bundle (e.g. for the container image).
