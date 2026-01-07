import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the exposed API
export interface ElectronAPI {
    // Database operations
    database: {
        getInfo: () => Promise<DatabaseInfo>;
        tension: {
            getAll: (options?: { type?: string; page?: number; perPage?: number }) => Promise<PaginatedResult<TensionRecord>>;
            getById: (id: number) => Promise<TensionRecord | null>;
            create: (record: Omit<TensionRecord, 'id'>) => Promise<{ success: boolean; id?: number; error?: string }>;
            update: (id: number, record: Partial<TensionRecord>) => Promise<{ success: boolean; error?: string }>;
            delete: (id: number) => Promise<{ success: boolean; error?: string }>;
        };
        stocktake: {
            getAll: (options?: { page?: number; perPage?: number }) => Promise<PaginatedResult<StockTakeRecord>>;
            getById: (id: number) => Promise<StockTakeRecord | null>;
            getBySessionId: (sessionId: string) => Promise<StockTakeRecord | null>;
            create: (record: Omit<StockTakeRecord, 'id'>) => Promise<{ success: boolean; id?: number; error?: string }>;
            update: (id: number, record: Partial<StockTakeRecord>) => Promise<{ success: boolean; error?: string }>;
            delete: (id: number) => Promise<{ success: boolean; error?: string }>;
        };
        finishEarlier: {
            getAll: (options?: { page?: number; perPage?: number }) => Promise<PaginatedResult<FinishEarlierRecord>>;
            getById: (id: number) => Promise<FinishEarlierRecord | null>;
            getByProductionOrder: (productionOrder: string) => Promise<FinishEarlierRecord | null>;
            create: (record: Omit<FinishEarlierRecord, 'id'>) => Promise<{ success: boolean; id?: number; error?: string }>;
            update: (id: number, record: Partial<FinishEarlierRecord>) => Promise<{ success: boolean; error?: string }>;
            delete: (id: number) => Promise<{ success: boolean; error?: string }>;
        };
    };
    // Sync operations
    sync: {
        getStatus: () => Promise<SyncStatus>;
        getSettings: () => Promise<SyncSettings>;
        updateSettings: (settings: Partial<SyncSettings>) => Promise<{ success: boolean; error?: string }>;
        testConnection: (serverUrl: string, token: string) => Promise<{ success: boolean; error?: string }>;
        syncAll: () => Promise<SyncResult>;
        syncTensionRecords: () => Promise<SyncResult>;
        syncStockTakeRecords: () => Promise<SyncResult>;
        syncFinishEarlierRecords: () => Promise<SyncResult>;
        pullFromRemote: () => Promise<SyncResult>;
        pushToRemote: () => Promise<SyncResult>;
        resolveConflict: (conflictId: string, resolution: 'local' | 'remote') => Promise<{ success: boolean; error?: string }>;
        getConflicts: () => Promise<SyncConflict[]>;
        getSyncHistory: (limit?: number) => Promise<SyncHistoryEntry[]>;
        onProgress: (callback: (progress: SyncProgress) => void) => () => void;
    };
    // App info
    app: {
        getVersion: () => Promise<string>;
        isElectron: () => Promise<boolean>;
        getPlatform: () => Promise<string>;
    };
}

// Type definitions
interface DatabaseInfo {
    path: string;
    size: number;
    tables: { name: string; count: number }[];
    lastModified: string;
}

