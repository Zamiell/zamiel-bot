import { Client, GatewayIntentBits } from "discord.js";

export const client = new Client({
  // An intent is needed for each type of data that we need Discord to send to us.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
