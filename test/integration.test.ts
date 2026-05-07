import { describe, it, expect, beforeAll } from "bun:test";
import { ensureAuth } from "../src/firebase/auth.js";
import * as goals from "../src/firestore/goals.js";
import * as tasks from "../src/firestore/tasks.js";
import * as habits from "../src/firestore/habits.js";
import * as summary from "../src/firestore/summary.js";
import { registerAllTools } from "../src/tools/index.js";
import { doc, deleteDoc } from "firebase/firestore";
import { getDb } from "../src/firebase/client.js";

let uid: string;

// Capture tool handlers by registering on a lightweight spy
type ToolHandler = (params: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>;
const toolHandlers: Record<string, ToolHandler> = {};
const mockServer = {
  tool: (name: string, ...args: unknown[]) => {
    toolHandlers[name] = args[args.length - 1] as ToolHandler;
    return { remove: () => {} };
  },
};
registerAllTools(mockServer as any);

beforeAll(async () => {
  uid = await ensureAuth();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Auth ──

describe("auth", () => {
  it("returns a uid string", () => {
    expect(typeof uid).toBe("string");
    expect(uid.length).toBeGreaterThan(0);
  });

  it("returns the same uid on subsequent calls", async () => {
    expect(await ensureAuth()).toBe(uid);
  });
});

// ── Goals: read ──

describe("goals (read)", () => {
  let allGoals: Awaited<ReturnType<typeof goals.listGoals>>;

  beforeAll(async () => {
    allGoals = await goals.listGoals(uid);
  });

  it("list_goals returns a non-empty array", () => {
    expect(allGoals).toBeInstanceOf(Array);
    expect(allGoals.length).toBeGreaterThan(0);
  });

  it("each goal has required fields", () => {
    for (const g of allGoals) {
      expect(typeof g.id).toBe("string");
      expect(typeof g.name).toBe("string");
      expect(typeof g.isArchived).toBe("boolean");
      expect(typeof g.isCompleted).toBe("boolean");
    }
  });

  it("excludes archived goals by default", () => {
    expect(allGoals.every((g) => !g.isArchived)).toBe(true);
  });

  it("includeArchived returns at least as many goals", async () => {
    const withArchived = await goals.listGoals(uid, { includeArchived: true });
    expect(withArchived.length).toBeGreaterThanOrEqual(allGoals.length);
  });

  it("filters by lifeAreaId", async () => {
    const goalWithArea = allGoals.find((g) => g.lifeAreaId);
    expect(goalWithArea).toBeDefined();
    const filtered = await goals.listGoals(uid, { lifeAreaId: goalWithArea!.lifeAreaId });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((g) => g.lifeAreaId === goalWithArea!.lifeAreaId)).toBe(true);
  });

  it("get_goal returns goal with tasks array", async () => {
    const g = await goals.getGoal(uid, allGoals[0].id);
    expect(g.id).toBe(allGoals[0].id);
    expect(g.name).toBe(allGoals[0].name);
    expect(g.tasks).toBeInstanceOf(Array);
  });

  it("get_goal with invalid ID throws", async () => {
    await expect(goals.getGoal(uid, "nonexistent_id_12345")).rejects.toThrow(
      /not found|permission/i
    );
  });

  it("get_goal_progress returns progress object", async () => {
    const p = await goals.getGoalProgress(allGoals[0].id);
    expect(p.goalId).toBe(allGoals[0].id);
    expect(typeof p.progress).toBe("number");
    expect(p.progress).toBeGreaterThanOrEqual(0);
    expect(p.progress).toBeLessThanOrEqual(100);
    expect(typeof p.completedTasks).toBe("number");
    expect(typeof p.totalTasks).toBe("number");
  });
});

// ── Tasks: read ──

describe("tasks (read)", () => {
  it("filter=all returns uncompleted tasks", async () => {
    const result = await tasks.listTasks(uid, { filter: "all" });
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
    for (const t of result) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(t.isCompleted).toBe(false);
    }
  });

  it("filter=today returns tasks with deadline or startDate", async () => {
    const result = await tasks.listTasks(uid, { filter: "today" });
    expect(result).toBeInstanceOf(Array);
    for (const t of result) {
      expect(t.deadline || t.startDate).toBeTruthy();
    }
  });

  it("filter=inbox returns unassigned tasks", async () => {
    const result = await tasks.listTasks(uid, { filter: "inbox" });
    expect(result).toBeInstanceOf(Array);
    for (const t of result) {
      expect(t.goalId).toBeUndefined();
    }
  });

  it("filter=upcoming returns array", async () => {
    const result = await tasks.listTasks(uid, { filter: "upcoming" });
    expect(result).toBeInstanceOf(Array);
  });

  it("filter=completed returns array", async () => {
    const result = await tasks.listTasks(uid, { filter: "completed" });
    expect(result).toBeInstanceOf(Array);
  });

  it("filters by goalId", async () => {
    const allTasks = await tasks.listTasks(uid, { filter: "all" });
    const taskWithGoal = allTasks.find((t) => t.goalId);
    expect(taskWithGoal).toBeDefined();
    const filtered = await tasks.listTasks(uid, { filter: "all", goalId: taskWithGoal!.goalId });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((t) => t.goalId === taskWithGoal!.goalId)).toBe(true);
  });

  it("filters by tagId", async () => {
    const result = await tasks.listTasks(uid, { filter: "all", tagId: "xK28tkWkzwIX9dmqxMiZ" });
    expect(result).toBeInstanceOf(Array);
  });

  it("nonexistent goalId returns empty array", async () => {
    const result = await tasks.listTasks(uid, { filter: "all", goalId: "nonexistent_goal_id" });
    expect(result).toEqual([]);
  });

  it("nonexistent tagId returns empty array", async () => {
    const result = await tasks.listTasks(uid, { filter: "all", tagId: "nonexistent_tag_id" });
    expect(result).toEqual([]);
  });
});

