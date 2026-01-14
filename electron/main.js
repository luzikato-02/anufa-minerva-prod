const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Keep a global reference of the window object
let mainWindow;
let localDb;

// Database path for local SQLite storage
const DB_PATH = path.join(app.getPath('userData'), 'anufa-minerva-local.db');

// Initialize local SQLite database
function initializeLocalDatabase() {
    try {
        localDb = new Database(DB_PATH);
        
        // Create tables for local data storage (mirrors Laravel tables)
        localDb.exec(`
            -- Users table for offline authentication
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                username TEXT,
                password TEXT NOT NULL,
                email_verified_at TEXT,
                two_factor_secret TEXT,
                two_factor_recovery_codes TEXT,
                remember_token TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced_at TEXT,
                local_modified BOOLEAN DEFAULT 0,
                remote_id INTEGER
            );

            -- Tension Records table
            CREATE TABLE IF NOT EXISTS tension_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_type TEXT NOT NULL CHECK(record_type IN ('twisting', 'weaving')),
                machine_number TEXT,
                item_number TEXT,
                operator TEXT,
                status TEXT DEFAULT 'draft',
                form_data TEXT,
                csv_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced_at TEXT,
                local_modified BOOLEAN DEFAULT 0,
                remote_id INTEGER,
                deleted_at TEXT
            );

            -- Twisting Measurements table
            CREATE TABLE IF NOT EXISTS twisting_measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tension_record_id INTEGER NOT NULL,
                spindle_number INTEGER NOT NULL,
                max_value REAL,
                min_value REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced_at TEXT,
                local_modified BOOLEAN DEFAULT 0,
                remote_id INTEGER,
                FOREIGN KEY (tension_record_id) REFERENCES tension_records(id)
            );

            -- Weaving Measurements table
            CREATE TABLE IF NOT EXISTS weaving_measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tension_record_id INTEGER NOT NULL,
                creel_side TEXT NOT NULL,
                row_number TEXT NOT NULL,
                column_number INTEGER NOT NULL,
                max_value REAL,
                min_value REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced_at TEXT,
                local_modified BOOLEAN DEFAULT 0,
                remote_id INTEGER,
                FOREIGN KEY (tension_record_id) REFERENCES tension_records(id)
            );

            -- Tension Problems table
            CREATE TABLE IF NOT EXISTS tension_problems (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tension_record_id INTEGER NOT NULL,
                spindle_number INTEGER,
                position TEXT,
                description TEXT NOT NULL,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'resolved')),
                resolved_at TEXT,
                resolved_by_user_id INTEGER,
                resolution_notes TEXT,
                repaired_max_value REAL,
                repaired_min_value REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced_at TEXT,
                local_modified BOOLEAN DEFAULT 0,
                remote_id INTEGER,
                FOREIGN KEY (tension_record_id) REFERENCES tension_records(id)
            );

            -- Stock Taking Records table
            CREATE TABLE IF NOT EXISTS stock_taking_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'ongoing',
                recorded_batches TEXT,
                stock_take_summary TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced_at TEXT,
                local_modified BOOLEAN DEFAULT 0,
                remote_id INTEGER
            );

            -- Finish Earlier Records table
            CREATE TABLE IF NOT EXISTS finish_earlier_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                production_order TEXT NOT NULL,
                status TEXT DEFAULT 'ongoing',
                entries TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                finished_at TEXT,
                synced_at TEXT,
                local_modified BOOLEAN DEFAULT 0,
                remote_id INTEGER
            );

            -- Sync Transport Log table
            CREATE TABLE IF NOT EXISTS sync_transport_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_direction TEXT NOT NULL CHECK(sync_direction IN ('upload', 'download')),
                table_name TEXT NOT NULL,
                record_id INTEGER NOT NULL,
                remote_record_id INTEGER,
                action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
                status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed', 'conflict')),
                payload TEXT,
                error_message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                user_id INTEGER
            );

            -- Data Conflicts table
            CREATE TABLE IF NOT EXISTS data_conflicts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                local_record_id INTEGER NOT NULL,
                remote_record_id INTEGER NOT NULL,
                local_data TEXT NOT NULL,
                remote_data TEXT NOT NULL,
                conflict_fields TEXT NOT NULL,
                resolution_status TEXT DEFAULT 'pending' CHECK(resolution_status IN ('pending', 'local_wins', 'remote_wins', 'merged', 'dismissed')),
                resolved_by_user_id INTEGER,
                resolved_at TEXT,
                resolution_notes TEXT,
                merged_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- App Settings table
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Local database initialized at:', DB_PATH);
        return true;
    } catch (error) {
        console.error('Failed to initialize local database:', error);
        return false;
    }
}

// Create the main application window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, '../public/favicon.ico'),
        title: 'Anufa Minerva',
        show: false,
    });

    // In development, load from Vite dev server, in production load from built files
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    if (isDev) {
        // Development: load from Laravel server
        mainWindow.loadURL('http://127.0.0.1:8000');
        mainWindow.webContents.openDevTools();
    } else {
        // Production: load from Laravel server or local files
        const serverUrl = getStoredServerUrl();
        if (serverUrl) {
            mainWindow.loadURL(serverUrl);
        } else {
            // Load local HTML file with server configuration form
            mainWindow.loadFile(path.join(__dirname, 'setup.html'));
        }
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Create application menu
    createMenu();
}

// Get stored server URL from local database
function getStoredServerUrl() {
    try {
        const result = localDb.prepare('SELECT value FROM app_settings WHERE key = ?').get('server_url');
        return result ? result.value : null;
    } catch (error) {
        return null;
    }
}

// Store server URL in local database
function setServerUrl(url) {
    try {
        const stmt = localDb.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
        stmt.run('server_url', url);
        return true;
    } catch (error) {
        console.error('Failed to store server URL:', error);
        return false;
    }
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Configure Server',
                    click: () => showServerConfigDialog()
                },
                { type: 'separator' },
                {
                    label: 'Data Sync',
                    submenu: [
                        {
                            label: 'Sync Now',
                            accelerator: 'CmdOrCtrl+S',
                            click: () => mainWindow.webContents.send('trigger-sync')
                        },
                        {
                            label: 'View Sync Log',
                            click: () => mainWindow.webContents.send('show-sync-log')
                        },
                        {
                            label: 'Resolve Conflicts',
                            click: () => mainWindow.webContents.send('show-conflicts')
                        }
                    ]
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => showAboutDialog()
                },
                {
                    label: 'Documentation',
                    click: async () => {
                        await shell.openExternal('https://github.com/your-repo/wiki');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Show server configuration dialog
async function showServerConfigDialog() {
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancel', 'Configure'],
        title: 'Server Configuration',
        message: 'Enter the remote server URL to sync data with.',
    });

    if (result.response === 1) {
        mainWindow.webContents.send('show-server-config');
    }
}

// Show about dialog
function showAboutDialog() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About Anufa Minerva',
        message: 'Anufa Minerva',
        detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode.js: ${process.versions.node}\n\nA comprehensive production data management system.`,
    });
}

