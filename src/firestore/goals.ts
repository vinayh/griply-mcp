import {
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "../firebase/client.js";
import type { Goal } from "../types.js";
import { TASK_TYPE, makeRoles, goalsRef, tasksRef, userFilter } from "./refs.js";
import { str, firstId } from "../converters.js";
import { dateToTimestamp, timestampToISO } from "../datetime.js";

function parseMetric(metric: unknown): Pick<Goal, "metricType" | "targetValue" | "currentValue" | "unit"> {
  if (!metric || typeof metric !== "object") return {};
  const m = metric as Record<string, unknown>;

  let unit: string | undefined;
  const unitObj = m.unit;
  if (typeof unitObj === "string") {
    unit = unitObj;
  } else if (unitObj && typeof unitObj === "object") {
    const u = unitObj as Record<string, unknown>;
    const symbol = u.symbol as Record<string, string> | undefined;
    unit = symbol?.en || (u.id as string) || undefined;
  }

  return {
    metricType: str(m.type),
    targetValue: m.targetValue as number | undefined,
    currentValue: m.currentValue as number | undefined,
    unit,
  };
}

export function docToGoal(id: string, data: Record<string, unknown>): Goal {
  return {
    id,
    name: data.name as string,
    description: str(data.description),
    lifeAreaId: str(data.lifeAreaId),
    parentGoalId: firstId(data.parentIds),
    startDate: timestampToISO(data.startDate),
    deadline: timestampToISO(data.deadline),
    ...parseMetric(data.metric),
    colorHex: str(data.color),
    icon: str(data.iconName),
    isArchived: data.archivedAt != null,
    isCompleted: data.completedAt != null,
    taskCount: data.taskCount as number | undefined,
  };
}

export async function listGoals(
  uid: string,
  opts?: { lifeAreaId?: string; includeArchived?: boolean }
): Promise<Goal[]> {
  const constraints = [
    userFilter(uid),
    orderBy("createdAt", "asc"),
  ];
  if (opts?.lifeAreaId) {
    constraints.push(where("lifeAreaId", "==", opts.lifeAreaId));
  }

  const snapshot = await getDocs(query(goalsRef(), ...constraints));

  return snapshot.docs
    .filter((d) => opts?.includeArchived || d.data().archivedAt == null)
    .map((d) => docToGoal(d.id, d.data()));
}

export async function getGoal(
  uid: string,
  goalId: string
): Promise<Goal & { tasks: unknown[] }> {
  const goalDoc = await getDoc(doc(getDb(), "goals", goalId));
  if (!goalDoc.exists()) throw new Error(`Goal ${goalId} not found`);

  const tasksSnap = await getDocs(
    query(
      tasksRef(),
      userFilter(uid),
      where("goalId", "==", goalId),
      where("type", "==", TASK_TYPE.TODO)
    )
  );

  return {
    ...docToGoal(goalDoc.id, goalDoc.data()),
    tasks: tasksSnap.docs
      .filter((d) => d.data().deletedAt == null)
      .map((d) => ({
        id: d.id,
        name: d.data().name,
        isCompleted: d.data().completedAt != null,
        priority: d.data().priority,
      })),
  };
}

export async function createGoal(
  uid: string,
  params: {
    name: string;
    goalDescription?: string;
    lifeAreaId?: string;
    parentGoalId?: string;
    startDate?: string;
    deadline?: string;
    colorHex?: string;
    icon?: string;
  }
): Promise<Goal> {
  const docRef = doc(goalsRef());

  const data: Record<string, unknown> = {
    name: params.name,
    description: params.goalDescription || null,
    lifeAreaId: params.lifeAreaId || null,
    parentIds: params.parentGoalId ? [params.parentGoalId] : null,
    startDate: params.startDate
      ? dateToTimestamp(params.startDate)
      : Timestamp.fromDate(new Date()),
    deadline: params.deadline ? dateToTimestamp(params.deadline) : null,
    color: params.colorHex || "inherit-life-area",
    iconName: params.icon || null,
    metric: null,
    archivedAt: null,
    completedAt: null,
    taskCount: 0,
  };

  await setDoc(docRef, {
    id: docRef.id,
    ...data,
    image: null,
    frozenAt: null,
    completedTaskCount: 0,
    roles: makeRoles(uid),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docToGoal(docRef.id, data);
}

export async function completeGoal(goalId: string): Promise<void> {
  await updateDoc(doc(getDb(), "goals", goalId), {
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getGoalProgress(
  goalId: string
): Promise<{ goalId: string; progress: number; completedTasks: number; totalTasks: number }> {
  const goalDoc = await getDoc(doc(getDb(), "goals", goalId));
  if (!goalDoc.exists()) throw new Error(`Goal ${goalId} not found`);

  const data = goalDoc.data();
  const total = (data.taskCount as number) || 0;
  const completed = (data.completedTaskCount as number) || 0;

  return {
    goalId,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    completedTasks: completed,
    totalTasks: total,
  };
}
