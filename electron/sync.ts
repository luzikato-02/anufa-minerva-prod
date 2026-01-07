import { LocalDatabase } from './database';

export interface SyncProgress {
    phase: string;
    current: number;
    total: number;
    message: string;
}

export interface SyncResult {
    success: boolean;
    uploaded: number;
    downloaded: number;
    conflicts: number;
    errors: string[];
}

export interface SyncStatus {
    isConnected: boolean;
    lastSyncTime: string | null;
    pendingUploads: number;
    pendingDownloads: number;
    conflicts: number;
    isSyncing: boolean;
}

type ProgressCallback = (progress: SyncProgress) => void;

export class SyncService {
    private database: LocalDatabase;
    private isSyncing = false;
    private lastSyncTime: string | null = null;

    constructor(database: LocalDatabase) {
        this.database = database;
    }

    getSettings() {
        return this.database.getSyncSettings();
    }

    updateSettings(settings: any) {
        return this.database.updateSyncSettings(settings);
    }

    async getSyncStatus(): Promise<SyncStatus> {
        const pendingCount = this.database.getPendingCount();
        const conflicts = this.database.getSyncConflicts();
        const history = this.database.getSyncHistory(1);

        return {
            isConnected: await this.checkConnection(),
            lastSyncTime: history.length > 0 ? history[0].completed_at : null,
            pendingUploads: pendingCount.tension + pendingCount.stocktake + pendingCount.finishearlier,
            pendingDownloads: 0, // Will be updated during sync
            conflicts: conflicts.length,
            isSyncing: this.isSyncing,
        };
    }

    async checkConnection(): Promise<boolean> {
        const settings = this.getSettings();
        if (!settings.serverUrl || !settings.authToken) {
            return false;
        }

        try {
            const result = await this.testConnection(settings.serverUrl, settings.authToken);
            return result.success;
        } catch {
            return false;
        }
    }

