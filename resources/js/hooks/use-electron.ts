import { useState, useEffect, useCallback } from 'react';
import type { ElectronAPI, SyncStatus, TensionRecord, StockTakeRecord, FinishEarlierRecord } from '@/types/electron';

/**
 * Hook to check if the app is running in Electron
 */
export function useIsElectron(): boolean {
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        setIsElectron(
            typeof window !== 'undefined' && 
            (window as Window & { isElectron?: boolean }).isElectron === true
        );
    }, []);

    return isElectron;
}

/**
 * Hook to get the Electron API
 */
export function useElectronAPI(): ElectronAPI | null {
    const isElectron = useIsElectron();
    
    if (!isElectron || typeof window === 'undefined') {
        return null;
    }
    
    return (window as Window & { electronAPI?: ElectronAPI }).electronAPI || null;
}

/**
 * Hook to get sync status in Electron
 */
export function useSyncStatus(): {
    status: SyncStatus | null;
    loading: boolean;
    refresh: () => Promise<void>;
} {
    const api = useElectronAPI();
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!api) {
            setLoading(false);
            return;
        }

        try {
            const syncStatus = await api.sync.getStatus();
            setStatus(syncStatus);
        } catch (error) {
            console.error('Failed to fetch sync status:', error);
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        refresh();

        // Subscribe to sync progress for real-time updates
        if (api) {
            const unsubscribe = api.sync.onProgress((progress) => {
                if (progress.phase === 'complete') {
                    refresh();
                }
            });

            return () => {
                unsubscribe?.();
            };
        }
    }, [api, refresh]);

    return { status, loading, refresh };
}

type DatabaseRecordType = 'tension' | 'stocktake' | 'finishEarlier';
type RecordDataMap = {
    tension: Omit<TensionRecord, 'id'>;
    stocktake: Omit<StockTakeRecord, 'id'>;
    finishEarlier: Omit<FinishEarlierRecord, 'id'>;
};

/**
 * Helper to save data using Electron's local database or fallback to API
 */
export async function saveToDatabase<T extends DatabaseRecordType>(
    tableName: T,
    data: RecordDataMap[T],
    electronAPI: ElectronAPI | null
): Promise<{ success: boolean; id?: number; error?: string }> {
    if (electronAPI) {
        // Use local database
        switch (tableName) {
            case 'tension':
                return electronAPI.database.tension.create(data as Omit<TensionRecord, 'id'>);
            case 'stocktake':
                return electronAPI.database.stocktake.create(data as Omit<StockTakeRecord, 'id'>);
            case 'finishEarlier':
                return electronAPI.database.finishEarlier.create(data as Omit<FinishEarlierRecord, 'id'>);
        }
    }
    
    // Fallback: return error indicating no Electron API
    return { success: false, error: 'Electron API not available' };
}
