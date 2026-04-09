import { describe, it, expect, beforeAll } from "vitest";
import { ensureAuth } from "../src/firebase/auth.js";
import * as goals from "../src/firestore/goals.js";
import * as tasks from "../src/firestore/tasks.js";
import * as habits from "../src/firestore/habits.js";
import * as summary from "../src/firestore/summary.js";
import { doc, deleteDoc } from "firebase/firestore";
import { getDb } from "../src/firebase/client.js";

let uid: string;

beforeAll(async () => {
  uid = await ensureAuth();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Auth ──

describe("auth", () => {
  it("returns a uid string", () => {
    expect(uid).toBeTypeOf("string");
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
      expect(g.id).toBeTypeOf("string");
      expect(g.name).toBeTypeOf("string");
      expect(g.isArchived).toBeTypeOf("boolean");
      expect(g.isCompleted).toBeTypeOf("boolean");
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
    expect(p.progress).toBeTypeOf("number");
    expect(p.progress).toBeGreaterThanOrEqual(0);
    expect(p.progress).toBeLessThanOrEqual(100);
    expect(p.completedTasks).toBeTypeOf("number");
    expect(p.totalTasks).toBeTypeOf("number");
  });
});

// ── Tasks: read ──

describe("tasks (read)", () => {
  it("filter=all returns uncompleted tasks", async () => {
    const result = await tasks.listTasks(uid, { filter: "all" });
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
    for (const t of result) {
      expect(t.id).toBeTypeOf("string");
      expect(t.name).toBeTypeOf("string");
      expect(t.isCompleted).toBe(false);
    }
  });

  it("filter=today returns tasks with deadline or scheduledDate", async () => {
    const result = await tasks.listTasks(uid, { filter: "today" });
    expect(result).toBeInstanceOf(Array);
    for (const t of result) {
      expect(t.deadline || t.scheduledDate).toBeTruthy();
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
      expect(h.id).toBeTypeOf("string");
      expect(h.name).toBeTypeOf("string");
      expect(h.completedToday).toBeTypeOf("boolean");
      expect(h.todayCount).toBeTypeOf("number");
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

    expect(t.id).toBeTypeOf("string");
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
    // completed tasks can't be deleted due to security rules
  });

  it("delete nonexistent ID throws permission error", async () => {
    await expect(tasks.deleteTask("nonexistent_task_id_12345")).rejects.toThrow(/permission/i);
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
    expect(g.id).toBeTypeOf("string");
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

  it("get_goal_progress with invalid ID throws", async () => {
    await expect(goals.getGoalProgress("nonexistent_id_12345")).rejects.toThrow(
      /not found|permission/i
    );
  });
});
