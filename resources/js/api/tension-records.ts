/** Server calls for tension records and resumable weaving sessions. */

import { fetchXsrfToken } from '@/lib/csrf';
import type {
    TensionRecordPayload,
    WeavingFormData,
    WeavingSession,
} from '@/types/tension';

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
} as const;

export interface SaveTensionRecordResult {
    success: boolean;
    id?: number;
    message?: string;
    data?: { id?: number };
    error?: string;
}

export async function saveTensionRecord(
    record: TensionRecordPayload,
): Promise<SaveTensionRecordResult> {
    try {
        const csrfToken = await fetchXsrfToken();

        const response = await fetch(
            `${window.location.origin}/tension-records`,
            {
                method: 'POST',
                headers: { ...JSON_HEADERS, 'X-XSRF-TOKEN': csrfToken },
                body: JSON.stringify(record),
                credentials: 'include',
            },
        );

        const resultText = await response.text();

        let result: {
            status?: string;
            success?: boolean;
            id?: number;
            message?: string;
            error?: string;
            data?: { id?: number };
        };
        try {
            result = JSON.parse(resultText);
        } catch {
            result = { message: resultText };
        }

        if (!response.ok) {
            return {
                success: false,
                message: result.message || `HTTP ${response.status}`,
                error: result.error || resultText,
            };
        }

        return {
            success: result.status === 'success' || result.success === true,
            id: result.id || result.data?.id,
            message: result.message,
            data: result.data,
        };
    } catch (err) {
        return {
            success: false,
            error: (err instanceof Error && err.message) || 'Unknown error',
        };
    }
}

/** Returns the stored record, or `null` if it could not be fetched. */
export async function getTensionRecord(
    id: string,
): Promise<TensionRecordPayload | null> {
    try {
        const response = await fetch(
            `${window.location.origin}/tension-records/${id}`,
            { headers: JSON_HEADERS },
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const record = result.data || result;

        return {
            ...record,
            timestamp: record.timestamp || record.created_at,
        };
    } catch (error) {
        console.error('Failed to fetch tension record:', error);
        return null;
    }
}

export async function startWeavingSession(
    formData: WeavingFormData,
): Promise<{ success: boolean; data?: WeavingSession; message?: string }> {
    try {
        const csrfToken = await fetchXsrfToken();

        const response = await fetch('/tension-records/start-session', {
            method: 'POST',
            headers: { ...JSON_HEADERS, 'X-XSRF-TOKEN': csrfToken },
            body: JSON.stringify({ form_data: formData }),
            credentials: 'include',
        });

        const result = await response.json();
        if (!response.ok) {
            return {
                success: false,
                message: result.message || `HTTP ${response.status}`,
            };
        }
        return { success: true, data: result.data };
    } catch (error) {
        console.warn('Failed to start weaving session:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/** Looks up the open session for a production order; `success: false` with no message means none exists. */
export async function getWeavingSession(
    productionOrder: string,
): Promise<{ success: boolean; data?: WeavingSession; message?: string }> {
    try {
        const response = await fetch(
            `/tension-records/session/${encodeURIComponent(productionOrder)}`,
            {
                headers: { Accept: 'application/json' },
                credentials: 'include',
            },
        );

        if (response.status === 404) {
            return { success: false };
        }
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        return { success: true, data: result.data };
    } catch (error) {
        console.warn('Failed to fetch weaving session:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

export async function updateWeavingSession(
    id: number,
    record: TensionRecordPayload,
    status: 'in_progress' | 'completed' = 'in_progress',
): Promise<SaveTensionRecordResult> {
    try {
        const csrfToken = await fetchXsrfToken();

        const response = await fetch(`/tension-records/${id}`, {
            method: 'PUT',
            headers: { ...JSON_HEADERS, 'X-XSRF-TOKEN': csrfToken },
            body: JSON.stringify({
                ...record,
                metadata: { ...record.metadata, status },
            }),
            credentials: 'include',
        });

        const result = await response.json();
        if (!response.ok) {
            return {
                success: false,
                message: result.message || `HTTP ${response.status}`,
                error: result.error,
            };
        }
        return {
            success: true,
            id: result.data?.id,
            data: result.data,
            message: result.message,
        };
    } catch (error) {
        console.warn('Failed to update weaving session:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
