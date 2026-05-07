import { secrets } from "bun";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getAuthInstance } from "./client.js";

const GRIPLY_SECRETS_SERVICE = "griply-mcp";
const GRIPLY_EMAIL_SECRET = "GRIPLY_EMAIL";
const GRIPLY_PASSWORD_SECRET = "GRIPLY_PASSWORD";

type SecretGetter = (service: string, name: string) => Promise<string | null>;

type GriplyCredentials = {
  email: string;
  password: string;
};

async function getBunSecret(service: string, name: string): Promise<string | null> {
  // Treat platform errors (e.g. libsecret missing on Linux) as "not present" so the
  // env-var fallback in resolveGriplyCredentials still runs. Without this, Bun.secrets
  // throws ERR_SECRETS_PLATFORM_ERROR before the fallback is reached.
  try {
    return await secrets.get({ service, name });
  } catch {
    return null;
  }
}

export async function resolveGriplyCredentials(
  getSecret: SecretGetter = getBunSecret
): Promise<GriplyCredentials> {
  const [secretEmail, secretPassword] = await Promise.all([
    getSecret(GRIPLY_SECRETS_SERVICE, GRIPLY_EMAIL_SECRET),
    getSecret(GRIPLY_SECRETS_SERVICE, GRIPLY_PASSWORD_SECRET),
  ]);

  const email = secretEmail || process.env.GRIPLY_EMAIL;
  const password = secretPassword || process.env.GRIPLY_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Griply auth credentials are required in Bun secrets (service griply-mcp, names GRIPLY_EMAIL and GRIPLY_PASSWORD) or GRIPLY_EMAIL and GRIPLY_PASSWORD environment variables"
    );
  }

  return { email, password };
}

export async function ensureAuth(): Promise<string> {
  const auth = getAuthInstance();
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  const { email, password } = await resolveGriplyCredentials();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
}
