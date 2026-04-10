import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  timestampToISO,
  timestampToDateStr,
  msToTimeString,
  timeStringToMs,
  msToDurationMinutes,
  str,
  firstId,
  docToTask,
  docToHabit,
  getCurrentSchedule,
  countTodayEntries,
  textResult,
  jsonResult,
} from "../src/utils.js";

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

// ── Time helpers ──

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
    expect(task.deadline).toBeUndefined();
    expect(task.isCompleted).toBe(false);
  });

  it("prefers deadlineDeadline over endStrategy.deadline", () => {
    const task = docToTask("id2", {
      name: "Deadline test",
      startDate: null,
      timeslot: null,
      endStrategy: { deadline: Timestamp.fromDate(new Date("2026-04-10")) },
      deadlineDeadline: Timestamp.fromDate(new Date("2026-04-16")),
      completedAt: null,
    });
    expect(task.deadline).toBe("2026-04-16T00:00:00.000Z");
  });

  it("falls back to endStrategy.deadline when deadlineDeadline is null", () => {
    const task = docToTask("id3", {
      name: "Fallback test",
      startDate: null,
      timeslot: null,
      endStrategy: { deadline: Timestamp.fromDate(new Date("2026-04-10")) },
      deadlineDeadline: null,
      completedAt: null,
    });
    expect(task.deadline).toBe("2026-04-10T00:00:00.000Z");
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
});
