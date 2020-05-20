/*
    zamiel-bot - An IRC/Discord bot to faciliate various Isaac things.
    To join a Discord bot to a server, visit the following page:
    https://discordapp.com/developers/applications/me
    Then:
    https://discordapp.com/oauth2/authorize?client_id=CLIENT_ID_GOES_HERE&scope=bot&permissions=0
*/

// Imports
const { exec } = require('child_process'); // For running other various scripts
const tmi = require('tmi.js'); // The Twitch side uses the tmi-js library
const discord = require('discord.js'); // The Discord side uses the discord.js library
const winston = require('winston'); // A logging library

// Import big lists from configuration files
const infoList = require('./config/info');
const userList = require('./config/users');

// Import the environment variables defined in the ".env" file
require('dotenv').config();

// Constants
const botDirectory = '/root/zamiel-bot';
const totalBabies = 541;

// Global variables
const twitchModStatus = new Map();
let deathCount = 0;

// Set up logging
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'ddd MMM DD HH:mm:ss YYYY',
        }),
        winston.format.printf(info => `${info.timestamp} - ${info.level.toUpperCase()} - ${info.message}`),
      ),
    }),
  ],
});

// Prepare the list of Twitch channels to join
userList.push(process.env.TWITCH_ADMIN_USERNAME);
const twitchChannels = [];
for (let i = 0; i < userList.length; i++) {
  // Set their name to be lower case
  userList[i] = userList[i].toLowerCase();

  // Add their Twitch channel to the channel list
  twitchChannels.push(`#${userList[i]}`);

  // Make an entry for them in the "twitchModStatus" map
  // (assume that they are a mod by default)
  twitchModStatus.set(userList[i], true);
}

// Set up the 2 servers
const TwitchBot = new tmi.client({ // eslint-disable-line new-cap
  options: {
    debug: false,
  },
  connection: {
    reconnect: true,
  },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH,
  },
  channels: twitchChannels,
});
const DiscordBot = new discord.Client();

// Welcome message
logger.info('+---------------------+');
logger.info('| ZamielBot starting. |');
logger.info('+---------------------+');

// Start the servers
TwitchBot.connect();
DiscordBot.login(process.env.DISCORD_TOKEN);

/*
    Twitch Stuff
*/

TwitchBot.once('connected', () => {
  logger.info('Connected to Twitch.');
});

// See: https://www.tmijs.org/docs/Events.md#chat
TwitchBot.on('chat', (channel, userstate, message) => {
  // Local variables
  const user = userstate.username.toLowerCase();
  const channelWithoutPrefix = channel.substring(1); // Strip off the # prefix
  const modStatus = userstate.mod || userstate['user-type'] === 'mod';

  // Remove whitespace from both sides of the string
  let msg = message.trim();

  // Log all messages
  logger.info(`TWITCH [${channel}] <${user}> ${msg}`);

  // Ignore our own messages
  if (user === process.env.TWITCH_USERNAME.toLowerCase()) {
    // Update the "twitchModStatus" map with the bot's moderator status for this channel
    twitchModStatus.set(channelWithoutPrefix, modStatus);
    return;
  }

  // Do nothing if the bot is not a moderator in this channel
  if (!twitchModStatus.get(channelWithoutPrefix)) {
    return;
  }

  // A "!" at the beginning of the message indicates a command
  if (!msg.startsWith('!')) {
    return;
  }
  msg = msg.substr(1); // Chop off the "!""

  // Check for "info" commands
  for (const info of Object.keys(infoList)) {
    if (msg === info) {
      TwitchBot.say(channel, infoList[info]);
      return;
    }
  }

  // Check for channel specific commands
  if (channel === '#zamiell') {
    if (msg === 'os') {
      TwitchBot.say(channel, 'Zamiel is using Windows 7 with Aero disabled because it looks much cleaner (and is faster).');
      return;
    } else if (msg === 'charity') {
      TwitchBot.say(channel, 'Subscribing or donating to anyone on Twitch seems stupid when your money could instead go towards saving a life in the 3rd world. Please consider setting up a reoccuring donation to the Against Malaria Foundation: https://www.givewell.org/international/top-charities/AMF/donate');
      return;
    } else if (msg === 'death') {
      if (user === 'zamiell' || modStatus) {
        deathCount += 1;
        TwitchBot.say(channel, `Zamiel has died! Total deaths: ${deathCount}`);
      }
    } else if (msg === 'death-') {
      if (user === 'zamiell' || modStatus) {
        deathCount -= 1;
        TwitchBot.say(channel, `Zamiel has NOT died! Total deaths: ${deathCount}`);
      }
    } else if (msg.startsWith('deathset ')) {
      if (user === 'zamiell' || modStatus) {
        const m = msg.match(/^deathset (\d+)$/);
        if (m) {
          deathCount = m[1];
          TwitchBot.say(channel, `Deaths set to: ${deathCount}`);
        }
      }
    } else if (msg === 'deaths') {
      TwitchBot.say(channel, `Total deaths: ${deathCount}`);
    }
  }

  // Check for other commands
  const args = msg.split(/ +/g); // Detect more than one space in between words
  let command = args.shift(); // Now args contains only the actual arguments, if any
  command = command.toLowerCase();
  // Convert everything to lowercase for simplicity and to cast a wider net

  if (command === 'baby') {
    // Validate the arguments
    // By default, return the link to the baby list
    if (
      args.length !== 1 ||
            isNaN(args[0]) ||
            args[0] < 1 ||
            args[0] > totalBabies
    ) {
      TwitchBot.say(channel, infoList.babies);
      return;
    }

    // Find the description that corresponds to this baby number
    const cmd = `${botDirectory}/get_baby_description.py ${args[0]}`;
    exec(cmd, (err, stdout) => {
      const description = stdout.trim();
      TwitchBot.say(channel, description);
    });
  }

  // Check for admin commands
  const adminUsername = process.env.TWITCH_ADMIN_USERNAME.toLowerCase();
  if (user !== adminUsername) {
    return;
  }
  if (command === 'join') {
    if (args.length !== 1) {
      return;
    }
    const channelName = args[0];
    logger.info(`----- I was told to join Twitch channel ${channelName} -----`);
    TwitchBot.say(channel, `Ok, I'll join channel "${channelName}".`);
    TwitchBot.join(`#${channelName}`);
  } else if (command === 'leave') {
    if (args.length !== 1) {
      return;
    }
    const channelName = args[0];
    logger.info(`----- I was told to leave Twitch channel ${channelName} -----`);
    TwitchBot.say(channel, `Ok, I'll leave channel "${channelName}".`);
    TwitchBot.part(`#${channelName}`);
  }
});

