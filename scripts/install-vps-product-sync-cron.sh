#!/usr/bin/env bash
# Install / refresh the 15-minute Voyage Fiesta product sync (ubuntu crontab).
# Leaves labranche / leanne / other jobs untouched.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$APP_DIR/logs"
mkdir -p "$LOG_DIR"
chmod +x "$APP_DIR/scripts/run-vps-product-sync.sh"

CRON="*/15 * * * * TZ=America/Montreal cd $APP_DIR && $APP_DIR/scripts/run-vps-product-sync.sh >> $LOG_DIR/sync.log 2>&1"

( crontab -l 2>/dev/null | grep -v "voyage-fiesta-sync" || true
  echo "$CRON"
) | crontab -

echo "Installed Voyage Fiesta product sync (every 15 min, America/Montreal):"
crontab -l | grep voyage-fiesta-sync
echo "Log: $LOG_DIR/sync.log"
