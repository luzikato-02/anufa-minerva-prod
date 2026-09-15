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

- **Backend** — Laravel 11 (PHP 8.2+), PostgreSQL
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

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=

MISTRAL_API_KEY=              # Required for Document Intelligence and Finish Earlier Scan
```

## Deployment

The app is built locally and shipped to cPanel as zip files for manual upload/extraction via File Manager - nothing installs or builds on the shared host itself (see history for why: server-side builds there hit disabled `proc_open`, an ancient bundled Node.js version, and severely throttled npm registry bandwidth).

One-time setup: in cPanel File Manager, create the app checkout directory, point the subdomain's document root (cPanel > Domains) directly at `<app checkout>/public` (Apache only serves the docroot and below, so `.env`/`vendor`/`app/` stay inaccessible without needing a separate synced docroot), upload `.env.production.example` as `.env` into the app checkout and fill in the values, then run `php artisan key:generate` via cPanel Terminal.

Every subsequent deploy:

```powershell
powershell -File deploy/build.ps1
```

This exports the committed git `HEAD` (uncommitted changes are NOT included - commit first) to a temp dir, runs `composer install --no-dev`, `npm ci`, and `npm run build`, then writes `deploy/dist/app.zip`. Then:

1. Upload `app.zip` to the app checkout dir on cPanel and extract it there
2. Delete the zip file from the server
3. Via cPanel Terminal, from the app checkout dir: `php artisan deploy:finalize` (migrations, role/permission seeding, admin bootstrap, cache warmup)

### Queue worker (required for queued jobs)

Shared hosting has no persistent worker process, so `QUEUE_CONNECTION=database` jobs sit queued until something drains them. In cPanel > Cron Jobs, add a job that runs every minute:

```bash
php /home/youruser/anufa-minerva/artisan queue:work --stop-when-empty --tries=1 >> /dev/null 2>&1
```

`--stop-when-empty` exits once the queue is drained instead of running forever, which is what makes this safe to trigger repeatedly from cron rather than needing a long-running process.

### proc_open is disabled on this host

`disable_functions` blocks `proc_open` on this shared host, so anything using Symfony's `Process` class (e.g. `Process::start`) fails at runtime with `The Process class relies on proc_open, which is not available on your PHP installation`. Use queued jobs rather than `Process`/`exec`/`shell_exec` for anything that needs to run in the background.

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
