#!/usr/bin/env bash
#
# Deploy the app from git on the server itself, using cPanel terminal access.
# Run this ON THE SERVER (paste into cPanel > Terminal, or over SSH) from
# inside the app checkout ($APP_DIR below).
#
# One-time setup (first deploy only):
#   1. git clone <repo-url> ~/anufa-minerva      # or wherever APP_DIR points
#   2. cd ~/anufa-minerva
#   3. cp deploy/production.env.example deploy/production.env
#      (or development.env.example / development.env) and fill in the values
#   4. cp .env.production.example .env and fill in the values
#   5. php artisan key:generate
#   6. In cPanel > Domains, make sure the subdomain's document root points at
#      $DOCROOT_DIR (kept separate from the app checkout, so app code and
#      .env are never web-accessible).
#
# Every deploy after that:
#   deploy/deploy.sh <production|development> deploy
#
# Requires deploy/<environment>.env (copy from deploy/<environment>.env.example).

set -euo pipefail

usage() {
  echo "Usage: $(basename "$0") <production|development> deploy" >&2
  exit 1
}

[[ $# -eq 2 ]] || usage
ENVIRONMENT=$1
ACTION=$2

case "$ENVIRONMENT" in production|development) ;; *) usage ;; esac
case "$ACTION" in deploy) ;; *) usage ;; esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/deploy/$ENVIRONMENT.env"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE - copy deploy/$ENVIRONMENT.env.example and fill in the values." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

deploy() {
  for var in APP_DIR DOCROOT_DIR GIT_BRANCH; do
    [[ -n "${!var:-}" ]] || { echo "Missing $var in $CONFIG_FILE" >&2; exit 1; }
  done

  if [[ "$ROOT_DIR" != "$APP_DIR" ]]; then
    echo "This script must be run from inside APP_DIR ($APP_DIR), not $ROOT_DIR." >&2
    exit 1
  fi

  echo "==> Pulling latest $GIT_BRANCH"
  git fetch origin "$GIT_BRANCH"
  git merge --ff-only "origin/$GIT_BRANCH"

  echo "==> Installing PHP dependencies (--no-dev)"
  composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction

  echo "==> Installing Node dependencies"
  npm ci

  echo "==> Building frontend assets"
  npm run build

  echo "==> Syncing public/ into docroot ($DOCROOT_DIR)"
  # App checkout and docroot are separate directories, so public/ is synced
  # rather than served directly - keeps app code and .env out of the webroot.
  mkdir -p "$DOCROOT_DIR"
  rsync -a --delete "$APP_DIR/public/" "$DOCROOT_DIR/"

  # Patch the copy in DOCROOT_DIR only (never the tracked file in APP_DIR):
  # docroot and app dir are siblings, so __DIR__/../ in index.php points to
  # the wrong place from inside DOCROOT_DIR.
  APP_DIR_NAME="$(basename "$APP_DIR")"
  sed -i "s|__DIR__\.'/../|__DIR__\.'/../$APP_DIR_NAME/|g" "$DOCROOT_DIR/index.php"

  echo "==> Running migrations, seeding, and cache warmup"
  php artisan deploy:finalize

  echo
  echo "==> Deploy complete."
}

case "$ACTION" in
  deploy) deploy ;;
esac