interface TensionRecord {
    id: number;
    record_type: 'twisting' | 'weaving';
    csv_data: string;
    form_data: any;
    measurement_data: any;
    problems: any[];
    metadata: any;
    user_id?: number;
    remote_id?: number;
    sync_status: 'synced' | 'pending' | 'conflict';
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

interface StockTakeRecord {
    id: number;
    session_id: string;
    indv_batch_data: any;
    recorded_batches: any;
    metadata: any;
    stock_take_summary: any;
    user_id?: number;
    remote_id?: number;
    sync_status: 'synced' | 'pending' | 'conflict';
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

interface FinishEarlierRecord {
    id: number;
    metadata: any;
    entries: any[];
    remote_id?: number;
    sync_status: 'synced' | 'pending' | 'conflict';
    created_at: string;
    updated_at: string;
}

interface PaginatedResult<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface SyncStatus {
    isConnected: boolean;
    lastSyncTime: string | null;
    pendingUploads: number;
    pendingDownloads: number;
    conflicts: number;
    isSyncing: boolean;
}

interface SyncSettings {
    serverUrl: string;
    authToken: string;
    autoSync: boolean;
    syncIntervalMinutes: number;
    syncOnStartup: boolean;
    syncTensionRecords: boolean;
    syncStockTakeRecords: boolean;
    syncFinishEarlierRecords: boolean;
}

interface SyncResult {
    success: boolean;
    uploaded: number;
    downloaded: number;
    conflicts: number;
    errors: string[];
}

interface SyncConflict {
    id: string;
    tableName: string;
    recordId: number;
    localData: any;
    remoteData: any;
    createdAt: string;
}

interface SyncProgress {
    phase: string;
    current: number;
    total: number;
    message: string;
}

interface SyncHistoryEntry {
    id: number;
    syncType: string;
    status: 'success' | 'partial' | 'failed';
    uploaded: number;
    downloaded: number;
    conflicts: number;
    errors: string[];
    startedAt: string;
    completedAt: string;
}

// Expose APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    database: {
        getInfo: () => ipcRenderer.invoke('db:getInfo'),
        tension: {
            getAll: (options) => ipcRenderer.invoke('db:tension:getAll', options),
            getById: (id) => ipcRenderer.invoke('db:tension:getById', id),
            create: (record) => ipcRenderer.invoke('db:tension:create', record),
            update: (id, record) => ipcRenderer.invoke('db:tension:update', id, record),
            delete: (id) => ipcRenderer.invoke('db:tension:delete', id),
        },
        stocktake: {
            getAll: (options) => ipcRenderer.invoke('db:stocktake:getAll', options),
            getById: (id) => ipcRenderer.invoke('db:stocktake:getById', id),
            getBySessionId: (sessionId) => ipcRenderer.invoke('db:stocktake:getBySessionId', sessionId),
            create: (record) => ipcRenderer.invoke('db:stocktake:create', record),
            update: (id, record) => ipcRenderer.invoke('db:stocktake:update', id, record),
            delete: (id) => ipcRenderer.invoke('db:stocktake:delete', id),
        },
        finishEarlier: {
            getAll: (options) => ipcRenderer.invoke('db:finishearlier:getAll', options),
            getById: (id) => ipcRenderer.invoke('db:finishearlier:getById', id),
            getByProductionOrder: (productionOrder) => ipcRenderer.invoke('db:finishearlier:getByProductionOrder', productionOrder),
            create: (record) => ipcRenderer.invoke('db:finishearlier:create', record),
            update: (id, record) => ipcRenderer.invoke('db:finishearlier:update', id, record),
            delete: (id) => ipcRenderer.invoke('db:finishearlier:delete', id),
        },
    },
    sync: {
        getStatus: () => ipcRenderer.invoke('sync:getStatus'),
        getSettings: () => ipcRenderer.invoke('sync:getSettings'),
        updateSettings: (settings) => ipcRenderer.invoke('sync:updateSettings', settings),
        testConnection: (serverUrl, token) => ipcRenderer.invoke('sync:testConnection', serverUrl, token),
        syncAll: () => ipcRenderer.invoke('sync:syncAll'),
        syncTensionRecords: () => ipcRenderer.invoke('sync:syncTensionRecords'),
        syncStockTakeRecords: () => ipcRenderer.invoke('sync:syncStockTakeRecords'),
        syncFinishEarlierRecords: () => ipcRenderer.invoke('sync:syncFinishEarlierRecords'),
        pullFromRemote: () => ipcRenderer.invoke('sync:pullFromRemote'),
        pushToRemote: () => ipcRenderer.invoke('sync:pushToRemote'),
        resolveConflict: (conflictId, resolution) => ipcRenderer.invoke('sync:resolveConflict', conflictId, resolution),
        getConflicts: () => ipcRenderer.invoke('sync:getConflicts'),
        getSyncHistory: (limit) => ipcRenderer.invoke('sync:getSyncHistory', limit),
        onProgress: (callback: (progress: SyncProgress) => void) => {
            const handler = (_event: any, progress: SyncProgress) => callback(progress);
            ipcRenderer.on('sync:progress', handler);
            return () => {
                ipcRenderer.removeListener('sync:progress', handler);
            };
        },
    },
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
        isElectron: () => ipcRenderer.invoke('app:isElectron'),
        getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    },
} as ElectronAPI);

// Also expose a simpler check for detecting Electron environment
contextBridge.exposeInMainWorld('isElectron', true);
