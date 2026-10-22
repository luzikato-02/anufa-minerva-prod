/** Client and shared types for the control plan module (W-WSD work station documents). */

import { loadFromLocalStorage } from '@/lib/localStorage';

export type RevisionStatus =
    | 'draft'
    | 'in_review'
    | 'changes_requested'
    | 'approved'
    | 'released'
    | 'superseded';

export type Phase = 'prototype' | 'pre_launch' | 'production';

export interface Step {
    id: string;
    no: string;
    group: string;
    name: string;
    machine: string;
}

export interface Line {
    id: string;
    step_id: string;
    product: string;
    process: string;
    sc: string;
    spec: string;
    measurement: string;
    size: string;
    frequency: string;
    control: string;
    pic: string;
    reaction: string;
    reaction_ref: string;
}

/** One person in the signature block under the plan. */
export interface Signer {
    id: string;
    /** The account that signs this box in the app; null when it is signed by hand on paper. */
    user_id: number | null;
    name: string;
    position: string;
}

export type SignatureGroup = 'prepared' | 'approved';

export const SIGNATURE_GROUPS: { key: SignatureGroup; label: string }[] = [
    { key: 'prepared', label: 'Dibuat oleh' },
    { key: 'approved', label: 'Disetujui oleh' },
];

/** Signers per group; the server accepts at most this many. */
export const MAX_SIGNERS = 8;

export interface Content {
    steps: Step[];
    lines: Line[];
    /** Notes printed under the table, one per line ("* …", "** …"). */
    notes: string;
    signatures: Record<SignatureGroup, Signer[]>;
}

export interface DocHeader {
    mill: string;
    sp_ref: string;
    sp_date: string;
    issued: string;
}

export interface PlanInfo {
    phase: Phase;
    title: string;
    key_contact: string;
    core_team: string;
    part_number: string;
    part_name: string;
    org_plant: string;
    org_code: string;
    cust_eng_name: string;
    cust_eng_date: string;
    cust_qual_name: string;
    cust_qual_date: string;
    other1_name: string;
    other1_date: string;
    other2_name: string;
    other2_date: string;
}

export interface HistoryEntry {
    pages: string;
    description: string;
}

export interface Revision {
    id: number;
    rev_no: number;
    /** Two-digit revision number as printed: "09", "12". */
    rev: string;
    status: RevisionStatus;
    editable: boolean;
    header: DocHeader;
    info: PlanInfo;
    content: Content;
    /** Signatures by signer box id. */
    signed: Record<string, Signature>;
    history: HistoryEntry[];
    author: string | null;
    author_id: number | null;
    submitted_by: number | null;
    submitter: string | null;
    /** Printed in the configured date format, e.g. "15 Oktober 2026". */
    release_date: string | null;
    next_review: string | null;
    updated_at: string | null;
}

export interface Signature {
    /** PNG data: URI. */
    image: string;
    by: string;
    /** Who signed on behalf of the box's owner, or null when the owner signed. */
    proxy: string | null;
    /** Printed in the configured date format. */
    at: string;
}

/** An account a signature box can be given to. */
export interface Person {
    id: number;
    name: string;
}

export interface PlanRef {
    id: number;
    doc_no: string;
}

export const LINE_FIELDS = [
    'product',
    'process',
    'sc',
    'spec',
    'measurement',
    'size',
    'frequency',
    'control',
    'pic',
    'reaction',
    'reaction_ref',
] as const;
export const STEP_FIELDS = ['no', 'group', 'name', 'machine'] as const;

export type LineField = (typeof LINE_FIELDS)[number];
export type StepField = (typeof STEP_FIELDS)[number];

export const LINE_LABELS: Record<LineField, string> = {
    product: 'Product',
    process: 'Process',
    sc: 'Class',
    spec: 'Specification',
    measurement: 'Measurement',
    size: 'Size',
    frequency: 'Freq',
    control: 'Control method',
    pic: 'PIC',
    reaction: 'Reaction plan',
    reaction_ref: 'Reaction plan reference',
};

