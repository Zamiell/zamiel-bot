/*
    zamiel-bot - An IRC/Discord bot to faciliate various Isaac things.
*/

// Imports
const irc     = require('irc');                // The SRL side uses the node-irc library
const tmi     = require('tmi.js');             // The Twitch side uses the tmi-js library
const discord = require('discord.io');         // The Discord side uses the discord.io library
const fs      = require('fs');                 // For getting passwords
const exec    = require('child_process').exec; // For running other various scripts
const async   = require('async');              // For performing API calls asynchronously
const request = require('request');            // For talking to the SRL API
const mongodb = require('mongodb');            // For talking to the MongoDB database

// Configuration
const botDirectory          = '/root/zamiel-bot';
const numInstantStartBuilds = 31;
const numAverageRacesToUse  = 50;
const numRacesToAdvert      = 999999;
const advertMessage         = 'Sign up for Isaac events. See the list/schedule here: http://pastebin.com/q9Y3MRdT';
const goalSetDelay          = 2000; // 2 seconds

// Import big lists from configuration files
const configGoals = require(botDirectory + '/config/goals');
const goalList = goalsConfig.goalList;
const configInfo = require(botDirectory + '/config/info');
const infoList = infoConfig.infoList;
const configUsers = require(botDirectory + '/config/users');
const userList = usersConfig.userList;

// Set up the 3 servers
const SRLBot = new irc.Client('irc.speedrunslive.com', 'ZamielBot', {
    debug: true,
    showErrors: true,
    channels: ['#speedrunslive', '#lemonparty', '#isaac'],
    //channels: ['#speedrunslive', '#lemonparty'], // Uncomment this when debugging because Hyphen gets pissy
    autoConnect: false,
});
const TwitchOAuth = fs.readFileSync(botDirectory + '/passwords/Twitch.txt', 'utf8').trim();
const TwitchBot = new tmi.client({
    options: {
        debug: true,
    },
    connection: {
        reconnect: true,
    },
    identity: {
        username: 'ZamielBot',
        password: TwitchOAuth,
    },
    channels: ['#battle_of_kings'],
});
const DiscordOAuth = fs.readFileSync(botDirectory + '/passwords/Discord.txt', 'utf8').trim();
const DiscordBot = new discord.Client({
    token: DiscordOAuth,
    autorun: false,
});
const DiscordServerID = '83214009964171264'; // This is the ID of the "Isaac Speedrunning & Racing" server
const DiscordRacingChatID = '188083642948386816'; // This is room ID for the "currently-racing" chat room

// Global constants
const PastebinDevKey = fs.readFileSync(botDirectory + '/passwords/Pastebin-Dev.txt', 'utf8').trim();
const PastebinUserKey = fs.readFileSync(botDirectory + '/passwords/Pastebin-User.txt', 'utf8').trim();
const characterArray = [
    'Isaac',     // 0
    'Magdalene', // 1
    'Cain',      // 2
    'Judas',     // 3
    'Blue Baby', // 4
    'Eve',       // 5
    'Samson',    // 6
    'Azazel',    // 7
    'Lazarus',   // 8
    'Eden',      // 9
    'The Lost',  // 10
    'Lilith',    // 11
    'Keeper',    // 12
];
const instantStartArray = [
    'NULL',               // 0
    '20/20',              // 1
    'Chocolate Milk',     // 2
    'Cricket\'s Body',    // 3
    'Cricket\'s Head',    // 4
    'Deadeye',            // 5
    'Death\'s Touch',     // 6
    'Dr. Fetus',          // 7
    'Epic Fetus',         // 8
    'Ipecac',             // 9
    'Judas\' Shadow',     // 10
    'Lil\' Brimstone',    // 11
    'Magic Mushroom',     // 12
    'Mom\'s Knife',       // 13
    'Monstro\'s Lung',    // 14
    'Polyphemus',         // 15
    'Proptosis',          // 16
    'Sacrificial Dagger', // 17
    'Tech.5',             // 18
    'Tech X',             // 19
    'Brimstone',          // 20
    'Incubus',            // 21
    'Maw of the Void',    // 22
    'Crown of Light',     // 23
    'Godhead',            // 24
    'Sacred Heart',       // 25
    'Mutant Spider + The Inner Eye',         // 26
    'Technology + A Lump of Coal',           // 27
    'The Ludovico Technique + The Parasite', // 28
    'Fire Mind + Lucky Foot x13',            // 29
    'Kamikaze! + Host Hat',                  // 30
    'Mega Blast + Habit + The Battery',      // 31
];

// Global variables
var raceList = {};
var channelsToJoin = [];
var SRLTimeoutTimer;
var TwitchTimeoutTimer;
var DiscordRaceTimer = 0;
var identified = false;
var advertCounter = 0;
var instantStartRandomArray = [];
var characterRandomArray = [];
var ignoreList = [];
var raceStarter;

// Initialize the user list
for (let i = 0; i < userList.length; i++) { // Go through the user list
    // Set their name to be lower case
    userList[i].srl = userList[i].srl.toLowerCase();
    userList[i].twitch = userList[i].twitch.toLowerCase();

    // Default "echoComments" to true
    if (!('echoComments' in userList[i])) {
        userList[i].echoComments = true;
    }

    // Default "delayTwitchOutput" to 0
    if (!('delayTwitchOutput' in userList[i])) {
        userList[i].delayTwitchOutput = 0;
    }
}

// Initialize the random arrays
refillInstantStartRandomArray();
refillCharacterRandomArray();

// Start the servers
let datetime = new Date();
console.log('----- STARTING ZAMIELBOT @ ' + datetime + ' for ' + userList.length + ' users! -----');
SRLBot.connect();
TwitchBot.connect();
DiscordBot.connect();

/*
 *
 * Subroutines
 *
 */

function addRace(channel) {
    console.log('----- Adding race ' + channel + ' -----');
    let datetime = new Date();
    raceList[channel] = {
        entrants: [],
        entrantsLeft: [],
        commentedList: [],
        goal: '',
        status: 0, // 0 is "Entry Open", 1 is "In Progress", 2 is "Complete"
        timeStarted: datetime,
    };
}

function addRematch(channel) {
    // This is the same thing as the addRace function but it does not reset the goal
    console.log('----- Rematch detected for race ' + channel + ' -----');
    let datetime = new Date();
    raceList[channel].entrants = [];
    raceList[channel].entrantsLeft = [];
    raceList[channel].commentedList = [];
    raceList[channel].status = 0; // 0 is "Entry Open", 1 is "In Progress", 2 is "Complete"
    raceList[channel].timeStarted = datetime;
}

function deleteRace(channel) {
    console.log('----- Deleted race ' + channel + ' -----');
    delete raceList[channel];
}

function joinRace(raceChannelName) {
    if (identified) {
        channelsToJoin.push(raceChannelName);
        addRace(raceChannelName);
        SRLBot.join(raceChannelName);
    } else {
        warning('SRL WARNING: I need to join ' + raceChannelName + ' but I haven\'t identified yet. Trying again in 1 second...');
        setTimeout(joinRace, 1000, raceChannelName); // 1 second
    }
}

function checkSRLBroken(currentTime) {
    if (currentTime === SRLTimeoutTimer) {
        error('SRL ERROR: Timeout detected. Exiting...');
        process.exit(1);
    }
}

function checkTwitchBroken(currentTime) {
    if (currentTime === TwitchTimeoutTimer) {
        error('TWITCH ERROR: Timeout detected. Exiting...');
        process.exit(1);
    }
}

function getPeopleLeft(channel) {
    // Validate channel exists
    if (typeof raceList[channel] === 'undefined') {
        error('ERROR: I tried to build the getPeopleLeft string, but the ' + channel + ' race doesn\'t exist in the raceList.');
        debug();
        return '';
    }

    // Build the people left string
    let string = '- ';
    if (raceList[channel].entrantsLeft.length === 0) {
        if (raceList[channel].entrants.length === 0) {
            string += 'The race hasn\'t started yet, silly.';
        } else {
            string += 'The race has completed!';
        }
    } else if (raceList[channel].entrantsLeft.length === 1) {
        string += 'There is 1 person left. (' + raceList[channel].entrantsLeft[0] + ')';
    } else {
        string += 'There are ' + raceList[channel].entrantsLeft.length + ' people left. (';
        for (let i = 0; i < raceList[channel].entrantsLeft.length; i++) {
            string += raceList[channel].entrantsLeft[i] + ', ';
        }
        string = string.substring(0, string.length - 2) + ')';
    }
    return string;
}

function getEntrants(channel) {
    // Validate channel exists
    if (typeof raceList[channel] === 'undefined') {
        error('ERROR: I tried to build the getEntrants string, but the ' + channel + ' race doesn\'t exist in the raceList.');
        debug();
        return '';
    }

    // Build the entrants string
    let string = '- There are ' + raceList[channel].entrants.length + ' people in this race. (';
    for (let i = 0; i < raceList[channel].entrants.length; i++) {
        string += raceList[channel].entrants[i] + ', ';
    }
    string = string.substring(0, string.length - 2) + ')';
    return string;
}

function error(message) {
    let datetime = new Date();
    message = datetime + ' - ' + message;
    console.error(message);
    console.log(message);
}

function warning(message) {
    let datetime = new Date();
    message = datetime + ' - ' + message;
    console.log(message);
}

function debug() {
    console.log('##### RACE LIST #####');
    console.log(raceList);
    console.log('##### CHANNELSTOJOIN LIST #####');
    console.log(channelsToJoin);
    //console.log('##### DISCORD DEBUG ####');
    //console.log(DiscordBot.servers[DiscordServerID].channels[DiscordRacingChatID].name);
    //DiscordBot.sendMessage({ to: DiscordRacingChatID, message: 'test' });
}

function sendTwitch(type, channel, message) {
    console.log('----- Sending ' + type + ' notification to ' + channel + ': ' + message + ' -----');
    TwitchBot.action(channel, message);
}

function postPastebin(pasteName, pasteString) {
    return new Promise(function(resolve, reject) {
        request({
            url: 'http://pastebin.com/api/api_post.php',
            method: 'POST',
            timeout: 2500,
            form: {
                api_option: 'paste',
                api_dev_key: PastebinDevKey,
                api_user_key: PastebinUserKey,
                api_paste_name: pasteName,
                api_paste_code: pasteString,
                api_paste_expire_date: '1D',
            },
        }, function (err, response, body) {
            if (!err && response.statusCode === 200) {
                resolve(body);
            } else {
                warning('WARNING: Failed to POST to Pastebin: ' + err);
                return reject(err);
            }
        });
    });
}

function getFormattedDate(epoch) {
    let d = new Date(0);
    d.setUTCSeconds(epoch);
    let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let day = days[d.getDay()] + ',';
    let date = months[d.getMonth()] + ' ' + getOrdinal(d.getDate()) + ', ' + d.getFullYear();
    let time = '';
    if (d.getHours() < 10) {
        time += '0';
    }
    time += d.getHours() + ':';
    if (d.getMinutes() < 10) {
        time += '0';
    }
    time += d.getMinutes() + ' ';
    if (d.getTimezoneOffset() / 60 === 4) {
        time += '(EDT)';
    } else {
        time += '(EST)';
    }
    return date + ' @ ' + time;
}

