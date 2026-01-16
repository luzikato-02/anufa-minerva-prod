# Troubleshooting Guide - Anufa Minerva

## Common Issues and Solutions

### 1. Electron Won't Start

**Error**: "Cannot find module" or "Electron window won't open"

**Solutions** (try in order):

1. **Check Laravel is running**
   ```bash
   # Terminal 1 should show: Started Laravel development server
   composer dev
   ```

2. **Check Vite is running (for dev builds)**
   ```bash
   # Terminal 2
   npm run dev
   # Should show: Local: http://127.0.0.1:5173
   ```

3. **Wait for Vite to start before opening Electron**
   ```bash
   # Terminal 3 - wait 5 seconds after Vite starts
   npm run electron:start
   ```

4. **Use full electron:dev command**
   ```bash
   # Combines all three (if you have Laravel running separately)
   npm run electron:dev
   # OR
   concurrently "npm run dev" "wait-on http://127.0.0.1:5173 && electron ."
   ```

5. **Check Node.js version**
   ```bash
   node --version  # Should be 20.x or higher
   npm --version   # Should be 10.x or higher
   ```

---

### 2. "Cannot find module 'better-sqlite3'"

**Error**: 
```
Error: Cannot find module 'better-sqlite3'
ERR! Module not found...
```

**Cause**: Native module not compiled for your platform

**Solutions**:

1. **Rebuild native modules**
   ```bash
   npm rebuild better-sqlite3 --build-from-source
   ```

2. **If above fails, try this**
   ```bash
   npm install --save-optional better-sqlite3
   npm rebuild
   ```

3. **Windows-specific (requires build tools)**
   ```bash
   # Install Visual Studio Build Tools
   # https://visualstudio.microsoft.com/visual-cpp-build-tools/
   
   # Then rebuild
   npm rebuild better-sqlite3 --build-from-source
   ```

4. **Clear npm cache**
   ```bash
   npm cache clean --force
   rm -rf node_modules
   npm install
   npm rebuild
   ```

**More info**: [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)

---

### 3. Port 5173 Already in Use

**Error**: 
```
error: listen EADDRINUSE: address already in use :::5173
```

**Solutions**:

1. **Find process using port 5173**
   ```bash
   # Windows PowerShell
   netstat -ano | Select-String ":5173"
   
   # Linux/macOS
   lsof -i :5173
   ```

2. **Kill the process**
   ```bash
   # Windows PowerShell
   taskkill /PID <PID> /F
   
   # Linux/macOS
   kill -9 <PID>
   ```

3. **Use different port**
   ```bash
   npm run dev -- --port 5174
   ```

---

### 4. Port 8000 Already in Use

**Error**: 
```
The port 8000 is already in use
```

**Solutions**:

1. **Find process**
   ```bash
   netstat -ano | Select-String ":8000"
   ```

2. **Kill it**
   ```bash
   taskkill /PID <PID> /F
   ```

3. **Use different port**
   ```bash
   php artisan serve --port 8001
   # Then update Electron to load http://127.0.0.1:8001
   ```

---

### 5. Blank Electron Window

**Symptoms**: Electron opens but shows blank/white screen

**Causes & Solutions**:

1. **Laravel not running**
   ```bash
   # Check Terminal 1
   composer dev
   # Should show server running
   ```

2. **Wrong URL in main.cjs**
   ```javascript
   // Check this in electron/main.cjs
   if (isDev) {
       mainWindow.loadURL('http://127.0.0.1:8000');  // ← Correct?
   }
   ```

3. **CORS issue**
   - Check Laravel `config/cors.php`
   - Ensure `http://127.0.0.1:*` is in `allowed_origins`

4. **Check DevTools for errors**
   ```bash
   # Press Ctrl+Shift+I in Electron window
   # Look at Console tab for errors
   # Check Network tab for failed requests
   ```

