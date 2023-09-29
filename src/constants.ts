import isaacRacingCommon from "isaac-racing-common";
import path from "node:path";
import url from "node:url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const REPO_ROOT = path.join(__dirname, "..");
export const COMMAND_PREFIX_TWITCH = "!";
export const COMMAND_PREFIX_DISCORD = "/";
export const CLIENT_LOBBY_CHANNEL_ID = "286115994621968384";

export const { BUILDS, CHARACTERS } = isaacRacingCommon;
