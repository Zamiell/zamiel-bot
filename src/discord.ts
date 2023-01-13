import discord from "discord.js";
import { INFO_COMMAND_MAP } from "./config/infoCommands";
import { MESSAGE_PREFIX } from "./constants";
import { DISCORD_COMMAND_MAP } from "./discordCommandMap";
import { discordSend } from "./discordUtils";
import log from "./log";
import { validateEnvironmentVariable } from "./utils";

export function init(): void {
  validateEnvironmentVariable("DISCORD_TOKEN");

  const discordBot = new discord.Client();
  login(discordBot);

  discordBot.on("ready", () => {
    log.info("Connected to Discord.");
  });

  // Automatically reconnect if the bot disconnects due to inactivity.
  discordBot.on("disconnect", (erMsg, code) => {
    log.warn(
      `Discord disconnected with code ${code} for reason "${erMsg}". Attempting to reconnect...`,
    );
    login(discordBot);
  });

  discordBot.on("message", onMessage);
}

function login(discordBot: discord.Client) {
  const discordToken = process.env["DISCORD_TOKEN"];
  if (discordToken === undefined || discordToken === "") {
    throw new Error(
      'The "DISCORD_TOKEN" environment variable is blank. Make sure it is set in the ".env" file.',
    );
  }

  discordBot.login(discordToken).catch((err) => {
    log.error("Failed to login to the Discord server:", err);
    process.exit(1);
  });
}

function onMessage(message: discord.Message) {
  if (message.author.bot) {
    return;
  }

  if (message.channel.type !== "text") {
    return;
  }

  const chan = message.channel;
  const user = `${message.author.username}#${message.author.discriminator}`;
  let incomingMessage = message.content.trim();

  log.info(`DISCORD [${chan.name}] <${user}> ${incomingMessage}`);

  if (!incomingMessage.startsWith(MESSAGE_PREFIX)) {
    return;
  }
  incomingMessage = incomingMessage.substr(1); // Chop off the message prefix
  const args = incomingMessage.split(/ +/g); // Detect more than one space in between words
  let command = args.shift(); // Now "args" contains only the actual arguments, if any
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
