import { collection, where, type QueryConstraint } from "firebase/firestore";
import { getDb } from "../firebase/client.js";

export const TASK_TYPE = { TODO: "todo", HABIT: "habit", REPEATING: "repeating" } as const;

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

export function makeRoles(uid: string): { owner: string; all: string[] } {
  return { owner: uid, all: [uid] };
}
