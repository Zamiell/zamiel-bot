import { getEnv } from "isaacscript-common-node";
import { z } from "zod";

const envSchema = z.object({
  TWITCH_USERNAME: z.string().min(1),
  TWITCH_OAUTH: z.string().startsWith("oauth:"),
  TWITCH_ADMIN_USERNAME: z.string().min(1),
  DISCORD_TOKEN: z.string().min(1),
});

export const env = getEnv(envSchema);
