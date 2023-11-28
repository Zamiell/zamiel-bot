import isaacRacingCommon from "isaac-racing-common";
import { dirName } from "isaacscript-common-node";
import path from "node:path";

const __dirname = dirName();

export const REPO_ROOT = path.join(__dirname, "..");
export const COMMAND_PREFIX_TWITCH = "!";
export const COMMAND_PREFIX_DISCORD = "/";
export const CLIENT_LOBBY_CHANNEL_ID = "286115994621968384";

export const { BUILDS, CHARACTERS } = isaacRacingCommon;