// IPC Handlers for database operations
function setupIpcHandlers() {
    // Get database path
    ipcMain.handle('get-db-path', () => DB_PATH);

    // Get app data path
    ipcMain.handle('get-app-data-path', () => app.getPath('userData'));

    // Get server URL
    ipcMain.handle('get-server-url', () => getStoredServerUrl());

    // Set server URL
    ipcMain.handle('set-server-url', (event, url) => {
        const success = setServerUrl(url);
        if (success) {
            mainWindow.loadURL(url);
        }
        return success;
    });

    // Check if running in Electron
    ipcMain.handle('is-electron', () => true);

    // Execute SQL query (for sync operations)
    ipcMain.handle('db-execute', (event, sql, params = []) => {
        try {
            const stmt = localDb.prepare(sql);
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                return { success: true, data: stmt.all(...params) };
            } else {
                const result = stmt.run(...params);
                return { success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Batch execute SQL
    ipcMain.handle('db-batch-execute', (event, queries) => {
        const transaction = localDb.transaction((queries) => {
            const results = [];
            for (const { sql, params = [] } of queries) {
                try {
                    const stmt = localDb.prepare(sql);
                    if (sql.trim().toUpperCase().startsWith('SELECT')) {
                        results.push({ success: true, data: stmt.all(...params) });
                    } else {
                        const result = stmt.run(...params);
                        results.push({ success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid });
                    }
                } catch (error) {
                    results.push({ success: false, error: error.message });
                }
            }
            return results;
        });

        try {
            return { success: true, results: transaction(queries) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get all unsynced records
    ipcMain.handle('get-unsynced-records', (event, tableName) => {
        try {
            const stmt = localDb.prepare(`SELECT * FROM ${tableName} WHERE local_modified = 1 AND synced_at IS NULL`);
            return { success: true, data: stmt.all() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Mark record as synced
    ipcMain.handle('mark-as-synced', (event, tableName, localId, remoteId) => {
        try {
            const stmt = localDb.prepare(
                `UPDATE ${tableName} SET synced_at = datetime('now'), local_modified = 0, remote_id = ? WHERE id = ?`
            );
            stmt.run(remoteId, localId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Log sync transport
    ipcMain.handle('log-sync-transport', (event, logData) => {
        try {
            const stmt = localDb.prepare(`
                INSERT INTO sync_transport_logs 
                (sync_direction, table_name, record_id, remote_record_id, action, status, payload, error_message, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                logData.sync_direction,
                logData.table_name,
                logData.record_id,
                logData.remote_record_id || null,
                logData.action,
                logData.status,
                JSON.stringify(logData.payload),
                logData.error_message || null,
                logData.user_id || null
            );
            return { success: true, id: result.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get sync logs
    ipcMain.handle('get-sync-logs', (event, limit = 100) => {
        try {
            const stmt = localDb.prepare(`
                SELECT * FROM sync_transport_logs 
                ORDER BY created_at DESC 
                LIMIT ?
            `);
            return { success: true, data: stmt.all(limit) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Create data conflict
    ipcMain.handle('create-conflict', (event, conflictData) => {
        try {
            const stmt = localDb.prepare(`
                INSERT INTO data_conflicts 
                (table_name, local_record_id, remote_record_id, local_data, remote_data, conflict_fields)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                conflictData.table_name,
                conflictData.local_record_id,
                conflictData.remote_record_id,
                JSON.stringify(conflictData.local_data),
                JSON.stringify(conflictData.remote_data),
                JSON.stringify(conflictData.conflict_fields)
            );
            return { success: true, id: result.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get pending conflicts
    ipcMain.handle('get-pending-conflicts', () => {
        try {
            const stmt = localDb.prepare(`
                SELECT * FROM data_conflicts 
                WHERE resolution_status = 'pending' 
                ORDER BY created_at DESC
            `);
            return { success: true, data: stmt.all() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Resolve conflict
    ipcMain.handle('resolve-conflict', (event, conflictId, resolution) => {
        try {
            const stmt = localDb.prepare(`
                UPDATE data_conflicts 
                SET resolution_status = ?, resolved_by_user_id = ?, resolved_at = datetime('now'), 
                    resolution_notes = ?, merged_data = ?
                WHERE id = ?
            `);
            stmt.run(
                resolution.status,
                resolution.user_id || null,
                resolution.notes || null,
                resolution.merged_data ? JSON.stringify(resolution.merged_data) : null,
                conflictId
            );
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Export local database
    ipcMain.handle('export-database', async () => {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Database',
            defaultPath: `anufa-minerva-backup-${new Date().toISOString().split('T')[0]}.db`,
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });

        if (!result.canceled && result.filePath) {
            try {
                fs.copyFileSync(DB_PATH, result.filePath);
                return { success: true, path: result.filePath };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: 'Export cancelled' };
    });

    // Import local database
    ipcMain.handle('import-database', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Database',
            filters: [{ name: 'SQLite Database', extensions: ['db'] }],
            properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            try {
                localDb.close();
                fs.copyFileSync(result.filePaths[0], DB_PATH);
                localDb = new Database(DB_PATH);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: 'Import cancelled' };
    });
}

// App lifecycle events
app.whenReady().then(() => {
    initializeLocalDatabase();
    setupIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (localDb) {
            localDb.close();
        }
        app.quit();
    }
});

app.on('before-quit', () => {
    if (localDb) {
        localDb.close();
    }
});

// Handle certificate errors for self-signed certificates in development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    if (isDev) {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});
