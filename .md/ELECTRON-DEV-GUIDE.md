# Electron Development Quick Reference

## Common Tasks

### 1. **Adding a New Inertia Page**

**Step 1: Create React component** (`resources/js/pages/MyNewPage.tsx`)
```tsx
import React from 'react';
import AppLayout from '@/layouts/app-layout';

export default function MyNewPage({ data }) {
  return (
    <AppLayout>
      <div className="p-6">
        <h1>My New Page</h1>
        {/* Your component */}
      </div>
    </AppLayout>
  );
}
```

**Step 2: Create Laravel route** (`routes/web.php`)
```php
Route::get('/my-page', function () {
    return Inertia::render('MyNewPage', [
        'data' => MyModel::all(),
    ]);
})->middleware(['auth', 'verified'])->name('my-page');
```

**Step 3: Access from app**
- Web: `http://localhost:8000/my-page`
- Electron: Same URL (Electron loads from Laravel)

---

### 2. **Using Electron APIs in React**

```tsx
import { useState, useEffect } from 'react';

export default function MyComponent() {
  const [dbPath, setDbPath] = useState('');
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    const initElectron = async () => {
      // Check if running in Electron
      const electron = await window.electronAPI?.isElectron?.();
      setIsElectron(!!electron);

      if (electron) {
        // Get database path
        const path = await window.electronAPI.getDbPath();
        setDbPath(path);

        // Get server URL
        const url = await window.electronAPI.getServerUrl();
        console.log('Server URL:', url);

        // Listen for sync trigger
        const unsubscribe = window.electronAPI.onTriggerSync((event) => {
          console.log('Sync triggered from menu');
          // Handle sync
        });

        return () => unsubscribe();
      }
    };

    initElectron();
  }, []);

  return (
    <div>
      <p>Running in Electron: {isElectron ? 'Yes' : 'No'}</p>
      {isElectron && <p>DB Path: {dbPath}</p>}
    </div>
  );
}
```

---

### 3. **Reading/Writing Local Database (Electron)**

```tsx
import { useEffect, useState } from 'react';

export default function OfflineData() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const fetchFromLocal = async () => {
      // Check if Electron
      if (!window.electronAPI) {
        console.log('Not in Electron, skipping local DB');
        return;
      }

      // Query local database
      const result = await window.electronAPI.dbExecute(
        'SELECT * FROM stock_taking_records WHERE local_modified = 1',
        []
      );

      if (result.success) {
        setRecords(result.data);
      } else {
        console.error('DB Error:', result.error);
      }
    };

    fetchFromLocal();
  }, []);

  const saveToLocal = async (record) => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.dbExecute(
      `INSERT INTO stock_taking_records (session_id, status, local_modified, created_at)
       VALUES (?, ?, 1, datetime('now'))`,
      [record.sessionId, 'ongoing']
    );

    if (result.success) {
      console.log('Saved with ID:', result.lastInsertRowid);
      // Refresh list
      fetchFromLocal();
    }
  };

  return (
    <div>
      <h2>Local Records ({records.length})</h2>
      {records.map(rec => (
        <div key={rec.id}>
          {rec.session_id} - {rec.status}
        </div>
      ))}
    </div>
  );
}
```

---

### 4. **Batch Database Operations**

```tsx
const batchSave = async (records) => {
  const queries = records.map(record => ({
    sql: `INSERT INTO tension_records 
          (record_type, machine_number, operator, local_modified, created_at)
          VALUES (?, ?, ?, 1, datetime('now'))`,
    params: [record.type, record.machineNo, record.operator]
  }));

  const result = await window.electronAPI.dbBatchExecute(queries);

  if (result.success) {
    console.log('Inserted', result.results.length, 'records');
    result.results.forEach((res, idx) => {
      console.log(`Record ${idx}: ID ${res.lastInsertRowid}`);
    });
  }
};
```

---

### 5. **Detecting Platform**

```tsx
// Check OS
const isWindows = window.platform?.isWindows;
const isMac = window.platform?.isMac;
const isLinux = window.platform?.isLinux;
const arch = window.platform?.arch; // 'x64', 'arm64'

// Window controls (Electron only)
const handleMinimize = () => window.platform?.minimize?.();
const handleMaximize = () => window.platform?.maximize?.();
const handleClose = () => window.platform?.close?.();
```

---

### 6. **Handling Sync Events**

```tsx
export default function SyncManager() {
  useEffect(() => {
    if (!window.electronAPI) return;

    // Listen for trigger-sync from menu
    const unsubscribeTrigger = window.electronAPI.onTriggerSync(() => {
      console.log('Menu: Sync Now clicked');
      performSync();
    });

    // Listen for show-sync-log from menu
    const unsubscribeLog = window.electronAPI.onShowSyncLog(() => {
      console.log('Menu: View Sync Log clicked');
      showSyncLogModal();
    });

    // Listen for show-conflicts from menu
    const unsubscribeConflicts = window.electronAPI.onShowConflicts(() => {
      console.log('Menu: Resolve Conflicts clicked');
      showConflictsModal();
    });

    return () => {
      unsubscribeTrigger?.();
      unsubscribeLog?.();
      unsubscribeConflicts?.();
    };
  }, []);

  const performSync = async () => {
    // 1. Upload local changes
    const unsynced = await window.electronAPI.getUnsyncedRecords('tension_records');
    // 2. Send to server API
    // 3. Mark as synced
    await window.electronAPI.markAsSynced('tension_records', localId, remoteId);
  };
}
```

---

### 7. **Conflict Resolution**

