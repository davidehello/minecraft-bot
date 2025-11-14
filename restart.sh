#!/bin/bash
# Auto-restart script for the bot

echo "================================="
echo "MINECRAFT BOT AUTO-RESTART SCRIPT"
echo "================================="
echo ""

while true
do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Minecraft Bot..."
    node index.js
    EXIT_CODE=$?
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Bot exited with code: $EXIT_CODE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting in 10 seconds..."
    sleep 10
done