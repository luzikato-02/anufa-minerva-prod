import { useCallback, useSyncExternalStore } from 'react';

export type Density = 'compact' | 'comfortable';

const STORAGE_KEY = 'density';
const CHANGE_EVENT = 'minerva:density-change';
const DEFAULT_DENSITY: Density = 'compact';

const isDensity = (value: unknown): value is Density =>
    value === 'compact' || value === 'comfortable';

// Fallback for when localStorage is unavailable, so a choice still holds for the session.
let inMemoryDensity: Density = DEFAULT_DENSITY;

const readDensity = (): Density => {
    if (typeof window === 'undefined') {
        return DEFAULT_DENSITY;
    }

    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        return isDensity(saved) ? saved : inMemoryDensity;
    } catch {
        return inMemoryDensity;
    }
};

const applyDensity = (density: Density) => {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.dataset.density = density;
};

/** Call once on boot so the first paint already has the saved density. */
export function initializeDensity() {
    applyDensity(readDensity());
}

const subscribe = (onChange: () => void) => {
    if (typeof window === 'undefined') {
        return () => {};
    }

    // Same-tab updates come through the custom event; other tabs through `storage`.
    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            applyDensity(readDensity());
            onChange();
        }
    };

    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);

    return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener('storage', onStorage);
    };
};

/**
 * Row/control density for review screens (tables, headers, toolbars).
 * Every component using this hook stays in sync, in this tab and across tabs.
 */
export function useDensity() {
    const density = useSyncExternalStore(
        subscribe,
        readDensity,
        () => DEFAULT_DENSITY,
    );

    const updateDensity = useCallback((next: Density) => {
        inMemoryDensity = next;

        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Storage can be unavailable (private mode); the attribute still applies.
        }

        applyDensity(next);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    return { density, updateDensity } as const;
}
