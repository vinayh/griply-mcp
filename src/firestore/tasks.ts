import {
  doc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { getDb } from "../firebase/client.js";
import type { Task, TaskFilter } from "../types.js";
import { TASK_TYPE, makeRoles, tasksRef, relationshipsRef, userFilter } from "./refs.js";
import { docToTask, isTaskDueToday } from "../converters.js";
import {
  MS_PER_DAY,
  MS_PER_MINUTE,
  dateToDeadlineTimestamp,
  dateToStartTimestamp,
  getTodayStr,
  timeStringToMs,
} from "../datetime.js";

export async function listTasks(
  uid: string,
  opts: { filter: TaskFilter; goalId?: string; tagId?: string }
): Promise<Task[]> {
  const base: QueryConstraint[] = [userFilter(uid), where("type", "==", TASK_TYPE.TODO)];

  let constraints: QueryConstraint[];
  switch (opts.filter) {
    case "today":
    case "upcoming":
    case "all":
      constraints = [...base, where("completedAt", "==", null)];
      break;
    case "inbox":
      constraints = [
        ...base,
        where("completedAt", "==", null),
        where("goalId", "==", null),
        where("lifeAreaId", "==", null),
      ];
      break;
    case "completed":
      constraints = [
        ...base,
        where("completedAt", ">=", Timestamp.fromDate(new Date(Date.now() - 30 * MS_PER_DAY))),
      ];
      break;
  }

  if (opts.goalId) constraints.push(where("goalId", "==", opts.goalId));

  const snapshot = await getDocs(
    query(tasksRef(), ...constraints, orderBy("createdAt", "asc"))
  );
  let docs = snapshot.docs.filter((d) => d.data().deletedAt == null);
  if (opts.filter === "today") {
    const todayStr = getTodayStr();
    const todayEnd = new Date(todayStr + "T23:59:59.999Z");
    docs = docs.filter((d) => isTaskDueToday(d.data(), todayStr, todayEnd));
  }
  let tasks = docs.map((d) => docToTask(d.id, d.data()));

  if (opts.tagId) {
    tasks = await filterByTag(uid, opts.tagId, tasks);
  }

  return tasks;
}

async function filterByTag(uid: string, tagId: string, tasks: Task[]): Promise<Task[]> {
  const relSnap = await getDocs(
    query(
      relationshipsRef(),
      userFilter(uid),
      where("id", "==", `tag:${tagId}`)
    )
  );
  const taskIds = new Set<string>();
  for (const d of relSnap.docs) {
    const refs = (d.data().references ?? []) as string[];
    for (const ref of refs) {
      if (ref.startsWith("task:")) taskIds.add(ref.slice(5));
    }
  }
  return tasks.filter((t) => taskIds.has(t.id));
}

export async function createTask(
  uid: string,
  params: {
    name: string;
    taskDescription?: string;
    priority?: string;
    startDate?: string;
    startTime?: string;
    duration?: number;
    deadline?: string;
    goalId?: string;
    lifeAreaId?: string;
    parentTaskId?: string;
  }
): Promise<Task> {
  const docRef = doc(tasksRef());

  const timeslot = (params.startTime || params.duration)
    ? {
        startTime: params.startTime ? timeStringToMs(params.startTime) : null,
        duration: params.duration ? params.duration * MS_PER_MINUTE : null,
      }
    : null;

  const data: Record<string, unknown> = {
    name: params.name,
    description: params.taskDescription || null,
    type: TASK_TYPE.TODO,
    priority: params.priority?.toLowerCase() || "none",
    timeslot,
    endStrategy: params.startDate
      ? { completionCount: null, deadline: dateToStartTimestamp(params.startDate) }
      : null,
    deadlineDeadline: params.deadline ? dateToDeadlineTimestamp(params.deadline) : null,
    goalId: params.goalId || null,
    lifeAreaId: params.lifeAreaId || null,
    parentIds: params.parentTaskId ? [params.parentTaskId] : null,
    completedAt: null,
  };

  await setDoc(docRef, {
    id: docRef.id,
    ...data,
    startDate: Timestamp.fromDate(new Date()),
    sectionId: null,
    iconName: null,
    reminderTime: null,
    childIds: null,
    schedules: null,
    duration: null,
    frozenAt: null,
    archivedAt: null,
    roles: makeRoles(uid),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docToTask(docRef.id, data);
}

export async function updateTask(
  taskId: string,
  params: {
    name?: string;
    taskDescription?: string;
    priority?: string;
    startDate?: string;
    startTime?: string;
    duration?: number;
    deadline?: string;
    goalId?: string;
    lifeAreaId?: string;
  }
): Promise<void> {
  const docRef = doc(getDb(), "tasks", taskId);
  const snap = await getDocFromServer(docRef);
  if (!snap.exists()) throw new Error(`Task ${taskId} not found`);

  const data = snap.data();

  if (params.name !== undefined) data.name = params.name;
  if (params.taskDescription !== undefined) data.description = params.taskDescription || null;
  if (params.priority !== undefined) data.priority = params.priority.toLowerCase();
  if (params.startDate !== undefined) {
    const newStart = dateToStartTimestamp(params.startDate);
    if (data.endStrategy) {
      (data.endStrategy as Record<string, unknown>).deadline = newStart;
    } else {
      data.endStrategy = { completionCount: null, deadline: newStart };
    }
  }
  if (params.deadline !== undefined) {
    data.deadlineDeadline = dateToDeadlineTimestamp(params.deadline);
  }
  if (params.goalId !== undefined) data.goalId = params.goalId || null;
  if (params.lifeAreaId !== undefined) data.lifeAreaId = params.lifeAreaId || null;

  if (params.startTime !== undefined || params.duration !== undefined) {
    const existing = (data.timeslot as Record<string, unknown>) || {};
    data.timeslot = {
      startTime: params.startTime !== undefined
        ? (params.startTime ? timeStringToMs(params.startTime) : null)
        : (existing.startTime ?? null),
      duration: params.duration !== undefined
        ? (params.duration ? params.duration * MS_PER_MINUTE : null)
        : (existing.duration ?? null),
    };
  }

  data.updatedAt = serverTimestamp();
  await setDoc(docRef, data);
}

export async function completeTask(taskId: string): Promise<void> {
  await updateDoc(doc(getDb(), "tasks", taskId), {
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  // Hard-delete via Firestore SDK. Griply's mobile app soft-deletes (sets `deletedAt`)
  // through a Cloud Function we can't reach from the client SDK; client-side writes
  // to `deletedAt` and `archivedAt` are blocked by security rules. Hard-delete still
  // produces the same observable outcome (doc gone, excluded from reads).
  await deleteDoc(doc(getDb(), "tasks", taskId));
}
