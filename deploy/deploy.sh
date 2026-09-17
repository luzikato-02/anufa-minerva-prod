#!/bin/bash
# Deploy this checkout in place: reset it to the latest commit on origin for
# whichever branch it's currently on, rebuild, migrate, and restart the PHP
# processes that would otherwise keep running old code.
#
# Run this FROM the live deploy directory (/home/anufaroot/deploy/minerva-prod
# or minerva-dev on this VPS) — it hard-resets that directory to match
# origin, discarding any local changes made directly there. To ship a
# change: commit + push from a dev checkout, then run this here.
#
# Usage: ./deploy/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

BRANCH=$(git rev-parse --abbrev-ref HEAD)
DIRNAME=$(basename "$PWD")   # minerva-prod / minerva-dev
ENV_NAME=${DIRNAME#minerva-} # prod / dev — matches the php-fpm pool name
                              # and the minerva-queue@<env> systemd instance

echo "==> Deploying $DIRNAME ($BRANCH)"

if [[ -n "$(git status --porcelain)" ]]; then
    echo "==> WARNING: local changes in $PWD will be discarded:"
    git status --short
fi

echo "==> git fetch + reset --hard origin/$BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> composer install --no-dev"
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction

echo "==> npm ci && npm run build"
npm ci
npm run build

echo "==> php artisan deploy:finalize (migrate, seed roles, admin bootstrap, storage:link, cache warmup)"
php artisan deploy:finalize

# opcache.validate_timestamps is on (2s revalidate_freq) so FPM workers pick
# up changed files on their own shortly after anyway — this just makes it
# immediate. Reloading php8.3-fpm.service reloads every pool under it (both
# minerva-prod and minerva-dev), which is harmless: graceful, no dropped
# connections, and pools are otherwise independent.
echo "==> Reloading php-fpm"
sudo systemctl reload php8.3-fpm

# queue:work keeps one PHP process warm across jobs, so — unlike php-fpm —
# it does NOT pick up new code on its own. Must restart explicitly, or a
# deploy that touches queued-job code silently keeps running the old version
# until the process happens to cycle.
echo "==> Restarting queue worker (minerva-queue@$ENV_NAME)"
sudo systemctl restart "minerva-queue@$ENV_NAME"

APP_URL=$(grep -m1 '^APP_URL=' .env | cut -d= -f2-)
if [[ -n "${APP_URL:-}" ]]; then
    echo "==> Smoke test: $APP_URL"
    CODE=$(curl -sk -o /dev/null -w '%{http_code}' -L "$APP_URL/" || echo "000")
    if [[ "$CODE" == "200" || "$CODE" == "302" ]]; then
        echo "==> OK: site responded $CODE"
    else
        echo "==> WARNING: site responded $CODE — check storage/logs/laravel.log and storage/logs/fpm-error.log"
        exit 1
    fi
fi

echo "==> Deployed $DIRNAME at $(git rev-parse --short HEAD)"
