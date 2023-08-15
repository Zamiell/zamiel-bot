import type tmi from "tmi.js";
import { send } from "./twitch.js";

const CHARITY_MSG =
  "Subscribing to someone on Twitch is silly when your money could instead go towards saving a life in the 3rd world. If you are subbing to me, it is MANDATORY that you donate to the Against Malaria Foundation: https://www.givewell.org/international/top-charities/AMF/donate";

export function onSub(
  channel: string,
  _username: string,
  methods: tmi.SubMethods,
  _message: string,
  _userstate: tmi.SubUserstate,
): void {
  checkZamielSub(channel, methods);
}

export function onResub(
  channel: string,
  _username: string,
  _months: number,
  _message: string,
  _userstate: tmi.SubUserstate,
  methods: tmi.SubMethods,
): void {
  checkZamielSub(channel, methods);
}

function checkZamielSub(channel: string, methods: tmi.SubMethods) {
  if (channel === "#zamiell" && methods.prime !== true) {
    sendCharityMsg(channel);
  }
}

export function sendCharityMsg(channel: string): void {
  send(channel, CHARITY_MSG);
}
