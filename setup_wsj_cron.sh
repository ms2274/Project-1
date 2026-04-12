#!/bin/bash
# Adds a cron job to send the WSJ digest every weekday morning at 6:30 AM.
# Runs Mon–Fri only (skip weekends when markets/news are quieter).
# Run once to install: bash setup_wsj_cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$(which python3)"

# Prefer the venv python if a virtualenv exists in this directory
if [ -f "$SCRIPT_DIR/venv/bin/python" ]; then
    PYTHON="$SCRIPT_DIR/venv/bin/python"
fi

# 6:30 AM Mon–Fri  (change the time here if you want a different schedule)
CRON_JOB="30 6 * * 1-5 cd $SCRIPT_DIR && $PYTHON $SCRIPT_DIR/wsj_digest.py >> $SCRIPT_DIR/wsj_digest.log 2>&1"

if crontab -l 2>/dev/null | grep -qF "wsj_digest.py"; then
    echo "Cron job already exists. No changes made."
    echo ""
    echo "Current crontab:"
    crontab -l
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job added — WSJ digest will run weekdays at 6:30 AM."
    echo ""
    echo "Current crontab:"
    crontab -l
fi

echo ""
echo "To run the digest right now for a test:"
echo "  $PYTHON $SCRIPT_DIR/wsj_digest.py"
echo ""
echo "Log file: $SCRIPT_DIR/wsj_digest.log"
