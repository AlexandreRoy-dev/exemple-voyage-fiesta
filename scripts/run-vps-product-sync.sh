#!/usr/bin/env bash
# Voyage Fiesta — GHL voyages → products.json → git push (GitHub Pages).
# Runs on the DuProprio OVH VPS every 15 minutes. Wrapper lives outside the clone
# so `git reset --hard` cannot delete this script.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$APP_DIR/repo"
ENV_FILE="$APP_DIR/.env"
LOG_PREFIX="$(date -Is)"
SSH_KEY="${SYNC_SSH_KEY:-$HOME/.ssh/voyage-fiesta-sync}"

mkdir -p "$APP_DIR/logs"
exec 9>"$APP_DIR/logs/sync.lock"
if ! flock -n 9; then
  echo "$LOG_PREFIX skip: already running"
  exit 0
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$LOG_PREFIX missing $ENV_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

: "${GHL_API_KEY:?GHL_API_KEY missing in .env}"
: "${GHL_LOCATION_ID:?GHL_LOCATION_ID missing in .env}"
: "${GHL_OBJECT_SCHEMA_KEY:?GHL_OBJECT_SCHEMA_KEY missing in .env}"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "$LOG_PREFIX missing git clone at $REPO_DIR" >&2
  exit 1
fi

export GIT_SSH_COMMAND="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

cd "$REPO_DIR"

git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main

echo "$LOG_PREFIX syncing from GHL ($GHL_OBJECT_SCHEMA_KEY)..."
node scripts/sync-ghl-products.mjs

node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync("products.json", "utf8"));
  const products = data.products || [];
  if (!Array.isArray(products)) throw new Error("products.json: products is not an array");
  const byState = {};
  for (const p of products) {
    const s = p.state || p.active || "?";
    byState[s] = (byState[s] || 0) + 1;
    if (!p.slug) throw new Error("Product missing slug: " + (p.name || p.id));
  }
  console.log("OK products.json —", products.length, "forfait(s)", JSON.stringify(byState));
  console.log("updatedAt", data.updatedAt || "(none)");
'

paths=()
for p in products.json agents.json assets/forfaits share; do
  if [[ -e "$p" ]]; then
    paths+=("$p")
  fi
done
git add -- "${paths[@]}"

if git diff --staged --quiet; then
  echo "$LOG_PREFIX no changes"
  exit 0
fi

json_changed="$(git diff --staged -- products.json agents.json || true)"
json_real="$(printf '%s\n' "$json_changed" | grep -E '^[+-]' | grep -vE '^[+-]{3} ' | grep -vE '^[+-] *"updatedAt":' || true)"
other_change="$(git diff --staged --name-only | grep -vE '^(products|agents)\.json$' || true)"
if [[ -z "$json_real" && -z "$other_change" ]]; then
  echo "$LOG_PREFIX only updatedAt changed — skip commit"
  git restore --staged --worktree -- products.json agents.json
  exit 0
fi

git -c user.name="voyage-fiesta-vps" -c user.email="sync@voyagefiesta.local" \
  commit -m "chore: sync products from GoHighLevel [skip ci]"

git push origin main
echo "$LOG_PREFIX pushed — GitHub Pages should update in 1-2 minutes"
