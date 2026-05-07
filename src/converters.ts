import { Timestamp } from "firebase/firestore";
import type { Task, Habit } from "./types.js";
import {
  msToDurationMinutes,
  msToTimeString,
  startDateOutput,
  timestampToDateStr,
  timestampToTzDateStr,
} from "./datetime.js";

// ── Field extraction helpers ──

export function str(val: unknown): string | undefined {
  return (typeof val === "string" && val) ? val : undefined;
}

export function firstId(arr: unknown): string | undefined {
  if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];
  return undefined;
}

// ── Task date extraction ──

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

/** Check whether a raw Firestore task doc is due today — start date is today, or deadline is today/past.
 *  Uses getDeadlineTimestamp so legacy docs whose deadlineDeadline mirrors endStrategy.deadline don't
 *  get treated as deadline-due. */
export function isTaskDueToday(
  data: Record<string, unknown>,
  todayStr: string,
  todayEnd: Date
): boolean {
  const start = getStartTimestamp(data);
  if (start && start.toDate().toISOString().split("T")[0] === todayStr) return true;
  const dl = getDeadlineTimestamp(data);
  if (dl && dl.toDate() <= todayEnd) return true;
  return false;
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

// ── Document → domain object ──

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