export const PHASES: { value: Phase; label: string }[] = [
    { value: 'prototype', label: 'Prototype' },
    { value: 'pre_launch', label: 'Pre-launch' },
    { value: 'production', label: 'Production' },
];

/** A whole value that is one document code (QA-IK-14, T-WSD-W-3…). Matches the server's ReferenceCodes::EXACT. */
export const REF_CODE = /^[A-Z]+(?:-[A-Z0-9]+)+$/;

/** Codes inside longer text. Matches the server's ReferenceCodes::PATTERN. */
export const REF_CODE_IN_TEXT =
    /(?<![A-Za-z0-9-])[A-Z]+(?:-[A-Z0-9]+)+(?![A-Za-z0-9-])/g;

export const blank = (v: string | null | undefined) => (v ?? '').trim() === '';

/** A special characteristic class is anything but blank or "-". */
export const hasClass = (v: string) => !blank(v) && v.trim() !== '-';

/** Lines in print order (steps in order, each step's lines in order), each with its step. */
export function orderedLines(content: Content): { step: Step; line: Line }[] {
    const out: { step: Step; line: Line }[] = [];
    for (const step of content.steps) {
        for (const line of content.lines) {
            if (line.step_id === step.id) out.push({ step, line });
        }
    }
    return out;
}

