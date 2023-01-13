import tmi from "tmi.js";
import { TWITCH_CHANNELS } from "./config/twitchChannels";
import log from "./log";
import { onChat } from "./twitchChat";
import { onResub, onSub } from "./twitchSubscriptions";
import { validateEnvironmentVariable } from "./utils";

// Variables
let twitchBot: tmi.Client;
const twitchModStatus = new Map<string, boolean>();

export function init(): void {
  validateEnvironmentVariables();

  const twitchAdminUsername = process.env["TWITCH_ADMIN_USERNAME"];
  if (twitchAdminUsername === undefined || twitchAdminUsername === "") {
    throw new Error(
      'The "TWITCH_ADMIN_USERNAME" environment variable is blank. Make sure it is set in the ".env" file.',
    );
  }

  const twitchUsername = process.env["TWITCH_USERNAME"];
  if (twitchUsername === undefined || twitchUsername === "") {
    throw new Error(
      'The "TWITCH_USERNAME" environment variable is blank. Make sure it is set in the ".env" file.',
    );
  }

  const twitchOAuth = process.env["TWITCH_OAUTH"];
  if (twitchOAuth === undefined || twitchOAuth === "") {
    throw new Error(
      'The "TWITCH_OAUTH" environment variable is blank. Make sure it is set in the ".env" file.',
    );
  }

  // Prepare the list of Twitch channels to join.
  const userList = [twitchAdminUsername, ...TWITCH_CHANNELS];
  const formattedTwitchChannels: string[] = [];
  for (const user of userList) {
    const lowercaseUser = user.toLowerCase();

    // Add their Twitch channel to the channel list.
    formattedTwitchChannels.push(`#${lowercaseUser}`);

    // Make an entry for this channel in the "twitchModStatus" map. (Assume that the bot is a mod by
    // default.)
    twitchModStatus.set(lowercaseUser, true);
  }

  // eslint-disable-next-line new-cap
  twitchBot = new tmi.client({
    options: {
      debug: false,
    },
    connection: {
      reconnect: true,
    },
    identity: {
      username: twitchUsername,
      password: twitchOAuth,
    },
    channels: formattedTwitchChannels,
  });

  twitchBot.connect().catch((err) => {
    log.error("Failed to connect to the Twitch server:", err);
    process.exit(1);
  });

  twitchBot.once("connected", () => {
    log.info("Connected to Twitch.");
  });

  twitchBot.on(
    "chat",
    (
      channel: string,
      userstate: tmi.ChatUserstate,
      message: string,
      self: boolean,
    ) => {
      onChat(channel, userstate, message, self, twitchBot);
    },
  );
  twitchBot.on("subscription", onSub);
  twitchBot.on("resub", onResub);
}

function validateEnvironmentVariables() {
  const variablesToValidate = [
    "TWITCH_USERNAME",
    "TWITCH_OAUTH",
    "TWITCH_ADMIN_USERNAME",
  ];

  for (const variable of variablesToValidate) {
    validateEnvironmentVariable(variable);
  }
}

export function send(channel: string, msg: string): void {
  twitchBot.say(channel, msg).catch((err) => {
    log.error("Failed to send a message to Twitch:", err);
  });
}

export function joinChannel(channel: string): void {
  const channelWithHash = `#${channel}`;
  twitchBot.join(channelWithHash).catch((err) => {
    log.error(`Failed to join channel "${channel}":`, err);
  });
}

export function leaveChannel(channel: string): void {
  const channelWithHash = `#${channel}`;
  twitchBot.part(channelWithHash).catch((err) => {
    log.error(`Failed to leave channel "${channel}":`, err);
  });
}
