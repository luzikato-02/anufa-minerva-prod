/**
 * Keeps writes that failed because the session had expired, so the entry isn't lost
 * and can be replayed once the user has logged in again.
 *
 * Only a 401/419 is captured: the server refused before processing, so replaying is safe.
 */

const KEY = 'pending-writes-after-expiry';
const MAX_ENTRIES = 50;

export interface PendingWrite {
    method: string;
    url: string;
    /** JSON string body. Uploads (FormData) are not captured. */
    body: string;
    savedAt: string;
}

export type ReplayOutcome = { restored: number; rejected: number; remaining: number };

export function loadPendingWrites(): PendingWrite[] {
    try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function store(entries: PendingWrite[]): void {
    try {
        if (entries.length === 0) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch {
        // storage full or blocked: nothing more we can do
    }
}

export function capturePendingWrite(method: string, url: string, body: unknown): void {
    const verb = method.toUpperCase();
    if (verb === 'GET' || verb === 'HEAD' || typeof body !== 'string' || body === '') return;
    const path = new URL(url, window.location.href).pathname;
    if (path === '/csrf-token' || path === '/logout' || path.startsWith('/login')) return;

    const entries = loadPendingWrites();
    // Tapping save repeatedly must not queue the same entry again.
    if (entries.some((e) => e.method === verb && e.url === path && e.body === body)) return;
    store([...entries, { method: verb, url: path, body, savedAt: new Date().toISOString() }]);
}

export function discardPendingWrites(): void {
    store([]);
}

/** Replays in order. Stops at the first 401/419 (still signed out) and keeps what's left. */
export async function replayPendingWrites(): Promise<ReplayOutcome> {
    const entries = loadPendingWrites();
    let restored = 0;
    let rejected = 0;
    let index = 0;

    for (; index < entries.length; index++) {
        const entry = entries[index];
        try {
            const { csrfToken } = await (await fetch('/csrf-token', { credentials: 'include' })).json();
            const res = await fetch(entry.url, {
                method: entry.method,
                credentials: 'include',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                body: entry.body,
            });
            if (res.status === 401 || res.status === 419) break;
            if (res.ok) restored++;
            else if (res.status >= 500 || res.status === 429 || res.status === 408) break; // transient: keep for another try
            else rejected++; // the server refused the data itself; retrying won't help
        } catch {
            break; // offline
        }
    }

    const remaining = entries.slice(index);
    store(remaining);
    return { restored, rejected, remaining: remaining.length };
}
