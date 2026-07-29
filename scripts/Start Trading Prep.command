#!/bin/bash
# Double-click this file to update, start, and open the Trading Prep dashboard.
set -e

PROJECT_DIR="$HOME/Project-1"
cd "$PROJECT_DIR"

echo "Checking for updates..."
git fetch origin claude/nextjs-trading-prep-build-2j3pfe
git checkout claude/nextjs-trading-prep-build-2j3pfe
git merge --ff-only origin/claude/nextjs-trading-prep-build-2j3pfe || {
  echo "Could not fast-forward to the latest version (you may have local edits)."
  echo "Continuing with whatever code is currently on disk."
}

echo "Installing dependencies..."
npm install

# Free up port 3000 if a previous run's server is still hanging around.
EXISTING_PID=$(lsof -ti:3000 -sTCP:LISTEN || true)
if [ -n "$EXISTING_PID" ]; then
  echo "Stopping a previous server still running on port 3000..."
  kill "$EXISTING_PID" 2>/dev/null || true
  sleep 1
fi

npm run dev &
DEV_PID=$!

echo "Waiting for the dev server to start..."
until curl -sf http://localhost:3000 > /dev/null 2>&1; do
  sleep 1
done

open http://localhost:3000

echo ""
echo "Trading Prep is running at http://localhost:3000"
echo "Close this window (or press Ctrl+C) to stop the server."
wait $DEV_PID
