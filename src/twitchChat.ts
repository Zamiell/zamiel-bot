import tmi from "tmi.js";
import { INFO_COMMAND_MAP } from "./config/infoCommands";
import { COMMAND_PREFIX_TWITCH } from "./constants";
import { log } from "./log";
import { joinChannel, leaveChannel, send } from "./twitch";
import { sendCharityMsg } from "./twitchSubscriptions";

interface UserState {
  mod: boolean | undefined;
}

export function onChat(
  channel: string,
  userstate: tmi.ChatUserstate,
  message: string,
  self: boolean,
  client: tmi.Client,
): void {
  if (userstate.username === undefined) {
    return;
  }

  const user = userstate.username.toLowerCase();
  let incomingMessage = message.trim();

  log.info(`TWITCH [${channel}] <${user}> ${incomingMessage}`);

  // Ignore our own messages.
  if (self) {
    return;
  }

  // Do nothing if the bot is not a moderator in this channel. The "userstate" object is
  // automatically updated by the client with our moderator status, badges, and so forth. However,
  // it is not included in the TypeScript definitions for some reason.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const botUserState = client.userstate[channel] as UserState; // eslint-disable-line
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const amMod = botUserState !== undefined && botUserState.mod === true;
  if (!amMod) {
    return;
  }

  if (!incomingMessage.startsWith(COMMAND_PREFIX_TWITCH)) {
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

  if (checkInfoCommand(command, channel)) {
    return;
  }

  if (checkChannelSpecificCommand(command, channel)) {
    return;
  }

  if (checkAdminCommand(command, channel, user, args)) {
    return;
  }

  if (checkCommand(command, channel)) {
    return;
  }

  // This is a normal chat message, so do nothing.
  pass();
}

function checkInfoCommand(command: string, channel: string) {
  const info = INFO_COMMAND_MAP.get(command);
  if (info !== undefined) {
    send(channel, info);
    return true;
  }

  return false;
}

function checkChannelSpecificCommand(command: string, channel: string) {
  if (channel !== "#zamiell") {
    return false;
  }

  switch (command) {
    case "sub": {
      sendCharityMsg(channel);
      return true;
    }

    case "charity": {
      sendCharityMsg(channel);
      return true;
    }

    default: {
      return false;
    }
  }
}

function checkAdminCommand(
  command: string,
  channel: string,
  user: string,
  args: string[],
) {
  const twitchAdminUsername = process.env["TWITCH_ADMIN_USERNAME"];
  if (twitchAdminUsername === undefined || twitchAdminUsername === "") {
    throw new Error(
      'The "TWITCH_ADMIN_USERNAME" environment variable is blank. Make sure it is set in the ".env" file.',
    );
  }

  if (user !== twitchAdminUsername.toLowerCase()) {
    return false;
  }

  switch (command) {
    case "join": {
      if (args.length !== 1) {
        send(channel, "You need to provide the name of the channel to join.");
        return true;
      }

      const channelName = args[0];
      send(channel, `Ok, I'll join channel "${channelName}".`);
      joinChannel(channel);
      return true;
    }

    case "leave": {
      if (args.length !== 1) {
        send(channel, "You need to provide the name of the channel to leave.");
        return true;
      }

      const channelName = args[0];
      send(channel, `Ok, I'll leave channel "${channelName}".`);
      leaveChannel(channel);
      return true;
    }

    default: {
      return false;
    }
  }
}

function checkCommand(command: string, _channel: string) {
  switch (command) {
    default: {
      return false;
    }
  }
}

function pass() {}
