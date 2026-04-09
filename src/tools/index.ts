import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGoalTools } from "./goals.js";
import { registerTaskTools } from "./tasks.js";
import { registerHabitTools } from "./habits.js";
import { registerSummaryTools } from "./summary.js";

export function registerAllTools(server: McpServer): void {
  registerGoalTools(server);
  registerTaskTools(server);
  registerHabitTools(server);
  registerSummaryTools(server);
}
