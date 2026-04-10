import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ensureAuth } from "../firebase/auth.js";
import * as habits from "../firestore/habits.js";
import { listHabitsSchema, addHabitOccurrenceSchema } from "../types.js";
import { jsonResult, textResult } from "../utils.js";

export function registerHabitTools(server: McpServer): void {
  server.tool("list_habits", "List active habits with recent occurrences", listHabitsSchema.shape,
    async () => jsonResult(await habits.listHabits(await ensureAuth()))
  );

  // TODO: add_habit_occurrence disabled — Firestore security rules block updateDoc on habit schedules.
  // Needs read-modify-write (getDocFromServer + setDoc) approach like updateTask.
  // server.tool("add_habit_occurrence", "Add a habit occurrence for a date", addHabitOccurrenceSchema.shape,
  //   async (params) => {
  //     await ensureAuth();
  //     await habits.addHabitOccurrence(params);
  //     return textResult(`Habit occurrence added for ${params.habitId} on ${params.date || "today"}`);
  //   }
  // );
}
