#!/usr/bin/env bash
# Start graphify in --watch mode for continuous incremental updates.
# Run in a background terminal/tmux session:
#   tmux new -s graphify-watch -d './graphify-watch.sh'
#
# To stop:
#   tmux kill-session -t graphify-watch

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRAPHIFY_BIN="$(which graphify)"
LOG_FILE="$PROJECT_DIR/graphify-out/watch.log"

mkdir -p "$PROJECT_DIR/graphify-out"

echo "[$(date -Iseconds)] Starting graphify --watch for $PROJECT_DIR" >> "$LOG_FILE"
echo "Logging to $LOG_FILE"

# Watch the project root. graphify --update will be triggered on code changes.
# For doc-only changes, stop this process and run: graphify . --mode deep
cd "$PROJECT_DIR"
exec "$GRAPHIFY_BIN" . --watch >> "$LOG_FILE" 2>&1
