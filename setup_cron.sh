#!/bin/bash
# Adds a cron job to send the weather email every morning at 7:00 AM Eastern.
# Run once: bash setup_cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$(which python3)"

# Use venv python if it exists
if [ -f "$SCRIPT_DIR/venv/bin/python" ]; then
    PYTHON="$SCRIPT_DIR/venv/bin/python"
fi

CRON_JOB="0 7 * * * cd $SCRIPT_DIR && $PYTHON $SCRIPT_DIR/weather_email.py >> $SCRIPT_DIR/weather_email.log 2>&1"

# Check if job already exists
if crontab -l 2>/dev/null | grep -qF "weather_email.py"; then
    echo "Cron job already exists. No changes made."
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job added: runs daily at 7:00 AM"
    echo ""
    echo "Current crontab:"
    crontab -l
fi
