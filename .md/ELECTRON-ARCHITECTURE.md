# Anufa Minerva - Electron Architecture & Layout

## Overview

This is a **Hybrid Desktop Application** combining:
- **Backend**: Laravel PHP (REST API)
- **Frontend**: React with TypeScript + Inertia.js
- **Desktop Runtime**: Electron
- **Local Storage**: SQLite3 with offline-first sync

---

## Project Structure

```
anufa-minerva/
├── /electron/                    # Electron main process files
│   ├── main.cjs                 # Main Electron process (CommonJS)
│   ├── preload.cjs              # IPC bridge & API exposure
│   └── setup.html               # Server configuration UI
│
├── /resources/js/               # React + TypeScript frontend
│   ├── app.tsx                  # Inertia setup & entry point
│   ├── electron-bridge.tsx      # Electron listener hook
│   ├── components/
│   │   ├── app-window-shell.tsx # Top-level shell with titlebar
│   │   ├── app-title-bar.tsx    # Custom window controls
│   │   └── server-config-modal  # Server configuration UI
│   ├── pages/                   # Inertia page components
│   │   ├── welcome.tsx
│   │   ├── dashboard.tsx
│   │   ├── stock-take-records-display.tsx
│   │   ├── tension-records-display.tsx
│   │   └── ...
│   ├── layouts/
│   │   ├── app-layout.tsx       # Main authenticated layout
│   │   └── auth-layout.tsx      # Login/register layout
│   └── hooks/
│       └── use-appearance.ts    # Theme initialization
│
├── /routes/                      # Laravel routes
│   ├── web.php                  # Web routes (Inertia)
│   ├── api.php                  # API routes
│   ├── auth.php                 # Authentication
│   ├── admin.php                # Admin panel
│   └── settings.php             # Settings
│
├── /app/Http/Controllers/       # Laravel controllers
│   ├── Api/
│   │   ├── StockTakeRecordController.php
│   │   ├── TensionRecordController.php
│   │   └── FinishEarlierRecordController.php
│   └── Middleware/              # Auth, verified checks
│
├── /database/                    # Database files
│   ├── database.sqlite          # Main server database
│   └── migrations/              # Laravel migrations
│
├── vite.config.ts              # Vite build config (React + Laravel)
├── forge.config.cjs            # Electron Forge config
├── package.json                # NPM scripts
├── tsconfig.json               # TypeScript config
└── composer.json               # PHP dependencies
```

---

## Architecture Layers

### 1. **Electron Main Process** (`electron/main.cjs`)

**Responsibilities:**
- Window management (create, minimize, maximize, close)
- IPC (Inter-Process Communication) handlers
- Local SQLite database operations
- Menu creation (File, Edit, View, Help)
- App lifecycle (ready, quit, activate)
- Server URL configuration and storage
- Development/Production mode detection

**Key Functions:**

```javascript
// Main Window Creation
function createWindow() {
  // Set up preload script
  // Load from Vite dev server (dev) or server URL (prod)
  // Show DevTools in dev mode
}

// Database Initialization
function initializeLocalDatabase() {
  // Create SQLite tables mirroring Laravel schema
  // Tables: users, tension_records, twisting_measurements, etc.
}

// IPC Handler Setup
function setupIpcHandlers() {
  // Database operations (execute, batch-execute)
  // Sync operations (get-unsynced-records, mark-as-synced)
  // Conflict management
  // Window controls (minimize, maximize, close)
  // Configuration (get/set server URL)
}
```

**IPC Channels Exposed:**

| Channel | Type | Purpose |
|---------|------|---------|
| `get-db-path` | Handle | Get local SQLite database path |
| `get-app-data-path` | Handle | Get app data directory |
| `get-server-url` | Handle | Retrieve stored server URL |
| `set-server-url` | Handle | Save new server URL |
| `db-execute` | Handle | Execute SQL query |
| `db-batch-execute` | Handle | Execute multiple SQL queries in transaction |
| `get-unsynced-records` | Handle | Fetch locally modified records |
| `mark-as-synced` | Handle | Update sync status |
| `log-sync-transport` | Handle | Log sync operations |
| `create-conflict` | Handle | Create data conflict record |
| `get-pending-conflicts` | Handle | Fetch unresolved conflicts |
| `resolve-conflict` | Handle | Resolve conflict with chosen data |
| `export-database` | Handle | Export local DB as backup |
| `import-database` | Handle | Import DB from file |
| `trigger-sync` | Send | Trigger sync from menu |
| `show-sync-log` | Send | Show sync log modal |
| `show-conflicts` | Send | Show conflicts modal |
| `show-server-config` | Send | Show server config modal |

