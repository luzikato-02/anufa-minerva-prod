// Type definitions for Electron API exposed via preload script

export interface ElectronAPI {
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
    app: {
        getVersion: () => Promise<string>;
        isElectron: () => Promise<boolean>;
        getPlatform: () => Promise<string>;
    };
}

export interface DatabaseInfo {
    path: string;
    size: number;
    tables: { name: string; count: number }[];
    lastModified: string;
}

export interface TensionRecord {
    id: number;
    record_type: 'twisting' | 'weaving';
    csv_data: string;
    form_data: Record<string, unknown>;
    measurement_data: Record<string, unknown>;
    problems: unknown[];
    metadata: {
        total_measurements: number;
        completed_measurements: number;
        progress_percentage: number;
        operator: string;
        machine_number: string;
        item_number: string;
        item_description?: string;
        yarn_code?: string;
    };
    user_id?: number;
    remote_id?: number;
    sync_status: 'synced' | 'pending' | 'conflict';
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

export interface StockTakeRecord {
    id: number;
    session_id: string;
    indv_batch_data: unknown[];
    recorded_batches: unknown[];
    metadata: {
        total_batches: number;
        total_checked_batches: number;
        total_materials: number;
        session_leader?: string;
        session_status?: string;
    };
    stock_take_summary: unknown[];
    user_id?: number;
    remote_id?: number;
    sync_status: 'synced' | 'pending' | 'conflict';
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

export interface FinishEarlierRecord {
    id: number;
    metadata: {
        machine_number: string;
        style: string;
        production_order: string;
        roll_construction: string;
        shift_group: string;
        total_finish_earlier: number;
        average_meters_finish: number;
    };
    entries: unknown[];
    remote_id?: number;
    sync_status: 'synced' | 'pending' | 'conflict';
    created_at: string;
    updated_at: string;
}

export interface PaginatedResult<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface SyncStatus {
    isConnected: boolean;
    lastSyncTime: string | null;
    pendingUploads: number;
    pendingDownloads: number;
    conflicts: number;
    isSyncing: boolean;
}

export interface SyncSettings {
    serverUrl: string;
    authToken: string;
    autoSync: boolean;
    syncIntervalMinutes: number;
    syncOnStartup: boolean;
    syncTensionRecords: boolean;
    syncStockTakeRecords: boolean;
    syncFinishEarlierRecords: boolean;
}

export interface SyncResult {
    success: boolean;
    uploaded: number;
    downloaded: number;
    conflicts: number;
    errors: string[];
}

export interface SyncConflict {
    id: string;
    tableName: string;
    recordId: number;
    localData: unknown;
    remoteData: unknown;
    createdAt: string;
}

export interface SyncProgress {
    phase: string;
    current: number;
    total: number;
    message: string;
}

export interface SyncHistoryEntry {
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

// Extend Window interface
declare global {
    interface Window {
        electronAPI?: ElectronAPI;
        isElectron?: boolean;
    }
}

export {};
