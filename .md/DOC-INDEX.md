# Anufa Minerva Documentation Index

Welcome! This codebase includes comprehensive documentation covering architecture, development, and deployment.

## 📚 Documentation Files

### For New Developers

Start here if you're new to the project:

1. **[CODEBASE-OVERVIEW.md](CODEBASE-OVERVIEW.md)** ← **START HERE**
   - Complete project structure
   - Tech stack overview
   - Feature list
   - Common commands
   - Useful for: Understanding what the project does

2. **[ELECTRON-README.md](ELECTRON-README.md)**
   - Quick start for Electron desktop app
   - Build instructions
   - Troubleshooting
   - Useful for: Building & running the app

### For Architects & Designers

Deep-dive into how the system works:

3. **[ELECTRON-ARCHITECTURE.md](ELECTRON-ARCHITECTURE.md)**
   - Complete system architecture
   - Layer-by-layer breakdown
   - Component hierarchy
   - Database schema
   - Configuration files
   - Useful for: Understanding the overall design

4. **[ELECTRON-LAYOUT.md](ELECTRON-LAYOUT.md)**
   - Visual reference of the UI layout
   - Window structure
   - Component hierarchy diagrams
   - Data flow diagrams
   - Useful for: UI/UX understanding

### For Frontend Developers

React, TypeScript, and Electron APIs:

5. **[ELECTRON-DEV-GUIDE.md](ELECTRON-DEV-GUIDE.md)** ← **Most Practical**
   - Code samples & examples
   - How to use Electron APIs in React
   - Working with local SQLite
   - Adding new pages
   - Common patterns
   - Debugging tips
   - Useful for: Hands-on development

### For Backend & Sync Implementation

Database sync and conflict resolution:

6. **[ELECTRON-SYNC-GUIDE.md](ELECTRON-SYNC-GUIDE.md)** ← **For Offline Features**
   - Offline-first workflow
   - Sync process steps
   - Conflict detection & resolution
   - Audit trail
   - Best practices
   - Troubleshooting
   - Useful for: Implementing sync features

---

## Quick Reference

### I want to...

- **Understand the project** → [CODEBASE-OVERVIEW.md](CODEBASE-OVERVIEW.md)
- **Start developing** → [ELECTRON-DEV-GUIDE.md](ELECTRON-DEV-GUIDE.md)
- **Build the desktop app** → [ELECTRON-README.md](ELECTRON-README.md)
- **Work with sync/offline** → [ELECTRON-SYNC-GUIDE.md](ELECTRON-SYNC-GUIDE.md)
- **See architecture diagrams** → [ELECTRON-ARCHITECTURE.md](ELECTRON-ARCHITECTURE.md)
- **Understand UI layout** → [ELECTRON-LAYOUT.md](ELECTRON-LAYOUT.md)

### Getting Started (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Start Laravel server (Terminal 1)
composer dev

# 3. Start Electron (Terminal 2)
npm run electron:start

# 4. Open http://127.0.0.1:8000 in browser
# Or Electron window opens automatically
```

### Common Tasks

| Task | File | Command |
|------|------|---------|
| Add new page | DEV-GUIDE | `npm run dev` then create `.tsx` |
| Use Electron API | DEV-GUIDE | `await window.electronAPI.method()` |
| Work offline | SYNC-GUIDE | Save to local SQLite |
| Resolve conflicts | SYNC-GUIDE | Admin panel |
| Build app | README | `npm run electron:build` |
| Deploy web | CODEBASE | See deployment section |

---

## File Structure Map

```
Documentation/
├── CODEBASE-OVERVIEW.md          ← Start here (complete overview)
├── ELECTRON-README.md             ← Quick reference
├── ELECTRON-ARCHITECTURE.md       ← Deep dive (design)
├── ELECTRON-DEV-GUIDE.md          ← Practical guide (code examples)
├── ELECTRON-SYNC-GUIDE.md         ← Sync implementation (offline)
├── ELECTRON-LAYOUT.md             ← Visual reference (diagrams)
└── DOC-INDEX.md                   ← This file

Source Code/
├── electron/
│   ├── main.cjs                  ← Electron main process
│   ├── preload.cjs               ← IPC bridge
│   └── setup.html                ← Server config
│
├── resources/js/                 ← React frontend
│   ├── app.tsx                   ← Entry point
│   ├── pages/                    ← Inertia pages
│   ├── components/               ← React components
│   ├── layouts/                  ← Page layouts
│   └── hooks/                    ← Custom hooks
│
├── app/                          ← Laravel backend
│   ├── Http/Controllers/         ← API endpoints
│   ├── Models/                   ← Database models
│   └── Providers/                ← Service providers
│
└── routes/                       ← Route definitions
    ├── web.php                   ← Inertia routes
    ├── api.php                   ← API routes
    └── ...
```

---

## Architecture Overview (30 seconds)

```
DESKTOP APP (Electron)
├─ React Frontend (TypeScript)
├─ Electron IPC Bridge
├─ Local SQLite Database (Offline)
└─ Auto-sync to Server