---

### 2. **Preload Script** (`electron/preload.cjs`)

**Purpose:** Safely expose Electron API to React frontend

**Exposed Objects:**

```javascript
window.electronAPI {
  // Environment
  isElectron: () => true
  getDbPath: () => string
  getAppDataPath: () => string
  
  // Server Configuration
  getServerUrl: () => string | null
  setServerUrl: (url: string) => boolean
  
  // Database Operations
  dbExecute: (sql, params) => { success, data/changes, error }
  dbBatchExecute: (queries) => { success, results, error }
  
  // Sync Management
  getUnsyncedRecords: (tableName) => { success, data, error }
  markAsSynced: (tableName, localId, remoteId) => { success, error }
  logSyncTransport: (logData) => { success, id, error }
  getSyncLogs: (limit) => { success, data, error }
  
  // Conflict Resolution
  createConflict: (conflictData) => { success, id, error }
  getPendingConflicts: () => { success, data, error }
  resolveConflict: (conflictId, resolution) => { success, error }
  
  // Database Import/Export
  exportDatabase: () => { success, path, error }
  importDatabase: () => { success, error }
  
  // Event Listeners (return unsubscribe function)
  onTriggerSync: (callback) => unsubscribe
  onShowSyncLog: (callback) => unsubscribe
  onShowConflicts: (callback) => unsubscribe
  onShowServerConfig: (callback) => unsubscribe
}

window.platform {
  isWindows: boolean
  isMac: boolean
  isLinux: boolean
  platform: string
  arch: string
  minimize: () => void
  maximize: () => void
  close: () => void
}
```

---

### 3. **React Frontend** (`resources/js/`)

#### **Entry Point** (`app.tsx`)

```tsx
createInertiaApp({
  // Component resolution
  resolve: (name) => import('./pages/' + name + '.tsx')
  
  // Setup: Renders AppWindowShell wrapper + Inertia App
  setup({ el, App, props }) {
    <ElectronBridge />          // Listen for Electron events
    <AppWindowShell>            // Window titlebar + children
      <App {...props} />        // Inertia-managed page
    </AppWindowShell>
  }
})
```

#### **Window Shell** (`components/app-window-shell.tsx`)

```tsx
// Top-level layout for Electron window
<div className="h-screen w-screen flex flex-col">
  <AppTitleBar />           // Custom Windows-style titlebar
  <div className="flex-1 overflow-hidden">
    {children}              // Page content (Inertia)
  </div>
</div>
```

#### **Electron Bridge** (`electron-bridge.tsx`)

Listens for Electron main process events:
```tsx
useEffect(() => {
  window.electronAPI.onShowServerConfig(() => {
    setShowConfig(true)  // Open server config modal
  })
  
  // Cleanup unsubscribe
  return () => unsubscribe()
}, [])
```

#### **Page Components** (`pages/`)

Standard Inertia pages that render server-provided props:

```tsx
// Example: stock-take-records-display.tsx
export default function StockTakeRecordsDisplay(props) {
  return (
    <Layout>
      <h1>Stock Take Records</h1>
      {/* Use props.records, props.auth, etc. */}
    </Layout>
  )
}
```

---

### 4. **Laravel Backend** (`app/`, `routes/`, `config/`)

#### **Routes** (`routes/web.php`)

Inertia routes that render React pages:

```php
Route::middleware(['auth', 'verified'])->group(function () {
  Route::get('/', fn() => Inertia::render('welcome'));
  Route::get('dashboard', fn() => Inertia::render('dashboard'));
  
  // API endpoints for data
  Route::resource('stock-take-records', StockTakeRecordController::class);
  Route::resource('tension-records', TensionRecordController::class);
});
```

#### **Controllers** (`app/Http/Controllers/Api/`)

Handle CRUD operations and sync:

