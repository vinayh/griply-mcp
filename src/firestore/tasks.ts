import {
  collection,
  doc,
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
import type { Task } from "../types.js";
import {
  TASK_TYPE,
  docToTask,
  getTodayRange,
  dateToDeadlineTimestamp,
  dateToTimestamp,
  timeStringToMs,
  makeRoles,
  tasksRef,
  userFilter,
  MS_PER_MINUTE,
} from "../utils.js";

export async function listTasks(
  uid: string,
  opts: { filter: string; goalId?: string; tagId?: string }
): Promise<Task[]> {
  const constraints: QueryConstraint[] = [
    userFilter(uid),
    where("type", "==", TASK_TYPE.TODO),
  ];

  const { start: todayStart, end: todayEnd } = getTodayRange();

  switch (opts.filter) {
    case "today":
    case "upcoming":
    case "all":
      constraints.push(where("completedAt", "==", null));
      break;
    case "inbox":
      constraints.push(where("completedAt", "==", null));
      constraints.push(where("goalId", "==", null));
      constraints.push(where("lifeAreaId", "==", null));
      break;
    case "completed":
      constraints.length = 0;
      constraints.push(userFilter(uid));
      constraints.push(
        where("completedAt", ">=", Timestamp.fromDate(new Date(Date.now() - 30 * 86_400_000)))
      );
      break;
    default:
      constraints.push(where("completedAt", "==", null));
      break;
  }

  if (opts.goalId) {
    constraints.push(where("goalId", "==", opts.goalId));
  }

  const snapshot = await getDocs(
    query(tasksRef(), ...constraints, orderBy("createdAt", "asc"))
  );
  let tasks = snapshot.docs.map((d) => docToTask(d.id, d.data()));

  if (opts.filter === "today") {
    tasks = tasks.filter((t) => {
      if (t.deadline) return new Date(t.deadline) <= todayEnd;
      if (t.scheduledDate) {
        const sd = new Date(t.scheduledDate);
        return sd >= todayStart && sd <= todayEnd;
      }
      return false;
    });
  }

  if (opts.tagId) {
    tasks = await filterByTag(uid, opts.tagId, tasks);
  }

  return tasks;
}

async function filterByTag(uid: string, tagId: string, tasks: Task[]): Promise<Task[]> {
  const relSnap = await getDocs(
    query(
      collection(getDb(), "relationships"),
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
    scheduledDate?: string;
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

  await setDoc(docRef, {
    id: docRef.id,
    name: params.name,
    description: params.taskDescription || null,
    type: TASK_TYPE.TODO,
    priority: params.priority?.toLowerCase() || "none",
    startDate: params.scheduledDate
      ? dateToTimestamp(params.scheduledDate)
      : Timestamp.fromDate(new Date()),
    timeslot,
    endStrategy: params.deadline
      ? { completionCount: null, deadline: dateToDeadlineTimestamp(params.deadline) }
      : null,
    deadlineDeadline: null, // legacy field, kept for schema compatibility
    goalId: params.goalId || null,
    lifeAreaId: params.lifeAreaId || null,
    parentIds: params.parentTaskId ? [params.parentTaskId] : null,
    sectionId: null,
    iconName: null,
    reminderTime: null,
    childIds: null,
    schedules: null,
    duration: null,
    frozenAt: null,
    archivedAt: null,
    completedAt: null,
    roles: makeRoles(uid),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    name: params.name,
    description: params.taskDescription,
    priority: params.priority,
    scheduledDate: params.scheduledDate,
    startTime: params.startTime,
    duration: params.duration,
    deadline: params.deadline,
    goalId: params.goalId,
    lifeAreaId: params.lifeAreaId,
    isCompleted: false,
  };
}

export async function completeTask(taskId: string): Promise<void> {
  await updateDoc(doc(getDb(), "tasks", taskId), {
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "tasks", taskId));
}
