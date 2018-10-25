/*
    zamiel-bot - An IRC/Discord bot to faciliate various Isaac things.
*/

// Imports
const tmi = require('tmi.js'); // The Twitch side uses the tmi-js library
const discord = require('discord.js'); // The Discord side uses the discord.js library
const winston = require('winston'); // A logging library

// Import big lists from configuration files
const infoList = require('./config/info');
const userList = require('./config/users');
const characters = require('./config/characters');
const builds = require('./config/builds');

// Import the environment variables defined in the ".env" file
require('dotenv').config();

// Global variables
const twitchModStatus = {};

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
    userList[i].twitch = userList[i].twitch.toLowerCase();

    // Add their Twitch channel to the channel list
    twitchChannels.push('#' + userList[i].twitch);

    // Make an entry for them in the "twitchModStatus" object
    // (assume that they are a mod by default)
    twitchModStatus[userList[i].twitch] = true;
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
    Subroutines
*/

function getRandomNumber(IRC, channel, rawUser, minNumber, maxNumber) {
    // Input validation
    if (minNumber > 1000 || maxNumber > 1000 || minNumber < 0 || maxNumber < 0 || minNumber === maxNumber) {
        const sayString = 'Incorrect roll format.';
        if (IRC === 'SRL') {
            SRLBot.say(channel, sayString);
        } else if (IRC === 'Twitch') {
            TwitchBot.say(channel, sayString);
        } else if (IRC === 'Discord') {
            channel.send(sayString);
        }
        return;
    }

    // Get a random number between minNumber and maxNumber
    const max = parseInt(maxNumber, 10);
    const min = parseInt(minNumber, 10);
    const randomNum = Math.floor(Math.random() * (max - min + 1) + min);

    // Announce it
    const sayString = `Random number from ${minNumber} to ${maxNumber} --> ${randomNum}`;
    if (IRC === 'SRL') {
        SRLBot.say(channel, sayString);
    } else if (IRC === 'Twitch') {
        TwitchBot.say(channel, sayString);
    } else if (IRC === 'Discord') {
        channel.send(sayString);
    }
}

function getRandomBuild(IRC, channel, rawUser) {
    // Get the random number
    const min = 1;
    const max = builds.length - 1;
    const randomNum = Math.floor(Math.random() * (max - min + 1) + min);

    // Announce it
    let sayString = `Random build between ${min} and ${max}:\n`;
    sayString += `#${randomNum} - ${getBuildName(builds[randomNum])}`;
    if (IRC === 'SRL') {
        SRLBot.say(channel, sayString);
    } else if (IRC === 'Twitch') {
        TwitchBot.say(channel, sayString);
    } else if (IRC === 'Discord') {
        channel.send(sayString);
    }
}

function getBuildName(build) {
    let name = '';
    for (const item of build) {
        name += `${item.name} + `;
    }

    // Chop off the trailing " + "
    name = name.substring(0, name.length - 3);

    return name;
}

function getRandomCharacter(IRC, channel, rawUser) {
    // Get the random number
    const min = 1;
    const max = characters.length - 1;
    const randomNum = Math.floor(Math.random() * (max - min + 1) + min);

    // Announce it
    let sayString = `Random character between ${min} and ${max}:\n`;
    sayString += `#${randomNum} - ${characters[randomNum]}`;
    if (IRC === 'SRL') {
        SRLBot.say(channel, sayString);
    } else if (IRC === 'Twitch') {
        TwitchBot.say(channel, sayString);
    } else if (IRC === 'Discord') {
        channel.send(sayString);
    }
}

/*
    Twitch Stuff
*/

TwitchBot.once('connected', () => {
    logger.info('Connected to Twitch.');
});

TwitchBot.on('chat', (channel, rawUser, message, self) => {
    // "rawUser" is an object containing various things
    // See: https://www.tmijs.org/docs/Events.md#chat
    const user = rawUser.username;

    // Update the "twitchModStatus" object with the bot's moderator status for this channel
    twitchModStatus[user] = rawUser.mod;

    // Remove whitespace from both sides of the string
    let msg = message.trim();

    // Log all messages
    logger.info(`TWITCH [${channel}] <${user}> ${msg}`);

    // Do nothing if they have not made the bot a moderator
    if (!rawUser.mod) {
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

    // Check for "info" commands for specific channels
    if (channel === '#zamiell') {
        if (msg === 'os') {
            TwitchBot.say(channel, 'Zamiel is using Windows 7 with Aero disabled because it looks much cleaner (and is faster).');
            return;
        } else if (msg === 'charity') {
            charityReminder(channel);
            return;
        }
    }

    // Check for other commands
    const args = msg.split(/ +/g); // Detect more than one space in between words
    let command = args.shift(); // Now args contains only the actual arguments, if any
    command = command.toLowerCase(); // Convert everything to lowercase for simplicity and to cast a wider net

    if (command === 'baby') {
        // If they did not specify a baby number, just return the link to the baby list
        if (args.length !== 1) {
            TwitchBot.say(channel, infoList.babies);
            return;
        }

        // Find the description that corresponds to this baby number
        // TODO
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
    } else if (command == 'leave') {
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
TwitchBot.on('subscription', newSub);
TwitchBot.on('resub', newSub);

function newSub(channel, username, method, message, userstate) {
    if (channel === '#zamiell') {
        charityReminder(channel);
    }
}

function charityReminder(channel) {
    TwitchBot.say(channel, 'If you are stupid enough to actually waste your money on this channel, it is MANDATORY that you also donate $5 or more to the Against Malaria Foundation. Thanks for your cooperation. https://www.givewell.org/international/top-charities/AMF/donate');
}

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
    let msg = message.content.trim(); // Remove whitespace from both sides of the string

    // Log all messages
    logger.info(`DISCORD [${chan.name}] <${user}> ${msg}`);

    // A "!" at the beginning of the message indicates a command
    if (!msg.startsWith('!')) {
        return;
    }
    msg = msg.substr(1); // Chop off the "!""

    // Check for "info" commands
    for (const info of Object.keys(infoList)) {
        if (msg === info) {
            message.channel.send(infoList[info]);
            return;
        }
    }

    // Check for other commands
    const args = msg.split(/ +/g); // Detect more than one space in between words
    let command = args.shift(); // Now args contains only the actual arguments, if any
    command = command.toLowerCase(); // Convert everything to lowercase for simplicity and to cast a wider net

    // (there are no other commands currently)
});

// Automatically reconnect if the bot disconnects due to inactivity
DiscordBot.on('disconnect', (erMsg, code) => {
    logger.warn(`DISCORD WARNING: Disconnected with code ${code} for reason ${erMsg}. Attempting to reconnect...`);
    DiscordBot.login(process.env.DISCORD_TOKEN);
});
