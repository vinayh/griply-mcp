import {
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import type { Task, Habit, TodaySummary } from "../types.js";
import {
  TASK_TYPE,
  DEFAULT_TIMEZONE,
  docToTask,
  docToHabit,
  getTodayStr,
  tasksRef,
  userFilter,
} from "../utils.js";

export async function getTodaySummary(
  uid: string,
  opts?: { timezone?: string }
): Promise<TodaySummary> {
  const tz = opts?.timezone || DEFAULT_TIMEZONE;
  const todayStr = getTodayStr(tz);
  const todayEnd = new Date(todayStr + "T23:59:59.999Z");

  // Single query for all todos — used for both pending and completed-today counts
  const allTodoSnap = await getDocs(
    query(
      tasksRef(),
      userFilter(uid),
      where("type", "==", TASK_TYPE.TODO),
      orderBy("createdAt", "asc")
    )
  );

  const tasks: Task[] = [];
  let completedTaskCount = 0;

  for (const d of allTodoSnap.docs) {
    const data = d.data();
    const completedAt = data.completedAt as Timestamp | null;

    if (completedAt && completedAt instanceof Timestamp) {
      const completedDateStr = completedAt.toDate().toLocaleDateString("en-CA", { timeZone: tz });
      if (completedDateStr === todayStr) completedTaskCount++;
      continue;
    }

    // Uncompleted: check if due today
    const endStrategy = data.endStrategy as Record<string, unknown> | null;
    const dl = (endStrategy?.deadline ?? data.deadlineDeadline) as Timestamp | null;
    const startDate = data.startDate as Timestamp | null;

    const isToday =
      (dl && dl.toDate() <= todayEnd) ||
      (startDate && startDate.toDate().toISOString().split("T")[0] === todayStr);

    if (isToday) tasks.push(docToTask(d.id, data));
  }

  // Query active habits
  const habitsSnap = await getDocs(
    query(
      tasksRef(),
      userFilter(uid),
      where("type", "==", TASK_TYPE.HABIT),
      where("completedAt", "==", null),
      where("archivedAt", "==", null)
    )
  );

  const habits: Habit[] = [];
  let completedHabitCount = 0;

  for (const d of habitsSnap.docs) {
    const habit = docToHabit(d.id, d.data(), todayStr);
    if (habit.completedToday) completedHabitCount++;
    habits.push(habit);
  }

  return {
    date: todayStr,
    tasks,
    habits,
    completedTaskCount,
    totalTaskCount: tasks.length + completedTaskCount,
    completedHabitCount,
    totalHabitCount: habits.length,
  };
}
