import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig } from "./config.js";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function getApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) auth = getAuth(getApp());
  return auth;
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getApp());
  return db;
}
