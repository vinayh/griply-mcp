import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ensureAuth } from "../firebase/auth.js";
import * as tasks from "../firestore/tasks.js";
import {
  listTasksSchema,
  createTaskSchema,
  completeTaskSchema,
  deleteTaskSchema,
} from "../types.js";
import { jsonResult, textResult } from "../utils.js";

export function registerTaskTools(server: McpServer): void {
  server.tool("list_tasks", "List tasks with a filter", listTasksSchema.shape,
    async (params) => jsonResult(await tasks.listTasks(await ensureAuth(), params))
  );

  server.tool("create_task", "Create a new task", createTaskSchema.shape,
    async (params) => jsonResult(await tasks.createTask(await ensureAuth(), params))
  );

  server.tool("complete_task", "Mark a task as completed", completeTaskSchema.shape,
    async (params) => {
      await ensureAuth();
      await tasks.completeTask(params.taskId);
      return textResult(`Task ${params.taskId} marked as completed`);
    }
  );

  server.tool("delete_task", "Delete a task and its child tasks", deleteTaskSchema.shape,
    async (params) => {
      await ensureAuth();
      await tasks.deleteTask(params.taskId);
      return textResult(`Task ${params.taskId} deleted`);
    }
  );
}
