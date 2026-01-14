/**
 * Electron Data Sync Service
 * 
 * This service handles data synchronization between the local SQLite database
 * (in the Electron desktop app) and the remote Laravel server.
 */

// Types for sync operations
interface SyncRecord {
    local_id: number;
    sync_uuid?: string;
    data: Record<string, unknown>;
    action: 'create' | 'update' | 'delete';
}

interface SyncResult {
    local_id: number;
    remote_id?: number;
    sync_uuid?: string;
    status: 'success' | 'conflict' | 'error';
    action?: string;
    conflict_id?: number;
    conflict_fields?: string[];
    message?: string;
    new_version?: number;
}

interface SyncUploadResponse {
    status: 'success' | 'error';
    message: string;
    data?: {
        processed: number;
        conflicts: number;
        results: SyncResult[];
    };
}

interface SyncDownloadResponse {
    status: 'success' | 'error';
    data?: {
        table: string;
        count: number;
        records: Record<string, unknown>[];
        has_more: boolean;
    };
}

interface ConflictData {
    id: number;
    table_name: string;
    local_record_id: number;
    remote_record_id: number;
    local_data: Record<string, unknown>;
    remote_data: Record<string, unknown>;
    conflict_fields: string[];
    resolution_status: string;
}

interface SyncStatus {
    pending_conflicts: number;
    pending_uploads: number;
    tables: Record<string, {
        server_count: number;
        server_latest: string | null;
        last_synced_at: string | null;
        last_synced_id: number | null;
    }>;
}

interface DeviceInfo {
    client_identifier: string;
    device_name?: string;
    device_type?: string;
    os_info?: string;
    app_version?: string;
}

// Check if we're running in Electron
declare global {
    interface Window {
        electronAPI?: {
            isElectron: () => Promise<boolean>;
            getDbPath: () => Promise<string>;
            getAppDataPath: () => Promise<string>;
            getServerUrl: () => Promise<string | null>;
            setServerUrl: (url: string) => Promise<boolean>;
            dbExecute: (sql: string, params?: unknown[]) => Promise<{ success: boolean; data?: unknown[]; changes?: number; lastInsertRowid?: number; error?: string }>;
            dbBatchExecute: (queries: Array<{ sql: string; params?: unknown[] }>) => Promise<{ success: boolean; results?: unknown[]; error?: string }>;
            getUnsyncedRecords: (tableName: string) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
            markAsSynced: (tableName: string, localId: number, remoteId: number) => Promise<{ success: boolean; error?: string }>;
            logSyncTransport: (logData: unknown) => Promise<{ success: boolean; id?: number; error?: string }>;
            getSyncLogs: (limit?: number) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
            createConflict: (conflictData: unknown) => Promise<{ success: boolean; id?: number; error?: string }>;
            getPendingConflicts: () => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
            resolveConflict: (conflictId: number, resolution: unknown) => Promise<{ success: boolean; error?: string }>;
            exportDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
            importDatabase: () => Promise<{ success: boolean; error?: string }>;
            onTriggerSync: (callback: () => void) => () => void;
            onShowSyncLog: (callback: () => void) => () => void;
            onShowConflicts: (callback: () => void) => () => void;
            onShowServerConfig: (callback: () => void) => () => void;
        };
        platform?: {
            isWindows: boolean;
            isMac: boolean;
            isLinux: boolean;
            platform: string;
            arch: string;
        };
    }
}

// Tables that can be synced
const SYNCABLE_TABLES = [
    'tension_records',
    'twisting_measurements',
    'weaving_measurements',
    'tension_problems',
    'stock_taking_records',
    'finish_earlier_records',
];

/**
 * Check if running in Electron environment
 */
export async function isElectron(): Promise<boolean> {
    try {
        if (window.electronAPI) {
            return await window.electronAPI.isElectron();
        }
    } catch {
        // Not in Electron
    }
    return false;
}

/**
 * Generate a unique client identifier for this device
 */
function generateClientIdentifier(): string {
    let identifier = localStorage.getItem('electron_client_identifier');
    if (!identifier) {
        identifier = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('electron_client_identifier', identifier);
    }
    return identifier;
}

