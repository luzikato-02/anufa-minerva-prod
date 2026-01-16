# Anufa Minerva - Complete Codebase Overview

## Project Summary

**Anufa Minerva** is a hybrid **desktop + web** production data management system combining:
- **Backend**: Laravel PHP REST API
- **Frontend**: React 19 + TypeScript with Inertia.js
- **Desktop**: Electron wrapper with offline-first SQLite sync
- **Styling**: Tailwind CSS + Radix UI components

**Status**: Production-ready with offline capabilities

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Electron** | electron | ^32.0.0 |
| **Frontend** | React | ^19.0.0 |
| **Language** | TypeScript | ^5.7.2 |
| **Build** | Vite | ^7.0.4 |
| **Styling** | Tailwind CSS | ^4.0.0 |
| **UI Components** | Radix UI | Latest |
| **Routing** | Inertia.js | ^2.1.4 |
| **Backend** | Laravel | 11.x (assumed) |
| **Database** | SQLite (local) | 3.x |
| **Database** | PostgreSQL/MySQL (server) | Server-dependent |
| **Package Manager** | npm | ^10.x |
| **Node** | Node.js | ^20.x |

---

## Directory Structure (Detailed)

```
anufa-minerva/
│
├── 📁 electron/                           # Electron main process
│   ├── main.cjs                          # Entry point (CommonJS)
│   │   ├─ BrowserWindow creation
│   │   ├─ IPC handler setup
│   │   ├─ SQLite database initialization
│   │   ├─ Menu creation
│   │   └─ App lifecycle events
│   │
│   ├── preload.cjs                       # Security bridge
│   │   ├─ contextBridge.exposeInMainWorld('electronAPI', {...})
│   │   ├─ contextBridge.exposeInMainWorld('platform', {...})
│   │   └─ Validates all IPC calls
│   │
│   └── setup.html                        # Server configuration UI
│       └─ Shown on first run for URL setup
│
├── 📁 resources/js/                       # React frontend (TypeScript)
│   ├── app.tsx                           # Inertia entry point
│   │   ├─ createInertiaApp setup
│   │   ├─ Component resolution
│   │   └─ Progress bar config
│   │
│   ├── electron-bridge.tsx               # Electron event listener
│   │   └─ Listens for main process events
│   │
│   ├── ssr.tsx                           # SSR entry (Laravel)
│   │
│   ├── 📁 components/
│   │   ├── app-window-shell.tsx          # Top-level window frame
│   │   ├── app-title-bar.tsx             # Custom titlebar
│   │   ├── server-config-modal/          # Server config form
│   │   ├── sync-status-badge.tsx         # Network/sync indicator
│   │   ├── conflict-resolver.tsx         # Conflict UI
│   │   └── [other components]
│   │
│   ├── 📁 pages/                         # Inertia pages
│   │   ├── welcome.tsx                   # Landing page
│   │   ├── dashboard.tsx                 # Main dashboard
│   │   ├── stock-take-records-display.tsx
│   │   ├── batch-stock-taking-main.tsx
│   │   ├── tension-records-display.tsx
│   │   ├── twisting-tension-main.tsx
│   │   ├── weaving-tension-main.tsx
│   │   ├── finish-earlier-records-display.tsx
│   │   ├── under-construction.tsx
│   │   ├── user-maintenance-main.tsx
│   │   ├── 📁 auth/
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   └── forgot-password.tsx
│   │   ├── 📁 admin/
│   │   │   ├── dashboard.tsx
│   │   │   ├── users.tsx
│   │   │   ├── permissions.tsx
│   │   │   ├── data-sync.tsx
│   │   │   └── settings.tsx
│   │   └── 📁 settings/
│   │       ├── profile.tsx
│   │       └── preferences.tsx
│   │
│   ├── 📁 layouts/
│   │   ├── app-layout.tsx                # Main authenticated layout
│   │   │   ├─ Sidebar navigation
│   │   │   ├─ Header with breadcrumbs
│   │   │   └─ Content area
│   │   └── auth-layout.tsx               # Login/register layout
│   │
│   ├── 📁 hooks/
│   │   ├── use-electron-api.ts           # Electron API wrapper
│   │   ├── use-sync-status.ts            # Sync state & events
│   │   ├── use-offline.ts                # Network state detection
│   │   ├── use-appearance.ts             # Theme management
│   │   └── [custom hooks]
│   │
│   ├── 📁 utils/
│   │   ├── sync-manager.ts               # Sync orchestration logic
│   │   ├── conflict-resolver.ts          # Conflict handling
│   │   ├── db-operations.ts              # Local DB helpers
│   │   ├── api-client.ts                 # HTTP client
│   │   └── [utility functions]
│   │
│   ├── 📁 actions/                       # Server actions (if using)
│   │
│   ├── 📁 types/
│   │   ├── electron.d.ts                 # Type definitions for electronAPI
│   │   ├── models.ts                     # Shared type definitions
│   │   └── [other types]
│   │
│   ├── 📁 lib/
│   │   ├── [utility libraries]
│   │
│   ├── 📁 wayfinder/                     # Generated by Wayfinder plugin
│   │
│   └── 📁 css/
│       └── app.css                       # Global styles (Tailwind)
│
├── 📁 app/                                # Laravel app directory
│   ├── 📁 Http/
│   │   ├── 📁 Controllers/
│   │   │   ├── 📁 Api/
│   │   │   │   ├── StockTakeRecordController.php
│   │   │   │   ├── TensionRecordController.php
│   │   │   │   └── FinishEarlierRecordController.php
│   │   │   └── [other controllers]
│   │   ├── 📁 Middleware/
│   │   │   ├── Authenticate.php
│   │   │   ├── VerifyEmail.php
│   │   │   └── [other middleware]
│   │   └── 📁 Requests/
│   │       └── [form validation requests]
│   │
│   ├── 📁 Models/
│   │   ├── User.php
│   │   ├── TensionRecord.php
│   │   ├── TwistingMeasurement.php
│   │   ├── WeavingMeasurement.php
│   │   ├── TensionProblem.php
│   │   ├── StockTakingRecord.php
│   │   ├── FinishEarlierRecord.php
│   │   ├── DataConflict.php
│   │   ├── SyncCheckpoint.php
│   │   ├── SyncTransportLog.php
│   │   └── SyncClientDevice.php
│   │
│   └── 📁 Providers/
│       ├── AppServiceProvider.php
│       ├── FortifyServiceProvider.php
│       └── [other providers]
│
├── 📁 routes/                             # Laravel route definitions
│   ├── web.php                           # Inertia routes (SSR)
│   ├── api.php                           # API routes
│   ├── auth.php                          # Authentication routes
│   ├── admin.php                         # Admin routes
│   ├── settings.php                      # Settings routes
│   └── console.php                       # Artisan commands
│
├── 📁 config/                             # Laravel configuration
│   ├── app.php
│   ├── auth.php
│   ├── database.php
│   ├── cache.php
│   ├── session.php
│   ├── mail.php
│   ├── cors.php
│   ├── sanctum.php
│   ├── fortify.php
│   ├── inertia.php
│   └── [other configs]
│
├── 📁 database/
│   ├── database.sqlite                   # SQLite (if used for dev)
│   ├── 📁 migrations/
│   │   ├── 0001_01_01_000000_create_users_table.php
│   │   ├── create_tension_records_table.php
│   │   ├── create_twisting_measurements_table.php
│   │   ├── create_weaving_measurements_table.php
│   │   ├── create_stock_taking_records_table.php
│   │   ├── create_tension_problems_table.php
│   │   ├── create_data_conflicts_table.php
│   │   ├── create_sync_checkpoints_table.php
│   │   ├── create_sync_transport_logs_table.php
│   │   └── [other migrations]
│   │
│   └── 📁 seeders/
│       ├── DatabaseSeeder.php
│       └── UserFactory.php
│
├── 📁 storage/
│   ├── 📁 app/                           # User uploads
│   ├── 📁 logs/                          # App logs
│   └── 📁 framework/                     # Cache files
│
├── 📁 public/
│   ├── index.php                         # Entry point
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── logo.svg
│   ├── apple-touch-icon.png
│   ├── robots.txt
│   ├── hot                               # Vite HMR file
│   └── 📁 build/                         # Compiled assets
│
├── 📁 bootstrap/
│   ├── app.php
│   ├── providers.php
│   └── 📁 cache/
│
├── 📁 tests/
│   ├── TestCase.php
│   ├── 📁 Feature/
│   └── 📁 Unit/
│
├── 📁 vendor/                             # PHP dependencies (Composer)
│
├── 📁 node_modules/                       # Node dependencies (npm)
│
├── 📁 scripts/
│   └── deploy-web.sh                     # Deployment script
│
├── 🔧 Configuration Files
│   ├── vite.config.ts                    # Vite build config
│   ├── tsconfig.json                     # TypeScript config
│   ├── forge.config.cjs                  # Electron Forge config
│   ├── eslint.config.js                  # ESLint rules
│   ├── package.json                      # npm scripts & deps
│   ├── package-lock.json
│   ├── composer.json                     # PHP dependencies
│   ├── composer.lock
│   ├── phpunit.xml                       # PHP testing config
│   ├── .env                              # Environment variables
│   ├── .env.example
│   ├── .editorconfig
│   ├── .prettierrc
│   └── .prettierignore
│
├── 📚 Documentation Files
│   ├── README.md
│   ├── ELECTRON-README.md                # Quick Electron guide
│   ├── ELECTRON-ARCHITECTURE.md          # Detailed architecture
│   ├── ELECTRON-DEV-GUIDE.md            # Development guide
│   ├── ELECTRON-SYNC-GUIDE.md           # Sync deep-dive
│   ├── ELECTRON-LAYOUT.md               # Visual reference
│   └── This file                        # Complete overview
│
└── 🌐 GitHub
    └── .github/
        └── 📁 workflows/
            └── build-electron.yml        # GitHub Actions CI/CD
```