```php
class StockTakeRecordController extends Controller {
  public function index() { /* fetch records */ }
  public function store(Request $request) { /* create */ }
  public function show(StockTakeRecord $record) { /* fetch one */ }
  public function update(...) { /* update */ }
  public function destroy(...) { /* delete */ }
  
  // Sync-specific
  public function getSession($sessionId) { /* for offline sync */ }
  public function checkBatch(...) { /* check batch conflict */ }
  public function recordBatch(...) { /* record batch */ }
}
```

#### **Models** (`app/Models/`)

Eloquent models with sync tracking:

```php
class TensionRecord extends Model {
  protected $fillable = ['record_type', 'machine_number', 'operator', ...];
  
  // Relationships
  public function problems() { return $this->hasMany(TensionProblem::class); }
  public function measurements() { return $this->hasMany(TensionMeasurement::class); }
}
```

---

## Data Flow

### Online Workflow

```
User Action in React
    ↓
Submit Form via Inertia POST/PATCH
    ↓
Laravel Controller validates & saves to PostgreSQL/SQLite
    ↓
Controller returns JSON response with updated data
    ↓
Inertia updates component props
    ↓
React re-renders with new data
```

### Offline Workflow (Desktop)

```
User Action in React (No Network)
    ↓
Save to Local SQLite via Electron IPC
    ↓
Mark record with local_modified = 1
    ↓
Display "Pending Sync" indicator
    ↓
Network Restored → Sync Triggered
    ↓
Upload local changes to Laravel API
    ↓
Download server changes
    ↓
Merge/resolve conflicts if any
    ↓
Mark as synced_at = NOW, remote_id = server_id
    ↓
Display "Synced" indicator
```

---

## Build & Development Process

### Development Mode

**Terminal 1 - Laravel Server:**
```bash
composer dev          # Starts on http://127.0.0.1:8000
```

**Terminal 2 - Electron Dev:**
```bash
npm run electron:dev  # Waits for Vite (5173), then opens Electron
# Or manually:
npm run dev           # Terminal 2a - Start Vite dev server (5173)
npm run electron:start # Terminal 2b - Open Electron (connects to 8000)
```

**What Happens:**
1. Vite compiles React/CSS → served on localhost:5173
2. Laravel API runs on localhost:8000
3. Electron loads http://127.0.0.1:8000
4. Browser connects to API at same origin
5. DevTools open for debugging

### Production Build

```bash
npm run electron:build    # Build frontend + create installers
npm run electron:make:win # Windows only
```

**What Happens:**
1. Vite builds optimized React bundle
2. Electron Forge packages app
3. Squirrel installer created (Windows)
4. Installers placed in `/out/make/`

---

## Local SQLite Database Schema

Located at: `%APPDATA%/anufa-minerva/anufa-minerva-local.db`

**Tables:**

| Table | Purpose | Sync Fields |
|-------|---------|------------|
| `users` | Offline user data | `local_modified`, `synced_at`, `remote_id` |
| `tension_records` | Offline tension data | `local_modified`, `synced_at`, `remote_id` |
| `twisting_measurements` | Spindle measurements | `local_modified`, `synced_at`, `remote_id` |
| `weaving_measurements` | Weaving grid data | `local_modified`, `synced_at`, `remote_id` |
| `tension_problems` | Issues found | `local_modified`, `synced_at`, `remote_id` |
| `stock_taking_records` | Stock session data | `local_modified`, `synced_at`, `remote_id` |
| `finish_earlier_records` | Early finish data | `local_modified`, `synced_at`, `remote_id` |
| `sync_transport_logs` | Sync audit trail | — |
| `data_conflicts` | Conflict tracking | — |
| `app_settings` | App config (server URL) | — |

**Key Columns (All Tables):**
```sql
-- Sync Tracking
local_modified BOOLEAN       -- 1 if changed locally, 0 if synced
synced_at TEXT              -- ISO timestamp of last sync
remote_id INTEGER           -- Server-side record ID
deleted_at TEXT             -- Soft delete timestamp
```

---

## Configuration Files

### `forge.config.cjs`

Electron Forge packager config:
- **Icon**: `./public/favicon`
- **App ID**: `com.anufa.minerva`
- **Makers**: Squirrel (Windows), ZIP, DEB, RPM
- **Ignored Paths**: vendor/, storage/, tests/, composer files
- **Native Modules**: Rebuilds `better-sqlite3` for platform

