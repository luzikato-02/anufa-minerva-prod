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

Minerva is self-hosted directly on our own VPS (Ubuntu, native PHP-FPM + Caddy) — no shared hosting, no manual zip upload. Two environments run side by side on the box:

| Env | Directory | Branch | URL | php-fpm pool | Queue worker |
|---|---|---|---|---|---|
| Production | `/home/anufaroot/deploy/minerva-prod` | `main` | https://minerva.anufa.my.id | `minerva-prod` | `minerva-queue@prod` |
| Staging | `/home/anufaroot/deploy/minerva-dev` | `develop` | https://minerva-dev.anufa.my.id | `minerva-dev` | `minerva-queue@dev` |

Each is a real git clone of this repo, checked out to its branch. Caddy reverse-proxies each domain straight to its php-fpm pool's unix socket (`php_fastcgi unix//run/php/minerva-<env>.sock`), config in `/etc/caddy/Caddyfile`.

**Every deploy:**

```bash
# push your changes to develop (staging) or main (prod) first, then:
ssh anufa-dev
cd /home/anufaroot/deploy/minerva-prod   # or minerva-dev
./deploy/deploy.sh
```

`deploy/deploy.sh` hard-resets the checkout to `origin/<current branch>`, runs `composer install --no-dev`, `npm ci && npm run build`, `php artisan deploy:finalize` (migrations, role/permission seeding, admin bootstrap, `storage:link`, cache warmup), reloads php-fpm, restarts the matching queue worker, and smoke-tests the URL. It only ever touches the directory it's run from — deploy staging and prod independently, in whichever order you want (staging first is recommended, as a live smoke test before shipping the same commit to prod).

One-time environment setup (already done for prod/staging on the current VPS; needed again only when standing up a new environment):

1. `git clone -b <branch> <repo-url> /home/anufaroot/deploy/minerva-<env>`
2. Copy `.env.production.example` to `.env` in that directory and fill in the real values (`APP_KEY` via `php artisan key:generate --show`, DB credentials, `ADMIN_*`)
3. Add a php-fpm pool at `/etc/php/8.3/fpm/pool.d/minerva-<env>.conf` listening on `/run/php/minerva-<env>.sock`, and a matching `minerva-<env>.<domain>` block in `/etc/caddy/Caddyfile` proxying to it
4. Install the queue worker: `sudo cp deploy/systemd/minerva-queue@.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now minerva-queue@<env>`
5. Run `./deploy/deploy.sh` once to build and finalize

### proc_open

Previously blocked on shared cPanel hosting (see git history for the workarounds that forced), but this is our own VPS, so `disable_functions` doesn't apply — Symfony's `Process` class works normally here. Queued jobs are still the right call for anything long-running or retryable, `Process`/`exec` for short-lived synchronous work is fine.

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
