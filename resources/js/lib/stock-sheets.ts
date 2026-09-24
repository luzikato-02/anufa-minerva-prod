/** Client for the stock sheet endpoints (the paper stock list). */

export interface SheetRow {
    id?: number;
    /** Generated in the browser; the row's handle on the server. */
    client_uuid: string;
    line_no?: number;
    color: string | null;
    material_code: string;
    batch: string;
    prod_date: string | null;
    chs: number | null;
    actual_weight: number | null;
    position: number | null;
    remark: string | null;
}

export interface StockSheetSummary {
    id: number;
    session_id: string | null;
    sheet_date: string;
    leader: string;
    rows_count: number;
    total_chs: number | null;
    total_weight: string | number | null;
}

export interface StockSheetDetail {
    id: number;
    session_id: string | null;
    sheet_date: string;
    leader: string;
    rows: SheetRow[];
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
}

export type RowFields = Omit<SheetRow, 'id' | 'client_uuid' | 'line_no'>;

async function request<T>(url: string, method: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') {
        const { csrfToken } = await (await fetch('/csrf-token', { credentials: 'include' })).json();
        headers['X-CSRF-TOKEN'] = csrfToken;
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, { method, headers, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const first = json.errors ? (Object.values(json.errors)[0] as string[])[0] : undefined;
        throw new Error(first ?? json.message ?? 'The request failed. Try again.');
    }
    return json as T;
}

export interface StockSheetSession {
    session_id: string | null;
    sheet_date: string;
    leader: string;
    rows: SheetRow[];
}

export const stockSheetApi = {
    list: (params: URLSearchParams) => request<Paginated<StockSheetSummary>>(`/stock-sheets?${params}`, 'GET'),
    show: (id: number) => request<{ data: StockSheetDetail }>(`/stock-sheets/${id}`, 'GET').then((r) => r.data),
    addRow: (sheet: { uuid: string; sessionId: string | null; date: string; leader: string }, row: SheetRow) =>
        request(`/stock-sheets/rows`, 'POST', { session_id: sheet.sessionId, sheet_client_uuid: sheet.uuid, sheet_date: sheet.date, leader: sheet.leader, ...row }),
    updateRow: (uuid: string, fields: RowFields) => request(`/stock-sheets/rows/${uuid}`, 'PATCH', fields),
    deleteRow: (uuid: string) => request(`/stock-sheets/rows/${uuid}`, 'DELETE'),
    deleteSheet: (id: number) => request(`/stock-sheets/${id}`, 'DELETE'),
    download: (id: number) => request<{ summary: Record<string, string | number | null>[] }>(`/stock-sheets/${id}/download`, 'GET'),
    /** Looks a sheet up by its operator-facing session id, its numeric id, or (best-effort) its own client uuid
     *  — the last of these is how a sheet started offline learns the session id it was assigned once online. */
    getSession: (sessionOrId: string) => request<{ success: boolean; data: StockSheetSession }>(`/stock-sheets/session/${encodeURIComponent(sessionOrId)}`, 'GET').then((r) => r.data),
};

const csvCell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function rowsToCsv(rows: Record<string, string | number | null>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    return [headers.join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\n');
}

export function saveCsv(filename: string, csv: string) {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export const newUuid = () => crypto.randomUUID();

/** The device's own working copy of a sheet — the session-select page starts one, the record page fills it in. */
export const STOCK_SHEET_ACTIVE_KEY = 'stock-sheet-active';

export interface StockSheetActiveSheet {
    uuid: string;
    sessionId: string | null;
    date: string;
    leader: string;
    rows: SheetRow[];
}

export const stockSheetToday = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd in local time

export function freshStockSheet(leader: string): StockSheetActiveSheet {
    return { uuid: newUuid(), sessionId: null, date: stockSheetToday(), leader, rows: [] };
}

export function loadActiveStockSheet(): StockSheetActiveSheet | null {
    try {
        const raw = localStorage.getItem(STOCK_SHEET_ACTIVE_KEY);
        if (raw) return JSON.parse(raw) as StockSheetActiveSheet;
    } catch {
        // fall through to null
    }
    return null;
}

export function saveActiveStockSheet(sheet: StockSheetActiveSheet) {
    try {
        localStorage.setItem(STOCK_SHEET_ACTIVE_KEY, JSON.stringify(sheet));
    } catch {
        // storage full or blocked: rows are still saved on the server
    }
}

/** Parses a number field; '' → null, anything else invalid → undefined. */
export function parseNumber(text: string, opts: { integer?: boolean; max?: number } = {}): number | null | undefined {
    const t = text.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return undefined;
    if (opts.integer && !Number.isInteger(n)) return undefined;
    if (opts.max !== undefined && n > opts.max) return undefined;
    return n;
}

export const formatNumber = (n: number | string | null | undefined) =>
    n === null || n === undefined || n === '' ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n));
