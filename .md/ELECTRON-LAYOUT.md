# Electron Layout - Visual Reference

## Window Layout (macOS/Windows/Linux)

```
┌─────────────────────────────────────────────────────────────────┐
│ ❌  ⊟  ⊠  anufa-minerva                         🔔 ⚙️  💻     │  ← App Title Bar
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📌 Dashboard                                                   │
│  ├─ 📊 Tension Records                                         │
│  │  ├─ Twisting Tension                                        │
│  │  └─ Weaving Tension                                         │
│  ├─ 📦 Stock Take Records                                      │
│  └─ ⏱️  Finish Earlier                                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Stock Take Records                  🔄 ⏳ Pending Sync  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  Session ID    │ Status    │ Batches │ Last Updated    │   │
│  │  ────────────────────────────────────────────────────  │   │
│  │  STK-20260116 │ Completed │  12     │ 16 Jan, 10:30   │   │
│  │  STK-20260115 │ Pending   │  8      │ 15 Jan, 14:22   │   │
│  │  STK-20260114 │ Completed │  15     │ 14 Jan, 16:45   │   │
│  │                                                         │   │
│  │  [New Session] [View Details] [Download CSV]           │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### App Title Bar Components

```
┌─────────────────────────────────────────────────────────────┐
│ [❌] [⊟] [⊠]  AppName                 [Status] [Settings] [?]
│
│ ❌ = Close Window (Ctrl+Q)
│ ⊟  = Minimize (Ctrl+M)
│ ⊠  = Maximize (Ctrl+F)
│
│ [Status] = Network indicator or sync status
│            ● Online
│            ○ Offline
│            ⟳ Syncing...
│
│ [Settings] = Menu (File, Edit, View, Help)
│ [?] = Help/About
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure (Component Layout)

```
resources/js/
├── app.tsx                          ← Entry point
│   └── ElectronBridge               ← Listens to Electron events
│       └── AppWindowShell           ← Top-level shell (titlebar + content)
│           └── App (Inertia)        ← Page routing
│               ├── welcome.tsx      ← Landing page
│               ├── dashboard.tsx    ← Main dashboard
│               ├── layouts/         ← Layout components
│               │   ├── app-layout.tsx        ← For authenticated pages
│               │   └── auth-layout.tsx       ← For login/register
│               └── pages/           ← Inertia pages
│                   ├── tension-records-display.tsx
│                   ├── stock-take-records-display.tsx
│                   ├── batch-stock-taking-main.tsx
│                   ├── twisting-tension-main.tsx
│                   ├── weaving-tension-main.tsx
│                   ├── finish-earlier-records-display.tsx
│                   └── admin/       ← Admin section
│                       ├── dashboard.tsx
│                       ├── users.tsx
│                       └── data-sync.tsx
│
├── components/
│   ├── app-window-shell.tsx   ← Window frame (titlebar + content)
│   ├── app-title-bar.tsx      ← Custom Windows controls
│   ├── server-config-modal    ← Server URL setup modal
│   ├── sync-status-badge.tsx  ← Shows sync indicator
│   ├── conflict-resolver.tsx  ← Conflict UI
│   └── ...other UI components
│
├── layouts/
│   ├── app-layout.tsx         ← Main layout (sidebar + header)
│   └── auth-layout.tsx        ← Login/register layout
│
├── hooks/
│   ├── use-electron-api.ts    ← Electron API wrapper
│   ├── use-sync-status.ts     ← Sync state management
│   ├── use-offline.ts         ← Network state detection
│   └── use-appearance.ts      ← Theme initialization
│
├── utils/
│   ├── sync-manager.ts        ← Sync logic
│   ├── conflict-resolver.ts   ← Conflict handling
│   └── db-operations.ts       ← Local DB helpers
│
└── types/
    ├── electron.d.ts          ← Type definitions for window.electronAPI
    └── models.ts              ← Shared type definitions
```

---

## Component Hierarchy

