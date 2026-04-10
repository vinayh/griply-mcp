import {
  doc,
  getDocs,
  setDoc,
  getDocFromServer,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "../firebase/client.js";
import type { Habit } from "../types.js";
import {
  TASK_TYPE,
  docToHabit,
  getTodayStr,
  getCurrentSchedule,
  tasksRef,
  userFilter,
} from "../utils.js";

export async function listHabits(uid: string): Promise<Habit[]> {
  const todayStr = getTodayStr();
  const snapshot = await getDocs(
    query(
      tasksRef(),
      userFilter(uid),
      where("type", "==", TASK_TYPE.HABIT),
      where("completedAt", "==", null),
      where("archivedAt", "==", null),
      orderBy("createdAt", "asc")
    )
  );
  return snapshot.docs.map((d) => docToHabit(d.id, d.data(), todayStr));
}

export async function addHabitOccurrence(
  params: { habitId: string; date?: string; status?: string }
): Promise<void> {
  const habitRef = doc(getDb(), "tasks", params.habitId);
  const habitDoc = await getDocFromServer(habitRef);

  if (!habitDoc.exists()) throw new Error(`Habit ${params.habitId} not found`);

  const data = habitDoc.data();
  const schedules = data.schedules as Array<Record<string, unknown>> | null;
  if (!schedules?.length) throw new Error("Habit has no schedules");

  const targetDate = params.date || new Date().toISOString().split("T")[0];
  const newEntry = {
    id: crypto.randomUUID(),
    state: params.status || "complete",
    date: Timestamp.fromDate(new Date(targetDate + "T23:59:59Z")),
    value: 1,
  };

  const last = schedules.length - 1;
  const updatedSchedules = [...schedules];
  updatedSchedules[last] = {
    ...updatedSchedules[last],
    entries: [...((updatedSchedules[last].entries as Array<unknown>) || []), newEntry],
  };

  data.schedules = updatedSchedules;
  data.updatedAt = serverTimestamp();
  await setDoc(habitRef, data);
}