function getAverageTimes(IRC, channel, player, requester, listAll = false) {
    // Remove whitespace from both sides of the string
    player = player.trim();

    // If the user is requesting a player's Twitch name instead of their SRL name, maybe we can fix the mistake automatically
    for (let i = 0; i < userList.length; i++) { // Go through the player list
        if (userList[i].twitch === player.toLowerCase()) {
            player = userList[i].srl;
            break;
        }
    }

    // Get this player's past races from the database
    try {
        mongodb.MongoClient.connect('mongodb://localhost:27017/isaac', function (err, db) {
            if (err) {
                error('ERROR - Unable to connect to the MongoDB server: ' + err);
                throw 'Unable to connect to the MongoDB server.';
            }

            // Create a regular expression to be used in the next step
            function regexEscape(str) {
                return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            }
            let re = new RegExp('^' + regexEscape(player) + '$', 'i'); // Match the player exactly, but case insensitive

            // Initialize variables
            let numRaces = 0;
            let  numForfeits = 0;
            let sumTimes = 0;
            let racesString = 'The Binding of Isaac: Afterbirth\n';
            racesString += 'List of Jud6s Races for ' + player + '\n';
            racesString += new Date() + '\n';
            racesString += '(requested by ' + requester + ')\n\n';

            // Get the races collection
            let collection = db.collection('races');
            let options;
            if (listAll === true) {
                options = {
                    sort: [['id','desc']], // Get every race that they have ever done, with the most recent being at the top
                };
            } else {
                options = {
                    sort: [['id','desc']], // We want the most recent races first
                    limit: numAverageRacesToUse, // We only want to use the past X races for the purposes of calculating an average
                };
            }
            let stream = collection.find({
                results: { $elemMatch: { player: re } },
                goal: /Beat The Chest with Judas \(Jud6s Mod v1\.\d+, \&quot;BLCK CNDL\&quot; easter egg\)/
            }, options).stream();

            // For each race
            stream.on('data', function(race) {
                // Start to build the races string (which will only be used if this is a "!raceList" command)
                numRaces++;
                if (numRaces < 1000) {
                    racesString += ' ';
                }
                if (numRaces < 100) {
                    racesString += ' ';
                }
                if (numRaces < 10) {
                    racesString += ' ';
                }
                racesString += numRaces + ')';

                // Add the date/time that the race happened
                let date = getFormattedDate(race.date);
                let spacing = 34 - date.length; // Pad with spaces so that it is properly aligned
                for (let i = 0; i < spacing; i++) {
                    racesString += ' ';
                }
                racesString += date + '     ';

                // Find their time (and comment)
                let foundPlayer = false;
                let raceTime;
                let comment;
                for (let i = 0; i < race.results.length; i++) {
                    if (race.results[i].player.toLowerCase() === player.toLowerCase()) {
                        raceTime = race.results[i].time;
                        comment = race.results[i].message;
                        foundPlayer = true;
                        break;
                    }
                }
                if (foundPlayer === false) {
                    error('ERROR: When going through the database, I was not able to find player ' + player + ' in race ' + i + '.');
                    throw 'Player ' + player + ' not found in race ' + i + '.';
                }

                // Add the time to the string
                if (raceTime < 1) {
                    numForfeits++; // They forfeited this race
                    racesString += 'Forfeit';
                } else {
                    let minutes = Math.floor(raceTime / 60);
                    let seconds = raceTime % 60;
                    if (seconds < 10) {
                        seconds = '0' + seconds;
                    }
                    sumTimes += raceTime; // They finished this race
                    racesString += ' ' + minutes + ':' + seconds + ' ';
                }

                // Add the message to the string, if there is one
                if (comment !== '') {
                    racesString += '     ' + comment;
                }
                racesString += '\n';
            });

            // We have now gone through all the races
            stream.on('end', async function() { // jshint ignore:line
                // Close connection
                db.close();

                // Check to see if they have any races
                if (numRaces === 0) {
                    let sayString = player + ' has 0 Jud6s races played.';
                    if (IRC === 'SRL') {
                        SRLBot.say(channel, sayString);
                    } else if (IRC === 'Twitch') {
                        TwitchBot.say(channel, sayString);
                    } else if (IRC === 'Discord') {
                        DiscordBot.sendMessage({ to: channel, message: sayString });
                    }
                    return;
                }

                // If we are returning all races, instead of just the average
                if (listAll === true) {
                    // Post it to Pastebin
                    let response = await postPastebin('Race Listing', racesString); // jshint ignore:line
                    let sayString = 'List of ' + player + '\'s Jud6s races: ' + response;
                    if (IRC === 'SRL') {
                        SRLBot.say(channel, sayString);
                    } else if (IRC === 'Twitch') {
                        TwitchBot.say(channel, sayString);
                    } else if (IRC === 'Discord') {
                        DiscordBot.sendMessage({ to: channel, message: sayString });
                    }
                    return;
                }

                // Check to see if they forfeited every race
                if (numRaces === numForfeits) {
                    let sayString = player + ' has forfeited every race that they have entered, so how can I calculate the average time?';
                    if (IRC === 'SRL') {
                        SRLBot.say(channel, sayString);
                    } else if (IRC === 'Twitch') {
                        TwitchBot.say(channel, sayString);
                    } else if (IRC === 'Discord') {
                        DiscordBot.sendMessage({ to: channel, message: sayString });
                    }
                    return;

                }

                // Calculate and format the average time
                let averageTime = sumTimes / (numRaces - numForfeits);
                let averageMinutes = Math.floor(averageTime / 60);
                let averageSeconds = Math.floor(averageTime % 60);
                if (averageSeconds < 10) {
                    averageSeconds = '0' + averageSeconds;
                }

                // Return the average time and the number of forfeits
                let sayString = 'Average time from ' + player + '\'s last ' + numRaces + ' races: ' + averageMinutes + ':' + averageSeconds + ' (' + numForfeits + ' forfeits)';
                if (IRC === 'SRL') {
                    SRLBot.say(channel, sayString);
                } else if (IRC === 'Twitch') {
                    TwitchBot.say(channel, sayString);
                } else if (IRC === 'Discord') {
                    DiscordBot.sendMessage({ to: channel, message: sayString });
                }
            }); // jshint ignore:line
        });
    } catch(err) {
        console.log('----- getAverageTimes function failed with error: ' + err + ' -----');
        sayString = 'Something went wrong when getting the race listing for ' + player + '.';
        if (IRC === 'SRL') {
            SRLBot.say(channel, sayString);
        } else if (IRC === 'Twitch') {
            TwitchBot.say(channel, sayString);
        } else if (IRC === 'Discord') {
            DiscordBot.sendMessage({ to: channel, message: sayString });
        }
    }
}

