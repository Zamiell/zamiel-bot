import type discord from "discord.js";
import { ChannelType } from "discord.js";
import { ReadonlyMap, getRandomArrayElement } from "isaacscript-common-ts";
import { BUILDS, CHARACTERS, CLIENT_LOBBY_CHANNEL_ID } from "./constants.js";
import { discordSend } from "./discordUtils.js";

export const DISCORD_COMMAND_MAP = new ReadonlyMap<
  string,
  (message: discord.Message) => void
>([
  ["build", buildFunc],
  ["char", characterFunc],
  ["character", characterFunc],
  ["help", helpFunc],
  ["ping", pingFunc],
]);

function buildFunc(message: discord.Message) {
  if (message.channel.type !== ChannelType.GuildText) {
    return;
  }

  const build = getRandomArrayElement(BUILDS);
  discordSend(message.channel, `Random build: ${build.name}`);
}

function characterFunc(message: discord.Message) {
  if (message.channel.type !== ChannelType.GuildText) {
    return;
  }

  const character = getRandomArrayElement(CHARACTERS);
  discordSend(message.channel, `Random character: ${character}`);
}

function helpFunc(message: discord.Message) {
  if (message.channel.type !== ChannelType.GuildText) {
    return;
  }

  let msg = "List of commands:\n";
  msg += "```\n";
  msg += "!char  - Get a random character.\n";
  msg += "!build - Get a random build.\n";
  msg += "```\n";

  discordSend(message.channel, msg);
}

function pingFunc(message: discord.Message) {
  if (message.channel.type !== ChannelType.GuildText) {
    return;
  }

  if (message.channel.id !== CLIENT_LOBBY_CHANNEL_ID) {
    return;
  }

  const msg = `${message.author.username} is looking for others to race. Is anybody interested? @here`;
  discordSend(message.channel, msg);
}
