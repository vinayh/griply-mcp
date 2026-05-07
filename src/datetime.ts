import { Timestamp } from "firebase/firestore";

export const DEFAULT_TIMEZONE = process.env.GRIPLY_TIMEZONE || "America/New_York";
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

// ── Timestamp → string ──

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

// ── Date string → Timestamp ──

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

// ── Time-of-day ──

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

// ── "Today" helpers ──

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