5. **Clear Electron cache**
   ```bash
   # Windows
   Remove-Item -Path "$env:APPDATA/anufa-minerva" -Recurse -Force
   
   # Linux
   rm -rf ~/.config/anufa-minerva
   
   # macOS
   rm -rf ~/Library/Application\ Support/anufa-minerva
   ```

---

### 6. Database Lock Error

**Error**: 
```
database disk image is malformed
or
database is locked
```

**Solutions**:

1. **Delete lock files**
   ```bash
   # Windows
   Remove-Item -Path "$env:APPDATA/anufa-minerva/*.db-*" -Force
   
   # Linux/macOS
   rm ~/.local/share/anufa-minerva/*.db-*
   ```

2. **Close all Electron instances**
   ```bash
   # Windows
   taskkill /F /IM electron.exe
   
   # Linux/macOS
   pkill -f electron
   ```

3. **Reinitialize database**
   ```bash
   # Delete the database file
   # Electron will recreate it on next start
   ```

---

### 7. IPC Channel Not Working

**Error**: 
```
Uncaught Error: electronAPI.methodName is not a function
or
Channel 'channel-name' not found
```

**Solutions**:

1. **Check preload is loaded**
   ```tsx
   // In React component
   if (!window.electronAPI) {
     console.error('Electron API not available');
     return;
   }
   ```

2. **Verify handler is registered**
   ```javascript
   // Check main.cjs setupIpcHandlers()
   ipcMain.handle('my-channel', (event, ...args) => {
     // Handler code
   });
   ```

3. **Reload Electron**
   ```bash
   # In Electron window
   Ctrl+Shift+R  (Force reload)
   # or press F5
   ```

4. **Check preload path**
   ```javascript
   // electron/main.cjs - verify path
   webPreferences: {
       preload: path.join(__dirname, 'preload.cjs'),  // Correct path?
   }
   ```

---

### 8. Sync Not Working

**Error**: 
```
Sync pending but never completes
or
Unsynced records stuck with local_modified=1
```

**Solutions**:

1. **Check network**
   ```bash
   # Is Laravel running?
   php artisan serve
   
   # Is Electron connecting?
   # Open DevTools (Ctrl+Shift+I)
   # Check Network tab for API requests
   ```

2. **View sync logs**
   ```tsx
   // In React console
   const logs = await window.electronAPI.getSyncLogs(100);
   console.table(logs.data);
   ```

3. **Check for conflicts**
   ```tsx
   const conflicts = await window.electronAPI.getPendingConflicts();
   console.log(conflicts.data);  // Any conflicts blocking sync?
   ```

4. **Force sync**
   ```tsx
   // Manually trigger sync
   File → Data Sync → Sync Now
   // Or in code:
   window.electronAPI.onTriggerSync?.(
     () => performSync()
   );
   ```

5. **Check API is working**
   ```bash
   # Test API directly
   curl http://127.0.0.1:8000/api/tension-records
   # Should return JSON, not error
   ```

---

### 9. Conflicts Not Resolving

**Error**: 
```
Conflict created but Admin → Data Sync shows nothing
```

**Solutions**:

1. **Check conflicts exist**
   ```tsx
   const result = await window.electronAPI.getPendingConflicts();
   console.log('Pending conflicts:', result.data);
   ```

2. **Verify user is admin**
   ```php
   // In Laravel
   if (!auth()->user()?->hasRole('admin')) {
       abort(403, 'Not admin');
   }
   ```

3. **Check app_settings table**
   ```tsx
   const result = await window.electronAPI.dbExecute(
     'SELECT * FROM data_conflicts WHERE resolution_status = "pending"',
     []
   );
   console.log(result.data);
   ```

---

### 10. "stock-take-records-display" View Not Found

**Error** (from original request):
```
Inertia view [stock-take-records-display] not found
```

**Root Cause**: Page component file doesn't exist or name doesn't match

**Solutions**:

1. **Check file exists**
   ```bash
   # Should have this file:
   resources/js/pages/stock-take-records-display.tsx
   # OR (preferred):
   resources/js/pages/StockTakeRecordsDisplay.tsx
   ```

