#!/usr/bin/env bash
# =================================================================
# TON Mass Wallet Studio — Stop Server
# =================================================================
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=5173

echo "Stopping TON Mass Wallet Studio server..."

if [ -f "$DIR/logs/server.pid" ]; then
    PID=$(cat "$DIR/logs/server.pid")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null || true
        rm -f "$DIR/logs/server.pid"
        echo "Stopped process $PID."
    fi
fi

# Also kill any node process running server.js in this directory
pkill -f "node $DIR/server.js" 2>/dev/null || true

if command -v notify-send &>/dev/null; then
    notify-send -i "$DIR/icon.png" "TON Mass Wallet Studio" "Server stopped successfully." --expire-time=2000
fi
echo "TON Mass Wallet Studio stopped."
