import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ensureAuth } from "../firebase/auth.js";
import * as summary from "../firestore/summary.js";
import { getTodaySummarySchema } from "../types.js";
import { jsonResult } from "../mcp.js";

export function registerSummaryTools(server: McpServer): void {
  server.tool("get_today_summary", "Get today's tasks by time block with habit completions", getTodaySummarySchema.shape,
    async (params) => jsonResult(await summary.getTodaySummary(await ensureAuth(), params))
  );
}
