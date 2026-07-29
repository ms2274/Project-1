#!/bin/bash
# Double-click this file to update, start, and open the Trading Prep dashboard.

PROJECT_DIR="$HOME/Project-1"
cd "$PROJECT_DIR" || { echo "ERROR: could not find $PROJECT_DIR"; read -p "Press Enter to close..."; exit 1; }

echo "=================================================="
echo "Checking for updates..."
echo "=================================================="

BRANCH="claude/nextjs-trading-prep-build-2j3pfe"
UPDATE_OK=true

git fetch origin "$BRANCH" || UPDATE_OK=false
git checkout "$BRANCH" || UPDATE_OK=false
if [ "$UPDATE_OK" = true ]; then
  git merge --ff-only "origin/$BRANCH" || UPDATE_OK=false
fi

if [ "$UPDATE_OK" = false ]; then
  echo ""
  echo "############################################################"
  echo "# UPDATE FAILED - you are running OLD code, not the latest #"
  echo "# Tell Claude this happened and paste everything above.    #"
  echo "############################################################"
  echo ""
else
  echo "Up to date."
fi

echo "Current version: $(git log -1 --format='%h %ci %s')"
echo ""

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
COUNT=0
until curl -sf http://localhost:3000 > /dev/null 2>&1; do
  sleep 1
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -gt 60 ]; then
    echo ""
    echo "############################################################"
    echo "# SERVER NEVER STARTED after 60 seconds.                   #"
    echo "# Tell Claude this happened and paste everything above.    #"
    echo "############################################################"
    read -p "Press Enter to close..."
    exit 1
  fi
done

open http://localhost:3000

echo ""
echo "Trading Prep is running at http://localhost:3000"
echo "Close this window (or press Ctrl+C) to stop the server."
wait $DEV_PID