/**
 * Get device information
 */
export function getDeviceInfo(): DeviceInfo {
    const platform = window.platform;
    return {
        client_identifier: generateClientIdentifier(),
        device_name: `${platform?.platform || 'Unknown'} Desktop`,
        device_type: 'desktop',
        os_info: platform ? `${platform.platform} ${platform.arch}` : 'Unknown',
        app_version: '1.0.0', // TODO: Get from package.json
    };
}

/**
 * ElectronSyncService class for managing data synchronization
 */
export class ElectronSyncService {
    private serverUrl: string | null = null;
    private authToken: string | null = null;
    private clientIdentifier: string;
    private isSyncing: boolean = false;
    private syncListeners: Array<(status: string) => void> = [];

    constructor() {
        this.clientIdentifier = generateClientIdentifier();
    }

    /**
     * Initialize the sync service
     */
    async initialize(): Promise<boolean> {
        if (!await isElectron()) {
            console.log('Not running in Electron, sync service disabled');
            return false;
        }

        try {
            this.serverUrl = await window.electronAPI!.getServerUrl();
            return true;
        } catch (error) {
            console.error('Failed to initialize sync service:', error);
            return false;
        }
    }

    /**
     * Set the server URL and authentication token
     */
    async configure(serverUrl: string, token?: string): Promise<boolean> {
        if (!await isElectron()) return false;

        try {
            const success = await window.electronAPI!.setServerUrl(serverUrl);
            if (success) {
                this.serverUrl = serverUrl;
                this.authToken = token || null;
            }
            return success;
        } catch (error) {
            console.error('Failed to configure sync service:', error);
            return false;
        }
    }

