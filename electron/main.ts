import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { LocalDatabase } from './database';
import { SyncService } from './sync';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow: BrowserWindow | null = null;
let database: LocalDatabase;
let syncService: SyncService;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
        titleBarStyle: 'hiddenInset',
        show: false,
        icon: path.join(__dirname, '../public/favicon.ico'),
    });

    // Load the app
    if (isDev) {
        // In development, load from Vite dev server
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load the built files
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Open external links in the default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Initialize database and services
async function initializeServices() {
    const userDataPath = app.getPath('userData');
    database = new LocalDatabase(userDataPath);
    await database.initialize();
    
    syncService = new SyncService(database);
    
    console.log('Services initialized. Database path:', userDataPath);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
    await initializeServices();
    setupIpcHandlers();
    createWindow();

    app.on('activate', () => {
        // On macOS, re-create a window when the dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Clean up on quit
app.on('before-quit', () => {
    if (database) {
        database.close();
    }
});

// Setup IPC handlers for renderer process communication
function setupIpcHandlers() {
    // ============ DATABASE OPERATIONS ============
    
    // Get database info
    ipcMain.handle('db:getInfo', async () => {
        return database.getDatabaseInfo();
    });

    // ============ TENSION RECORDS ============
    
    ipcMain.handle('db:tension:getAll', async (_, options?: { type?: string; page?: number; perPage?: number }) => {
        return database.getTensionRecords(options);
    });

    ipcMain.handle('db:tension:getById', async (_, id: number) => {
        return database.getTensionRecordById(id);
    });

    ipcMain.handle('db:tension:create', async (_, record: any) => {
        return database.createTensionRecord(record);
    });

    ipcMain.handle('db:tension:update', async (_, id: number, record: any) => {
        return database.updateTensionRecord(id, record);
    });

    ipcMain.handle('db:tension:delete', async (_, id: number) => {
        return database.deleteTensionRecord(id);
    });

    // ============ STOCK TAKING RECORDS ============
    
    ipcMain.handle('db:stocktake:getAll', async (_, options?: { page?: number; perPage?: number }) => {
        return database.getStockTakeRecords(options);
    });

    ipcMain.handle('db:stocktake:getById', async (_, id: number) => {
        return database.getStockTakeRecordById(id);
    });

    ipcMain.handle('db:stocktake:getBySessionId', async (_, sessionId: string) => {
        return database.getStockTakeRecordBySessionId(sessionId);
    });

    ipcMain.handle('db:stocktake:create', async (_, record: any) => {
        return database.createStockTakeRecord(record);
    });

    ipcMain.handle('db:stocktake:update', async (_, id: number, record: any) => {
        return database.updateStockTakeRecord(id, record);
    });

    ipcMain.handle('db:stocktake:delete', async (_, id: number) => {
        return database.deleteStockTakeRecord(id);
    });

    // ============ FINISH EARLIER RECORDS ============
    
    ipcMain.handle('db:finishearlier:getAll', async (_, options?: { page?: number; perPage?: number }) => {
        return database.getFinishEarlierRecords(options);
    });

    ipcMain.handle('db:finishearlier:getById', async (_, id: number) => {
        return database.getFinishEarlierRecordById(id);
    });

    ipcMain.handle('db:finishearlier:getByProductionOrder', async (_, productionOrder: string) => {
        return database.getFinishEarlierRecordByProductionOrder(productionOrder);
    });

    ipcMain.handle('db:finishearlier:create', async (_, record: any) => {
        return database.createFinishEarlierRecord(record);
    });

    ipcMain.handle('db:finishearlier:update', async (_, id: number, record: any) => {
        return database.updateFinishEarlierRecord(id, record);
    });

    ipcMain.handle('db:finishearlier:delete', async (_, id: number) => {
        return database.deleteFinishEarlierRecord(id);
    });

    // ============ SYNC OPERATIONS ============
    
    ipcMain.handle('sync:getStatus', async () => {
        return syncService.getSyncStatus();
    });

    ipcMain.handle('sync:getSettings', async () => {
        return syncService.getSettings();
    });

    ipcMain.handle('sync:updateSettings', async (_, settings: any) => {
        return syncService.updateSettings(settings);
    });

    ipcMain.handle('sync:testConnection', async (_, serverUrl: string, token: string) => {
        return syncService.testConnection(serverUrl, token);
    });

    ipcMain.handle('sync:syncAll', async () => {
        return syncService.syncAll((progress) => {
            mainWindow?.webContents.send('sync:progress', progress);
        });
    });

    ipcMain.handle('sync:syncTensionRecords', async () => {
        return syncService.syncTensionRecords((progress) => {
            mainWindow?.webContents.send('sync:progress', progress);
        });
    });

    ipcMain.handle('sync:syncStockTakeRecords', async () => {
        return syncService.syncStockTakeRecords((progress) => {
            mainWindow?.webContents.send('sync:progress', progress);
        });
    });

    ipcMain.handle('sync:syncFinishEarlierRecords', async () => {
        return syncService.syncFinishEarlierRecords((progress) => {
            mainWindow?.webContents.send('sync:progress', progress);
        });
    });

    ipcMain.handle('sync:pullFromRemote', async () => {
        return syncService.pullFromRemote((progress) => {
            mainWindow?.webContents.send('sync:progress', progress);
        });
    });

    ipcMain.handle('sync:pushToRemote', async () => {
        return syncService.pushToRemote((progress) => {
            mainWindow?.webContents.send('sync:progress', progress);
        });
    });

    ipcMain.handle('sync:resolveConflict', async (_, conflictId: string, resolution: 'local' | 'remote') => {
        return syncService.resolveConflict(conflictId, resolution);
    });

    ipcMain.handle('sync:getConflicts', async () => {
        return syncService.getConflicts();
    });

    ipcMain.handle('sync:getSyncHistory', async (_, limit?: number) => {
        return syncService.getSyncHistory(limit);
    });

    // ============ APP INFO ============
    
    ipcMain.handle('app:getVersion', () => {
        return app.getVersion();
    });

    ipcMain.handle('app:isElectron', () => {
        return true;
    });

    ipcMain.handle('app:getPlatform', () => {
        return process.platform;
    });
}