```
┌───────────────────────────────────────────────────────────────┐
│ App.tsx (Inertia Entry)                                       │
└─────────┬─────────────────────────────────────────────────────┘
          │
          ├─ ElectronBridge.tsx
          │  └─ Listens for Electron IPC events:
          │     • trigger-sync
          │     • show-sync-log
          │     • show-conflicts
          │     • show-server-config
          │
          └─ AppWindowShell.tsx
             ├─ AppTitleBar.tsx (Custom window controls)
             │  ├─ Minimize button → window.platform.minimize()
             │  ├─ Maximize button → window.platform.maximize()
             │  └─ Close button → window.platform.close()
             │
             └─ Inertia App (Page Router)
                │
                ├─ Layout Selection
                │  ├─ If auth → AppLayout.tsx
                │  │   ├─ Sidebar (Navigation)
                │  │   │  ├─ Dashboard Link
                │  │   │  ├─ Records Links
                │  │   │  ├─ Admin Link (if admin)
                │  │   │  └─ Settings Link
                │  │   ├─ Header
                │  │   │  ├─ Breadcrumbs
                │  │   │  ├─ Sync Status Badge
                │  │   │  └─ User Menu
                │  │   └─ Content Area
                │  │       └─ Page Component
                │  │
                │  └─ If not auth → AuthLayout.tsx
                │      ├─ Logo
                │      └─ Login Form
                │
                └─ Page Components (pages/*.tsx)
                   ├─ welcome.tsx
                   ├─ dashboard.tsx
                   ├─ tension-records-display.tsx
                   ├─ stock-take-records-display.tsx
                   ├─ twisting-tension-main.tsx
                   ├─ weaving-tension-main.tsx
                   ├─ batch-stock-taking-main.tsx
                   ├─ finish-earlier-records-display.tsx
                   └─ admin/
                       ├─ dashboard.tsx
                       ├─ users.tsx
                       ├─ permissions.tsx
                       └─ data-sync.tsx
```

---

## Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  User Interaction (onClick, onChange, onSubmit)                │
│        │                                                         │
│        ▼                                                         │
│  React Component State Update                                  │
│        │                                                         │
│  ┌─────┴──────────────────────┐                                │
│  │                            │                                │
│  │ ONLINE (Web Mode)          │ OFFLINE (Electron Mode)        │
│  │                            │                                │
│  ▼                            ▼                                │
│  │                            │                                │
│  │ POST /api/records   │  await window.electronAPI.dbExecute(  │
│  │                     │  'INSERT INTO ...', [...])            │
│  │        │             │            │                         │
│  │        ▼             │            ▼                         │
│  │  Laravel API         │  Local SQLite DB                     │
│  │        │             │            │                         │
│  │        ▼             │            ▼                         │
│  │  PostgreSQL/MySQL    │  Electron IPC Handler               │
│  │        │             │            │                         │
│  │        └─────┬───────┴────────────┘                         │
│  │              │                                              │
│  │              ▼                                              │
│  │      Response/Result                                        │
│  │              │                                              │
│  │              ▼                                              │
│  │      Update Component Props/State                          │
│  │              │                                              │
│  │              ▼                                              │
│  │      Re-render UI                                          │
│  │                                                             │
│  └──────────────────────────────────────────────────────────┘
│
│  SYNC PROCESS (Electron Only)
│        │
│        ▼
│  User clicks: File → Data Sync → Sync Now
│        │
│        ▼
│  performSync()
│        │
│        ├─ electronAPI.getUnsyncedRecords('table')
│        │        └─ Query local DB for local_modified = 1
│        │
│        ├─ fetch('/api/sync', { POST unsynced records })
│        │        └─ Send to Laravel API
│        │
│        ├─ For each record:
│        │   ├─ If success: electronAPI.markAsSynced(...)
│        │   │   └─ UPDATE local DB: synced_at, remote_id
│        │   │
│        │   └─ If conflict: electronAPI.createConflict(...)
│        │       └─ INSERT into data_conflicts table
│        │
│        ├─ electronAPI.logSyncTransport(...)
│        │   └─ Log each operation to audit trail
│        │
│        └─ Update UI: "✅ Sync complete" or "⚠️ Conflicts pending"
│
└──────────────────────────────────────────────────────────────────┘
```

---

## Electron Process Model

```
┌────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Node.js, electron/main.cjs)                 │
│                                                            │
│ • Window management (create, show, hide, close)           │
│ • Menu creation and events                                │
│ • IPC handlers setup                                      │
│ • Local SQLite DB access                                 │
│ • App lifecycle (ready, quit, activate)                  │
│ • Dialog windows (save, open, message)                   │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ IPC Handlers (setupIpcHandlers())                    │ │
│  │                                                      │ │
│  │ • get-db-path                                       │ │
│  │ • get-server-url / set-server-url                   │ │
│  │ • db-execute / db-batch-execute                     │ │
│  │ • get-unsynced-records                              │ │
│  │ • mark-as-synced                                    │ │
│  │ • log-sync-transport                                │ │
│  │ • create-conflict / get-pending-conflicts           │ │
│  │ • resolve-conflict                                  │ │
│  │ • export-database / import-database                 │ │
│  │ • window:minimize / maximize / close                │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Local SQLite Database                               │ │
│  │                                                      │ │
│  │ • tension_records                                   │ │
│  │ • twisting_measurements                             │ │
│  │ • weaving_measurements                              │ │
│  │ • tension_problems                                  │ │
│  │ • stock_taking_records                              │ │
│  │ • finish_earlier_records                            │ │
│  │ • sync_transport_logs                               │ │
│  │ • data_conflicts                                    │ │
│  │ • app_settings                                      │ │
│  └──────────────────────────────────────────────────────┘ │
└────┬───────────────────────────────────────────────────────┘
     │ IPC (Inter-Process Communication)
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ PRELOAD SCRIPT (electron/preload.cjs)                      │
│                                                            │
│ contextBridge.exposeInMainWorld('electronAPI', {          │
│   isElectron,                                             │
│   getDbPath, getAppDataPath,                              │
│   getServerUrl, setServerUrl,                             │
│   dbExecute, dbBatchExecute,                              │
│   getUnsyncedRecords, markAsSynced,                        │
│   logSyncTransport, getSyncLogs,                           │
│   createConflict, getPendingConflicts, resolveConflict,    │
│   exportDatabase, importDatabase,                          │
│   onTriggerSync, onShowSyncLog, onShowConflicts            │
│ })                                                         │
│                                                            │
│ contextBridge.exposeInMainWorld('platform', {             │
│   isWindows, isMac, isLinux,                               │
│   platform, arch,                                         │
│   minimize, maximize, close                               │
│ })                                                         │
└────┬───────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ RENDERER PROCESS (Chromium, React)                         │
│                                                            │
│ window.electronAPI.dbExecute(...)  ← Call main process   │
│ window.platform.minimize()         ← Control window       │
│                                                            │
│ App.tsx (Inertia)                                         │
│  ├─ ElectronBridge (listens to events from main)          │
│  ├─ AppWindowShell (window frame)                         │
│  ├─ Pages (React components)                             │
│  └─ Hooks (custom hooks for Electron API)                │
│                                                            │
│ Communicates with:                                         │
│  • Electron Main Process (IPC)                            │
│  • Laravel API (HTTP)                                    │
│  • Local SQLite (via Electron IPC)                        │
└────────────────────────────────────────────────────────────┘
```

---

## Menu Structure (Electron)

```
File
├─ Configure Server
│  └─ Shows ServerConfigModal
│     (Set Laravel server URL)
│
├─────── SEPARATOR ──────
│
├─ Data Sync
│  ├─ Sync Now (Ctrl+S)
│  │  └─ mainWindow.webContents.send('trigger-sync')
│  │
│  ├─ View Sync Log
│  │  └─ mainWindow.webContents.send('show-sync-log')
│  │
│  └─ Resolve Conflicts
│     └─ mainWindow.webContents.send('show-conflicts')
│
├─────── SEPARATOR ──────
│
└─ Exit (Ctrl+Q)
   └─ Close application


Edit
├─ Undo (Ctrl+Z)
├─ Redo (Ctrl+Shift+Z)
├─────── SEPARATOR ──────
├─ Cut (Ctrl+X)
├─ Copy (Ctrl+C)
├─ Paste (Ctrl+V)
└─ Select All (Ctrl+A)


View
├─ Reload (Ctrl+R)
├─ Force Reload (Ctrl+Shift+R)
├─ Toggle Developer Tools (Ctrl+Shift+I)
├─────── SEPARATOR ──────
├─ Reset Zoom (Ctrl+0)
├─ Zoom In (Ctrl+=)
├─ Zoom Out (Ctrl+-)
├─────── SEPARATOR ──────
└─ Toggle Full Screen (F11)


Help
├─ About
│  └─ Shows version info and system details
│
└─ Documentation
   └─ Opens GitHub wiki in default browser
