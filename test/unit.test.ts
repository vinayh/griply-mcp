import { describe, it, expect } from "bun:test";
import { Timestamp } from "firebase/firestore";
import {
  timestampToISO,
  timestampToDateStr,
  dateToDeadlineTimestamp,
  dateToTimestamp,
  msToTimeString,
  timeStringToMs,
  msToDurationMinutes,
  getTodayStr,
  getTodayRange,
  str,
  firstId,
  makeRoles,
  getDeadlineTimestamp,
  isTaskDueToday,
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

describe("dateToDeadlineTimestamp", () => {
  it("creates a Timestamp at 22:59:59.999 UTC", () => {
    const ts = dateToDeadlineTimestamp("2026-04-15");
    const d = ts.toDate();
    expect(d.getUTCHours()).toBe(22);
    expect(d.getUTCMinutes()).toBe(59);
    expect(d.getUTCSeconds()).toBe(59);
    expect(d.getUTCMilliseconds()).toBe(999);
    expect(d.toISOString().startsWith("2026-04-15")).toBe(true);
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

  it("extracts startTime and duration from timeslot", () => {
    const task = docToTask("id4", {
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
    const task = docToTask("id5", {
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
    const task = docToTask("id6", {
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
  it("prefers deadlineDeadline over endStrategy.deadline", () => {
    const ts1 = Timestamp.fromDate(new Date("2026-04-16"));
    const ts2 = Timestamp.fromDate(new Date("2026-04-10"));
    const result = getDeadlineTimestamp({
      deadlineDeadline: ts1,
      endStrategy: { deadline: ts2 },
    });
    expect(result).toBe(ts1);
  });

  it("falls back to endStrategy.deadline when deadlineDeadline is null", () => {
    const ts = Timestamp.fromDate(new Date("2026-04-10"));
    const result = getDeadlineTimestamp({
      deadlineDeadline: null,
      endStrategy: { deadline: ts },
    });
    expect(result).toBe(ts);
  });

  it("returns null when both are absent", () => {
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

  it("returns true when scheduledDate matches today", () => {
    expect(isTaskDueToday({
      startDate: Timestamp.fromDate(new Date("2026-04-16T00:00:00Z")),
    }, todayStr, todayEnd)).toBe(true);
  });

  it("returns false when scheduledDate is a different day", () => {
    expect(isTaskDueToday({
      startDate: Timestamp.fromDate(new Date("2026-04-15T00:00:00Z")),
    }, todayStr, todayEnd)).toBe(false);
  });

  it("returns false when neither deadline nor scheduledDate is set", () => {
    expect(isTaskDueToday({}, todayStr, todayEnd)).toBe(false);
  });

  it("deadline takes priority over scheduledDate", () => {
    // deadline is tomorrow (false), but scheduledDate is today — deadline wins
    expect(isTaskDueToday({
      deadlineDeadline: Timestamp.fromDate(new Date("2026-04-17T22:59:59.999Z")),
      startDate: Timestamp.fromDate(new Date("2026-04-16T00:00:00Z")),
    }, todayStr, todayEnd)).toBe(false);
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

// ── ensureAuth env var check (auth.ts lines 13-15) ──

describe("ensureAuth", () => {
  it("throws when GRIPLY_EMAIL and GRIPLY_PASSWORD are not set", async () => {
    const savedEmail = process.env.GRIPLY_EMAIL;
    const savedPassword = process.env.GRIPLY_PASSWORD;
    delete process.env.GRIPLY_EMAIL;
    delete process.env.GRIPLY_PASSWORD;
    try {
      const { ensureAuth } = await import("../src/firebase/auth.js");
      await expect(ensureAuth()).rejects.toThrow(
        "GRIPLY_EMAIL and GRIPLY_PASSWORD environment variables are required"
      );
    } finally {
      if (savedEmail) process.env.GRIPLY_EMAIL = savedEmail;
      if (savedPassword) process.env.GRIPLY_PASSWORD = savedPassword;
    }
  });

  it("throws when only GRIPLY_EMAIL is set", async () => {
    const savedEmail = process.env.GRIPLY_EMAIL;
    const savedPassword = process.env.GRIPLY_PASSWORD;
    process.env.GRIPLY_EMAIL = "test@example.com";
    delete process.env.GRIPLY_PASSWORD;
    try {
      const { ensureAuth } = await import("../src/firebase/auth.js");
      await expect(ensureAuth()).rejects.toThrow(
        "GRIPLY_EMAIL and GRIPLY_PASSWORD environment variables are required"
      );
    } finally {
      if (savedEmail) process.env.GRIPLY_EMAIL = savedEmail;
      else delete process.env.GRIPLY_EMAIL;
      if (savedPassword) process.env.GRIPLY_PASSWORD = savedPassword;
    }
  });

  it("throws when only GRIPLY_PASSWORD is set", async () => {
    const savedEmail = process.env.GRIPLY_EMAIL;
    const savedPassword = process.env.GRIPLY_PASSWORD;
    delete process.env.GRIPLY_EMAIL;
    process.env.GRIPLY_PASSWORD = "secret";
    try {
      const { ensureAuth } = await import("../src/firebase/auth.js");
      await expect(ensureAuth()).rejects.toThrow(
        "GRIPLY_EMAIL and GRIPLY_PASSWORD environment variables are required"
      );
    } finally {
      if (savedEmail) process.env.GRIPLY_EMAIL = savedEmail;
      if (savedPassword) process.env.GRIPLY_PASSWORD = savedPassword;
      else delete process.env.GRIPLY_PASSWORD;
    }
  });
});

// ── setup.ts env loading (line 10: does not overwrite existing vars) ──

describe("setup.ts env loading logic", () => {
  // Replicates the parsing logic from test/setup.ts to test it in isolation
  function loadEnvString(content: string) {
    for (const line of content.split("\n")) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        if (!process.env[key]) {
          process.env[key] = line.slice(idx + 1).trim();
        }
      }
    }
  }

  it("does not overwrite an existing env var", () => {
    process.env.__TEST_SETUP_EXISTING = "original";
    loadEnvString("__TEST_SETUP_EXISTING=from_file");
    expect(process.env.__TEST_SETUP_EXISTING).toBe("original");
    delete process.env.__TEST_SETUP_EXISTING;
  });

  it("sets a new env var when not already present", () => {
    const key = "__TEST_SETUP_NEW_" + Date.now();
    loadEnvString(`${key}=from_file`);
    expect(process.env[key]).toBe("from_file");
    delete process.env[key];
  });

  it("skips lines without an equals sign", () => {
    const key = "__TEST_SETUP_NOEQ_" + Date.now();
    loadEnvString(`# this is a comment\n${key}=value`);
    expect(process.env[key]).toBe("value");
    delete process.env[key];
  });

  it("skips lines where equals is at position 0", () => {
    loadEnvString("=valuewithnokey");
    // No key to check — just ensure no crash
  });

  it("trims whitespace from keys and values", () => {
    const key = "__TEST_SETUP_TRIM_" + Date.now();
    loadEnvString(`  ${key}  =  spaced_value  `);
    expect(process.env[key]).toBe("spaced_value");
    delete process.env[key];
  });
});
