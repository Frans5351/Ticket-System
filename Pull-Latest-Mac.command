#!/bin/bash
# Park Manor Ticket System — PULL latest changes from GitHub (macOS).
# Double-click to download the newest committed code into this folder.
cd "$(dirname "$0")"

echo "===================================================="
echo "  Park Manor Ticket System — Pulling latest from GitHub"
echo "===================================================="
echo ""

git pull
STATUS=$?

echo ""
if [ $STATUS -eq 0 ]; then
  echo "  Done. Your folder is up to date."
else
  echo "  Something went wrong (see the message above)."
  echo "  If it mentions a conflict or local changes, don't worry —"
  echo "  ask Claude and paste the message."
fi
echo ""
read -n 1 -s -r -p "Press any key to close this window..."
