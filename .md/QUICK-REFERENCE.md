# Quick Reference Card - Anufa Minerva

## 🚀 Quick Start (Copy & Paste)

```bash
# Terminal 1: Laravel Server
composer install
composer dev

# Terminal 2: Vite Dev Server
npm install
npm run dev

# Terminal 3: Open Electron
npm run electron:start

# Then visit: http://127.0.0.1:8000
```

---

## 📁 Key Files

| File | Purpose | Language |
|------|---------|----------|
| `electron/main.cjs` | Window, IPC, database | JavaScript |
| `electron/preload.cjs` | API bridge | JavaScript |
| `resources/js/app.tsx` | Entry point | TypeScript |
| `routes/web.php` | Page routes | PHP |
| `app/Http/Controllers/Api/*` | API endpoints | PHP |
| `app/Models/*` | Database models | PHP |

---

## 🔧 Common Commands

| Task | Command |
|------|---------|
| **Start Dev** | `npm run dev` |
| **Start Electron** | `npm run electron:start` |
| **Build** | `npm run build` |
| **Build App** | `npm run electron:build` |
| **Windows Build** | `npm run electron:make:win` |
| **Lint** | `npm run lint` |
| **Type Check** | `npm run types` |
| **Format Code** | `npm run format` |
| **Laravel Server** | `composer dev` |
| **Migrations** | `php artisan migrate` |

---

## 🧠 Architecture in 30 Seconds

```
┌─────────────────────────────────┐
│ User's Screen (Browser/Electron)│
│    ↓                            │
│ React + TypeScript              │
│    ↓                            │
│ Inertia.js ←→ Laravel API       │
│    ↓                            │
│ PostgreSQL/MySQL Database       │
│                                 │
│ (Electron Only)                 │
│ ↓                               │
│ SQLite Local DB (Offline)       │
└─────────────────────────────────┘
```

---

## 💻 Adding a New Page

```tsx
// 1. Create React component
// resources/js/pages/MyNewPage.tsx
export default function MyNewPage({ data }) {
  return <div>{data}</div>;
}

// 2. Create Laravel route
// routes/web.php
Route::get('/my-page', fn() => Inertia::render('MyNewPage', [
    'data' => MyModel::all(),
]))->middleware(['auth', 'verified']);

// 3. Access it
// http://127.0.0.1:8000/my-page
```

---

## 🔌 Using Electron API

```tsx
// Check if running in Electron
const isElectron = await window.electronAPI?.isElectron?.();

// Save to local database
const result = await window.electronAPI.dbExecute(
  'INSERT INTO table (col) VALUES (?)',
  [value]
);

// Get unsynced records
const records = await window.electronAPI.getUnsyncedRecords('table_name');

// Listen for sync trigger from menu
window.electronAPI.onTriggerSync?.(() => {
  console.log('Sync triggered from File menu');
});
```

---

## 🗄️ Local SQLite Tables

```sql
tension_records          -- Main data table
├─ local_modified = 1    -- If changed locally
├─ synced_at = NULL      -- Not synced yet
└─ remote_id = NULL      -- No server ID yet

twisting_measurements    -- Spindle measurements
weaving_measurements     -- Weaving grid
tension_problems         -- Issues found
stock_taking_records     -- Stock sessions
finish_earlier_records   -- Early finish records
sync_transport_logs      -- Audit trail
data_conflicts           -- Conflict tracking
```

---

## 🔄 Sync Workflow

```
Offline User Creates Record
    ↓
Save to Local SQLite (local_modified=1)
    ↓
User comes online
    ↓
User clicks: File → Data Sync → Sync Now
    ↓
Send to Server API
    ↓
Server responds with remote_id
    ↓
Update Local: synced_at=NOW, remote_id=42
    ↓
Done! (or Conflict → Admin resolves)
```

---

## 📱 Window Controls

```javascript
// In Electron window
Ctrl+Shift+I     // Open DevTools
F5               // Reload
Ctrl+Shift+R     // Force reload
Ctrl+,           // Open settings
Alt+Left         // Go back
Alt+Right        // Go forward
```

---

## 🐛 Debugging

```tsx
// Check Electron API
console.log(window.electronAPI);  // Should not be undefined
console.log(window.platform);     // Platform info

// Check network
// DevTools → Network tab
// Look for failed requests (red)

// Check console errors
// DevTools → Console tab
// Red errors = problems

// Log to file
console.log(...) → DevTools → Right-click → Save as...
```

---

## ⚠️ Common Errors

| Error | Fix |
|-------|-----|
| `Cannot find module 'better-sqlite3'` | `npm rebuild better-sqlite3 --build-from-source` |
| `Port 5173 already in use` | `taskkill /F /IM node.exe` |
| `Port 8000 already in use` | `taskkill /F /IM php.exe` |
| Blank Electron window | Check Laravel is running on 8000 |
| `electronAPI is not defined` | DevTools opened? Reload (F5) |

