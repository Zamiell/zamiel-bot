import type discord from "discord.js";
import { logger } from "./logger.js";

export function discordSend(channel: discord.TextChannel, msg: string): void {
  channel.send(msg).catch((error) => {
    logger.error("Failed to send a message to Discord:", error);
  });
}