---

## Application Features

### 1. **Tension Record Management**
- **Twisting Tension Records**
  - Multiple spindles per machine
  - Min/max value tracking
  - Problem tracking with resolution
  
- **Weaving Tension Records**
  - Grid-based measurements (side, row, column)
  - Out-of-spec detection
  - Statistics by side/row

### 2. **Stock Taking**
- Session-based recording
- Batch recording validation
- CSV export
- Session status tracking

### 3. **Finish Earlier Records**
- Production order tracking
- Multi-entry sessions
- Session status management
- PDF/CSV export

### 4. **Offline-First Desktop (Electron)**
- Works without internet
- Auto-sync when reconnected
- Conflict detection & resolution
- Local SQLite database
- Data export/import

### 5. **Admin Dashboard**
- User management
- Permission control
- Sync conflict resolution
- Data sync logs view
- System settings

### 6. **Authentication**
- Email-based login
- Two-factor authentication (2FA)
- Email verification
- Password reset
- Session management via Sanctum

---

## Key Workflows

### Workflow 1: Creating a Tension Record (Online)

```
User in Web/Electron
    ↓
Click: Tension Records → New Record
    ↓
Fill form (machine, operator, measurements)
    ↓
Click: Save
    ↓
POST /api/tension-records
    ↓
Laravel validates & saves to DB
    ↓
Returns: { success: true, id: 42, ... }
    ↓
React updates component
    ↓
Display: "✅ Record created" + ID 42
```

