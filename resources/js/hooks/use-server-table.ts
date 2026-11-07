import {
    type PaginationState,
    type SortingState,
    type VisibilityState,
} from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface LaravelPage<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

interface StoredPrefs {
    pageSize?: number;
    columnVisibility?: VisibilityState;
}

const prefsKey = (key: string) => `table-prefs:${key}`;

const readPrefs = (key: string): StoredPrefs => {
    try {
        const raw = window.localStorage.getItem(prefsKey(key));
        return raw ? (JSON.parse(raw) as StoredPrefs) : {};
    } catch {
        return {};
    }
};

const writePrefs = (key: string, prefs: StoredPrefs) => {
    try {
        window.localStorage.setItem(prefsKey(key), JSON.stringify(prefs));
    } catch {
        // Unavailable storage just means preferences aren't remembered.
    }
};

export interface UseServerTableOptions {
    /** Laravel paginated endpoint, e.g. `/tension-records`. */
    endpoint: string;
    /** Fixed query params sent with every request, e.g. `{ type: 'twisting' }`. */
    params?: Record<string, string>;
    /** Unique key for remembering page size and visible columns. */
    storageKey: string;
    defaultPageSize?: (typeof PAGE_SIZE_OPTIONS)[number];
    defaultColumnVisibility?: VisibilityState;
    /** Delay before a search keystroke triggers a request. */
    searchDebounceMs?: number;
}

/**
 * State and fetching for a server-paginated TanStack table backed by a
 * Laravel `paginate()` endpoint. Sends `page`, `per_page`, `search`,
 * `sort_by` and `sort_dir`; the endpoint decides which sort ids it accepts.
 */
export function useServerTable<T>({
    endpoint,
    params,
    storageKey,
    defaultPageSize = 50,
    defaultColumnVisibility = {},
    searchDebounceMs = 300,
}: UseServerTableOptions) {
    const [prefs] = useState(() => readPrefs(storageKey));

    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: PAGE_SIZE_OPTIONS.includes(
            prefs.pageSize as (typeof PAGE_SIZE_OPTIONS)[number],
        )
            ? (prefs.pageSize as number)
            : defaultPageSize,
    });
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        () => ({ ...defaultColumnVisibility, ...prefs.columnVisibility }),
    );
    const [rowSelection, setRowSelection] = useState({});
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [data, setData] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Debounce the search box, and go back to page 1 when the query changes.
    useEffect(() => {
        const id = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPagination((p) =>
                p.pageIndex === 0 ? p : { ...p, pageIndex: 0 },
            );
        }, searchDebounceMs);
        return () => window.clearTimeout(id);
    }, [search, searchDebounceMs]);

    // A new sort order starts from page 1 too.
    const onSortingChange = useCallback(
        (updater: SortingState | ((old: SortingState) => SortingState)) => {
            setSorting(updater);
            setPagination((p) =>
                p.pageIndex === 0 ? p : { ...p, pageIndex: 0 },
            );
        },
        [],
    );

    useEffect(() => {
        writePrefs(storageKey, {
            pageSize: pagination.pageSize,
            columnVisibility,
        });
    }, [storageKey, pagination.pageSize, columnVisibility]);

    const paramsKey = JSON.stringify(params ?? {});

    useEffect(() => {
        const controller = new AbortController();
        const query = new URLSearchParams({
            ...(JSON.parse(paramsKey) as Record<string, string>),
            page: String(pagination.pageIndex + 1),
            per_page: String(pagination.pageSize),
        });
        if (debouncedSearch) {
            query.set('search', debouncedSearch);
        }
        if (sorting[0]) {
            query.set('sort_by', sorting[0].id);
            query.set('sort_dir', sorting[0].desc ? 'desc' : 'asc');
        }

        setLoading(true);
        setError(null);

        fetch(`${endpoint}?${query.toString()}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Server responded ${response.status}`);
                }
                return (await response.json()) as LaravelPage<T>;
            })
            .then((page) => {
                setData(page.data);
                setTotal(page.total);
                setPageCount(page.last_page);
                setRowSelection({});
                setLoading(false);
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Could not load records',
                );
                setLoading(false);
            });

        return () => controller.abort();
    }, [
        endpoint,
        paramsKey,
        pagination.pageIndex,
        pagination.pageSize,
        debouncedSearch,
        sorting,
        refreshKey,
    ]);

    const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

    return useMemo(
        () => ({
            data,
            total,
            pageCount,
            loading,
            error,
            refetch,
            search,
            setSearch,
            state: { pagination, sorting, columnVisibility, rowSelection },
            handlers: {
                onPaginationChange: setPagination,
                onSortingChange,
                onColumnVisibilityChange: setColumnVisibility,
                onRowSelectionChange: setRowSelection,
            },
        }),
        [
            data,
            total,
            pageCount,
            loading,
            error,
            refetch,
            search,
            pagination,
            sorting,
            columnVisibility,
            rowSelection,
            onSortingChange,
        ],
    );
}
