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
    side: TorqueSide;
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
    side: TorqueSide;
    creel_type: { id: number; name: string } | null;
    readings: TorqueReading[];
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
}

export type ReadingFields = Pick<TorqueReading, 'row_no' | 'column_letter' | 'value' | 'note'>;

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
    side: TorqueSide;
    creelTypeId: number;
}

export interface TorqueSession {
    session_id: string | null;
    check_date: string;
    operator_name: string;
    machine_number: string;
    side: TorqueSide;
    creel_type_id: number;
    readings: TorqueReading[];
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
            side: sheet.side,
            creel_type_id: sheet.creelTypeId,
            client_uuid: clientUuid,
            ...fields,
        }),
    updateReading: (id: number | string, fields: Partial<ReadingFields>) => request(`/torque-checks/readings/${id}`, 'PATCH', fields),
    deleteReading: (id: number | string) => request(`/torque-checks/readings/${id}`, 'DELETE'),
    deleteSheet: (id: number) => request(`/torque-checks/${id}`, 'DELETE'),
    download: (id: number) => request<{ grid: Record<string, number | null>[]; problems: { ROW: number; COLUMN: string; NOTE: string }[] }>(`/torque-checks/${id}/download`, 'GET'),
    /** Looks a sheet up by its operator-facing session id, its numeric id, or (best-effort) its own client uuid
     *  — the last of these is how a sheet started offline learns the session id it was assigned once online. */
    getSession: (sessionOrId: string) => request<{ success: boolean; data: TorqueSession }>(`/torque-checks/session/${encodeURIComponent(sessionOrId)}`, 'GET').then((r) => r.data),
};

export const newUuid = () => crypto.randomUUID();