### Workflow 2: Creating a Tension Record (Offline - Electron)

```
User in Electron (Offline)
    ↓
Click: New Record
    ↓
Fill form
    ↓
Click: Save
    ↓
API call fails (no network)
    ↓
Fallback: Save to Local SQLite
    ↓
INSERT INTO tension_records
  (local_modified=1, synced_at=NULL, ...)
    ↓
Return: { success: true, local_id: 1, ... }
    ↓
Display: "⏳ Pending sync"
    ↓
User reconnects to network
    ↓
Manual: File → Sync Now
OR Auto-detect via onLine event
    ↓
Sync Manager:
  1. Get unsynced records
  2. POST to server API
  3. Receive remote ID
  4. UPDATE local DB (mark synced)
    ↓
Display: "✅ Synced (now ID 42)"
```

### Workflow 3: Resolving Conflicts

```
Offline User edits record 1 (local ID: 1)
    ↓
Online User edits same record (server ID: 42)
    ↓
Offline user comes online
    ↓
Sync Manager detects conflict
    ↓
Creates conflict record in data_conflicts table
    ↓
Display: "⚠️ 1 conflict pending"
    ↓
Admin user navigates to:
Admin → Data Sync → View Conflicts
    ↓
See comparison:
  Local: machine="M-001"
  Remote: machine="M-002"
    ↓
Choose: "Keep Remote"
    ↓
UPDATE data_conflicts
  (resolution_status='resolved',
   resolved_by_user_id=admin_id)
    ↓
Sync completes
    ↓
Display: "✅ Conflict resolved"
```

