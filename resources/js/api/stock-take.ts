/** Server calls for batch stock-taking. */

import type {
    RecordStockBatchPayload,
    RecordStockBatchResponse,
    StockTakeBatchCheckResponse,
    StockTakeSessionResponse,
} from '@/types/stock-take';

export async function getStockTakeSession(
    sessionId: string,
): Promise<StockTakeSessionResponse> {
    const response = await fetch(
        `/stock-take-records/session/${encodeURIComponent(sessionId)}`,
        {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        },
    );

    if (!response.ok) {
        throw new Error('Failed to fetch session');
    }

    return response.json();
}

export async function checkStockBatch(
    sessionId: string,
    batchNumber: string,
): Promise<StockTakeBatchCheckResponse> {
    const params = new URLSearchParams({
        record_key: sessionId,
        batch: batchNumber,
    });

    const response = await fetch(
        `/stock-take-records/check-batch?${params.toString()}`,
        {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        },
    );

    if (!response.ok) {
        throw new Error('Failed to check batch');
    }

    return response.json();
}

export async function recordStockBatch(
    payload: RecordStockBatchPayload,
): Promise<RecordStockBatchResponse> {
    const tokenRes = await fetch('/csrf-token', { credentials: 'include' });
    const { csrfToken } = await tokenRes.json();

    const response = await fetch('/stock-take-records/record-batch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error('Failed to record batch');
    }

    return response.json();
}
