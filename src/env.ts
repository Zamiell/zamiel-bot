import dotenv from "dotenv";
import { fatalError, isFile } from "isaacscript-common-node";
import path from "node:path";
import { z } from "zod";
import { REPO_ROOT } from "./constants.js";

const ENV_PATH = path.join(REPO_ROOT, ".env");

if (!isFile(ENV_PATH)) {
  fatalError(
    `The "${ENV_PATH}" file does not exist. Copy the ".env.example" file to a ".env" file at the root of the repository and re-run this program.`,
  );
}

dotenv.config({
  path: ENV_PATH,
});

const envSchema = z.object({
  TWITCH_USERNAME: z.string().min(1),
  TWITCH_OAUTH: z.string().startsWith("oauth:"),
  TWITCH_ADMIN_USERNAME: z.string().min(1),
  DISCORD_TOKEN: z.string().min(1),
});

export const env = envSchema.parse(process.env);
