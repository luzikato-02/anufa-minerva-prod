# Web → Mobile parity checklist

Source of truth: the web app in this repo (`routes/web.php`, `resources/js/pages`). `[x]` = done and tested, `[~]` = backend ready, app pending.

## Foundation
- [x] Flutter toolchain (Flutter 3.47, JDK 17, Android SDK 35/36) — `source ~/development/env.sh`
- [x] Design tokens generated from web `app.css` (`dart run tool/oklch_to_hex.dart`)
- [x] Theme (light/dark/system), Instrument Sans bundled
- [x] Component kit: button, card, badge, text field, alert/confirm, skeleton, select, form sheet, async body, paged list + search, keypad/numpad widgets. (OTP input and web-style data tables were replaced by a plain code field and card lists, which suit phones better.)
- [x] Debug APK builds
- [x] Backend `/api/v1` (branch `feature/mobile-api` of anufa-minerva, 83 routes, auth tests green)
- [x] Router, permission guards, drawer nav (same groups as web sidebar), token auth, tests (6)
- [x] Offline core: persistent sync queue (file-backed, flush on reconnect/resume, rejected items surfaced, discard/retry) + `client_uuid` idempotency on `POST /tension-records` (migration + tests)
- [x] `client_uuid` for stock-take `record-batch`; n/a for finish-earlier (scan flow is online-only)

## Modules (backend `[~]` = `/api/v1` route exists)
- [x] Login (email or username) + 2FA challenge (TOTP / recovery code)
- [x] Forgot password screen (server needs mail configured); [ ] reset-password deep link
- [n/a] Register — disabled on web (routes commented out), intentionally not built
- [x] Dashboard stats (permission-aware)
- [x] Twisting tension: params form, numpad (spec check, max/min auto-advance, go-to, delete), problem reports, draft persisted on device + resume, finish → upload or offline queue (CSV/record shape verified against web)
- [x] Weaving tension: session select (create/continue by production order), params, creel numpad (side/row/col, spec check), problems, server session start/resume with local↔server merge, 600 ms autosave, finish via PUT (completed) or queued POST offline
- [x] Tension records: stats, twisting/weaving lists + search, detail (info, max/min chart, measurements), edit (incl. weaving nested readings), delete, CSV download, problems tab + resolve (19 tests)
- [x] Stock taking: camera/typed batch lookup (server check online, device copy offline), prefilled record form, offline queue with duplicate protection, sessions list + stats + search, CSV upload → new session, session detail (found/not-found filter), status change, CSV export, delete (15 tests)
- [x] Finish earlier records: server-side search (fixed: web search was ignored), detail with entries, CSV (keeps >80 rows) + PDF download, edit record, edit entries (validated), delete (10 tests). Manual session recording has no web UI, so not built.
- [x] Finish earlier scan: camera or PDF/image → OCR (cancellable) → review/fix entries → save with merge/replace on conflict. Online-only (OCR is server-side).
- [x] Document intelligence: camera or PDF/image → OCR (cancellable, online-only) → per-page rendered (GFM tables) / raw view → export Markdown, JSON, Excel via the share sheet (10 tests)
- [x] Machine maintenance (types + definitions CRUD, manage-gated)
- [x] Users & roles management (users CRUD, roles assign, status, roles CRUD w/ permissions, stats, search, paging)
- [x] Activity log (event + date-range filters, paging)
- [x] Settings: profile, password, appearance, 2FA setup/recovery codes (QR shown as key only)

## Shared building blocks
- `core/api/paged.dart` + `core/ui/paged_list.dart`: Laravel-paginated infinite list (reuse for tension/stock/finish-earlier/creel lists)
- Tests: `flutter test` (12) with `test/support/{fakes,pump}.dart` fake API; backend `php artisan test tests/Feature/Api` (needs `APP_KEY`)

## Out of scope for mobile (decided)
- Creel visualization: list, xlsx upload/edit, 3D viewer, and the finish-earlier "View creel" link. Backend `/api/v1/creel-records*` routes exist but no app screens use them.
- Registration (disabled on web); manual finish-earlier session recording (no web UI); Liner Material I/O ("under construction" on web).
