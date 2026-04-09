import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    process.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}