// ── Habits: read ──

describe("habits (read)", () => {
  let allHabits: Awaited<ReturnType<typeof habits.listHabits>>;

  beforeAll(async () => {
    allHabits = await habits.listHabits(uid);
  });

  it("list_habits returns active habits", () => {
    expect(allHabits).toBeInstanceOf(Array);
    expect(allHabits.length).toBeGreaterThan(0);
  });

  it("each habit has required fields", () => {
    for (const h of allHabits) {
      expect(typeof h.id).toBe("string");
      expect(typeof h.name).toBe("string");
      expect(typeof h.completedToday).toBe("boolean");
      expect(typeof h.todayCount).toBe("number");
      expect(h.isArchived).toBe(false);
    }
  });

  it("at least one habit has schedule metadata", () => {
    const withSchedule = allHabits.filter((h) => h.targetPeriod || h.schedulePeriod);
    expect(withSchedule.length).toBeGreaterThan(0);
  });

  it("addHabitOccurrence throws on nonexistent habit", async () => {
    await expect(habits.addHabitOccurrence({ habitId: "nonexistent_id" })).rejects.toThrow(
      /not found|permission/i
    );
  });

  it("addHabitOccurrence succeeds with explicit date on a real habit", async () => {
    const farDate = "2099-12-31";
    const habit = allHabits[0];
    await habits.addHabitOccurrence({ habitId: habit.id, date: farDate });

    // Verify occurrence was added by re-listing
    const updated = await habits.listHabits(uid);
    const h = updated.find((x) => x.id === habit.id);
    expect(h).toBeDefined();

    // Clean up: read-modify-write to remove the far-future entry
    await sleep(500);
    const { getDocFromServer, setDoc, doc, serverTimestamp } = await import("firebase/firestore");
    const snap = await getDocFromServer(doc(getDb(), "tasks", habit.id));
    const data = snap.data()!;
    const schedules = [...(data.schedules as Array<Record<string, unknown>>)];
    const last = schedules.length - 1;
    const entries = (schedules[last].entries as Array<Record<string, unknown>>) || [];
    schedules[last] = {
      ...schedules[last],
      entries: entries.filter((e: any) => {
        const d = e.date?.toDate?.()?.toISOString?.() || "";
        return !d.startsWith("2099-12-31");
      }),
    };
    data.schedules = schedules;
    data.updatedAt = serverTimestamp();
    await setDoc(doc(getDb(), "tasks", habit.id), data);
  });

  it("addHabitOccurrence throws 'no schedules' on a todo task", async () => {
    // A todo task has schedules: null, so it should hit the "no schedules" branch
    const t = await tasks.createTask(uid, { name: "test-not-a-habit" });
    await expect(habits.addHabitOccurrence({ habitId: t.id })).rejects.toThrow(/no schedules/i);
    await tasks.deleteTask(t.id);
  });

});

