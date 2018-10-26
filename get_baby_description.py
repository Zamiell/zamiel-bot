#!/usr/bin/env python

# Imports
import sys
import re

# Constants
babies_file = '/root/zamiel-bot/single-player-coop-babies/src/SPCGlobals.lua'

# Validate command-line arguments
if len(sys.argv) != 2:
    print('usage: get_baby_description.py [baby number]')
    sys.exit(1)
baby_number = sys.argv[1]
if not baby_number.isdigit():
    print('the provided number is not a number')
    sys.exit(1)
baby_number = int(baby_number)
if baby_number < 1:
    print('the provided number is invalid')
    sys.exit(1)

# Read the file
with open(babies_file, 'r') as f:
    file_contents = f.readlines()

# Make an array with details about every baby
babies = []
for i in xrange(len(file_contents)):
    line = file_contents[i]
    match = re.search(r'name = "(.+)",', line)
    if match:
        babies.append({
            "line": i,
            "name": match.group(1),
        })

# Add the description
for baby in babies:
    line = file_contents[baby["line"] + 1]
    match = re.search(r'description = "(.+)",', line)
    if not match:
        print('failed to parse the description for ' + baby["name"] + ' on line: ' + str(baby["line"]))
        sys.exit(1)
    baby["description"] = match.group(1)

# Format the output
baby = babies[baby_number - 1]
print("#" + str(baby_number) + " - " + baby["name"] + " - " + baby["description"])
