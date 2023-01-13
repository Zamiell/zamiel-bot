import * as dotenv from "dotenv";
import path from "path";
import * as discord from "./discord";
import { log } from "./log";
import * as twitch from "./twitch";

main();

function main() {
  welcomeBanner();
  loadEnvironmentVariables();
  twitch.init();
  discord.init();
}

function welcomeBanner() {
  const programName = "zamiel-bot";
  const welcomeText = `${programName} initialized.`;
  const hyphens = "-".repeat(welcomeText.length);
  const welcomeTextBorder = `+-${hyphens}-+`;
  log.info(welcomeTextBorder);
  log.info(`| ${welcomeText} |`);
  log.info(welcomeTextBorder);
}

function loadEnvironmentVariables() {
  const cwd = process.cwd();
  const envFile = path.join(cwd, ".env");
  dotenv.config({ path: envFile });
}
