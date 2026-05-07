import { describe, it, expect } from "bun:test";
import { Timestamp } from "firebase/firestore";
import { docToGoal } from "../src/firestore/goals.js";
import {
  timestampToISO,
  timestampToDateStr,
  dateToDeadlineTimestamp,
  dateToStartTimestamp,
  dateToTimestamp,
  msToTimeString,
  timeStringToMs,
  msToDurationMinutes,
  getTodayStr,
  getTodayRange,
} from "../src/datetime.js";
import {
  str,
  firstId,
  getDeadlineTimestamp,
  isTaskDueToday,
  docToTask,
  docToHabit,
  getCurrentSchedule,
  countTodayEntries,
} from "../src/converters.js";
import { makeRoles } from "../src/firestore/refs.js";
import { textResult, jsonResult } from "../src/mcp.js";
import { listTasksSchema, TASK_FILTERS } from "../src/types.js";

// ── Timestamp helpers ──

describe("timestampToISO", () => {
  it("returns undefined for null", () => {
    expect(timestampToISO(null)).toBeUndefined();
  });

  it("returns undefined for non-Timestamp object", () => {
    expect(timestampToISO({ seconds: 100 })).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(timestampToISO(undefined)).toBeUndefined();
  });

  it("returns ISO string for a valid Timestamp", () => {
    const ts = Timestamp.fromDate(new Date("2026-04-10T12:00:00Z"));
    expect(timestampToISO(ts)).toBe("2026-04-10T12:00:00.000Z");
  });
});

describe("timestampToDateStr", () => {
  it("returns undefined for null", () => {
    expect(timestampToDateStr(null)).toBeUndefined();
  });

  it("returns undefined for non-Timestamp object", () => {
    expect(timestampToDateStr("not-a-timestamp")).toBeUndefined();
  });

  it("returns YYYY-MM-DD for a valid Timestamp", () => {
    const ts = Timestamp.fromDate(new Date("2026-07-15T08:30:00Z"));
    expect(timestampToDateStr(ts)).toBe("2026-07-15");
  });
});

describe("dateToStartTimestamp", () => {
  it("anchors at 22:59:59.999 UTC of the given date (Griply UI 'Date' convention)", () => {
    const ts = dateToStartTimestamp("2026-04-15");
    expect(ts.toDate().toISOString()).toBe("2026-04-15T22:59:59.999Z");
  });
});

describe("dateToDeadlineTimestamp", () => {
  it("anchors at midnight at start of date in tz (Europe/London BST → previous-day 23:00 UTC)", () => {
    expect(dateToDeadlineTimestamp("2026-05-01", "Europe/London").toDate().toISOString())
      .toBe("2026-04-30T23:00:00.000Z");
  });

  it("anchors at midnight at start of date in tz (Europe/London GMT → previous-day 00:00 UTC)", () => {
    expect(dateToDeadlineTimestamp("2026-01-15", "Europe/London").toDate().toISOString())
      .toBe("2026-01-15T00:00:00.000Z");
  });

  it("anchors at midnight at start of date in tz (America/New_York EDT → same-day 04:00 UTC)", () => {
    expect(dateToDeadlineTimestamp("2026-06-15", "America/New_York").toDate().toISOString())
      .toBe("2026-06-15T04:00:00.000Z");
  });

  it("anchors at midnight at start of date in tz (UTC → same-day 00:00 UTC)", () => {
    expect(dateToDeadlineTimestamp("2026-04-15", "UTC").toDate().toISOString())
      .toBe("2026-04-15T00:00:00.000Z");
  });
});

