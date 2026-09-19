# Minerva Mobile

Flutter (Android-first) companion to the Minerva web app, living in the same repo so the API and the app change together. It talks to the Laravel backend through the token API in [`routes/api.php`](../routes/api.php) (`/api/v1`, Sanctum bearer tokens) and reuses the same permissions as the web.

Feature parity is tracked in [`docs/parity-checklist.md`](docs/parity-checklist.md). Creel visualization is intentionally **not** part of the mobile app.

## What's in it

Login (email/username + 2FA) · dashboard · twisting & weaving tension recording (with offline queue) · tension records & problem resolution · stock taking with barcode scanning (offline-capable) · stock take records · finish-earlier records and OCR form scanning · document intelligence (OCR) · machine maintenance · users & roles · activity log · profile/password/2FA/appearance settings.

Recording flows (twisting, weaving, stock-take batches) keep their draft on the device and upload through a persistent sync queue when offline. OCR flows need a connection.

## Getting started

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=https://minerva-dev.anufa.my.id
```

`API_BASE_URL` defaults to the dev server; production builds must pass `https://minerva.anufa.my.id`.

```bash
flutter analyze
flutter test                      # unit + widget tests, no device needed
flutter build apk --debug         # or --release
```

Toolchain used so far: Flutter stable 3.47, JDK 17, Android SDK 35/36. Gradle is capped at 1 GB heap in `android/gradle.properties` because the build server is small; raise it on a bigger machine.

## Layout

```
lib/
  app/            router (permission-guarded), drawer navigation
  core/           api client (Dio + token), auth, sync queue, theme + UI kit, file helpers
  features/       one folder per module (tension, stock, finish_earlier, documents, users, …)
test/             widget/unit tests with a fake API (test/support)
tool/             oklch_to_hex.dart – generates the design tokens from the web CSS
```

## Design system

The web app is stock shadcn/ui "new-york" (neutral, Tailwind v4 tokens in `resources/css/app.css`). The mobile theme is generated from that file so the two stay identical:

```bash
cd mobile && dart run tool/oklch_to_hex.dart   # rewrites lib/core/theme/tokens.g.dart
```

CI fails if `tokens.g.dart` is out of date with the web stylesheet. Typeface: Instrument Sans (bundled, SIL OFL).

## Working with the API

- Add or change endpoints in `../routes/api.php` and `../app/Http/Controllers/Api/`; the mobile routes mirror the web routes and use the same `permission:*` middleware.
- Backend tests: `php artisan test tests/Feature/Api` (from the repo root; set `APP_KEY` if there's no `.env`).
- Records created offline carry a `client_uuid` idempotency key; endpoints that accept it must treat a repeat as a no-op.

## Releasing

Not set up yet. Before shipping: choose the final `applicationId` (currently `id.anufa.anufa_minerva_mobile`), add release signing, and pass the production `API_BASE_URL`.
