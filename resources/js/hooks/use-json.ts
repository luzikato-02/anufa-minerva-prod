import { useCallback, useEffect, useState } from 'react';

/**
 * GETs JSON from an app endpoint with the session cookie. Pass `null` to skip
 * the request (e.g. when the user lacks permission). `retry` refetches.
 */
export function useJson<T>(url: string | null) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt((a) => a + 1), []);

    useEffect(() => {
        if (!url) return;
        const controller = new AbortController();
        setError(null);
        fetch(url, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(`Server responded ${res.status}`);
                return (await res.json()) as T;
            })
            .then(setData)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError')
                    return;
                setError(err instanceof Error ? err.message : 'Request failed');
            });
        return () => controller.abort();
    }, [url, attempt]);

    return { data, error, retry };
}
