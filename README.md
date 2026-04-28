# griply-mcp

[![codecov](https://codecov.io/github/vinayh/griply-mcp/graph/badge.svg?token=M6MMMFQIAG)](https://codecov.io/github/vinayh/griply-mcp)

An [MCP](https://modelcontextprotocol.io) server for [Griply](https://griply.app) that provides AI assistants with direct access to your goals, tasks, and habits via the Firebase/Firestore API.

> **Disclaimer:** This is an unofficial, personal project. It is not endorsed, approved, or affiliated with Griply in any way. Use at your own risk.

## Setup

```bash
bun install
```

### Firebase Config

Create `src/firebase/config.ts` with your Griply Firebase project config (this file is gitignored):

```typescript
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

You can extract these values from the Griply web app's JavaScript bundle.

### Environment Variables

Create a `.env` file:

```
GRIPLY_EMAIL=your-email@example.com
GRIPLY_PASSWORD=your-password
GRIPLY_TIMEZONE=Europe/London   # optional, IANA tz name; defaults to America/New_York
```

`GRIPLY_TIMEZONE` is used to encode deadlines (Griply anchors them at midnight in the user's local timezone) and to format the `startDate`/`deadline` output as calendar dates the user picked. Set it to whatever timezone your Griply client uses.

## Usage with Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "griply": {
      "command": "sh",
      "args": ["-c", "export $(grep GRIPLY_ /path/to/griply-mcp/.env | xargs) && bun /path/to/griply-mcp/src/index.ts"]
    }
  }
}
```

## Tools

### Goals

| Tool | Description |
|------|-------------|
| `list_goals` | List goals, optionally filtered by life area |
| `get_goal` | Get a goal with its linked tasks |
| `create_goal` | Create a new goal |
| `complete_goal` | Mark a goal as completed |
| `get_goal_progress` | Calculate goal progress based on task completion |

### Tasks

| Tool | Description |
|------|-------------|
| `list_tasks` | List tasks with a filter (`today`, `upcoming`, `inbox`, `all`, `completed`) |
| `create_task` | Create a new task with optional priority, deadline, time slot, and goal link |
| `update_task` | Update an existing task's name, priority, dates, or time slot |
| `complete_task` | Mark a task as completed |
| `delete_task` | Delete a task |

### Habits

| Tool | Description |
|------|-------------|
| `list_habits` | List active habits with schedule metadata and today's completion status |
| `add_habit_occurrence` | Log a habit completion for a given date |

### Summary

| Tool | Description |
|------|-------------|
| `get_today_summary` | Get today's tasks, habits, and completion counts |

## Development

```bash
bun dev        # run with --watch
bun test       # run tests (requires .env + config)
bun run build  # bundle to dist/ (optional)
```

## Architecture

The server connects directly to Griply's Firestore database using the Firebase JS SDK, bypassing the web UI entirely. Authentication is handled via `signInWithEmailAndPassword`.
