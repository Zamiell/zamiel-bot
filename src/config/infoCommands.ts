import { ReadonlyMap } from "isaacscript-common-ts";

const tournaments =
  "List/schedule of Isaac tournaments and events: http://pastebin.com/q9Y3MRdT";
const itemTracker =
  "Rebirth Item Tracker download + info: https://github.com/Hyphen-ated/RebirthItemTracker/releases";
const saveFile =
  "Fully unlocked Repentance save download: https://www.speedrun.com/repentance/resources";
const platinumGod =
  "Platinum God explains every item in the game: http://platinumgod.co.uk/";
const itemStarts = "Item starts for racing: http://pastebin.com/mCmrYP8Q";

export const INFO_COMMAND_MAP = new ReadonlyMap([
  ["tournament", tournaments],
  ["tournaments", tournaments],
  ["tracker", itemTracker],
  ["itemtracker", itemTracker],
  ["save", saveFile],
  ["savefile", saveFile],
  ["items", platinumGod],
  ["plat", platinumGod],
  ["platgod", platinumGod],
  ["platinumgod", platinumGod],
  ["start", itemStarts],
  ["starts", itemStarts],
  ["itemstarts", itemStarts],
  [
    "discord",
    "Join the Isaac racing & speedrunning Discord server: https://discord.gg/JzbhWQb",
  ],
  [
    "babies",
    "The Babies Mod info & list: https://bindingofisaacrebirth.gamepedia.com/index.php?title=User:Zamie/Co-op&profile=no",
  ],
  [
    "s1",
    "Season 1 info: https://github.com/Zamiell/racing-plus/blob/main/docs/challenges.md#r7-season-1-normal-vs-tainted",
  ],
  [
    "s2",
    "Season 2 info: https://github.com/Zamiell/racing-plus/blob/main/docs/challenges.md#r7-season-2-instant-start",
  ],
  [
    "s3",
    "Season 3 info: https://github.com/Zamiell/racing-plus/blob/main/docs/challenges.md#r7-season-3-diversity",
  ],
  [
    "s4",
    "Season 4 info: https://github.com/Zamiell/racing-plus/blob/main/docs/challenges.md#r7-season-4-storage",
  ],
  [
    "randomizer",
    "Achievement Randomizer info: https://github.com/Zamiell/isaac-achievement-randomizer/blob/main/docs/about.md",
  ],
]);
