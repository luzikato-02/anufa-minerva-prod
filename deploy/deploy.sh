#!/bin/bash
# Rebuild and redeploy Minerva to prod or dev.
#
# Usage: ./deploy/deploy.sh <prod|dev>
#
# There's no local dev server for this app — minerva-dev is where changes
# get tested: push to develop, deploy dev, verify on minerva-dev.anufa.my.id,
# merge develop into main, then deploy prod.
#
# Resets the target's live checkout to match its branch on origin, rebuilds
# everything, migrates, and reloads php-fpm. Run from anywhere — it cd's to
# the right directory itself.
set -euo pipefail

ENV="${1:-}"
case "$ENV" in
    prod) BRANCH=main ;;
    dev)  BRANCH=develop ;;
    *)    echo "Usage: $0 <prod|dev>" >&2; exit 1 ;;
esac

DIR="/home/anufaroot/deploy/minerva-$ENV"
cd "$DIR"

echo "==> Deploying minerva-$ENV ($BRANCH)"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> composer install"
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction

# The build generates route helpers from the app's routes, so a stale route cache from the previous
# deploy would leave new routes out and fail the build.
echo "==> clearing cached routes and config"
php artisan optimize:clear

echo "==> npm ci && npm run build"
npm ci
npm run build

echo "==> migrate, storage:link, optimize"
php artisan migrate --force
php artisan storage:link --relative
php artisan optimize

echo "==> Reloading php-fpm"
sudo systemctl reload php8.3-fpm

echo "==> Deployed minerva-$ENV at $(git rev-parse --short HEAD)"