```tsx
const handleConflict = async (conflict) => {
  // User chose to keep server version
  const resolution = {
    status: 'resolved',
    user_id: userId,
    notes: 'Kept remote version',
    merged_data: null // or custom merged data
  };

  const result = await window.electronAPI.resolveConflict(
    conflict.id,
    resolution
  );

  if (result.success) {
    console.log('Conflict resolved');
    // Refresh conflicts list
  }
};
```

---

### 8. **Export/Import Database**

```tsx
const handleExportDb = async () => {
  const result = await window.electronAPI.exportDatabase();
  if (result.success) {
    alert(`Backup saved to: ${result.path}`);
  } else {
    alert(`Error: ${result.error}`);
  }
};

const handleImportDb = async () => {
  const result = await window.electronAPI.importDatabase();
  if (result.success) {
    alert('Database imported successfully');
    window.location.reload(); // Reload to see new data
  } else {
    alert(`Error: ${result.error}`);
  }
};
```

---

### 9. **Adding IPC Handler (Backend)**

Edit `electron/main.cjs`:

```javascript
// Add new IPC handler in setupIpcHandlers()
ipcMain.handle('my-custom-channel', (event, arg1, arg2) => {
  try {
    // Do something with arg1, arg2
    const result = doSomething(arg1, arg2);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

Edit `electron/preload.cjs`:

```javascript
// Add to electronAPI object
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods
  myCustomMethod: (arg1, arg2) => 
    ipcRenderer.invoke('my-custom-channel', arg1, arg2),
});
```

Use in React:

```tsx
const result = await window.electronAPI.myCustomMethod(arg1, arg2);
```

---

### 10. **Adding Menu Item**

Edit `electron/main.cjs`, in `createMenu()`:

```javascript
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'My New Action',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            // Send IPC to React
            mainWindow.webContents.send('my-new-action');
          }
        },
        // ... rest of submenu
      ]
    },
    // ... other menus
  ];
  // ...
}
```

Listen in React:

```tsx
useEffect(() => {
  const unsubscribe = window.electronAPI.onMyNewAction?.(() => {
    console.log('Menu action triggered');
  });
  return () => unsubscribe?.();
}, []);
```

---

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (5173) |
| `npm run electron:start` | Open Electron (loads http://127.0.0.1:8000) |
| `npm run electron:dev` | Start Vite + Electron concurrently |
| `npm run build` | Production build (output in `dist/`) |
| `npm run electron:build` | Build + create installers |
| `npm run electron:make:win` | Windows installer only |
| `npm run format` | Format code with Prettier |
| `npm run lint` | Lint with ESLint |
| `npm run types` | Type check with TypeScript |
| `composer dev` | Start Laravel server (8000) |

---

## Debugging

### **DevTools in Electron**

DevTools automatically opens in development mode. To toggle:
```
Ctrl+Shift+I  (or F12)
```

### **Inspect Electron Process**

DevTools shows:
- **Console**: Logs from React + Electron preload
- **Network**: API calls to Laravel
- **Storage**: Local SQLite (via IPC results)
- **React DevTools**: Component tree, props, state

### **Enable DevTools in Production**

Edit `electron/main.cjs`:
```javascript
if (isDev) {
  mainWindow.webContents.openDevTools();  // ← Add this line
}
```

### **Debug IPC**

Add logging in main.cjs:
```javascript
ipcMain.handle('my-channel', (event, ...args) => {
  console.log('[IPC] my-channel called with:', args);
  // ...
  return result;
});
```

In React:
```tsx
const result = await window.electronAPI.myMethod();
console.log('[IPC Response]', result);
```

---

## Common Issues

### **"Port 5173 already in use"**
```bash
netstat -ano | findstr :5173     # Find process
taskkill /PID <PID> /F            # Kill it
```

### **Database file locked**
```bash
# Close all Electron instances
# Delete WAL files
del %APPDATA%\anufa-minerva\*.db-wal
```

### **"Cannot find module" in Electron**
Rebuild native modules:
```bash
npm rebuild --build-from-source
```

### **Electron loads blank page**
1. Check Laravel is running: `php artisan serve`
2. Check Electron loads from correct URL in `main.cjs`
3. Check DevTools for console errors

---

## File Locations (Users)

| Purpose | Path |
|---------|------|
| **Local Database** | `%APPDATA%/anufa-minerva/anufa-minerva-local.db` |
| **App Logs** | `%APPDATA%/anufa-minerva/logs/` |
| **User Data** | `%APPDATA%/anufa-minerva/` |

---

## Architecture Recap

```
┌─────────────────────────────────────┐
│  Electron Main Process              │
│  ├─ Window Management               │
│  ├─ IPC Handlers                    │
│  ├─ Local SQLite DB                 │
│  └─ Menu                            │
└────────────┬────────────────────────┘
             │ IPC Bridge (preload.cjs)
             ↓
┌─────────────────────────────────────┐
│  React Frontend (Inertia)           │
│  ├─ Pages                           │
│  ├─ Components                      │
│  └─ Electron API Access             │
└────────────┬────────────────────────┘
             │ HTTP/API
             ↓
┌─────────────────────────────────────┐
│  Laravel Server (8000)              │
│  ├─ Inertia Routes                  │
│  ├─ API Controllers                 │
│  └─ Database                        │
└─────────────────────────────────────┘
```

---

## Resources

- **Electron Docs**: https://www.electronjs.org/docs
- **Inertia.js**: https://inertiajs.com/
- **Laravel**: https://laravel.com/docs
- **React**: https://react.dev/
- **SQLite3**: https://www.sqlite.org/lang.html