---

## 📚 Documentation Map

| Need | File |
|------|------|
| Start here | [DOC-INDEX.md](DOC-INDEX.md) |
| Learn architecture | [ELECTRON-ARCHITECTURE.md](ELECTRON-ARCHITECTURE.md) |
| Code examples | [ELECTRON-DEV-GUIDE.md](ELECTRON-DEV-GUIDE.md) |
| Offline features | [ELECTRON-SYNC-GUIDE.md](ELECTRON-SYNC-GUIDE.md) |
| Visual overview | [ELECTRON-LAYOUT.md](ELECTRON-LAYOUT.md) |
| Fix problems | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Complete reference | [CODEBASE-OVERVIEW.md](CODEBASE-OVERVIEW.md) |

---

## 🎯 Feature List

✅ Tension Records (Twisting & Weaving)  
✅ Stock Taking  
✅ Finish Earlier Records  
✅ Offline-First Desktop App  
✅ Auto-Sync when Online  
✅ Conflict Resolution  
✅ Admin Dashboard  
✅ User Management  
✅ 2FA Authentication  
✅ CSV/PDF Export  

---

## 🏗️ Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Desktop | Electron | 32.x |
| Frontend | React | 19.x |
| Language | TypeScript | 5.7.x |
| Build | Vite | 7.x |
| Styling | Tailwind | 4.x |
| Components | Radix UI | Latest |
| Server Rendering | Inertia.js | 2.1.x |
| Backend | Laravel | 11.x |
| Auth | Sanctum | Latest |
| Local DB | SQLite | 3.x |

---

## 📋 Development Checklist

Adding a new feature?

- [ ] Create React component(s)
- [ ] Add Inertia route
- [ ] Create Laravel controller
- [ ] Create/update database migration
- [ ] Add model + relationships
- [ ] Test in browser (http://localhost:8000)
- [ ] Test in Electron
- [ ] Add Electron sync if data is mutable
- [ ] Handle conflicts if concurrent edits
- [ ] Update TypeScript types
- [ ] Run linter: `npm run lint`
- [ ] Run type check: `npm run types`
- [ ] Test on different platforms

---

## 🔐 Security Notes

- ✅ Preload script prevents direct node.js access
- ✅ SQL injection prevented with parameterized queries
- ✅ CORS enabled only for trusted origins
- ✅ Authentication via Sanctum tokens
- ✅ 2FA supported
- ✅ Email verification required
- ✅ Electron Fuses hardened

---

## 🆘 Getting Help

1. **Check documentation first** → [DOC-INDEX.md](DOC-INDEX.md)
2. **Look for examples** → [ELECTRON-DEV-GUIDE.md](ELECTRON-DEV-GUIDE.md)
3. **Search troubleshooting** → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
4. **Review code comments** → Source code
5. **Check git history** → `git log --oneline`
6. **Open DevTools** → Ctrl+Shift+I in Electron

---

## 🚀 Deploy Steps

### Web Deploy
```bash
npm run build
# Upload /dist to server
# Point web root to /public
```

### Desktop Deploy
```bash
npm run electron:build
# Installers in /out/make/
# Distribute to users
```

---

## 💾 Database Backup

```bash
# Windows - Backup local database
Copy-Item "$env:APPDATA\anufa-minerva\anufa-minerva-local.db" `
  -Destination ".\backup-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').db"

# Restore
Copy-Item ".\backup-*.db" -Destination "$env:APPDATA\anufa-minerva\anufa-minerva-local.db"
```

---

## 📞 Useful Links

- **Laravel Docs**: https://laravel.com/docs
- **React Docs**: https://react.dev
- **Inertia.js**: https://inertiajs.com
- **Electron**: https://www.electronjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Better SQLite3**: https://github.com/WiseLibs/better-sqlite3

---

## 💡 Pro Tips

1. **Keep terminals organized** - Use tabs or split screens
2. **Use DevTools** - Learn React DevTools + Chrome DevTools
3. **Read error messages** - They're usually helpful
4. **Check console first** - Many issues show up there
5. **Test offline** - Electron's killer feature
6. **Use git branches** - One feature per branch
7. **Document changes** - Future you will thank you
8. **Review PRs thoroughly** - Catch issues early

---

## 🎓 Learning Path

**Day 1**: Read [CODEBASE-OVERVIEW.md](CODEBASE-OVERVIEW.md) → Run locally  
**Day 2**: Read [ELECTRON-DEV-GUIDE.md](ELECTRON-DEV-GUIDE.md) → Try examples  
**Day 3**: Read [ELECTRON-ARCHITECTURE.md](ELECTRON-ARCHITECTURE.md) → Understand flow  
**Day 4**: Read [ELECTRON-SYNC-GUIDE.md](ELECTRON-SYNC-GUIDE.md) → Offline features  
**Day 5**: Start coding! 🚀

---

**Last Updated**: January 16, 2026  
**Quick Reference v1.0**
