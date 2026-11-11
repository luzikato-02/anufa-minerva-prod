import { type DetailRecord } from '@/components/record-detail-panel';

/** How the compare chart plots each position. */
export type CompareMetric = 'max' | 'min' | 'avg' | 'spread';

export interface SavedComparison {
    id: number;
    name: string;
    record_type: 'twisting' | 'weaving';
    /** In legend order; the order sets each record's colour. */
    record_ids: number[];
    metric: CompareMetric;
    hidden_ids: number[];
    created_at: string | null;
    updated_at: string | null;
}

export interface SavedComparisonListItem extends SavedComparison {
    /** How many of the saved records still exist. */
    available: number;
}

export interface SavedComparisonWithRecords extends SavedComparison {
    records: DetailRecord[];
    /** Records deleted since the comparison was saved. */
    missing_ids: number[];
}

async function csrfToken(): Promise<string> {
    const { csrfToken } = await (
        await fetch('/csrf-token', { credentials: 'include' })
    ).json();
    return csrfToken;
}

async function request<T>(
    url: string,
    method: string,
    body?: unknown,
): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') {
        headers['X-CSRF-TOKEN'] = await csrfToken();
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const first = json.errors
            ? (Object.values(json.errors)[0] as string[])[0]
            : undefined;
        throw new Error(
            first ?? json.message ?? 'The request failed. Try again.',
        );
    }
    return json as T;
}

export const comparisonsApi = {
    list: (type: 'twisting' | 'weaving') =>
        request<{ data: SavedComparisonListItem[] }>(
            `/tension-comparisons?type=${type}`,
            'GET',
        ).then((r) => r.data),

    get: (id: number) =>
        request<{ data: SavedComparisonWithRecords }>(
            `/tension-comparisons/${id}`,
            'GET',
        ).then((r) => r.data),

    create: (body: {
        name: string;
        record_type: 'twisting' | 'weaving';
        record_ids: number[];
        metric: CompareMetric;
        hidden_ids: number[];
    }) =>
        request<{ data: SavedComparison }>(
            '/tension-comparisons',
            'POST',
            body,
        ).then((r) => r.data),

    update: (
        id: number,
        body: Partial<
            Pick<
                SavedComparison,
                'name' | 'record_ids' | 'metric' | 'hidden_ids'
            >
        >,
    ) =>
        request<{ data: SavedComparison }>(
            `/tension-comparisons/${id}`,
            'PATCH',
            body,
        ).then((r) => r.data),

    remove: (id: number) =>
        request<void>(`/tension-comparisons/${id}`, 'DELETE'),
};
