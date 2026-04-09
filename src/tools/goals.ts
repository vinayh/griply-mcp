import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ensureAuth } from "../firebase/auth.js";
import * as goals from "../firestore/goals.js";
import {
  listGoalsSchema,
  getGoalSchema,
  createGoalSchema,
  completeGoalSchema,
  getGoalProgressSchema,
} from "../types.js";
import { jsonResult, textResult } from "../utils.js";

export function registerGoalTools(server: McpServer): void {
  server.tool("list_goals", "List goals, optionally filtered by life area", listGoalsSchema.shape,
    async (params) => jsonResult(await goals.listGoals(await ensureAuth(), params))
  );

  server.tool("get_goal", "Get a goal with its linked tasks", getGoalSchema.shape,
    async (params) => jsonResult(await goals.getGoal(await ensureAuth(), params.goalId))
  );

  server.tool("create_goal", "Create a new goal", createGoalSchema.shape,
    async (params) => jsonResult(await goals.createGoal(await ensureAuth(), params))
  );

  server.tool("complete_goal", "Mark a goal as completed", completeGoalSchema.shape,
    async (params) => {
      await ensureAuth();
      await goals.completeGoal(params.goalId);
      return textResult(`Goal ${params.goalId} marked as completed`);
    }
  );

  server.tool("get_goal_progress", "Calculate goal progress based on metric type", getGoalProgressSchema.shape,
    async (params) => {
      await ensureAuth();
      return jsonResult(await goals.getGoalProgress(params.goalId));
    }
  );
}
