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
export const DEFAULT_TIMEZONE = process.env.GRIPLY_TIMEZONE || "America/New_York";
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

/** YYYY-MM-DD as rendered in tz — collapses Griply's two storage anchors back to the calendar date the user picked. */
export function timestampToTzDateStr(ts: unknown, tz: string = DEFAULT_TIMEZONE): string | undefined {
  if (!ts || !(ts instanceof Timestamp)) return undefined;
  return ts.toDate().toLocaleDateString("en-CA", { timeZone: tz });
}

/** Compose start-date output: YYYY-MM-DD when no time is set, or local ISO (`YYYY-MM-DDTHH:MM±OFFSET`) when timeslot.startTime is set. */
export function startDateOutput(
  startTs: Timestamp | null,
  timeslotStartMs: unknown,
  tz: string = DEFAULT_TIMEZONE,
): string | undefined {
  if (!startTs) return undefined;
  const dateStr = startTs.toDate().toLocaleDateString("en-CA", { timeZone: tz });
  if (typeof timeslotStartMs !== "number") return dateStr;
  const hh = String(Math.floor(timeslotStartMs / MS_PER_HOUR)).padStart(2, "0");
  const mm = String(Math.floor((timeslotStartMs % MS_PER_HOUR) / MS_PER_MINUTE)).padStart(2, "0");
  const probe = new Date(`${dateStr}T${hh}:${mm}:00Z`);
  return `${dateStr}T${hh}:${mm}${formatOffset(getTzOffsetMinutes(probe, tz))}`;
}

function formatOffset(min: number): string {
  if (min === 0) return "+00:00";
  const sign = min > 0 ? "+" : "-";
  const abs = Math.abs(min);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Encode a Griply UI "Date" (start date). Griply anchors these at 1ms before UTC midnight. */
export function dateToStartTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr + "T22:59:59.999Z"));
}

/** Encode a Griply UI "Deadline" — anchored at midnight at the *start* of dateStr in the user's timezone. */
export function dateToDeadlineTimestamp(dateStr: string, tz: string = DEFAULT_TIMEZONE): Timestamp {
  const naive = new Date(dateStr + "T00:00:00Z");
  const offsetMin = getTzOffsetMinutes(naive, tz);
  return Timestamp.fromDate(new Date(naive.getTime() - offsetMin * MS_PER_MINUTE));
}

export function dateToTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr));
}

function getTzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asIfLocal = Date.UTC(
    parts.year!, parts.month! - 1, parts.day!,
    parts.hour!, parts.minute!, parts.second!,
  );
  return Math.round((asIfLocal - date.getTime()) / MS_PER_MINUTE);
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

/** Extract the UI "Date" (start date). Griply stores it under endStrategy.deadline. */
export function getStartTimestamp(data: Record<string, unknown>): Timestamp | null {
  const endStrategy = data.endStrategy as Record<string, unknown> | null;
  const ts = endStrategy?.deadline;
  return ts instanceof Timestamp ? ts : null;
}

/** Extract the UI "Deadline". Griply mirrors the start date into deadlineDeadline when no
 *  UI Deadline is set, so a deadlineDeadline equal to endStrategy.deadline is not a real deadline. */
export function getDeadlineTimestamp(data: Record<string, unknown>): Timestamp | null {
  const dl = data.deadlineDeadline;
  if (!(dl instanceof Timestamp)) return null;
  const start = getStartTimestamp(data);
  if (start && start.isEqual(dl)) return null;
  return dl;
}

/** Check whether a raw Firestore task doc is due today — start date is today, or deadline is today/past. */
export function isTaskDueToday(
  data: Record<string, unknown>,
  todayStr: string,
  todayEnd: Date
): boolean {
  const start = getStartTimestamp(data);
  if (start && start.toDate().toISOString().split("T")[0] === todayStr) return true;
  const dl = data.deadlineDeadline;
  if (dl instanceof Timestamp && dl.toDate() <= todayEnd) return true;
  return false;
}

export function docToTask(id: string, data: Record<string, unknown>): Task {
  const timeslot = data.timeslot as Record<string, unknown> | null;

  return {
    id,
    name: data.name as string,
    description: str(data.description),
    priority: str(data.priority),
    startDate: startDateOutput(getStartTimestamp(data), timeslot?.startTime),
    startTime: timeslot?.startTime != null
      ? msToTimeString(timeslot.startTime as number)
      : undefined,
    duration: msToDurationMinutes(timeslot?.duration),
    deadline: timestampToTzDateStr(getDeadlineTimestamp(data)),
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
