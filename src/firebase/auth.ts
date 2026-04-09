import { signInWithEmailAndPassword } from "firebase/auth";
import { getAuthInstance } from "./client.js";

export async function ensureAuth(): Promise<string> {
  const auth = getAuthInstance();
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  const email = process.env.GRIPLY_EMAIL;
  const password = process.env.GRIPLY_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "GRIPLY_EMAIL and GRIPLY_PASSWORD environment variables are required"
    );
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
}