---

## IPC Communication Map

### From React to Electron Main Process

```typescript
// Example: Save data locally
const result = await window.electronAPI.dbExecute(
  'INSERT INTO tension_records (...) VALUES (...)',
  [values]
);
// ↓
// Electron main.cjs ipcMain.handle('db-execute', ...)
// ↓
// Execute SQL on local SQLite
// ↓
// Return { success: true, lastInsertRowid: 1, changes: 1 }
```

### From Electron Main Process to React

```javascript
// Example: Menu triggered
mainWindow.webContents.send('trigger-sync');
// ↓
// React listens in ElectronBridge
// ↓
// window.electronAPI.onTriggerSync(() => {
//   performSync();
// })
```

---

## Database Schema (Key Tables)

### Server Database (PostgreSQL/MySQL)

```sql
users
├─ id, name, email, password
├─ email_verified_at, two_factor_secret
└─ timestamps (created_at, updated_at)

tension_records
├─ id, record_type (twisting|weaving)
├─ machine_number, item_number
├─ operator, status
├─ form_data (JSON), csv_data (TEXT)
├─ timestamps
└─ soft_delete (deleted_at)

twisting_measurements
├─ id, tension_record_id
├─ spindle_number
├─ max_value, min_value
└─ timestamps

weaving_measurements
├─ id, tension_record_id
├─ creel_side, row_number, column_number
├─ max_value, min_value
└─ timestamps

tension_problems
├─ id, tension_record_id
├─ spindle_number, position
├─ description, status (pending|resolved)
├─ resolution notes, repaired values
└─ timestamps

stock_taking_records
├─ id, session_id
├─ status (ongoing|completed)
├─ recorded_batches (JSON), summary (JSON)
└─ timestamps

data_conflicts (Admin conflict tracking)
├─ id, table_name
├─ local_record_id, remote_record_id
├─ local_data (JSON), remote_data (JSON)
├─ conflict_fields (JSON)
├─ resolution_status, resolved_by_user_id
├─ merged_data (JSON)
└─ timestamps
```

### Local Database (SQLite - Electron Only)

```sql
[All above tables PLUS sync tracking columns:]
├─ local_modified (BOOLEAN) ← 1 if changed locally
├─ synced_at (TIMESTAMP)    ← When last synced
└─ remote_id (INTEGER)      ← Server-side ID

sync_transport_logs (Audit trail)
├─ id, sync_direction (upload|download)
├─ table_name, record_id, remote_record_id
├─ action (create|update|delete)
├─ status (pending|success|failed|conflict)
├─ payload (JSON), error_message
└─ timestamps

app_settings (Configuration)
├─ key, value
└─ updated_at
```

---

## Environment Variables

### `.env` (Laravel)

```bash
APP_NAME=Anufa Minerva
APP_ENV=production          # or 'local'
APP_DEBUG=false            # or 'true' for dev
APP_KEY=base64:...

DB_CONNECTION=pgsql        # or 'mysql', 'sqlite'
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=anufa_minerva
DB_USERNAME=postgres
DB_PASSWORD=secret

MAIL_DRIVER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_USERNAME=...
MAIL_PASSWORD=...

SANCTUM_STATEFUL_DOMAINS=localhost,127.0.0.1,...

SESSION_DRIVER=cookie      # For SPA
CACHE_DRIVER=redis
QUEUE_CONNECTION=sync
```

