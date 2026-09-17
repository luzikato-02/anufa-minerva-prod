#!/bin/bash
# Rebuild and redeploy Minerva to prod or dev.
#
# Usage: ./deploy/deploy.sh <prod|dev>
#
# There's no local dev server for this app — minerva-dev is where changes
# get tested (deploy there first, verify on minerva-dev.anufa.my.id, then
# deploy the same commit to prod). Both environments deploy from main.
#
# Resets the target's live checkout to match main on origin, rebuilds
# everything, migrates, and reloads php-fpm. Run from anywhere — it cd's to
# the right directory itself.
set -euo pipefail

ENV="${1:-}"
case "$ENV" in
    prod|dev) ;;
    *) echo "Usage: $0 <prod|dev>" >&2; exit 1 ;;
esac

DIR="/home/anufaroot/deploy/minerva-$ENV"
cd "$DIR"

echo "==> Deploying minerva-$ENV (main)"

git fetch origin main
git reset --hard origin/main

echo "==> composer install"
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction

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
