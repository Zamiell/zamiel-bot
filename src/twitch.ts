import tmi from "tmi.js";
import { TWITCH_CHANNELS } from "./config/twitchChannels.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { onChat } from "./twitchChat.js";
import { onResub, onSub } from "./twitchSubscriptions.js";

// Variables
let twitchBot: tmi.Client;
const twitchModStatus = new Map<string, boolean>();

export function twitchInit(): void {
  // Prepare the list of Twitch channels to join.
  const userList = [env.TWITCH_ADMIN_USERNAME, ...TWITCH_CHANNELS];
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
      username: env.TWITCH_USERNAME,
      password: env.TWITCH_OAUTH,
    },
    channels: formattedTwitchChannels,
  });

  twitchBot.connect().catch((error) => {
    logger.error("Failed to connect to the Twitch server:", error);
    process.exit(1);
  });

  twitchBot.once("connected", () => {
    logger.info("Connected to Twitch.");
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

export function send(channel: string, msg: string): void {
  twitchBot.say(channel, msg).catch((error) => {
    logger.error("Failed to send a message to Twitch:", error);
  });
}

export function joinChannel(channel: string): void {
  const channelWithHash = `#${channel}`;
  twitchBot.join(channelWithHash).catch((error) => {
    logger.error(`Failed to join channel "${channel}":`, error);
  });
}

export function leaveChannel(channel: string): void {
  const channelWithHash = `#${channel}`;
  twitchBot.part(channelWithHash).catch((error) => {
    logger.error(`Failed to leave channel "${channel}":`, error);
  });
}
