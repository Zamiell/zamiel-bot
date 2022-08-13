import discord from "discord.js";
import { INFO_COMMAND_MAP } from "./config/infoCommands";
import { MESSAGE_PREFIX } from "./constants";
import builds from "./data/builds.json";
import characters from "./data/characters.json";
import log from "./log";
import { getRandomNumber, validateEnvironmentVariable } from "./misc";

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
    send(message.channel, info);
    return;
  }

  // Check for other commands.
  switch (command) {
    case "build": {
      // The builds.json file has an empty array at index 0.
      const buildIndex = getRandomNumber(1, builds.length - 1);

      const build = builds[buildIndex];
      if (build === undefined) {
        send(message.channel, "Failed to get the build. Try again later.");
        return;
      }

      let msg = "";
      for (const item of build) {
        msg += `${item.name}, `;
      }
      msg = msg.slice(0, -2);

      send(message.channel, `Random build: ${msg}`);

      break;
    }

    case "char": {
      const characterIndex = getRandomNumber(0, characters.length - 1);

      const character = characters[characterIndex];
      if (character === undefined) {
        send(message.channel, "Failed to get the character. Try again later.");
        return;
      }

      send(message.channel, `Random character: ${character}`);

      break;
    }

    case "help": {
      let msg = "List of commands:\n";
      msg += "```\n";
      msg += "!char  - Get a random character.\n";
      msg += "!build - Get a random build.\n";
      msg += "```\n";

      send(message.channel, msg);

      break;
    }

    default: {
      break;
    }
  }
}

function send(channel: discord.TextChannel, msg: string) {
  channel.send(msg).catch((err) => {
    log.error("Failed to send a message to Discord:", err);
  });
}
