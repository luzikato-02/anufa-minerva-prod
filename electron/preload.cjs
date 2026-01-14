const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Environment checks
    isElectron: () => ipcRenderer.invoke('is-electron'),
    getDbPath: () => ipcRenderer.invoke('get-db-path'),
    getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
    
    // Server configuration
    getServerUrl: () => ipcRenderer.invoke('get-server-url'),
    setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),
    
    // Database operations
    dbExecute: (sql, params) => ipcRenderer.invoke('db-execute', sql, params),
    dbBatchExecute: (queries) => ipcRenderer.invoke('db-batch-execute', queries),
    
    // Sync operations
    getUnsyncedRecords: (tableName) => ipcRenderer.invoke('get-unsynced-records', tableName),
    markAsSynced: (tableName, localId, remoteId) => ipcRenderer.invoke('mark-as-synced', tableName, localId, remoteId),
    
    // Sync logging
    logSyncTransport: (logData) => ipcRenderer.invoke('log-sync-transport', logData),
    getSyncLogs: (limit) => ipcRenderer.invoke('get-sync-logs', limit),
    
    // Conflict management
    createConflict: (conflictData) => ipcRenderer.invoke('create-conflict', conflictData),
    getPendingConflicts: () => ipcRenderer.invoke('get-pending-conflicts'),
    resolveConflict: (conflictId, resolution) => ipcRenderer.invoke('resolve-conflict', conflictId, resolution),
    
    // Database import/export
    exportDatabase: () => ipcRenderer.invoke('export-database'),
    importDatabase: () => ipcRenderer.invoke('import-database'),
    
    // Event listeners
    onTriggerSync: (callback) => {
        ipcRenderer.on('trigger-sync', callback);
        return () => ipcRenderer.removeListener('trigger-sync', callback);
    },
    onShowSyncLog: (callback) => {
        ipcRenderer.on('show-sync-log', callback);
        return () => ipcRenderer.removeListener('show-sync-log', callback);
    },
    onShowConflicts: (callback) => {
        ipcRenderer.on('show-conflicts', callback);
        return () => ipcRenderer.removeListener('show-conflicts', callback);
    },
    onShowServerConfig: (callback) => {
        ipcRenderer.on('show-server-config', callback);
        return () => ipcRenderer.removeListener('show-server-config', callback);
    },
});

// Expose platform info
contextBridge.exposeInMainWorld('platform', {
    isWindows: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
    platform: process.platform,
    arch: process.arch,
});
