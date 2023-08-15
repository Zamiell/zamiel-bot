import type { Message } from "discord.js";
import { ChannelType } from "discord.js";
import { addExitHandler } from "shutdown-async";
import { client } from "./client.js";
import { INFO_COMMAND_MAP } from "./config/infoCommands.js";
import { COMMAND_PREFIX_DISCORD } from "./constants.js";
import { DISCORD_COMMAND_MAP } from "./discordCommandMap.js";
import { discordSend } from "./discordUtils.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

export async function discordInit(): Promise<void> {
  client.on("ready", onReady);
  client.on("messageCreate", onMessageCreate);

  addExitHandler(discordShutdown);

  logger.info("Logging in to Discord...");
  await client.login(env.DISCORD_TOKEN);
}

function onReady() {
  if (client.user === null) {
    throw new Error("Failed to connect to Discord.");
  }

  logger.info(
    `Connected to Discord with a username of: ${client.user.username}`,
  );
}

function onMessageCreate(message: Message) {
  logDiscordTextMessage(message);
  parseBotCommandFromMessage(message);
}

function parseBotCommandFromMessage(message: Message) {
  // Ignore anything not in a text channel.
  if (message.channel.type !== ChannelType.GuildText) {
    return;
  }

  // Ignore our own messages.
  if (message.author.id === client.user?.id) {
    return;
  }

  // Ignore other bot messages.
  if (message.author.bot) {
    return;
  }

  // Parse any potential bot commands from the message.
  let incomingMessage = message.content.trim();
  if (!incomingMessage.startsWith(COMMAND_PREFIX_DISCORD)) {
    return;
  }
  incomingMessage = incomingMessage.slice(1); // Chop off the message prefix.
  const args = incomingMessage.split(/ +/g); // Detect more than one space in between words.
  let command = args.shift(); // Now "args" contains only the actual arguments, if any.
  if (command === undefined) {
    return;
  }

  // Convert everything to lowercase for simplicity and to cast a wider net.
  command = command.toLowerCase();

  // Check for "info" commands.
  const info = INFO_COMMAND_MAP.get(command);
  if (info !== undefined) {
    discordSend(message.channel, info);
    return;
  }

  // Check for other commands.
  const commandFunc = DISCORD_COMMAND_MAP.get(command);
  if (commandFunc !== undefined) {
    commandFunc(message);
  }
}

function logDiscordTextMessage(message: Message) {
  const channelName =
    message.channel.type === ChannelType.DM ? "DM" : `#${message.channel.name}`;

  logger.info(
    `[${channelName}] <${message.author.username}#${message.author.discriminator}> ${message.content}`,
  );
}

async function discordShutdown(): Promise<void> {
  await client.destroy();
}
