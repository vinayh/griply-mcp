import {
  Timestamp,
  collection,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { getDb } from "./firebase/client.js";
import type { Task, Habit } from "./types.js";

// ── Constants ──

export const TASK_TYPE = { TODO: "todo", HABIT: "habit", REPEATING: "repeating" } as const;
export const DEFAULT_TIMEZONE = "America/New_York";
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;

// ── Timestamp helpers ──

export function timestampToISO(ts: unknown): string | undefined {
  if (!ts || !(ts instanceof Timestamp)) return undefined;
  return ts.toDate().toISOString();
}

export function timestampToDateStr(ts: unknown): string | undefined {
  if (!ts || !(ts instanceof Timestamp)) return undefined;
  return ts.toDate().toISOString().split("T")[0];
}

export function dateToDeadlineTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr + "T22:59:59.999Z"));
}

export function dateToTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr));
}

// ── Time-of-day helpers ──

export function msToTimeString(ms: number): string {
  const hours = Math.floor(ms / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function timeStringToMs(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * MS_PER_HOUR + m * MS_PER_MINUTE;
}

export function msToDurationMinutes(ms: unknown): number | undefined {
  if (ms == null || typeof ms !== "number") return undefined;
  return Math.round(ms / MS_PER_MINUTE);
}

// ── Date range helpers ──

export function getTodayStr(timezone = DEFAULT_TIMEZONE): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

export function getTodayRange(timezone = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const dateStr = getTodayStr(timezone);
  return {
    start: new Date(dateStr + "T00:00:00Z"),
    end: new Date(dateStr + "T23:59:59.999Z"),
  };
}

// ── Firestore field helpers ──

export function str(val: unknown): string | undefined {
  return (typeof val === "string" && val) ? val : undefined;
}

export function firstId(arr: unknown): string | undefined {
  if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];
  return undefined;
}

export function makeRoles(uid: string): { owner: string; all: string[] } {
  return { owner: uid, all: [uid] };
}

// ── Firestore query helpers ──

export function tasksRef() {
  return collection(getDb(), "tasks");
}

export function goalsRef() {
  return collection(getDb(), "goals");
}

export function relationshipsRef() {
  return collection(getDb(), "relationships");
}

export function userFilter(uid: string): QueryConstraint {
  return where("roles.all", "array-contains", uid);
}

// ── Document converters ──

/** Extract deadline from raw Firestore data. deadlineDeadline is preferred; endStrategy.deadline is the fallback. */
export function getDeadlineTimestamp(data: Record<string, unknown>): Timestamp | null {
  const endStrategy = data.endStrategy as Record<string, unknown> | null;
  return (data.deadlineDeadline ?? endStrategy?.deadline ?? null) as Timestamp | null;
}

/** Check whether a raw Firestore task doc is due today (by deadline or scheduledDate). */
export function isTaskDueToday(
  data: Record<string, unknown>,
  todayStr: string,
  todayEnd: Date
): boolean {
  const dl = getDeadlineTimestamp(data);
  if (dl) return dl.toDate() <= todayEnd;
  const startDate = data.startDate as Timestamp | null;
  if (startDate && startDate instanceof Timestamp) {
    return startDate.toDate().toISOString().split("T")[0] === todayStr;
  }
  return false;
}

export function docToTask(id: string, data: Record<string, unknown>): Task {
  const timeslot = data.timeslot as Record<string, unknown> | null;
  const dl = getDeadlineTimestamp(data);

  return {
    id,
    name: data.name as string,
    description: str(data.description),
    priority: str(data.priority),
    scheduledDate: timestampToISO(data.startDate),
    startTime: timeslot?.startTime != null
      ? msToTimeString(timeslot.startTime as number)
      : undefined,
    duration: msToDurationMinutes(timeslot?.duration),
    deadline: timestampToISO(dl),
    goalId: str(data.goalId),
    lifeAreaId: str(data.lifeAreaId),
    parentTaskId: firstId(data.parentIds),
    isCompleted: data.completedAt != null,
  };
}

export function docToHabit(id: string, data: Record<string, unknown>, todayStr: string): Habit {
  const schedule = getCurrentSchedule(data.schedules);

  let targetPeriod: string | undefined;
  let targetCount: number | undefined;
  let schedulePeriod: string | undefined;

  if (schedule) {
    const ct = schedule.completionTarget as Record<string, unknown> | null;
    if (ct) {
      targetPeriod = ct.unit as string;
      targetCount = ct.count as number;
    }
    const freq = schedule.frequency as Record<string, unknown> | null;
    if (freq) schedulePeriod = freq.unit as string;

    const rrule = schedule.rrule as Record<string, unknown> | null;
    if (rrule?.format && !schedulePeriod) {
      const fmt = rrule.format as string;
      if (fmt.includes("DAILY")) schedulePeriod = "day";
      else if (fmt.includes("WEEKLY")) schedulePeriod = "week";
    }
  }

  const { completedToday, todayCount } = countTodayEntries(schedule, todayStr);
  const timeslot = schedule?.timeslot as Record<string, unknown> | null;

  return {
    id,
    name: data.name as string,
    description: str(data.description),
    targetPeriod,
    targetCount,
    schedulePeriod,
    startDate: timestampToDateStr(data.startDate),
    startTime: timeslot?.startTime != null
      ? msToTimeString(timeslot.startTime as number)
      : undefined,
    duration: msToDurationMinutes(timeslot?.duration),
    priority: str(data.priority),
    icon: str(data.iconName),
    goalId: str(data.goalId),
    lifeAreaId: str(data.lifeAreaId),
    isArchived: data.archivedAt != null,
    completedToday,
    todayCount,
  };
}

// ── Habit schedule helpers ──

export function getCurrentSchedule(
  schedules: unknown
): Record<string, unknown> | undefined {
  if (!Array.isArray(schedules) || schedules.length === 0) return undefined;
  return schedules[schedules.length - 1] as Record<string, unknown>;
}

export function countTodayEntries(
  schedule: Record<string, unknown> | undefined,
  todayStr: string
): { completedToday: boolean; todayCount: number } {
  let completedToday = false;
  let todayCount = 0;

  const entries = schedule?.entries;
  if (!Array.isArray(entries)) return { completedToday, todayCount };

  for (const entry of entries as Array<Record<string, unknown>>) {
    const date = entry.date;
    if (date && date instanceof Timestamp) {
      const dateStr = date.toDate().toISOString().split("T")[0];
      if (dateStr === todayStr && entry.state === "complete") {
        completedToday = true;
        todayCount += (entry.value as number) || 1;
      }
    }
  }

  return { completedToday, todayCount };
}

// ── MCP response helpers ──

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function jsonResult(data: unknown) {
  return textResult(JSON.stringify(data, null, 2));
}
