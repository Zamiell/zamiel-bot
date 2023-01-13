import discord from "discord.js";
import { log } from "./log";

export function discordSend(channel: discord.TextChannel, msg: string): void {
  channel.send(msg).catch((err) => {
    log.error("Failed to send a message to Discord:", err);
  });
}