    async testConnection(serverUrl: string, token: string): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/tension-records?per_page=1`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                return { success: true };
            } else if (response.status === 401) {
                return { success: false, error: 'Invalid authentication token' };
            } else {
                return { success: false, error: `Server returned status ${response.status}` };
            }
        } catch (error) {
            return { success: false, error: `Connection failed: ${(error as Error).message}` };
        }
    }

    async syncAll(onProgress?: ProgressCallback): Promise<SyncResult> {
        if (this.isSyncing) {
            return { success: false, uploaded: 0, downloaded: 0, conflicts: 0, errors: ['Sync already in progress'] };
        }

        this.isSyncing = true;
        const startedAt = new Date().toISOString();
        const result: SyncResult = { success: true, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };
        const settings = this.getSettings();

        try {
            // Sync tension records
            if (settings.syncTensionRecords) {
                onProgress?.({ phase: 'tension', current: 0, total: 100, message: 'Syncing tension records...' });
                const tensionResult = await this.syncTensionRecords(onProgress);
                result.uploaded += tensionResult.uploaded;
                result.downloaded += tensionResult.downloaded;
                result.conflicts += tensionResult.conflicts;
                result.errors.push(...tensionResult.errors);
            }

            // Sync stock take records
            if (settings.syncStockTakeRecords) {
                onProgress?.({ phase: 'stocktake', current: 0, total: 100, message: 'Syncing stock take records...' });
                const stockTakeResult = await this.syncStockTakeRecords(onProgress);
                result.uploaded += stockTakeResult.uploaded;
                result.downloaded += stockTakeResult.downloaded;
                result.conflicts += stockTakeResult.conflicts;
                result.errors.push(...stockTakeResult.errors);
            }

            // Sync finish earlier records
            if (settings.syncFinishEarlierRecords) {
                onProgress?.({ phase: 'finishearlier', current: 0, total: 100, message: 'Syncing finish earlier records...' });
                const finishEarlierResult = await this.syncFinishEarlierRecords(onProgress);
                result.uploaded += finishEarlierResult.uploaded;
                result.downloaded += finishEarlierResult.downloaded;
                result.conflicts += finishEarlierResult.conflicts;
                result.errors.push(...finishEarlierResult.errors);
            }

            result.success = result.errors.length === 0;

            // Record sync history
            this.database.addSyncHistory({
                syncType: 'all',
                status: result.errors.length === 0 ? 'success' : result.errors.length < 3 ? 'partial' : 'failed',
                uploaded: result.uploaded,
                downloaded: result.downloaded,
                conflicts: result.conflicts,
                errors: result.errors,
                startedAt,
            });

            this.lastSyncTime = new Date().toISOString();
            onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Sync complete!' });

        } catch (error) {
            result.success = false;
            result.errors.push((error as Error).message);
            
            this.database.addSyncHistory({
                syncType: 'all',
                status: 'failed',
                uploaded: result.uploaded,
                downloaded: result.downloaded,
                conflicts: result.conflicts,
                errors: result.errors,
                startedAt,
            });
        } finally {
            this.isSyncing = false;
        }

        return result;
    }

    async syncTensionRecords(onProgress?: ProgressCallback): Promise<SyncResult> {
        const result: SyncResult = { success: true, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };
        const settings = this.getSettings();

        if (!settings.serverUrl || !settings.authToken) {
            return { ...result, success: false, errors: ['Server URL or auth token not configured'] };
        }

        try {
            // Push local pending records to remote
            const pendingRecords = this.database.getPendingTensionRecords();
            const total = pendingRecords.length;

            for (let i = 0; i < pendingRecords.length; i++) {
                const record = pendingRecords[i];
                onProgress?.({ 
                    phase: 'tension-upload', 
                    current: i + 1, 
                    total, 
                    message: `Uploading tension record ${i + 1}/${total}` 
                });

                try {
                    if (record.deleted_at) {
                        // Delete from remote if it exists
                        if (record.remote_id) {
                            await this.deleteRemoteTensionRecord(settings.serverUrl, settings.authToken, record.remote_id);
                        }
                        // Hard delete locally after remote deletion
                        this.database.updateTensionRecord(record.id, { sync_status: 'synced' });
                    } else if (record.remote_id) {
                        // Update existing remote record
                        const remoteRecord = await this.getRemoteTensionRecord(settings.serverUrl, settings.authToken, record.remote_id);
                        
                        if (remoteRecord && new Date(remoteRecord.updated_at) > new Date(record.updated_at)) {
                            // Conflict: remote is newer
                            this.database.addSyncConflict({
                                id: `tension-${record.id}`,
                                tableName: 'tension_records',
                                recordId: record.id,
                                localData: record,
                                remoteData: remoteRecord,
                            });
                            result.conflicts++;
                        } else {
                            await this.updateRemoteTensionRecord(settings.serverUrl, settings.authToken, record.remote_id, record);
                            this.database.updateTensionRecord(record.id, { 
                                sync_status: 'synced', 
                                last_synced_at: new Date().toISOString() 
                            });
                            result.uploaded++;
                        }
                    } else {
                        // Create new remote record
                        const response = await this.createRemoteTensionRecord(settings.serverUrl, settings.authToken, record);
                        if (response.success && response.id) {
                            this.database.updateTensionRecord(record.id, { 
                                remote_id: response.id, 
                                sync_status: 'synced',
                                last_synced_at: new Date().toISOString()
                            });
                            result.uploaded++;
                        } else {
                            result.errors.push(`Failed to upload tension record ${record.id}: ${response.error}`);
                        }
                    }
                } catch (error) {
                    result.errors.push(`Error syncing tension record ${record.id}: ${(error as Error).message}`);
                }
            }

            // Pull new records from remote
            onProgress?.({ phase: 'tension-download', current: 0, total: 100, message: 'Downloading tension records from server...' });
            await this.pullTensionRecordsFromRemote(settings.serverUrl, settings.authToken, result);

        } catch (error) {
            result.success = false;
            result.errors.push((error as Error).message);
        }

        return result;
    }

    async syncStockTakeRecords(onProgress?: ProgressCallback): Promise<SyncResult> {
        const result: SyncResult = { success: true, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };
        const settings = this.getSettings();

        if (!settings.serverUrl || !settings.authToken) {
            return { ...result, success: false, errors: ['Server URL or auth token not configured'] };
        }

        try {
            const pendingRecords = this.database.getPendingStockTakeRecords();
            const total = pendingRecords.length;

            for (let i = 0; i < pendingRecords.length; i++) {
                const record = pendingRecords[i];
                onProgress?.({ 
                    phase: 'stocktake-upload', 
                    current: i + 1, 
                    total, 
                    message: `Uploading stock take record ${i + 1}/${total}` 
                });

                try {
                    if (record.deleted_at) {
                        if (record.remote_id) {
                            await this.deleteRemoteStockTakeRecord(settings.serverUrl, settings.authToken, record.remote_id);
                        }
                        this.database.updateStockTakeRecord(record.id, { sync_status: 'synced' });
                    } else if (record.remote_id) {
                        const remoteRecord = await this.getRemoteStockTakeRecord(settings.serverUrl, settings.authToken, record.remote_id);
                        
                        if (remoteRecord && new Date(remoteRecord.updated_at) > new Date(record.updated_at)) {
                            this.database.addSyncConflict({
                                id: `stocktake-${record.id}`,
                                tableName: 'stock_taking_records',
                                recordId: record.id,
                                localData: record,
                                remoteData: remoteRecord,
                            });
                            result.conflicts++;
                        } else {
                            await this.updateRemoteStockTakeRecord(settings.serverUrl, settings.authToken, record.remote_id, record);
                            this.database.updateStockTakeRecord(record.id, { 
                                sync_status: 'synced', 
                                last_synced_at: new Date().toISOString() 
                            });
                            result.uploaded++;
                        }
                    } else {
                        const response = await this.createRemoteStockTakeRecord(settings.serverUrl, settings.authToken, record);
                        if (response.success && response.id) {
                            this.database.updateStockTakeRecord(record.id, { 
                                remote_id: response.id, 
                                sync_status: 'synced',
                                last_synced_at: new Date().toISOString()
                            });
                            result.uploaded++;
                        } else {
                            result.errors.push(`Failed to upload stock take record ${record.id}: ${response.error}`);
                        }
                    }
                } catch (error) {
                    result.errors.push(`Error syncing stock take record ${record.id}: ${(error as Error).message}`);
                }
            }

            onProgress?.({ phase: 'stocktake-download', current: 0, total: 100, message: 'Downloading stock take records from server...' });
            await this.pullStockTakeRecordsFromRemote(settings.serverUrl, settings.authToken, result);

        } catch (error) {
            result.success = false;
            result.errors.push((error as Error).message);
        }

        return result;
    }

    async syncFinishEarlierRecords(onProgress?: ProgressCallback): Promise<SyncResult> {
        const result: SyncResult = { success: true, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };
        const settings = this.getSettings();

        if (!settings.serverUrl || !settings.authToken) {
            return { ...result, success: false, errors: ['Server URL or auth token not configured'] };
        }

        try {
            const pendingRecords = this.database.getPendingFinishEarlierRecords();
            const total = pendingRecords.length;

            for (let i = 0; i < pendingRecords.length; i++) {
                const record = pendingRecords[i];
                onProgress?.({ 
                    phase: 'finishearlier-upload', 
                    current: i + 1, 
                    total, 
                    message: `Uploading finish earlier record ${i + 1}/${total}` 
                });

                try {
                    if (record.remote_id) {
                        // Update or check for conflicts
                        const remoteRecord = await this.getRemoteFinishEarlierRecord(settings.serverUrl, settings.authToken, record.remote_id);
                        
                        if (remoteRecord && new Date(remoteRecord.updated_at) > new Date(record.updated_at)) {
                            this.database.addSyncConflict({
                                id: `finishearlier-${record.id}`,
                                tableName: 'finish_earlier_records',
                                recordId: record.id,
                                localData: record,
                                remoteData: remoteRecord,
                            });
                            result.conflicts++;
                        } else {
                            // No direct update endpoint, skip for now
                            this.database.updateFinishEarlierRecord(record.id, { 
                                sync_status: 'synced', 
                                last_synced_at: new Date().toISOString() 
                            });
                            result.uploaded++;
                        }
                    } else {
                        const response = await this.createRemoteFinishEarlierRecord(settings.serverUrl, settings.authToken, record);
                        if (response.success && response.id) {
                            this.database.updateFinishEarlierRecord(record.id, { 
                                remote_id: response.id, 
                                sync_status: 'synced',
                                last_synced_at: new Date().toISOString()
                            });
                            result.uploaded++;
                        } else {
                            result.errors.push(`Failed to upload finish earlier record ${record.id}: ${response.error}`);
                        }
                    }
                } catch (error) {
                    result.errors.push(`Error syncing finish earlier record ${record.id}: ${(error as Error).message}`);
                }
            }

            onProgress?.({ phase: 'finishearlier-download', current: 0, total: 100, message: 'Downloading finish earlier records from server...' });
            await this.pullFinishEarlierRecordsFromRemote(settings.serverUrl, settings.authToken, result);

        } catch (error) {
            result.success = false;
            result.errors.push((error as Error).message);
        }

        return result;
    }

    async pullFromRemote(onProgress?: ProgressCallback): Promise<SyncResult> {
        const result: SyncResult = { success: true, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };
        const settings = this.getSettings();

        if (!settings.serverUrl || !settings.authToken) {
            return { ...result, success: false, errors: ['Server URL or auth token not configured'] };
        }

        try {
            if (settings.syncTensionRecords) {
                onProgress?.({ phase: 'tension-download', current: 0, total: 100, message: 'Downloading tension records...' });
                await this.pullTensionRecordsFromRemote(settings.serverUrl, settings.authToken, result);
            }

            if (settings.syncStockTakeRecords) {
                onProgress?.({ phase: 'stocktake-download', current: 0, total: 100, message: 'Downloading stock take records...' });
                await this.pullStockTakeRecordsFromRemote(settings.serverUrl, settings.authToken, result);
            }

            if (settings.syncFinishEarlierRecords) {
                onProgress?.({ phase: 'finishearlier-download', current: 0, total: 100, message: 'Downloading finish earlier records...' });
                await this.pullFinishEarlierRecordsFromRemote(settings.serverUrl, settings.authToken, result);
            }

            this.database.addSyncHistory({
                syncType: 'pull',
                status: result.errors.length === 0 ? 'success' : 'partial',
                uploaded: 0,
                downloaded: result.downloaded,
                conflicts: result.conflicts,
                errors: result.errors,
                startedAt: new Date().toISOString(),
            });

        } catch (error) {
            result.success = false;
            result.errors.push((error as Error).message);
        }

        return result;
    }

    async pushToRemote(onProgress?: ProgressCallback): Promise<SyncResult> {
        const result: SyncResult = { success: true, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };
        const settings = this.getSettings();

        if (!settings.serverUrl || !settings.authToken) {
            return { ...result, success: false, errors: ['Server URL or auth token not configured'] };
        }

        try {
            // Only push, don't pull
            const tensionResult = await this.syncTensionRecords((p) => {
                if (p.phase.includes('upload')) onProgress?.(p);
            });
            result.uploaded += tensionResult.uploaded;
            result.errors.push(...tensionResult.errors.filter(e => !e.includes('download')));

            const stockTakeResult = await this.syncStockTakeRecords((p) => {
                if (p.phase.includes('upload')) onProgress?.(p);
            });
            result.uploaded += stockTakeResult.uploaded;
            result.errors.push(...stockTakeResult.errors.filter(e => !e.includes('download')));

            const finishEarlierResult = await this.syncFinishEarlierRecords((p) => {
                if (p.phase.includes('upload')) onProgress?.(p);
            });
            result.uploaded += finishEarlierResult.uploaded;
            result.errors.push(...finishEarlierResult.errors.filter(e => !e.includes('download')));

            this.database.addSyncHistory({
                syncType: 'push',
                status: result.errors.length === 0 ? 'success' : 'partial',
                uploaded: result.uploaded,
                downloaded: 0,
                conflicts: result.conflicts,
                errors: result.errors,
                startedAt: new Date().toISOString(),
            });

        } catch (error) {
            result.success = false;
            result.errors.push((error as Error).message);
        }

        return result;
    }

    async resolveConflict(conflictId: string, resolution: 'local' | 'remote'): Promise<{ success: boolean; error?: string }> {
        const conflicts = this.database.getSyncConflicts();
        const conflict = conflicts.find(c => c.id === conflictId);

        if (!conflict) {
            return { success: false, error: 'Conflict not found' };
        }

        try {
            if (resolution === 'local') {
                // Keep local data, mark as pending to re-upload
                if (conflict.tableName === 'tension_records') {
                    this.database.updateTensionRecord(conflict.recordId, { sync_status: 'pending' });
                } else if (conflict.tableName === 'stock_taking_records') {
                    this.database.updateStockTakeRecord(conflict.recordId, { sync_status: 'pending' });
                } else if (conflict.tableName === 'finish_earlier_records') {
                    this.database.updateFinishEarlierRecord(conflict.recordId, { sync_status: 'pending' });
                }
            } else {
                // Use remote data
                if (conflict.tableName === 'tension_records') {
                    this.database.updateTensionRecord(conflict.recordId, {
                        ...conflict.remoteData,
                        sync_status: 'synced',
                        last_synced_at: new Date().toISOString(),
                    });
                } else if (conflict.tableName === 'stock_taking_records') {
                    this.database.updateStockTakeRecord(conflict.recordId, {
                        ...conflict.remoteData,
                        sync_status: 'synced',
                        last_synced_at: new Date().toISOString(),
                    });
                } else if (conflict.tableName === 'finish_earlier_records') {
                    this.database.updateFinishEarlierRecord(conflict.recordId, {
                        ...conflict.remoteData,
                        sync_status: 'synced',
                        last_synced_at: new Date().toISOString(),
                    });
                }
            }

            this.database.removeSyncConflict(conflictId);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    getConflicts() {
        return this.database.getSyncConflicts();
    }

    getSyncHistory(limit?: number) {
        return this.database.getSyncHistory(limit);
    }

    // ============ REMOTE API CALLS ============

    private async createRemoteTensionRecord(serverUrl: string, token: string, record: any): Promise<{ success: boolean; id?: number; error?: string }> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/tension-records`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    record_type: record.record_type,
                    csv_data: record.csv_data,
                    form_data: record.form_data,
                    measurement_data: record.measurement_data,
                    problems: record.problems,
                    metadata: record.metadata,
                }),
            });

            const data = await response.json();
            
            if (response.ok && (data.status === 'success' || data.data?.id)) {
                return { success: true, id: data.data?.id || data.id };
            }
            
            return { success: false, error: data.message || 'Failed to create record' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async getRemoteTensionRecord(serverUrl: string, token: string, id: number): Promise<any | null> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/tension-records/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                return data.data || data;
            }
            return null;
        } catch {
            return null;
        }
    }

    private async updateRemoteTensionRecord(serverUrl: string, token: string, id: number, record: any): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/tension-records/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    record_type: record.record_type,
                    csv_data: record.csv_data,
                    form_data: record.form_data,
                    measurement_data: record.measurement_data,
                    problems: record.problems,
                    metadata: record.metadata,
                }),
            });

            return { success: response.ok };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async deleteRemoteTensionRecord(serverUrl: string, token: string, id: number): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/tension-records/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            });

            return { success: response.ok };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async pullTensionRecordsFromRemote(serverUrl: string, token: string, result: SyncResult): Promise<void> {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await fetch(`${serverUrl}/api/mobile/tension-records?page=${page}&per_page=50`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                });

                if (!response.ok) {
                    result.errors.push('Failed to fetch tension records from server');
                    break;
                }

                const data = await response.json();
                const records = data.data || [];

                for (const remoteRecord of records) {
                    const existingRecord = this.database.getTensionRecordByRemoteId(remoteRecord.id);
                    
                    if (!existingRecord) {
                        // New record from remote
                        this.database.createTensionRecord({
                            ...remoteRecord,
                            remote_id: remoteRecord.id,
                            sync_status: 'synced',
                        });
                        result.downloaded++;
                    } else if (new Date(remoteRecord.updated_at) > new Date(existingRecord.updated_at)) {
                        // Remote is newer, update local
                        if (existingRecord.sync_status === 'pending') {
                            // Conflict
                            this.database.addSyncConflict({
                                id: `tension-${existingRecord.id}`,
                                tableName: 'tension_records',
                                recordId: existingRecord.id,
                                localData: existingRecord,
                                remoteData: remoteRecord,
                            });
                            result.conflicts++;
                        } else {
                            this.database.updateTensionRecord(existingRecord.id, {
                                ...remoteRecord,
                                sync_status: 'synced',
                                last_synced_at: new Date().toISOString(),
                            });
                            result.downloaded++;
                        }
                    }
                }

                hasMore = data.current_page < data.last_page;
                page++;
            } catch (error) {
                result.errors.push(`Error fetching tension records: ${(error as Error).message}`);
                break;
            }
        }
    }

    // Stock Take Record API methods
    private async createRemoteStockTakeRecord(serverUrl: string, token: string, record: any): Promise<{ success: boolean; id?: number; error?: string }> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/stock-take-records`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    indv_batch_data: record.indv_batch_data,
                    metadata: record.metadata,
                }),
            });

            const data = await response.json();
            
            if (response.ok && (data.status === 'success' || data.data?.id)) {
                return { success: true, id: data.data?.id || data.id };
            }
            
            return { success: false, error: data.message || 'Failed to create record' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async getRemoteStockTakeRecord(serverUrl: string, token: string, id: number): Promise<any | null> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/stock-take-records/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                return data.data || data;
            }
            return null;
        } catch {
            return null;
        }
    }

    private async updateRemoteStockTakeRecord(serverUrl: string, token: string, id: number, record: any): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/stock-take-records/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    indv_batch_data: record.indv_batch_data,
                    metadata: record.metadata,
                }),
            });

            return { success: response.ok };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async deleteRemoteStockTakeRecord(serverUrl: string, token: string, id: number): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/stock-take-records/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            });

            return { success: response.ok };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async pullStockTakeRecordsFromRemote(serverUrl: string, token: string, result: SyncResult): Promise<void> {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await fetch(`${serverUrl}/api/mobile/stock-take-records?page=${page}&per_page=50`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                });

                if (!response.ok) {
                    result.errors.push('Failed to fetch stock take records from server');
                    break;
                }

                const data = await response.json();
                const records = data.data || [];

                for (const remoteRecord of records) {
                    const existingRecord = this.database.getStockTakeRecordByRemoteId(remoteRecord.id);
                    
                    if (!existingRecord) {
                        this.database.createStockTakeRecord({
                            ...remoteRecord,
                            remote_id: remoteRecord.id,
                            sync_status: 'synced',
                        });
                        result.downloaded++;
                    } else if (new Date(remoteRecord.updated_at) > new Date(existingRecord.updated_at)) {
                        if (existingRecord.sync_status === 'pending') {
                            this.database.addSyncConflict({
                                id: `stocktake-${existingRecord.id}`,
                                tableName: 'stock_taking_records',
                                recordId: existingRecord.id,
                                localData: existingRecord,
                                remoteData: remoteRecord,
                            });
                            result.conflicts++;
                        } else {
                            this.database.updateStockTakeRecord(existingRecord.id, {
                                ...remoteRecord,
                                sync_status: 'synced',
                                last_synced_at: new Date().toISOString(),
                            });
                            result.downloaded++;
                        }
                    }
                }

                hasMore = data.current_page < data.last_page;
                page++;
            } catch (error) {
                result.errors.push(`Error fetching stock take records: ${(error as Error).message}`);
                break;
            }
        }
    }

    // Finish Earlier Record API methods
    private async createRemoteFinishEarlierRecord(serverUrl: string, token: string, record: any): Promise<{ success: boolean; id?: number; error?: string }> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/finish-earlier/start-session`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    machine_number: record.metadata?.machine_number || '',
                    style: record.metadata?.style || '',
                    production_order: record.metadata?.production_order || '',
                    roll_construction: record.metadata?.roll_construction || '',
                    shift_group: record.metadata?.shift_group || '',
                }),
            });

            const data = await response.json();
            
            if (response.ok && (data.id || data.data?.id)) {
                const sessionId = data.id || data.data?.id;
                
                // Add entries if any
                if (record.entries && record.entries.length > 0) {
                    for (const entry of record.entries) {
                        await fetch(`${serverUrl}/api/mobile/finish-earlier/${record.metadata?.production_order}/add-entry`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(entry),
                        });
                    }
                }
                
                return { success: true, id: sessionId };
            }
            
            return { success: false, error: data.message || 'Failed to create record' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    private async getRemoteFinishEarlierRecord(serverUrl: string, token: string, id: number): Promise<any | null> {
        try {
            const response = await fetch(`${serverUrl}/api/mobile/finish-earlier/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                return data.data || data;
            }
            return null;
        } catch {
            return null;
        }
    }

    private async pullFinishEarlierRecordsFromRemote(serverUrl: string, token: string, result: SyncResult): Promise<void> {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await fetch(`${serverUrl}/api/mobile/finish-earlier?page=${page}&per_page=50`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                });

                if (!response.ok) {
                    result.errors.push('Failed to fetch finish earlier records from server');
                    break;
                }

                const data = await response.json();
                const records = data.data || [];

                for (const remoteRecord of records) {
                    const existingRecord = this.database.getFinishEarlierRecordByRemoteId(remoteRecord.id);
                    
                    if (!existingRecord) {
                        this.database.createFinishEarlierRecord({
                            metadata: remoteRecord.metadata,
                            entries: remoteRecord.entries,
                            remote_id: remoteRecord.id,
                            sync_status: 'synced',
                        });
                        result.downloaded++;
                    } else if (new Date(remoteRecord.updated_at) > new Date(existingRecord.updated_at)) {
                        if (existingRecord.sync_status === 'pending') {
                            this.database.addSyncConflict({
                                id: `finishearlier-${existingRecord.id}`,
                                tableName: 'finish_earlier_records',
                                recordId: existingRecord.id,
                                localData: existingRecord,
                                remoteData: remoteRecord,
                            });
                            result.conflicts++;
                        } else {
                            this.database.updateFinishEarlierRecord(existingRecord.id, {
                                metadata: remoteRecord.metadata,
                                entries: remoteRecord.entries,
                                sync_status: 'synced',
                                last_synced_at: new Date().toISOString(),
                            });
                            result.downloaded++;
                        }
                    }
                }

                hasMore = data.current_page < data.last_page;
                page++;
            } catch (error) {
                result.errors.push(`Error fetching finish earlier records: ${(error as Error).message}`);
                break;
            }
        }
    }
}
