import { discordInit } from "./discord.js";
import { logger } from "./logger.js";
import { twitchInit } from "./twitch.js";

await main();

async function main() {
  welcomeBanner();
  twitchInit();
  await discordInit();
}

function welcomeBanner() {
  const programName = "zamiel-bot";
  const welcomeText = `${programName} initialized.`;
  const hyphens = "-".repeat(welcomeText.length);
  const welcomeTextBorder = `+-${hyphens}-+`;
  logger.info(welcomeTextBorder);
  logger.info(`| ${welcomeText} |`);
  logger.info(welcomeTextBorder);
}
