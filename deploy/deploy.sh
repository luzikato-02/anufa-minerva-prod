#!/usr/bin/env bash
#
# Build the app from the current git HEAD and FTP-upload it to cPanel, or
# trigger the post-deploy finalize step.
#
# Usage:
#   deploy/deploy.sh <production|development> upload
#   deploy/deploy.sh <production|development> finalize
#
# Requires deploy/<environment>.env (copy from deploy/<environment>.env.example).

set -euo pipefail

usage() {
  echo "Usage: $(basename "$0") <production|development> <upload|finalize>" >&2
  echo "  upload   - build the app from git HEAD and FTP-upload app.zip / build.zip" >&2
  echo "  finalize - call POST /deploy/finalize on the server" >&2
  exit 1
}

[[ $# -eq 2 ]] || usage
ENVIRONMENT=$1
ACTION=$2

case "$ENVIRONMENT" in production|development) ;; *) usage ;; esac
case "$ACTION" in upload|finalize) ;; *) usage ;; esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/deploy/$ENVIRONMENT.env"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE - copy deploy/$ENVIRONMENT.env.example and fill in the values." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

upload() {
  for var in CPANEL_HOST CPANEL_USERNAME CPANEL_PASSWORD CPANEL_SUBDOMAIN_PATH CPANEL_DOCROOT_PATH; do
    [[ -n "${!var:-}" ]] || { echo "Missing $var in $CONFIG_FILE" >&2; exit 1; }
  done

  build_dir=$(mktemp -d)
  trap 'rm -rf "$build_dir"' EXIT

  echo "==> Exporting committed tree (git HEAD) to $build_dir"
  echo "    (uncommitted changes are NOT included - commit first)"
  git -C "$ROOT_DIR" archive HEAD | tar -x -C "$build_dir"

  echo "==> Installing PHP dependencies (--no-dev)"
  (cd "$build_dir" && composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction)

  echo "==> Installing Node dependencies"
  (cd "$build_dir" && npm ci)

  echo "==> Building frontend assets"
  (cd "$build_dir" && npm run build)

  echo "==> Creating archives"
  # public/build is included in app.zip (Laravel's Vite helper reads
  # public/build/manifest.json from the app directory) AND in build.zip
  # (served as static assets from the docroot).
  (cd "$build_dir" && zip -rq app.zip . -x '.git/*' '.github/*' 'node_modules/*' 'tests/*' '.env' '*.zip')
  (cd "$build_dir/public" && zip -rq ../build.zip build)

  echo "==> Uploading app.zip to $CPANEL_SUBDOMAIN_PATH/app.zip"
  curl -sS -T "$build_dir/app.zip" --ftp-create-dirs \
    "ftp://$CPANEL_HOST/$CPANEL_SUBDOMAIN_PATH/app.zip" \
    --user "$CPANEL_USERNAME:$CPANEL_PASSWORD"

  echo "==> Uploading build.zip to $CPANEL_DOCROOT_PATH/build.zip"
  curl -sS -T "$build_dir/build.zip" --ftp-create-dirs \
    "ftp://$CPANEL_HOST/$CPANEL_DOCROOT_PATH/build.zip" \
    --user "$CPANEL_USERNAME:$CPANEL_PASSWORD"

  echo
  echo "==> Uploaded. Next steps:"
  echo "    1. In cPanel File Manager, extract app.zip inside $CPANEL_SUBDOMAIN_PATH/"
  echo "    2. Extract build.zip inside $CPANEL_DOCROOT_PATH/ (replaces public/build)"
  echo "    3. Delete both zip files"
  echo "    4. Run: $(basename "$0") $ENVIRONMENT finalize"
}

finalize() {
  for var in APP_URL DEPLOY_TOKEN; do
    [[ -n "${!var:-}" ]] || { echo "Missing $var in $CONFIG_FILE" >&2; exit 1; }
  done

  echo "==> Finalizing deploy at $APP_URL"
  curl --fail-with-body -sS -X POST "$APP_URL/deploy/finalize" \
    -H "Authorization: Bearer $DEPLOY_TOKEN"
  echo
}

case "$ACTION" in
  upload) upload ;;
  finalize) finalize ;;
esac
