#!/usr/bin/env python3
"""Park Manor - start the local server AND open the browser reliably.

The browser is opened from this long-lived process (via a background timer),
which is the method proven to work on this Mac. A short-lived opener process
can be killed by macOS before the browser finishes launching, which is why the
page didn't pop up before.
"""
import os
import sys
import subprocess
import threading
import webbrowser

URL = "http://localhost:8080"

# Work from the folder this file lives in (next to server.py and public/).
os.chdir(os.path.dirname(os.path.abspath(__file__)))


def open_browser():
    try:
        webbrowser.open(URL)
    except Exception:
        pass


# Open the browser ~2 seconds after we start, giving server.py time to bind
# the port. This runs on a timer thread while the server runs below, so this
# process stays alive long enough for the browser to actually come up.
threading.Timer(2.0, open_browser).start()

# Run the app's own server exactly as if launched directly. This blocks until
# you stop it (close the Terminal window or press Ctrl+C).
try:
    subprocess.call([sys.executable, "server.py"])
except KeyboardInterrupt:
    pass
