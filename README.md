# Minerva — Manufacturing Operations Management

Minerva is an internal web application built by **Anufa Technologies** to manage day-to-day production floor operations for textile/cable manufacturing. It replaces paper-based recording with a real-time digital system accessible from any device on the factory network.

## Features

| Module | Description |
|---|---|
| **Twisting Tension** | Record and monitor per-spindle tension measurements on twisting machines |
| **Weaving Tension** | Record creel-based tension measurements on weaving machines with session resume support |
| **Stock Taking** | Barcode-driven batch stock verification with CSV upload and session management |
| **Finish Earlier** | Track early-finish events per creel position; import records via scanned forms (OCR) |
| **Creel Visualization** | Interactive 3D creel viewer overlaid with finish-earlier data per production order |
| **Document Intelligence** | Upload scanned PDFs or images — extract text and tables with Mistral OCR |
| **User & Role Management** | RBAC with fine-grained permissions per module (view / create / edit / delete) |
| **Activity Log** | Audit trail of all user actions |

## Tech Stack

- **Backend** — Laravel 11 (PHP 8.2+), SQLite (dev) / MySQL (prod)
- **Frontend** — React 19 + TypeScript + Inertia.js (SSR-ready)
- **UI** — Tailwind CSS v4 + shadcn/ui components
- **Auth** — Laravel Fortify (2FA, password reset) + Sanctum (API tokens)
- **Permissions** — Spatie Laravel Permission
- **OCR / AI** — Mistral AI (`mistral-ocr-latest` + `mistral-small-latest`)
- **Build** — Vite 6

## Project Structure

```
app/
  Http/
    Controllers/
      Api/          # JSON API controllers (tension, stock-take, finish-earlier, creel, users, roles)
      Auth/         # Fortify auth controllers
      Settings/     # Profile, password, 2FA settings
    Middleware/
    Requests/
  Models/           # TensionRecord, StockTakingRecord, FinishEarlierRecord, CreelRecord, User

resources/js/
  components/       # React UI components (feature + shadcn/ui primitives in components/ui/)
  lib/              # Non-UI utilities (localStorage, databaseConnector, csv-export, permissions)
  hooks/            # Custom React hooks
  layouts/          # App and auth layout wrappers
  pages/            # Inertia page components (one per route)
  routes/           # Wayfinder-generated typed route helpers
  types/            # TypeScript type declarations

database/
  migrations/       # All schema migrations in timestamp order
  seeders/          # RolesAndPermissionsSeeder bootstraps RBAC on fresh installs

deploy/             # Deployment scripts and environment templates
```

## Quick Start

```bash
# Install dependencies
composer install
npm install

# Configure environment
cp .env.example .env
php artisan key:generate

# Migrate and seed (creates default roles + admin user)
php artisan migrate --seed

# Start development servers
php artisan serve
npm run dev
```

### Required Environment Variables

```env
APP_NAME=Minerva
APP_ENV=local
APP_URL=http://localhost:8000

DB_CONNECTION=sqlite          # or mysql for production

MISTRAL_API_KEY=              # Required for Document Intelligence and Finish Earlier Scan
```

## Deployment

Deploys run on the cPanel server itself via terminal access - see `deploy/deploy.sh` and the environment templates in `deploy/`.

One-time setup: `git clone` the repo into a directory outside the webroot, copy `.env.production.example` to `.env` and fill in the values, then point the subdomain's document root (cPanel > Domains) at a separate directory that `deploy/deploy.sh` syncs `public/` into.

Every subsequent deploy, from inside the app checkout on the server:

```bash
deploy/deploy.sh production deploy
```

This pulls the branch, installs dependencies, builds frontend assets, syncs `public/` into the docroot, and runs `php artisan deploy:finalize` (migrations, role/permission seeding, admin bootstrap, cache warmup).

### Server prerequisites (composer / node / npm)

Shared cPanel hosting rarely puts these on the default terminal `$PATH`:

- **Node/npm** - use cPanel's **Setup Node.js App** (Software section). Create an app with "Application root" pointing at `APP_DIR`; cPanel then shows an "Enter to the virtual environment" command like `source /home/user/nodevenv/anufa-minerva/20/bin/activate`. Put that path in `deploy/<environment>.env` as `NODE_VENV_ACTIVATE` - `deploy.sh` sources it automatically before installing/building.
- **Composer** - if `composer --version` doesn't already work, install it into your home directory (no root needed):
  ```bash
  cd ~
  curl -sS https://getcomposer.org/installer | php
  mkdir -p ~/bin
  mv composer.phar ~/bin/composer
  chmod +x ~/bin/composer
  ~/bin/composer --version
  ```
  Set `COMPOSER_BIN=/home/youruser/bin/composer` in `deploy/<environment>.env` - `deploy.sh` calls that path directly, so it works whether or not `~/.bashrc` gets sourced by the shell that runs the script.

### Queue worker (required for ML model training)

Shared hosting has no persistent worker process, so `QUEUE_CONNECTION=database` jobs (e.g. `App\Jobs\TrainMlEnergyModel`) sit queued until something drains them. In cPanel > Cron Jobs, add a job that runs every minute:

```bash
php /home/youruser/anufa-minerva/artisan queue:work --stop-when-empty --tries=1 >> /dev/null 2>&1
```

`--stop-when-empty` exits once the queue is drained instead of running forever, which is what makes this safe to trigger repeatedly from cron rather than needing a long-running process.

### proc_open disabled on shared hosting

If `composer install` fails with `The Process class relies on proc_open, which is not available on your PHP installation`, that's Composer's `post-autoload-dump` hook (`@php artisan package:discover`) trying to spawn a subprocess - many shared hosts disable `proc_open` in `disable_functions`. `deploy.sh` already works around this (`composer install --no-scripts` followed by `php artisan package:discover --ansi` run directly). Avoid reintroducing anything that shells out from within a PHP request (e.g. `Process::start`) for the same reason - use queued jobs instead.

## Permissions Reference

Each module uses a `<module>.<action>` naming convention:

- `tension-records.view / create / edit / delete`
- `stock-take.view / create / edit / delete`
- `finish-earlier.view / create / edit / delete`
- `creel.view / create / edit / delete`
- `users.view / manage`
- `roles.manage`
- `activity-log.view`

Assign permissions to roles via the User & Role Management module in the app, or seed them with `php artisan db:seed --class=RolesAndPermissionsSeeder`.

---

*Minerva — built and maintained by Anufa Technologies*