```

---

## Sync Status Badge Placement

```
┌─────────────────────────────────────────────────────┐
│ AppLayout.tsx                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Header                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  Breadcrumb    │                    │       │   │
│  │  Dashboard     │                    │ ⟳⟳⟳  │   │ ← SyncStatusBadge
│  │                │                    │       │   │    Shows:
│  │                │                    │ Synced│   │    • ● Online
│  └─────────────────────────────────────────────┘   │    • ○ Offline
│                                                     │    • ⟳ Syncing
│  Content Area                                       │    • ⚠️ Conflicts
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │  Your page content here                     │   │
│  │                                             │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Development vs Production Mode

### Development Mode

```
┌─────────────────────────────────────────────────┐
│ TERMINAL 1                                      │
│ $ composer dev                                  │
│ Starting Laravel server...                      │
│ Server running on http://127.0.0.1:8000        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ TERMINAL 2                                      │
│ $ npm run electron:dev                          │
│ (or run dev + electron:start separately)        │
│                                                 │
│ • Vite starts on http://127.0.0.1:5173         │
│ • Waits for Vite to be ready                   │
│ • Launches Electron app                        │
│ • Electron loads http://127.0.0.1:8000         │
│ • DevTools open automatically                  │
│ • Hot reload enabled                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ELECTRON WINDOW                                 │
│ http://127.0.0.1:8000 (via Electron)           │
│                                                 │
│ • Connects to Laravel API at same origin       │
│ • Asset requests go to Vite dev server (5173) │
│ • HMR (Hot Module Replacement) enabled         │
│ • Full DevTools with React DevTools            │
│ • SQLite available for testing offline         │
└─────────────────────────────────────────────────┘
```

### Production Mode

```
┌─────────────────────────────────────────────────┐
│ BUILD STEP                                      │
│ $ npm run build                                 │
│                                                 │
│ • Vite compiles React + CSS                    │
│ • Output: /dist folder                         │
│ • TypeScript → JavaScript                      │
│ • Tree-shaking & minification                  │
│ • Source maps (if enabled)                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ PACKAGE STEP                                    │
│ $ npm run electron:build                        │
│                                                 │
│ • Electron Forge packages app                  │
│ • Creates installers:                          │
│   - Windows: Squirrel + MSI installer          │
│   - Linux: DEB + RPM packages                  │
│   - macOS: DMG installer                       │
│ • Output: /out/make folder                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ INSTALLED APP                                   │
│                                                 │
│ User opens: AnufaMinerva.exe                   │
│                                                 │
│ • Electron loads from production build         │
│ • Must have server URL configured              │
│ • Connects to Laravel API (via setup.html)     │
│ • Local SQLite for offline support             │
│ • No DevTools                                  │
│ • No Hot reload                                │
└─────────────────────────────────────────────────┘
```

---

## Network Detection

```
┌─────────────────────────────────────────────────────┐
│ Browser API (window.navigator.onLine)               │
│                                                     │
│ window.addEventListener('online', () => {          │
│   console.log('Connected to network');             │
│   performSync();  ← Auto-sync when reconnected     │
│ });                                                │
│                                                    │
│ window.addEventListener('offline', () => {         │
│   console.log('Lost network connection');          │
│   setMode('offline');  ← Switch to offline mode    │
│ });                                                │
└─────────────────────────────────────────────────────┘

        ↓

┌─────────────────────────────────────────────────────┐
│ Sync Status                                         │
│                                                    │
│ Online ● → [Sync Status Badge shows "● Online"]   │
│          → User can use API                       │
│          → User can still use local DB            │
│                                                    │
│ Offline ○ → [Sync Status Badge shows "○ Offline"]│
│           → API calls fail gracefully             │
│           → User must use local DB                │
│           → Data marked for sync on reconnect    │
└─────────────────────────────────────────────────────┘
```

---

## Summary

**Layout Hierarchy:**
```
Electron Main Window
  ↓
AppWindowShell (Frame)
  ├─ AppTitleBar (Controls)
  └─ Content Area
     ├─ Sidebar Navigation
     ├─ Header (Breadcrumb + Sync Badge)
     └─ Page Content (Inertia Page)
```

**Communication Paths:**
```
React ←IPC→ Electron Main ←SQL→ Local SQLite
     ↓
  Laravel API ←SQL→ Server Database
```

**Key Features:**
✅ Custom window chrome (titlebar)  
✅ Local SQLite for offline support  
✅ Seamless sync when online  
✅ Conflict tracking & resolution  
✅ IPC bridge for safe API access  
✅ Cross-platform builds
