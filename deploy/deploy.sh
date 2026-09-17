#!/bin/bash
# Rebuild and redeploy Minerva to production.
#
# Usage: ./deploy/deploy.sh
#
# Resets /home/anufaroot/deploy/minerva-prod to match main on origin,
# rebuilds everything, migrates, and reloads php-fpm. Run from anywhere —
# it cd's to the right directory itself.
set -euo pipefail

DIR="/home/anufaroot/deploy/minerva-prod"
cd "$DIR"

echo "==> Deploying minerva-prod (main)"

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

echo "==> Deployed minerva-prod at $(git rev-parse --short HEAD)"
