#!/bin/bash

# Exit on errors
set -e

# Restart the pm2 service
pm2 restart zamiel-bot