function getLeaderboard(IRC, channel, requester) {
    try {
        // Get all the Jud6s races from the database
        mongodb.MongoClient.connect('mongodb://localhost:27017/isaac', function (err, db) {
            if (err) {
                error('ERROR - Unable to connect to the MongoDB server: ' + err);
                throw 'Unable to connect to the MongoDB server.';
            }

            // Initialize variables
            let leaderboard = {};
            let topTenTimes = [];

            // Get the races collection
            let collection = db.collection('races');
            let stream = collection.find({
                goal: /Beat The Chest with Judas \(Jud6s Mod v1\.\d+, \&quot;BLCK CNDL\&quot; easter egg\)/
            }, {
                sort: [['id','desc']],
            }).stream();

            // For each race
            stream.on('data', function(race) {
                // Go through the results
                for (let i = 0; i < race.results.length; i++) {
                    let player = race.results[i].player.toLowerCase();
                    let raceTime = race.results[i].time;
                    let version = race.goal.match(/Beat The Chest with Judas \(Jud6s Mod (v1\.\d+),/)[1];
                    let date = race.date;

                    // If the time is worthy of being in the top ten times, add it
                    if (raceTime !== -1 && raceTime !== -2) {
                        if (topTenTimes.length < 10) {
                            topTenTimes.push({
                                player: player,
                                raceTime: raceTime,
                                version: version,
                                date: date,
                            });

                            // Sort the top ten times by race time
                            topTenTimes = topTenTimes.sort(function(a, b) {
                                return a.raceTime - b.raceTime;
                            });
                        } else {
                            // The last element will be the worst time, so replace it if necessary
                            if (topTenTimes[9].raceTime > raceTime) {
                                topTenTimes.pop(); // Remove the worst time
                                topTenTimes.push({
                                    player: player,
                                    raceTime: raceTime,
                                    version: version,
                                    date: date,
                                });

                                // Sort the top ten times by race time
                                topTenTimes = topTenTimes.sort(function(a, b) {
                                    return a.raceTime - b.raceTime;
                                });
                            }
                        }
                    }

                    // This is the first time we have come across this player, so make an entry for them in the leaderboard
                    if (typeof leaderboard[player] === 'undefined') {
                        leaderboard[player] = {
                                numRaces: 0,
                                numForfeits: 0,
                                totalTime: 0,
                                allRacesCount: 0,
                        };
                    }

                    // Increment the count of their total races
                    leaderboard[player].allRacesCount++;

                    // Move to the next race if we have already hit the limit of the races to use
                    if (leaderboard[player].numRaces === numAverageRacesToUse) {
                        continue;
                    }

                    // Increment their stats
                    leaderboard[player].numRaces++;
                    if (raceTime === -1 || raceTime === -2) { // They quit or were disqualified
                        leaderboard[player].numForfeits++;
                    } else { // They finished the race
                        leaderboard[player].totalTime += raceTime;
                    }
                }
            });

            // We have now gone through all the races
            stream.on('end', async function() { // jshint ignore:line
                // Close connection
                db.close();

                // Calculate everyone's average
                let leaderboardArray = []; // We have to make an array so that we can sort it later
                for (let player in leaderboard) {
                    // If they have under 20 races played, skip to the next player
                    if (leaderboard[player].numRaces < 20) {
                        continue;
                    }

                    // If they forfeited every race, then we will have a divide by 0 later on
                    if (leaderboard[player].numRaces === leaderboard[player].numForfeits) {
                        leaderboardArray.push({
                            player:          player,
                            averageTime:     1000000, // Arbitrarily set it to a million seconds
                            numRaces:        leaderboard[player].numRaces,
                            numForfeits:     leaderboard[player].numForfeits,
                            forfeitPenalty:  1000000, // Arbitrarily set it to a million seconds
                            adjustedAverage: 1000000, // Arbitrarily set it to a million seconds
                            allRacesCount:   leaderboard[player].allRacesCount,
                        });

                    // Otherwise, calculate and format the average time
                    } else {
                        let averageTime = leaderboard[player].totalTime / (leaderboard[player].numRaces - leaderboard[player].numForfeits);
                        let forfeitPenalty = (averageTime * leaderboard[player].numForfeits / leaderboard[player].numRaces);
                        leaderboardArray.push({
                            player:          player,
                            averageTime:     averageTime,
                            numRaces:        leaderboard[player].numRaces,
                            numForfeits:     leaderboard[player].numForfeits,
                            forfeitPenalty:  forfeitPenalty,
                            adjustedAverage: averageTime + forfeitPenalty,
                            allRacesCount:   leaderboard[player].allRacesCount,
                        });
                    }
                }

                // Sort the leaderboard by adjusted average times (which takes into account a forfeit penalty)
                leaderboardArray = leaderboardArray.sort(function(a, b) {
                    return a.adjustedAverage - b.adjustedAverage;
                });

                // Start to construct the leaderboard string
                let leaderboardString = 'The Binding of Isaac: Afterbirth\n';
                leaderboardString += 'Unseeded Jud6s Average Time Leaderboard\n';
                leaderboardString += new Date() + '\n';
                leaderboardString += '(requested by ' + requester + ')\n\n';
                leaderboardString += '- Only the last ' + numAverageRacesToUse + ' races are used for players with over ' + numAverageRacesToUse + ' races.\n';
                leaderboardString += '- Players with under 20 races are not included in the leaderboard.\n';
                leaderboardString += '- A time-based penalty is added for each forfeit according to:\n';
                leaderboardString += '    (average time * number of forfeits / number of races)\n';
                leaderboardString += '- This means that it is only advantageous to forfeit if your finishing time will be more than double your current average.\n';
                leaderboardString += '- This formula is derived from risk assessment (https://en.wikipedia.org/wiki/Risk_assessment).\n\n\n\n';
                leaderboardString += 'Rank   Name                 Adjusted   Real      Forfeit         Forfeit\n';
                leaderboardString += '                            Average    Average   Rate            Penalty\n';
                leaderboardString += '-------------------------------------------------------------------------\n';

                // Iterate through the leaderboard array
                for (let i = 0; i < leaderboardArray.length; i++) {
                    // Create the "Rank" column
                    let place = i + 1;
                    leaderboardString += '#' + place;
                    if (place < 10) {
                        leaderboardString += ' ';
                    }
                    leaderboardString += '    ';

                    // Create the "Name" column
                    leaderboardString += leaderboardArray[i].player;
                    let spacing = 21 - leaderboardArray[i].player.length; // Pad with spaces so that it is properly aligned
                    for (let j = 0; j < spacing; j++) {
                        leaderboardString += ' ';
                    }

                    // Create the "Adjusted Average" column
                    if (leaderboardArray[i].averageTime === 1000000) {
                        leaderboardString +=  'n/a  ';
                    } else {
                        let adjustedAverageMinutes = Math.floor(leaderboardArray[i].adjustedAverage / 60);
                        let adjustedAverageSeconds = Math.floor(leaderboardArray[i].adjustedAverage % 60);
                        if (adjustedAverageSeconds < 10) {
                            adjustedAverageSeconds = '0' + adjustedAverageSeconds;
                        }
                        leaderboardString += adjustedAverageMinutes + ':' + adjustedAverageSeconds;
                    }
                    leaderboardString += '      ';

                    // Create the "Real Average" column
                    if (leaderboardArray[i].averageTime === 1000000) {
                        leaderboardString +=  'n/a  ';
                    } else {
                        let averageMinutes = Math.floor(leaderboardArray[i].averageTime / 60);
                        let averageSeconds = Math.floor(leaderboardArray[i].averageTime % 60);
                        if (averageSeconds < 10) {
                            averageSeconds = '0' + averageSeconds;
                        }
                        leaderboardString += averageMinutes + ':' + averageSeconds;
                    }
                    leaderboardString += '     ';

                    // Create the "Forfeit Rate" column
                    let forfeitPercent = Math.round(leaderboardArray[i].numForfeits / leaderboardArray[i].numRaces * 100);
                    leaderboardString += forfeitPercent + '% ';
                    if (forfeitPercent < 10) {
                        leaderboardString += ' ';
                    }
                    leaderboardString += '(' + leaderboardArray[i].numForfeits + '/' + leaderboardArray[i].numRaces + ')';
                    if (leaderboardArray[i].numForfeits < 10) {
                        leaderboardString += ' ';
                    }
                    if (leaderboardArray[i].numRaces < 10) {
                        leaderboardString += ' ';
                    }
                    leaderboardString += '     ';

                    // Create the "Forfeit Penalty" column
                    if (leaderboardArray[i].averageTime === 1000000) {
                        leaderboardString +=  'n/a  ';
                    } else {
                        let penaltyMinutes = Math.floor(leaderboardArray[i].forfeitPenalty / 60);
                        let penaltySeconds = Math.floor(leaderboardArray[i].forfeitPenalty % 60);
                        if (penaltySeconds < 10) {
                            penaltySeconds = '0' + penaltySeconds;
                        }
                        leaderboardString += penaltyMinutes + ':' + penaltySeconds;
                    }
                    leaderboardString += '\n';
                }

                // Add a second leaderboard for the top ten times
                leaderboardString += '\n\n\nTop Ten Unseeded Jud6s Times\n\n';
                for (let i = 0; i < topTenTimes.length; i++) {
                    // Create the header for the player
                    let place = i + 1;
                    if (place < 10) {
                        leaderboardString += ' ';
                    }
                    leaderboardString += place + ') ' + topTenTimes[i].player;
                    let spacing = 21 - topTenTimes[i].player.length; // Pad with spaces so that it is properly aligned
                    for (let j = 0; j < spacing; j++) {
                        leaderboardString += ' ';
                    }

                    // Parse the average time
                    let averageMinutes = Math.floor(topTenTimes[i].raceTime / 60);
                    let averageSeconds = Math.floor(topTenTimes[i].raceTime % 60);
                    if (averageSeconds < 10) {
                        averageSeconds = '0' + averageSeconds;
                    }

                    // Add the average time
                    leaderboardString += averageMinutes + ':' + averageSeconds;

                    // Add the version
                    leaderboardString += '     ' + topTenTimes[i].version;

                    // Add the date
                    leaderboardString += '     ' + getFormattedDate(topTenTimes[i].date) + '\n';
                }

                // Add a third leaderboard for most unseeded Jud6s races played
                leaderboardString += '\n\n\nMost Unseeded Jud6s Races Played\n\n';

                // Resort the leaderboardArray based on allRacesCount
                leaderboardArray = leaderboardArray.sort(function(a, b) {
                    return b.allRacesCount - a.allRacesCount;
                });
                for (let i = 0; i < 10; i++) {
                    // Create the header for the player
                    let place = i + 1;
                    if (place < 10) {
                        leaderboardString += ' ';
                    }
                    leaderboardString += place + ') ' + leaderboardArray[i].player;
                    let spacing = 21 - leaderboardArray[i].player.length; // Pad with spaces so that it is properly aligned
                    for (let j = 0; j < spacing; j++) {
                        leaderboardString += ' ';
                    }

                    // Add the amount of races that they played
                    leaderboardString += leaderboardArray[i].allRacesCount + ' races\n';
                }
                leaderboardString += '\n';

                // Post the leaderboard to Pastebin
                let response = await postPastebin('Jud6s Leaderboard', leaderboardString); // jshint ignore:line
                let sayString = 'Jud6s Leaderboard: ' + response;
                if (IRC === 'SRL') {
                    SRLBot.say(channel, sayString);
                } else if (IRC === 'Twitch') {
                    TwitchBot.say(channel, sayString);
                } else if (IRC === 'Discord') {
                    DiscordBot.sendMessage({ to: channel, message: sayString });
                }
            }); // jshint ignore:line
        });
    } catch(err) {
        console.log('----- getLeaderboard function failed with error: ' + err + ' -----');
        sayString = 'Something went wrong when getting the leaderboard.';
        if (IRC === 'SRL') {
            SRLBot.say(channel, sayString);
        } else if (IRC === 'Twitch') {
            TwitchBot.say(channel, sayString);
        } else if (IRC === 'Discord') {
            DiscordBot.sendMessage({ to: channel, message: sayString });
        }
    }
}

function getMostRaces(IRC, channel, requester) {
    try {
        // Get all the Jud6s races from the database
        mongodb.MongoClient.connect('mongodb://localhost:27017/isaac', function (err, db) {
            if (err) {
                error('ERROR - Unable to connect to the MongoDB server: ' + err);
                throw 'Unable to connect to the MongoDB server.';
            }

            // Initialize variables
            let leaderboard = {};

            // Get the races collection
            let collection = db.collection('races');
            let stream = collection.find({}, {}).stream();

            // For each race
            stream.on('data', function(race) {
                // Go through the results
                for (let i = 0; i < race.results.length; i++) {
                    let player = race.results[i].player.toLowerCase();

                    // This is the first time we have come across this player, so make an entry for them in the leaderboard
                    if (typeof leaderboard[player] === 'undefined') {
                        leaderboard[player] = {
                                allRacesCount: 0,
                        };
                    }

                    // Increment the count of their total races
                    leaderboard[player].allRacesCount++;
                }
            });

            // We have now gone through all the races
            stream.on('end', async function() { // jshint ignore:line
                // Close connection
                db.close();

                // We have to make an array so that we can sort it later
                let leaderboardArray = [];

                // Move everything in the leaderboard object to the leaderboard array
                for (let player in leaderboard) {
                    leaderboardArray.push({
                        player:          player,
                        allRacesCount:   leaderboard[player].allRacesCount,
                    });
                }

                // Sort the leaderboard by who has the most races
                leaderboardArray = leaderboardArray.sort(function(a, b) {
                    return b.allRacesCount - a.allRacesCount;
                });

                // Start to construct the leaderboard string
                let leaderboardString = 'The Binding of Isaac: Afterbirth\n';
                leaderboardString += 'Most SpeedRunsLive.com Races Played\n';
                leaderboardString += new Date() + '\n';
                leaderboardString += '(requested by ' + requester + ')\n\n';

                // Get the top 100
                for (let i = 0; i < 100; i++) {
                    // Create the header for the player
                    let place = i + 1;
                    if (place < 100) {
                        leaderboardString += ' ';
                    }
                    if (place < 10) {
                        leaderboardString += ' ';
                    }
                    leaderboardString += place + ') ' + leaderboardArray[i].player;
                    let spacing = 21 - leaderboardArray[i].player.length; // Pad with spaces so that it is properly aligned
                    for (let j = 0; j < spacing; j++) {
                        leaderboardString += ' ';
                    }

                    // Add the amount of races that they played
                    leaderboardString += leaderboardArray[i].allRacesCount + ' races\n';
                }
                leaderboardString += '\n';

                // Post the leaderboard to Pastebin
                let response = await postPastebin('Most Races Played Leaderboard', leaderboardString); // jshint ignore:line
                let sayString = 'Most Races Played Leaderboard: ' + response;
                if (IRC === 'SRL') {
                    SRLBot.say(channel, sayString);
                } else if (IRC === 'Twitch') {
                    TwitchBot.say(channel, sayString);
                } else if (IRC === 'Discord') {
                    DiscordBot.sendMessage({ to: channel, message: sayString });
                }
            }); // jshint ignore:line
        });
    } catch(err) {
        console.log('----- getMostRaces function failed with error: ' + err + ' -----');
        sayString = 'Something went wrong when getting the leaderboard.';
        if (IRC === 'SRL') {
            SRLBot.say(channel, sayString);
        } else if (IRC === 'Twitch') {
            TwitchBot.say(channel, sayString);
        } else if (IRC === 'Discord') {
            DiscordBot.sendMessage({ to: channel, message: sayString });
        }
    }

}

function getAllRaces(IRC, channel, player, requester) {
    // Remove whitespace from both sides of the string
    player = player.trim();

    // If the user is requesting a player's Twitch name instead of their SRL name, maybe we can fix the mistake automatically
    for (let i = 0; i < userList.length; i++) { // Go through the player list
        if (userList[i].twitch === player.toLowerCase()) {
            player = userList[i].srl;
            break;
        }
    }

    // Get this player's past races from the database
    try {
        mongodb.MongoClient.connect('mongodb://localhost:27017/isaac', function (err, db) {
            if (err) {
                error('ERROR - Unable to connect to the MongoDB server: ' + err);
                throw 'Unable to connect to the MongoDB server.';
            }

            // Create a regular expression to be used in the next step
            function regexEscape(str) {
                return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            }
            let re = new RegExp('^' + regexEscape(player) + '$', 'i'); // Match the player exactly, but case insensitive

            // Initialize variables
            let numRaces = 0;
            let numForfeits = 0;
            let sumTimes = 0;
            let racesString = 'The Binding of Isaac: Afterbirth\n';
            racesString += 'List of Races for ' + player + '\n';
            racesString += new Date() + '\n';
            racesString += '(requested by ' + requester + ')\n\n';

            // Get the races collection
            let collection = db.collection('races');
            let options = {
                sort: [['id','desc']], // Get every race that they have ever done, with the most recent being at the top
            };
            let stream = collection.find({
                results: { $elemMatch: { player: re } },
            }, options).stream();

            // For each race
            stream.on('data', function(race) {
                // Start to build the races string (which will only be used if this is a "!raceList" command)
                numRaces++;
                if (numRaces < 1000) {
                    racesString += ' ';
                }
                if (numRaces < 100) {
                    racesString += ' ';
                }
                if (numRaces < 10) {
                    racesString += ' ';
                }
                racesString += numRaces + ')';

                // Add the date/time that the race happened
                let date = getFormattedDate(race.date);
                let spacing = 34 - date.length; // Pad with spaces so that it is properly aligned
                for (let i = 0; i < spacing; i++) {
                    racesString += ' ';
                }
                racesString += date + '     ';

                // Find their time (and comment)
                let foundPlayer = false;
                let raceTime;
                let comment;
                let goal;
                for (let i = 0; i < race.results.length; i++) {
                    if (race.results[i].player.toLowerCase() === player.toLowerCase()) {
                        raceTime = race.results[i].time;
                        comment = race.results[i].message;
                        goal = race.goal;
                        foundPlayer = true;
                        break;
                    }
                }
                if (foundPlayer === false) {
                    error('ERROR: When going through the database, I was not able to find player ' + player + ' in race ' + i + '.');
                    throw 'Player ' + player + ' not found in race ' + i + '.';
                }

                // Add the time to the string
                if (raceTime < 1) {
                    numForfeits++; // They forfeited this race
                    racesString += 'Forfeit';
                } else {
                    let minutes = Math.floor(raceTime / 60);
                    let seconds = raceTime % 60;
                    if (seconds < 10) {
                        seconds = '0' + seconds;
                    }
                    sumTimes += raceTime; // They finished this race
                    racesString += ' ' + minutes + ':' + seconds + ' ';
                }

                // Add the message to the string, if there is one
                if (comment !== '') {
                    racesString += '     ' + comment;
                }
                racesString += '\n';

                // Add the goal
                if (numRaces < 1000) {
                    racesString += ' ';
                }
                if (numRaces < 100) {
                    racesString += ' ';
                }
                if (numRaces < 10) {
                    racesString += ' ';
                }
                racesString += goal + '\n';
            });

            // We have now gone through all the races
            stream.on('end', async function() { // jshint ignore:line
                // Close connection
                db.close();

                // Check to see if they have any races
                if (numRaces === 0) {
                    let sayString = player + ' has 0 races played.';
                    if (IRC === 'SRL') {
                        SRLBot.say(channel, sayString);
                    } else if (IRC === 'Twitch') {
                        TwitchBot.say(channel, sayString);
                    } else if (IRC === 'Discord') {
                        DiscordBot.sendMessage({ to: channel, message: sayString });
                    }
                    return;
                }

                // Post it to Pastebin
                let response = await postPastebin('Race Listing', racesString); // jshint ignore:line
                let sayString = 'List of ' + player + '\'s races: ' + response;
                if (IRC === 'SRL') {
                    SRLBot.say(channel, sayString);
                } else if (IRC === 'Twitch') {
                    TwitchBot.say(channel, sayString);
                } else if (IRC === 'Discord') {
                    DiscordBot.sendMessage({ to: channel, message: sayString });
                }
                return;
            }); // jshint ignore:line
        });
    } catch(err) {
        console.log('----- getAverageTimes function failed with error: ' + err + ' -----');
        sayString = 'Something went wrong when getting the race listing for ' + player + '.';
        if (IRC === 'SRL') {
            SRLBot.say(channel, sayString);
        } else if (IRC === 'Twitch') {
            TwitchBot.say(channel, sayString);
        } else if (IRC === 'Discord') {
            DiscordBot.sendMessage({ to: channel, message: sayString });
        }
    }
}

function getRandomNumber(IRC, channel, user, minNumber, maxNumber) {
    // Player validation
    user = user.toLowerCase();
    for (let i = 0; i < ignoreList.length; i++) {
        if (ignoreList[i] === user && user !== 'zamiel' && user !== 'zamiell') {
            return; // Ignore what they have to say
        }
    }

    // Twitch channel exceptions
    if (IRC === 'Twitch' && channel.toLowerCase() == '#paulbypaul') {
        return;
    }

    // Input validation
    if (minNumber > 1000 || maxNumber > 1000 || minNumber < 0 || maxNumber < 0 || minNumber === maxNumber) {
        let sayString = 'Incorrect roll format. ' + user + ' has been added to the ignore list for command abuse.';
        if (IRC === 'SRL') {
            SRLBot.say(channel, sayString);
        } else if (IRC === 'Twitch') {
            TwitchBot.say(channel, sayString);
        } else if (IRC === 'Discord') {
            DiscordBot.sendMessage({ to: channel, message: sayString });
        }
        ignoreList.push(user);
        return;
    }

    // Get the random number
    let randomNum = Math.floor(Math.random() * (parseInt(maxNumber) - parseInt(minNumber) + 1) + parseInt(minNumber)); // Get a random number between minNumber and maxNumber

    // Announce it
    let sayString = 'Random number between ' + minNumber + ' and ' + maxNumber + ': ' + randomNum;
    if (IRC === 'SRL') {
        SRLBot.say(channel, sayString);
    } else if (IRC === 'Twitch') {
        TwitchBot.say(channel, sayString);
    } else if (IRC === 'Discord') {
        DiscordBot.sendMessage({ to: channel, message: sayString });
    }
}

function getRandomBuild(IRC, channel, user) {
    // Player validation
    user = user.toLowerCase();
    for (let i = 0; i < ignoreList.length; i++) {
        if (ignoreList[i] === user && user !== 'zamiel' && user !== 'zamiell') {
            return; // Ignore what they have to say
        }
    }

    // Twitch channel exceptions
    if (IRC === 'Twitch' && channel.toLowerCase() == '#paulbypaul') {
        return;
    }

    // Get the random number
    let minNumber = 1;
    let maxNumber = instantStartArray.length;
    let randomNum = Math.floor(Math.random() * (parseInt(maxNumber) - parseInt(minNumber) + 1) + parseInt(minNumber)); // Get a random number between minNumber and maxNumber

    // Announce it
    let sayString = 'Random build: #' + randomNum + '  - ' + instantStartArray[randomNum];
    if (IRC === 'SRL') {
        SRLBot.say(channel, sayString);
    } else if (IRC === 'Twitch') {
        TwitchBot.say(channel, sayString);
    } else if (IRC === 'Discord') {
        DiscordBot.sendMessage({ to: channel, message: sayString });
    }
}

function getRandomCharacter(IRC, channel, user) {
    // Player validation
    user = user.toLowerCase();
    for (let i = 0; i < ignoreList.length; i++) {
        if (ignoreList[i] === user && user !== 'zamiel' && user !== 'zamiell') {
            return; // Ignore what they have to say
        }
    }

    // Twitch channel exceptions
    if (IRC === 'Twitch' && channel.toLowerCase() == '#paulbypaul') {
        return;
    }

    // Get the random number
    let minNumber = 0;
    let maxNumber = characterArray.length;
    let randomNum = Math.floor(Math.random() * (parseInt(maxNumber) - parseInt(minNumber) + 1) + parseInt(minNumber)); // Get a random number between minNumber and maxNumber

    // Announce it
    let sayString = 'Random character: ' + characterArray[randomNum];
    if (IRC === 'SRL') {
        SRLBot.say(channel, sayString);
    } else if (IRC === 'Twitch') {
        TwitchBot.say(channel, sayString);
    } else if (IRC === 'Discord') {
        DiscordBot.sendMessage({ to: channel, message: sayString });
    }
}

// From: http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function refillInstantStartRandomArray() {
    // Add 1 through the number of instance start builds
    for (let i = 1; i <= numInstantStartBuilds; i++) {
        instantStartRandomArray.push(i);
    }

    // Randomize it
    shuffle(instantStartRandomArray);
}