describe("dateToTimestamp", () => {
  it("creates a Timestamp at midnight UTC for a date string", () => {
    const ts = dateToTimestamp("2026-04-15T00:00:00Z");
    const d = ts.toDate();
    expect(d.toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });

  it("preserves the date from a plain date string", () => {
    const ts = dateToTimestamp("2026-07-01");
    expect(ts.toDate().toISOString().startsWith("2026-07-01")).toBe(true);
  });
});

// ── Time helpers ──

describe("timeStringToMs", () => {
  it("converts HH:MM to milliseconds", () => {
    expect(timeStringToMs("00:00")).toBe(0);
    expect(timeStringToMs("01:00")).toBe(3_600_000);
    expect(timeStringToMs("09:30")).toBe(9 * 3_600_000 + 30 * 60_000);
    expect(timeStringToMs("23:59")).toBe(23 * 3_600_000 + 59 * 60_000);
  });
});

describe("msToTimeString / timeStringToMs", () => {
  it("round-trips correctly", () => {
    expect(msToTimeString(timeStringToMs("09:30"))).toBe("09:30");
    expect(msToTimeString(timeStringToMs("00:00"))).toBe("00:00");
    expect(msToTimeString(timeStringToMs("23:59"))).toBe("23:59");
  });
});

describe("msToDurationMinutes", () => {
  it("returns undefined for null", () => {
    expect(msToDurationMinutes(null)).toBeUndefined();
  });

  it("returns undefined for non-number", () => {
    expect(msToDurationMinutes("foo")).toBeUndefined();
  });

  it("converts milliseconds to minutes", () => {
    expect(msToDurationMinutes(5_400_000)).toBe(90);
  });
});

// ── String/array helpers ──

describe("str", () => {
  it("returns undefined for non-string", () => {
    expect(str(null)).toBeUndefined();
    expect(str(123)).toBeUndefined();
    expect(str(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(str("")).toBeUndefined();
  });

  it("returns the string when valid", () => {
    expect(str("hello")).toBe("hello");
  });
});

describe("firstId", () => {
  it("returns undefined for non-array", () => {
    expect(firstId(null)).toBeUndefined();
    expect(firstId("abc")).toBeUndefined();
  });

  it("returns undefined if first element is not a string", () => {
    expect(firstId([123])).toBeUndefined();
  });

  it("returns first string element", () => {
    expect(firstId(["abc", "def"])).toBe("abc");
  });
});

describe("makeRoles", () => {
  it("returns owner and all array with the uid", () => {
    const roles = makeRoles("user123");
    expect(roles).toEqual({ owner: "user123", all: ["user123"] });
  });
});

// ── Date range helpers ──

describe("getTodayStr", () => {
  it("returns a YYYY-MM-DD string", () => {
    const result = getTodayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("respects timezone parameter", () => {
    // At any given moment, UTC and Pacific can differ by a day
    const utc = getTodayStr("UTC");
    expect(utc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getTodayRange", () => {
  it("returns start and end dates for today", () => {
    const { start, end } = getTodayRange("UTC");
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
    expect(end.getUTCSeconds()).toBe(59);
  });

  it("start and end share the same date", () => {
    const { start, end } = getTodayRange("UTC");
    expect(start.toISOString().split("T")[0]).toBe(end.toISOString().split("T")[0]);
  });
});

// ── MCP response helpers ──

describe("textResult", () => {
  it("returns MCP text content shape", () => {
    const result = textResult("hello");
    expect(result).toEqual({ content: [{ type: "text", text: "hello" }] });
  });
});

describe("jsonResult", () => {
  it("returns MCP text content with formatted JSON", () => {
    const result = jsonResult({ a: 1 });
    expect(result.content[0].text).toBe('{\n  "a": 1\n}');
  });
});

// ── docToGoal ──

describe("docToGoal", () => {
  const baseGoalData = {
    name: "Test goal",
    description: null,
    lifeAreaId: null,
    parentIds: null,
    startDate: null,
    deadline: null,
    metric: null,
    color: null,
    iconName: null,
    archivedAt: null,
    completedAt: null,
    taskCount: 0,
    isFavorite: false,
  };

  it("parses metric with string unit", () => {
    const goal = docToGoal("g1", {
      ...baseGoalData,
      metric: { type: "numeric", targetValue: 100, currentValue: 50, unit: "pages" },
    });
    expect(goal.metricType).toBe("numeric");
    expect(goal.targetValue).toBe(100);
    expect(goal.currentValue).toBe(50);
    expect(goal.unit).toBe("pages");
  });

  it("parses metric with object unit (symbol.en)", () => {
    const goal = docToGoal("g2", {
      ...baseGoalData,
      metric: { type: "currency", targetValue: 1000, unit: { symbol: { en: "$" }, id: "usd" } },
    });
    expect(goal.unit).toBe("$");
  });

  it("parses metric with object unit falling back to id", () => {
    const goal = docToGoal("g3", {
      ...baseGoalData,
      metric: { type: "currency", targetValue: 1000, unit: { id: "eur" } },
    });
    expect(goal.unit).toBe("eur");
  });

  it("returns empty metric fields when metric is null", () => {
    const goal = docToGoal("g4", baseGoalData);
    expect(goal.metricType).toBeUndefined();
    expect(goal.targetValue).toBeUndefined();
    expect(goal.unit).toBeUndefined();
  });

  it("maps all basic fields", () => {
    const goal = docToGoal("g5", {
      ...baseGoalData,
      name: "My Goal",
      description: "A description",
      lifeAreaId: "area1",
      parentIds: ["parent1"],
      startDate: Timestamp.fromDate(new Date("2026-01-01")),
      deadline: Timestamp.fromDate(new Date("2026-12-31")),
      color: "#ff0000",
      iconName: "star",
      archivedAt: Timestamp.now(),
      completedAt: Timestamp.now(),
      taskCount: 5,
    });
    expect(goal.name).toBe("My Goal");
    expect(goal.description).toBe("A description");
    expect(goal.lifeAreaId).toBe("area1");
    expect(goal.parentGoalId).toBe("parent1");
    expect(goal.colorHex).toBe("#ff0000");
    expect(goal.icon).toBe("star");
    expect(goal.isArchived).toBe(true);
    expect(goal.isCompleted).toBe(true);
    expect(goal.taskCount).toBe(5);
  });
});

// ── docToTask ──

describe("docToTask", () => {
  it("handles task with no timeslot or deadline", () => {
    const task = docToTask("id1", {
      name: "Test task",
      description: "",
      priority: "none",
      startDate: Timestamp.fromDate(new Date("2026-04-10")),
      timeslot: null,
      endStrategy: null,
      deadlineDeadline: null,
      goalId: null,
      lifeAreaId: null,
      parentIds: null,
      completedAt: null,
    });
    expect(task.id).toBe("id1");
    expect(task.name).toBe("Test task");
    expect(task.startTime).toBeUndefined();
    expect(task.duration).toBeUndefined();
    expect(task.startDate).toBeUndefined();
    expect(task.deadline).toBeUndefined();
    expect(task.isCompleted).toBe(false);
  });

  it("exposes start date as YYYY-MM-DD in user tz (Europe/London BST: T22:59:59.999Z → next-day midnight)", () => {
    const task = docToTask("id2", {
      name: "Start-only test",
      startDate: Timestamp.fromDate(new Date("2026-04-01T13:49:55Z")),
      timeslot: null,
      endStrategy: { deadline: Timestamp.fromDate(new Date("2026-04-10T22:59:59.999Z")) },
      deadlineDeadline: Timestamp.fromDate(new Date("2026-04-10T22:59:59.999Z")),
      completedAt: null,
    });
    expect(task.startDate).toBe("2026-04-10");
    expect(task.deadline).toBeUndefined();
  });

  it("exposes deadline only when deadlineDeadline differs from endStrategy.deadline", () => {
    const task = docToTask("id3", {
      name: "Both dates test",
      startDate: Timestamp.fromDate(new Date("2026-04-01T13:49:55Z")),
      timeslot: null,
      endStrategy: { deadline: Timestamp.fromDate(new Date("2026-04-10T22:59:59.999Z")) },
      deadlineDeadline: Timestamp.fromDate(new Date("2026-04-15T23:00:00.000Z")),
      completedAt: null,
    });
    expect(task.startDate).toBe("2026-04-10");
    expect(task.deadline).toBe("2026-04-16");
  });

  it("exposes deadline-only task (no start date)", () => {
    const task = docToTask("id4", {
      name: "Deadline-only test",
      startDate: null,
      timeslot: null,
      endStrategy: null,
      deadlineDeadline: Timestamp.fromDate(new Date("2026-04-15T23:00:00.000Z")),
      completedAt: null,
    });
    expect(task.startDate).toBeUndefined();
    expect(task.deadline).toBe("2026-04-16");
  });

  it("includes time-of-day in startDate when timeslot.startTime is set (BST date)", () => {
    const task = docToTask("id4b", {
      name: "Start with time",
      startDate: null,
      timeslot: { startTime: 9 * 3_600_000 + 30 * 60_000, duration: null },
      endStrategy: { deadline: Timestamp.fromDate(new Date("2026-06-01T22:59:59.999Z")) },
      deadlineDeadline: null,
      completedAt: null,
    });
    expect(task.startDate).toBe("2026-06-01T09:30+01:00");
    expect(task.startTime).toBe("09:30");
  });

  it("includes time-of-day in startDate when timeslot.startTime is set (GMT date)", () => {
    const task = docToTask("id4c", {
      name: "Start with time, winter",
      startDate: null,
      timeslot: { startTime: 14 * 3_600_000 + 0, duration: null },
      endStrategy: { deadline: Timestamp.fromDate(new Date("2026-01-15T23:59:59.999Z")) },
      deadlineDeadline: null,
      completedAt: null,
    });
    expect(task.startDate).toBe("2026-01-15T14:00+00:00");
  });

  it("extracts startTime and duration from timeslot", () => {
    const task = docToTask("id5", {
      name: "Timed task",
      startDate: null,
      timeslot: { startTime: 9 * 3_600_000 + 30 * 60_000, duration: 2_700_000 },
      endStrategy: null,
      deadlineDeadline: null,
      completedAt: null,
    });
    expect(task.startTime).toBe("09:30");
    expect(task.duration).toBe(45);
  });

  it("marks completed tasks", () => {
    const task = docToTask("id6", {
      name: "Done task",
      startDate: null,
      timeslot: null,
      endStrategy: null,
      deadlineDeadline: null,
      completedAt: Timestamp.now(),
    });
    expect(task.isCompleted).toBe(true);
  });

  it("extracts goalId, lifeAreaId, and parentTaskId", () => {
    const task = docToTask("id7", {
      name: "Linked task",
      startDate: null,
      timeslot: null,
      endStrategy: null,
      deadlineDeadline: null,
      completedAt: null,
      goalId: "goal1",
      lifeAreaId: "area1",
      parentIds: ["parent1"],
    });
    expect(task.goalId).toBe("goal1");
    expect(task.lifeAreaId).toBe("area1");
    expect(task.parentTaskId).toBe("parent1");
  });
});

// ── getDeadlineTimestamp ──

describe("getDeadlineTimestamp", () => {
  it("returns deadlineDeadline when it differs from endStrategy.deadline", () => {
    const start = Timestamp.fromDate(new Date("2026-04-10T22:59:59.999Z"));
    const dl = Timestamp.fromDate(new Date("2026-04-16T22:59:59.999Z"));
    expect(getDeadlineTimestamp({
      deadlineDeadline: dl,
      endStrategy: { deadline: start },
    })).toBe(dl);
  });

  it("returns null when deadlineDeadline mirrors endStrategy.deadline", () => {
    const ts = Timestamp.fromDate(new Date("2026-04-10T22:59:59.999Z"));
    expect(getDeadlineTimestamp({
      deadlineDeadline: ts,
      endStrategy: { deadline: ts },
    })).toBeNull();
  });

  it("returns deadlineDeadline when there is no start date", () => {
    const ts = Timestamp.fromDate(new Date("2026-04-16T22:59:59.999Z"));
    expect(getDeadlineTimestamp({
      deadlineDeadline: ts,
      endStrategy: null,
    })).toBe(ts);
  });

  it("returns null when deadlineDeadline is absent", () => {
    expect(getDeadlineTimestamp({ endStrategy: null })).toBeNull();
    expect(getDeadlineTimestamp({})).toBeNull();
  });
});

// ── isTaskDueToday ──

describe("isTaskDueToday", () => {
  const todayStr = "2026-04-16";
  const todayEnd = new Date("2026-04-16T23:59:59.999Z");

  it("returns true when deadline is today", () => {
    expect(isTaskDueToday({
      deadlineDeadline: Timestamp.fromDate(new Date("2026-04-16T22:59:59.999Z")),
      endStrategy: null,
    }, todayStr, todayEnd)).toBe(true);
  });

  it("returns true when deadline is in the past", () => {
    expect(isTaskDueToday({
      deadlineDeadline: Timestamp.fromDate(new Date("2026-04-10T22:59:59.999Z")),
      endStrategy: null,
    }, todayStr, todayEnd)).toBe(true);
  });

  it("returns false when deadline is tomorrow", () => {
    expect(isTaskDueToday({
      deadlineDeadline: Timestamp.fromDate(new Date("2026-04-17T22:59:59.999Z")),
      endStrategy: null,
    }, todayStr, todayEnd)).toBe(false);
  });

  it("returns true when start date (endStrategy.deadline) is today", () => {
    expect(isTaskDueToday({
      endStrategy: { deadline: Timestamp.fromDate(new Date("2026-04-16T22:59:59.999Z")) },
    }, todayStr, todayEnd)).toBe(true);
  });

  it("returns false when start date is a different day and no deadline is set", () => {
    expect(isTaskDueToday({
      endStrategy: { deadline: Timestamp.fromDate(new Date("2026-04-15T22:59:59.999Z")) },
    }, todayStr, todayEnd)).toBe(false);
  });

  it("returns false when neither deadline nor start date is set", () => {
    expect(isTaskDueToday({}, todayStr, todayEnd)).toBe(false);
  });

  it("returns true when start date is today even with a far-future deadline", () => {
    expect(isTaskDueToday({
      endStrategy: { deadline: Timestamp.fromDate(new Date("2026-04-16T22:59:59.999Z")) },
      deadlineDeadline: Timestamp.fromDate(new Date("2026-04-30T22:59:59.999Z")),
    }, todayStr, todayEnd)).toBe(true);
  });

  it("returns false when deadlineDeadline mirrors a past endStrategy.deadline (legacy mirror is not a real deadline)", () => {
    const yesterday = Timestamp.fromDate(new Date("2026-04-15T22:59:59.999Z"));
    expect(isTaskDueToday({
      endStrategy: { deadline: yesterday },
      deadlineDeadline: yesterday,
    }, todayStr, todayEnd)).toBe(false);
  });
});

// ── listTasksSchema filter validation ──

describe("listTasksSchema.filter", () => {
  it("accepts each known filter value", () => {
    for (const f of TASK_FILTERS) {
      expect(listTasksSchema.safeParse({ filter: f }).success).toBe(true);
    }
  });

  it("rejects unknown filter values", () => {
    expect(listTasksSchema.safeParse({ filter: "unknown_filter" }).success).toBe(false);
  });

  it("rejects a missing filter", () => {
    expect(listTasksSchema.safeParse({}).success).toBe(false);
  });
});

// ── Habit schedule helpers ──

describe("getCurrentSchedule", () => {
  it("returns undefined for null", () => {
    expect(getCurrentSchedule(null)).toBeUndefined();
  });

  it("returns undefined for empty array", () => {
    expect(getCurrentSchedule([])).toBeUndefined();
  });

  it("returns the last schedule", () => {
    const schedules = [{ id: "a" }, { id: "b" }];
    expect(getCurrentSchedule(schedules)).toEqual({ id: "b" });
  });
});

describe("countTodayEntries", () => {
  it("returns defaults when schedule is undefined", () => {
    expect(countTodayEntries(undefined, "2026-04-10")).toEqual({
      completedToday: false,
      todayCount: 0,
    });
  });

  it("returns defaults when entries is not an array", () => {
    expect(countTodayEntries({ entries: null }, "2026-04-10")).toEqual({
      completedToday: false,
      todayCount: 0,
    });
  });

  it("ignores entries with non-Timestamp dates", () => {
    const schedule = {
      entries: [{ date: "2026-04-10", state: "complete", value: 1 }],
    };
    expect(countTodayEntries(schedule, "2026-04-10")).toEqual({
      completedToday: false,
      todayCount: 0,
    });
  });

  it("counts matching entries for today", () => {
    const schedule = {
      entries: [
        {
          date: Timestamp.fromDate(new Date("2026-04-10T12:00:00Z")),
          state: "complete",
          value: 3,
        },
        {
          date: Timestamp.fromDate(new Date("2026-04-09T12:00:00Z")),
          state: "complete",
          value: 1,
        },
      ],
    };
    const result = countTodayEntries(schedule, "2026-04-10");
    expect(result.completedToday).toBe(true);
    expect(result.todayCount).toBe(3);
  });
});

// ── docToHabit rrule parsing ──

describe("docToHabit rrule parsing", () => {
  const baseHabitData = (rruleFormat: string) => ({
    name: "Test habit",
    description: null,
    startDate: Timestamp.fromDate(new Date("2026-01-01")),
    priority: null,
    iconName: null,
    goalId: null,
    lifeAreaId: null,
    archivedAt: null,
    schedules: [
      {
        completionTarget: { unit: "day", count: 1 },
        frequency: null, // no frequency — forces rrule fallback
        rrule: { format: rruleFormat },
        timeslot: null,
        entries: [],
      },
    ],
  });

  it("parses DAILY rrule format", () => {
    const habit = docToHabit("h1", baseHabitData("FREQ=DAILY"), "2026-04-10");
    expect(habit.schedulePeriod).toBe("day");
  });

  it("parses WEEKLY rrule format", () => {
    const habit = docToHabit("h2", baseHabitData("FREQ=WEEKLY;BYDAY=MO,WE,FR"), "2026-04-10");
    expect(habit.schedulePeriod).toBe("week");
  });

  it("uses frequency.unit when available (skips rrule)", () => {
    const data = {
      ...baseHabitData("FREQ=DAILY"),
      schedules: [
        {
          completionTarget: { unit: "day", count: 1 },
          frequency: { unit: "month" },
          rrule: { format: "FREQ=DAILY" },
          timeslot: null,
          entries: [],
        },
      ],
    };
    const habit = docToHabit("h3", data, "2026-04-10");
    expect(habit.schedulePeriod).toBe("month");
  });

  it("handles habit with no schedules", () => {
    const habit = docToHabit("h4", {
      name: "No schedule",
      description: null,
      startDate: null,
      priority: null,
      iconName: null,
      goalId: null,
      lifeAreaId: null,
      archivedAt: null,
      schedules: null,
    }, "2026-04-10");
    expect(habit.targetPeriod).toBeUndefined();
    expect(habit.schedulePeriod).toBeUndefined();
    expect(habit.completedToday).toBe(false);
    expect(habit.todayCount).toBe(0);
  });

  it("extracts timeslot from schedule", () => {
    const habit = docToHabit("h5", {
      name: "Timed habit",
      description: null,
      startDate: null,
      priority: null,
      iconName: null,
      goalId: null,
      lifeAreaId: null,
      archivedAt: null,
      schedules: [{
        completionTarget: null,
        frequency: null,
        rrule: null,
        timeslot: { startTime: 7 * 3_600_000, duration: 1_800_000 },
        entries: [],
      }],
    }, "2026-04-10");
    expect(habit.startTime).toBe("07:00");
    expect(habit.duration).toBe(30);
  });

  it("marks archived habits", () => {
    const habit = docToHabit("h6", {
      name: "Archived",
      description: null,
      startDate: null,
      priority: null,
      iconName: null,
      goalId: null,
      lifeAreaId: null,
      archivedAt: Timestamp.now(),
      schedules: null,
    }, "2026-04-10");
    expect(habit.isArchived).toBe(true);
  });
});

// ── Griply auth credential resolution ──

describe("resolveGriplyCredentials", () => {
  async function withGriplyEnv<T>(
    email: string | undefined,
    password: string | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    const savedEmail = process.env.GRIPLY_EMAIL;
    const savedPassword = process.env.GRIPLY_PASSWORD;

    if (email === undefined) delete process.env.GRIPLY_EMAIL;
    else process.env.GRIPLY_EMAIL = email;
    if (password === undefined) delete process.env.GRIPLY_PASSWORD;
    else process.env.GRIPLY_PASSWORD = password;

    try {
      return await fn();
    } finally {
      if (savedEmail === undefined) delete process.env.GRIPLY_EMAIL;
      else process.env.GRIPLY_EMAIL = savedEmail;
      if (savedPassword === undefined) delete process.env.GRIPLY_PASSWORD;
      else process.env.GRIPLY_PASSWORD = savedPassword;
    }
  }

  it("uses Bun secrets before env vars", async () => {
    await withGriplyEnv("env@example.com", "env-secret", async () => {
      const { resolveGriplyCredentials } = await import("../src/firebase/auth.js");
      const credentials = await resolveGriplyCredentials(async (_service, name) => {
        if (name === "GRIPLY_EMAIL") return "secret@example.com";
        if (name === "GRIPLY_PASSWORD") return "secret-password";
        return null;
      });

      expect(credentials).toEqual({
        email: "secret@example.com",
        password: "secret-password",
      });
    });
  });

  it("falls back to env vars when Bun secrets are not set", async () => {
    await withGriplyEnv("env@example.com", "env-secret", async () => {
      const { resolveGriplyCredentials } = await import("../src/firebase/auth.js");
      const credentials = await resolveGriplyCredentials(async () => null);

      expect(credentials).toEqual({
        email: "env@example.com",
        password: "env-secret",
      });
    });
  });

  it("falls back to env vars for individual unset Bun secrets", async () => {
    await withGriplyEnv("env@example.com", "env-secret", async () => {
      const { resolveGriplyCredentials } = await import("../src/firebase/auth.js");
      const credentials = await resolveGriplyCredentials(async (_service, name) => {
        if (name === "GRIPLY_EMAIL") return "secret@example.com";
        return null;
      });

      expect(credentials).toEqual({
        email: "secret@example.com",
        password: "env-secret",
      });
    });
  });

  it("throws when Bun secrets and env vars are not set", async () => {
    await withGriplyEnv(undefined, undefined, async () => {
      const { resolveGriplyCredentials } = await import("../src/firebase/auth.js");
      await expect(resolveGriplyCredentials(async () => null)).rejects.toThrow(
        "Griply auth credentials are required in Bun secrets"
      );
    });
  });

  it("throws when only GRIPLY_EMAIL is set", async () => {
    await withGriplyEnv("test@example.com", undefined, async () => {
      const { resolveGriplyCredentials } = await import("../src/firebase/auth.js");
      await expect(resolveGriplyCredentials(async () => null)).rejects.toThrow(
        "Griply auth credentials are required in Bun secrets"
      );
    });
  });

  it("throws when only GRIPLY_PASSWORD is set", async () => {
    await withGriplyEnv(undefined, "secret", async () => {
      const { resolveGriplyCredentials } = await import("../src/firebase/auth.js");
      await expect(resolveGriplyCredentials(async () => null)).rejects.toThrow(
        "Griply auth credentials are required in Bun secrets"
      );
    });
  });
});

// ── setup.ts loadEnvFile (line 10: does not overwrite existing vars) ──

describe("loadEnvFile", () => {
  const { writeFileSync, unlinkSync } = require("fs");
  const { resolve } = require("path");
  const { loadEnvFile } = require("./setup");

  function withTempEnv(content: string, fn: (path: string) => void) {
    const p = resolve(process.cwd(), `.env.test.${Date.now()}`);
    writeFileSync(p, content);
    try { fn(p); } finally { unlinkSync(p); }
  }

  it("does not overwrite an existing env var", () => {
    process.env.__TEST_SETUP_EXISTING = "original";
    withTempEnv("__TEST_SETUP_EXISTING=from_file", (p) => {
      loadEnvFile(p);
      expect(process.env.__TEST_SETUP_EXISTING).toBe("original");
    });
    delete process.env.__TEST_SETUP_EXISTING;
  });

  it("sets a new env var when not already present", () => {
    const key = "__TEST_SETUP_NEW_" + Date.now();
    withTempEnv(`${key}=from_file`, (p) => {
      loadEnvFile(p);
      expect(process.env[key]).toBe("from_file");
    });
    delete process.env[key];
  });

  it("skips lines without an equals sign", () => {
    const key = "__TEST_SETUP_NOEQ_" + Date.now();
    withTempEnv(`# this is a comment\n${key}=value`, (p) => {
      loadEnvFile(p);
      expect(process.env[key]).toBe("value");
    });
    delete process.env[key];
  });

  it("skips lines where equals is at position 0", () => {
    withTempEnv("=valuewithnokey", (p) => {
      loadEnvFile(p);
      // No key to check — just ensure no crash
    });
  });

  it("trims whitespace from keys and values", () => {
    const key = "__TEST_SETUP_TRIM_" + Date.now();
    withTempEnv(`  ${key}  =  spaced_value  `, (p) => {
      loadEnvFile(p);
      expect(process.env[key]).toBe("spaced_value");
    });
    delete process.env[key];
  });
});