// ── Summary ──

describe("summary", () => {
  it("get_today_summary returns complete summary", async () => {
    const s = await summary.getTodaySummary(uid);
    expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(s.tasks).toBeInstanceOf(Array);
    expect(s.habits).toBeInstanceOf(Array);
    expect(s.completedTaskCount).toBeGreaterThanOrEqual(0);
    expect(s.totalTaskCount).toBeGreaterThanOrEqual(s.completedTaskCount);
    expect(s.totalHabitCount).toBeGreaterThanOrEqual(s.completedHabitCount);
  });

  it("respects explicit timezone", async () => {
    const s = await summary.getTodaySummary(uid, { timezone: "Europe/Berlin" });
    expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("summary tasks are all uncompleted", async () => {
    const s = await summary.getTodaySummary(uid);
    for (const t of s.tasks) {
      expect(t.isCompleted).toBe(false);
    }
  });
});

// ── Task writes ──

describe("task writes", () => {
  it("create → verify → delete", async () => {
    const t = await tasks.createTask(uid, {
      name: "test-integration-task",
      taskDescription: "Created by test suite",
      priority: "medium",
      deadline: "2026-04-15",
      startTime: "09:30",
      duration: 45,
    });

    expect(typeof t.id).toBe("string");
    expect(t.name).toBe("test-integration-task");
    expect(t.description).toBe("Created by test suite");
    expect(t.priority).toBe("medium");
    expect(t.deadline).toBe("2026-04-15");
    expect(t.startTime).toBe("09:30");
    expect(t.duration).toBe(45);
    expect(t.isCompleted).toBe(false);

    const all = await tasks.listTasks(uid, { filter: "all" });
    const found = all.find((x) => x.id === t.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("test-integration-task");
    expect(found!.description).toBe("Created by test suite");
    expect(found!.priority).toBe("medium");
    expect(found!.startTime).toBe("09:30");
    expect(found!.duration).toBe(45);

    await tasks.deleteTask(t.id);
    const after = await tasks.listTasks(uid, { filter: "all" });
    expect(after.find((x) => x.id === t.id)).toBeUndefined();
  });

  it("create with minimal fields", async () => {
    const t = await tasks.createTask(uid, { name: "test-minimal-task" });
    expect(t.id).toBeTruthy();
    expect(t.name).toBe("test-minimal-task");
    expect(t.isCompleted).toBe(false);
    await tasks.deleteTask(t.id);
  });

  it("create with goalId appears in goal filter", async () => {
    const allGoals = await goals.listGoals(uid);
    const goalId = allGoals[0].id;
    const t = await tasks.createTask(uid, { name: "test-goal-linked-task", goalId });
    expect(t.goalId).toBe(goalId);

    const filtered = await tasks.listTasks(uid, { filter: "all", goalId });
    expect(filtered.find((x) => x.id === t.id)).toBeDefined();

    await tasks.deleteTask(t.id);
  });

  it("complete_task marks task as completed", async () => {
    const t = await tasks.createTask(uid, { name: "test-complete-task" });
    await sleep(1500); // wait for serverTimestamp to resolve
    await tasks.completeTask(t.id);

    const all = await tasks.listTasks(uid, { filter: "all" });
    expect(all.find((x) => x.id === t.id)).toBeUndefined();

    // Security rules block deleteTask on completed tasks, so use deleteDoc directly
    await deleteDoc(doc(getDb(), "tasks", t.id));
  });

  it("update_task changes name, priority, dates, and timeslot", async () => {
    const t = await tasks.createTask(uid, {
      name: "test-update-task",
      priority: "low",
      startDate: "2026-05-01",
      deadline: "2026-05-10",
      startTime: "09:00",
      duration: 30,
    });
    await sleep(500);

    // Update all fields in one call
    await tasks.updateTask(t.id, {
      name: "test-updated-name",
      priority: "High",
      startDate: "2026-06-01",
      deadline: "2026-06-15",
      startTime: "14:30",
      duration: 60,
    });

    const all = await tasks.listTasks(uid, { filter: "all" });
    const found = all.find((x) => x.id === t.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("test-updated-name");
    expect(found!.priority).toBe("high");
    expect(found!.startDate).toBe("2026-06-01T14:30+01:00");
    expect(found!.deadline).toBe("2026-06-15");
    expect(found!.startTime).toBe("14:30");
    expect(found!.duration).toBe(60);

    await tasks.deleteTask(t.id);
  });

  it("created task deadline is readable via deadlineDeadline field", async () => {
    // Verifies that createTask writes to deadlineDeadline (the field Griply app reads)
    const t = await tasks.createTask(uid, { name: "test-deadline-field", deadline: "2026-07-20" });

    const all = await tasks.listTasks(uid, { filter: "all" });
    const found = all.find((x) => x.id === t.id);
    expect(found).toBeDefined();
    expect(found!.deadline).toBe("2026-07-20");

    await tasks.deleteTask(t.id);
  });

  it("update_task with nonexistent ID throws not found", async () => {
    await expect(tasks.updateTask("nonexistent_task_id_12345", { name: "x" })).rejects.toThrow(
      /not found|permission/i
    );
  });

  it("delete nonexistent ID throws permission error", async () => {
    await expect(tasks.deleteTask("nonexistent_task_id_12345")).rejects.toThrow(/permission/i);
  });

  it("update_task adds deadline to task without existing endStrategy", async () => {
    // Create task without deadline — endStrategy will be null
    const t = await tasks.createTask(uid, { name: "test-no-deadline-task" });
    await sleep(500);

    // Update to add a deadline (hits tasks.ts else branch: data.endStrategy = {...})
    await tasks.updateTask(t.id, { deadline: "2026-08-01" });

    const all = await tasks.listTasks(uid, { filter: "all" });
    const found = all.find((x) => x.id === t.id);
    expect(found).toBeDefined();
    expect(found!.deadline).toBe("2026-08-01");

    await tasks.deleteTask(t.id);
  });
});

// ── Goal writes ──

describe("goal writes", () => {
  let createdGoalId: string;

  it("create → list → get → progress → complete → delete", async () => {
    // Create
    const g = await goals.createGoal(uid, {
      name: "test-integration-goal",
      goalDescription: "Created by test suite",
      deadline: "2026-06-01",
    });
    expect(typeof g.id).toBe("string");
    expect(g.name).toBe("test-integration-goal");
    expect(g.description).toBe("Created by test suite");
    expect(g.isCompleted).toBe(false);
    expect(g.isArchived).toBe(false);
    createdGoalId = g.id;

    // Verify in list
    const all = await goals.listGoals(uid);
    expect(all.find((x) => x.id === createdGoalId)).toBeDefined();

    // Get
    const fetched = await goals.getGoal(uid, createdGoalId);
    expect(fetched.id).toBe(createdGoalId);
    expect(fetched.name).toBe("test-integration-goal");
    expect(fetched.tasks).toEqual([]);

    // Progress
    const p = await goals.getGoalProgress(createdGoalId);
    expect(p.progress).toBe(0);
    expect(p.totalTasks).toBe(0);

    // Complete
    await goals.completeGoal(createdGoalId);
    const afterComplete = await goals.listGoals(uid);
    const completed = afterComplete.find((x) => x.id === createdGoalId);
    if (completed) expect(completed.isCompleted).toBe(true);

    // Cleanup
    await deleteDoc(doc(getDb(), "goals", createdGoalId));
    const afterDelete = await goals.listGoals(uid);
    expect(afterDelete.find((x) => x.id === createdGoalId)).toBeUndefined();
  });

  it("get_goal returns linked tasks with id, name, isCompleted, priority", async () => {
    // Create a goal, then a task linked to it
    const g = await goals.createGoal(uid, { name: "test-goal-with-tasks" });
    const t = await tasks.createTask(uid, {
      name: "test-linked-task",
      priority: "high",
      goalId: g.id,
    });
    await sleep(500);

    const fetched = await goals.getGoal(uid, g.id);
    expect(fetched.tasks.length).toBeGreaterThanOrEqual(1);
    const linkedTask = fetched.tasks.find((x: any) => x.id === t.id) as any;
    expect(linkedTask).toBeDefined();
    expect(linkedTask.name).toBe("test-linked-task");
    expect(linkedTask.isCompleted).toBe(false);
    expect(linkedTask.priority).toBe("high");

    // Cleanup
    await tasks.deleteTask(t.id);
    await deleteDoc(doc(getDb(), "goals", g.id));
  });

  it("get_goal_progress with invalid ID throws", async () => {
    await expect(goals.getGoalProgress("nonexistent_id_12345")).rejects.toThrow(
      /not found|permission/i
    );
  });
});

// ── Tool handlers ──

function parseToolJson(result: { content: { type: string; text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

function parseToolText(result: { content: { type: string; text: string }[] }) {
  return result.content[0].text;
}

describe("tool handlers: goals", () => {
  it("list_goals returns JSON array via tool handler", async () => {
    const result = await toolHandlers["list_goals"]({});
    const data = parseToolJson(result);
    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].id).toBeDefined();
  });

  it("get_goal returns goal with tasks via tool handler", async () => {
    const allGoals = await goals.listGoals(uid);
    const result = await toolHandlers["get_goal"]({ goalId: allGoals[0].id });
    const data = parseToolJson(result);
    expect(data.id).toBe(allGoals[0].id);
    expect(data.tasks).toBeInstanceOf(Array);
  });

  it("create_goal returns created goal via tool handler", async () => {
    const result = await toolHandlers["create_goal"]({ name: "test-tool-goal" });
    const data = parseToolJson(result);
    expect(data.id).toBeDefined();
    expect(data.name).toBe("test-tool-goal");
    await deleteDoc(doc(getDb(), "goals", data.id));
  });

  it("complete_goal returns confirmation text via tool handler", async () => {
    const g = await goals.createGoal(uid, { name: "test-tool-complete-goal" });
    await sleep(500);
    const result = await toolHandlers["complete_goal"]({ goalId: g.id });
    const text = parseToolText(result);
    expect(text).toContain(g.id);
    expect(text).toContain("completed");
    await sleep(500);
    await deleteDoc(doc(getDb(), "goals", g.id));
  });

  it("get_goal_progress returns progress via tool handler", async () => {
    const allGoals = await goals.listGoals(uid);
    const result = await toolHandlers["get_goal_progress"]({ goalId: allGoals[0].id });
    const data = parseToolJson(result);
    expect(data.goalId).toBe(allGoals[0].id);
    expect(typeof data.progress).toBe("number");
  });
});

describe("tool handlers: tasks", () => {
  it("list_tasks returns JSON array via tool handler", async () => {
    const result = await toolHandlers["list_tasks"]({ filter: "all" });
    const data = parseToolJson(result);
    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBeGreaterThan(0);
  });

  it("create_task returns created task via tool handler", async () => {
    const result = await toolHandlers["create_task"]({ name: "test-tool-task" });
    const data = parseToolJson(result);
    expect(data.id).toBeDefined();
    expect(data.name).toBe("test-tool-task");
    await tasks.deleteTask(data.id);
  });

  it("update_task returns confirmation text via tool handler", async () => {
    const t = await tasks.createTask(uid, { name: "test-tool-update" });
    await sleep(500);
    const result = await toolHandlers["update_task"]({
      taskId: t.id,
      name: "test-tool-updated",
      priority: "High",
    });
    const text = parseToolText(result);
    expect(text).toContain(t.id);
    expect(text).toContain("updated");

    const all = await tasks.listTasks(uid, { filter: "all" });
    const found = all.find((x) => x.id === t.id);
    expect(found!.name).toBe("test-tool-updated");
    expect(found!.priority).toBe("high");
    await tasks.deleteTask(t.id);
  });

  it("complete_task returns confirmation text via tool handler", async () => {
    const t = await tasks.createTask(uid, { name: "test-tool-complete" });
    await sleep(1500);
    const result = await toolHandlers["complete_task"]({ taskId: t.id });
    const text = parseToolText(result);
    expect(text).toContain(t.id);
    expect(text).toContain("completed");
    await deleteDoc(doc(getDb(), "tasks", t.id));
  });

  it("delete_task returns confirmation text via tool handler", async () => {
    const t = await tasks.createTask(uid, { name: "test-tool-delete" });
    await sleep(500);
    const result = await toolHandlers["delete_task"]({ taskId: t.id });
    const text = parseToolText(result);
    expect(text).toContain(t.id);
    expect(text).toContain("deleted");
    const all = await tasks.listTasks(uid, { filter: "all" });
    expect(all.find((x) => x.id === t.id)).toBeUndefined();
  });
});

describe("tool handlers: habits", () => {
  it("list_habits returns JSON array via tool handler", async () => {
    const result = await toolHandlers["list_habits"]({});
    const data = parseToolJson(result);
    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].id).toBeDefined();
    expect(data[0].name).toBeDefined();
  });

  it("add_habit_occurrence returns confirmation text via tool handler", async () => {
    const allHabits = await habits.listHabits(uid);
    const habit = allHabits[0];
    const farDate = "2099-12-30";

    const result = await toolHandlers["add_habit_occurrence"]({
      habitId: habit.id,
      date: farDate,
    });
    const text = parseToolText(result);
    expect(text).toContain(habit.id);
    expect(text).toContain(farDate);

    // Clean up the far-future entry
    await sleep(500);
    const { getDocFromServer, setDoc, doc: fbDoc, serverTimestamp } = await import("firebase/firestore");
    const snap = await getDocFromServer(fbDoc(getDb(), "tasks", habit.id));
    const data = snap.data()!;
    const schedules = [...(data.schedules as Array<Record<string, unknown>>)];
    const last = schedules.length - 1;
    const entries = (schedules[last].entries as Array<Record<string, unknown>>) || [];
    schedules[last] = {
      ...schedules[last],
      entries: entries.filter((e: any) => {
        const d = e.date?.toDate?.()?.toISOString?.() || "";
        return !d.startsWith("2099-12-30");
      }),
    };
    data.schedules = schedules;
    data.updatedAt = serverTimestamp();
    await setDoc(fbDoc(getDb(), "tasks", habit.id), data);
  });

  it("add_habit_occurrence text says 'today' when no date given", async () => {
    const allHabits = await habits.listHabits(uid);
    const habit = allHabits[0];

    const result = await toolHandlers["add_habit_occurrence"]({
      habitId: habit.id,
    });
    const text = parseToolText(result);
    expect(text).toContain("today");

    // Clean up today's test entry (the most recent one)
    await sleep(500);
    const { getDocFromServer, setDoc, doc: fbDoc, serverTimestamp } = await import("firebase/firestore");
    const snap = await getDocFromServer(fbDoc(getDb(), "tasks", habit.id));
    const data = snap.data()!;
    const schedules = [...(data.schedules as Array<Record<string, unknown>>)];
    const last = schedules.length - 1;
    const entries = (schedules[last].entries as Array<Record<string, unknown>>) || [];
    // Remove the last entry (the one we just added)
    schedules[last] = {
      ...schedules[last],
      entries: entries.slice(0, -1),
    };
    data.schedules = schedules;
    data.updatedAt = serverTimestamp();
    await setDoc(fbDoc(getDb(), "tasks", habit.id), data);
  });
});

describe("tool handlers: summary", () => {
  it("get_today_summary returns complete summary via tool handler", async () => {
    const result = await toolHandlers["get_today_summary"]({});
    const data = parseToolJson(result);
    expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.tasks).toBeInstanceOf(Array);
    expect(data.habits).toBeInstanceOf(Array);
    expect(typeof data.completedTaskCount).toBe("number");
    expect(typeof data.totalTaskCount).toBe("number");
  });

  it("get_today_summary respects timezone via tool handler", async () => {
    const result = await toolHandlers["get_today_summary"]({ timezone: "Asia/Tokyo" });
    const data = parseToolJson(result);
    expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("tool registration", () => {
  it("all expected tools are registered", () => {
    const expectedTools = [
      "list_goals", "get_goal", "create_goal", "complete_goal", "get_goal_progress",
      "list_tasks", "create_task", "update_task", "complete_task", "delete_task",
      "list_habits", "add_habit_occurrence",
      "get_today_summary",
    ];
    for (const name of expectedTools) {
      expect(toolHandlers[name]).toBeDefined();
      expect(typeof toolHandlers[name]).toBe("function");
    }
  });
});