---

## Build & Deployment

### Development Build

```bash
# Terminal 1: Laravel
composer install
composer dev

# Terminal 2: Vite
npm install
npm run dev

# Terminal 3: Electron
npm run electron:start
```

### Production Build (Web)

```bash
npm run build              # → /dist
php artisan serve          # Laravel serves built assets
```

### Production Build (Electron - Windows)

```bash
npm run electron:make:win  # → /out/make/squirrel.windows/...
# Users download AnufaMinerva-Setup.exe and install
```

### Production Build (All Platforms)

```bash
npm run electron:build     # → Creates installers for Win/Linux/macOS
```

### GitHub Actions CI/CD

Automatically builds on:
- Push to main branch
- Tag creation (v1.0.0)
- Manual trigger

Creates releases with installers for all platforms.

---

## Development Checklist

When adding a new feature:

- [ ] Create React component (`.tsx`)
- [ ] Add Inertia route in `routes/web.php`
- [ ] Create Laravel controller/API
- [ ] Create database migration (if needed)
- [ ] Add model + relationships
- [ ] Test in web mode (http://localhost:8000)
- [ ] Test in Electron offline mode
- [ ] Add sync support if data is mutable (add to sync tables)
- [ ] Add conflict handling if concurrent edits possible
- [ ] Update types (`.d.ts`, interfaces)
- [ ] Run linter: `npm run lint`
- [ ] Run type check: `npm run types`
- [ ] Add tests (`tests/Feature/`, `tests/Unit/`)

---

## Common Commands

### Development

```bash
composer dev                    # Laravel server
npm run dev                     # Vite dev server
npm run electron:start          # Open Electron
npm run electron:dev           # All at once (requires setup)
npm run format                 # Format code
npm run lint                   # Lint code
npm run types                  # Type check
```

### Building

```bash
npm run build                  # Build frontend
npm run electron:build         # Build + create installers
npm run electron:make:win      # Windows only
npm run electron:package       # Package without signing
```

### Testing

```bash
./vendor/bin/phpunit           # Run PHP tests
npm run test                   # Run JS tests (if configured)
```

---

## Performance Considerations

### Web Version

- Lazy load pages via Inertia
- Code-split React components
- Use React.memo for expensive components
- Optimize images (WebP, lazy loading)
- Enable gzip compression

### Electron Version

- Local SQLite for instant access (no API latency)
- Batch IPC calls (reduce IPC overhead)
- Virtual scroll for large lists
- Minimize re-renders in DataTables

### Network

- API response caching (Redis)
- Pagination for large datasets
- Compression (gzip, brotli)
- CDN for static assets

---

## Security Practices

### Authentication

- Sanctum token-based (not sessions)
- CSRF protection via middleware
- 2FA via `pragmarx/2fa`
- Email verification required

### Database

- Laravel Query Builder (prevents SQL injection)
- Parameterized IPC calls in Electron
- Model validation (in Requests)

### Permissions

- Spatie `permission` package
- Middleware checks (`middleware: ['auth', 'verified']`)
- Policy-based authorization

### Electron

- Preload script secures IPC
- No node integration (`nodeIntegration: false`)
- Content Security Policy headers
- Electron Fuses for hardening

---

## Monitoring & Logging

### Laravel

```
storage/logs/laravel.log       # App logs
```

### Electron

```
%APPDATA%/anufa-minerva/logs/  # Electron logs
```

### Sync Audit Trail

```sql
SELECT * FROM sync_transport_logs
  WHERE created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC;
```

---

## Support & Resources

- **Laravel Docs**: https://laravel.com/docs
- **React Docs**: https://react.dev
- **Inertia.js**: https://inertiajs.com
- **Electron**: https://www.electronjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Radix UI**: https://www.radix-ui.com/docs

---

## License

Check the LICENSE file in the repository.

---

**Last Updated**: January 16, 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅
