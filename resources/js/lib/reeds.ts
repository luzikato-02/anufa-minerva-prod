/** Client and shared vocabulary for the reed inventory (/reed-inventory endpoints). */

import { fetchXsrfToken } from '@/lib/csrf';

export type ReedStatus =
    | 'in_stock'
    | 'reserved'
    | 'on_loom'
    | 'returned'
    | 'quarantine'
    | 'in_repair'
    | 'scrapped';
export type ReedGrade = 'A' | 'B' | 'C' | 'X';

export interface ReedSpec {
    id: number;
    code: string;
    dents_per_10cm: number;
    width_mm: number;
    working_width_mm: number | null;
    height_mm: number | null;
    reed_type: 'flat' | 'profile';
    wire_profile: string | null;
    wire_thickness_mm: number | null;
    wire_material: string | null;
    min_stock: number;
    notes: string | null;
    reeds_count?: number;
    active_reeds_count?: number;
}

export interface FabricStyle {
    id: number;
    code: string;
    description: string | null;
    reed_spec_id: number | null;
    ends_per_10cm?: number | null;
    is_active?: boolean;
    reed_spec?: { id: number; code: string } | null;
}

export interface ReedLocation {
    id: number;
    code: string;
    zone: string | null;
    notes?: string | null;
    reeds_count?: number;
}

export interface Reed {
    id: number;
    serial_no: string;
    reed_spec_id: number;
    status: ReedStatus;
    grade: ReedGrade;
    location_id: number | null;
    loom_number: string | null;
    fabric_style_id: number | null;
    order_no: string | null;
    mounted_at: string | null;
    reserved_at: string | null;
    supplier: string | null;
    po_no: string | null;
    received_on: string | null;
    unit_cost: number | null;
    meters_woven: number;
    days_mounted: number;
    issue_count: number;
    repair_count: number;
    last_inspected_at: string | null;
    notes: string | null;
    updated_at: string;
    spec?: Partial<ReedSpec> & { id: number; code: string };
    location?: { id: number; code: string; zone?: string | null } | null;
    fabric_style?: {
        id: number;
        code: string;
        description?: string | null;
    } | null;
}

export interface ReedMovement {
    id: number;
    type: string;
    from_status: ReedStatus | null;
    to_status: ReedStatus;
    loom_number: string | null;
    order_no: string | null;
    meters: number | null;
    note: string | null;
    occurred_at: string;
    user?: { id: number; name: string } | null;
    reed?: { id: number; serial_no: string };
    from_location?: { id: number; code: string } | null;
    to_location?: { id: number; code: string } | null;
    fabric_style?: { id: number; code: string } | null;
}

export interface ReedInspection {
    id: number;
    grade: ReedGrade;
    checklist: Record<string, boolean>;
    defect_dents: string | null;
    note: string | null;
    inspected_at: string;
    user?: { id: number; name: string } | null;
}

export interface ReedRepair {
    id: number;
    vendor: string;
    defects: string | null;
    sent_on: string;
    returned_on: string | null;
    cost: number | null;
    work_done: string | null;
}

export interface ReedDetail {
    reed: Reed;
    movements: ReedMovement[];
    inspections: ReedInspection[];
    repairs: ReedRepair[];
}

export interface SpecStock {
    id: number;
    code: string;
    min_stock: number;
    usable_in_stock: number;
    on_loom: number;
}

export interface ReedStats {
    by_status: Record<ReedStatus, number>;
    specs: SpecStock[];
    short_specs: SpecStock[];
}

export interface ReedOptions {
    specs: Pick<
        ReedSpec,
        'id' | 'code' | 'dents_per_10cm' | 'width_mm' | 'reed_type'
    >[];
    styles: FabricStyle[];
    locations: ReedLocation[];
}

