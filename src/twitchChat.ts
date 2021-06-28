import tmi from "tmi.js";
import { INFO_COMMAND_MAP } from "./config/infoCommands";
import { MESSAGE_PREFIX } from "./constants";
import log from "./log";
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

  // Ignore our own messages
  if (self) {
    return;
  }

  // Do nothing if the bot is not a moderator in this channel
  // The "userstate" object is automatically updated by the client with our moderator status,
  // badges, and so forth
  // However, it is not included in the TypeScript definitions for some reason
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const botUserState = client.userstate[channel] as UserState; // eslint-disable-line
  if (botUserState === undefined) {
    return;
  }
  const amMod = botUserState.mod === true;
  if (!amMod) {
    return;
  }

  if (!incomingMessage.startsWith(MESSAGE_PREFIX)) {
    return;
  }
  incomingMessage = incomingMessage.substr(1); // Chop off the message prefix
  const args = incomingMessage.split(/ +/g); // Detect more than one space in between words
  let command = args.shift(); // Now "args" contains only the actual arguments, if any
  if (command === undefined) {
    return;
  }

  // Convert everything to lowercase for simplicity and to cast a wider net
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

  // This is a normal chat message, so do nothing
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
    case "charity": {
      send(
        channel,
        "Subscribing or donating to anyone on Twitch seems stupid when your money could instead go towards saving a life in the 3rd world. Please consider setting up a recurring donation to the Against Malaria Foundation: https://www.givewell.org/international/top-charities/AMF/donate",
      );
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
  const adminUsername = (
    process.env.TWITCH_ADMIN_USERNAME as string
  ).toLowerCase();
  if (user !== adminUsername) {
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

function checkCommand(command: string, channel: string) {
  switch (command) {
    case "s1": {
      send(channel, "Coming soon!");
      return true;
    }

    case "sub": {
      sendCharityMsg(channel);
      return true;
    }

    default: {
      return false;
    }
  }
}

function pass() {}