### `vite.config.ts`

Frontend build config:
- **Input**: `resources/css/app.css`, `resources/js/app.tsx`
- **Plugins**: 
  - `laravel-vite-plugin` (Inertia)
  - `@vitejs/plugin-react` (React)
  - `@tailwindcss/vite` (Tailwind)
  - `wayfinder` (Form variants)
- **Output**: Dist folder for production builds

### `package.json` (Key Scripts)

```json
{
  "scripts": {
    "dev": "vite",                           // Dev server (5173)
    "build": "vite build",                   // Production build
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://127.0.0.1:5173 && electron .\"",
    "electron:start": "electron .",          // Just run Electron
    "electron:build": "npm run build && electron-forge make",
    "electron:make:win": "electron-forge make --platform=win32"
  }
}
```

---

## Menu Structure

```
File
  ├─ Configure Server    → Show ServerConfigModal
  ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  ├─ Data Sync
  │  ├─ Sync Now          → Send 'trigger-sync' IPC
  │  ├─ View Sync Log     → Send 'show-sync-log' IPC
  │  └─ Resolve Conflicts → Send 'show-conflicts' IPC
  ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  └─ Exit

Edit
  ├─ Undo
  ├─ Redo
  ├─ Cut, Copy, Paste
  └─ Select All

View
  ├─ Reload
  ├─ Force Reload
  ├─ Toggle DevTools
  ├─ Zoom Controls
  └─ Toggle Fullscreen

Help
  ├─ About
  └─ Documentation
```

---

## Environment Detection

### In React:

```tsx
const isElectron = await window.electronAPI?.isElectron?.();
const dbPath = await window.electronAPI?.getDbPath?.();
const platform = window.platform.isWindows ? 'Windows' : 'Web';
```

### In Laravel:

Apps running through Electron still use normal Laravel routing—no special detection needed. The Electron process is transparent to the server.

---

## Security Considerations

1. **Preload Script Isolation**
   - Only safe APIs exposed via `contextBridge`
   - No direct access to `ipcRenderer` or Node modules
   - No eval/dynamic script execution

2. **IPC Parameter Validation**
   - SQL injection risk: Use parameterized queries
   - Always validate table names in dynamic queries
   - Sanitize user input before storing

3. **Database Access**
   - Local SQLite only stores user's own data
   - No multi-user local access control
   - Server still enforces auth on API endpoints

4. **Electron Fuses (Hardened)**
   - RunAsNode: disabled
   - CookieEncryption: enabled
   - ASAR integrity validation: enabled
   - Only load app from ASAR archive

---

## Troubleshooting

### Error: "Cannot find module 'better-sqlite3'"

Rebuild native modules:
```bash
npm rebuild better-sqlite3 --build-from-source
```

### Electron won't start in dev mode

Ensure Laravel is running:
```bash
php artisan serve
# Then in another terminal:
npm run electron:start
```

### IPC Channel Not Found

Check:
1. Is `ipcMain.handle('channel-name')` registered in `main.cjs`?
2. Is the preload script loaded? (Check DevTools console)
3. Are you calling it correctly? `await window.electronAPI.methodName()`

### Local Database Locked

Close all Electron instances and delete the `.db-wal` file:
```bash
rm %APPDATA%\anufa-minerva\*.db-wal
```

---

## Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Electron Main** | Node.js + Electron API | Window, menu, IPC, local DB |
| **IPC Bridge** | Electron preload | Secure API exposure |
| **React Frontend** | React + TypeScript | UI/UX, sync logic |
| **Inertia** | Inertia.js | SSR-like page hydration |
| **Laravel Backend** | PHP + Eloquent | API, auth, business logic |
| **Local Storage** | SQLite3 | Offline data, conflict tracking |
| **Build Tools** | Vite + Electron Forge | Bundling & packaging |

This architecture enables:
✅ **Offline-first** desktop app with local SQLite  
✅ **Real-time sync** when network restored  
✅ **Conflict resolution** for concurrent edits  
✅ **Cross-platform** builds (Windows, Linux, macOS)  
✅ **Web-first** with Electron wrapper (no code duplication)
