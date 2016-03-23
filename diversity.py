#!/usr/bin/env python

# Imports
import sys
import json
from random import seed, shuffle
from binascii import crc32

# Validate command-line arguments
if len(sys.argv) < 2:
    print "You need to provide the seed."
    sys.exit()

# Trim whitespace from the seed
dmseed = sys.argv[1].strip()

# Set the RNG seed
seed(crc32(dmseed))

# "valid_items" is the list of all passive items in the game EXCLUDING the 25 items listed in the readme
valid_items =  [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 17, 18, 19, 20, 21, 27,
    28, 32, 46, 48, 50, 51, 52, 53, 54, 55,
    57, 60, 62, 63, 64, 67, 68, 69, 70, 71,
    72, 73, 74, 75, 76, 79, 80, 81, 82, 87,
    88, 89, 90, 91, 94, 95, 96, 98, 99, 100,
    101, 103, 104, 106, 108, 109, 110, 112, 113, 114,
    115, 116, 117, 118, 120, 121, 122, 125, 128, 129,
    131, 132, 134, 138, 139, 140, 141, 142, 143, 144,
    148, 149, 150, 151, 152, 153, 154, 155, 156, 157,
    159, 161, 162, 163, 165, 167, 168, 169, 170, 172,
    173, 174, 178, 179, 180, 182, 183, 184, 185, 187,
    188, 189, 190, 191, 193, 195, 196, 197, 198, 199,
    200, 201, 202, 203, 204, 205, 206, 207, 208, 209,
    210, 211, 212, 213, 214, 215, 216, 217, 218, 219,
    220, 221, 222, 223, 224, 225, 227, 228, 229, 230,
    231, 232, 233, 234, 236, 237, 240, 241, 242, 243,
    244, 245, 246, 247, 248, 249, 250, 251, 252, 254,
    255, 256, 257, 259, 260, 261, 262, 264, 265, 266,
    267, 268, 269, 270, 271, 272, 273, 274, 275, 276,
    277, 278, 279, 280, 281, 299, 300, 301, 302, 303,
    304, 305, 306, 307, 308, 309, 310, 311, 312, 313,
    314, 315, 316, 317, 318, 319, 320, 321, 322, 327,
    328, 329, 330, 331, 332, 333, 335, 336, 337, 340,
    341, 342, 343, 345, 350, 353, 354, 356, 358, 359,
    360, 361, 362, 363, 364, 365, 366, 367, 368, 369,
    370, 371, 372, 373, 374, 375, 376, 377, 378, 379,
    380, 381, 384, 385, 387, 388, 389, 390, 391, 392,
    393, 394, 395, 397, 398, 399, 400, 401, 402, 403,
    404, 405, 407, 408, 409, 410, 411, 412, 413, 414,
    415, 416, 417, 418, 420, 423, 424, 425, 426, 429,
    430, 431, 432, 433, 435, 436, 438, 440
]

# Random permutation of valid items list
itemIDs = list(valid_items)
shuffle(itemIDs) # Now the 3 items are contained in "itemIDs[0]", "itemIDs[1]", and "itemIDs[2]"

# Open items.json
items_info = {}
with open("items.json", "r") as items_file:
    items_info = json.load(items_file)

# Print them out
string = ''
counter = 0
for randomlyChosenItem in [itemIDs[0], itemIDs[1], itemIDs[2]]:
    for itemid, item in items_info.iteritems():
        if int(randomlyChosenItem) == int(itemid):
            counter += 1
            if counter == 1 or counter == 2:
                string += '[' + item["name"] + '], '
            else:
                string += 'and [' + item["name"] + '].'

print string.rstrip()
