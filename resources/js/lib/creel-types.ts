/** Client for the creel type settings endpoints (the torque standard, managed per creel type). */

export interface CreelType {
    id: number;
    name: string;
    torque_min: number;
    torque_max: number;
    torque_check_sheets_count?: number;
}

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

export const creelTypeApi = {
    list: () => request<{ data: CreelType[] }>('/creel-types', 'GET').then((r) => r.data),
    create: (fields: { name: string; torque_min: number; torque_max: number }) => request<{ data: CreelType }>('/creel-types', 'POST', fields),
    update: (id: number, fields: { name: string; torque_min: number; torque_max: number }) => request<{ data: CreelType }>(`/creel-types/${id}`, 'PATCH', fields),
    remove: (id: number) => request(`/creel-types/${id}`, 'DELETE'),
};

export const inRange = (t: Pick<CreelType, 'torque_min' | 'torque_max'>, v: number) => v >= t.torque_min && v <= t.torque_max;

export const formatNumber = (n: number | string | null | undefined) => (n === null || n === undefined || n === '' ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n)));
