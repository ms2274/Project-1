#!/bin/bash
# Double-click this file to start the Trading Prep dashboard and open it in your browser.
set -e

PROJECT_DIR="$HOME/Project-1"
cd "$PROJECT_DIR"

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only)..."
  npm install
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