export function newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function emptyLine(stepId: string): Line {
    return {
        id: newId(),
        step_id: stepId,
        product: '',
        process: '-',
        sc: '-',
        spec: '',
        measurement: '',
        size: '',
        frequency: '',
        control: '',
        pic: '',
        reaction: '',
        reaction_ref: '',
    };
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

export interface ReferenceFields {
    code: string;
    title: string;
    type: string;
    revision: string;
    link: string;
}

export interface Settings {
    mill: string | null;
    org_plant: string | null;
    org_code: string | null;
    date_format: 'id' | 'en';
    review_period_years: number;
}

export const controlPlanApi = {
    create: (fields: { doc_no: string; title: string; rev_no: number }) =>
        request<{ data: { plan_id: number; revision_id: number } }>(
            '/control-plans',
            'POST',
            fields,
        ).then((r) => r.data),
    startRevision: (planId: number) =>
        request<{ data: { revision_id: number } }>(
            `/control-plans/${planId}/revisions`,
            'POST',
        ).then((r) => r.data),
    save: (
        revisionId: number,
        doc: {
            doc_no: string;
            header: DocHeader;
            info: PlanInfo;
            content: Content;
        },
    ) =>
        request<{ data: Revision }>(
            `/control-plan-revisions/${revisionId}`,
            'PUT',
            doc,
        ).then((r) => r.data),
    discard: (revisionId: number) =>
        request(`/control-plan-revisions/${revisionId}`, 'DELETE'),
    submit: (revisionId: number, history: HistoryEntry[]) =>
        request(`/control-plan-revisions/${revisionId}/submit`, 'POST', {
            history,
        }),
    withdraw: (revisionId: number) =>
        request(`/control-plan-revisions/${revisionId}/withdraw`, 'POST'),
    requestChanges: (revisionId: number, body: string) =>
        request(
            `/control-plan-revisions/${revisionId}/request-changes`,
            'POST',
            { body },
        ),
    approve: (revisionId: number) =>
        request(`/control-plan-revisions/${revisionId}/approve`, 'POST'),
    release: (revisionId: number) =>
        request(`/control-plan-revisions/${revisionId}/release`, 'POST'),
    comment: (revisionId: number, body: string) =>
        request(`/control-plan-revisions/${revisionId}/comments`, 'POST', {
            body,
        }),
    createReference: (fields: ReferenceFields) =>
        request<{ data: { id: number } }>(
            '/control-plan-references',
            'POST',
            fields,
        ).then((r) => r.data),
    updateReference: (id: number, fields: ReferenceFields) =>
        request(`/control-plan-references/${id}`, 'PATCH', fields),
    sign: (revisionId: number, signerId: string, image: string) =>
        request(
            `/control-plan-revisions/${revisionId}/signatures/${encodeURIComponent(signerId)}`,
            'POST',
            { image },
        ),
    unsign: (revisionId: number, signerId: string) =>
        request(
            `/control-plan-revisions/${revisionId}/signatures/${encodeURIComponent(signerId)}`,
            'DELETE',
        ),
    saveSettings: (fields: Settings) =>
        request('/control-plan-settings', 'PUT', fields),
    uploadLogo: async (file: File) => {
        const body = new FormData();
        body.append('logo', file);
        const res = await fetch('/control-plan-settings/logo', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-CSRF-TOKEN': await csrfToken(),
            },
            credentials: 'include',
            body,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
            throw new Error(
                json.errors?.logo?.[0] ??
                    json.message ??
                    'The logo could not be uploaded. Try again.',
            );
        return json.data.logo as string;
    },
    deleteLogo: () => request('/control-plan-settings/logo', 'DELETE'),
};

/**
 * Which company logo a plan prints, chosen per plan in this browser: the shared one from Settings, none, or an
 * image kept only here (a PNG data: URI) that is sent with each preview and export and never saved on the server.
 */
export interface LogoChoice {
    source: 'shared' | 'local' | 'none';
    image?: string;
}

const logoKey = (planId: number) => `control-plan-logo:${planId}`;

export function loadLogoChoice(planId: number): LogoChoice {
    const c = loadFromLocalStorage<LogoChoice | null>(logoKey(planId), null);
    return c && ['shared', 'local', 'none'].includes(c.source)
        ? c
        : { source: 'shared' };
}

/** Throws when the browser will not keep it (storage full or blocked). */
export function saveLogoChoice(planId: number, choice: LogoChoice): void {
    try {
        localStorage.setItem(logoKey(planId), JSON.stringify(choice));
    } catch {
        throw new Error(
            'This browser would not keep the logo. Free some site storage or use a smaller image.',
        );
    }
}

/** The logo that prints for this choice, or null; "This browser's logo" without an image prints none. */
export const logoOf = (c: LogoChoice, shared: string | null) =>
    c.source === 'shared'
        ? shared
        : c.source === 'local'
          ? (c.image ?? null)
          : null;

/** A picked logo file as a PNG data: URI, scaled down to at most 1200 × 400 so it fits in browser storage. */
export async function logoImage(file: File): Promise<string> {
    if (!['image/png', 'image/jpeg'].includes(file.type))
        throw new Error('Choose a PNG or JPG image.');
    if (file.size > 2 * 1024 * 1024)
        throw new Error('The logo must be at most 2 MB.');
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () =>
                reject(new Error('That image could not be read.'));
            i.src = url;
        });
        const scale = Math.min(1, 1200 / img.width, 400 / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas
            .getContext('2d')!
            .drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Fetches the printed document (path "print" or "download/pdf|docx") with the plan's logo: by GET for the shared
 * logo or none, by POST carrying the image for one kept in this browser. Throws with the server's message.
 */
export async function fetchSheet(
    revisionId: number,
    path: string,
    choice: LogoChoice,
    query: Record<string, string> = {},
): Promise<Response> {
    const local = choice.source === 'local' && !!choice.image;
    const params = new URLSearchParams({
        ...query,
        ...(local
            ? {}
            : { logo: choice.source === 'local' ? 'none' : choice.source }),
    });
    const res = await fetch(
        `/control-plan-revisions/${revisionId}/${path}?${params}`,
        {
            method: local ? 'POST' : 'GET',
            credentials: 'include',
            headers: local
                ? {
                      Accept: 'application/json',
                      'Content-Type': 'application/json',
                      'X-CSRF-TOKEN': await csrfToken(),
                  }
                : { Accept: 'application/json' },
            body: local ? JSON.stringify({ logo: choice.image }) : undefined,
        },
    );
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
            json.errors?.logo?.[0] ??
                json.message ??
                `The document could not be loaded (${res.status}). Try again.`,
        );
    }
    return res;
}
