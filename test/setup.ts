import { readFileSync } from "fs";
import { resolve } from "path";

export function loadEnvFile(filePath: string) {
  for (const line of readFileSync(filePath, "utf-8").split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      if (!process.env[key]) {
        process.env[key] = line.slice(idx + 1).trim();
      }
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
