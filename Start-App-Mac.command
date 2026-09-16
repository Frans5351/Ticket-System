#!/bin/bash
# Park Manor Ticket System — one-click local launcher for macOS.
# Double-click this file in Finder to start the app and open it in your browser.
# Keep the Terminal window that opens; closing it stops the server.

# cd into the folder this script lives in (so it works wherever you put it,
# as long as it sits next to server.py and the public/ folder).
cd "$(dirname "$0")"

# Prefer python3 (built into macOS). Fall back to python if needed.
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python isn't installed. Install it from https://www.python.org/downloads/ and try again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

echo "Starting the Park Manor Ticket System..."
echo "Your browser will open in a moment. Keep this window open while you use the app."
echo "Close this window (or press Ctrl+C) to stop."
echo ""

# Open the browser using Python's webbrowser module — the same reliable method
# the Growth Almanac uses. server.py doesn't open the browser itself, so we do
# it here, a moment after the server has had time to start.
( sleep 2 && "$PY" -c "import webbrowser; webbrowser.open('http://localhost:8080')" >/dev/null 2>&1 ) &

# server.py serves the public/ folder, proxies Supabase, and handles attachments.
"$PY" server.py
