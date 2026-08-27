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

echo ""
echo "=================================================="
echo "Freeing up port 3000..."
echo "=================================================="
# Kill anything on port 3000, however many processes, escalating to force-kill.
# A leftover process here is the single most common cause of "Safari can't
# connect" or the page silently pointing at the wrong port.
for round in 1 2 3; do
  PIDS=$(lsof -ti:3000 -sTCP:LISTEN 2>/dev/null || true)
  if [ -z "$PIDS" ]; then
    break
  fi
  echo "Stopping process(es) on port 3000: $PIDS (attempt $round)"
  if [ "$round" -lt 3 ]; then
    kill $PIDS 2>/dev/null || true
  else
    kill -9 $PIDS 2>/dev/null || true
  fi
  sleep 1
done

if lsof -ti:3000 -sTCP:LISTEN > /dev/null 2>&1; then
  echo ""
  echo "############################################################"
  echo "# COULD NOT FREE PORT 3000 - something refuses to stop.    #"
  echo "# Tell Claude this happened and paste everything above.    #"
  echo "############################################################"
  read -p "Press Enter to close..."
  exit 1
fi
echo "Port 3000 is free."
echo ""

# Force the exact port so a still-occupied port fails loudly instead of
# Next.js silently switching to 3001+ while this script keeps opening 3000.
npm run dev -- -p 3000 &
DEV_PID=$!

echo "Waiting for the dev server to start..."
COUNT=0
until curl -sf http://localhost:3000 > /dev/null 2>&1; do
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo ""
    echo "############################################################"
    echo "# THE SERVER PROCESS CRASHED before it finished starting.  #"
    echo "# Tell Claude this happened and paste everything above.    #"
    echo "############################################################"
    read -p "Press Enter to close..."
    exit 1
  fi
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