WEB APP (Same Code)
├─ React Frontend (TypeScript)
├─ Inertia.js
└─ API Requests to Laravel

BACKEND (Shared)
├─ Laravel REST API
├─ Database (PostgreSQL/MySQL)
└─ Authentication (Sanctum)
```

---

## Key Concepts

### Inertia.js
Think of it as "Server-Driven React". Controllers send props to pages, pages re-render automatically.

```php
// Laravel
return Inertia::render('MyPage', ['data' => $items]);
```

```tsx
// React
function MyPage({ data }) {
  return <div>{data.map(...)}</div>;
}
```

### Electron IPC (Inter-Process Communication)
Communication between React (renderer) and Node.js (main process).

```tsx
// React → Main
const result = await window.electronAPI.dbExecute(sql, params);

// Main → React
mainWindow.webContents.send('channel-name', data);
```

### Offline-First Sync
Users work offline, app syncs when reconnected.

```
Offline: Save to Local SQLite
Online: Sync changes to Server
Conflict: Admin resolves via UI
```

---

## Team Roles

### Frontend Developer
- **Read**: ELECTRON-DEV-GUIDE.md
- **Focus**: React components, UI, Electron APIs
- **Commands**: `npm run dev`, `npm run lint`

### Backend Developer
- **Read**: CODEBASE-OVERVIEW.md, Laravel docs
- **Focus**: Controllers, API endpoints, database
- **Commands**: `composer dev`, `php artisan migrate`

### DevOps/Deployment
- **Read**: ELECTRON-README.md, CODEBASE-OVERVIEW.md
- **Focus**: Building, packaging, CI/CD
- **Commands**: `npm run build`, `npm run electron:build`

### QA/Tester
- **Read**: ELECTRON-README.md, ELECTRON-SYNC-GUIDE.md
- **Focus**: Offline testing, sync validation, conflict resolution
- **Test Scenarios**: Online/offline, sync, conflicts

---

## Features At a Glance

✅ **Tension Record Management**
- Twisting & weaving measurements
- Problem tracking & resolution
- Export to CSV/PDF

✅ **Stock Taking**
- Session-based recording
- Batch validation
- Export

✅ **Finish Earlier**
- Production order tracking
- Multi-entry sessions

✅ **Desktop App**
- Works offline
- Auto-sync when online
- Conflict resolution
- Local SQLite database

✅ **Admin Panel**
- User management
- Permission control
- Sync logs
- Conflict resolution

✅ **Authentication**
- Email login
- 2FA support
- Email verification
- Password reset

---

## Technology Stack

| Category | Technology |
|----------|-----------|
| **Desktop Runtime** | Electron 32 |
| **Frontend Framework** | React 19 + TypeScript |
| **Server-Rendering** | Inertia.js 2 |
| **Build Tool** | Vite 7 |
| **Styling** | Tailwind CSS 4 |
| **Components** | Radix UI |
| **Backend** | Laravel 11 |
| **Local DB** | SQLite 3 |
| **Server DB** | PostgreSQL/MySQL |
| **Auth** | Sanctum |
| **Packaging** | Electron Forge |

---

## Common Issues & Solutions

| Issue | Solution | Reference |
|-------|----------|-----------|
| Port 5173 in use | Kill process or use different port | DEV-GUIDE |
| Cannot find 'better-sqlite3' | Run `npm rebuild` | ELECTRON-README |
| Electron won't start | Check Laravel running on 8000 | ELECTRON-README |
| Sync stuck | Check network, restart app | SYNC-GUIDE |
| Conflicts not resolving | Check admin permissions | SYNC-GUIDE |

---

## Performance Tips

- Use local SQLite for instant access (Electron)
- Batch IPC calls to reduce overhead
- Virtual scroll for large lists
- Lazy load pages
- Enable gzip compression

---

## Contributing

When adding a feature:
1. Create feature branch
2. Implement frontend (React)
3. Implement backend (Laravel)
4. Add offline support (local DB)
5. Add sync logic if data is mutable
6. Test in web & Electron
7. Create PR with documentation

---

## Getting Help

1. **Check Documentation**
   - What you're doing? → DEV-GUIDE
   - How it works? → ARCHITECTURE
   - Having issues? → SYNC-GUIDE or README

2. **Search Code**
   - Look for existing implementations
   - Check similar pages/components
   - Review models for data structure

3. **DevTools**
   - `Ctrl+Shift+I` in Electron to open DevTools
   - React DevTools browser extension
   - SQL debugging via IPC logs

4. **Git History**
   - `git log --oneline --grep="feature name"`
   - Review PRs for context

---

## Next Steps

1. **Read** [CODEBASE-OVERVIEW.md](CODEBASE-OVERVIEW.md) (10 min)
2. **Follow** development setup in [ELECTRON-README.md](ELECTRON-README.md) (5 min)
3. **Try** one example from [ELECTRON-DEV-GUIDE.md](ELECTRON-DEV-GUIDE.md) (15 min)
4. **Start coding!** 🚀

---

**Last Updated**: January 16, 2026  
**Documentation Version**: 1.0.0
