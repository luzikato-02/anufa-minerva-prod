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
```

## Working on Minerva

This repo checkout is for editing code only — there's no local dev server or local database. `composer install` / `npm install` here are just for editor tooling (autocomplete, static analysis), not for running the app.

All actual testing happens on the deployed `minerva-dev` environment: commit, push to `main`, deploy to dev, test on the live subdomain, then deploy the same commit to prod once it looks right.

```bash
composer install
npm install
```

## Deployment

Minerva is self-hosted directly on our own VPS (Ubuntu, native PHP-FPM + Caddy) — no shared hosting, no manual zip upload. Two environments, both deployed from `main`:

| Env | Directory | URL | php-fpm pool |
|---|---|---|---|
| Dev/test | `/home/anufaroot/deploy/minerva-dev` | https://minerva-dev.anufa.my.id | `minerva-dev` |
| Production | `/home/anufaroot/deploy/minerva-prod` | https://minerva.anufa.my.id | `minerva-prod` |

Each is a real git clone of this repo. Caddy reverse-proxies each domain straight to its php-fpm pool's unix socket (`php_fastcgi unix//run/php/minerva-<env>.sock`), config in `/etc/caddy/Caddyfile`.

**Every deploy:**

```bash
./deploy/deploy.sh dev    # test here first
./deploy/deploy.sh prod   # then ship it
```

Run from anywhere (it cd's to the right checkout itself). Resets `minerva-<env>` to match `main` on origin, reinstalls PHP/Node dependencies, rebuilds frontend assets, runs `migrate --force` + `storage:link` + `optimize`, and reloads php-fpm.

`minerva-dev` logs in with the seeded test accounts from `DatabaseSeeder` (`admin@example.com` / `password`, plus `test@example.com`, `engineer@example.com`, `analyst@example.com`) — it's not loaded with real production data.

`MISTRAL_API_KEY` (in each environment's `.env`, not this repo) is required for Document Intelligence and Finish Earlier Scan OCR to work — check it's set if those features seem inert.

`QUEUE_CONNECTION=database` in `.env` is unused scaffolding — nothing in the app dispatches a queued job (no `Jobs/` directory, no `ShouldQueue` classes), so there's no queue worker to run.

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
