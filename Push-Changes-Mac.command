#!/bin/bash
# Park Manor Ticket System — PUSH your changes to GitHub (macOS).
# After changing files in this folder, double-click this to
# stage, commit, and push everything up. Netlify then auto-deploys.
cd "$(dirname "$0")"

echo "===================================================="
echo "  Park Manor Ticket System — Pushing changes to GitHub"
echo "===================================================="
echo ""

# Show what changed, so you can see it before it goes up.
git status --short
echo ""

# Bail out politely if there's nothing to push.
if [ -z "$(git status --porcelain)" ]; then
  echo "  Nothing has changed — nothing to push."
  echo ""
  read -n 1 -s -r -p "Press any key to close this window..."
  exit 0
fi

# Ask for a short message describing the change (optional).
read -p "  Short description of this change (or just press Enter): " MSG
if [ -z "$MSG" ]; then
  MSG="Update $(date '+%Y-%m-%d %H:%M')"
fi

echo ""
git add .
git commit -m "$MSG"
git push
STATUS=$?

echo ""
if [ $STATUS -eq 0 ]; then
  echo "  Pushed. Netlify will redeploy in about a minute."
else
  echo "  Push failed (see the message above)."
  echo "  If it mentions authentication, your token may have expired —"
  echo "  ask Claude. If it mentions 'rejected', run Pull-Latest-Mac first."
fi
echo ""
read -n 1 -s -r -p "Press any key to close this window..."
