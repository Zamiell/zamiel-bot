import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { REPO_ROOT } from "./constants.js";

const ENV_PATH = path.join(REPO_ROOT, ".env");

if (!fs.existsSync(ENV_PATH)) {
  throw new Error(
    `The "${ENV_PATH}" file does not exist. Copy the ".env.example" file to a ".env" file at the root of the repository.`,
  );
}

dotenv.config({
  path: ENV_PATH,
});

// TODO: https://github.com/t3-oss/t3-env/issues/109
for (const [key, value] of Object.entries(process.env)) {
  if (value === "") {
    delete process.env[key]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
  }
}

export const env = createEnv({
  server: {
    TWITCH_USERNAME: z.string(),
    TWITCH_OAUTH: z.string().startsWith("oauth:"),
    TWITCH_ADMIN_USERNAME: z.string(),
    DISCORD_TOKEN: z.string(),
  },

  runtimeEnv: process.env,
});