// Subscriber reminders
const newSub = (channel, username, method) => {
  if (channel !== '#zamiell') {
    return;
  }

  if (method.prime) {
    TwitchBot.say(channel, 'I don\'t need the revenue from your Twitch Prime subscription and I won\'t thank you for it; please give it to someone more deserving next time. Furthermore, please consider actually making a difference in the world by donating to the Against Malaria Foundation: https://www.givewell.org/international/top-charities/AMF/donate');
  } else {
    TwitchBot.say(channel, 'Subscribing to anyone on Twitch seems stupid when your money could instead go towards saving a life in the 3rd world, so I will not thank you for your subscription. If you insist on throwing your money away here, it is MANDATORY that you donate to the Against Malaria Foundation: https://www.givewell.org/international/top-charities/AMF/donate');
  }
};
TwitchBot.on('subscription', newSub);
TwitchBot.on('resub', newSub);

/*
    Discord Stuff
*/

DiscordBot.on('ready', () => {
  logger.info('Connected to Discord.');
});

DiscordBot.on('message', (message) => {
  if (message.author.bot) {
    return;
  }

  if (message.channel.type !== 'text') {
    return;
  }

  // Local variables
  const chan = message.channel;
  const user = `${message.author.username}#${message.author.discriminator}`;
  const msg = message.content.trim(); // Remove whitespace from both sides of the string

  // Log all messages
  logger.info(`DISCORD [${chan.name}] <${user}> ${msg}`);

  checkBangCommand(msg, message.channel);
  checkSlashCommand(msg, message.channel);

  // Check for other commands
  // (there are no other commands currently)
  /*
    const args = msg.split(/ +/g); // Detect more than one space in between words
    let command = args.shift(); // Now args contains only the actual arguments, if any
    // Convert everything to lowercase for simplicity and to cast a wider net
    command = command.toLowerCase();
  */
});

const checkBangCommand = (msg, channel) => {
  // A "!" at the beginning of the message indicates a command
  if (!msg.startsWith('!')) {
    return;
  }
  let command = msg.substr(1); // Chop off the "!"
  command = command.toLowerCase();

  // Check for "info" commands
  for (const info of Object.keys(infoList)) {
    if (command === info) {
      channel.send(infoList[info]);
      return;
    }
  }
};

const checkSlashCommand = (msg, channel) => {
  // A "!" at the beginning of the message indicates a command
  if (!msg.startsWith('/')) {
    return;
  }
  const args = msg.split(' ');
  let command = args.shift();
  command = command.substring(1); // Remove the forward slash
  command = command.toLowerCase();

  // Check for modding only commands
  if (
    command === 'tutorial'
      || command === 'lytebringr'
      || command === 'lyte'
      || command === 'beginner'
      || command === 'new'
  ) {
    const tutorial = 'The best way to start learning Isaac modding is to watch Lytebringr\'s YouTube series: '
      + 'https://www.youtube.com/watch?v=e8s_9TrLqUU';
    channel.send(tutorial);
    return;
  }

  if (command === 'docs' || command === 'documentation') {
    channel.send('Please read the Lua documentation: https://moddingofisaac.com/docs/');
    return;
  }

  if (command === 'lmgtfy') {
    // e.g. https://lmgtfy.com/?q=poop+asdf
    const searchString = args.join('+');
    channel.send(`https://lmgtfy.com/?q=${searchString}`);
  }
};

// Automatically reconnect if the bot disconnects due to inactivity
DiscordBot.on('disconnect', (erMsg, code) => {
  logger.warn(`DISCORD WARNING: Disconnected with code ${code} for reason ${erMsg}. Attempting to reconnect...`);
  DiscordBot.login(process.env.DISCORD_TOKEN);
});
