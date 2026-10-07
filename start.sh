#!/usr/bin/env bash
# =================================================================
# TON Mass Wallet Studio — Production App Launcher (Linux)
# =================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

mkdir -p "$DIR/logs"

# 1. Resolve Node.js binary (supporting NVM and system PATH)
NODE_BIN=""
if [ -n "$NODE_PATH" ] && [ -x "$NODE_PATH/node" ]; then
    NODE_BIN="$NODE_PATH/node"
elif command -v node &>/dev/null; then
    NODE_BIN="$(command -v node)"
elif [ -x "/home/$USER/.nvm/versions/node/v22.22.1/bin/node" ]; then
    NODE_BIN="/home/$USER/.nvm/versions/node/v22.22.1/bin/node"
elif [ -d "/home/$USER/.nvm/versions/node" ]; then
    LATEST_NVM_NODE="$(ls -d /home/$USER/.nvm/versions/node/v* 2>/dev/null | sort -V | tail -n 1)/bin/node"
    if [ -x "$LATEST_NVM_NODE" ]; then
        NODE_BIN="$LATEST_NVM_NODE"
    fi
elif [ -x "/usr/bin/node" ]; then
    NODE_BIN="/usr/bin/node"
elif [ -x "/usr/local/bin/node" ]; then
    NODE_BIN="/usr/local/bin/node"
fi

if [ -z "$NODE_BIN" ]; then
    if command -v notify-send &>/dev/null; then
        notify-send -u critical -i "$DIR/icon.png" "TON Mass Wallet Studio" "Error: Node.js runtime not found in PATH."
    fi
    echo "Error: Node.js not found." >&2
    exit 1
fi

# 2. Server Configuration
PORT=5173
URL="http://localhost:${PORT}"
ICON_PATH="$DIR/icon.png"

is_running() {
    curl -s --connect-timeout 1 "$URL/api/health" 2>/dev/null | grep -q "TON Mass Wallet Studio"
}

# 3. Start server if not already running
if ! is_running; then
    if command -v notify-send &>/dev/null; then
        notify-send -i "$ICON_PATH" "TON Mass Wallet Studio" "Starting production server..." --expire-time=2500
    fi

    # Launch background server
    nohup "$NODE_BIN" "$DIR/server.js" --port "$PORT" < /dev/null >> "$DIR/logs/server.log" 2>&1 &
    SERVER_PID=$!
    disown $SERVER_PID 2>/dev/null || true
    echo "$SERVER_PID" > "$DIR/logs/server.pid"

    # Wait for server readiness (up to 6 seconds)
    READY=0
    for i in {1..20}; do
        if is_running; then
            READY=1
            break
        fi
        sleep 0.3
    done

    if [ $READY -eq 0 ]; then
        if command -v notify-send &>/dev/null; then
            notify-send -u critical -i "$ICON_PATH" "TON Mass Wallet Studio" "Failed to start server. Check logs/server.log"
        fi
        exit 1
    fi
fi

# 4. Notify user
if command -v notify-send &>/dev/null; then
    notify-send -i "$ICON_PATH" "TON Mass Wallet Studio" "Opening Application..." --expire-time=3000
fi

# 5. Launch dedicated native App Window (Chrome / Chromium App Mode or default browser)
if command -v google-chrome &>/dev/null; then
    google-chrome --app="$URL" --user-data-dir="/tmp/ton-mass-wallet-chrome" >/dev/null 2>&1 &
elif command -v chromium &>/dev/null; then
    chromium --app="$URL" --user-data-dir="/tmp/ton-mass-wallet-chromium" >/dev/null 2>&1 &
elif command -v chromium-browser &>/dev/null; then
    chromium-browser --app="$URL" >/dev/null 2>&1 &
elif command -v xdg-open &>/dev/null; then
    xdg-open "$URL" >/dev/null 2>&1 &
elif command -v firefox &>/dev/null; then
    firefox "$URL" >/dev/null 2>&1 &
elif command -v python3 &>/dev/null; then
    python3 -m webbrowser "$URL" >/dev/null 2>&1 &
fi

exit 0