function refillCharacterRandomArray() {
    // Add all the characters to the array
    for (let i = 0; i < characterArray.length; i++) {
        characterRandomArray.push(characterArray[i]);
    }

    // Randomize it
    shuffle(characterRandomArray);
}

function getOrdinal(n) {
    let s = ["th", "st", "nd", "rd"];
    let v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/*
 *
 * SRL Stuff
 *
 */

// Catch errors
SRLBot.addListener('error', function(message) {
    error('SRL ERROR: ' + message.command + ': ' + message.args.join(' '));
    if (message.command === 'err_nosuchnick') {
        error('SRL ERROR: Got a "err_nosuchnick" error. Did the race list get corrupted? Printing raceList...');
        console.log(raceList);
    } else if (message.command === 'err_cannotsendtochan') {
        error('SRL ERROR: Got a "cannotsendtochan" error. Did the race get recorded and booted already? Printing raceList...');
        console.log(raceList);
    }
});

// Detect broken session
SRLBot.addListener('ping', function(server) {
    let currentTime = new Date().getTime(); // Get the epoch timestamp
    SRLTimeoutTimer = currentTime;
    setTimeout(checkSRLBroken, 600000, currentTime); // 10 minutes (changed this from 5 minutes because it was too short)
});

// Catch messages
SRLBot.addListener('message', function(user, channel, message) {
    // Remove whitespace from both sides of the string
    message = message.trim();

    // Log all messages
    let datetime = new Date();
    console.log(datetime + ' - SRL [' + channel + '] <' + user + '> ' + message);

    // Look for new BoIR races
    if (channel === '#speedrunslive' && (message.match(/^\.startrace isaacafterbirth\s*/) || message.match(/^\.startrace afterbirth\s*/))) {
        console.log('----- Setting raceStarter to "' + user + '". -----');
        raceStarter = user;
    }

    if (channel === '#speedrunslive' && user === 'RaceBot' && (
        message.match(/^Race initiated for The Binding of Isaac: Rebirth\. Join.+#srl-..... .to participate\.$/) ||
        message.match(/^Race initiated for The Binding of Isaac: Afterbirth\. Join.+#srl-..... .to participate\.$/) ||
        message.match(/^Race initiated for The Binding of Isaac: Afterbirth\+\. Join.+#srl-..... .to participate\.$/)
    )) {
        // Parse the message from RaceBot
        let raceChannelName = message.match(/^Race initiated for The Binding of Isaac: .+\. Join.+(#srl-.+) .to participate\.$/)[1];
        let expansion = message.match(/^Race initiated for The Binding of Isaac: (.+)\. Join.+#srl-.+ .to participate\.$/)[1];

        // Join the race
        addRace(raceChannelName);
        SRLBot.join(raceChannelName);
    }

    // Validate that this race exists in the database
    if (channel.match(/^#srl-.....$/) && !(channel in raceList)) {
        error('SRL ERROR: I recieved a message in ' + channel + ', but it doesn\'t exist in the raceList.');
        debug();
        return;
    }

    // Look for RaceBot stuff
    if (channel.match(/^#srl-.....$/) && user === 'RaceBot') {
        // Local variables
        let m;

        // Advertise tournaments/leagues
        if (message.match(/^.4.The race will begin in 10 seconds!..$/)) {
            advertCounter++;
            if (advertCounter === numRacesToAdvert) {
                advertCounter = 0;
                SRLBot.say(channel, advertMessage);
            }
        }

        // Look for players joining a race
        m = message.match(/^(.+) enters the race! \d+ entrants*\.$/);
        if (m) {
            // Add the racer to the entrants list
            let racer = m[1].toLowerCase();
            if (raceList[channel].entrants.indexOf(racer) >= 0) {
                error('SRL ERROR: ' + racer + ' joined race ' + channel + ', but they were already in the entrant list.');
                console.log('SRL ERROR: ' + racer + ' joined race ' + channel + ', but they were already in the entrant list.');
            } else {
                raceList[channel].entrants.push(racer);
                console.log('----- ' + racer + ' joined race ' + channel + ' -----');
            }

            // Announce that the racer has joined the race in their Twitch chat
            for (let i = 0; i < userList.length; i++) { // Go through the user list
                if (userList[i].srl === racer) {
                    // Compile the message
                    let twitchChannel = '#' + userList[i].twitch;
                    let twitchMessage = '- ' + userList[i].twitch + ' has joined race ' + channel + '.';

                    // Send the message
                    console.log('----- Sending TIMEOUT join notification to ' + twitchChannel + ': ' + twitchMessage + ' -----');
                    setTimeout(sendTwitch, userList[i].delayTwitchOutput, 'join', twitchChannel, twitchMessage);
                    break;
                }
            }
        }

        // Look for people leaving the current race
        m = message.match(/^(.+) has been removed from the race\.$/);
        if (m) {
            // Remove the racer from the entrants list
            let racer = m[1].toLowerCase();
            if (raceList[channel].entrants.indexOf(racer) >= 0) {
                raceList[channel].entrants.splice(raceList[channel].entrants.indexOf(racer), 1);
            } else {
                error('SRL ERROR: ' + racer + ' left race ' + channel + ', but they weren\'t in the entrant list.');
            }

            // Announce that the racer has left the race in their Twitch chat
            for (let i = 0; i < userList.length; i++) { // Go through the user list
                if (userList[i].srl === racer) {
                    // Compile the message
                    let twitchChannel = '#' + userList[i].twitch;
                    let twitchMessage = '- ' + userList[i].twitch + ' has left race ' + channel + '.';

                    // Send the message
                    console.log('----- Sending TIMEOUT left notification to ' + twitchChannel + ': ' + twitchMessage + ' -----');
                    setTimeout(sendTwitch, userList[i].delayTwitchOutput, 'left', twitchChannel, twitchMessage);
                    break;
                }
            }
        }

        // Look for a race starting in 10/5/0 seconds
        for (let i = 0; i < userList.length; i++) { // Go through the user list
            for (let j = 0; j < raceList[channel].entrants.length; j++) { // Go through the entrants for this race
                if (userList[i].srl === raceList[channel].entrants[j]) {
                    if (message.match(/^.4.The race will begin in 10 seconds!..$/)) {
                        // Compile the message
                        let twitchChannel = '#' + userList[i].twitch;
                        let twitchMessage = '- The race is starting in 10 seconds.';

                        // Send the message
                        console.log('----- Sending TIMEOUT raceBegin notification to ' + twitchChannel + ': ' + twitchMessage + ' -----');
                        setTimeout(sendTwitch, userList[i].delayTwitchOutput, 'raceBegin', twitchChannel, twitchMessage);
                        break;
                    }
                }
            }
        }

        // Look for a race starting
        if (message.match(/^.4.GO!..$/)) {
            // Set the racers left and number of people racing
            raceList[channel].entrantsLeft = raceList[channel].entrants.slice();
            console.log('----- Race starting with ' + raceList[channel].entrantsLeft.length + ' entrants. -----');

            // Check to see if it is a Diversity Mod race starting
            let m = goalList.setdiv.match(/\.setgoal (.+?, seed ).+/);
            let matchString;
            if (m) {
                matchString = m[1];
            } else {
                error('SRL ERROR: When announcing the items for a Diversity Mod race, I failed to parse the .setdiv goal.');
                return;
            }
            matchString = matchString.replace('(', '\\(');
            matchString = matchString.replace(')', '\\)');
            let re = new RegExp(matchString);
            if (raceList[channel].goal.match(re)) {
                // Announce the items for the currently starting Diversity Mod race
                console.log('----- Announcing the items for the currently starting Diversity Mod race. -----');
                let re = new RegExp(matchString + '(.+)\\)'); // The trailing ")" character is not part of the seed
                let m = raceList[channel].goal.match(re);
                let seed;
                if (m) {
                    seed = m[1];
                } else {
                    error('SRL ERROR: When announcing the items for a Diversity Mod race, I failed to parse the the seed.');
                    return;
                }
                let cmd = botDirectory + '/diversity.py ' + seed;
                exec(cmd, function(err, stdout, stderr) {
                    let items = stdout.trim();
                    SRLBot.say(channel, 'The items for this seed are ' + items);
                });
            }
        }

        // Look for a rematch
        if (message.match(/^Rematch!$/)) {
            addRematch(channel);

            // Look for Diversity races so that we can automatically set the goal
            let m = goalList.setdiv.match(/\.setgoal (.+?, seed ).+/);
            let matchString;
            if (m) {
                matchString = m[1];
            } else {
                error('SRL ERROR: When looking to see if the rematch is a Diversity Mod goal, I failed to parse the .setdiv goal.');
                return;
            }
            matchString = matchString.replace('(', '\\(');
            matchString = matchString.replace(')', '\\)');
            let re = new RegExp(matchString);
            if (raceList[channel].goal.match(re)) {
                console.log('----- Setting a new goal for the Diversity Mod rematch. -----');
                let re = new RegExp(matchString + '(.+)\\)'); // The trailing ")" character is not part of the seed
                let m = raceList[channel].goal.match(re);
                let seed;
                if (m) {
                    seed = m[1];
                } else {
                    error('SRL ERROR: When setting a Diversity Mod rematch goal, I failed to parse the the seed.');
                    return;
                }
                if (seed.length === 5) {
                    // Append a 1
                    seed = seed + '1';
                } else {
                    // Local variable for the next 2 blocks
                    let m;

                    // Increment the final digit
                    m = seed.match(/^(.+)\d$/);
                    let seedBeginning;
                    if (m) {
                        seedBeginning = m[1];
                    } else {
                        error('SRL ERROR: When setting a Diversity Mod rematch goal, I failed to parse the beginning of the seed: ' + seed);
                        return;
                    }
                    m = seed.match(/^.+(\d)$/);
                    let finalDigit;
                    if (m) {
                        finalDigit = m[1];
                    } else {
                        error('SRL ERROR: When setting a Diversity Mod rematch goal, I failed to parse the end of the seed: ' + seed);
                        return;
                    }
                    finalDigit = parseInt(finalDigit) + 1;
                    seed = seedBeginning + finalDigit;
                }
                let goal = goalList.setdiv.replace('#####', seed);
                SRLBot.say(channel, goal);
            }
        }

        // Look for racers finishing
        m = message.match(/^(.+) has finished in (.+) place with a time of (.+)\.$/);
        if (m) {
            let racer = m[1].toLowerCase();
            let place = m[2];
            let time = m[3];

            // Trim the preceding 0's, if present
            let m2 = place.match(/00:(.+)/);
            if (m2) {
                place = m2[1];
            }

            // Remove the racer from the entrants list
            if (raceList[channel].entrantsLeft.indexOf(racer) >= 0) {
                raceList[channel].entrantsLeft.splice(raceList[channel].entrantsLeft.indexOf(racer), 1);
            } else {
                error('SRL ERROR: ' + racer + ' finished race ' + channel + ', but they weren\'t in the entrantsLeft list.');
            }

            // Announce how many people are left
            SRLBot.action(channel, getPeopleLeft(channel));

            // Announce that someone finished in Twitch chat
            for (let i = 0; i < userList.length; i++) { // Go through the user list
                for (let j = 0; j < raceList[channel].entrants.length; j++) { // Go through the entrants for this race
                    if (userList[i].srl === raceList[channel].entrants[j]) {
                        // Compile the message
                        let twitchChannel = '#' + userList[i].twitch;
                        let twitchMessage = '- ' + place + ' - ' + racer + ' (' + time + ') - ';
                        if (raceList[channel].entrantsLeft.length === 0) {
                            twitchMessage += ' Race finished!';
                        } else {
                            twitchMessage += raceList[channel].entrantsLeft.length + ' left';
                        }

                        // Send the message
                        console.log('----- Sending TIMEOUT finish notification to ' + twitchChannel + ': ' + twitchMessage + ' -----');
                        setTimeout(sendTwitch, userList[i].delayTwitchOutput, 'finish', twitchChannel, twitchMessage);
                        break;
                    }
                }
            }
        }

        // Look for racers quitting
        m = message.match(/^(.+) has forfeited from the race\.$/);
        if (m) {
            let racer = m[1].toLowerCase();

            // Remove the racer from the entrants list
            if (raceList[channel].entrantsLeft.indexOf(racer) >= 0) {
                raceList[channel].entrantsLeft.splice(raceList[channel].entrantsLeft.indexOf(racer), 1);
            } else {
                error('SRL ERROR: ' + racer + ' quit race ' + channel + ', but they weren\'t in the entrantsLeft list.');
            }

            // Announce how many people are left
            SRLBot.action(channel, getPeopleLeft(channel));

            // Announce that someone quit in Twitch chat
            for (let i = 0; i < userList.length; i++) { // Go through the player list
                for (let j = 0; j < raceList[channel].entrants.length; j++) { // Go through the entrants for this race
                    if (userList[i].srl === raceList[channel].entrants[j]) {
                        // Announce it
                        let twitchChannel = '#' + userList[i].twitch;
                        let twitchMessage = '- ' + racer + ' quit - ';
                        if (raceList[channel].entrantsLeft.length === 0) {
                            twitchMessage += ' Race finished!';
                        } else {
                            twitchMessage += raceList[channel].entrantsLeft.length + ' left';
                        }
                        console.log('----- Sending TIMEOUT quit notification to ' + twitchChannel + ': ' + twitchMessage + ' -----');
                        setTimeout(sendTwitch, userList[i].delayTwitchOutput, 'quit', twitchChannel, twitchMessage);
                        break;
                    }
                }
            }
        }

        // Look for racers doing ".undone"
        m = message.match(/^(.+) has been undone from the race.$/);
        if (m) {
            let racer = m[1].toLowerCase();

            // Add the racer to the entrants list
            if (raceList[channel].entrantsLeft.indexOf(racer) >= 0) {
                error('SRL ERROR: ' + racer + ' did a ".undone" from race ' + channel + ', but they were still in the entrantsLeft list.');
            } else {
                raceList[channel].entrantsLeft.push(racer);
            }

            // Announce how many people are left
            SRLBot.action(channel, getPeopleLeft(channel));

            // Announce that someone did a ".undone" in Twitch chat
            for (let i = 0; i < userList.length; i++) { // Go through the user list
                for (let j = 0; j < raceList[channel].entrants.length; j++) { // Go through the entrants for this race
                    if (userList[i].srl === raceList[channel].entrants[j]) {
                        // Announce it
                        let twitchChannel = '#' + userList[i].twitch;
                        let twitchMessage = '- ' + racer + ' revoked their finish - ' + raceList[channel].entrantsLeft.length + ' left';
                        console.log('----- Sending TIMEOUT undone notification to ' + twitchChannel + ': ' + twitchMessage + ' -----');
                        setTimeout(sendTwitch, userList[i].delayTwitchOutput, 'undone', twitchChannel, twitchMessage);
                        break;
                    }
                }
            }
        }

        // Look for RaceBot ending the room
        if (message.match(/^The channel will be cleared in 30 seconds!$/)) {
            SRLBot.part(channel);
            deleteRace(channel);
            return;
        }
    }

    // Look for racers commenting
    if (channel.match(/^#srl-.....$/) && message.match(/^\.comment .+$/)) {
        let comment = message.match(/^.comment (.+)$/)[1];

        // Check to see if the person commenting is actually participating in the race
        let foundRacer = false;
        for (let i = 0; i < raceList[channel].entrants.length; i++) { // Go through the entrants for this race
            if (user.toLowerCase() === raceList[channel].entrants[i]) {
                foundRacer = true;
            }
        }
        if (foundRacer === false) {
            console.log('----- ' + user + ' is doing a .comment but they are not actually in the race. -----');
            debug();
            return; // The person commenting is not actually in the race
        }

        // Check to see if the person commenting has already made a comment for this race
        for (let i = 0; i < raceList[channel].commentedList.length; i++) {
            if (user.toLowerCase() === raceList[channel].commentedList[i]) {
                return; // They have already made a comment
            }
        }

        // Add this person to the list of players who have already commented
        raceList[channel].commentedList.push(user.toLowerCase());

        // Announce the comment to Twitch
        for (let i = 0; i < userList.length; i++) { // Go through the user list
            for (let j = 0; j < raceList[channel].entrants.length; j++) { // Go through the entrants for this race
                if (userList[i].srl === raceList[channel].entrants[j]) {
                    // Announce it
                    if (userList[i].echoComments === true) {
                        let twitchChannel = '#' + userList[i].twitch;
                        let twitchMessage = '- ' + user + ' comments: ' + comment;
                        console.log('----- Sending TIMEOUT comment notification to ' + twitchChannel + ': ' + twitchMessage + ' -----');
                        setTimeout(sendTwitch, userList[i].delayTwitchOutput, 'comment', twitchChannel, twitchMessage);
                    }
                    break;
                }
            }
        }
    }

    /*
     *
     * SRL commands
     *
     */

    // Goal commands
    if (message === '.goals') {
        SRLBot.say(channel, 'Use the "!goals" command to see my goal-related commands.');
    } else if (message === '!goals') {
        SRLBot.say(channel, 'I\'m programmed to accept the following goal-related commands:');
        for (let goal in goalList) { // Go through the goal list
            if (!goalList.hasOwnProperty(goal)) {
                continue;
            }

            let goalMessage = '  .' + goal;
            let spacing = 13 - goal.length; // Pad with spaces so that it is properly aligned
            for (let i = 0; i < spacing; i++) {
                goalMessage += ' ';
            }
            goalMessage += ' = ' + goalList[goal];
            SRLBot.say(channel, goalMessage);
        }
    } else if (channel.match(/^#srl-.....$/) && message.match(/^[\.!]set/)) {
        // .sets (2 arguments; the user entered a build and a seed)
        if (message.match(/^[\.!]sets (.+?) (....\s*....)/)) {
            let m = message.match(/^[\.!]sets (.+?) (....\s*....)/);

            // Set the seed to what the user requested
            let build = m[1];
            let seed = m[2].toUpperCase();
            seed = seed.trim(); // Remove the leading and trailing whitespace
            if (seed.length === 8) {
                // Insert a space to make the seed more readable
                let leftSide = seed.match(/^(....)....$/)[1];
                let rightSide = seed.match(/^....(....)$/)[1];
                seed = leftSide + ' ' + rightSide;
            }
            let goal = goalList.sets.replace('build ##', 'build ' + build);
            goal = goal.replace('seed #### ####', 'seed ' + seed);
            SRLBot.say(channel, goal);

        // .sets (1 argument; the user entered a seed but not a build)
        } else if (message.match(/^[\.!]sets (....\s*....)/)) {
            let m = message.match(/^[\.!]sets (....\s*....)/);

            // Assume they want a random build
            if (instantStartRandomArray.length === 0) {
                refillInstantStartRandomArray();
            }
            let build = instantStartRandomArray.pop();

            let seed = m[1].toUpperCase();
            seed = seed.trim(); // Remove the leading and trailing whitespace
            if (seed.length === 8) {
                // Insert a space to make the seed more readable
                let leftSide = seed.match(/^(....)....$/)[1];
                let rightSide = seed.match(/^....(....)$/)[1];
                seed = leftSide + ' ' + rightSide;
            }
            let goal = goalList.sets.replace('build ##', 'build ' + build);
            goal = goal.replace('seed #### ####', 'seed ' + seed);
            SRLBot.say(channel, goal);

        // .sets (1 argument; the user entered a build but not a seed)
        } else if (message.match(/^[\.!]sets (\d+)/)) {
            let m = message.match(/^[\.!]sets (\d+)/);

            // Parse the build
            let build = m[1];

            // Assume they want a random seed
            let cmd = botDirectory + '/isaac_seed_gen';
            exec(cmd, function(err, stdout, stderr) {
                let seed = stdout.trim();
                let goal = goalList.sets.replace('build ##', 'build ' + build);
                goal = goal.replace('seed #### ####', 'seed ' + seed);
                SRLBot.say(channel, goal);
            });

            let seed = m[1].toUpperCase();
            seed = seed.trim(); // Remove the leading and trailing whitespace
            if (seed.length === 8) {
                // Insert a space to make the seed more readable
                let leftSide = seed.match(/^(....)....$/)[1];
                let rightSide = seed.match(/^....(....)$/)[1];
                seed = leftSide + ' ' + rightSide;
            }
            let goal = goalList.sets.replace('build ##', 'build ' + build);
            goal = goal.replace('seed #### ####', 'seed ' + seed);
            SRLBot.say(channel, goal);

        // .sets (0 arguments; the user wants a random build and a random seed)
        } else if (message === '.sets') {
            // Assume they want a random build
            if (instantStartRandomArray.length === 0) {
                refillInstantStartRandomArray();
            }
            let build = instantStartRandomArray.pop();

            // Assume they want a random seed
            let cmd = botDirectory + '/isaac_seed_gen';
            exec(cmd, function(err, stdout, stderr) {
                let seed = stdout.trim();
                let goal = goalList.sets.replace('build ##', 'build ' + build);
                goal = goal.replace('seed #### ####', 'seed ' + seed);
                SRLBot.say(channel, goal);
            });

        // .seti
        } else if (message === '.seti') {
            // Assume they want a random character
            if (characterRandomArray.length === 0) {
                refillCharacterRandomArray();
            }
            let character = characterRandomArray.pop();

            // Assume they want a random build
            if (instantStartRandomArray.length === 0) {
                refillInstantStartRandomArray();
            }
            let build = instantStartRandomArray.pop();

            // Assume they want a random seed
            let cmd = botDirectory + '/isaac_seed_gen';
            exec(cmd, function(err, stdout, stderr) {
                let seed = stdout.trim();
                let goal = goalList.seti.replace('_____', character);
                goal = goal.replace('build ##', 'build ' + build);
                goal = goal.replace('seed #### ####', 'seed ' + seed);
                SRLBot.say(channel, goal);
            });

        // .setis
        } else if (message.match(/^[\.!]setis/)) {
            let m = message.match(/^[\.!]setis (.+)/);
            if (m) {
                // Set the start to what the user requested
                let start = m[1].trim(); // Remove the leading and trailing whitespace
                let goal = goalList.setis.replace('##', start);
                SRLBot.say(channel, goal);
            } else {
                // Set a random start
                if (instantStartRandomArray.length === 0) {
                    refillInstantStartRandomArray();
                }
                let randomNum = instantStartRandomArray.pop();
                let goal = goalList.setis.replace('##', randomNum);
                SRLBot.say(channel, goal);
            }

        // .setdiv
        } else if (message.match(/^[\.!]setdiv/)) {
            let m = message.match(/^[\.!]setdiv (.+)/);
            if (m) {
                // Set the seed to what the user requested
                let seed = m[1].trim(); // Remove the leading and trailing whitespace
                let goal = goalList.setdiv.replace('#####', seed);
                SRLBot.say(channel, goal);
            } else {
                // Set the seed equal to the race channel
                let seed = channel.match(/^#srl-(.+)$/)[1].toUpperCase();
                let goal = goalList.setdiv.replace('#####', seed);
                SRLBot.say(channel, goal);
            }

        // A non-special ".set" command
        } else {
            for (let goal in goalList) { // Go through the goal list
                if (message === '.' + goal) {
                    SRLBot.say(channel, goalList[goal]);
                }
            }
        }
    }

    // Info commands
    for (let info in infoList) { // Go through the info list
        if (!infoList.hasOwnProperty(info)) {
            continue;
        }

        // These commands are already used on #speedrunslive
        if ((message === '.help' || message === '!help' ||
             message === '.faq' || message === '!faq' ||
             message === '.commands' || message === '!commands') && channel === '#speedrunslive') {
            continue;
        }

        if (message === '.' + info || message === '!' + info) {
            SRLBot.say(channel, infoList[info]);
        }
    }

    // SRL special info commands
    if (message === '.left' || message === '!left') {
        if (channel.match(/^#srl-.+$/)) {
            SRLBot.action(channel, getPeopleLeft(channel));
        }
    } else if (message === '.unquit' || message === '!unquit') {
        if (channel.match(/^#srl-.+$/)) {
            SRLBot.say(channel, 'Hint: The command to unquit is ".undone".');
        }
    } else if (message.match(/^[\.!]average\b/) || message.match(/^[\.!]avg\b/)) {
        let m = message.match(/^[\.!]\w+ (.+)/);
        let player;
        if (m) {
            player = m[1];
        } else {
            player = user;
        }

        getAverageTimes('SRL', channel, player, user);
    } else if (message.match(/^[\.!]racelistall\b/)) {
        let m = message.match(/^[\.!]racelistall (.+)/);
        let player;
        if (m) {
            player = m[1];
        } else {
            player = user;
        }

        getAllRaces('SRL', channel, player, user);
    } else if (message.match(/^[\.!]racelist\b/)) {
        let m = message.match(/^[\.!]racelist (.+)/);
        let player;
        if (m) {
            player = m[1];
        } else {
            player = user;
        }

        getAverageTimes('SRL', channel, player, user, true);
    } else if (message === '.leaderboard' || message === '!leaderboard') {
        getLeaderboard('SRL', channel, user);
    } else if (message === '.mostraces' || message === '!mostraces') {
        getMostRaces('SRL', channel, user);
    } else if (message.match(/^[\.!]roll\b/) || message.match(/^[\.!]rand\b/) || message.match(/^[\.!]random\b/) ) {
        let m = message.match(/^[\.!]\w+ (\d+) (\d+)$/);
        let randomMin;
        let randomMax;
        if (m) {
            randomMin = m[1];
            randomMax = m[2];
        } else {
            let m = message.match(/^[\.!]\w+ (\d+)$/);
            if (m) {
                randomMin = 1;
                randomMax = m[1];
            } else {
                if (message === '!roll' || message === '.roll' || message === '!rand' || message === '.rand' || message === '!random' || message === '.random') {
                    randomMin = 1;
                    randomMax = 31;
                } else {
                    // Make it invalid so that they get added to the ignore list
                    randomMin = -1;
                    randomMax = -1;
                }
            }
        }
        getRandomNumber('SRL', channel, user, randomMin, randomMax);
    } else if (message === '.d20' || message === '!d20') {
        getRandomNumber('SRL', channel, user, 1, 20);
    } else if (message === '.randitem' || message === '!randitem' || message === '.build' || message === '!build' || message === '.randbuild' || message === '!randbuild') {
        getRandomBuild('SRL', channel, user);
    } else if (message === '.randchar' || message === '!randchar' || message === '.char' || message === '!char') {
        getRandomCharacter('SRL', channel, user);
    }

    // Debug commands for SRL
    if (user === 'Zamiel' && (message === '.fakeenter' || message === '!fakeenter')) {
        SRLBot.say(channel, 'Okay then, I\'ll pretend that you are really in this race!');
        console.log('----- Fake joined race ' + channel + ' -----');

        // Add the racer to the entrants list
        let racer = 'zamiel';
        if (raceList[channel].entrants.indexOf(racer) >= 0) {
            error('SRL ERROR: ' + racer + ' joined race ' + channel + ', but they were already in the entrant list.');
        } else {
            raceList[channel].entrants.push(racer);
        }
    } else if (user === 'Zamiel' && (message === '.debug' || message === '!debug')) {
        console.log('----- Doing debug function -----');
        debug();
    }
});

// Catch PMs
SRLBot.addListener('pm', function (user, message) {
    console.log('SRL PM <' + user + '> ' + message);

    // .join (1/2)
    for (let i = 0; i < userList.length; i++) { // Go through the user list
        if (user.toLowerCase() === userList[i].srl && message.match(/^.join .+$/)) {
            let channelToJoin = '#' + message.match(/^.join (.+)$/)[1];
            channelsToJoin.push(channelToJoin);
            console.log('----- I was told to join SRL channel ' + channelToJoin + ' -----');
            addRace(channelToJoin);
            SRLBot.join(channelToJoin);
        }
    }

    // .debug
    if (user === 'Zamiel' && message.match(/^.debug$/)) {
        debug();

    // .tsay
    } else if (user === 'Zamiel' && message.match(/^.tsay .+ .+$/)) {
        let sayChannel = message.match(/^.tsay (.+?) .+$/)[1];
        let sayMessage = message.match(/^.tsay .+? (.+)$/)[1];

        console.log('----- I was told to say to Twitch ' + sayChannel + ': "' + sayMessage + '" -----');
        TwitchBot.say('#' + sayChannel, sayMessage);

    // .ssay
    } else if (user === 'Zamiel' && message.match(/^.ssay .+ .+$/)) {
        let sayChannel = message.match(/^.ssay (.+?) .+$/)[1];
        let sayMessage = message.match(/^.ssay .+? (.+)$/)[1];

        console.log('----- I was told to say to SRL ' + sayChannel + ': "' + sayMessage + '" -----');
        SRLBot.say('#' + sayChannel, sayMessage);
    }
});

// Joining a new race
SRLBot.addListener('names', function(channel, nicks) {
    console.log('----- Joined channel ' + channel + ' -----');

    // If this is a race and we aren't manually joining the channel
    if (channelsToJoin.indexOf(channel) === -1 && channel.match(/^#srl-.+$/)) {
        // Wait a certain amount of seconds and then automatically set the goal
        // (apparently RaceBot bugs out if you set the goal too quickly)
        setTimeout(function() {
            SRLBot.say(channel, goalList.set);
        }, goalSetDelay);

        // Alert the Discord server that a new race has started
        let currentTime = new Date().getTime(); // Get the epoch timestamp
        console.log('currentTime:', currentTime);
        console.log('DiscordRaceTimer:', DiscordRaceTimer);
        console.log('difference:', currentTime - DiscordRaceTimer);
        if (currentTime - DiscordRaceTimer > 3600000) {
            // Only alert if it has been over an hour since the last alert
            DiscordRaceTimer = currentTime;
            let datetime = new Date();
            DiscordBot.sendMessage({
                to: DiscordRacingChatID,
                message: datetime + ' - A new Isaac race has been started by ' + raceStarter + ' on SRL!',
            });
        }

        // Alert other race channels that a new race has started
        for (let race in raceList) {
            if (!raceList.hasOwnProperty(race)) {
                continue;
            }

            if (race === channel) {
                continue; // Skip this channel since the point is to tell people in other channels
            }

            SRLBot.say(race, 'A new Isaac race has been started by \x034\x02' + raceStarter + '\x03\x02! To join, type: /join ' + channel);
        }
    }

    // Joining a race channel late either from a .join comment or a restart
    if (channelsToJoin.indexOf(channel) !== -1 && channel.match(/^#srl-.+$/)) {
        // Populate the entrants by looking to see who is a voice in the channel
        for (let nick in nicks) {
            if (!nicks.hasOwnProperty(nick)) {
                continue;
            }

            // Check if this user is a voice
            if (nicks[nick] === '+') {
                raceList[channel].entrants.push(nick.toLowerCase());
                console.log('----- Adding ' + nick + ' to the entrants list for race ' + channel + ' since they are a voice (' + raceList[channel].entrants.length + ' current entrants) -----');
            }
        }

        // Ask for a list of the current racers so we can adjust entrantsLeft appropriately
        SRLBot.say(channel, '.entrants');

        // Remove the channel from the channelsToJoin array since we have successfully joined it
        channelsToJoin.splice(channelsToJoin.indexOf(channel), 1);
    }
});

// Notice is used by RaceBot for various things
SRLBot.addListener('notice', function(nick, to, text, message) {
    let datetime = new Date();
    console.log(datetime + ' - SRL Notice <' + nick + '> ' + text);

    // Identify
    if (nick === 'NickServ' && text.match(/^If you do not change within 20 seconds, I will change your nick.$/)) {
        let SRLPassword = fs.readFileSync(botDirectory + '/passwords/SRL.txt', 'utf8').trim();
        SRLBot.say('NickServ', 'IDENTIFY ' + SRLPassword);
    } else if (nick === 'NickServ' && text.match(/^Password accepted - you are now recognized.$/)) {
        identified = true;
        console.log('----- Setting identified variable to true -----');
    }

    // Automatically join any races that are already going
    if (nick === 'RaceBot' && (
        text.match(/^\d+\. The Binding of Isaac: Rebirth - .+ /) ||
        text.match(/^\d+\. The Binding of Isaac: Afterbirth - .+ /) ||
        text.match(/^\d+\. The Binding of Isaac: Afterbirth\+ - .+ /)
    )) {
        // Parse the race name
        let m = text.match(/^\d+\. The Binding of Isaac: \w+ - .+ \|....(#srl-.....).+\|.+\|.+$/);
        if (m) {
            let raceChannelName = m[1];
            joinRace(raceChannelName);
        } else {
            error('SRL ERROR: Regex failure when automatically joining open races: ' + text);
        }

    // Update entrantsLeft for the race that we joined midway through
    } else if (nick === 'RaceBot' && text.match(/.+ \(.+\) \| .+ \(.+\)/)) {
        let racers = text.split('|');

        // Make a list of all the racers not finished yet
        let noticePlayers = [];
        for (let i = 0; i < racers.length; i++) {
            let m = racers[i].trim().match(/^(.+) \(Ready\)$/);
            if (m) {
                let readyRacer = m[1].trim().toLowerCase();
                noticePlayers.push(readyRacer);
            }
        }

        // Find out what race this corresponds to
        let raceName = false;
        for (let race in raceList) {
            if (!raceList.hasOwnProperty(race)) {
                continue;
            }

            // Count the number of players in the notice who are in this race
            let playersFound = 0;
            for (let i = 0; i < noticePlayers.length; i++) {
                for (let j = 0; j < raceList[race].entrants.length; j++) {
                    // toLowerCase is needed here because sometimes RaceBot will capitalize people's names in the .entrants message
                    if (noticePlayers[i].toLowerCase() === raceList[race].entrants[j].toLowerCase()) {
                        playersFound++;
                    }
                }
            }

            // If all of the players in the notice are entrants in this race
            if (playersFound === noticePlayers.length) {
                raceName = race;
                break;
            }
        }

        // Update entrantsLeft for this race
        if (raceName !== false) {
            raceList[raceName].entrantsLeft = noticePlayers.slice();
            console.log('----- Updating the entrantsLeft for race ' + raceName + ' that I joined late (' + raceList[raceName].entrantsLeft + ') -----');
        } else {
            error('SRL ERROR: I couldn\'t find a matching race for the .entrants message of: ' + noticePlayers);
            debug();
        }
    }
});

// Listen for races starting
SRLBot.addListener('topic', function(channel, topic) {
    // We only care about listening to the topic for race channels
    if (!channel.match(/^#srl-.....$/)) {
        return;
    }

    // Go through the race list
    let foundRace = false;
    for (let race in raceList) {
        if (!raceList.hasOwnProperty(race)) {
            continue;
        }

        if (race === channel) {
            // Local variables
            let m;

            // Set the status
            m = topic.match(/^Status: (.+?) \| Game:/);
            if (m) {
                let status = m[1].toLowerCase();
                if (status === 'entry open') {
                    raceList[race].status = 0;
                } else if (status === 'entry closed') {
                    raceList[race].status = 0;
                } else if (status === 'in progress') {
                    raceList[race].status = 1;
                } else if (status === 'complete') {
                    raceList[race].status = 2;
                } else if (status === 'race over') {
                    raceList[race].status = 2;
                } else {
                    error('SRL ERROR: I was not able to parse the status of the race from the topic for channel "' + channel + '": ' + topic);
                }
            } else {
                error('SRL ERROR: I was not able to parse the topic for channel "' + channel + '": ' + topic);
            }

            // Set the goal in the database
            m = topic.match(/\| Goal: (.+)$/);
            if (m) {
                let goal = m[1];
                raceList[channel].goal = goal;
                console.log('----- Set the goal for channel ' + channel + ' in my database to: ' + goal + ' -----');
            }

            foundRace = true;
            break;
        }
    }
    if (foundRace === false) {
        error('SRL ERROR: I recieved a topic for channel ' + channel + ', but I could not find a race that corresponds with it.');
    }
});

/*
 *
 * Twitch Stuff
 *
 */

// Do stuff once we successfully join the Twitch IRC server
TwitchBot.once('connected', async function() { // jshint ignore:line
    // Join every channel on the player list
    for (let i = 0; i < userList.length; i++) {
        // Check to see if the bot is a mod in the channel before joining it
        let modList = await TwitchBot.mods('#' + userList[i].twitch); // jshint ignore:line
        if (modList.indexOf('zamielbot') !== -1) {
            console.log('----- Mod check succeeded for ' + userList[i].twitch + ', joining channel. -----');
            TwitchBot.join('#' + userList[i].twitch);
        } else {
            error('TWITCH ERROR: ZamielBot is not a mod in the Twitch channel of: ' + userList[i].twitch);
        }
    }
}); // jshint ignore:line

// Catch chat messages
TwitchBot.on('chat', function(channel, user, message, self) {
    // Since user is an object containing various things, just make it equal to the username for simplicity
    user = user.username; // See: https://www.tmijs.org/docs/Events.md#chat

    // Remove whitespace from both sides of the string
    message = message.trim();

    // Log all messages
    let datetime = new Date();
    console.log(datetime + ' - TWITCH [' + channel + '] <' + user + '> ' + message);

    /*
     *
     * Twitch commands
     *
     */

    // Command exceptions per channel
    /*if (channel === '#asdf' && message === '!asdf') {
        return;
    }*/

    // !join
    if (user === 'zamiell' && message.match(/^!join .+$/)) {
        let channelName = message.match(/^!join (.+)$/)[1];
        console.log('----- I was told to join Twitch channel ' + channelName + ' -----');
        TwitchBot.say(channel, 'Ok, I\'ll join channel \'' + channelName + '\'.');
        TwitchBot.join('#' + channelName);
    }

    // !leave
    if (user === 'zamiell' && message.match(/^!leave .+$/)) {
        let channelName = message.match(/^!join (.+)$/)[1];
        console.log('----- I was told to leave Twitch channel ' + channelName + ' -----');
        TwitchBot.say(channel, 'Ok, I\'ll leave channel \'' + channelName + '\'.');
        TwitchBot.part('#' + channelName);
    }

    // Info commands
    for (let info in infoList) { // Go through the info list
        if (!infoList.hasOwnProperty(info)) {
            continue;
        }

        if (message === '!' + info) {
            TwitchBot.say(channel, infoList[info]);
        }
    }

    // Info commands for specific channels
    if (channel === '#zamiell') {
        if (message === '!os') {
            TwitchBot.say(channel, 'Zamiel is using Windows 7 with Aero disabled because it looks much cleaner (and is faster).');
        }
    } else if (channel === '#battle_of_kings') {
        if (message === '!commentator' ||
            message === '!commentators' ||
            message === '!caster' ||
            message === '!casters' ||
            message === '!host' ||
            message === '!hosts') {
            TwitchBot.say(channel, 'The two commentators are NuRelic and Antizoubilamaka.');
        }
    }

    // Twitch special info commands (that require finding the current race)
    if (message === '!left' || message === '!entrants' || message === '!multitwitch' || message === '!kadgar') {
        // Find the SRL name that corresponds to this Twitch channel
        let TwitchChannel = channel.match(/^#(.+)$/)[1];
        let foundSRL = false;
        let SRLName;
        for (let i = 0; i < userList.length; i++) { // Go through the player list
            if (userList[i].twitch === TwitchChannel) {
                SRLName = userList[i].srl;
                foundSRL = true;
            }
        }
        if (!foundSRL) {
            TwitchBot.say(channel, 'Something went wrong when finding the SRL name that corresponds with the "' + channel + '" channel.');
            error('TWITCH ERROR: I need to do a special info command, but I could not find the SRL name that corresponds with the "' + channel + '" channel.');
            return;
        }

        // Find the race that corresponds to this SRL name
        let raceName = false;
        for (let race in raceList) {
            if (!raceList.hasOwnProperty(race)) {
                continue;
            }

            // Skip this race if it is already completed
            if (raceList[race].status === 2) {
                continue;
            }

            // Go through the entrants for this race
            for (let j = 0; j < raceList[race].entrants.length; j++) {
                // We found the race that corresponds with this channel
                if (raceList[race].entrants[j] === SRLName) {
                    raceName = race;
                }
            }
        }
        if (raceName === false) {
            let player = channel.match(/#(.+)/)[1];
            TwitchBot.say(channel, player + ' is not currently in any races.');
            return;
        }

        // Perform the function relating to the specific command
        if (message === '!left') {
            TwitchBot.action(channel, getPeopleLeft(raceName));
        } else if (message === '!entrants') {
            TwitchBot.action(channel, getEntrants(raceName));
        } else if (message === '!multitwitch' || message === '!kadgar') {
            // Get the racers in this race
            let racerArray = []; // An array of racers to pass to the async.eachLimit() function
            let TwitchNameList = {}; // A data structure of Twitch names that will be populated asynchronously
            for (let i = 0; i < raceList[raceName].entrants.length; i++) {
                // Exclude JOPEBUSTER because he is a bot
                if (raceList[raceName].entrants[i] === 'jopebuster') {
                    continue;
                }

                racerArray.push(raceList[raceName].entrants[i]);
                TwitchNameList[raceList[raceName].entrants[i]] = '';
            }

            // For the racers in the race, find out the Twitch names that correspond to their SRL names
            console.log('----- Entering async.eachLimit function with the following racerArray: -----');
            console.log(racerArray);

            // We use a limit of 1 because the SRL API will lock us out
            async.eachLimit(racerArray, 1, async function(racer, callback) { // jshint ignore:line
                // Get the Twitch channel for this racer using the SRL API
                let url = 'http://api.speedrunslive.com/stat?player=' + racer;
                request(url, function (err, response, body) {
                    if (!err && response.statusCode == 200) {
                        try {
                            let json = JSON.parse(body);
                            TwitchNameList[racer] = json.player.channel;
                        } catch(err) {
                            error('TWITCH ERROR: Got error "' + err + '" while parsing the SRL API for ' + racer + ': ' + body);
                        }
                    } else {
                        warning('WARNING: Failed to GET URL: ' + url);
                    }
                    callback();
                });
            }, function(err) { // jshint ignore:line
                if (err) {
                    TwitchBot.say(channel, "Something went wrong when making the MultiTwitch/Kadgar link.");
                    return;
                }

                // Start to build the MultiTwitch/Kadgar string
                let watchString = 'Watch everyone in the race at the same time: http://';
                if (message === '!multitwitch') {
                    watchString += 'multitwitch.tv/';
                } else if (message === '!kadgar') {
                    watchString += 'kadgar.net/live/';
                }

                // Add each player to the string
                for (let SRLName in TwitchNameList) {
                    if (!TwitchNameList.hasOwnProperty(SRLName)) {
                        continue;
                    }

                    if (TwitchNameList[SRLName] === '') {
                        TwitchBot.say(channel, "Something went wrong when making the MultiTwitch/Kadgar link.");
                        return;
                    } else {
                        watchString += TwitchNameList[SRLName] + '/';
                    }
                }

                // Chop off the trailing slash
                watchString = watchString.substring(0, watchString.length - 1);

                // Send the message to their Twitch channel
                TwitchBot.say(channel, watchString);
            }); // jshint ignore:line
        }

    // Twitch special info commands (that do not require finding the current race)
    } else if (message.match(/^!average\b/) || message.match(/^!avg\b/)) {
        let m = message.match(/^!\w+ (.+)/);
        let player;
        if (m) {
            player = m[1];
        } else {
            let TwitchChannel = channel.match(/#(.+)/)[1];
            for (let i = 0; i < userList.length; i++) { // Go through the user list
                if (userList[i].twitch === TwitchChannel) {
                    player = userList[i].srl;
                    break;
                }
            }
        }

        getAverageTimes('Twitch', channel, player, user);
    } else if (message.match(/^!racelist\b/)) {
        let m = message.match(/^!racelist (.+)/);
        let player;
        if (m) {
            player = m[1];
        } else {
            let TwitchChannel = channel.match(/#(.+)/)[1];
            for (let i = 0; i < userList.length; i++) { // Go through the user list
                if (userList[i].twitch === TwitchChannel) {
                    player = userList[i].srl;
                    break;
                }
            }
        }

        getAverageTimes('Twitch', channel, player, user, true);
    } else if (message === '!leaderboard') {
        getLeaderboard('Twitch', channel, user);
    } else if (message === '!mostraces') {
        getMostRaces('Twitch', channel, user);
    } else if (message.match(/^!roll\b/) || message.match(/^!rand\b/) || message.match(/^!random\b/)) {
        let m = message.match(/^!\w+ (\d+) (\d+)$/);
        let randomMin;
        let randomMax;
        if (m) {
            randomMin = m[1];
            randomMax = m[2];
        } else {
            let m = message.match(/^!\w+ (\d+)$/);
            if (m) {
                randomMin = 1;
                randomMax = m[1];
            } else {
                if (message === '!roll' || message === '!rand' || message === '!random') {
                    randomMin = 1;
                    randomMax = 31;
                } else {
                    // Make it invalid so that they get added to the ignore list
                    randomMin = -1;
                    randomMax = -1;
                }
            }
        }
        getRandomNumber('Twitch', channel, user, randomMin, randomMax);
    } else if (message === '!d20') {
        getRandomNumber('Twitch', channel, user, 1, 20);
    } else if (message === '!randitem' || message === '!build' || message === '!randbuild') {
        getRandomBuild('Twitch', channel, user);
    } else if (message === '!randchar' || message === '!char') {
        getRandomCharacter('Twitch', channel, user);
    }
});

/*
 *
 * Discord Stuff
 *
 */

DiscordBot.on('message', function(user, userID, channel, message, event) {
    // Remove whitespace from both sides of the string
    message = message.trim();

    // Find out the name of the channel by iterating through all of the servers
    let channelName = 'unknown';
    for (let serverID in DiscordBot.servers) {
        if (!DiscordBot.servers.hasOwnProperty(serverID)) {
            continue;
        }

        for (let subChannel in DiscordBot.servers[serverID].channels) {
            if (!DiscordBot.servers[serverID].channels.hasOwnProperty(subChannel)) {
                continue;
            }

            if (subChannel === channel) {
                channelName = '#' + DiscordBot.servers[serverID].channels[channel].name;
                break;
            }
        }

        if (channelName !== 'unknown') {
            break;
        }
    }

    // Log all messages
    let datetime = new Date();
    console.log(datetime + ' - DISCORD [' + channelName + '] <' + user + '#' + event.d.author.discriminator + '> ' + message);

    /*
     *
     * Discord commands
     *
     */

    // Info commands
    for (let info in infoList) { // Go through the info list
        if (!infoList.hasOwnProperty(info)) {
            continue;
        }

        // Discord specific exclusions
        if (message === '!iotr') {
            break;
        }

        if (message === '!' + info) {
            DiscordBot.sendMessage({ to: channel, message: infoList[info] });
        }
    }

    // Discord special info commands
    if (message.match(/^!average\b/) || message.match(/^!avg\b/)) {
        let m = message.match(/^!\w+ (.+)/);
        let player;
        if (m) {
            player = m[1];
        } else {
            player = user;
        }

        getAverageTimes('Discord', channel, player, user);
    } else if (message.match(/^!racelist\b/)) {
        let m = message.match(/^!racelist (.+)/);
        let player;
        if (m) {
            player = m[1];
        } else {
            player = user;
        }

        getAverageTimes('Discord', channel, player, user, true);
    } else if (message === '!leaderboard') {
        getLeaderboard('Discord', channel, user);
    } else if (message === '!mostraces') {
        getMostRaces('Discord', channel, user);
    } else if (message.match(/^!roll\b/) || message.match(/^!rand\b/) || message.match(/^!random\b/)) {
        let m = message.match(/^!\w+ (\d+) (\d+)$/);
        let randomMin;
        let randomMax;
        if (m) {
            randomMin = m[1];
            randomMax = m[2];
        } else {
            let m = message.match(/^!\w+ (\d+)$/);
            if (m) {
                randomMin = 1;
                randomMax = m[1];
            } else {
                if (message === '!roll' || message === '!rand' || message === '!random') {
                    randomMin = 1;
                    randomMax = 31;
                } else {
                    // Make it invalid so that they get added to the ignore list
                    randomMin = -1;
                    randomMax = -1;
                }
            }
        }
        getRandomNumber('Discord', channel, user, randomMin, randomMax);
    } else if (message === '!d20') {
        getRandomNumber('Discord', channel, user, 1, 20);
    } else if (message === '!randitem' || message === '!build' || message === '!randbuild') {
        getRandomBuild('Discord', channel, user);
    } else if (message === '!randchar' || message === '!char') {
        getRandomCharacter('Discord', channel, user);
    } else if (message === '!iotr') {
        // Assume they want a random build
        if (instantStartRandomArray.length === 0) {
            refillInstantStartRandomArray();
        }
        let build = instantStartRandomArray.pop();

        // Assume they want a random seed
        let cmd = botDirectory + '/isaac_seed_gen';
        exec(cmd, function(err, stdout, stderr) {
            let seed = stdout.trim();
            let sayString = 'Build: ' + build + '\n';
            sayString += 'Seed: ' + seed;
            DiscordBot.sendMessage({ to: channel, message: sayString });
        });
    }
});

// Automatically reconnect if the bot disconnects due to inactivity
DiscordBot.on('disconnect', function(erMsg, code) {
    warning('DISCORD WARNING: Disconnected with code ' + code + ' for reason ' + erMsg + '. Attempting to reconnect...');
    DiscordBot.connect();
});
