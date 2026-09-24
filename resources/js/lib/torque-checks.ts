/** Client for the torque check endpoints ("FORM CEK TORQUE ADAPTOR CREEL"). */

export const TORQUE_SIDES = ['Ai', 'Ao', 'Bi', 'Bo'] as const;
export const TORQUE_COLUMNS = ['A', 'B', 'C', 'D', 'E'] as const;
export const TORQUE_MAX_ROW = 105;

export type TorqueSide = (typeof TORQUE_SIDES)[number];
export type TorqueColumn = (typeof TORQUE_COLUMNS)[number];

export interface TorqueReading {
    id?: number;
    /** Generated in the browser; the reading's handle on the server. */
    client_uuid: string;
    side: TorqueSide;
    row_no: number;
    column_letter: TorqueColumn;
    value: number;
    note: string | null;
}

export interface TorqueCheckSummary {
    id: number;
    session_id: string | null;
    check_date: string;
    operator_name: string;
    machine_number: string;
    /** Sides that have at least one reading, in Ai/Ao/Bi/Bo order. */
    sides_recorded: TorqueSide[];
    readings_count: number;
    out_of_range_count: number;
    creel_type: { id: number; name: string } | null;
}

export interface TorqueCheckDetail {
    id: number;
    session_id: string | null;
    check_date: string;
    operator_name: string;
    machine_number: string;
    creel_type: { id: number; name: string } | null;
    readings: TorqueReading[];
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
}

export type ReadingFields = Pick<TorqueReading, 'side' | 'row_no' | 'column_letter' | 'value' | 'note'>;

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

export interface SheetHeader {
    uuid: string;
    sessionId: string | null;
    checkDate: string;
    operatorName: string;
    machineNumber: string;
    creelTypeId: number;
}

export interface TorqueSession {
    session_id: string | null;
    check_date: string;
    operator_name: string;
    machine_number: string;
    creel_type_id: number;
    readings: TorqueReading[];
}

export interface CsvSection {
    side: TorqueSide;
    grid: Record<string, number | null>[];
    problems: { ROW: number; COLUMN: string; NOTE: string }[];
}

export const torqueCheckApi = {
    list: (params: URLSearchParams) => request<Paginated<TorqueCheckSummary>>(`/torque-checks?${params}`, 'GET'),
    show: (id: number) => request<{ data: TorqueCheckDetail }>(`/torque-checks/${id}`, 'GET').then((r) => r.data),
    submitReading: (sheet: SheetHeader, fields: ReadingFields, clientUuid: string) =>
        request(`/torque-checks/readings`, 'POST', {
            session_id: sheet.sessionId,
            sheet_client_uuid: sheet.uuid,
            check_date: sheet.checkDate,
            operator_name: sheet.operatorName,
            machine_number: sheet.machineNumber,
            creel_type_id: sheet.creelTypeId,
            client_uuid: clientUuid,
            ...fields,
        }),
    updateReading: (id: number | string, fields: Partial<Omit<ReadingFields, 'side' | 'row_no' | 'column_letter'>>) => request(`/torque-checks/readings/${id}`, 'PATCH', fields),
    deleteReading: (id: number | string) => request(`/torque-checks/readings/${id}`, 'DELETE'),
    deleteSheet: (id: number) => request(`/torque-checks/${id}`, 'DELETE'),
    download: (id: number) => request<{ sections: CsvSection[] }>(`/torque-checks/${id}/download`, 'GET'),
    /** Looks a sheet up by its operator-facing session id, its numeric id, or (best-effort) its own client uuid
     *  — the last of these is how a sheet started offline learns the session id it was assigned once online. */
    getSession: (sessionOrId: string) => request<{ success: boolean; data: TorqueSession }>(`/torque-checks/session/${encodeURIComponent(sessionOrId)}`, 'GET').then((r) => r.data),
};

export const newUuid = () => crypto.randomUUID();

/** The device's own working copy of a sheet — the session-select page starts one, the record page fills it in. */
export const TORQUE_ACTIVE_SHEET_KEY = 'torque-check-active';

export interface TorqueActiveReading {
    clientUuid: string;
    value: number;
    note: string;
}

export interface TorqueActiveSheet {
    uuid: string;
    sessionId: string | null;
    checkDate: string;
    operatorName: string;
    machineNumber: string;
    creelTypeId: number | null;
    /** Keyed by "side-rowcol"; one sheet holds a separate 105x5 grid per side. */
    readings: Record<string, TorqueActiveReading>;
}

export const torqueToday = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd in local time
export const torquePosition = (side: TorqueSide, row: number, col: TorqueColumn) => `${side}-${row}${col}`;

export function freshTorqueSheet(operatorName: string): TorqueActiveSheet {
    return { uuid: newUuid(), sessionId: null, checkDate: torqueToday(), operatorName, machineNumber: '', creelTypeId: null, readings: {} };
}

export function loadActiveTorqueSheet(): TorqueActiveSheet | null {
    try {
        const raw = localStorage.getItem(TORQUE_ACTIVE_SHEET_KEY);
        if (raw) return JSON.parse(raw) as TorqueActiveSheet;
    } catch {
        // fall through to null
    }
    return null;
}

export function saveActiveTorqueSheet(sheet: TorqueActiveSheet) {
    try {
        localStorage.setItem(TORQUE_ACTIVE_SHEET_KEY, JSON.stringify(sheet));
    } catch {
        // storage full or blocked: readings are still saved on the server
    }
}

/** A blank placeholder sheet (freshly created, nothing recorded and no session yet) isn't a session in
 *  progress — it's fine to send the operator back through session-select without losing anything. */
export const torqueSheetIsStarted = (sheet: TorqueActiveSheet) => sheet.sessionId !== null || Object.keys(sheet.readings).length > 0;
