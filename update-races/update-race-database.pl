#!/usr/bin/perl

# Configuration
use constant DB_HOST        => "127.0.0.1:27017";
use constant DB_NAME        => "isaac";
use constant DB_COLLECTION  => "races";
use constant DIRECTORY_PATH => "/root/zamiel-bot/update-races";
use constant NEW_JSON_FILE  => "new-races.json";

# Imports
use strict;
use warnings;
use MongoDB;
use Tie::File;
use File::Slurp;
use JSON;
use DateTime;

# Welcome
print "Updating the races collection on \"" . DB_HOST . "\"...\n";

# Find out the most recent race that is in the database
my $client = MongoDB::MongoClient->new(host => "mongodb://" . DB_HOST . "/" . DB_NAME);
my $db = $client->get_database(DB_NAME);
my $races = $db->get_collection(DB_COLLECTION);
my $allRaces = $races->find;
my $mostRecentRaceID = 0;
my $mostRecentRaceDate = 0;
while (my $race = $allRaces->next) {
	if ($race->{'date'} > $mostRecentRaceDate) {
		$mostRecentRaceDate = $race->{'date'};
		$mostRecentRaceID = $race->{'id'};
	}
}
my $date = DateTime->from_epoch(epoch => $mostRecentRaceDate);
print "The most recent race is $mostRecentRaceID (on " . $date->month_name . " " . $date->day . ", " . $date->year . ").\n";

# Query the SRL API for the list of races
my $directoryPath = DIRECTORY_PATH;
my $newJsonFile = NEW_JSON_FILE;
if (-e "$directoryPath/$newJsonFile") {
	system "rm -f '$directoryPath/$newJsonFile'"; # Remove it if it already exists
}
if (system "wget --no-verbose -O '$directoryPath/$newJsonFile' 'http://api.speedrunslive.com/pastraces?game=isaacafterbirth&pageSize=64'") {
	die "wget failed. Exiting...\n";
}

# Truncate races that we already have
tie my @json, 'Tie::File', "$directoryPath/$newJsonFile" or die "Failed to open \"$directoryPath/$newJsonFile\". Exiting...\n";
my $i = 0;
my $foundLastRace;
for (@json) {
	if (/"id" : "$mostRecentRaceID",/) { # Stop when we reach races that we already have in the database
		$foundLastRace = 1;
		last;
	}
	$i++;
}

# If there was an Internet outage or something, we may not have gotten the full list of interim races, so exit before doing anything
if (!$foundLastRace) {
	die "I was not able to find the last race in the downloaded JSON from the SRL API. Was there an Internet outage or something? Exiting...\n";
}

# Format it as a JSON array of objects so that mongoimport will suck it in with the "--jsonArray" flag
splice(@json, $i - 1); # Truncate the array
push(@json, "}"); # Add a "}" at the end
shift(@json) for (1..5); # Remove the first 5 lines
unshift(@json, "["); # Add a "[" at the beginning
push(@json, "]"); # Add a "]" at the end
untie @json;

# Exit if there are no new races
if (`cat '$directoryPath/$newJsonFile' | wc -l` =~ /^3$/) {
	print "No new races!\n";
	exit;
}

# Import the new races
system "mongoimport --host '" . DB_HOST . "' --db '" . DB_NAME . "' --collection '" . DB_COLLECTION . "' '$directoryPath/$newJsonFile' --jsonArray";