export interface MatchResult {
    style: FabricStyle;
    spec: ReedSpec;
    candidates: Reed[];
    reserved: Pick<Reed, 'id' | 'serial_no' | 'loom_number' | 'reserved_at'>[];
    mounted_on_loom: Pick<Reed, 'id' | 'serial_no'> | null;
}

export interface Paged<T> {
    data: T[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
}

export const STATUS_META: Record<
    ReedStatus,
    { label: string; tone: string; dot: string }
> = {
    in_stock: {
        label: 'In stock',
        tone: 'text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
    },
    reserved: {
        label: 'Reserved',
        tone: 'text-sky-700 dark:text-sky-400',
        dot: 'bg-sky-500',
    },
    on_loom: {
        label: 'On loom',
        tone: 'text-foreground',
        dot: 'bg-neutral-500',
    },
    returned: {
        label: 'Returned',
        tone: 'text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
    },
    quarantine: {
        label: 'Quarantine',
        tone: 'text-red-700 dark:text-red-400',
        dot: 'bg-red-500',
    },
    in_repair: {
        label: 'In repair',
        tone: 'text-orange-700 dark:text-orange-400',
        dot: 'bg-orange-500',
    },
    scrapped: {
        label: 'Scrapped',
        tone: 'text-muted-foreground',
        dot: 'bg-neutral-300 dark:bg-neutral-600',
    },
};

export const STATUS_ORDER: ReedStatus[] = [
    'in_stock',
    'reserved',
    'on_loom',
    'returned',
    'quarantine',
    'in_repair',
    'scrapped',
];

export const GRADE_META: Record<ReedGrade, string> = {
    A: 'Good',
    B: 'Usable, watch',
    C: 'Needs repair',
    X: 'Unusable',
};

export const CHECKS: { key: string; label: string }[] = [
    { key: 'bent_dents', label: 'Bent dents' },
    { key: 'open_dents', label: 'Open / uneven dents' },
    { key: 'worn_wires', label: 'Worn or rough wires' },
    { key: 'rust', label: 'Rust' },
    { key: 'binding_damage', label: 'Binding damage' },
    { key: 'not_straight', label: 'Not straight' },
];

export const MOVEMENT_LABEL: Record<string, string> = {
    receive: 'Received',
    reserve: 'Reserved',
    release: 'Reservation released',
    issue: 'Mounted on loom',
    return: 'Returned from loom',
    inspect: 'Inspected',
    transfer: 'Moved',
    repair_out: 'Sent to repair',
    repair_in: 'Back from repair',
    scrap: 'Scrapped',
};

/** Which moves a reed allows in its current status (mirrors ReedLifecycle on the server). */
export type ReedAction =
    | 'reserve'
    | 'release'
    | 'issue'
    | 'return'
    | 'inspect'
    | 'transfer'
    | 'repair-out'
    | 'repair-in'
    | 'scrap';

export function allowedActions(
    reed: Pick<Reed, 'status' | 'grade'>,
): ReedAction[] {
    const usable = reed.grade === 'A' || reed.grade === 'B';
    switch (reed.status) {
        case 'in_stock':
            return [
                ...(usable ? (['issue', 'reserve'] as ReedAction[]) : []),
                'inspect',
                'transfer',
                'repair-out',
                'scrap',
            ];
        case 'reserved':
            return ['issue', 'release', 'transfer', 'scrap'];
        case 'on_loom':
            return ['return'];
        case 'returned':
            return ['inspect', 'transfer', 'repair-out', 'scrap'];
        case 'quarantine':
            return ['inspect', 'repair-out', 'transfer', 'scrap'];
        case 'in_repair':
            return ['repair-in', 'scrap'];
        default:
            return [];
    }
}

/** Moves that need reeds.manage rather than reeds.operate. */
export const MANAGE_ACTIONS: ReedAction[] = [
    'repair-out',
    'repair-in',
    'scrap',
];

async function request<T>(
    url: string,
    method = 'GET',
    body?: unknown,
): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') {
        headers['X-XSRF-TOKEN'] = await fetchXsrfToken();
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
    });
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