2. **Check Inertia::render() in route**
   ```php
   // routes/web.php
   Route::get('stock-take-records-main', function () {
       return Inertia::render('StockTakeRecordsDisplay');
       // ↑ Must match file name (PascalCase recommended)
   });
   ```

3. **Component file must have default export**
   ```tsx
   // resources/js/pages/StockTakeRecordsDisplay.tsx
   export default function StockTakeRecordsDisplay(props) {
     return <div>...</div>;
   }
   ```

4. **Rebuild frontend**
   ```bash
   npm run dev        # Dev mode
   npm run build      # Production build
   ```

5. **Check file naming convention**
   - Use PascalCase: `StockTakeRecordsDisplay.tsx`
   - Route uses same: `Inertia::render('StockTakeRecordsDisplay')`
   - OR use nested: `Inertia::render('StockTakeRecords/Display')`

---

## Debugging Tips

### Enable DevTools in Production Build

Edit `electron/main.cjs`:

```javascript
// Around line 210
if (isDev) {
    mainWindow.webContents.openDevTools();  // Add this
}
```

### Add Console Logging

```javascript
// electron/main.cjs
ipcMain.handle('my-channel', (event, args) => {
    console.log('[IPC] my-channel called:', args);
    try {
        const result = doSomething(args);
        console.log('[IPC] Success:', result);
        return result;
    } catch (error) {
        console.error('[IPC] Error:', error);
        return { success: false, error: error.message };
    }
});
```

### Check What's Running

```bash
# Windows
Get-Process electron
Get-Process php
Get-Process node

# Linux/macOS
ps aux | grep electron
ps aux | grep php
ps aux | grep node
```

### View Full Error Messages

```tsx
// In React
try {
    const result = await window.electronAPI.dbExecute(...);
    if (!result.success) {
        console.error('DB Error:', result.error);
    }
} catch (error) {
    console.error('IPC Error:', error);
}
```

---

## Performance Issues

### Electron Running Slow

1. **Close other apps** to free memory
2. **Check Task Manager**
   ```bash
   taskmgr.exe  # Windows
   ```
3. **Disable DevTools** in production
4. **Check Database size**
   ```bash
   # Windows
   dir "$env:APPDATA\anufa-minerva\*.db"
   ```

### Sync Too Slow

1. **Reduce batch size**
   ```tsx
   // Instead of syncing all at once
   const BATCH_SIZE = 100;
   for (let i = 0; i < records.length; i += BATCH_SIZE) {
     // Sync BATCH_SIZE at a time
   }
   ```

2. **Use network inspector** to find slow endpoints

3. **Check database indexes** on server

---

## Still Stuck?

1. **Check console errors**
   - DevTools → Console tab
   - Look for red error messages

2. **Check network requests**
   - DevTools → Network tab
   - Look for 4xx/5xx responses

3. **Enable verbose logging**
   ```javascript
   // electron/main.cjs
   console.log = function(...args) {
     require('fs').appendFileSync(
       'debug.log',
       JSON.stringify(args) + '\n'
     );
   };
   ```

4. **Read the docs again**
   - [ELECTRON-DEV-GUIDE.md](ELECTRON-DEV-GUIDE.md)
   - [ELECTRON-SYNC-GUIDE.md](ELECTRON-SYNC-GUIDE.md)

5. **Check git history**
   ```bash
   git log --oneline -- electron/main.cjs
   git show <commit-hash>
   ```

6. **Search closed issues** on GitHub

---

## Getting Help

When asking for help, provide:

1. **Error message** (full text)
2. **Steps to reproduce**
3. **What you were doing** (creating record, syncing, etc.)
4. **Console output** (screenshot of DevTools)
5. **Your OS** (Windows, Linux, macOS)
6. **Your Node version** (`node --version`)

---

**Last Updated**: January 16, 2026
