import discord from "discord.js";
import { CLIENT_LOBBY_CHANNEL_ID } from "./constants";
import builds from "./data/builds.json";
import characters from "./data/characters.json";
import { discordSend } from "./discordUtils";
import { getRandomNumber } from "./utils";

export const DISCORD_COMMAND_MAP = new Map<
  string,
  (message: discord.Message) => void
>();

DISCORD_COMMAND_MAP.set("build", (message: discord.Message) => {
  if (message.channel.type !== "text") {
    return;
  }

  // The builds.json file has an empty array at index 0.
  const buildIndex = getRandomNumber(1, builds.length - 1);

  const build = builds[buildIndex];
  if (build === undefined) {
    discordSend(message.channel, "Failed to get the build. Try again later.");
    return;
  }

  let msg = "";
  for (const item of build) {
    msg += `${item.name}, `;
  }
  msg = msg.slice(0, -2);

  discordSend(message.channel, `Random build: ${msg}`);
});

DISCORD_COMMAND_MAP.set("char", characterFunc);
DISCORD_COMMAND_MAP.set("character", characterFunc);

function characterFunc(message: discord.Message) {
  if (message.channel.type !== "text") {
    return;
  }

  const characterIndex = getRandomNumber(0, characters.length - 1);

  const character = characters[characterIndex];
  if (character === undefined) {
    discordSend(
      message.channel,
      "Failed to get the character. Try again later.",
    );
    return;
  }

  discordSend(message.channel, `Random character: ${character}`);
}

DISCORD_COMMAND_MAP.set("help", (message: discord.Message) => {
  if (message.channel.type !== "text") {
    return;
  }

  let msg = "List of commands:\n";
  msg += "```\n";
  msg += "!char  - Get a random character.\n";
  msg += "!build - Get a random build.\n";
  msg += "```\n";

  discordSend(message.channel, msg);
});

DISCORD_COMMAND_MAP.set("ping", (message: discord.Message) => {
  if (message.channel.type !== "text") {
    return;
  }

  if (message.channel.id !== CLIENT_LOBBY_CHANNEL_ID) {
    return;
  }

  const msg = `${message.author.username} is looking for others to race. Is anybody interested? @here`;
  discordSend(message.channel, msg);
});