const qs = (
    params: Record<string, string | number | boolean | undefined | null>,
) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    const s = q.toString();
    return s ? `?${s}` : '';
};

const newUuid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
          });

export interface ReedListParams {
    search?: string;
    status?: string;
    spec_id?: number | '';
    grade?: string;
    location_id?: number | '';
    include_scrapped?: boolean;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
}

export const reedApi = {
    list: (p: ReedListParams) =>
        request<Paged<Reed>>(
            `/reed-inventory/reeds${qs({ ...p, include_scrapped: p.include_scrapped ? 1 : undefined })}`,
        ),
    show: (id: number) =>
        request<{ data: ReedDetail }>(`/reed-inventory/reeds/${id}`).then(
            (r) => r.data,
        ),
    byCode: (code: string) =>
        request<{ data: { id: number; serial_no: string } }>(
            `/reed-inventory/by-code/${encodeURIComponent(code)}`,
        ).then((r) => r.data),
    stats: () =>
        request<{ data: ReedStats }>('/reed-inventory/stats').then(
            (r) => r.data,
        ),
    options: () =>
        request<{ data: ReedOptions }>('/reed-inventory/options').then(
            (r) => r.data,
        ),
    movements: () =>
        request<{ data: ReedMovement[] }>('/reed-inventory/movements').then(
            (r) => r.data,
        ),
    match: (fabricStyleId: number, loomNumber?: string) =>
        request<{ data: MatchResult }>(
            `/reed-inventory/match${qs({ fabric_style_id: fabricStyleId, loom_number: loomNumber })}`,
        ).then((r) => r.data),
    receive: (fields: Record<string, unknown>) =>
        request<{ data: Reed[] }>(
            '/reed-inventory/receipts',
            'POST',
            fields,
        ).then((r) => r.data),
    /** Every move carries a fresh client_uuid so a retried request is not logged twice. */
    act: (
        id: number,
        action: ReedAction,
        fields: Record<string, unknown> = {},
    ) =>
        request<{ data: Reed }>(
            `/reed-inventory/reeds/${id}/${action}`,
            'POST',
            { ...fields, client_uuid: newUuid() },
        ).then((r) => r.data),

    specs: () =>
        request<{ data: ReedSpec[] }>('/reed-inventory/specs').then(
            (r) => r.data,
        ),
    styles: () =>
        request<{ data: FabricStyle[] }>('/reed-inventory/styles').then(
            (r) => r.data,
        ),
    locations: () =>
        request<{ data: ReedLocation[] }>('/reed-inventory/locations').then(
            (r) => r.data,
        ),
    save: (
        kind: 'specs' | 'styles' | 'locations',
        id: number | null,
        fields: Record<string, unknown>,
    ) =>
        request(
            id ? `/reed-inventory/${kind}/${id}` : `/reed-inventory/${kind}`,
            id ? 'PATCH' : 'POST',
            fields,
        ),
    remove: (kind: 'specs' | 'styles' | 'locations', id: number) =>
        request(`/reed-inventory/${kind}/${id}`, 'DELETE'),
};

export const fmt = (n: number | string | null | undefined, digits = 0) =>
    n === null || n === undefined || n === ''
        ? '—'
        : new Intl.NumberFormat('en-US', {
              maximumFractionDigits: digits,
          }).format(Number(n));

export const fmtDate = (iso: string | null | undefined, withTime = false) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(
        'en-GB',
        withTime
            ? {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
              }
            : { day: '2-digit', month: 'short', year: 'numeric' },
    );
};

export const specLabel = (s: {
    code: string;
    dents_per_10cm?: number;
    width_mm?: number;
}) =>
    s.dents_per_10cm
        ? `${s.code} · ${fmt(s.dents_per_10cm, 1)} dents/10 cm · ${fmt(s.width_mm)} mm`
        : s.code;
