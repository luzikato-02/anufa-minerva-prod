/**
 * Type declarations for Electron API exposed via contextBridge
 */

interface ElectronAPI {
    // Environment checks
    isElectron: () => Promise<boolean>;
    getDbPath: () => Promise<string>;
    getAppDataPath: () => Promise<string>;
    
    // Server configuration
    getServerUrl: () => Promise<string | null>;
    setServerUrl: (url: string) => Promise<boolean>;
    showServerConfig: () => Promise<boolean>;
    
    // Database operations
    dbExecute: (sql: string, params?: unknown[]) => Promise<DbResult>;
    dbBatchExecute: (queries: DbQuery[]) => Promise<DbBatchResult>;
    
    // Sync operations
    getUnsyncedRecords: (tableName: string) => Promise<DbResult>;
    markAsSynced: (tableName: string, localId: number, remoteId: number) => Promise<SimpleResult>;
    
    // Sync logging
    logSyncTransport: (logData: SyncLogData) => Promise<{ success: boolean; id?: number; error?: string }>;
    getSyncLogs: (limit?: number) => Promise<DbResult>;
    
    // Conflict management
    createConflict: (conflictData: ConflictInput) => Promise<{ success: boolean; id?: number; error?: string }>;
    getPendingConflicts: () => Promise<DbResult>;
    resolveConflict: (conflictId: number, resolution: ConflictResolution) => Promise<SimpleResult>;
    
    // Database import/export
    exportDatabase: () => Promise<ExportResult>;
    importDatabase: () => Promise<SimpleResult>;
    
    // Event listeners
    onTriggerSync: (callback: () => void) => () => void;
    onShowSyncLog: (callback: () => void) => () => void;
    onShowConflicts: (callback: () => void) => () => void;
    onShowServerConfig: (callback: () => void) => () => void;
}

interface PlatformInfo {
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    platform: string;
    arch: string;
}

interface DbResult {
    success: boolean;
    data?: unknown[];
    changes?: number;
    lastInsertRowid?: number;
    error?: string;
}

interface DbQuery {
    sql: string;
    params?: unknown[];
}

interface DbBatchResult {
    success: boolean;
    results?: unknown[];
    error?: string;
}

interface SimpleResult {
    success: boolean;
    error?: string;
}

interface ExportResult extends SimpleResult {
    path?: string;
}

interface SyncLogData {
    sync_direction: 'upload' | 'download';
    table_name: string;
    record_id: number;
    remote_record_id?: number;
    action: 'create' | 'update' | 'delete';
    status: 'pending' | 'success' | 'failed' | 'conflict';
    payload?: unknown;
    error_message?: string;
    user_id?: number;
}

interface ConflictInput {
    table_name: string;
    local_record_id: number;
    remote_record_id: number;
    local_data: Record<string, unknown>;
    remote_data: Record<string, unknown>;
    conflict_fields: string[];
}

interface ConflictResolution {
    status: 'local_wins' | 'remote_wins' | 'merged' | 'dismissed';
    user_id?: number;
    notes?: string;
    merged_data?: Record<string, unknown>;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron(): Promise<boolean>;
      getServerUrl(): Promise<string | null>;
      setServerUrl(url: string): Promise<boolean>;
      showServerConfig(): Promise<boolean>;

      onShowServerConfig(
        callback: () => void
      ): () => void;
    };
  }
}

export {};
