#!/bin/bash
echo "================================"
echo "  Park Manor - Local Dev Server"
echo "================================"
echo ""

# Create attachments folder if missing
if [ ! -d "public/park_manor_attachments" ]; then
    mkdir -p "public/park_manor_attachments"
    echo "[OK] Created attachments folder"
fi

# Check Python
if command -v python3 &>/dev/null; then
    PY=python3
elif command -v python &>/dev/null; then
    PY=python
else
    echo "[ERROR] Python not found. Install from https://python.org"
    exit 1
fi

PORT=8080
echo "[OK] Starting server on http://localhost:$PORT"
echo "[OK] Press Ctrl+C to stop"
echo ""

# Open browser after 1 second
(sleep 1 && open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null) &

cd public && $PY -m http.server $PORT