    /**
     * Register this device with the server
     */
    async registerDevice(): Promise<boolean> {
        if (!this.serverUrl) return false;

        try {
            const deviceInfo = getDeviceInfo();
            const response = await fetch(`${this.serverUrl}/api/sync/register-device`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(deviceInfo),
            });

            return response.ok;
        } catch (error) {
            console.error('Failed to register device:', error);
            return false;
        }
    }

    /**
     * Get sync status from server
     */
    async getSyncStatus(): Promise<SyncStatus | null> {
        if (!this.serverUrl) return null;

        try {
            const response = await fetch(
                `${this.serverUrl}/api/sync/status?client_identifier=${this.clientIdentifier}`,
                {
                    headers: this.getHeaders(),
                }
            );

            if (!response.ok) return null;
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Failed to get sync status:', error);
            return null;
        }
    }

    /**
     * Perform full sync (upload then download)
     */
    async performFullSync(): Promise<{
        success: boolean;
        uploaded: number;
        downloaded: number;
        conflicts: number;
        errors: string[];
    }> {
        if (this.isSyncing) {
            return { success: false, uploaded: 0, downloaded: 0, conflicts: 0, errors: ['Sync already in progress'] };
        }

        this.isSyncing = true;
        this.notifyListeners('syncing');

        const results = {
            success: true,
            uploaded: 0,
            downloaded: 0,
            conflicts: 0,
            errors: [] as string[],
        };

        try {
            // Step 1: Upload local changes to server
            for (const table of SYNCABLE_TABLES) {
                const uploadResult = await this.uploadTable(table);
                results.uploaded += uploadResult.uploaded;
                results.conflicts += uploadResult.conflicts;
                if (uploadResult.error) {
                    results.errors.push(`Upload ${table}: ${uploadResult.error}`);
                }
            }

            // Step 2: Download server changes to local
            for (const table of SYNCABLE_TABLES) {
                const downloadResult = await this.downloadTable(table);
                results.downloaded += downloadResult.downloaded;
                if (downloadResult.error) {
                    results.errors.push(`Download ${table}: ${downloadResult.error}`);
                }
            }

            results.success = results.errors.length === 0;
        } catch (error) {
            results.success = false;
            results.errors.push(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            this.isSyncing = false;
            this.notifyListeners(results.success ? 'completed' : 'error');
        }

        return results;
    }

    /**
     * Upload unsynced records from a table
     */
    async uploadTable(tableName: string): Promise<{
        uploaded: number;
        conflicts: number;
        error?: string;
    }> {
        if (!this.serverUrl || !window.electronAPI) {
            return { uploaded: 0, conflicts: 0, error: 'Not configured' };
        }

        try {
            // Get unsynced records from local database
            const unsyncedResult = await window.electronAPI.getUnsyncedRecords(tableName);
            if (!unsyncedResult.success || !unsyncedResult.data) {
                return { uploaded: 0, conflicts: 0, error: unsyncedResult.error };
            }

            const records = unsyncedResult.data as Record<string, unknown>[];
            if (records.length === 0) {
                return { uploaded: 0, conflicts: 0 };
            }

            // Prepare records for upload
            const syncRecords: SyncRecord[] = records.map((record) => ({
                local_id: record.id as number,
                sync_uuid: record.sync_uuid as string | undefined,
                data: record,
                action: record.deleted_at ? 'delete' : (record.remote_id ? 'update' : 'create'),
            }));

            // Upload to server
            const response = await fetch(`${this.serverUrl}/api/sync/upload`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    client_identifier: this.clientIdentifier,
                    table_name: tableName,
                    records: syncRecords,
                }),
            });

            if (!response.ok) {
                return { uploaded: 0, conflicts: 0, error: `HTTP ${response.status}` };
            }

            const result: SyncUploadResponse = await response.json();
            
            if (result.status !== 'success' || !result.data) {
                return { uploaded: 0, conflicts: 0, error: result.message };
            }

            // Mark successfully synced records
            for (const syncResult of result.data.results) {
                if (syncResult.status === 'success' && syncResult.remote_id) {
                    await window.electronAPI.markAsSynced(tableName, syncResult.local_id, syncResult.remote_id);
                }
            }

            // Log sync operation
            await window.electronAPI.logSyncTransport({
                sync_direction: 'upload',
                table_name: tableName,
                record_id: 0,
                action: 'update',
                status: 'success',
                payload: { count: result.data.processed },
            });

            return {
                uploaded: result.data.processed - result.data.conflicts,
                conflicts: result.data.conflicts,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Log failed sync
            if (window.electronAPI) {
                await window.electronAPI.logSyncTransport({
                    sync_direction: 'upload',
                    table_name: tableName,
                    record_id: 0,
                    action: 'update',
                    status: 'failed',
                    error_message: errorMessage,
                });
            }

            return { uploaded: 0, conflicts: 0, error: errorMessage };
        }
    }

    /**
     * Download records from server to local database
     */
    async downloadTable(tableName: string): Promise<{
        downloaded: number;
        error?: string;
    }> {
        if (!this.serverUrl || !window.electronAPI) {
            return { downloaded: 0, error: 'Not configured' };
        }

        try {
            // Get last sync checkpoint
            const checkpointResult = await window.electronAPI.dbExecute(
                `SELECT last_synced_at, last_synced_id FROM sync_checkpoints 
                 WHERE client_identifier = ? AND table_name = ?`,
                [this.clientIdentifier, tableName]
            );

            let since: string | null = null;
            let sinceId: number | null = null;

            if (checkpointResult.success && checkpointResult.data && (checkpointResult.data as unknown[]).length > 0) {
                const checkpoint = (checkpointResult.data as Record<string, unknown>[])[0];
                since = checkpoint.last_synced_at as string | null;
                sinceId = checkpoint.last_synced_id as number | null;
            }

            let totalDownloaded = 0;
            let hasMore = true;

            while (hasMore) {
                // Download from server
                const params = new URLSearchParams({
                    client_identifier: this.clientIdentifier,
                    table_name: tableName,
                    limit: '100',
                });
                if (since) params.append('since', since);
                if (sinceId) params.append('since_id', sinceId.toString());

                const response = await fetch(`${this.serverUrl}/api/sync/download?${params}`, {
                    headers: this.getHeaders(),
                });

                if (!response.ok) {
                    return { downloaded: totalDownloaded, error: `HTTP ${response.status}` };
                }

                const result: SyncDownloadResponse = await response.json();
                
                if (result.status !== 'success' || !result.data) {
                    return { downloaded: totalDownloaded, error: 'Download failed' };
                }

                // Insert/update records in local database
                for (const record of result.data.records) {
                    await this.upsertLocalRecord(tableName, record);
                    totalDownloaded++;
                }

                // Update checkpoint
                if (result.data.records.length > 0) {
                    const lastRecord = result.data.records[result.data.records.length - 1];
                    sinceId = lastRecord.id as number;
                    since = lastRecord.updated_at as string;

                    await window.electronAPI.dbExecute(
                        `INSERT OR REPLACE INTO sync_checkpoints 
                         (client_identifier, table_name, last_synced_at, last_synced_id)
                         VALUES (?, ?, ?, ?)`,
                        [this.clientIdentifier, tableName, since, sinceId]
                    );
                }

                hasMore = result.data.has_more;
            }

            return { downloaded: totalDownloaded };
        } catch (error) {
            return { downloaded: 0, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Insert or update a record in local database
     */
    private async upsertLocalRecord(tableName: string, record: Record<string, unknown>): Promise<void> {
        if (!window.electronAPI) return;

        const syncUuid = record.sync_uuid as string;
        
        // Check if record exists
        const existingResult = await window.electronAPI.dbExecute(
            `SELECT id FROM ${tableName} WHERE sync_uuid = ?`,
            [syncUuid]
        );

        if (existingResult.success && existingResult.data && (existingResult.data as unknown[]).length > 0) {
            // Update existing record
            const existing = (existingResult.data as Record<string, unknown>[])[0];
            const fields = Object.keys(record).filter(k => k !== 'id' && k !== 'sync_uuid');
            const setClause = fields.map(f => `${f} = ?`).join(', ');
            const values = fields.map(f => record[f]);
            values.push(existing.id);

            await window.electronAPI.dbExecute(
                `UPDATE ${tableName} SET ${setClause}, synced_at = datetime('now'), local_modified = 0 WHERE id = ?`,
                values
            );
        } else {
            // Insert new record
            const fields = Object.keys(record).filter(k => k !== 'id');
            const placeholders = fields.map(() => '?').join(', ');
            const values = fields.map(f => record[f]);

            await window.electronAPI.dbExecute(
                `INSERT INTO ${tableName} (${fields.join(', ')}, synced_at, local_modified, remote_id)
                 VALUES (${placeholders}, datetime('now'), 0, ?)`,
                [...values, record.id]
            );
        }
    }

    /**
     * Get pending conflicts
     */
    async getPendingConflicts(): Promise<ConflictData[]> {
        if (!this.serverUrl) return [];

        try {
            const response = await fetch(
                `${this.serverUrl}/api/sync/conflicts?client_identifier=${this.clientIdentifier}`,
                {
                    headers: this.getHeaders(),
                }
            );

            if (!response.ok) return [];
            const result = await response.json();
            return result.data?.data || [];
        } catch (error) {
            console.error('Failed to get conflicts:', error);
            return [];
        }
    }

    /**
     * Resolve a conflict
     */
    async resolveConflict(
        conflictId: number,
        resolution: 'local_wins' | 'remote_wins' | 'merged' | 'dismissed',
        mergedData?: Record<string, unknown>,
        notes?: string
    ): Promise<boolean> {
        if (!this.serverUrl) return false;

        try {
            const response = await fetch(`${this.serverUrl}/api/sync/conflicts/${conflictId}/resolve`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    resolution,
                    merged_data: mergedData,
                    notes,
                }),
            });

            return response.ok;
        } catch (error) {
            console.error('Failed to resolve conflict:', error);
            return false;
        }
    }

    /**
     * Get headers for API requests
     */
    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        return headers;
    }

    /**
     * Add a listener for sync status changes
     */
    addSyncListener(listener: (status: string) => void): () => void {
        this.syncListeners.push(listener);
        return () => {
            this.syncListeners = this.syncListeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify all listeners of status change
     */
    private notifyListeners(status: string): void {
        this.syncListeners.forEach(listener => listener(status));
    }

    /**
     * Check if sync is in progress
     */
    isSyncInProgress(): boolean {
        return this.isSyncing;
    }
}

// Create singleton instance
export const electronSyncService = new ElectronSyncService();

// Export helper hook for React components
export function useSyncService() {
    return electronSyncService;
}
